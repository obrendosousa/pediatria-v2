import { getSupabaseAdminClient } from "@/lib/automation/adapters/supabaseAdmin";

export async function logRunEvent(params: {
  runId: string;
  threadId?: string;
  graphName: string;
  nodeName?: string;
  level?: "info" | "warn" | "error";
  message: string;
  metadata?: Record<string, unknown>;
}) {
  const supabase = getSupabaseAdminClient();
  await supabase.from("worker_run_logs").insert({
    run_id: params.runId,
    thread_id: params.threadId || null,
    graph_name: params.graphName,
    node_name: params.nodeName || null,
    level: params.level || "info",
    message: params.message,
    metadata: params.metadata || {},
  });
}
