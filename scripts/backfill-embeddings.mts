/**
 * Backfill de Embeddings — gera embeddings para memórias que não têm ainda.
 *
 * DEVE rodar ANTES de usar o memory-index pela primeira vez.
 * Os embeddings ficam em clinica-vault/.memory-index.json, não nos .md.
 *
 * Uso: npx tsx --env-file=.env.local scripts/backfill-embeddings.mts
 * Flags: --force  (regenera todos, mesmo os que já têm embedding)
 */
import "dotenv/config";
import { GoogleGenAI } from "@google/genai";
import fs from "node:fs/promises";
import path from "node:path";
const EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_DIMS = 768;

const VAULT_DIR = path.join(process.cwd(), "clinica-vault");
const MEMORIES_DIR = path.join(VAULT_DIR, "memories");
const INDEX_FILE = path.join(VAULT_DIR, ".memory-index.json");
const FORCE = process.argv.includes("--force");

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY! });

interface IndexFile {
  version: number;
  built_at: string;
  entries: Array<{
    slug: string;
    path: string;
    content: string;
    memory_type: string;
    quality_score: number;
    connections: Array<{ slug: string; strength: string }>;
    updated_at: string;
  }>;
  embeddings: Record<string, number[]>;
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function embedText(text: string): Promise<number[] | null> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await ai.models.embedContent({
        model: EMBEDDING_MODEL,
        contents: text,
        config: { outputDimensionality: EMBEDDING_DIMS },
      });
      return response.embeddings?.[0]?.values ?? null;
    } catch {
      if (attempt === 3) return null;
      await sleep(1000 * Math.pow(3, attempt - 1));
    }
  }
  return null;
}

function parseFrontmatterSimple(raw: string): { type?: string; memory_type?: string; quality_score?: number; connections?: unknown[]; updated_at?: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const fm: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const m = line.match(/^(\w[\w_-]*):\s*(.*)$/);
    if (m) fm[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, "");
  }
  return {
    type: fm.type,
    memory_type: fm.memory_type,
    quality_score: fm.quality_score ? Number(fm.quality_score) : undefined,
    updated_at: fm.updated_at,
  };
}

function getBody(raw: string): string {
  const parts = raw.split(/^---\r?\n/m);
  if (parts.length >= 3) return parts.slice(2).join("---\n").trim();
  return raw.trim();
}

function pathToSlug(absPath: string): string {
  const rel = path.relative(MEMORIES_DIR, absPath).replace(/\\/g, "/");
  return rel.replace(/\.md$/, "");
}

async function collectMdFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  async function walk(d: string) {
    const entries = await fs.readdir(d, { withFileTypes: true }).catch(() => []);
    for (const e of entries) {
      if (e.isDirectory()) { await walk(path.join(d, e.name)); continue; }
      if (e.name.endsWith(".md") && !e.name.startsWith("_")) {
        files.push(path.join(d, e.name));
      }
    }
  }
  await walk(dir);
  return files;
}

async function main() {
  console.log("\n" + "═".repeat(60));
  console.log(`  BACKFILL DE EMBEDDINGS${FORCE ? " (--force)" : ""}`);
  console.log("═".repeat(60) + "\n");

  // Carregar índice existente
  let index: IndexFile = { version: 1, built_at: new Date().toISOString(), entries: [], embeddings: {} };
  try {
    const raw = await fs.readFile(INDEX_FILE, "utf-8");
    index = JSON.parse(raw);
    console.log(`[1/4] Índice existente: ${index.entries.length} entries, ${Object.keys(index.embeddings).length} embeddings`);
  } catch {
    console.log("[1/4] Índice não encontrado — será criado do zero");
  }

  // Coletar todos os .md
  const mdFiles = await collectMdFiles(MEMORIES_DIR);
  console.log(`[2/4] ${mdFiles.length} arquivos .md encontrados`);

  // Reconstruir entries a partir dos .md
  const newEntries: IndexFile["entries"] = [];
  const slugsSeen = new Set<string>();

  for (const filePath of mdFiles) {
    const raw = await fs.readFile(filePath, "utf-8");
    const fm = parseFrontmatterSimple(raw);
    if (fm.type !== "memory") continue;

    const slug = pathToSlug(filePath);
    if (slugsSeen.has(slug)) continue;
    slugsSeen.add(slug);

    const body = getBody(raw);
    if (!body || body.length < 10) continue;

    // Tentar preservar entry existente
    const existing = index.entries.find(e => e.slug === slug);
    newEntries.push({
      slug,
      path: filePath,
      content: body,
      memory_type: fm.memory_type || existing?.memory_type || "padrao_comportamental",
      quality_score: fm.quality_score ?? existing?.quality_score ?? 50,
      connections: existing?.connections || [],
      updated_at: fm.updated_at || existing?.updated_at || new Date().toISOString(),
    });
  }

  index.entries = newEntries;
  console.log(`[3/4] ${newEntries.length} entries válidas`);

  // Gerar embeddings faltantes
  let generated = 0, failed = 0, skipped = 0;

  for (let i = 0; i < newEntries.length; i++) {
    const entry = newEntries[i];
    if (!FORCE && index.embeddings[entry.slug]) { skipped++; continue; }

    const emb = await embedText(entry.content);
    if (emb) {
      index.embeddings[entry.slug] = emb;
      generated++;
    } else {
      failed++;
      console.warn(`  ⚠️ Falha: ${entry.slug}`);
    }

    if ((generated + failed) % 25 === 0 && generated + failed > 0) {
      console.log(`  Progresso: ${generated + failed + skipped}/${newEntries.length} (${generated} gerados, ${failed} falhas, ${skipped} já tinham)`);
      // Salvar checkpoint a cada 25
      index.built_at = new Date().toISOString();
      await fs.writeFile(INDEX_FILE, JSON.stringify(index), "utf-8");
    }
    await sleep(150); // rate limit
  }

  // Remover embeddings de slugs que não existem mais
  for (const slug of Object.keys(index.embeddings)) {
    if (!slugsSeen.has(slug)) {
      delete index.embeddings[slug];
    }
  }

  // Salvar índice final
  index.built_at = new Date().toISOString();
  await fs.writeFile(INDEX_FILE, JSON.stringify(index), "utf-8");

  console.log(`\n[4/4] Índice salvo em: clinica-vault/.memory-index.json`);
  console.log(`✅ Concluído: ${generated} embeddings gerados, ${skipped} já existiam, ${failed} falhas`);
  console.log(`   Total com embedding: ${Object.keys(index.embeddings).length}/${newEntries.length}`);
}

main().catch(e => { console.error(e); process.exit(1); });
