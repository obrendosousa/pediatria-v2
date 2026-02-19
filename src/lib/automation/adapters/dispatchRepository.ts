import { getSupabaseAdminClient } from "./supabaseAdmin";

export interface ClaimedScheduledMessage {
  id: number;
  chat_id: number;
  item_type: "macro" | "funnel" | "adhoc";
  content: Record<string, unknown> | string;
  automation_rule_id?: number | null;
  run_id?: string | null;
  retry_count?: number | null;
  chats?: { id: number; phone: string } | null;
}

export async function claimScheduledMessages(batchSize: number, workerId: string): Promise<ClaimedScheduledMessage[]> {
  const supabase = getSupabaseAdminClient() as any;
  const nowIso = new Date().toISOString();

  const rpcRes = await (supabase as any).rpc("claim_scheduled_messages", {
    p_limit: batchSize,
    p_worker_id: workerId,
    p_now: nowIso,
  });

  if (!rpcRes.error && Array.isArray(rpcRes.data)) {
    const ids = (rpcRes.data as Array<{ id?: unknown }>)
      .map((item) => item.id)
      .filter((id): id is number => typeof id === "number");
    if (ids.length === 0) return [];
    const joined = await supabase
      .from("scheduled_messages")
      .select("id, chat_id, item_type, content, automation_rule_id, run_id, retry_count, chats(id, phone)")
      .in("id", ids);
    if (joined.error) throw joined.error;
    return (joined.data || []) as ClaimedScheduledMessage[];
  }

  // Fallback for environments without migration applied.
  const fallback = await supabase
    .from("scheduled_messages")
    .select("id, chat_id, item_type, content, automation_rule_id, run_id, retry_count, chats(id, phone)")
    .eq("status", "pending")
    .lte("scheduled_for", nowIso)
    .order("scheduled_for", { ascending: true })
    .limit(batchSize);

  if (fallback.error) throw fallback.error;
  return (fallback.data || []) as ClaimedScheduledMessage[];
}

export async function markDispatchedSuccess(messageId: number, payload: { runId: string; wppId: string | null }) {
  const supabase = getSupabaseAdminClient() as any;
  const sentAt = new Date().toISOString();
  await supabase
    .from("scheduled_messages")
    .update({
      status: "sent",
      sent_at: sentAt,
      run_id: payload.runId,
      dispatch_locked_at: null,
      dispatch_locked_by: null,
      last_error: null,
    })
    .eq("id", messageId);
}

export async function markDispatchedFailure(
  messageId: number,
  payload: { runId: string; errorMessage: string; retryCount: number; nextRetryAt: string | null; sendToDeadLetter: boolean }
) {
  const supabase = getSupabaseAdminClient() as any;
  const nextStatus = payload.sendToDeadLetter ? "failed" : "pending";
  await supabase
    .from("scheduled_messages")
    .update({
      status: nextStatus,
      run_id: payload.runId,
      retry_count: payload.retryCount,
      next_retry_at: payload.nextRetryAt,
      dispatch_locked_at: null,
      dispatch_locked_by: null,
      last_error: payload.errorMessage,
    })
    .eq("id", messageId);
}

export async function insertChatAndMemory(params: {
  chatId: number;
  phone: string;
  type: string;
  content: string;
  caption?: string;
  mediaUrl?: string | null;
  wppId?: string | null;
  automationRuleId?: number | null;
}) {
  const supabase = getSupabaseAdminClient() as any;
  const isMediaType = params.type === "audio" || params.type === "image" || params.type === "video" || params.type === "document";
  const mediaUrl = params.mediaUrl || (isMediaType ? params.content : null);
  const messageText = isMediaType ? params.caption || "" : params.caption || params.content || "";

  await supabase.from("chat_messages").insert({
    chat_id: params.chatId,
    phone: params.phone,
    sender: "HUMAN_AGENT",
    message_text: messageText,
    message_type: params.type,
    media_url: mediaUrl,
    wpp_id: params.wppId || null,
    status: "sent",
    created_at: new Date().toISOString(),
  });

  const memoryText =
    params.type === "audio"
      ? `[AUDIO AGENDADO] URL: ${mediaUrl || params.content}`
      : params.type === "image"
      ? `[IMAGEM AGENDADA] ${params.caption || ""} URL: ${mediaUrl || params.content}`
      : params.type === "document"
      ? `[DOCUMENTO AGENDADO] ${params.caption || ""} URL: ${mediaUrl || params.content}`
      : params.content;

  await supabase.from("n8n_chat_histories").insert({
    session_id: params.phone,
    message: {
      type: "ai",
      content: memoryText,
      additional_kwargs: {
        wpp_id: params.wppId || null,
        from_schedule: true,
        automation_rule_id: params.automationRuleId || null,
      },
    },
  });
}

export async function insertDeadLetter(payload: {
  runId: string;
  threadId: string;
  sourceNode: string;
  scheduledMessageId: number;
  errorMessage: string;
  retryCount: number;
  retryable: boolean;
  nextRetryAt: string | null;
  body: Record<string, unknown>;
}) {
  const supabase = getSupabaseAdminClient() as any;
  await supabase.from("langgraph_dead_letter").insert({
    run_id: payload.runId,
    thread_id: payload.threadId,
    source_graph: "ScheduledDispatchGraph",
    source_node: payload.sourceNode,
    scheduled_message_id: payload.scheduledMessageId,
    payload: payload.body,
    error_message: payload.errorMessage,
    retry_count: payload.retryCount,
    retryable: payload.retryable,
    next_retry_at: payload.nextRetryAt,
  });
}
