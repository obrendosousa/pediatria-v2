import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { fetchAndUpdateProfilePicture } from '@/ai/ingestion/services';
import { evolutionRequest, getEvolutionConfig } from '@/lib/evolution';
import { HumanMessage, AIMessage, BaseMessage } from "@langchain/core/messages";
import { claraGraph } from '@/ai/clara/graph';

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

    // =========================================================================
    // --- DESVIO IA: INTERCEPTAÇÃO PARA A CLARA (AGENTE AUTÔNOMO) ---
    // =========================================================================
    if (phone === '00000000000') {
      const fakeWppId = `ai_human_${Date.now()}`;

      // 1. Confirma o envio da mensagem do humano localmente
      if (dbMessageId) {
        await supabase.from('chat_messages')
          .update({ wpp_id: fakeWppId, status: 'read' })
          .eq('id', dbMessageId);
      } else {
        await supabase.from('chat_messages').insert({
          chat_id: chatId,
          phone,
          sender: 'HUMAN_AGENT',
          message_text: message || (type === 'text' ? '' : 'Mídia enviada'),
          message_type: type,
          media_url: mediaUrl,
          status: 'read',
          created_at: new Date().toISOString(),
          wpp_id: fakeWppId
        });
      }

      await supabase.from('chats').update({
        last_message: message || (type === 'text' ? '' : type === 'audio' ? 'Áudio' : 'Mídia'),
        last_message_type: type,
        last_message_sender: 'me',
        last_message_status: 'read',
        last_interaction_at: new Date().toISOString()
      }).eq('id', chatId);

      // 2. Dispara a chamada para o Grafo Autônomo da Clara em background
      (async () => {
        // Helper FIRE AND FORGET (NUNCA usar await nisso para não travar a IA)
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
          }).catch(() => { }); // Ignora falhas de rede silenciosamente
        };

        try {
          const { data: history } = await supabase.from('chat_messages')
            .select('sender, message_text')
            .eq('chat_id', chatId)
            .neq('wpp_id', fakeWppId)
            .order('created_at', { ascending: false })
            .limit(15);

          const langChainMessages: BaseMessage[] = [];

          if (history) {
            history.reverse().forEach(m => {
              if (m.sender === 'contact') {
                langChainMessages.push(new AIMessage(m.message_text || ''));
              } else {
                langChainMessages.push(new HumanMessage(m.message_text || ''));
              }
            });
          }

          let humanContent: any[] = [{
            type: "text",
            text: message || 'Mídia enviada.'
          }];

          langChainMessages.push(new HumanMessage({ content: humanContent }));

          console.log("\n🧠 [Clara] Iniciando motor LangGraph...");
          broadcastStatus('thinking');

          let finalMessages: BaseMessage[] = [];
          let typingSignaled = false;

          const stream = claraGraph.streamEvents(
            { messages: langChainMessages, chat_id: chatId },
            { version: 'v2' }
          );

          // Loop otimizado sem await bloqueante em chamadas externas
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
                console.log(`🔧 [Clara] Acionou ferramenta: ${event.name}`);

                // Traduz nomes técnicos para o frontend (se o frontend suportar)
                let statusLabel = `tool:${event.name}`;
                if (event.name === 'web_search') {
                  statusLabel = 'tool:web_search';
                } else if (event.name === 'query_database') {
                  statusLabel = 'tool:query_database';
                } else if (event.name === 'deep_research_chats' || event.name === 'deep_research_chats_tool') {
                  statusLabel = 'tool:deep_research_chats';
                } else if (event.name === 'get_filtered_chats_list') {
                  statusLabel = 'tool:get_filtered_chats_list';
                } else if (event.name === 'get_chat_cascade_history') {
                  statusLabel = 'tool:get_chat_cascade_history';
                } else if (event.name === 'analisar_chat_especifico') {
                  statusLabel = 'tool:analisar_chat_especifico';
                } else if (event.name === 'gerar_relatorio_qualidade_chats') {
                  statusLabel = 'tool:gerar_relatorio_qualidade_chats';
                }
                broadcastStatus(statusLabel);
                break;

              case 'on_chain_start':
                if (event.name === 'router_and_planner_node') {
                  console.log("🗺️ [Clara] Planejando os passos da execução...");
                  broadcastStatus('planning');
                } else if (event.name === 'executor_node') {
                  console.log("⚙️ [Clara] Executando um passo do plano...");
                  broadcastStatus('executing_step');
                } else if (event.name === 'reporter_node') {
                  console.log("✍️ [Clara] Escrevendo relatório final...");
                  broadcastStatus('writing_report');
                } else if (event.name === 'fetch_data') {
                  broadcastStatus('tool:Baixando mensagens do chat...');
                } else if (event.name === 'analyze_conversation') {
                  broadcastStatus('tool:IA pensando e extraindo gargalos...');
                } else if (event.name === 'save_to_db') {
                  broadcastStatus('tool:Salvando insights no banco...');
                }
                break;

              case 'on_chain_end':
                if (event.name === 'executor_node') {
                  console.log("✅ [Clara] Passo concluído e salvo no scratchpad.");
                  broadcastStatus('step_done');
                }
                if (event.name === 'LangGraph') {
                  finalMessages = (event.data?.output as { messages: BaseMessage[] })?.messages ?? [];
                }
                break;
            }
          }

          const lastMsg = finalMessages[finalMessages.length - 1];
          const rawContent = lastMsg?.content;
          const aiResponseText = typeof rawContent === "string"
            ? rawContent
            : Array.isArray(rawContent)
              ? (rawContent as Array<any>).map((c) => (typeof c === "string" ? c : c?.text ?? "")).filter(Boolean).join("")
              : rawContent
                ? String(rawContent)
                : '⚠️ Não consegui gerar uma resposta. Verifique os logs.';

          console.log("💾 [Clara] Salvando resposta final no banco...");

          await supabase.from('chat_messages').insert({
            chat_id: chatId,
            phone,
            sender: 'contact',
            message_text: aiResponseText,
            message_type: 'text',
            status: 'read',
            created_at: new Date().toISOString(),
            wpp_id: `ai_reply_${Date.now()}`
          });

          await supabase.from('chats').update({
            last_message: aiResponseText,
            last_message_type: 'text',
            last_message_sender: 'contact',
            last_message_status: 'read',
            last_interaction_at: new Date().toISOString()
          }).eq('id', chatId);

          broadcastStatus('done');
          console.log("✨ [Clara] Fluxo autônomo concluído com sucesso.\n");

        } catch (error) {
          console.error("❌ Erro fatal no Grafo da Clara:", error);
          await supabase.from('chat_messages').insert({
            chat_id: chatId,
            phone,
            sender: 'contact',
            message_text: "⚠️ Erro crítico no meu motor de raciocínio. Verifique o terminal.",
            message_type: 'text',
            status: 'read',
            created_at: new Date().toISOString()
          });
          broadcastStatus('done');
        }
      })();

      // Retorna imediatamente para o frontend não travar o botão de envio
      return NextResponse.json({ success: true, messageId: fakeWppId });
    }
    // =========================================================================

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

    let endpoint = '';
    let apiBody: any = {};

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

    await supabase.from('chats').update({
      last_message: message || (type === 'text' ? '' : type === 'audio' ? 'Áudio' : 'Mídia'),
      last_message_type: type,
      last_message_sender: 'me',
      last_message_status: 'sent',
      last_interaction_at: new Date().toISOString()
    }).eq('id', chatId);

    const { data: chatRow } = await supabase.from('chats').select('profile_pic').eq('id', chatId).single();
    if (!chatRow?.profile_pic) {
      fetchAndUpdateProfilePicture(phone, chatId);
    }

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