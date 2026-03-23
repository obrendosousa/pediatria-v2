/**
 * Cleanup: consolida, de-dups e re-categoriza todas as memórias da Clara.
 *
 * Algoritmo:
 * 1. Backup de todas as memórias em JSON
 * 2. Clustering por similaridade semântica (threshold 0.75)
 * 3. Consolidação via LLM para cada cluster >1
 * 4. Filtro de singletons pelo quality gate
 * 5. INSERT consolidadas → soft delete antigas (NUNCA hard delete)
 * 6. Regenera vault (atomic swap)
 * 7. Salva métricas em memory_audit_log
 *
 * Uso:     npx tsx --env-file=.env.local scripts/cleanup-memories.mts
 * Dry-run: npx tsx --env-file=.env.local scripts/cleanup-memories.mts --dry-run
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";
import fs from "node:fs/promises";
import path from "node:path";
import { calculateQualityScore, applyQualityPipeline } from "../src/ai/clara/memory_quality.js";
import { MEMORY_TYPES, mapLegacyType, type MemoryType } from "../src/ai/clara/memory_types.js";
import { EMBEDDING_MODEL, EMBEDDING_DIMS } from "../src/ai/clara/constants.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

const DRY_RUN = process.argv.includes("--dry-run");

const supabase: AnySupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY!,
});

interface MemoryRecord {
  id: number;
  memory_type: string;
  content: string;
  embedding: number[] | null;
  source_role: string;
  created_at: string;
  updated_at: string;
}

interface ConsolidatedMemory {
  memory_type: MemoryType;
  content: string;
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/** Gera embedding com retry exponencial. Retorna null se todas tentativas falharem. */
async function embedText(text: string): Promise<number[] | null> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await ai.models.embedContent({
        model: EMBEDDING_MODEL,
        contents: text,
        config: { outputDimensionality: EMBEDDING_DIMS },
      });
      return response.embeddings?.[0]?.values ?? null;
    } catch (err) {
      if (attempt === 3) {
        console.error(`[Embed] Falha após 3 tentativas: ${err instanceof Error ? err.message : err}`);
        return null;
      }
      await sleep(1000 * Math.pow(3, attempt - 1));
    }
  }
  return null;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]; magA += a[i] * a[i]; magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 1: BACKUP
// ═══════════════════════════════════════════════════════════════════════════

