import { randomUUID } from "node:crypto";
import { END, START, StateGraph } from "@langchain/langgraph";
import { evolutionRequest } from "@/lib/evolution";
import { getAutomationCheckpointer } from "@/lib/automation/checkpointer";
import { funnelRunCommandSchema, workerAckSchema, type FunnelRunCommandContract, type WorkerAckContract } from "@/lib/automation/contracts";
import { getSupabaseAdminClient } from "@/lib/automation/adapters/supabaseAdmin";
import { sendWithEvolution } from "@/lib/automation/adapters/evolutionSender";
import { insertChatAndMemory } from "@/lib/automation/adapters/dispatchRepository";

interface FunnelState {
  runId: string;
  threadId: string;
  chatId: number;
  phone: string;
  title: string;
  steps: FunnelRunCommandContract["steps"];
  stepIndex: number;
  completed: number;
}

async function setPresence(phone: string, status: "composing" | "recording", durationMs: number) {
  await evolutionRequest("/chat/sendPresence/{instance}", {
    method: "POST",
    body: {
      number: phone,
      presence: status,
      delay: durationMs,
    },
  });
}

async function appendRunLog(runId: string, threadId: string, nodeName: string, message: string, metadata: Record<string, unknown>) {
  const supabase = getSupabaseAdminClient() as any;
  await supabase.from("worker_run_logs").insert({
    run_id: runId,
    thread_id: threadId,
    graph_name: "ChatFunnelGraph",
    node_name: nodeName,
    level: "info",
    message,
    metadata,
  });
}

let compiledGraphPromise: Promise<ReturnType<StateGraph<FunnelState>["compile"]>> | null = null;

async function getCompiledChatFunnelGraph() {
  if (!compiledGraphPromise) {
    compiledGraphPromise = (async () => {
      const checkpointer = await getAutomationCheckpointer();
      const graph = new StateGraph<FunnelState>({
        channels: {
          runId: { reducer: (_, y) => y, default: () => randomUUID() },
          threadId: { reducer: (_, y) => y, default: () => "" },
          chatId: { reducer: (_, y) => y, default: () => 0 },
          phone: { reducer: (_, y) => y, default: () => "" },
          title: { reducer: (_, y) => y, default: () => "" },
          steps: { reducer: (_, y) => y, default: () => [] },
          stepIndex: { reducer: (_, y) => y, default: () => 0 },
          completed: { reducer: (_, y) => y, default: () => 0 },
        },
      }) as any;

      graph.addNode("execute_step", async (state: FunnelState) => {
        const step = state.steps[state.stepIndex];
        if (!step) return {};

        const delaySec = Math.max(step.delay || 0, 0);
        if (step.type === "wait") {
          if (delaySec > 0) {
            await new Promise((resolve) => setTimeout(resolve, delaySec * 1000));
          }
          await appendRunLog(state.runId, state.threadId, "execute_step", "wait_step_done", {
            stepIndex: state.stepIndex,
            delaySec,
            stepType: step.type,
          });
          return { stepIndex: state.stepIndex + 1, completed: state.completed + 1 };
        }

        const payloadContent = step.content || "";
        if (step.type === "audio") {
          await setPresence(state.phone, "recording", Math.max(delaySec, 1) * 1000);
        } else {
          await setPresence(state.phone, "composing", Math.max(delaySec, 1) * 1000);
        }

        if (delaySec > 0) {
          await new Promise((resolve) => setTimeout(resolve, delaySec * 1000));
        }

        const sendRes = await sendWithEvolution({
          phone: state.phone,
          type: step.type as "text" | "audio" | "image" | "video" | "document",
          content: payloadContent,
        });

        if (!sendRes.ok) {
          throw new Error(`funnel_send_failed_${sendRes.status}`);
        }

        await insertChatAndMemory({
          chatId: state.chatId,
          phone: state.phone,
          type: step.type,
          content: payloadContent,
          mediaUrl: step.type === "text" ? null : payloadContent,
          wppId: sendRes.wppId,
        });

        await appendRunLog(state.runId, state.threadId, "execute_step", "step_sent", {
          stepIndex: state.stepIndex,
          stepType: step.type,
          wppId: sendRes.wppId,
        });

        return { stepIndex: state.stepIndex + 1, completed: state.completed + 1 };
      });

      graph.addConditionalEdges("execute_step", (state: FunnelState) => {
        if (state.stepIndex >= state.steps.length) return END;
        return "execute_step";
      });

      graph.addEdge(START, "execute_step");
      return graph.compile({ checkpointer });
    })();
  }
  return compiledGraphPromise;
}

export async function runChatFunnelGraph(input: FunnelRunCommandContract): Promise<WorkerAckContract> {
  const command = funnelRunCommandSchema.parse(input);
  const runId = command.runId || randomUUID();
  const threadId = command.threadId || `chat-${command.chatId}-funnel`;
  const graph = await getCompiledChatFunnelGraph();

  const finalState = await graph.invoke(
    {
      runId,
      threadId,
      chatId: command.chatId,
      phone: command.phone,
      title: command.title,
      steps: command.steps,
      stepIndex: 0,
      completed: 0,
    },
    {
      configurable: {
        thread_id: threadId,
      },
    }
  );

  return workerAckSchema.parse({
    ok: true,
    runId,
    threadId,
    message: "chat_funnel_graph_executed",
    data: {
      completedSteps: finalState.completed,
      totalSteps: command.steps.length,
      title: command.title,
    },
  });
}
