import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Cliente Admin
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  try {
    // 1. Buscar mensagens pendentes e vencidas
    const now = new Date().toISOString();
    const { data: messages, error } = await supabase
      .from('scheduled_messages')
      .select('*, chats(phone, id), automation_rule_id') // Trazemos o ID do chat e da automação
      .eq('status', 'pending')
      .lte('scheduled_for', now)
      .limit(10); 

    if (error) throw error;
    if (!messages || messages.length === 0) {
      return NextResponse.json({ message: 'Nada para enviar agora.' });
    }

    const results = [];

    // 2. Processar cada mensagem
    for (const msg of messages) {
      try {
        const phone = msg.chats?.phone;
        const chatId = msg.chats?.id;

        if (!phone || !chatId) {
            await supabase.from('scheduled_messages').update({ status: 'failed', error: 'Sem dados de chat' }).eq('id', msg.id);
            continue;
        }

        const baseUrl = process.env.EVOLUTION_API_URL?.replace(/\/$/, '');
        const instance = process.env.EVOLUTION_INSTANCE;
        const apiKey = process.env.EVOLUTION_API_KEY!;

        let success = false;
        let wppId = null;
        
        // Variáveis para salvar no histórico depois
        let sentContent = '';
        let sentType = 'text';
        let sentMediaUrl = null;

        const payload = typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content;

        // Suporta tanto 'macro' quanto 'adhoc' (automações)
        if (msg.item_type === 'macro' || msg.item_type === 'adhoc') {
            const { type, content, caption } = payload;
            sentType = type;

            let endpoint = '';
            let body: any = { number: phone, delay: 2000 };

            if (type === 'text') {
                endpoint = `${baseUrl}/message/sendText/${instance}`;
                body.text = content;
                sentContent = content;
            } else if (type === 'audio') {
                endpoint = `${baseUrl}/message/sendWhatsAppAudio/${instance}`;
                body.audio = content;
                body.encoding = true;
                sentMediaUrl = content;
                sentContent = caption || ''; // Usa caption se houver
            } else if (type === 'image') {
                endpoint = `${baseUrl}/message/sendMedia/${instance}`;
                body.media = content;
                body.mediatype = 'image';
                body.caption = caption || '';
                sentMediaUrl = content;
                sentContent = caption || '';
            } else if (type === 'document') {
                endpoint = `${baseUrl}/message/sendMedia/${instance}`;
                body.media = content;
                body.mediatype = 'document';
                body.caption = caption || '';
                sentMediaUrl = content;
                sentContent = caption || '';
            }

            if (endpoint) {
                const res = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
                    body: JSON.stringify(body)
                });
                const json = await res.json();
                if (res.ok) {
                    success = true;
                    wppId = json.key?.id || json.id;
                } else {
                    console.error(`[Schedule] Erro ao enviar:`, json);
                }
            }
        } 
        
        if (success) {
            // A. Marcar agendamento como enviado
            await supabase.from('scheduled_messages').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', msg.id);
            
            // B. Atualizar log de automação se existir
            if (msg.automation_rule_id) {
                // Buscar o log pendente mais recente para esta regra e chat
                const { data: logs } = await supabase
                    .from('automation_logs')
                    .select('id')
                    .eq('automation_rule_id', msg.automation_rule_id)
                    .eq('status', 'pending')
                    .order('created_at', { ascending: false })
                    .limit(1);
                
                if (logs && logs.length > 0) {
                    await supabase
                        .from('automation_logs')
                        .update({ 
                            status: 'sent', 
                            sent_at: new Date().toISOString() 
                        })
                        .eq('id', logs[0].id);
                }
            }
            
            // C. SALVAR NO VISUAL (chat_messages)
            await supabase.from('chat_messages').insert({
                chat_id: chatId,
                phone: phone,
                sender: 'HUMAN_AGENT',
                message_text: sentContent,
                message_type: sentType,
                media_url: sentMediaUrl,
                wpp_id: wppId,
                created_at: new Date().toISOString()
            });

            // D. SALVAR NA MEMÓRIA IA (n8n_chat_histories)
            let memoryText = sentContent;
            if (sentType === 'audio') memoryText = `[ÁUDIO AGENDADO] URL: ${sentMediaUrl}`;
            if (sentType === 'image') memoryText = `[IMAGEM AGENDADA]${sentContent ? ' ' + sentContent : ''} URL: ${sentMediaUrl}`;
            if (sentType === 'document') memoryText = `[DOCUMENTO AGENDADO]${sentContent ? ' ' + sentContent : ''} URL: ${sentMediaUrl}`;

            await supabase.from('n8n_chat_histories').insert({
                session_id: phone,
                message: {
                    type: 'ai',
                    content: memoryText,
                    additional_kwargs: { wpp_id: wppId, from_schedule: true, automation_rule_id: msg.automation_rule_id }
                }
            });

            results.push({ id: msg.id, status: 'sent' });
        } else {
             await supabase.from('scheduled_messages').update({ status: 'failed' }).eq('id', msg.id);
             
             // Atualizar log de automação como falhou
             if (msg.automation_rule_id) {
                const { data: logs } = await supabase
                    .from('automation_logs')
                    .select('id')
                    .eq('automation_rule_id', msg.automation_rule_id)
                    .eq('status', 'pending')
                    .order('created_at', { ascending: false })
                    .limit(1);
                
                if (logs && logs.length > 0) {
                    await supabase
                        .from('automation_logs')
                        .update({ 
                            status: 'failed',
                            error_message: 'Falha ao enviar mensagem'
                        })
                        .eq('id', logs[0].id);
                }
             }
             
             results.push({ id: msg.id, status: 'failed' });
        }

      } catch (err: any) {
        console.error(`Erro msg ${msg.id}:`, err);
        await supabase.from('scheduled_messages').update({ status: 'failed', error: err.message }).eq('id', msg.id);
      }
    }

    return NextResponse.json({ success: true, processed: results });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}