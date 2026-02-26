import { NextResponse } from "next/server";
import { AIMessage, BaseMessage, HumanMessage } from "@langchain/core/messages";
import { createClient } from "@/lib/supabase/server";
import { requireApprovedProfile } from "@/lib/auth/requireApprovedProfile";
import { getAnalystGraph } from "@/ai/analyst/graph";

type AnalystHistoryItem = {
  role: "user" | "assistant";
  content: string;
};

function buildMessages(question: string, history?: AnalystHistoryItem[]): BaseMessage[] {
  const prior = (history ?? [])
    .filter((item) => item && typeof item.content === "string" && item.content.trim().length > 0)
    .map((item) =>
      item.role === "assistant" ? new AIMessage(item.content) : new HumanMessage(item.content)
    );

  return [...prior, new HumanMessage(question)];
}

export async function POST(request: Request) {
  try {
    // Validando chave do Gemini em vez de apenas OpenAI
    if (!process.env.OPENAI_API_KEY && !process.env.GOOGLE_API_KEY) {
      return NextResponse.json(
        { error: "Nenhuma API_KEY (OpenAI ou Google) configurada no ambiente." },
        { status: 500 }
      );
    }

    const supabase = await createClient();
    await requireApprovedProfile(supabase, { allowedRoles: ["admin", "secretary"] });

    const body = (await request.json()) as {
      question?: unknown;
      history?: unknown;
    };

    const question = typeof body.question === "string" ? body.question.trim() : "";
    if (!question) {
      return NextResponse.json(
        { error: "Campo 'question' é obrigatório." },
        { status: 400 }
      );
    }

    const history = Array.isArray(body.history)
      ? (body.history as AnalystHistoryItem[])
      : undefined;

    const graph = await getAnalystGraph();
    const inputs = {
      messages: buildMessages(question, history),
      current_analysis_context: undefined,
      active_filters: undefined,
    };

    const encoder = new TextEncoder();

    // ─────────────────────────────────────────────────────────────────
    // WEBSOCKET/STREAM DE EVENTOS (Evita o Timeout de 15s/30s)
    // ─────────────────────────────────────────────────────────────────
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // streamEvents captura todos os eventos internos do LangGraph
          const events = await graph.streamEvents(inputs, { version: "v2" });

          for await (const event of events) {

            // 1. EVENTO: A IA decidiu usar uma ferramenta (O "Efeito Cursor")
            if (event.event === "on_tool_start") {
              let toolLabel = event.name;

              // Traduzindo nomes técnicos para o frontend
              if (toolLabel === "get_filtered_chats_list") toolLabel = "🔍 Buscando amostra de chats no banco de dados...";
              else if (toolLabel === "get_chat_cascade_history") toolLabel = "📖 Lendo histórico completo e linha do tempo das mensagens...";
              else if (toolLabel === "get_attendance_overview_metrics") toolLabel = "📊 Consultando métricas macro de atendimento...";
              else if (toolLabel === "search_chats_by_keyword") toolLabel = "🔎 Pesquisando palavra-chave nos chats...";
              else if (toolLabel === "deep_research_chats_tool" || toolLabel === "deep_research_chats") toolLabel = "⚙️ Processando conversas em lote (Map-Reduce)...";
              else toolLabel = `⚙️ Executando ação: ${toolLabel}...`;

              const payload = JSON.stringify({ type: "ui_log", content: toolLabel });
              controller.enqueue(encoder.encode(payload + "\n"));
            }

            // 2. EVENTO: A IA está "falando" o resultado final (Efeito máquina de escrever)
            if (event.event === "on_chat_model_stream") {
              const content = event.data?.chunk?.content;
              if (typeof content === "string" && content.length > 0) {
                const payload = JSON.stringify({ type: "chunk", content });
                controller.enqueue(encoder.encode(payload + "\n"));
              }
            }
          }
          controller.close();
        } catch (streamError) {
          console.error("[/api/ai/analyst] erro no stream:", streamError);
          const errorMessage = streamError instanceof Error ? streamError.message : "Erro durante a execução da análise.";
          const payload = JSON.stringify({ type: "error", content: errorMessage });
          controller.enqueue(encoder.encode(payload + "\n"));
          controller.close();
        }
      },
    });

    // Retorna NDJSON (Newline Delimited JSON)
    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    console.error("[/api/ai/analyst] erro setup:", error);
    const message =
      error instanceof Error ? error.message : "Erro inesperado ao iniciar análise.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}