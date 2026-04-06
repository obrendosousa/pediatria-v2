/* eslint-disable @typescript-eslint/no-explicit-any */
// CEO Agent Chat - Streaming SSE Route
// Pattern from copilot/chat/route.ts adapted for coordinator graph

import { NextResponse } from "next/server";
import { HumanMessage } from "@langchain/core/messages";
import { ceoGraph } from "@/ai/neural-network/ceo-graph";
import type { CeoState } from "@/ai/neural-network/ceo-graph";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message, user_role } = body;

    if (!message) {
      return NextResponse.json({ error: "message e obrigatorio." }, { status: 400 });
    }

    const inputs: Partial<CeoState> = {
      messages: [new HumanMessage(message)],
      current_user_role: user_role ?? "admin",
      temporal_anchor: null,
      db_stats: null,
      loaded_context: null,
      classification: "simple",
      planned_tasks: [],
      worker_results: {},
      failed_agents: [],
      aggregated_data: null,
      verification_needed: false,
      verification_result: null,
      tool_call_count: 0,
      iteration: 0,
    };

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const enqueue = (payload: object) =>
          controller.enqueue(encoder.encode(JSON.stringify(payload) + "\n"));

        try {
          const events = ceoGraph.streamEvents(inputs, {
            version: "v2",
            configurable: { thread_id: `ceo_chat_global` },
            streamMode: "values",
          });

          for await (const event of events) {
            // --- Node start events (progress indicators) ---
            if (event.event === "on_chain_start") {
              const node: string = event.name ?? "";

              if (node === "load_context") {
                enqueue({ type: "ui_log", subtype: "memory", content: "Carregando contexto e memoria..." });
              } else if (node === "classify") {
                enqueue({ type: "ui_log", subtype: "classify", content: "Analisando complexidade da pergunta..." });
              } else if (node === "plan_tasks") {
                enqueue({ type: "ui_log", subtype: "plan", content: "Planejando quais setores consultar..." });
              } else if (node === "dispatch_workers") {
                enqueue({ type: "ui_log", subtype: "dispatch", content: "Despachando agentes setoriais em paralelo..." });
              } else if (node === "synthesize") {
                enqueue({ type: "ui_log", subtype: "synthesis", content: "Agregando resultados dos agentes..." });
              } else if (node === "verify") {
                enqueue({ type: "ui_log", subtype: "verify", content: "Verificando dados criticos..." });
              } else if (node === "final_report") {
                enqueue({ type: "ui_log", subtype: "report", content: "Gerando resposta final..." });
              }
            }

            // --- Node end events (classification result, dispatch details) ---
            if (event.event === "on_chain_end") {
              const node: string = event.name ?? "";
              const output = event.data?.output as Record<string, any> | undefined;

              if (node === "load_context" && output?.temporal_anchor) {
                const anchor = output.temporal_anchor as { period_label?: string };
                if (anchor.period_label) {
                  enqueue({ type: "ui_log", subtype: "temporal", content: anchor.period_label });
                }
              }

              if (node === "classify" && output?.classification) {
                const cls = output.classification as string;
                const label = cls === "simple" ? "Consulta simples" : cls === "single_sector" ? "Analise setorial" : "Analise cross-setor";
                enqueue({ type: "ui_log", subtype: "classify", content: label });
              }

              if (node === "plan_tasks" && output?.planned_tasks) {
                const tasks = output.planned_tasks as Array<{ agent_id: string }>;
                for (const t of tasks) {
                  enqueue({ type: "ui_log", subtype: "dispatch", content: `${t.agent_id} analisando...` });
                }
              }

              if (node === "dispatch_workers" && output?.failed_agents) {
                const failed = output.failed_agents as string[];
                for (const a of failed) {
                  enqueue({ type: "ui_log", subtype: "error", content: `${a} falhou` });
                }
              }
            }

            // --- Tool start events ---
            if (event.event === "on_tool_start") {
              const toolName: string = event.name ?? "";
              enqueue({ type: "ui_log", subtype: "tool", content: `Usando ${toolName}...` });
            }

            // --- Token streaming (from simple_answer or final_report) ---
            if (event.event === "on_chat_model_stream") {
              const chunk = event.data?.chunk;
              if (chunk?.content) {
                const text = typeof chunk.content === "string" ? chunk.content : "";
                if (text) {
                  enqueue({ type: "token", content: text });
                }
              }
            }
          }

          enqueue({ type: "done" });
        } catch (error: any) {
          enqueue({ type: "error", content: error.message || "Erro interno" });
        } finally {
          controller.close();
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
