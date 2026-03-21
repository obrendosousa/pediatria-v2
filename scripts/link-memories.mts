/**
 * Cria relacionamentos entre memórias do vault via [[wiki-links]] do Obsidian.
 *
 * Estratégia:
 * 1. Cria MOCs (Map of Content) para cada categoria
 * 2. Usa pgvector para encontrar vizinhos semânticos de cada memória
 * 3. Adiciona seção "Relacionados" com [[links]] em cada arquivo
 * 4. Agrupa memórias por temas via LLM para criar notas de hub temático
 *
 * Uso: npx tsx --env-file=.env.local scripts/link-memories.mts
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";
import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY!,
});

const VAULT_MEM_DIR = path.join(process.cwd(), "clinica-vault", "memories");
const MAX_NEIGHBORS = 5;
const SIMILARITY_THRESHOLD = 0.72;

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 80);
}

function memoryToFilePath(mem: AnyRow): string {
  const typeFolder = slugify(mem.memory_type.replace(/_/g, "-"));
  const contentSlug = slugify(mem.content.slice(0, 80));
  return `${typeFolder}/${contentSlug}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const TYPE_LABELS: Record<string, string> = {
  padrao_comportamental: "Padroes Comportamentais",
  processo_operacional: "Processos Operacionais",
  regra_negocio: "Regras de Negocio",
  feedback_melhoria: "Feedback e Melhorias",
  conhecimento_medico: "Conhecimento Medico",
  protocolo_clinico: "Protocolos Clinicos",
  recurso_equipe: "Recursos e Equipe",
  preferencia_sistema: "Preferencias do Sistema",
};

// ═══════════════════════════════════════════════════════════════════════════
// STEP 1: BUSCAR TODAS AS MEMÓRIAS
// ═══════════════════════════════════════════════════════════════════════════

interface MemoryRecord {
  id: string;
  memory_type: string;
  content: string;
  source_role: string;
  created_at: string;
  filePath: string; // relative path without .md
}

async function fetchAllMemories(): Promise<MemoryRecord[]> {
  const { data, error } = await supabase
    .from("clara_memories")
    .select("id, memory_type, content, source_role, created_at")
    .order("created_at", { ascending: true });

  if (error || !data) {
    console.error("Erro ao buscar memórias:", error?.message);
    return [];
  }

  return (data as AnyRow[]).map((m) => ({
    ...m,
    filePath: memoryToFilePath(m),
  }));
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 2: ENCONTRAR VIZINHOS SEMÂNTICOS VIA PGVECTOR
// ═══════════════════════════════════════════════════════════════════════════

async function findNeighbors(
  memories: MemoryRecord[]
): Promise<Map<string, string[]>> {
  const neighborMap = new Map<string, string[]>();

  console.log(
    `[2/5] Buscando vizinhos semânticos para ${memories.length} memórias...`
  );

  // Buscar vizinhos em batches usando pgvector
  let processed = 0;
  for (const mem of memories) {
    const { data, error } = await supabase.rpc("match_clara_memories", {
      query_embedding: null,
      match_threshold: SIMILARITY_THRESHOLD,
      match_count: MAX_NEIGHBORS + 1,
      p_source_id: mem.id,
    });

    if (error) {
      // Fallback: buscar via SQL direto
      const { data: sqlData } = await supabase.rpc("execute_sql_query", {
        query_text: `
          SELECT m2.id, m2.memory_type, m2.content,
                 1 - (m1.embedding <=> m2.embedding) as similarity
          FROM clara_memories m1, clara_memories m2
          WHERE m1.id = '${mem.id}'
            AND m2.id != m1.id
            AND m1.embedding IS NOT NULL
            AND m2.embedding IS NOT NULL
          ORDER BY m1.embedding <=> m2.embedding
          LIMIT ${MAX_NEIGHBORS}
        `,
      });

      if (sqlData?.rows) {
        const neighbors = (sqlData.rows as AnyRow[])
          .filter(
            (r: AnyRow) => r.similarity >= SIMILARITY_THRESHOLD
          )
          .map((r: AnyRow) => {
            const found = memories.find((m) => m.id === r.id);
            return found?.filePath;
          })
          .filter(Boolean) as string[];
        neighborMap.set(mem.filePath, neighbors);
      }
    } else if (data) {
      const neighbors = (data as AnyRow[])
        .filter((r: AnyRow) => r.id !== mem.id)
        .slice(0, MAX_NEIGHBORS)
        .map((r: AnyRow) => {
          const found = memories.find((m) => m.id === r.id);
          return found?.filePath;
        })
        .filter(Boolean) as string[];
      neighborMap.set(mem.filePath, neighbors);
    }

    processed++;
    if (processed % 50 === 0) {
      console.log(`  Processados: ${processed}/${memories.length}`);
    }

    await sleep(50); // Rate limit
  }

  return neighborMap;
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 2-ALT: COMPUTAR VIZINHOS VIA EMBEDDING LOCAL (sem rpc)
// ═══════════════════════════════════════════════════════════════════════════

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0,
    normA = 0,
    normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function findNeighborsLocal(
  memories: MemoryRecord[]
): Promise<Map<string, string[]>> {
  console.log(`[2/5] Buscando embeddings do banco...`);

  const { data: embData, error } = await supabase
    .from("clara_memories")
    .select("id, embedding");

  if (error || !embData) {
    console.error("Erro ao buscar embeddings:", error?.message);
    return new Map();
  }

  // Mapear id → embedding
  const embMap = new Map<string, number[]>();
  for (const row of embData as AnyRow[]) {
    if (row.embedding) {
      // embedding pode vir como string JSON ou array
      const emb =
        typeof row.embedding === "string"
          ? JSON.parse(row.embedding)
          : row.embedding;
      embMap.set(row.id, emb);
    }
  }

  console.log(`  ${embMap.size} embeddings carregados`);
  console.log(`  Calculando similaridades...`);

  const neighborMap = new Map<string, string[]>();
  const memWithEmb = memories.filter((m) => embMap.has(m.id));

  for (let i = 0; i < memWithEmb.length; i++) {
    const mem = memWithEmb[i];
    const embA = embMap.get(mem.id)!;
    const scores: { filePath: string; sim: number }[] = [];

    for (let j = 0; j < memWithEmb.length; j++) {
      if (i === j) continue;
      const other = memWithEmb[j];
      const embB = embMap.get(other.id)!;
      const sim = cosineSimilarity(embA, embB);
      if (sim >= SIMILARITY_THRESHOLD) {
        scores.push({ filePath: other.filePath, sim });
      }
    }

    // Top N vizinhos
    scores.sort((a, b) => b.sim - a.sim);
    neighborMap.set(
      mem.filePath,
      scores.slice(0, MAX_NEIGHBORS).map((s) => s.filePath)
    );

    if ((i + 1) % 100 === 0) {
      console.log(`  Processados: ${i + 1}/${memWithEmb.length}`);
    }
  }

  return neighborMap;
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 3: DESCOBRIR TEMAS VIA LLM
// ═══════════════════════════════════════════════════════════════════════════

interface Theme {
  name: string;
  slug: string;
  description: string;
  memoryIds: string[]; // filePaths
}

async function discoverThemes(memories: MemoryRecord[]): Promise<Theme[]> {
  console.log(`[3/5] Descobrindo temas via LLM...`);

  // Agrupar memórias por tipo para contexto
  const byType = new Map<string, MemoryRecord[]>();
  for (const mem of memories) {
    const list = byType.get(mem.memory_type) || [];
    list.push(mem);
    byType.set(mem.memory_type, list);
  }

  const allThemes: Theme[] = [];

  // Processar em chunks para não estourar o context window
  const allContents = memories.map(
    (m, i) => `[${i}] (${m.memory_type}) ${m.content.slice(0, 150)}`
  );

  // Dividir em chunks de ~150 memórias
  const chunkSize = 150;
  for (let c = 0; c < allContents.length; c += chunkSize) {
    const chunk = allContents.slice(c, c + chunkSize);
    const chunkMems = memories.slice(c, c + chunkSize);

    const prompt = `Analise estas memórias de uma clínica pediátrica e identifique 5-10 TEMAS transversais que conectam memórias de diferentes categorias.

Memórias:
${chunk.join("\n")}

Para cada tema, indique os índices das memórias relevantes.
Temas devem ser conceitos unificadores como: "Precificação e Valores", "Fluxo de Agendamento", "Comunicação com Paciente", "Gestão de Agenda", etc.

Retorne JSON válido:
[{"name": "Nome do Tema", "description": "Descrição curta", "indices": [0, 3, 7, ...]}]

IMPORTANTE: Cada memória pode pertencer a mais de um tema. Retorne apenas temas com 3+ memórias.`;

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
      if (!text) continue;

      const themes = JSON.parse(text) as {
        name: string;
        description: string;
        indices: number[];
      }[];

      for (const theme of themes) {
        const slug = slugify(theme.name);
        const memIds = theme.indices
          .filter((i) => i < chunkMems.length)
          .map((i) => chunkMems[i].filePath);

        if (memIds.length >= 3) {
          // Verificar se tema similar já existe
          const existing = allThemes.find(
            (t) =>
              t.slug === slug ||
              t.name.toLowerCase() === theme.name.toLowerCase()
          );
          if (existing) {
            existing.memoryIds.push(...memIds);
          } else {
            allThemes.push({
              name: theme.name,
              slug,
              description: theme.description,
              memoryIds: memIds,
            });
          }
        }
      }

      console.log(
        `  Chunk ${Math.floor(c / chunkSize) + 1}: ${themes.length} temas`
      );
    } catch (err) {
      console.error(
        `  Erro no chunk ${Math.floor(c / chunkSize) + 1}:`,
        err instanceof Error ? err.message : err
      );
    }

    await sleep(1000);
  }

  // Deduplicar temas com nomes similares
  return allThemes;
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 4: REESCREVER ARQUIVOS COM LINKS
// ═══════════════════════════════════════════════════════════════════════════

async function rewriteVaultFiles(
  memories: MemoryRecord[],
  neighborMap: Map<string, string[]>,
  themes: Theme[]
): Promise<void> {
  console.log(`[4/5] Reescrevendo arquivos com links...`);

  // Criar mapa filePath → temas
  const fileThemes = new Map<string, string[]>();
  for (const theme of themes) {
    for (const fp of theme.memoryIds) {
      const list = fileThemes.get(fp) || [];
      list.push(theme.slug);
      fileThemes.set(fp, list);
    }
  }

  let written = 0;
  for (const mem of memories) {
    const absPath = path.join(VAULT_MEM_DIR, mem.filePath + ".md");

    try {
      const existingContent = await fs.readFile(absPath, "utf-8");
      const parsed = matter(existingContent);

      // Atualizar tags com temas
      const memThemes = fileThemes.get(mem.filePath) || [];
      parsed.data.tags = [
        ...new Set([
          ...(parsed.data.tags || []),
          mem.memory_type.replace(/_/g, "-"),
          ...memThemes,
        ]),
      ];

      // Construir seção de links
      const neighbors = neighborMap.get(mem.filePath) || [];
      const relatedThemes = themes.filter((t) =>
        t.memoryIds.includes(mem.filePath)
      );

      let linksSection = "";

      // Links para MOC da categoria
      const typeSlug = slugify(mem.memory_type.replace(/_/g, "-"));
      linksSection += `\n\n## Contexto\n`;
      linksSection += `- Categoria: [[_moc-${typeSlug}|${TYPE_LABELS[mem.memory_type] || mem.memory_type}]]\n`;

      // Links para temas
      if (relatedThemes.length > 0) {
        linksSection += `- Temas: ${relatedThemes.map((t) => `[[_tema-${t.slug}|${t.name}]]`).join(", ")}\n`;
      }

      // Links para vizinhos semânticos
      if (neighbors.length > 0) {
        linksSection += `\n## Relacionados\n`;
        for (const n of neighbors) {
          const nMem = memories.find((m) => m.filePath === n);
          if (nMem) {
            const label = nMem.content.slice(0, 80).replace(/\|/g, "-");
            linksSection += `- [[${n}|${label}]]\n`;
          }
        }
      }

      // Reescrever arquivo
      const output = matter.stringify(
        parsed.content.trim() + linksSection,
        parsed.data
      );
      await fs.writeFile(absPath, output, "utf-8");
      written++;
    } catch {
      // Arquivo pode não existir se slug mudou
    }

    if (written % 100 === 0 && written > 0) {
      console.log(`  Escritos: ${written}`);
    }
  }

  console.log(`  Total: ${written} arquivos atualizados`);
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 5: CRIAR MOCs E NOTAS DE TEMA
// ═══════════════════════════════════════════════════════════════════════════

async function createMOCsAndThemes(
  memories: MemoryRecord[],
  themes: Theme[]
): Promise<void> {
  console.log(`[5/5] Criando MOCs e notas de tema...`);

  // MOC por categoria
  const byType = new Map<string, MemoryRecord[]>();
  for (const mem of memories) {
    const list = byType.get(mem.memory_type) || [];
    list.push(mem);
    byType.set(mem.memory_type, list);
  }

  for (const [type, mems] of byType) {
    const typeSlug = slugify(type.replace(/_/g, "-"));
    const label = TYPE_LABELS[type] || type;

    let content = `# ${label}\n\n`;
    content += `> MOC (Map of Content) — ${mems.length} memorias\n\n`;

    // Agrupar por temas dentro da categoria
    const relevantThemes = themes.filter((t) =>
      t.memoryIds.some((fp) => mems.some((m) => m.filePath === fp))
    );

    if (relevantThemes.length > 0) {
      content += `## Temas Relacionados\n`;
      for (const t of relevantThemes) {
        content += `- [[_tema-${t.slug}|${t.name}]]\n`;
      }
      content += `\n`;
    }

    content += `## Memorias\n`;
    for (const m of mems) {
      const label2 = m.content.slice(0, 100).replace(/\|/g, "-");
      content += `- [[${m.filePath}|${label2}]]\n`;
    }

    // Links para outros MOCs
    content += `\n## Outras Categorias\n`;
    for (const [otherType] of byType) {
      if (otherType === type) continue;
      const otherSlug = slugify(otherType.replace(/_/g, "-"));
      const otherLabel = TYPE_LABELS[otherType] || otherType;
      content += `- [[_moc-${otherSlug}|${otherLabel}]]\n`;
    }

    const mocPath = path.join(VAULT_MEM_DIR, `_moc-${typeSlug}.md`);
    const mocData = {
      type: "moc",
      memory_type: type,
      count: mems.length,
      tags: ["moc", type.replace(/_/g, "-")],
    };
    await fs.writeFile(mocPath, matter.stringify(content, mocData), "utf-8");
  }

  console.log(`  ${byType.size} MOCs criados`);

  // Notas de tema
  for (const theme of themes) {
    let content = `# ${theme.name}\n\n`;
    content += `> ${theme.description}\n\n`;

    // Agrupar memórias do tema por categoria
    const byTypeInTheme = new Map<string, string[]>();
    for (const fp of theme.memoryIds) {
      const mem = memories.find((m) => m.filePath === fp);
      if (!mem) continue;
      const list = byTypeInTheme.get(mem.memory_type) || [];
      list.push(fp);
      byTypeInTheme.set(mem.memory_type, list);
    }

    for (const [type, fps] of byTypeInTheme) {
      const typeSlug = slugify(type.replace(/_/g, "-"));
      content += `## ${TYPE_LABELS[type] || type} ([[_moc-${typeSlug}|MOC]])\n`;
      for (const fp of fps) {
        const mem = memories.find((m) => m.filePath === fp);
        if (!mem) continue;
        const label = mem.content.slice(0, 100).replace(/\|/g, "-");
        content += `- [[${fp}|${label}]]\n`;
      }
      content += `\n`;
    }

    // Links para outros temas
    const relatedThemes = themes.filter(
      (t) =>
        t.slug !== theme.slug &&
        t.memoryIds.some((fp) => theme.memoryIds.includes(fp))
    );
    if (relatedThemes.length > 0) {
      content += `## Temas Relacionados\n`;
      for (const t of relatedThemes) {
        content += `- [[_tema-${t.slug}|${t.name}]]\n`;
      }
    }

    const themePath = path.join(VAULT_MEM_DIR, `_tema-${theme.slug}.md`);
    const themeData = {
      type: "theme",
      theme: theme.name,
      count: theme.memoryIds.length,
      tags: ["tema", theme.slug],
    };
    await fs.writeFile(
      themePath,
      matter.stringify(content, themeData),
      "utf-8"
    );
  }

  console.log(`  ${themes.length} notas de tema criadas`);

  // Criar nota INDEX principal
  let indexContent = `# Memoria da Clara\n\n`;
  indexContent += `> Base de conhecimento consolidada — ${memories.length} memorias em ${byType.size} categorias\n\n`;

  indexContent += `## Categorias\n`;
  for (const [type, mems] of byType) {
    const typeSlug = slugify(type.replace(/_/g, "-"));
    const label = TYPE_LABELS[type] || type;
    indexContent += `- [[_moc-${typeSlug}|${label}]] (${mems.length})\n`;
  }

  indexContent += `\n## Temas Transversais\n`;
  for (const theme of themes.sort((a, b) => b.memoryIds.length - a.memoryIds.length)) {
    indexContent += `- [[_tema-${theme.slug}|${theme.name}]] (${theme.memoryIds.length} memorias)\n`;
  }

  const indexPath = path.join(VAULT_MEM_DIR, `_index.md`);
  const indexData = {
    type: "index",
    count: memories.length,
    categories: byType.size,
    themes: themes.length,
    tags: ["index"],
  };
  await fs.writeFile(
    indexPath,
    matter.stringify(indexContent, indexData),
    "utf-8"
  );
  console.log(`  Index principal criado`);
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  LINKAGEM DE MEMORIAS DO VAULT`);
  console.log(`${"═".repeat(60)}\n`);

  // 1. Buscar memórias
  console.log(`[1/5] Buscando memórias...`);
  const memories = await fetchAllMemories();
  console.log(`  ${memories.length} memórias encontradas`);

  if (memories.length === 0) {
    console.log("Nenhuma memória encontrada.");
    return;
  }

  // 2. Encontrar vizinhos semânticos (computação local)
  const neighborMap = await findNeighborsLocal(memories);
  const withNeighbors = [...neighborMap.values()].filter(
    (n) => n.length > 0
  ).length;
  console.log(
    `  ${withNeighbors} memórias com vizinhos (threshold ${SIMILARITY_THRESHOLD})`
  );

  // 3. Descobrir temas via LLM
  const themes = await discoverThemes(memories);
  console.log(
    `  ${themes.length} temas descobertos`
  );

  // 4. Reescrever arquivos com links
  await rewriteVaultFiles(memories, neighborMap, themes);

  // 5. Criar MOCs e notas de tema
  await createMOCsAndThemes(memories, themes);

  console.log(`\n${"─".repeat(40)}`);
  console.log(`RESUMO:`);
  console.log(`  Memórias: ${memories.length}`);
  console.log(`  Com vizinhos semânticos: ${withNeighbors}`);
  console.log(`  Temas transversais: ${themes.length}`);
  console.log(
    `  Total de links criados: ~${withNeighbors * MAX_NEIGHBORS + themes.reduce((sum, t) => sum + t.memoryIds.length, 0)}`
  );
  console.log(`${"─".repeat(40)}\n`);

  console.log(`✅ Linkagem concluída!`);
}

main().catch(console.error);