async function backupMemories(memories: MemoryRecord[]): Promise<void> {
  const backupDir = path.join(process.cwd(), "scripts", "backups");
  await fs.mkdir(backupDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const backupPath = path.join(backupDir, `memories-backup-${ts}.json`);
  await fs.writeFile(backupPath, JSON.stringify(memories, null, 2));
  console.log(`[1/7] Backup salvo: ${backupPath}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 2: CLUSTERING
// ═══════════════════════════════════════════════════════════════════════════

function buildClusters(memories: MemoryRecord[], threshold: number): MemoryRecord[][] {
  const visited = new Set<number>();
  const clusters: MemoryRecord[][] = [];

  for (let i = 0; i < memories.length; i++) {
    if (visited.has(i) || !memories[i].embedding) continue;
    const cluster = [memories[i]];
    visited.add(i);

    for (let j = i + 1; j < memories.length; j++) {
      if (visited.has(j) || !memories[j].embedding) continue;
      const sim = cosineSimilarity(memories[i].embedding!, memories[j].embedding!);
      if (sim >= threshold) { cluster.push(memories[j]); visited.add(j); }
    }
    clusters.push(cluster);
  }

  // Memórias sem embedding viram singletons
  for (let i = 0; i < memories.length; i++) {
    if (!visited.has(i)) clusters.push([memories[i]]);
  }

  return clusters;
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 3: LLM CONSOLIDATION
// ═══════════════════════════════════════════════════════════════════════════

async function consolidateCluster(cluster: MemoryRecord[]): Promise<ConsolidatedMemory[]> {
  if (DRY_RUN) {
    console.log(`  [DRY RUN] Consolidaria cluster de ${cluster.length}: "${cluster[0].content.slice(0, 60)}..."`);
    return [];
  }

  const clusterContents = cluster
    .map((m, i) => `${i + 1}. [${m.memory_type}] ${m.content}`)
    .join("\n");

  const prompt = `RESPONDA EXCLUSIVAMENTE EM PORTUGUÊS BRASILEIRO.

Você está consolidando um grupo de memórias similares de uma clínica pediátrica.

REGRAS:
1. Merge em 1-3 padrões GENERALIZÁVEIS (não observações individuais)
2. Remova TUDO: nomes de pacientes, chat IDs, telefones, CPFs, datas específicas, e-mails
3. Mantenha APENAS informação útil para atendimentos FUTUROS
4. Cada saída deve ser um padrão que se aplica a múltiplos casos
5. Use memory_type de: ${MEMORY_TYPES.join(", ")}
6. Se TODAS as entradas forem ruído/dados individuais, retorne array vazio []

ENTRADAS:
${clusterContents}

Retorne JSON válido: [{"memory_type": "...", "content": "..."}]
Retorne [] se nada valer a pena manter.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: { responseMimeType: "application/json", temperature: 0.1 },
    });

    const text = response.text?.trim();
    if (!text) return [];

    let parsed: ConsolidatedMemory[];
    try {
      parsed = JSON.parse(text);
    } catch {
      console.error(`[Consolidation] JSON inválido para cluster de ${cluster.length}. Mantendo originais.`);
      return [];
    }

    if (!Array.isArray(parsed)) return [];

    const valid = parsed
      .filter((item: { memory_type?: string; content?: string }) =>
        item.memory_type &&
        item.content &&
        (MEMORY_TYPES as readonly string[]).includes(item.memory_type) &&
        item.content.length >= 40
      )
      .map((item: { memory_type: string; content: string }) => ({
        memory_type: item.memory_type as MemoryType,
        content: item.content,
      }));

    // B.2 Fix: validar qualidade output vs. input antes de retornar
    if (valid.length === 0) return [];

    const inputAvgScore = cluster.reduce((s, m) => s + calculateQualityScore(m.content), 0) / cluster.length;
    const outputAvgScore = valid.reduce((s, m) => s + calculateQualityScore(m.content), 0) / valid.length;

    if (outputAvgScore < inputAvgScore * 0.8) {
      console.warn(`[Consolidation] Output de qualidade inferior ao input (${outputAvgScore.toFixed(0)} < ${inputAvgScore.toFixed(0)}). Mantendo originais.`);
      return [];
    }

    return valid;
  } catch (err) {
    console.error(
      `[Consolidation] Erro ao consolidar cluster de ${cluster.length}:`,
      err instanceof Error ? err.message : err
    );
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 5: APPLY (INSERT first, SOFT DELETE second)
// ═══════════════════════════════════════════════════════════════════════════

async function applyChanges(
  toDelete: number[],
  toInsert: ConsolidatedMemory[]
): Promise<{ insertCount: number; embeddingFailures: number }> {
  if (DRY_RUN) {
    console.log(`[DRY RUN] Inseriria ${toInsert.length} memórias consolidadas`);
    console.log(`[DRY RUN] Arquivaria ${toDelete.length} memórias antigas`);
    return { insertCount: 0, embeddingFailures: 0 };
  }

  let insertCount = 0;
  let embeddingFailures = 0;

  // PRIMEIRO: inserir consolidadas com novos embeddings
  for (const mem of toInsert) {
    try {
      const embedding = await embedText(mem.content);
      if (!embedding) embeddingFailures++;
      const score = calculateQualityScore(mem.content);

      const { error } = await supabase
        .from("clara_memories")
        .insert({
          memory_type: mem.memory_type,
          content: mem.content,
          embedding,
          quality_score: score,
          embedding_status: embedding ? "ok" : "failed",
          source_role: "consolidation",
          updated_at: new Date().toISOString(),
        });

      if (error) {
        console.error(`[Insert] Erro:`, error.message);
      } else {
        insertCount++;
      }
      await sleep(200);
    } catch (err) {
      console.error(`[Insert] Exceção:`, err instanceof Error ? err.message : err);
    }
  }
  console.log(`[Insert] ${insertCount}/${toInsert.length} memórias consolidadas inseridas`);

  // DEPOIS: soft delete das antigas (NUNCA hard delete)
  for (let i = 0; i < toDelete.length; i += 50) {
    const batch = toDelete.slice(i, i + 50);
    const { error } = await supabase
      .from("clara_memories")
      .update({
        archived: true,
        archived_at: new Date().toISOString(),
        archive_reason: "consolidation",
      })
      .in("id", batch);
    if (error) console.error(`[Archive] Erro no batch ${i}:`, error.message);
  }
  console.log(`[Archive] ${toDelete.length} memórias arquivadas (soft delete)`);

  return { insertCount, embeddingFailures };
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 6: REGENERAR VAULT (atomic swap)
// ═══════════════════════════════════════════════════════════════════════════

async function regenerateVault(): Promise<void> {
  if (DRY_RUN) {
    console.log(`[DRY RUN] Regeneraria o vault de memórias (atomic swap)`);
    return;
  }

  const vaultMemDir = path.join(process.cwd(), "clinica-vault", "memories");
  const tempDir = vaultMemDir + "_temp";
  const oldDir = vaultMemDir + "_old";

  // Limpar temp anterior se existir
  await fs.rm(tempDir, { recursive: true, force: true });
  await fs.mkdir(tempDir, { recursive: true });

  // Buscar memórias ativas
  const { data: currentMemories, error } = await supabase
    .from("clara_memories")
    .select("id, memory_type, content, source_role, embedding, updated_at")
    .eq("archived", false)
    .order("created_at", { ascending: true });

  if (error || !currentMemories) {
    console.error("[Vault] Erro ao buscar memórias:", error?.message);
    await fs.rm(tempDir, { recursive: true, force: true });
    return;
  }

  const memories = currentMemories as Array<{
    id: number; memory_type: string; content: string;
    source_role: string; embedding: number[] | null; updated_at: string;
  }>;

  const matter = await import("gray-matter");

  // Agrupar por tipo para calcular conexões
  const byType: Record<string, typeof memories> = {};
  for (const m of memories) {
    byType[m.memory_type] = byType[m.memory_type] || [];
    byType[m.memory_type].push(m);
  }

  // Gerar arquivos em tempDir
  for (const mem of memories) {
    const typeFolder = slugify(mem.memory_type.replace(/_/g, "-"));
    const contentSlug = slugify(mem.content.slice(0, 80));
    const relativePath = `${typeFolder}/${contentSlug}.md`;
    const absPath = path.join(tempDir, relativePath);

    await fs.mkdir(path.dirname(absPath), { recursive: true });

    // Calcular conexões (top-3 similares dentro do mesmo tipo, deduplicadas)
    const connections: Array<{ slug: string; strength: string }> = [];
    if (mem.embedding) {
      const sameType = (byType[mem.memory_type] || []).filter(m => m.id !== mem.id && m.embedding);
      const sims = sameType
        .map(m => ({ m, sim: cosineSimilarity(mem.embedding!, m.embedding!) }))
        .filter(x => x.sim >= 0.70)
        .sort((a, b) => b.sim - a.sim)
        .slice(0, 5);

      const seen = new Set<string>();
      for (const { m, sim } of sims) {
        const slug = slugify(m.content.slice(0, 80));
        if (seen.has(slug)) continue; // E.1: dedup wikilinks
        seen.add(slug);
        // E.2: força da conexão
        const strength = sim >= 0.85 ? "forte" : "media";
        connections.push({ slug, strength });
      }
    }

    const frontmatter: Record<string, unknown> = {
      type: "memory",
      memory_type: mem.memory_type,
      source_role: mem.source_role,
      supabase_id: mem.id,
      quality_score: calculateQualityScore(mem.content),
      created_at: new Date().toISOString(),
      updated_at: mem.updated_at,
      tags: [mem.memory_type.replace(/_/g, "-")],
      agent_source: "clara",
    };

    if (connections.length > 0) {
      frontmatter.connections = connections;
    }

    const contextLink = `[[_moc-${slugify(mem.memory_type.replace(/_/g, "-"))}|${mem.memory_type}]]`;
    const relatedLinks = connections.map(c =>
      `- [[${typeFolder}/${c.slug}]] (${c.strength})`
    );

    const body = [
      mem.content,
      "",
      "## Contexto",
      `- Categoria: ${contextLink}`,
    ];
    if (relatedLinks.length > 0) {
      body.push("", "## Relacionados");
      body.push(...relatedLinks);
    }

    const output = matter.default.stringify(body.join("\n"), frontmatter);
    await fs.writeFile(absPath, output, "utf-8");
  }

  // Validar integridade mínima antes do swap
  const generated = await fs.readdir(tempDir, { recursive: true });
  const mdFiles = (generated as string[]).filter(f => f.endsWith(".md"));
  if (mdFiles.length === 0) {
    console.error("[Vault] Geração produziu 0 arquivos. Abortando swap. Vault original intacto.");
    await fs.rm(tempDir, { recursive: true, force: true });
    return;
  }

  // Atomic swap
  await fs.rm(oldDir, { recursive: true, force: true });
  await fs.rename(vaultMemDir, oldDir);
  await fs.rename(tempDir, vaultMemDir);

  console.log(`[Vault] ${mdFiles.length} arquivos gerados. Swap atômico concluído.`);
  console.log(`[Vault] Backup anterior em: ${oldDir} (remover manualmente após verificar)`);
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 7: SALVAR MÉTRICAS
// ═══════════════════════════════════════════════════════════════════════════

async function saveAuditLog(metrics: {
  memoriesBefore: number;
  memoriesAfter: number;
  clustersFound: number;
  singletonKept: number;
  singletonDiscarded: number;
  embeddingFailures: number;
}): Promise<void> {
  if (DRY_RUN) return;
  try {
    await supabase.from("memory_audit_log").insert({
      operation: "consolidation",
      memories_before: metrics.memoriesBefore,
      memories_after: metrics.memoriesAfter,
      clusters_found: metrics.clustersFound,
      singletons_kept: metrics.singletonKept,
      singletons_discarded: metrics.singletonDiscarded,
      embedding_failures: metrics.embeddingFailures,
      dry_run: DRY_RUN,
      details: { threshold: 0.75, model: "gemini-2.0-flash" },
    });
  } catch (err) {
    console.warn("[Metrics] Falha ao salvar audit log:", err instanceof Error ? err.message : err);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  CLEANUP DE MEMÓRIAS DA CLARA ${DRY_RUN ? "(DRY RUN)" : ""}`);
  console.log(`${"═".repeat(60)}\n`);

  // 1. Buscar memórias ativas
  const { data: allMemories, error } = await supabase
    .from("clara_memories")
    .select("id, memory_type, content, embedding, source_role, created_at, updated_at")
    .eq("archived", false)
    .order("created_at", { ascending: true });

  if (error || !allMemories) {
    console.error("Erro ao buscar memórias:", error?.message);
    process.exit(1);
  }

  const memories = allMemories as MemoryRecord[];
  const memoriesBefore = memories.length;
  console.log(`[1/7] Total de memórias ativas: ${memoriesBefore}`);

  // 2. Backup
  await backupMemories(memories);

  // 3. Gerar embeddings faltantes (skip em dry-run)
  let embeddingCount = 0;
  for (const mem of memories) {
    if (!DRY_RUN && (!mem.embedding || (Array.isArray(mem.embedding) && mem.embedding.length === 0))) {
      const emb = await embedText(mem.content);
      if (emb) {
        mem.embedding = emb;
        embeddingCount++;
        await supabase.from("clara_memories")
          .update({ embedding: emb, embedding_status: "ok" })
          .eq("id", mem.id);
        if (embeddingCount % 10 === 0) console.log(`  Gerando embeddings... ${embeddingCount}`);
        await sleep(150);
      }
    }
  }
  if (embeddingCount > 0) console.log(`[2/7] ${embeddingCount} embeddings gerados`);
  else console.log(`[2/7] Embeddings verificados`);

  // 4. Clustering
  const clusters = buildClusters(memories, 0.75);
  const multiClusters = clusters.filter((c) => c.length > 1);
  const singletons = clusters.filter((c) => c.length === 1).map((c) => c[0]);
  console.log(`[3/7] ${clusters.length} clusters (${multiClusters.length} multi, ${singletons.length} singletons)`);

  // 5. Consolidar clusters via LLM — B.2 Fix: marcar toDelete DEPOIS de verificar resultado
  const allConsolidated: ConsolidatedMemory[] = [];
  const allToDelete: number[] = [];
  const failedClusters: MemoryRecord[] = []; // clusters que falharam viram singletons

  console.log(`[4/7] Consolidando ${multiClusters.length} clusters via LLM...`);
  for (let i = 0; i < multiClusters.length; i++) {
    const cluster = multiClusters[i];
    const consolidated = await consolidateCluster(cluster);

    if (consolidated.length > 0) {
      // Só marca para delete SE consolidação gerou output válido
      for (const mem of cluster) allToDelete.push(mem.id);
      for (const c of consolidated) allConsolidated.push(c);
    } else {
      // Consolidação falhou ou retornou vazio — cada membro vira singleton
      console.warn(`  Cluster de ${cluster.length} não gerou output. Membros viram singletons.`);
      for (const mem of cluster) failedClusters.push(mem);
    }

    if ((i + 1) % 10 === 0 || i === multiClusters.length - 1) {
      console.log(`  Clusters: ${i + 1}/${multiClusters.length} → ${allConsolidated.length} consolidados`);
    }

    await sleep(300);
  }

  // 6. Filtrar singletons pelo quality gate
  let singletonKept = 0;
  let singletonDiscarded = 0;
  const allSingletons = [...singletons, ...failedClusters];

  for (const mem of allSingletons) {
    const result = applyQualityPipeline(mem.content);
    if (result) {
      allConsolidated.push({
        memory_type: mapLegacyType(mem.memory_type),
        content: result.cleaned,
      });
      singletonKept++;
    } else {
      allToDelete.push(mem.id);
      singletonDiscarded++;
    }
  }

  console.log(`[5/7] Singletons: ${singletonKept} mantidos, ${singletonDiscarded} descartados`);
  console.log(`      Total a inserir: ${allConsolidated.length} | Total a arquivar: ${allToDelete.length}`);

  // 7. Apply (INSERT first, soft delete second)
  const { insertCount, embeddingFailures } = await applyChanges(allToDelete, allConsolidated);

  // 8. Regenerar vault (atomic)
  await regenerateVault();
  console.log(`[6/7] Vault regenerado`);

  // 9. Salvar métricas
  await saveAuditLog({
    memoriesBefore,
    memoriesAfter: memoriesBefore - allToDelete.length + insertCount,
    clustersFound: multiClusters.length,
    singletonKept,
    singletonDiscarded,
    embeddingFailures,
  });
  console.log(`[7/7] Métricas salvas em memory_audit_log`);

  console.log(`\n${"═".repeat(60)}`);
  console.log(`  CONCLUÍDO: ${memoriesBefore} → ${memoriesBefore - allToDelete.length + insertCount} memórias`);
  console.log(`${"═".repeat(60)}\n`);
}

main().catch((err) => { console.error(err); process.exit(1); });
