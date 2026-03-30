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
    // DESVIO IA: AGENTE CLÍNICA GERAL
    // Mesmo padrão da Clara: fire-and-forget + Supabase Realtime Broadcast
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

      // Fire-and-forget: dispara o grafo LangGraph em background (não bloqueia a response)
      (async () => {
        // Helper: broadcast status via Supabase Realtime (mesmo padrão da Clara)
        const broadcastStatus = (status: string) => {
          fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/realtime/v1/api/broadcast`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
              'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
            },
            body: JSON.stringify({
              messages: [{
                topic: `clara:${chatId}`,
                event: 'status',
                payload: { status },
              }],
            }),
          }).catch(() => {});
        };

        try {
          const { HumanMessage, AIMessage } = await import('@langchain/core/messages');
          const { clinicaGeralGraph } = await import('@/ai/clinica-geral/graph');

          const userText = message || 'Mídia enviada.';
          broadcastStatus('thinking');

          let finalMessages: import('@langchain/core/messages').BaseMessage[] = [];
          let typingSignaled = false;

          const stream = clinicaGeralGraph.streamEvents(
            { messages: [new HumanMessage(userText)], chat_id: chatId },
            {
              version: 'v2',
              configurable: { thread_id: `clinica_geral_chat_${chatId}` },
              streamMode: 'values',
            }
          );

          for await (const event of stream) {
            switch (event.event) {
              case 'on_chat_model_start':
                typingSignaled = false;
                broadcastStatus('thinking');
                break;

              case 'on_chat_model_stream':
                if (!typingSignaled) {
                  typingSignaled = true;
                  broadcastStatus('typing');
                }
                break;

              case 'on_tool_start':
                typingSignaled = false;
                broadcastStatus(`tool:${event.name}`);
                break;

              case 'on_chain_start':
                if (event.name === 'classify_node') broadcastStatus('thinking');
                else if (event.name === 'write_research_brief_node') broadcastStatus('planning');
                else if (event.name === 'research_supervisor_node') broadcastStatus('executing_step');
                else if (event.name === 'final_report_node') broadcastStatus('writing_report');
                break;

              case 'on_chain_end':
                if (event.name === 'simple_agent' || event.name === 'final_report_node' || event.name === 'write_research_brief_node') {
                  const nodeMessages = (event.data?.output as { messages?: import('@langchain/core/messages').BaseMessage[] })?.messages;
                  if (nodeMessages && nodeMessages.length > 0) {
                    finalMessages = nodeMessages;
                  }
                }
                if (event.name === 'LangGraph') {
                  const graphMessages = (event.data?.output as { messages?: import('@langchain/core/messages').BaseMessage[] })?.messages ?? [];
                  if (finalMessages.length === 0 && graphMessages.length > 0) {
                    finalMessages = graphMessages;
                  }
                }
                break;
            }
          }

          // Extrai a resposta do último AIMessage
          const lastAiMsg = [...finalMessages].reverse().find(
            (m) => (m as any)._getType?.() === 'ai' || m instanceof AIMessage
          ) ?? finalMessages[finalMessages.length - 1];

          const rawContent = lastAiMsg?.content;
          const aiResponseText = typeof rawContent === 'string'
            ? rawContent
            : Array.isArray(rawContent)
              ? (rawContent as Array<any>).map((c) => (typeof c === 'string' ? c : c?.text ?? '')).filter(Boolean).join('')
              : rawContent ? String(rawContent) : 'Não consegui gerar uma resposta. Tente novamente.';

          // Limpa tags <voice>
          const cleanText = (aiResponseText.trim() || 'Não consegui gerar uma resposta.')
            .replace(/<\/?voice>/g, '');

          const baseTs = Date.now();
          await supabase.from('chat_messages').insert({
            chat_id: chatId,
            phone,
            sender: 'contact',
            message_text: cleanText,
            message_type: 'text',
            status: 'read',
            created_at: new Date(baseTs + 1000).toISOString(),
            wpp_id: `ai_atd_reply_${baseTs}`
          });

          await supabase.from('chats').update({
            last_message: cleanText.slice(0, 200),
            last_message_sender: 'contact',
            last_interaction_at: new Date(baseTs + 1000).toISOString(),
            unread_count: 1,
          }).eq('id', chatId);

          broadcastStatus('idle');
        } catch (err) {
          console.error('[Agente Clínica] Erro no grafo:', err);
          broadcastStatus('idle');

          await supabase.from('chat_messages').insert({
            chat_id: chatId,
            phone,
            sender: 'contact',
            message_text: 'Desculpe, tive um problema ao processar sua mensagem. Tente novamente.',
            message_type: 'text',
            status: 'read',
            created_at: new Date(Date.now() + 1000).toISOString(),
            wpp_id: `ai_atd_reply_${Date.now()}`
          });
        }
      })();

      // Retorna imediatamente — o grafo roda em background
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

    // Verificar se é um chat de grupo para usar o group_jid como destino
    const { data: chatInfo } = await supabase
      .from('chats')
      .select('is_group, group_jid')
      .eq('id', chatId)
      .maybeSingle();
    const isGroupChat = chatInfo?.is_group === true && chatInfo?.group_jid;
    const destinationNumber = isGroupChat ? chatInfo.group_jid : phone;
    const defaultRemoteJid = isGroupChat ? chatInfo.group_jid : `${cleanPhone}@s.whatsapp.net`;

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
          body: { number: destinationNumber, presence: pType, delay: 1200 },
        });
      } catch { /* Erro não crítico */ }
    };

    if (type === 'contact' && options?.contact) {
      await setPresence('composing');
      endpoint = '/message/sendContact/{instance}';
      const contactList = Array.isArray(options.contact) ? options.contact : [options.contact];
      apiBody = {
        number: destinationNumber,
        contact: contactList.map((c: any) => ({
          fullName: c.fullName || c.displayName || '',
          wuid: String(c.wuid || c.phoneNumber || c.phone || '').replace(/\D/g, ''),
          phoneNumber: c.phoneNumber || c.phone || '',
          ...(c.organization ? { organization: c.organization } : {}),
          ...(c.email ? { email: c.email } : {}),
          ...(c.url ? { url: c.url } : {}),
        })),
      };
    }
    else if (type === 'sticker' && mediaUrl) {
      await setPresence('composing');
      endpoint = '/message/sendSticker/{instance}';
      apiBody = { number: destinationNumber, sticker: mediaUrl };
    }
    else if (type === 'audio' && mediaUrl) {
      await setPresence('recording');
      endpoint = '/message/sendWhatsAppAudio/{instance}';
      apiBody = { number: destinationNumber, audio: mediaUrl, delay: 1000, encoding: true };
    }
    else if ((type === 'image' || type === 'video' || type === 'document') && mediaUrl) {
      await setPresence('composing');
      endpoint = '/message/sendMedia/{instance}';
      apiBody = {
        number: destinationNumber,
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
        number: destinationNumber,
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
