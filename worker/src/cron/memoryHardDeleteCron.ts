/**
 * Memory Hard Delete Cron — remove permanentemente memórias arquivadas há >90 dias.
 *
 * LGPD compliance: dados arquivados são hard-deletados após 90 dias.
 * Roda toda sexta-feira 03:00 BRT.
 */

import { createClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

function getSupabase(): AnySupabase {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars não configuradas");
  return createClient(url, key, { auth: { persistSession: false } });
}

function nowBRT(): { date: string; hour: number; dayOfWeek: number } {
  const now = new Date();
  const brt = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const dateStr = `${brt.getFullYear()}-${String(brt.getMonth() + 1).padStart(2, "0")}-${String(brt.getDate()).padStart(2, "0")}`;
  return { date: dateStr, hour: brt.getHours(), dayOfWeek: brt.getDay() };
}

let lastHardDeleteDate = "";

export async function memoryHardDeleteTask(): Promise<void> {
  const { date, hour, dayOfWeek } = nowBRT();

  // Sexta-feira (5), entre 03:00-03:59 BRT
  if (dayOfWeek !== 5 || hour < 3 || hour >= 4) return;
  if (lastHardDeleteDate === date) return;

  const supabase = getSupabase();

  // Buscar arquivadas há >90 dias
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from("clara_memories")
    .select("id")
    .eq("archived", true)
    .lt("archived_at", ninetyDaysAgo);

  if (error) {
    console.error("[HardDelete] Erro ao buscar arquivadas:", error.message);
    return;
  }

  const ids = (data || []).map((r: { id: number }) => r.id);
  if (ids.length === 0) {
    console.log("[HardDelete] Nenhuma memória elegível para hard delete.");
    lastHardDeleteDate = date;
    return;
  }

  // Hard delete em lotes de 100
  let deleted = 0;
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100);
    const { error: delErr } = await supabase
      .from("clara_memories")
      .delete()
      .in("id", batch);
    if (delErr) {
      console.error(`[HardDelete] Erro no batch ${i}:`, delErr.message);
    } else {
      deleted += batch.length;
    }
  }

  lastHardDeleteDate = date;
  console.log(`[Worker][HardDelete] ${deleted} memórias arquivadas há >90 dias removidas permanentemente (LGPD).`);

  // Registrar no audit log
  try {
    await supabase.from("memory_audit_log").insert({
      operation: "hard_delete_lgpd",
      memories_before: ids.length,
      memories_after: 0,
      dry_run: false,
      details: { threshold_days: 90, deleted_count: deleted },
    });
  } catch { /* audit log failure não deve parar o processo */ }
}
