import { createClient } from "@supabase/supabase-js";

let _supabase: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (!_supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;
    _supabase = createClient(url, key);
  }
  return _supabase;
}

interface WebhookLogEntry {
  schema_source: "public" | "atendimento";
  event?: string;
  status: "processed" | "ignored" | "error";
  reason?: string;
  remote_jid?: string;
  phone?: string;
  message_type?: string;
  push_name?: string;
  wpp_id?: string;
  /** Corpo do webhook — será truncado a 10KB */
  payload?: unknown;
  /** Info extra de debug (resolver, filtros, etc.) */
  resolver_info?: Record<string, unknown>;
}

/**
 * Loga um webhook no Supabase (fire-and-forget, nunca bloqueia o webhook).
 * Se falhar, apenas loga no console.
 */
export function logWebhook(entry: WebhookLogEntry): void {
  const supabase = getSupabase();
  if (!supabase) return;

  // Truncar payload para não estourar o banco
  let payloadTruncated: unknown = null;
  if (entry.payload) {
    const raw = JSON.stringify(entry.payload);
    if (raw.length > 10000) {
      payloadTruncated = { _truncated: true, preview: raw.substring(0, 10000) };
    } else {
      payloadTruncated = entry.payload;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (supabase.from("webhook_logs") as any)
    .insert({
      schema_source: entry.schema_source,
      event: entry.event || null,
      status: entry.status,
      reason: entry.reason || null,
      remote_jid: entry.remote_jid || null,
      phone: entry.phone || null,
      message_type: entry.message_type || null,
      push_name: entry.push_name || null,
      wpp_id: entry.wpp_id || null,
      payload: payloadTruncated,
      resolver_info: entry.resolver_info || null,
    })
    .then(({ error }: { error: { message: string } | null }) => {
      if (error) console.warn("[WebhookLog] Erro ao salvar log:", error.message);
    })
    .catch(() => {});
}
