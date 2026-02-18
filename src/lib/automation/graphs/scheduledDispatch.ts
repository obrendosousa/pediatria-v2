import { randomUUID } from "node:crypto";
import { END, START, StateGraph } from "@langchain/langgraph";
import { dispatchRunCommandSchema, workerAckSchema, type DispatchRunCommandContract, type WorkerAckContract } from "@/lib/automation/contracts";
import type { ClaimedScheduledMessage } from "@/lib/automation/adapters/dispatchRepository";
import {
  claimScheduledMessages,
  insertChatAndMemory,
  insertDeadLetter,
  markDispatchedFailure,
  markDispatchedSuccess,
} from "@/lib/automation/adapters/dispatchRepository";
import { sendWithEvolution } from "@/lib/automation/adapters/evolutionSender";
import { getAutomationCheckpointer } from "@/lib/automation/checkpointer";
import { logRunEvent } from "@/lib/automation/observability/logger";

interface DispatchState {
  runId: string;
  workerId: string;
  batchSize: number;
  dryRun: boolean;
  claimed: ClaimedScheduledMessage[];
  sentCount: number;
  failedCount: number;
  deadLetterCount: number;
}

function parsePayload(content: ClaimedScheduledMessage["content"]): Record<string, unknown> {
  if (typeof content === "string") {
    try {
      return JSON.parse(content) as Record<string, unknown>;
    } catch {
      return { type: "text", content };
    }
  }
  return content ?? {};
}

function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function calcRetryWindow(retryCount: number): { nextRetryAt: string | null; sendToDeadLetter: boolean } {
  const maxRetry = 3;
  if (retryCount >= maxRetry) {
    return { nextRetryAt: null, sendToDeadLetter: true };
  }
  const minutes = Math.pow(2, retryCount);
  return { nextRetryAt: new Date(Date.now() + minutes * 60_000).toISOString(), sendToDeadLetter: false };
}

let compiledGraphPromise: Promise<ReturnType<StateGraph<DispatchState>["compile"]>> | null = null;

