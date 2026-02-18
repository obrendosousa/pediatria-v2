import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { fetchAndUpdateProfilePicture } from '@/ai/ingestion/services';
import { evolutionRequest, getEvolutionConfig } from '@/lib/evolution';

// Cliente Admin (Service Role) para bypassar RLS se necessário
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { chatId, message, phone, type = 'text', mediaUrl, dbMessageId, replyTo, messageSource } = body;

    // 1. Validação Básica
    if (!phone || !chatId) {
      return NextResponse.json({ error: 'Dados incompletos (phone ou chatId ausentes)' }, { status: 400 });
    }

    try {
      getEvolutionConfig();
    } catch (configError) {
      console.error('[API] Erro de Configuração: Variáveis de ambiente ausentes.');
      return NextResponse.json({ error: 'Erro interno de configuração de API' }, { status: 500 });
    }

    const cleanPhone = String(phone).replace(/\D/g, '');
    const defaultRemoteJid = `${cleanPhone}@s.whatsapp.net`;
    const hasQuotedId = typeof replyTo?.wppId === 'string' && replyTo.wppId.trim().length > 0;
    const quotedPayload = hasQuotedId
      ? {
          key: {
            id: String(replyTo.wppId).trim(),
            remoteJid:
              typeof replyTo?.remoteJid === 'string' && replyTo.remoteJid.trim()
                ? String(replyTo.remoteJid).trim()
                : defaultRemoteJid,
            fromMe: Boolean(replyTo?.fromMe),
          },
          message:
            typeof replyTo?.quotedText === 'string' && replyTo.quotedText.trim().length > 0
              ? { conversation: String(replyTo.quotedText).trim() }
              : undefined,
        }
      : undefined;

    // 2. Preparar Payload da Evolution
    let endpoint = '';
    let apiBody: any = {};

    // Função para simular digitação/gravação
    const setPresence = async (pType: 'composing' | 'recording') => {
      try {
        await evolutionRequest('/chat/sendPresence/{instance}', {
          method: 'POST',
          body: { number: phone, presence: pType, delay: 1200 },
        });
      } catch (e) { /* Erro não crítico */ }
    };

    if (type === 'audio' && mediaUrl) {
      await setPresence('recording');
      endpoint = '/message/sendWhatsAppAudio/{instance}';
      apiBody = { number: phone, audio: mediaUrl, delay: 1000, encoding: true };
    } 
    // Suporte unificado para Imagem e Vídeo via sendMedia
    else if ((type === 'image' || type === 'video' || type === 'document') && mediaUrl) {
      await setPresence('composing');
      endpoint = '/message/sendMedia/{instance}';
      apiBody = { 
        number: phone, 
        media: mediaUrl, 
        mediatype: type, 
        caption: message || '', 
        delay: 1000 
      };
    } else {
      await setPresence('composing');
      endpoint = '/message/sendText/{instance}';
      apiBody = {
        number: phone,
        text: message,
        delay: 1000,
        ...(quotedPayload ? { quoted: quotedPayload, quotedMessage: quotedPayload } : {}),
      };
    }

    // 3. Enviar para Evolution API
    const { ok, status, data: responseData } = await evolutionRequest(endpoint, {
      method: 'POST',
      body: apiBody,
    });
    
    if (!ok) {
      console.error('[API] Erro Evolution:', responseData);
      return NextResponse.json({ error: 'Falha ao enviar mensagem', details: responseData }, { status: status || 502 });
    }

    const responseObj = (typeof responseData === 'object' && responseData !== null
      ? responseData
      : {}) as Record<string, any>;
    const wppId = responseObj.key?.id || responseObj.id || null;
    const sourceTag =
      typeof messageSource === 'string' && messageSource.trim()
        ? String(messageSource).trim()
        : dbMessageId
          ? 'manual_chat'
          : 'automation';
    const replyMeta =
      replyTo && hasQuotedId
        ? {
            reply_to: {
              wpp_id: String(replyTo.wppId),
              sender: String(replyTo.sender || ''),
              message_type: String(replyTo.message_type || 'text'),
              message_text: String(replyTo.quotedText || ''),
              remote_jid:
                typeof replyTo.remoteJid === 'string' && replyTo.remoteJid.trim()
                  ? String(replyTo.remoteJid).trim()
                  : defaultRemoteJid,
            },
          }
        : null;

    // 4. Persistência no Banco de Dados
    if (dbMessageId) {
        // Atualiza mensagem existente (Optimistic UI)
        await supabase.from('chat_messages')
            .update({
              wpp_id: wppId,
              status: 'sent',
              ...(hasQuotedId ? { quoted_wpp_id: String(replyTo.wppId).trim() } : {}),
              tool_data: {
                source: sourceTag,
                ...(replyMeta || {}),
              },
            })
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
            status: 'sent',
            ...(hasQuotedId ? { quoted_wpp_id: String(replyTo.wppId).trim() } : {}),
            tool_data: {
              source: sourceTag,
              ...(replyMeta || {}),
            },
            created_at: new Date().toISOString()
        });
    }

    // 4b. Atualiza preview do chat na sidebar (last_message_status para checks)
    await supabase.from('chats').update({
        last_message: message || (type === 'text' ? '' : type === 'audio' ? 'Áudio' : 'Mídia'),
        last_message_type: type,
        last_message_sender: 'me',
        last_message_status: 'sent',
        last_interaction_at: new Date().toISOString()
    }).eq('id', chatId);

    // 4c. Buscar foto de perfil em background (Evolution fetchProfilePictureUrl) quando enviamos primeiro
    const { data: chatRow } = await supabase.from('chats').select('profile_pic').eq('id', chatId).single();
    if (!chatRow?.profile_pic) {
      fetchAndUpdateProfilePicture(phone, chatId);
    }

    // 5. Salvar na Memória da IA
    let memoryContent = message;
    if (type === 'audio') memoryContent = `[ÁUDIO ENVIADO] URL: ${mediaUrl}`;
    if (type === 'image') memoryContent = `[IMAGEM ENVIADA] ${message || ''} URL: ${mediaUrl}`;
    if (type === 'video') memoryContent = `[VÍDEO ENVIADO] ${message || ''} URL: ${mediaUrl}`;
    if (type === 'document') memoryContent = `[DOCUMENTO ENVIADO] ${message || ''} URL: ${mediaUrl}`;

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