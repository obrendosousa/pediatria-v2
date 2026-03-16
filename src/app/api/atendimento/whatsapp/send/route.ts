/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { NextResponse } from 'next/server';
import { createSchemaAdminClient } from '@/lib/supabase/schemaServer';
import { fetchAndUpdateProfilePicture } from '@/ai/ingestion/services';
import { evolutionRequest, getEvolutionConfig, buildEvolutionEndpoint } from '@/lib/evolution';

const SCHEMA = 'atendimento';
const EVOLUTION_INSTANCE_KEY = 'EVOLUTION_ATENDIMENTO_INSTANCE';
const AI_PHONE = '00000000001';

function getConfig() {
  return getEvolutionConfig(EVOLUTION_INSTANCE_KEY);
}

function evoRequest(pathTemplate: string, opts: { method?: string; body?: unknown } = {}) {
  const cfg = getConfig();
  const endpoint = buildEvolutionEndpoint(pathTemplate, cfg);
  return fetch(endpoint, {
    method: (opts.method ?? 'POST') as string,
    headers: { 'Content-Type': 'application/json', apikey: cfg.apiKey },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  }).then(async (res) => {
    const ct = res.headers.get('content-type') ?? '';
    const data = ct.includes('json') ? await res.json().catch(() => ({})) : await res.text().catch(() => '');
    return { ok: res.ok, status: res.status, data };
  });
}

export async function POST(req: Request) {
  const supabase = createSchemaAdminClient(SCHEMA);

  try {
    const body = await req.json();
    const { chatId, message, phone, type = 'text', mediaUrl, dbMessageId, replyTo, messageSource, options } = body;

    if (!phone || !chatId) {
      return NextResponse.json({ error: 'Dados incompletos (phone ou chatId ausentes)' }, { status: 400 });
    }

    // =========================================================================
    // DESVIO IA: AGENTE CLÍNICA GERAL (placeholder — será implementado depois)
    // =========================================================================
    if (phone === AI_PHONE) {
      const fakeWppId = `ai_atd_${Date.now()}`;

      if (dbMessageId) {
        await supabase.from('chat_messages')
          .update({ wpp_id: fakeWppId, status: 'read' })
          .eq('id', dbMessageId);
      } else {
        await supabase.from('chat_messages').insert({
          chat_id: chatId,
          phone,
          sender: 'HUMAN_AGENT',
          message_text: message || '',
          message_type: type,
          media_url: mediaUrl,
          status: 'read',
          created_at: new Date().toISOString(),
          wpp_id: fakeWppId
        });
      }

      await supabase.from('chats').update({
        last_message: message || '',
        last_message_type: type,
        last_message_sender: 'me',
        last_message_status: 'read',
        last_interaction_at: new Date().toISOString()
      }).eq('id', chatId);

      // Placeholder: resposta automática informando que o agente será configurado
      await supabase.from('chat_messages').insert({
        chat_id: chatId,
        phone,
        sender: 'contact',
        message_text: '⚙️ O agente IA da Clínica Geral ainda não foi configurado. Em breve estará disponível.',
        message_type: 'text',
        status: 'read',
        created_at: new Date(Date.now() + 1000).toISOString(),
        wpp_id: `ai_atd_reply_${Date.now()}`
      });

      return NextResponse.json({ success: true, messageId: fakeWppId });
    }
    // =========================================================================

    try {
      const cfg = getConfig();
      console.log(`[ATD/Send] Config OK: instance=${cfg.instance} keyPrefix=${cfg.apiKey?.slice(0, 8)}...`);
    } catch (cfgErr: any) {
      console.error('[ATD/Send] Config FALHOU:', cfgErr?.message);
      return NextResponse.json({ error: 'Evolution API (atendimento) não configurada. Verifique EVOLUTION_ATENDIMENTO_INSTANCE e EVOLUTION_ATENDIMENTO_API_KEY no ambiente.' }, { status: 500 });
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

    let endpoint = '';
    let apiBody: any = {};

    const setPresence = async (pType: 'composing' | 'recording') => {
      try {
        await evoRequest('/chat/sendPresence/{instance}', {
          body: { number: phone, presence: pType, delay: 1200 },
        });
      } catch { /* Erro não crítico */ }
    };

    if (type === 'sticker' && mediaUrl) {
      await setPresence('composing');
      endpoint = '/message/sendSticker/{instance}';
      apiBody = { number: phone, sticker: mediaUrl };
    }
    else if (type === 'audio' && mediaUrl) {
      await setPresence('recording');
      endpoint = '/message/sendWhatsAppAudio/{instance}';
      apiBody = { number: phone, audio: mediaUrl, delay: 1000, encoding: true };
    }
    else if ((type === 'image' || type === 'video' || type === 'document') && mediaUrl) {
      await setPresence('composing');
      endpoint = '/message/sendMedia/{instance}';
      apiBody = {
        number: phone,
        media: mediaUrl,
        mediatype: type,
        caption: message || '',
        delay: 1000,
        ...(type === 'document' && options?.file_name ? { fileName: options.file_name } : {}),
        ...(type === 'document' && options?.mime_type ? { mimetype: options.mime_type } : {}),
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

    console.log(`[ATD/Send] Enviando: endpoint=${endpoint} type=${type} mediaUrl=${mediaUrl ? mediaUrl.slice(0, 80) : 'N/A'}`);
    const { ok, status, data: responseData } = await evoRequest(endpoint, { body: apiBody });

    if (!ok) {
      console.error('[ATD/Send] Erro Evolution:', status, JSON.stringify(responseData).slice(0, 500));
      // Marca a mensagem como failed no banco para o frontend saber
      if (dbMessageId) {
        await supabase.from('chat_messages').update({ status: 'failed' }).eq('id', dbMessageId);
      }
      return NextResponse.json({ error: 'Falha ao enviar mensagem', details: responseData }, { status: status || 502 });
    }
    console.log(`[ATD/Send] Sucesso: type=${type} response=${JSON.stringify(responseData).slice(0, 200)}`);

    const responseObj = (typeof responseData === 'object' && responseData !== null
      ? responseData
      : {}) as Record<string, any>;
    const wppId = responseObj.key?.id || responseObj.id || null;
    const sourceTag =
      typeof messageSource === 'string' && messageSource.trim()
        ? String(messageSource).trim()
        : dbMessageId ? 'manual_chat' : 'automation';
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

    if (dbMessageId) {
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
      await supabase.from('chat_messages').insert({
        chat_id: chatId,
        phone,
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

    await supabase.from('chats').update({
      last_message: message || (type === 'text' ? '' : type === 'audio' ? 'Áudio' : 'Mídia'),
      last_message_type: type,
      last_message_sender: 'me',
      last_message_status: 'sent',
      last_interaction_at: new Date().toISOString()
    }).eq('id', chatId);

    return NextResponse.json({ success: true, messageId: wppId });

  } catch (error: any) {
    console.error('[ATD/Send] Erro Geral:', error);
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}
