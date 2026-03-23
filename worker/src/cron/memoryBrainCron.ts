/**
 * Memory Brain Cron — ciclo de consolidação do vault de memórias.
 *
 * Funciona como o sono do cérebro humano:
 * 1. PODA      — remove memórias com quality_score baixo (lixo)
 * 2. DEDUP     — funde pares muito similares (sim >= 0.85)
 * 3. CONSOLIDA — LLM agrupa clusters parecidos em memórias melhores
 * 4. RECONECTA — reconstrói os wikilinks (grafo) de memórias modificadas
 * 5. RELATA    — salva health report no vault
 *
 * Roda domingo 03:00–03:59 BRT (após vault-weekly no domingo 02h).
 */

import { GoogleGenAI } from "@google/genai";
import fs from "node:fs/promises";
import path from "node:path";
import { getVaultService, isVaultAvailable } from "@/ai/vault/service";

const VAULT_DIR = path.join(process.cwd(), "clinica-vault");
const INDEX_FILE = path.join(VAULT_DIR, ".memory-index.json");
const MEMORIES_DIR = path.join(VAULT_DIR, "memories");

const EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_DIMS = 768;
const LLM_MODEL = "gemini-3.1-flash-lite-preview";

const MIN_QUALITY_SCORE = 30;  // abaixo disso → poda
const DEDUP_THRESHOLD    = 0.85; // similaridade para considerar duplicata
const CLUSTER_THRESHOLD  = 0.75; // similaridade para agrupar para consolidação

interface MemoryEntry {
  slug: string;
  path: string;
  content: string;
  memory_type: string;
  quality_score: number;
  connections: Array<{ slug: string; strength: string }>;
  updated_at: string;
}

interface IndexFile {
  version: number;
  built_at: string;
  entries: MemoryEntry[];
  embeddings: Record<string, number[]>;
}

interface BrainReport {
  date: string;
  pruned: number;
  deduped: number;
  consolidated: number;
  reconnected: number;
  total_before: number;
  total_after: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

let lastBrainDate = "";

function nowBRT(): { date: string; hour: number; dayOfWeek: number } {
  const now = new Date();
  const brt = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const dateStr = `${brt.getFullYear()}-${String(brt.getMonth() + 1).padStart(2, "0")}-${String(brt.getDate()).padStart(2, "0")}`;
  return { date: dateStr, hour: brt.getHours(), dayOfWeek: brt.getDay() };
}

function cosine(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, ma = 0, mb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]; ma += a[i] * a[i]; mb += b[i] * b[i];
  }
  return Math.sqrt(ma) * Math.sqrt(mb) === 0 ? 0 : dot / (Math.sqrt(ma) * Math.sqrt(mb));
}

function slugify(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 80);
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY!,
});

async function embedText(text: string): Promise<number[] | null> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await ai.models.embedContent({
        model: EMBEDDING_MODEL, contents: text,
        config: { outputDimensionality: EMBEDDING_DIMS },
      });
      return r.embeddings?.[0]?.values ?? null;
    } catch {
      if (attempt === 3) return null;
      await sleep(1000 * Math.pow(3, attempt - 1));
    }
  }
  return null;
}

// ── Carregar / Salvar índice ──────────────────────────────────────────────────

async function loadIndex(): Promise<IndexFile> {
  const raw = await fs.readFile(INDEX_FILE, "utf-8");
  return JSON.parse(raw);
}

async function saveIndex(idx: IndexFile): Promise<void> {
  idx.built_at = new Date().toISOString();
  await fs.writeFile(INDEX_FILE, JSON.stringify(idx), "utf-8");
}

// ── Fase 1: Poda ─────────────────────────────────────────────────────────────

async function pruneLowQuality(idx: IndexFile): Promise<number> {
  const before = idx.entries.length;
  const toKeep = idx.entries.filter(e => (e.quality_score ?? 0) >= MIN_QUALITY_SCORE);
  const pruned = before - toKeep.length;

  for (const e of idx.entries) {
    if ((e.quality_score ?? 0) < MIN_QUALITY_SCORE) {
      await fs.rm(e.path, { force: true }).catch(() => {});
      delete idx.embeddings[e.slug];
    }
  }

  idx.entries = toKeep;
  console.log(`[Brain][Poda] ${pruned} memórias com score < ${MIN_QUALITY_SCORE} removidas`);
  return pruned;
}

// ── Fase 2: Deduplicação ──────────────────────────────────────────────────────

