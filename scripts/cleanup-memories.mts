/**
 * Cleanup: consolida, de-dups e re-categoriza todas as memórias da Clara.
 *
 * Algoritmo:
 * 1. Backup de todas as memórias em JSON
 * 2. Clustering por similaridade semântica (threshold 0.75)
 * 3. Consolidação via LLM para cada cluster >1
 * 4. Filtro de singletons pelo quality gate
 * 5. Deleta memórias antigas, insere consolidadas com novos embeddings
 * 6. Regenera vault
 *
 * Uso: npx tsx --env-file=.env.local scripts/cleanup-memories.mts
 * Preview: npx tsx --env-file=.env.local scripts/cleanup-memories.mts --dry-run
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";
import fs from "node:fs/promises";
import path from "node:path";

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

const MEMORY_TYPES = [
  "regra_negocio",
  "protocolo_clinico",
  "padrao_comportamental",
  "recurso_equipe",
  "processo_operacional",
  "conhecimento_medico",
  "feedback_melhoria",
  "preferencia_sistema",
] as const;

type MemoryType = (typeof MEMORY_TYPES)[number];

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

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

async function embedText(text: string): Promise<number[]> {
  const response = await ai.models.embedContent({
    model: "gemini-embedding-001",
    contents: text,
    config: { outputDimensionality: 768 },
  });
  return response.embeddings?.[0]?.values ?? [];
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

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 1: BACKUP
// ═══════════════════════════════════════════════════════════════════════════

async function backupMemories(memories: MemoryRecord[]): Promise<string> {
  const outputDir = path.join(process.cwd(), "scripts", "output");
  await fs.mkdir(outputDir, { recursive: true });

  const date = new Date().toISOString().slice(0, 10);
  const filePath = path.join(outputDir, `memories-backup-${date}.json`);

  // Remover embeddings do backup (muito grande)
  const lite = memories.map(({ embedding: _e, ...rest }) => rest);
  await fs.writeFile(filePath, JSON.stringify(lite, null, 2));
  console.log(`[Backup] ${memories.length} memórias salvas em ${filePath}`);
  return filePath;
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 2: CLUSTERING
// ═══════════════════════════════════════════════════════════════════════════

function buildClusters(memories: MemoryRecord[], threshold: number): MemoryRecord[][] {
  const visited = new Set<number>();
  const clusters: MemoryRecord[][] = [];

  for (let i = 0; i < memories.length; i++) {
    if (visited.has(i)) continue;
    if (!memories[i].embedding) {
      // Sem embedding — será singleton
      clusters.push([memories[i]]);
      visited.add(i);
      continue;
    }

    const cluster = [memories[i]];
    visited.add(i);

    for (let j = i + 1; j < memories.length; j++) {
      if (visited.has(j)) continue;
      if (!memories[j].embedding) continue;

      const sim = cosineSimilarity(memories[i].embedding!, memories[j].embedding!);
      if (sim >= threshold) {
        cluster.push(memories[j]);
        visited.add(j);
      }
    }

    clusters.push(cluster);
  }

  return clusters;
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 3: LLM CONSOLIDATION
// ═══════════════════════════════════════════════════════════════════════════

async function consolidateCluster(cluster: MemoryRecord[]): Promise<ConsolidatedMemory[]> {
  const clusterContents = cluster
    .map((m, i) => `${i + 1}. [${m.memory_type}] ${m.content}`)
    .join("\n");

  const prompt = `Voce esta consolidando um grupo de memorias similares de uma clinica pediatrica.

REGRAS:
1. Merge em 1-3 padroes GENERALIZAVEIS (nao observacoes individuais)
2. Remova TUDO: nomes de pacientes, chat IDs, telefones, CPFs, datas especificas, e-mails
3. Mantenha APENAS informacao util para atendimentos FUTUROS
4. Cada saida deve ser um padrao que se aplica a multiplos casos
5. Use memory_type de: ${MEMORY_TYPES.join(", ")}
6. Se TODAS as entradas forem ruido/dados individuais, retorne array vazio []

ENTRADAS:
${clusterContents}

Retorne JSON valido: [{"memory_type": "...", "content": "..."}]
Retorne [] se nada valer a pena manter.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.1,
      },
    });

    const text = response.text?.trim();
    if (!text) return [];

    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(
        (item: { memory_type?: string; content?: string }) =>
          item.memory_type &&
          item.content &&
          (MEMORY_TYPES as readonly string[]).includes(item.memory_type) &&
          item.content.length >= 20
      )
      .map((item: { memory_type: string; content: string }) => ({
        memory_type: item.memory_type as MemoryType,
        content: item.content,
      }));
  } catch (err) {
    console.error(
      `[Consolidation] Erro ao consolidar cluster de ${cluster.length}:`,
      err instanceof Error ? err.message : err
    );
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 4: QUALITY GATE (SINGLETONS)
// ═══════════════════════════════════════════════════════════════════════════

const CHAT_ID_REGEX = /\b[Cc]hat\s*#?\s*\d+\b/g;
const INSIGHT_PREFIX_REGEX = /^Insight Validado \(Chat \d+\):\s*/i;
const PHONE_REGEX = /\(?\+?\d{1,3}\)?\s*\d{2,5}[\s-]?\d{4,5}[\s-]?\d{4}/g;
const CPF_REGEX = /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const NAME_AFTER_ROLE_REGEX =
  /\b(paciente|cliente|mae|mãe|pai|responsavel|responsável|acompanhante)\s+[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ][a-záéíóúâêîôûãõç]+(\s+[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ][a-záéíóúâêîôûãõç]+)*/gi;

