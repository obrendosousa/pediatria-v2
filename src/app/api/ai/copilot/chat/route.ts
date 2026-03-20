import { NextResponse } from "next/server";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { createClient } from "@/lib/supabase/server";
import { requireApprovedProfile } from "@/lib/auth/requireApprovedProfile";
import { getSupabaseAdminClient } from "@/lib/automation/adapters/supabaseAdmin";
import { claraGraph } from "@/ai/clara/graph";
import { saveGraphCheckpoint } from "@/ai/clara/interactive_questions";
import { setFanOutProgressCallback } from "@/ai/clara/raw_data_analyzer";

type HistoryItem = {
  role: "user" | "assistant";
  content: string;
};

// Nós do grafo que produzem resposta visível ao usuário
const RESPONSE_NODES = new Set(["simple_agent", "final_report_node"]);

// ─────────────────────────────────────────────────────────────────────────────
// CONTEXT SEPARATION (Clara 2.0)
// Classifica o escopo da pergunta e remove fisicamente o contexto do paciente
// quando a query é global — não confia no modelo para ignorar.
// ─────────────────────────────────────────────────────────────────────────────

function classifyScope(message: string): "local" | "global" | "hybrid" {
  const lower = message.toLowerCase();

  const globalPatterns = [
    /quantos? (chats?|conversas?|atendimentos?|leads?|pacientes?)[\s\S]{0,30}(tivemos|tiveram|foram|houve|entrada)/,
    /relat[oó]rio|dashboard|resumo (do dia|da semana|do m[eê]s|geral)/,
    /volume (de|da|do)|pico|m[eé]dia geral|total (de|da|do)/,
    /obje[çc][oõ]es|gargalos|padr[aã]o de atendimento/,
    /faturamento|financeiro|agenda (do dia|da semana)/,
    /como est[aá] a cl[ií]nica|como foi o dia/,
    /todos os (chats|leads|pacientes)/,
    /an[aá]lise (geral|global|de todas)/,
  ];

  const localPatterns = [
    /\b(esse?|est[ea]|d?esse?|d?est[ea]) (paciente|chat|conversa|caso)\b/,
    /histórico (dele|dela|do paciente|desse)/,
    /ler (a |o )?(conversa|chat|mensagen)/,
    /mensagem.*para\s+(ele|ela|o paciente|a paciente|enviar)/,
    /verificar (o |a )?(agendamento|consulta) (dele|dela|desse)/,
    /como (est[aá]|foi) (o |a )?(atendimento|conversa) (dele|dela|desse)/,
  ];

  const isGlobal = globalPatterns.some((p) => p.test(lower));
  const isLocal = localPatterns.some((p) => p.test(lower));

  if (isGlobal && isLocal) return "hybrid";
  if (isGlobal) return "global";
  return "local";
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    await requireApprovedProfile(supabase, { allowedRoles: ["admin", "secretary"] });

    const body = (await request.json()) as {
      chatId?: unknown;
      message?: unknown;
      history?: unknown;
    };

    const chatId = typeof body.chatId === "number" ? body.chatId : Number(body.chatId);
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const history = Array.isArray(body.history) ? (body.history as HistoryItem[]) : [];

    if (!chatId || isNaN(chatId)) {
      return NextResponse.json({ error: "Campo 'chatId' é obrigatório." }, { status: 400 });
    }
    if (!message) {
      return NextResponse.json({ error: "Campo 'message' é obrigatório." }, { status: 400 });
    }

    const adminSupabase = getSupabaseAdminClient();

    // Clara 2.0: context separation — classifica escopo ANTES de montar o contexto
    const scope = classifyScope(message);

    let contextualMessage: string;

    if (scope === "global") {
      // GLOBAL: remove fisicamente o contexto do paciente
      contextualMessage = `[MODO COPILOTO — CONSULTA GLOBAL]
Você é a Clara, assistente de IA da clínica. O usuário fez uma pergunta GLOBAL sobre a clínica.

PERGUNTA DO USUÁRIO: ${message}

INSTRUÇÕES: Use suas ferramentas para buscar dados de TODO o banco. Não limite a um paciente específico.`;
    } else {
      // LOCAL ou HYBRID: inclui contexto do paciente
      const { data: chatData } = await adminSupabase
        .from("chats")
        .select("id, contact_name")
        .eq("id", chatId)
        .maybeSingle();

      const patientName = (chatData as { contact_name: string } | null)?.contact_name || "Paciente";

      const { data: messagesData } = await adminSupabase
        .from("chat_messages")
        .select("sender, message_text, message_type, created_at")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: false })
        .limit(20);

      const chatHistory = messagesData
        ? (messagesData as Array<{ sender: string; message_text: string; message_type: string; created_at: string }>)
          .reverse()
          .map((msg) => {
            const isClinic =
              msg.sender === "HUMAN_AGENT" || msg.sender === "AI_AGENT" || msg.sender === "me";
            const senderName = isClinic ? "Clínica" : patientName;
            const content =
              msg.message_text?.trim() || `[Mídia: ${msg.message_type || "desconhecido"}]`;
            const timeStr = new Date(msg.created_at).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            });
            return `[${timeStr}] ${senderName}: ${content}`;
          })
          .join("\n")
        : "";

      if (scope === "hybrid") {
        contextualMessage = `[MODO COPILOTO — CONSULTA HÍBRIDA]
Você é a Clara, assistente de IA da clínica. O usuário está na tela do chat de: ${patientName} (chat_id: ${chatId}).

CONTEXTO DO PACIENTE (para referência se necessário):
${chatHistory || "Nenhuma mensagem disponível."}

PERGUNTA DO USUÁRIO: ${message}

INSTRUÇÕES: A pergunta pode envolver dados gerais e deste paciente. Use as ferramentas adequadas.`;
      } else {
        contextualMessage = `[MODO COPILOTO — CHAT DO PACIENTE]
Você é a Clara, assistente de IA da clínica. O usuário está na tela do chat de: ${patientName} (chat_id: ${chatId}).

HISTÓRICO RECENTE (últimas 20 mensagens):
------------------------------------------------------
${chatHistory || "Nenhuma mensagem disponível."}
------------------------------------------------------

PERGUNTA DO USUÁRIO: ${message}

INSTRUÇÕES: A pergunta é sobre ESTE paciente. Use o histórico acima e ferramentas para ajudar.`;
      }
    }

    // Reconstrói histórico do mini-chat
    const priorMessages = history
      .filter((item) => item.content?.trim())
      .map((item) =>
        item.role === "assistant" ? new AIMessage(item.content) : new HumanMessage(item.content)
      );

    // Clara 2.0: NÃO resetar temporal_anchor — o load_context_node lê o anterior
    // do state persistido pelo checkpointer para suportar multi-turn temporal.
    const inputs = {
      messages: [...priorMessages, new HumanMessage(contextualMessage)],
      chat_id: chatId,
      is_deep_research: false,
      is_planning_mode: false,
      research_brief: "",
      raw_notes: [],
      supervisor_messages: [],
      supervisor_iteration: 0,
      research_complete: false,
      current_user_role: "admin" as const,
      // Clara 2.0 — preenchidos pelo load_context_node (temporal_anchor preservado para multi-turn)
      db_stats: null,
      loaded_context: null,
      spot_check_result: null,
      pending_question: null,
    };

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const enqueue = (payload: object) =>
          controller.enqueue(encoder.encode(JSON.stringify(payload) + "\n"));

        // Fan-out progress: emite ui_log a cada lote processado
        setFanOutProgressCallback(({ batch, total, chatsProcessed, chatsTotal }) => {
          enqueue({
            type: "ui_log",
            subtype: "research_step",
            content: `📊 Lote ${batch}/${total} processado (${chatsProcessed}/${chatsTotal} conversas classificadas)`,
            metadata: { batch, total, chatsProcessed, chatsTotal },
          });
        });

        try {
          // Clara 2.0: emite escopo detectado com subtype
          enqueue({
            type: "ui_log",
            subtype: "classify",
            content: scope === "global" ? "🌐 Consulta global detectada..." : scope === "hybrid" ? "🔀 Consulta híbrida detectada..." : "📍 Consulta sobre este paciente...",
            metadata: { scope },
          });

          const events = claraGraph.streamEvents(inputs, {
            version: "v2",
            configurable: { thread_id: `copilot_${chatId}_${Date.now()}` },
            streamMode: "values"
          });

          let chunksEmitted = 0;

          for await (const event of events) {
            // --- STATUS: Nós do grafo ---
            if (event.event === "on_chain_start") {
              const node: string = event.name ?? "";
              if (node === "load_context_node") {
                enqueue({ type: "ui_log", subtype: "memory", content: "🔄 Carregando contexto e memória..." });
              } else if (node === "classify_node") {
                enqueue({ type: "ui_log", subtype: "classify", content: "🧠 Analisando complexidade da pergunta..." });
              } else if (node === "spot_check_node") {
                enqueue({ type: "ui_log", subtype: "spot_check", content: "🔍 Verificando citações..." });
              } else if (node === "write_research_brief_node") {
                enqueue({ type: "ui_log", subtype: "research_step", content: "📝 Criando plano de pesquisa...", metadata: { step: 1, total: 3 } });
              } else if (node === "research_supervisor_node") {
                enqueue({ type: "ui_log", subtype: "research_step", content: "🔍 Executando etapa da pesquisa..." });
              } else if (node === "final_report_node") {
                enqueue({ type: "ui_log", subtype: "research_step", content: "✍️ Escrevendo relatório final..." });
              }
            }

            // --- Clara 2.0: emite temporal anchor quando load_context_node termina ---
            if (event.event === "on_chain_end") {
              const node: string = event.name ?? "";
              if (node === "load_context_node") {
                const outputState = event.data?.output as Record<string, unknown> | undefined;
                const anchor = outputState?.temporal_anchor as { period_label?: string; comparison_period?: { label?: string } | null } | null;
                if (anchor?.period_label) {
                  enqueue({ type: "ui_log", subtype: "temporal", content: `📅 ${anchor.period_label}`, metadata: { period: anchor.period_label } });
                  if (anchor.comparison_period?.label) {
                    enqueue({ type: "ui_log", subtype: "temporal", content: `📅 Comparação: ${anchor.comparison_period.label}` });
                  }
                }
              }
            }

            // --- STATUS: Chamadas de ferramenta com subtype + metadata ---
            if (event.event === "on_tool_start") {
              const toolName: string = event.name ?? "";
              const toolInput = event.data?.input as Record<string, unknown> | undefined;
              let label = toolName;
              let subtype = "query_start";
              const metadata: Record<string, unknown> = { tool: toolName };

              if (toolName === "get_chat_cascade_history") { label = "📖 Lendo histórico do paciente..."; }
              else if (toolName === "search_knowledge_base") { label = "🔎 Consultando base de conhecimento..."; }
              else if (toolName === "read_brain_files") { label = "🧠 Lendo contexto da clínica..."; }
              else if (toolName === "manage_long_term_memory") { label = "💭 Consultando memória da Clara..."; subtype = "memory"; }
              else if (toolName === "get_filtered_chats_list") { label = "📋 Listando chats..."; }
              else if (toolName === "analyze_raw_conversations") {
                const startDate = toolInput?.start_date as string | undefined;
                const endDate = toolInput?.end_date as string | undefined;
                label = `📊 Analisando conversas ${startDate && endDate ? `de ${startDate} a ${endDate}` : "na fonte"} (pode levar 30s)...`;
                metadata.period = startDate && endDate ? `${startDate} a ${endDate}` : undefined;
              }
              else if (toolName === "ask_user_question") { label = "❓ Clara tem uma pergunta..."; subtype = "classify"; }
              else if (toolName === "update_chat_classification") { label = "🏷️ Classificando chat..."; }
              else if (toolName === "execute_sql") {
                label = "🗄️ Consultando banco de dados...";
                metadata.table = "sql";
              }
              else if (toolName === "get_volume_metrics") {
                const startDate = toolInput?.start_date as string | undefined;
                const endDate = toolInput?.end_date as string | undefined;
                label = `📈 Calculando métricas${startDate && endDate ? ` de ${startDate} a ${endDate}` : ""}...`;
                metadata.period = startDate && endDate ? `${startDate} a ${endDate}` : undefined;
              }
              else if (toolName === "analisar_chat_especifico") { label = "🔎 Analisando atendimento detalhadamente..."; }
              else if (toolName === "save_report") { label = "💾 Salvando relatório..."; }
              else if (toolName === "criar_agendamento") { label = "📅 Criando agendamento..."; }
              else { label = `⚙️ Executando: ${toolName}...`; }

              enqueue({ type: "ui_log", subtype, content: label, metadata });
            }

            // --- Clara 2.0: on_tool_end — emit result summary + detect interactive_question ---
            if (event.event === "on_tool_end") {
              const toolName: string = event.name ?? "";
              const toolOutput = event.data?.output;
              const outputStr = typeof toolOutput === "string" ? toolOutput : "";

              // Interactive question detection — save checkpoint so /answer can resume
              if (outputStr.includes('"__type":"interactive_question"')) {
                try {
                  const parsed = JSON.parse(outputStr);
                  if (parsed.__type === "interactive_question") {
                    enqueue({ type: "interactive_question", content: parsed });
                    // Save graph state so the /answer endpoint can resume the conversation
                    await saveGraphCheckpoint(inputs, parsed.question_id, parsed.question);
                  }
                } catch { /* ignore */ }
              }

              // Emit query result summary
              if (toolName === "execute_sql" || toolName === "get_volume_metrics") {
                const rowMatch = outputStr.match(/(\d+) registro\(s\)/);
                const rows = rowMatch ? parseInt(rowMatch[1]) : undefined;
                enqueue({
                  type: "ui_log",
                  subtype: "query_result",
                  content: rows !== undefined ? `✅ ${rows} registro(s) encontrados` : "✅ Consulta concluída",
                  metadata: { tool: toolName, rows },
                });
              } else if (toolName === "analyze_raw_conversations") {
                const msgsMatch = outputStr.match(/(\d+) mensagens brutas/);
                const msgs = msgsMatch ? parseInt(msgsMatch[1]) : undefined;
                enqueue({
                  type: "ui_log",
                  subtype: "query_result",
                  content: msgs ? `✅ ${msgs} mensagens analisadas` : "✅ Análise concluída",
                  metadata: { tool: toolName, messages: msgs },
                });
              }

              // Emit report_card quando save_report conclui
              if (toolName === "save_report") {
                const idMatch = outputStr.match(/ID:\s*(\d+)/);
                if (idMatch) {
                  enqueue({
                    type: "report_card",
                    content: "",
                    metadata: { reportId: parseInt(idMatch[1]) },
                  });
                }
              }

              // Emit spot-check validation result
              if (outputStr.includes("__SPOT_CHECK_DATA__")) {
                enqueue({ type: "ui_log", subtype: "validation", content: "✓ Dados com citações para verificação" });
              }
            }

            // --- TOKENS DE TEXTO (streaming) ---
            if (event.event === "on_chat_model_stream") {
              const node: string = event.metadata?.langgraph_node ?? "";
              if (RESPONSE_NODES.has(node)) {
                const content = event.data?.chunk?.content;
                if (typeof content === "string" && content.length > 0) {
                  enqueue({ type: "chunk", content });
                  chunksEmitted++;
                }
              }
            }

            // --- FALLBACK ---
            if (event.event === "on_chain_end" && chunksEmitted === 0) {
              const node: string = event.name ?? "";
              if (RESPONSE_NODES.has(node)) {
                const output = event.data?.output as { messages?: Array<{ content: unknown }> } | undefined;
                const msgs = output?.messages;
                if (Array.isArray(msgs) && msgs.length > 0) {
                  const lastMsg = msgs[msgs.length - 1];
                  const text =
                    typeof lastMsg?.content === "string"
                      ? lastMsg.content
                      : Array.isArray(lastMsg?.content)
                        ? (lastMsg.content as Array<{ text?: string }>).map((c) => c.text ?? "").join("")
                        : "";
                  if (text.trim()) {
                    enqueue({ type: "chunk", content: text });
                    chunksEmitted++;
                  }
                }
              }
            }
          }

          setFanOutProgressCallback(null);
          controller.close();
        } catch (err) {
          setFanOutProgressCallback(null);
          const msg = err instanceof Error ? err.message : "Erro durante a execução.";
          console.error("[/api/ai/copilot/chat] erro no stream:", err);
          controller.enqueue(encoder.encode(JSON.stringify({ type: "error", content: msg }) + "\n"));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("[/api/ai/copilot/chat] erro setup:", error);
    const message = error instanceof Error ? error.message : "Erro inesperado.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
