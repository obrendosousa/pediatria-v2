import { NextResponse } from "next/server";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { createClient } from "@/lib/supabase/server";
import { requireApprovedProfile } from "@/lib/auth/requireApprovedProfile";
import { getSupabaseAdminClient } from "@/lib/automation/adapters/supabaseAdmin";
import { claraGraph, type ClaraState } from "@/ai/clara/graph";

type HistoryItem = {
  role: "user" | "assistant";
  content: string;
};

// Nós do grafo da Clara que produzem a resposta final visível para Joana
const RESPONSE_NODES = new Set(["simple_agent", "reporter_node"]);

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

    // Busca nome do paciente
    const { data: chatData } = await (adminSupabase as any)
      .from("chats")
      .select("id, contact_name")
      .eq("id", chatId)
      .maybeSingle();

    const patientName = chatData?.contact_name || "Paciente";

    // Janela deslizante: últimas 20 mensagens do paciente para contexto imediato
    const { data: messagesData } = await (adminSupabase as any)
      .from("chat_messages")
      .select("sender, message_text, message_type, created_at")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: false })
      .limit(20);

    const chatHistory = messagesData
      ? (messagesData as any[])
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

    // Mensagem contextualizada para a Clara — ela sabe que está ajudando Joana, não o paciente
    const contextualMessage = `[MODO COPILOTO — ANÁLISE DE CASO PARA SECRETÁRIA]
Joana está me consultando sobre o(a) paciente: ${patientName} (chat_id do paciente: ${chatId})

HISTÓRICO RECENTE DO PACIENTE (últimas 20 mensagens):
------------------------------------------------------
${chatHistory || "Nenhuma mensagem disponível ainda."}
------------------------------------------------------

PERGUNTA DA JOANA: ${message}

INSTRUÇÃO: Responda como Clara ajudando a secretária Joana a entender este caso. Use as ferramentas se precisar de mais dados. Seja direta e prática.`;

    // Reconstrói histórico do mini-chat como messages LangChain (sem tool calls anteriores)
    const priorMessages = history
      .filter((item) => item.content?.trim())
      .map((item) =>
        item.role === "assistant" ? new AIMessage(item.content) : new HumanMessage(item.content)
      );

    const inputs: ClaraState = {
      messages: [...priorMessages, new HumanMessage(contextualMessage)],
      chat_id: chatId,   // Chat ID do PACIENTE — Clara usa para ferramentas de pesquisa
      is_deep_research: false,
      is_planning_mode: false,
      research_brief: "",
      raw_notes: [],
      supervisor_messages: [],
      supervisor_iteration: 0,
      research_complete: false,
      current_user_role: "admin",
    };

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const enqueue = (payload: object) =>
          controller.enqueue(encoder.encode(JSON.stringify(payload) + "\n"));

        try {
          const events = claraGraph.streamEvents(inputs as any, {
            version: "v2",
            configurable: { thread_id: `copilot_${chatId}_${Date.now()}` },
            streamMode: "values"
          });

          // Flag para o fallback: se nenhum chunk de texto for emitido, usa on_chain_end
          let chunksEmitted = 0;

          for await (const event of events) {
            // --- STATUS: Progresso dos nós do grafo ---
            if (event.event === "on_chain_start") {
              const node: string = event.name ?? "";
              let label: string | null = null;
              if (node === "router_and_planner_node") label = "🧠 Analisando complexidade da pergunta...";
              else if (node === "executor_node") label = "🔍 Executando etapa da pesquisa...";
              else if (node === "reporter_node") label = "✍️ Elaborando resposta final...";
              else if (node === "fetch_data") label = "Baixando mensagens do chat para análise...";
              else if (node === "analyze_conversation") label = "IA pensando e extraindo gargalos...";
              else if (node === "save_to_db") label = "Salvando insights e histórico no banco...";
              if (label) enqueue({ type: "ui_log", content: label });
            }

            // --- STATUS: Chamadas de ferramenta ---
            if (event.event === "on_tool_start") {
              const toolName: string = event.name ?? "";
              let label = toolName;
              if (toolName === "get_chat_cascade_history") label = "📖 Lendo histórico do paciente...";
              else if (toolName === "search_knowledge_base") label = "🔎 Consultando base de conhecimento...";
              else if (toolName === "read_brain_files") label = "🧠 Lendo contexto da clínica...";
              else if (toolName === "manage_long_term_memory") label = "💭 Consultando memória da Clara...";
              else if (toolName === "get_filtered_chats_list") label = "📋 Listando chats...";
              else if (toolName === "deep_research_chats_tool" || toolName === "deep_research_chats") label = "⚙️ Pesquisa profunda (Map-Reduce)...";
              else if (toolName === "analisar_chat_especifico") label = "🔎 Analisando atendimento detalhadamente...";
              else if (toolName === "gerar_relatorio_qualidade_chats") label = "📊 Consolidando relatórios de qualidade...";
              else label = `⚙️ Executando ação: ${toolName}...`;
              enqueue({ type: "ui_log", content: label });
            }

            // --- TOKENS DE TEXTO (modo streaming ideal) ---
            // Filtra para NÃO mostrar tokens do router_and_planner_node (JSON interno)
            // e NÃO mostrar chunks de tool calls (content array ou vazio)
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

            // --- FALLBACK: se on_chat_model_stream não disparou, captura texto no on_chain_end ---
            // Ocorre quando o modelo interno usa invoke() sem streaming habilitado
            if (event.event === "on_chain_end" && chunksEmitted === 0) {
              const node: string = event.name ?? "";
              if (RESPONSE_NODES.has(node)) {
                const output = event.data?.output as any;
                // O output do nó é o estado retornado: { messages: [...] }
                const msgs = output?.messages;
                if (Array.isArray(msgs) && msgs.length > 0) {
                  const lastMsg = msgs[msgs.length - 1];
                  const text =
                    typeof lastMsg?.content === "string"
                      ? lastMsg.content
                      : Array.isArray(lastMsg?.content)
                        ? (lastMsg.content as any[]).map((c: any) => c.text ?? "").join("")
                        : "";
                  if (text.trim()) {
                    enqueue({ type: "chunk", content: text });
                    chunksEmitted++;
                  }
                }
              }
            }
          }

          controller.close();
        } catch (err) {
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