async function deduplicateMemories(idx: IndexFile): Promise<number> {
  const removed = new Set<string>();
  let deduped = 0;

  const withEmb = idx.entries.filter(e => idx.embeddings[e.slug]);

  for (let i = 0; i < withEmb.length; i++) {
    if (removed.has(withEmb[i].slug)) continue;

    for (let j = i + 1; j < withEmb.length; j++) {
      if (removed.has(withEmb[j].slug)) continue;

      const sim = cosine(idx.embeddings[withEmb[i].slug], idx.embeddings[withEmb[j].slug]);
      if (sim >= DEDUP_THRESHOLD) {
        // Manter o de maior quality_score
        const victim = withEmb[i].quality_score >= withEmb[j].quality_score
          ? withEmb[j] : withEmb[i];
        removed.add(victim.slug);
        await fs.rm(victim.path, { force: true }).catch(() => {});
        delete idx.embeddings[victim.slug];
        deduped++;
      }
    }
  }

  idx.entries = idx.entries.filter(e => !removed.has(e.slug));
  console.log(`[Brain][Dedup] ${deduped} duplicatas removidas (sim >= ${DEDUP_THRESHOLD})`);
  return deduped;
}

// ── Fase 3: Consolidação LLM ──────────────────────────────────────────────────

function buildClusters(entries: MemoryEntry[], embeddings: Record<string, number[]>): MemoryEntry[][] {
  const visited = new Set<string>();
  const clusters: MemoryEntry[][] = [];

  for (let i = 0; i < entries.length; i++) {
    if (visited.has(entries[i].slug) || !embeddings[entries[i].slug]) continue;
    const cluster = [entries[i]];
    visited.add(entries[i].slug);

    for (let j = i + 1; j < entries.length; j++) {
      if (visited.has(entries[j].slug) || !embeddings[entries[j].slug]) continue;
      const sim = cosine(embeddings[entries[i].slug], embeddings[entries[j].slug]);
      if (sim >= CLUSTER_THRESHOLD) {
        cluster.push(entries[j]);
        visited.add(entries[j].slug);
      }
    }

    if (cluster.length > 1) clusters.push(cluster);
  }
  return clusters;
}

