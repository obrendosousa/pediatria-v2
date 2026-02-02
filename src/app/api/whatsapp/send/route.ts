import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Cliente Admin (Service Role) para bypassar RLS se necessário
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { chatId, message, phone, type = 'text', mediaUrl, dbMessageId } = body;

    // 1. Validação Básica
    if (!phone || !chatId) {
      return NextResponse.json({ error: 'Dados incompletos (phone ou chatId ausentes)' }, { status: 400 });
    }

    const baseUrl = process.env.EVOLUTION_API_URL?.replace(/\/$/, '');
    const instance = process.env.EVOLUTION_INSTANCE;
    const apiKey = process.env.EVOLUTION_API_KEY!;

    if (!baseUrl || !instance || !apiKey) {
      console.error('[API] Erro de Configuração: Variáveis de ambiente ausentes.');
      return NextResponse.json({ error: 'Erro interno de configuração de API' }, { status: 500 });
    }

    // 2. Preparar Payload da Evolution
    let endpoint = '';
    let apiBody: any = {};

    // Função para simular digitação/gravação
    const setPresence = async (pType: 'composing' | 'recording') => {
      try {
        await fetch(`${baseUrl}/chat/sendPresence/${instance}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
          body: JSON.stringify({ number: phone, presence: pType, delay: 1200 })
        });
      } catch (e) { /* Erro não crítico */ }
    };

    if (type === 'audio' && mediaUrl) {
      await setPresence('recording');
      endpoint = `${baseUrl}/message/sendWhatsAppAudio/${instance}`;
      apiBody = { number: phone, audio: mediaUrl, delay: 1000, encoding: true };
    } 
    // Suporte unificado para Imagem e Vídeo via sendMedia
    else if ((type === 'image' || type === 'video') && mediaUrl) {
      await setPresence('composing');
      endpoint = `${baseUrl}/message/sendMedia/${instance}`;
      apiBody = { 
        number: phone, 
        media: mediaUrl, 
        mediatype: type, 
        caption: message || '', 
        delay: 1000 
      };
    } else {
      await setPresence('composing');
      endpoint = `${baseUrl}/message/sendText/${instance}`;
      apiBody = { number: phone, text: message, delay: 1000 };
    }

    // 3. Enviar para Evolution API
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
      body: JSON.stringify(apiBody)
    });

    const responseData = await res.json().catch(() => ({}));
    
    if (!res.ok) {
      console.error('[API] Erro Evolution:', responseData);
      return NextResponse.json({ error: 'Falha ao enviar mensagem', details: responseData }, { status: 502 });
    }

    const wppId = responseData.key?.id || responseData.id || null;

    // 4. Persistência no Banco de Dados
    if (dbMessageId) {
        // Atualiza mensagem existente (Optimistic UI)
        await supabase.from('chat_messages')
            .update({ wpp_id: wppId })
            .eq('id', dbMessageId);
    } else {
        // Cria nova entrada (Automações/Macros)
        await supabase.from('chat_messages').insert({
            chat_id: chatId,
            phone: phone,
            sender: 'HUMAN_AGENT',
            message_text: message || (type === 'text' ? '' : 'Mídia'),
            message_type: type,
            media_url: mediaUrl || null,
            wpp_id: wppId,
            created_at: new Date().toISOString()
        });
    }

    // 5. Salvar na Memória da IA
    let memoryContent = message;
    if (type === 'audio') memoryContent = `[ÁUDIO ENVIADO] URL: ${mediaUrl}`;
    if (type === 'image') memoryContent = `[IMAGEM ENVIADA] ${message || ''} URL: ${mediaUrl}`;
    if (type === 'video') memoryContent = `[VÍDEO ENVIADO] ${message || ''} URL: ${mediaUrl}`;

    await supabase.from('n8n_chat_histories').insert({
      session_id: phone,
      message: {
        type: 'ai',
        content: memoryContent,
        additional_kwargs: { media_url: mediaUrl, message_type: type, wpp_id: wppId }
      }
    });

    return NextResponse.json({ success: true, messageId: wppId });

  } catch (error: any) {
    console.error('[API] Erro Geral:', error);
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}