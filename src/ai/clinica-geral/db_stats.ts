// ═══════════════════════════════════════════════════════════════════════════
// DB Stats Snapshot — Schema Atendimento
// Snapshot rápido do estado do banco, injetado no system prompt.
// Cache de 5 minutos para não sobrecarregar.
// ═══════════════════════════════════════════════════════════════════════════

import { createSchemaAdminClient } from "@/lib/supabase/schemaServer";

export interface DbStats {
  total_chats: number;
  total_messages: number;
  total_tokens_approx: number;
  last_chat_activity: string;
  chats_today: number;
  messages_today: number;
  first_message_date: string;
  data_quality_warnings: string[];
}

// ── Cache ──────────────────────────────────────────────────────────────────

let cachedStats: DbStats | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

export async function getDbStats(): Promise<DbStats> {
  const now = Date.now();
  if (cachedStats && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedStats;
  }

  const supabase = createSchemaAdminClient("atendimento");

  // BRT "hoje"
  const nowBRT = new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
  const todayBRT = new Date(nowBRT);
  const todayStart = `${todayBRT.getFullYear()}-${String(todayBRT.getMonth() + 1).padStart(2, "0")}-${String(todayBRT.getDate()).padStart(2, "0")}T00:00:00-03:00`;

  try {
    const [
      totalChatsRes,
      totalMsgsRes,
      lastActivityRes,
      chatsTodayRes,
      msgsTodayRes,
      firstMsgRes,
      stageCheckRes,
    ] = await Promise.allSettled([
      supabase.from("chats").select("*", { count: "exact", head: true }),
      supabase.from("chat_messages").select("*", { count: "exact", head: true }),
      supabase.from("chats").select("last_interaction_at").order("last_interaction_at", { ascending: false }).limit(1),
      supabase.from("chats").select("*", { count: "exact", head: true }).gte("last_interaction_at", todayStart),
      supabase.from("chat_messages").select("*", { count: "exact", head: true }).gte("created_at", todayStart),
      supabase.from("chat_messages").select("created_at").order("created_at", { ascending: true }).limit(1),
      supabase.from("chats").select("stage").neq("stage", "new").limit(1),
    ]);

    const totalChats = totalChatsRes.status === "fulfilled" ? (totalChatsRes.value.count ?? 0) : 0;
    const totalMessages = totalMsgsRes.status === "fulfilled" ? (totalMsgsRes.value.count ?? 0) : 0;
    const lastActivityData = lastActivityRes.status === "fulfilled" ? lastActivityRes.value.data as Array<{ last_interaction_at: string }> | null : null;
    const lastActivity = lastActivityData?.[0]
      ? new Date(lastActivityData[0].last_interaction_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
      : "N/A";
    const chatsToday = chatsTodayRes.status === "fulfilled" ? (chatsTodayRes.value.count ?? 0) : 0;
    const messagesToday = msgsTodayRes.status === "fulfilled" ? (msgsTodayRes.value.count ?? 0) : 0;
    const firstMsgData = firstMsgRes.status === "fulfilled" ? firstMsgRes.value.data as Array<{ created_at: string }> | null : null;
    const firstMessageDate = firstMsgData?.[0]
      ? new Date(firstMsgData[0].created_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
      : "N/A";

    // Warnings
    const warnings: string[] = [];
    const hasNonNewStage = stageCheckRes.status === "fulfilled" && stageCheckRes.value.data && stageCheckRes.value.data.length > 0;
    if (!hasNonNewStage) {
      warnings.push("100% dos chats estão com stage='new' (valores default, não analisados). Não reporte stage como dado real.");
    }

    const approxTokens = Math.ceil((totalMessages * 21)); // ~21 tokens/msg média

    const stats: DbStats = {
      total_chats: totalChats,
      total_messages: totalMessages,
      total_tokens_approx: approxTokens,
      last_chat_activity: lastActivity,
      chats_today: chatsToday,
      messages_today: messagesToday,
      first_message_date: firstMessageDate,
      data_quality_warnings: warnings,
    };

    cachedStats = stats;
    cacheTimestamp = now;
    return stats;
  } catch {
    return {
      total_chats: 0,
      total_messages: 0,
      total_tokens_approx: 0,
      last_chat_activity: "N/A",
      chats_today: 0,
      messages_today: 0,
      first_message_date: "N/A",
      data_quality_warnings: ["Falha ao coletar stats do banco."],
    };
  }
}