function cleanContent(text: string): string | null {
  let cleaned = text
    .replace(INSIGHT_PREFIX_REGEX, "")
    .replace(CHAT_ID_REGEX, "")
    .replace(PHONE_REGEX, "")
    .replace(CPF_REGEX, "")
    .replace(EMAIL_REGEX, "")
    .replace(NAME_AFTER_ROLE_REGEX, (match) => match.split(/\s+/)[0])
    .replace(/\s{2,}/g, " ")
    .trim();

  if (cleaned.length < 20) return null;

  // Rejeitar observacoes individuais
  if (/\bchat\s*#?\s*\d+/i.test(cleaned)) return null;
  if (/\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/.test(cleaned)) return null;
  if (/\b(hoje|ontem|amanhã)\s+(o|a)\s+(paciente|cliente)/i.test(cleaned)) return null;
  if (/\butiliza\s+o\s+e-?mail\b/i.test(cleaned)) return null;
  if (/\breside\s+em\s+[A-Z]/i.test(cleaned)) return null;
  if (/\bmora\s+em\s+[A-Z]/i.test(cleaned)) return null;

  return cleaned;
}

// Mapeamento simplificado de tipos legados
const LEGACY_MAP: Record<string, MemoryType> = {
  insight_observador: "padrao_comportamental",
  preferencia_paciente: "padrao_comportamental",
  reacao_a_preco: "padrao_comportamental",
  perfil_paciente: "padrao_comportamental",
  dados_paciente: "padrao_comportamental",
  comportamento_paciente: "padrao_comportamental",
  regra_negocio: "regra_negocio",
  regra_atendimento: "regra_negocio",
  politica_preco: "regra_negocio",
  politica_clinica: "regra_negocio",
  valor_consulta: "regra_negocio",
  tabela_precos: "regra_negocio",
  reajuste_preco: "regra_negocio",
  escala_medica: "recurso_equipe",
  disponibilidade_medica: "recurso_equipe",
  horario_medico: "recurso_equipe",
  corpo_clinico: "recurso_equipe",
  processo_interno: "processo_operacional",
  processo_clinica: "processo_operacional",
  fluxo_agendamento: "processo_operacional",
  fluxo_atendimento: "processo_operacional",
  historico_clinico: "conhecimento_medico",
  condicao_saude: "conhecimento_medico",
  diagnostico_paciente: "conhecimento_medico",
  falha_processo: "feedback_melhoria",
  falha_operacional: "feedback_melhoria",
  gargalo_operacional: "feedback_melhoria",
  erro_operacional: "feedback_melhoria",
};

function mapType(oldType: string): MemoryType {
  const normalized = oldType.toLowerCase().trim().replace(/-/g, "_");
  if ((MEMORY_TYPES as readonly string[]).includes(normalized)) return normalized as MemoryType;
  return LEGACY_MAP[normalized] ?? "padrao_comportamental";
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 5: APPLY
// ═══════════════════════════════════════════════════════════════════════════

async function applyChanges(
  toDelete: number[],
  toInsert: ConsolidatedMemory[]
): Promise<void> {
  if (DRY_RUN) {
    console.log(`[DRY RUN] Deletaria ${toDelete.length} memórias`);
    console.log(`[DRY RUN] Inseriria ${toInsert.length} memórias consolidadas`);
    return;
  }

  // Delete em batches de 50
  for (let i = 0; i < toDelete.length; i += 50) {
    const batch = toDelete.slice(i, i + 50);
    const { error } = await supabase
      .from("clara_memories")
      .delete()
      .in("id", batch);
    if (error) console.error(`[Delete] Erro no batch ${i}:`, error.message);
  }
  console.log(`[Delete] ${toDelete.length} memórias removidas`);

  // Insert com embeddings
  let insertCount = 0;
  for (const mem of toInsert) {
    try {
      const embedding = await embedText(mem.content);
      const { error } = await supabase
        .from("clara_memories")
        .insert({
          memory_type: mem.memory_type,
          content: mem.content,
          embedding,
          source_role: "consolidation",
          updated_at: new Date().toISOString(),
        });
      if (error) {
        console.error(`[Insert] Erro:`, error.message);
      } else {
        insertCount++;
      }
      await sleep(200); // Rate limit
    } catch (err) {
      console.error(`[Insert] Erro:`, err instanceof Error ? err.message : err);
    }
  }
  console.log(`[Insert] ${insertCount} memórias consolidadas inseridas`);
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 6: REGENERAR VAULT
// ═══════════════════════════════════════════════════════════════════════════

async function regenerateVault(): Promise<void> {
  if (DRY_RUN) {
    console.log(`[DRY RUN] Regeneraria o vault de memórias`);
    return;
  }

  const vaultMemDir = path.join(process.cwd(), "clinica-vault", "memories");

  // Limpar pasta de memórias
  try {
    await fs.rm(vaultMemDir, { recursive: true, force: true });
    await fs.mkdir(vaultMemDir, { recursive: true });
    console.log("[Vault] Pasta memories/ limpa");
  } catch {
    console.warn("[Vault] Não conseguiu limpar pasta memories/");
  }

  // Buscar todas as memórias atuais do banco
  const { data: currentMemories, error } = await supabase
    .from("clara_memories")
    .select("id, memory_type, content, source_role")
    .order("created_at", { ascending: true });

  if (error || !currentMemories) {
    console.error("[Vault] Erro ao buscar memórias:", error?.message);
    return;
  }

  // Regenerar arquivos do vault
  const matter = await import("gray-matter");
  for (const mem of currentMemories as Array<{ id: number; memory_type: string; content: string; source_role: string }>) {
    const typeFolder = slugify(mem.memory_type.replace(/_/g, "-"));
    const contentSlug = slugify(mem.content.slice(0, 80));
    const relativePath = `${typeFolder}/${contentSlug}.md`;
    const absPath = path.join(vaultMemDir, relativePath);

    await fs.mkdir(path.dirname(absPath), { recursive: true });

    const output = matter.default.stringify(mem.content, {
      type: "memory",
      memory_type: mem.memory_type,
      source_role: mem.source_role,
      supabase_id: mem.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tags: [],
      agent_source: "clara",
    });

    await fs.writeFile(absPath, output, "utf-8");
  }

  console.log(`[Vault] ${(currentMemories as Array<unknown>).length} memórias regeneradas no vault`);
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  CLEANUP DE MEMÓRIAS DA CLARA ${DRY_RUN ? "(DRY RUN)" : ""}`);
  console.log(`${"═".repeat(60)}\n`);

  // 1. Buscar todas as memórias
  const { data: allMemories, error } = await supabase
    .from("clara_memories")
    .select("id, memory_type, content, embedding, source_role, created_at, updated_at")
    .order("created_at", { ascending: true });

  if (error || !allMemories) {
    console.error("Erro ao buscar memórias:", error?.message);
    process.exit(1);
  }

  const memories = allMemories as MemoryRecord[];
  console.log(`[1/6] Total de memórias: ${memories.length}`);

  // 2. Backup
  await backupMemories(memories);

  // 3. Gerar embeddings faltantes
  let embeddingCount = 0;
  for (const mem of memories) {
    if (!mem.embedding || (Array.isArray(mem.embedding) && mem.embedding.length === 0)) {
      try {
        mem.embedding = await embedText(mem.content);
        embeddingCount++;
        if (embeddingCount % 10 === 0) console.log(`  Gerando embeddings... ${embeddingCount}`);
        await sleep(150);
      } catch {
        console.warn(`  Falha ao gerar embedding para memória #${mem.id}`);
      }
    }
  }
  if (embeddingCount > 0) console.log(`[2/6] ${embeddingCount} embeddings gerados`);

  // 4. Clustering
  const clusters = buildClusters(memories, 0.75);
  const multiClusters = clusters.filter((c) => c.length > 1);
  const singletons = clusters.filter((c) => c.length === 1).map((c) => c[0]);
  console.log(`[3/6] ${clusters.length} clusters (${multiClusters.length} multi, ${singletons.length} singletons)`);

  // 5. Consolidar clusters via LLM
  const allConsolidated: ConsolidatedMemory[] = [];
  const allToDelete: number[] = [];

  console.log(`[4/6] Consolidando ${multiClusters.length} clusters via LLM...`);
  for (let i = 0; i < multiClusters.length; i++) {
    const cluster = multiClusters[i];
    const consolidated = await consolidateCluster(cluster);

    // IDs antigos para deletar
    for (const mem of cluster) allToDelete.push(mem.id);

    // Novos consolidados
    for (const c of consolidated) allConsolidated.push(c);

    if ((i + 1) % 10 === 0 || i === multiClusters.length - 1) {
      console.log(`  Clusters processados: ${i + 1}/${multiClusters.length} → ${allConsolidated.length} consolidados`);
    }

    await sleep(300); // Rate limit
  }

  // 6. Filtrar singletons pelo quality gate
  let singletonKept = 0;
  let singletonDiscarded = 0;
  for (const mem of singletons) {
    const cleaned = cleanContent(mem.content);
    if (cleaned) {
      allConsolidated.push({
        memory_type: mapType(mem.memory_type),
        content: cleaned,
      });
      singletonKept++;
    } else {
      singletonDiscarded++;
    }
    allToDelete.push(mem.id); // Deletar de qualquer forma (re-inserir limpo ou descartar)
  }
  console.log(`[5/6] Singletons: ${singletonKept} mantidos, ${singletonDiscarded} descartados`);

  // 7. Aplicar mudanças
  console.log(`\n${"─".repeat(40)}`);
  console.log(`RESUMO:`);
  console.log(`  Original: ${memories.length}`);
  console.log(`  Clusters multi: ${multiClusters.length} (${multiClusters.reduce((s, c) => s + c.length, 0)} memórias)`);
  console.log(`  Singletons mantidos: ${singletonKept}`);
  console.log(`  Total descartado: ${memories.length - allConsolidated.length}`);
  console.log(`  Final: ${allConsolidated.length} memórias limpas`);

  // Distribuição por tipo
  const typeDist: Record<string, number> = {};
  for (const m of allConsolidated) {
    typeDist[m.memory_type] = (typeDist[m.memory_type] || 0) + 1;
  }
  console.log(`\nDistribuição por tipo:`);
  for (const [type, count] of Object.entries(typeDist).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${type}: ${count}`);
  }
  console.log(`${"─".repeat(40)}\n`);

  await applyChanges(allToDelete, allConsolidated);

  // 8. Regenerar vault
  console.log(`[6/6] Regenerando vault...`);
  await regenerateVault();

  console.log(`\n✅ Cleanup concluído! ${DRY_RUN ? "(DRY RUN — nenhuma alteração feita)" : ""}`);
}

main().catch((err) => {
  console.error("Erro fatal:", err);
  process.exit(1);
});