async function consolidateCluster(cluster: MemoryEntry[]): Promise<{ content: string; memory_type: string } | null> {
  const contents = cluster.map((m, i) => `[${i + 1}] (${m.memory_type}) ${m.content.replace(/\n## Relacionados[\s\S]*/,"").trim()}`).join("\n\n");

  const prompt = `RESPONDA EXCLUSIVAMENTE EM PORTUGUÊS BRASILEIRO.

Você está consolidando memórias similares de uma clínica pediátrica.
Produza UMA única memória consolidada que:
1. Capture o padrão comum de todas as memórias abaixo
2. Seja mais completa e precisa que qualquer memória individual
3. Seja generalizável (aplicável a múltiplos casos, não a um paciente específico)
4. Não contenha dados pessoais (nomes, CPF, telefone)
5. Use o memory_type mais adequado: padrao_comportamental, processo_operacional, regra_negocio, protocolo_clinico, conhecimento_medico, feedback_melhoria, recurso_equipe, preferencia_sistema

MEMÓRIAS:
${contents}

Se as memórias não puderem ser bem consolidadas (muito diferentes), retorne null.
Responda JSON: {"content": "...", "memory_type": "..."} ou null`;

  try {
    const response = await ai.models.generateContent({
      model: LLM_MODEL, contents: prompt,
      config: { temperature: 0.1 },
    });

    const text = (response.text ?? "").trim()
      .replace(/^```json\n?/, "").replace(/\n?```$/, "").trim();

    if (text === "null" || text === "") return null;
    const parsed = JSON.parse(text);
    if (!parsed?.content || !parsed?.memory_type) return null;
    if (parsed.content.length < 40) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function consolidateClusters(idx: IndexFile): Promise<number> {
  const clusters = buildClusters(idx.entries, idx.embeddings);
  let consolidated = 0;

  for (const cluster of clusters) {
    if (cluster.length < 2) continue;

    const result = await consolidateCluster(cluster);
    if (!result) continue;

    // Verificar qualidade: consolidada precisa ser >= média dos inputs
    const inputAvgScore = cluster.reduce((s, m) => s + (m.quality_score ?? 0), 0) / cluster.length;
    const outputScore = Math.min(100, Math.max(0,
      Math.min(25, Math.round(((result.content.length - 40) / 160) * 25)) +
      (/R\$|valor|consulta|retorno/i.test(result.content) ? 20 : 0) +
      (result.content.split(/[.!?]/).filter(s => s.length > 10).length * 10)
    ));

    if (outputScore < inputAvgScore * 0.75) {
      console.log(`[Brain][Consolida] Cluster de ${cluster.length} descartado (qualidade insuficiente)`);
      await sleep(500);
      continue;
    }

    // Gerar embedding da nova memória
    const newEmbed = await embedText(result.content);
    if (!newEmbed) { await sleep(500); continue; }

    // Remover memórias antigas do índice e disco
    for (const old of cluster) {
      await fs.rm(old.path, { force: true }).catch(() => {});
      delete idx.embeddings[old.slug];
    }
    idx.entries = idx.entries.filter(e => !cluster.some(c => c.slug === e.slug));

    // Adicionar nova memória consolidada
    const newSlug = `${result.memory_type}/${slugify(result.content.slice(0, 80))}`;
    let finalSlug = newSlug;
    if (idx.entries.some(e => e.slug === finalSlug)) {
      finalSlug = `${newSlug}-${Date.now().toString(36).slice(-4)}`;
    }
    const newPath = path.join(MEMORIES_DIR, finalSlug + ".md");

    const newEntry: MemoryEntry = {
      slug: finalSlug,
      path: newPath,
      content: result.content,
      memory_type: result.memory_type,
      quality_score: outputScore,
      connections: [],
      updated_at: new Date().toISOString(),
    };

    await fs.mkdir(path.dirname(newPath), { recursive: true });
    const frontmatter = [
      "---",
      `type: memory`,
      `memory_type: ${result.memory_type}`,
      `quality_score: ${outputScore}`,
      `source_role: brain_consolidation`,
      `updated_at: '${newEntry.updated_at}'`,
      "---",
      "",
    ].join("\n");
    await fs.writeFile(newPath, frontmatter + result.content, "utf-8");

    idx.entries.push(newEntry);
    idx.embeddings[finalSlug] = newEmbed;
    consolidated++;

    console.log(`[Brain][Consolida] ${cluster.length} → 1 (score: ${outputScore}): ${result.content.slice(0, 60)}...`);
    await sleep(800);
  }

  return consolidated;
}

// ── Fase 4: Reconectar ────────────────────────────────────────────────────────

async function reconnectMemories(idx: IndexFile): Promise<number> {
  const MAX_CONNECTIONS = 5;
  const CONN_THRESHOLD = 0.75;
  let reconnected = 0;

  const withEmb = idx.entries.filter(e => idx.embeddings[e.slug]);

  for (const entry of withEmb) {
    const emb = idx.embeddings[entry.slug];

    const candidates = withEmb
      .filter(e => e.slug !== entry.slug)
      .map(e => ({ slug: e.slug, sim: cosine(emb, idx.embeddings[e.slug]) }))
      .filter(c => c.sim >= CONN_THRESHOLD)
      .sort((a, b) => b.sim - a.sim)
      .slice(0, MAX_CONNECTIONS);

    const newConnections = candidates.map(c => ({
      slug: c.slug,
      strength: c.sim >= 0.85 ? "forte" : "media",
    }));

    // Verificar se mudou
    const oldSet = new Set(entry.connections.map(c => c.slug));
    const newSet = new Set(newConnections.map(c => c.slug));
    const changed = oldSet.size !== newSet.size || [...newSet].some(s => !oldSet.has(s));

    if (!changed) continue;

    entry.connections = newConnections;

    // Reescrever .md
    try {
      const raw = await fs.readFile(entry.path, "utf-8").catch(() => "");
      if (!raw) continue;

      const fmMatch = raw.match(/^(---[\s\S]*?---\n?)([\s\S]*)$/);
      if (!fmMatch) continue;

      let fm = fmMatch[1];
      let body = fmMatch[2].replace(/\n\n## Relacionados[\s\S]*$/, "").trimEnd();

      // Remover connections antigas do frontmatter
      fm = fm.replace(/^connections:[\s\S]*?(?=^[a-z]|\n---)/m, "");

      if (newConnections.length > 0) {
        const connYaml = "connections:\n" +
          newConnections.map(c => `  - slug: ${c.slug}\n    strength: ${c.strength}`).join("\n") + "\n";
        fm = fm.replace(/\n---\n?$/, "\n" + connYaml + "---\n");

        const relSection = "\n\n## Relacionados\n" +
          newConnections.map(c => `- [[${c.slug}]] (${c.strength})`).join("\n");
        body = body + relSection;
      }

      await fs.writeFile(entry.path, fm + body, "utf-8");
      reconnected++;
    } catch { /* pular arquivo com problema */ }
  }

  console.log(`[Brain][Reconecta] ${reconnected} memórias reconectadas`);
  return reconnected;
}

// ── Fase 5: Health Report ─────────────────────────────────────────────────────

async function saveHealthReport(report: BrainReport): Promise<void> {
  if (!(await isVaultAvailable())) return;
  try {
    const vault = getVaultService();
    const notePath = `reports/${report.date}-brain-consolidation.md`;
    const reduction = report.total_before - report.total_after;
    const reductionPct = report.total_before > 0
      ? ((reduction / report.total_before) * 100).toFixed(1)
      : "0";

    const content = `# Brain Consolidation — ${report.date}

## Ciclo de Consolidação de Memórias

| Fase | Resultado |
|------|-----------|
| 🗑️ Poda (score < ${MIN_QUALITY_SCORE}) | ${report.pruned} removidas |
| 🔗 Deduplicação (sim >= ${DEDUP_THRESHOLD}) | ${report.deduped} fundidas |
| 🧠 Consolidação LLM | ${report.consolidated} clusters → 1 cada |
| 🕸️ Reconexão de grafo | ${report.reconnected} reconectadas |

## Resultado Final

- **Antes:** ${report.total_before} memórias
- **Depois:** ${report.total_after} memórias
- **Redução:** ${reduction} (${reductionPct}%)
- **Vault mais limpo, conexões atualizadas.**
`;

    await vault.writeNote(notePath, content, {
      type: "brain_report",
      auto_generated: true,
      created_at: report.date,
    });
  } catch (err) {
    console.warn("[Brain] Falha ao salvar health report:", (err as Error).message);
  }
}

// ── Task principal ────────────────────────────────────────────────────────────

export async function memoryBrainTask(): Promise<void> {
  const { date, hour, dayOfWeek } = nowBRT();

  // Domingo (0), entre 03:00-03:59 BRT
  if (dayOfWeek !== 0 || hour < 3 || hour >= 4) return;
  if (lastBrainDate === date) return;

  console.log(`[Worker][Brain] Iniciando ciclo de consolidação — ${date}`);

  let idx: IndexFile;
  try {
    idx = await loadIndex();
  } catch {
    console.error("[Brain] .memory-index.json não encontrado. Execute backfill-embeddings.mts primeiro.");
    return;
  }

  const totalBefore = idx.entries.length;
  const report: BrainReport = { date, pruned: 0, deduped: 0, consolidated: 0, reconnected: 0, total_before: totalBefore, total_after: 0 };

  try {
    // Fase 1: Poda
    report.pruned = await pruneLowQuality(idx);
    await saveIndex(idx);

    // Fase 2: Dedup
    report.deduped = await deduplicateMemories(idx);
    await saveIndex(idx);

    // Fase 3: Consolidação LLM (apenas em entradas não Tier 1)
    const tier1Types = new Set(["regra_negocio", "protocolo_clinico", "recurso_equipe"]);
    const consolidatableEntries = idx.entries.filter(e => !tier1Types.has(e.memory_type));
    const savedTier1 = idx.entries.filter(e => tier1Types.has(e.memory_type));

    const idxForConsolidation = { ...idx, entries: consolidatableEntries };
    report.consolidated = await consolidateClusters(idxForConsolidation);

    // Restaurar Tier 1 + consolidadas
    idx.entries = [...savedTier1, ...idxForConsolidation.entries];
    idx.embeddings = { ...idx.embeddings, ...idxForConsolidation.embeddings };
    await saveIndex(idx);

    // Fase 4: Reconexão do grafo
    report.reconnected = await reconnectMemories(idx);
    await saveIndex(idx);

    report.total_after = idx.entries.length;
    lastBrainDate = date;

    console.log(
      `[Worker][Brain] Concluído: ${totalBefore} → ${report.total_after} memórias ` +
      `(podadas: ${report.pruned}, dedup: ${report.deduped}, consolidadas: ${report.consolidated}, reconectadas: ${report.reconnected})`
    );

    // Fase 5: Relatório
    await saveHealthReport(report);
  } catch (err) {
    console.error("[Brain] Erro durante consolidação:", (err as Error).message);
  }
}
