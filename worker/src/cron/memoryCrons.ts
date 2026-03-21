/**
 * Memory Consolidation Cron — Manutenção automática das memórias da Clara.
 *
 * Roda a cada 60s no RobustCronManager, mas internamente checa o horário BRT
 * e um flag "já rodou esta semana" para só executar na hora certa.
 *
 * - Quarta-feira 02:00-02:59 BRT, 1x por semana
 *   (quarta para evitar conflito com vaultWeekly no domingo)
 *
 * Ações:
 * - Dedup semanal: encontra pares com similaridade >0.80, merge
 * - Arquivo morto: memórias >90 dias que não passam no quality gate
 * - Re-categorização: tipos legados mapeados para nova taxonomia
 * - Health report: salva em reports/ no vault
 */

import { createClient } from "@supabase/supabase-js";
import { MEMORY_TYPES, mapLegacyType } from "@/ai/clara/memory_types";
import { stripPIIAndReferences, isGeneralizablePattern } from "@/ai/clara/memory_quality";
import { isVaultAvailable, getVaultService } from "@/ai/vault/service";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

function getConsolidationSupabase(): AnySupabase {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars nao configuradas");
  return createClient(url, key, { auth: { persistSession: false } });
}

interface MemoryRow {
  id: number;
  memory_type: string;
  content: string;
  embedding: number[] | null;
  updated_at: string;
}

interface HealthReport {
  date: string;
  total_before: number;
  duplicates_merged: number;
  archived: number;
  recategorized: number;
  total_after: number;
}

/** Retorna data/hora atual em BRT */
function nowBRT(): { date: string; hour: number; dayOfWeek: number } {
  const now = new Date();
  const brt = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const year = brt.getFullYear();
  const month = brt.getMonth();
  const day = brt.getDate();
  const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return { date: dateStr, hour: brt.getHours(), dayOfWeek: brt.getDay() };
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

// State — flag para evitar execução duplicada
let lastConsolidationDate = "";

async function runConsolidation(): Promise<HealthReport> {
  const supabase = getConsolidationSupabase();
  const report: HealthReport = {
    date: new Date().toISOString(),
    total_before: 0,
    duplicates_merged: 0,
    archived: 0,
    recategorized: 0,
    total_after: 0,
  };

  // 1. Buscar todas as memórias com embeddings
  const { data, error } = await supabase
    .from("clara_memories")
    .select("id, memory_type, content, embedding, updated_at")
    .order("updated_at", { ascending: false });

  if (error || !data) {
    console.error("[Memory Consolidation] Erro ao buscar memórias:", error?.message);
    return report;
  }

  const memories = data as MemoryRow[];
  report.total_before = memories.length;

  const toDelete = new Set<number>();

  // 2. Dedup: encontrar pares com similaridade >0.80
  for (let i = 0; i < memories.length; i++) {
    if (toDelete.has(memories[i].id)) continue;
    if (!memories[i].embedding) continue;

    for (let j = i + 1; j < memories.length; j++) {
      if (toDelete.has(memories[j].id)) continue;
      if (!memories[j].embedding) continue;

      const sim = cosineSimilarity(memories[i].embedding!, memories[j].embedding!);
      if (sim > 0.80) {
        // Manter o mais longo, deletar o mais curto
        const victim = memories[i].content.length >= memories[j].content.length ? j : i;
        toDelete.add(memories[victim].id);
        report.duplicates_merged++;
      }
    }
  }

  // 3. Arquivo morto: memórias >90 dias que não passam no quality gate
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString();
  for (const mem of memories) {
    if (toDelete.has(mem.id)) continue;
    if (mem.updated_at < ninetyDaysAgo) {
      const cleaned = stripPIIAndReferences(mem.content);
      if (!cleaned || !isGeneralizablePattern(cleaned)) {
        toDelete.add(mem.id);
        report.archived++;
      }
    }
  }

  // 4. Re-categorizar tipos legados
  for (const mem of memories) {
    if (toDelete.has(mem.id)) continue;
    if (!(MEMORY_TYPES as readonly string[]).includes(mem.memory_type)) {
      const newType = mapLegacyType(mem.memory_type);
      if (newType !== mem.memory_type) {
        await supabase
          .from("clara_memories")
          .update({ memory_type: newType })
          .eq("id", mem.id);
        report.recategorized++;
      }
    }
  }

  // 5. Deletar marcados
  if (toDelete.size > 0) {
    const ids = Array.from(toDelete);
    for (let i = 0; i < ids.length; i += 50) {
      const batch = ids.slice(i, i + 50);
      await supabase.from("clara_memories").delete().in("id", batch);
    }
  }

  report.total_after = report.total_before - toDelete.size;
  return report;
}

async function saveHealthReport(report: HealthReport): Promise<void> {
  if (!(await isVaultAvailable())) return;

  try {
    const vault = getVaultService();
    const date = report.date.slice(0, 10);
    const notePath = `reports/${date}-memory-health.md`;

    const content = `# Memory Health Report — ${date}

## Métricas

- **Total antes:** ${report.total_before}
- **Duplicatas mergeadas:** ${report.duplicates_merged}
- **Arquivadas (>90d + baixa qualidade):** ${report.archived}
- **Re-categorizadas:** ${report.recategorized}
- **Total depois:** ${report.total_after}
- **Redução:** ${report.total_before - report.total_after} memórias (${((1 - report.total_after / report.total_before) * 100).toFixed(1)}%)
`;

    await vault.writeNote(notePath, content, {
      type: "memory_health",
      auto_generated: true,
      created_at: report.date,
      metrics: report,
    });
  } catch (err) {
    console.warn("[Memory Consolidation] Falha ao salvar health report:", (err as Error).message);
  }
}

/**
 * Task principal — chamada pelo RobustCronManager a cada 60s.
 * Executa consolidação semanal de memórias na quarta-feira 02:00-02:59 BRT.
 */
export async function memoryConsolidationTask(): Promise<void> {
  const { date, hour, dayOfWeek } = nowBRT();

  // Quarta-feira (3), entre 02:00-02:59 BRT
  if (dayOfWeek !== 3 || hour < 2 || hour >= 3) return;

  // Já rodou esta semana?
  if (lastConsolidationDate === date) return;

  console.log(`[Worker][Memory Consolidation] Iniciando para ${date}...`);

  const report = await runConsolidation();
  lastConsolidationDate = date;

  console.log(
    `[Worker][Memory Consolidation] Concluído: ${report.total_before} → ${report.total_after} ` +
    `(merged: ${report.duplicates_merged}, archived: ${report.archived}, recat: ${report.recategorized})`
  );

  await saveHealthReport(report);
}
