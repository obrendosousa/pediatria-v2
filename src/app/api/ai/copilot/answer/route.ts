import { NextResponse } from "next/server";
import { HumanMessage } from "@langchain/core/messages";
import { createClient } from "@/lib/supabase/server";
import { requireApprovedProfile } from "@/lib/auth/requireApprovedProfile";
import { claraGraph, type ClaraState } from "@/ai/clara/graph";
import { loadAndDeleteCheckpoint, deserializeMessages, type SerializedMessage } from "@/ai/clara/interactive_questions";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ai/copilot/answer
// Recebe a resposta do usuário a uma pergunta interativa da Clara.
// Carrega o checkpoint salvo, injeta a resposta e re-executa o grafo.
// ─────────────────────────────────────────────────────────────────────────────

const RESPONSE_NODES = new Set(["simple_agent", "final_report_node"]);

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    await requireApprovedProfile(supabase, { allowedRoles: ["admin", "secretary"] });

    const body = (await request.json()) as {
      question_id?: string;
      answer?: string;
      chat_id?: number;
    };

    const questionId = body.question_id;
    const answer = body.answer?.trim();
    const chatId = body.chat_id;

    if (!questionId || !answer) {
      return NextResponse.json(
        { error: "Campos 'question_id' e 'answer' são obrigatórios." },
        { status: 400 }
      );
    }

    // Tentar carregar checkpoint (atomic delete para prevenir double-click)
    const checkpoint = await loadAndDeleteCheckpoint(questionId);

    if (!checkpoint) {
      // Sem checkpoint: inicia nova conversa com a resposta como contexto
      const freshInputs: ClaraState = {
        messages: [new HumanMessage(answer)],
        chat_id: chatId || 0,
        is_deep_research: false,
        is_planning_mode: false,
        research_brief: "",
        raw_notes: [],
        supervisor_messages: [],
        supervisor_iteration: 0,
        research_complete: false,
        current_user_role: "admin",
        temporal_anchor: null,
        db_stats: null,
        loaded_context: null,
        spot_check_result: null,
        pending_question: null,
      };

      return streamGraphResponse(freshInputs, chatId || 0);
    }

    // Restaurar estado do checkpoint e injetar a resposta
    const stateData = checkpoint.state as Record<string, unknown>;
    const restoredMessages = deserializeMessages((stateData.messages || []) as SerializedMessage[]);
    const restoredState = {
      ...(checkpoint.state as Record<string, unknown>),
      messages: [...restoredMessages, new HumanMessage(`[RESPOSTA À PERGUNTA: "${checkpoint.question}"]\n${answer}`)],
      pending_question: null,
    } as unknown as ClaraState;

    return streamGraphResponse(restoredState, chatId || restoredState.chat_id || 0);
  } catch (error) {
    console.error("[/api/ai/copilot/answer] erro:", error);
    const message = error instanceof Error ? error.message : "Erro inesperado.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function streamGraphResponse(inputs: ClaraState, chatId: number): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (payload: object) =>
        controller.enqueue(encoder.encode(JSON.stringify(payload) + "\n"));

      try {
        // @ts-expect-error — LangGraph streamEvents type mismatch with ClaraState
        const events = claraGraph.streamEvents(inputs, {
          version: "v2",
          configurable: { thread_id: `copilot_answer_${chatId}_${Date.now()}` },
          streamMode: "values",
        });

        let chunksEmitted = 0;

        for await (const event of events) {
          if (event.event === "on_chain_start") {
            const node: string = event.name ?? "";
            if (node === "load_context_node") enqueue({ type: "ui_log", content: "🔄 Carregando contexto..." });
            else if (node === "final_report_node") enqueue({ type: "ui_log", content: "✍️ Escrevendo relatório final..." });
          }

          if (event.event === "on_tool_start") {
            const toolName: string = event.name ?? "";
            enqueue({ type: "ui_log", content: `⚙️ ${toolName}...` });
          }

          if (event.event === "on_tool_end") {
            const toolOutput = event.data?.output;
            if (typeof toolOutput === "string" && toolOutput.includes('"__type":"interactive_question"')) {
              try {
                const parsed = JSON.parse(toolOutput);
                if (parsed.__type === "interactive_question") {
                  enqueue({ type: "interactive_question", content: parsed });
                }
              } catch { /* ignore */ }
            }
          }

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

        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro durante a execução.";
        console.error("[/api/ai/copilot/answer] stream error:", err);
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
}