async function getCompiledDispatchGraph() {
  if (!compiledGraphPromise) {
    compiledGraphPromise = (async () => {
      const checkpointer = await getAutomationCheckpointer();
      const graph = new StateGraph<DispatchState>({
        channels: {
          runId: { reducer: (_, y) => y, default: () => randomUUID() },
          workerId: { reducer: (_, y) => y, default: () => "worker-default" },
          batchSize: { reducer: (_, y) => y, default: () => 25 },
          dryRun: { reducer: (_, y) => y, default: () => false },
          claimed: { reducer: (_, y) => y, default: () => [] },
          sentCount: { reducer: (_, y) => y, default: () => 0 },
          failedCount: { reducer: (_, y) => y, default: () => 0 },
          deadLetterCount: { reducer: (_, y) => y, default: () => 0 },
        },
      });

      graph.addNode("claim_pending", async (state) => {
        const claimed = await claimScheduledMessages(state.batchSize, state.workerId);
        await logRunEvent({
          runId: state.runId,
          threadId: `dispatch-${state.workerId}`,
          graphName: "ScheduledDispatchGraph",
          nodeName: "claim_pending",
          message: "claimed_messages",
          metadata: { claimedCount: claimed.length, batchSize: state.batchSize },
        });
        return { claimed };
      });

      graph.addNode("dispatch_batch", async (state) => {
        let sentCount = 0;
        let failedCount = 0;
        let deadLetterCount = 0;

        for (const item of state.claimed) {
          const phone = item.chats?.phone;
          const chatId = item.chats?.id || item.chat_id;
          if (!phone || !chatId) {
            failedCount += 1;
            await markDispatchedFailure(item.id, {
              runId: state.runId,
              errorMessage: "chat_data_missing",
              retryCount: (item.retry_count || 0) + 1,
              nextRetryAt: null,
              sendToDeadLetter: true,
            });
            await insertDeadLetter({
              runId: state.runId,
              threadId: `chat-${item.chat_id}`,
              sourceNode: "dispatch_batch",
              scheduledMessageId: item.id,
              errorMessage: "chat_data_missing",
              retryCount: (item.retry_count || 0) + 1,
              retryable: false,
              nextRetryAt: null,
              body: { item },
            });
            deadLetterCount += 1;
            await logRunEvent({
              runId: state.runId,
              threadId: `chat-${item.chat_id}`,
              graphName: "ScheduledDispatchGraph",
              nodeName: "dispatch_batch",
              level: "error",
              message: "chat_data_missing",
              metadata: { scheduledMessageId: item.id },
            });
            continue;
          }

          const payload = parsePayload(item.content);
          const msgTypeRaw = asText(payload.type || "text").toLowerCase();
          const type = (["text", "audio", "image", "video", "document"].includes(msgTypeRaw)
            ? msgTypeRaw
            : "text") as "text" | "audio" | "image" | "video" | "document";
          const content = asText(payload.content);
          const caption = asText(payload.caption);

          if (state.dryRun) {
            sentCount += 1;
            continue;
          }

          const sendRes = await sendWithEvolution({ phone, type, content, caption });
          if (sendRes.ok) {
            sentCount += 1;
            await markDispatchedSuccess(item.id, { runId: state.runId, wppId: sendRes.wppId });
            await insertChatAndMemory({
              chatId,
              phone,
              type,
              content,
              caption,
              mediaUrl: type === "text" ? null : content,
              wppId: sendRes.wppId,
              automationRuleId: item.automation_rule_id || null,
            });
            await logRunEvent({
              runId: state.runId,
              threadId: `chat-${item.chat_id}`,
              graphName: "ScheduledDispatchGraph",
              nodeName: "dispatch_batch",
              message: "message_sent",
              metadata: { scheduledMessageId: item.id, wppId: sendRes.wppId || null },
            });
            continue;
          }

          failedCount += 1;
          const retryCount = (item.retry_count || 0) + 1;
          const retryPolicy = calcRetryWindow(retryCount);
          const errorMessage = `evolution_send_failed_${sendRes.status}`;
          await markDispatchedFailure(item.id, {
            runId: state.runId,
            errorMessage,
            retryCount,
            nextRetryAt: retryPolicy.nextRetryAt,
            sendToDeadLetter: retryPolicy.sendToDeadLetter,
          });

          if (retryPolicy.sendToDeadLetter) {
            deadLetterCount += 1;
            await insertDeadLetter({
              runId: state.runId,
              threadId: `chat-${item.chat_id}`,
              sourceNode: "dispatch_batch",
              scheduledMessageId: item.id,
              errorMessage,
              retryCount,
              retryable: sendRes.status >= 500 || sendRes.status === 429,
              nextRetryAt: retryPolicy.nextRetryAt,
              body: {
                item,
                response: sendRes.details ?? null,
              },
            });
            await logRunEvent({
              runId: state.runId,
              threadId: `chat-${item.chat_id}`,
              graphName: "ScheduledDispatchGraph",
              nodeName: "dispatch_batch",
              level: "error",
              message: "dead_letter_created",
              metadata: { scheduledMessageId: item.id, retryCount, errorMessage },
            });
          }
        }

        return { sentCount, failedCount, deadLetterCount };
      });

      graph
        .addEdge(START, "claim_pending")
        .addEdge("claim_pending", "dispatch_batch")
        .addEdge("dispatch_batch", END);

      return graph.compile({ checkpointer });
    })();
  }

  return compiledGraphPromise;
}

export async function runScheduledDispatchGraph(input: DispatchRunCommandContract): Promise<WorkerAckContract> {
  const command = dispatchRunCommandSchema.parse(input);
  const runId = command.runId || randomUUID();
  const workerId = process.env.WORKER_ID || "webapp-dispatch";
  const graph = await getCompiledDispatchGraph();

  const threadId = `dispatch-${new Date().toISOString().slice(0, 10)}-${workerId}`;
  const finalState = await graph.invoke(
    {
      runId,
      workerId,
      batchSize: command.batchSize,
      dryRun: command.dryRun,
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
    message: "dispatch_graph_executed",
    data: {
      sentCount: finalState.sentCount || 0,
      failedCount: finalState.failedCount || 0,
      deadLetterCount: finalState.deadLetterCount || 0,
      claimedCount: finalState.claimed?.length || 0,
    },
  });
}
