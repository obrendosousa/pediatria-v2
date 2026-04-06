/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { fetchAndUpdateProfilePicture } from '@/ai/ingestion/services';
import { evolutionRequest, getEvolutionConfig } from '@/lib/evolution';
import { HumanMessage, AIMessage, BaseMessage } from "@langchain/core/messages";
// Clara v2: CEO Agent substitui Clara v1 no chat interno (id 1495)
import { ceoGraph } from '@/ai/neural-network/ceo-graph';
import type { CeoState } from '@/ai/neural-network/ceo-graph';
import { parseVoiceSegments, generateAndUploadVoice } from '@/ai/voice/client';
import { generateReportPdf } from '@/lib/reportPdf';

// TLS: Configurado por conexao no checkpointer (ssl: { rejectUnauthorized: false })
// NAO desabilitar globalmente — vulnerabilidade MITM em producao
// v4: ToolNode wrapper for researcher_messages

// Cliente Admin (Service Role) para bypassar RLS se necessário
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { chatId, message, phone, type = 'text', mediaUrl, dbMessageId, replyTo, messageSource, options } = body;

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
          const { data: chatNotesRow } = await supabase.from('chat_notes')
            .select('notes')
            .eq('chat_id', chatId)
            .maybeSingle();

          // CEO Agent recebe apenas a mensagem pura (sem notas internas de paciente)
          const userText = message || 'Mídia enviada.';

          const langChainMessages = [new HumanMessage(userText)];

          console.log("\n🧠 [CEO Agent] Iniciando motor LangGraph v2...");
          broadcastStatus('thinking');

          let finalMessages: BaseMessage[] = [];
          let typingSignaled = false;
          let savedReportId: number | null = null;

          // Clara v2: CEO Agent graph com estado completo
          const ceoInputs: Partial<CeoState> = {
            messages: langChainMessages,
            current_user_role: "admin",
            temporal_anchor: null,
            db_stats: null,
            loaded_context: null,
            classification: "simple" as const,
            planned_tasks: [],
            worker_results: {},
            failed_agents: [],
            aggregated_data: null,
            verification_needed: false,
            verification_result: null,
            tool_call_count: 0,
            iteration: 0,
          };

          const stream = ceoGraph.streamEvents(
            ceoInputs,
            {
              version: 'v2',
              configurable: { thread_id: `ceo_chat_${chatId}` },
              streamMode: "values"
            }
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
                console.log(`🔧 [CEO] Acionou ferramenta: ${event.name}`);

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

              case 'on_tool_end':
                // Detecta quando save_report conclui para enviar PDF no chat
                if (event.name === 'save_report') {
                  const toolOutput = typeof event.data?.output === 'string' ? event.data.output : '';
                  const idMatch = toolOutput.match(/ID:\s*(\d+)/);
                  if (idMatch) {
                    savedReportId = parseInt(idMatch[1]);
                    console.log(`📄 [CEO] Relatório #${savedReportId} salvo — PDF será gerado.`);
                  }
                }
                break;

              case 'on_chain_start':
                // CEO Agent v2 nodes
                if (event.name === 'load_context') {
                  console.log("🔄 [CEO] Carregando contexto...");
                  broadcastStatus('thinking');
                } else if (event.name === 'classify') {
                  console.log("🧠 [CEO] Classificando pergunta...");
                  broadcastStatus('thinking');
                } else if (event.name === 'simple_answer') {
                  console.log("💬 [CEO] Respondendo diretamente...");
                  broadcastStatus('typing');
                } else if (event.name === 'plan_tasks') {
                  console.log("📋 [CEO] Planejando consulta aos setores...");
                  broadcastStatus('planning');
                } else if (event.name === 'dispatch_workers') {
                  console.log("🚀 [CEO] Despachando agentes setoriais...");
                  broadcastStatus('executing_step');
                } else if (event.name === 'synthesize') {
                  console.log("🔗 [CEO] Agregando resultados...");
                  broadcastStatus('thinking');
                } else if (event.name === 'verify') {
                  console.log("🔍 [CEO] Verificando dados...");
                  broadcastStatus('thinking');
                } else if (event.name === 'final_report') {
                  console.log("✍️ [CEO] Gerando resposta final...");
                  broadcastStatus('writing_report');
                }
                // Clara v1 legacy nodes (kept for compatibility)
                else if (event.name === 'classify_node') {
                  console.log("🔀 [CEO] Classificando intenção...");
                  broadcastStatus('thinking');
                } else if (event.name === 'write_research_brief_node') {
                  console.log("🗺️ [CEO] Elaborando brief de pesquisa...");
                  broadcastStatus('planning');
                } else if (event.name === 'research_supervisor_node') {
                  console.log("⚙️ [CEO] Supervisor orquestrando researchers paralelos...");
                  broadcastStatus('executing_step');
                } else if (event.name === 'final_report_node') {
                  console.log("✍️ [CEO] Sintetizando relatório final...");
                  broadcastStatus('writing_report');
                } else if (event.name === 'researcher') {
                  broadcastStatus('tool:Pesquisador coletando dados...');
                } else if (event.name === 'compress_research') {
                  broadcastStatus('tool:Comprimindo achados...');
                }
                // Nós do chatAnalyzerGraph (sub-grafo de análise estruturada)
                else if (event.name === 'fetch_data') {
                  broadcastStatus('tool:Baixando mensagens do chat...');
                } else if (event.name === 'analyze_conversation') {
                  broadcastStatus('tool:IA pensando e extraindo gargalos...');
                } else if (event.name === 'save_to_db') {
                  broadcastStatus('tool:Salvando insights no banco...');
                }
                break;

              case 'on_chain_end':
                if (event.name === 'research_supervisor_node') {
                  console.log("✅ [CEO] Rodada de researchers concluída.");
                  broadcastStatus('step_done');
                }
                // Captura a resposta final diretamente dos nós produtores de mensagem.
                // Mais robusto do que depender do evento 'LangGraph' que pode não disparar
                // corretamente quando há subgrafos compilados (researcher_graph) aninhados.
                if (event.name === 'simple_agent' || event.name === 'final_report_node' || event.name === 'write_research_brief_node'
                    || event.name === 'simple_answer' || event.name === 'final_report') {
                  const nodeMessages = (event.data?.output as { messages?: BaseMessage[] })?.messages;
                  if (nodeMessages && nodeMessages.length > 0) {
                    // Sempre sobrescreve — se o nó rodou múltiplas vezes (ReAct loop),
                    // queremos sempre a última mensagem gerada.
                    finalMessages = nodeMessages;
                    console.log(`📨 [CEO] Resposta capturada de '${event.name}' (${nodeMessages.length} msg(s))`);

                    // Detecta auto-save do finalReportNode (não passa pela tool save_report)
                    if (event.name === 'final_report_node' && !savedReportId) {
                      const lastContent = nodeMessages[nodeMessages.length - 1]?.content;
                      const txt = typeof lastContent === 'string' ? lastContent : '';
                      const reportMatch = txt.match(/\/relatorios\/(\d+)/);
                      if (reportMatch) {
                        savedReportId = parseInt(reportMatch[1]);
                        console.log(`📄 [CEO] Relatório #${savedReportId} (auto-save) — PDF será gerado.`);
                      }
                    }
                  }
                }
                // Fallback: extrai do evento de conclusão do grafo principal se ainda vazio
                if (event.name === 'LangGraph') {
                  const graphMessages = (event.data?.output as { messages?: BaseMessage[] })?.messages ?? [];
                  if (finalMessages.length === 0 && graphMessages.length > 0) {
                    finalMessages = graphMessages;
                    console.log(`📨 [CEO] Resposta capturada via fallback 'LangGraph' (${graphMessages.length} msg(s))`);
                  }
                }
                break;
            }
          }

          // Busca o último AIMessage — mais robusto que pegar apenas o último item do array,
          // pois evita capturar o HumanMessage do usuário se finalMessages vier do estado completo.
          const lastAiMsg = [...finalMessages].reverse().find(
            (m) => (m as any)._getType?.() === 'ai' || (m as any).type === 'ai' || m instanceof AIMessage
          ) ?? finalMessages[finalMessages.length - 1];

          const rawContent = lastAiMsg?.content;
          const aiResponseText = typeof rawContent === "string"
            ? rawContent
            : Array.isArray(rawContent)
              ? (rawContent as Array<any>).map((c) => (typeof c === "string" ? c : c?.text ?? "")).filter(Boolean).join("")
              : rawContent
                ? String(rawContent)
                : '⚠️ Não consegui gerar uma resposta. Verifique os logs.';

          // Fallback: se a resposta for vazia (Gemini às vezes retorna content vazio), avisa o usuário
          const safeFinalText = aiResponseText.trim().length > 0
            ? aiResponseText
            : '⚠️ Minha resposta ficou vazia — provavelmente um erro temporário do modelo. Tente novamente!';

          console.log(`💾 [CEO] Salvando resposta final no banco... (finalMessages: ${finalMessages.length}, chars: ${safeFinalText.length})`);

          // Parse síncrono — identifica segmentos <voice> e <text>
          // TEMP: força tudo como texto (ElevenLabs sem créditos)
          const segments: { type: 'text' | 'voice'; content: string }[] = [{ type: 'text', content: safeFinalText.replace(/<\/?voice>/g, '') }];
          const baseTs = Date.now();

          // Pré-gera todos os áudios SEQUENCIALMENTE antes de inserir no banco.
          // Sequencial (não paralelo) porque o Kokoro é CPU single-worker e
          // rejeita requests simultâneos. Fazer ANTES elimina o efeito placeholder→áudio.
          const voiceIndices = segments.reduce<number[]>((acc, s, i) => s.type === 'voice' ? [...acc, i] : acc, []);
          const voiceUrlMap = new Map<number, string | null>();

          for (const idx of voiceIndices) {
            console.log(`[Voice] Gerando segmento de voz ${voiceIndices.indexOf(idx) + 1}/${voiceIndices.length} (${segments[idx].content.length} chars)...`);
            const url = await generateAndUploadVoice(segments[idx].content).catch(e => {
              console.error(`[Voice] Falha no segmento ${idx}:`, e);
              return null as string | null;
            });
            voiceUrlMap.set(idx, url);
            console.log(`[Voice] Segmento ${idx}: ${url ? '✅ URL gerada' : '⚠️ geração falhou (será inserido sem áudio)'}`);
          }

          // Insere todas as mensagens de uma vez com URLs já resolvidas.
          // Se o áudio falhou (url null), degrada para texto com o conteúdo falado —
          // jamais insere voice sem media_url para evitar placeholder travado.
          for (let i = 0; i < segments.length; i++) {
            const seg = segments[i];
            const mediaUrl = seg.type === 'voice' ? (voiceUrlMap.get(i) ?? null) : null;
            const hasAudio = seg.type === 'voice' && mediaUrl !== null;
            const effectiveType = hasAudio ? 'voice' : (seg.type === 'voice' ? 'text' : seg.type);
            const effectiveText = hasAudio ? '🎵 Áudio da Clara' : seg.content;

            await supabase.from('chat_messages').insert({
              chat_id: chatId,
              phone,
              sender: 'contact',
              message_text: effectiveText,
              message_type: effectiveType,
              media_url: mediaUrl,
              status: 'read',
              created_at: new Date(baseTs + i * 1000).toISOString(),
              wpp_id: `ai_reply_${baseTs}_${i}`
            });
          }

          const lastSeg = segments[segments.length - 1];

          // ── PDF do Relatório: gera e envia como documento no chat ─────────
          if (savedReportId) {
            try {
              console.log(`📄 [CEO] Gerando PDF do relatório #${savedReportId}...`);
              broadcastStatus('tool:Gerando PDF do relatório...');

              const { data: reportData } = await supabase
                .from('clara_reports')
                .select('id, titulo, conteudo_markdown, created_at')
                .eq('id', savedReportId)
                .single();

              if (reportData) {
                const report = reportData as { id: number; titulo: string; conteudo_markdown: string; created_at: string };
                const pdfBuffer = await generateReportPdf({
                  titulo: report.titulo,
                  conteudo_markdown: report.conteudo_markdown,
                  created_at: report.created_at,
                  reportId: report.id,
                });

                const pdfFileName = `reports/relatorio_${report.id}_${Date.now()}.pdf`;
                const { error: uploadError } = await supabase.storage
                  .from('midia')
                  .upload(pdfFileName, pdfBuffer, { contentType: 'application/pdf', upsert: false });

                if (uploadError) {
                  console.error('📄 [CEO] Erro no upload do PDF:', uploadError);
                } else {
                  const { data: urlData } = supabase.storage
                    .from('midia')
                    .getPublicUrl(pdfFileName);

                  const pdfUrl = urlData.publicUrl;

                  await supabase.from('chat_messages').insert({
                    chat_id: chatId,
                    phone,
                    sender: 'contact',
                    message_text: `📄 ${report.titulo}.pdf`,
                    message_type: 'document',
                    media_url: pdfUrl,
                    status: 'read',
                    created_at: new Date(baseTs + segments.length * 1000 + 500).toISOString(),
                    wpp_id: `ai_report_pdf_${report.id}_${Date.now()}`
                  });

                  console.log(`📄 [CEO] PDF do relatório #${report.id} enviado no chat.`);
                }
              }
            } catch (pdfError) {
              console.error('📄 [CEO] Erro ao gerar/enviar PDF:', pdfError);
            }
          }
          // ──────────────────────────────────────────────────────────────────

          await supabase.from('chats').update({
            last_message: savedReportId
              ? `📄 Relatório #${savedReportId}.pdf`
              : (lastSeg?.content || safeFinalText),
            last_message_type: savedReportId ? 'document' : (lastSeg?.type || 'text'),
            last_message_sender: 'contact',
            last_message_status: 'read',
            last_interaction_at: new Date().toISOString()
          }).eq('id', chatId);

          broadcastStatus('done');
          console.log("✨ [CEO] Fluxo autônomo concluído com sucesso.\n");

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
        await evolutionRequest('/chat/sendPresence/{instance}', {
          method: 'POST',
          body: { number: destinationNumber, presence: pType, delay: 1200 },
        });
      } catch (e) { /* Erro não crítico */ }
    };

    if (type === 'contact' && options?.contact) {
      await setPresence('composing');
      endpoint = '/message/sendContact/{instance}';
      // Suporta single contact e array de contatos
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

    const { ok, status, data: responseData } = await evolutionRequest(endpoint, {
      method: 'POST',
      body: apiBody,
    });

    if (!ok) {
      console.error('[API] Erro Evolution:', responseData);
      // Marca a mensagem como failed no banco para o frontend saber
      if (dbMessageId) {
        await supabase.from('chat_messages').update({ status: 'failed' }).eq('id', dbMessageId);
      }
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
    if (type === 'sticker') memoryContent = `[FIGURINHA ENVIADA] URL: ${mediaUrl}`;
    if (type === 'audio') memoryContent = `[ÁUDIO ENVIADO] URL: ${mediaUrl}`;
    if (type === 'image') memoryContent = `[IMAGEM ENVIADA] ${message || ''} URL: ${mediaUrl}`;
    if (type === 'video') memoryContent = `[VÍDEO ENVIADO] ${message || ''} URL: ${mediaUrl}`;
    if (type === 'document') memoryContent = `[DOCUMENTO ENVIADO] ${message || ''} URL: ${mediaUrl}`;
    if (type === 'contact') memoryContent = `[CONTATO ENVIADO] ${message || ''}`;

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