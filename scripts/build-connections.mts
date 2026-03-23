/**
 * Build Connections — reconstrói todos os wikilinks do vault.
 *
 * Para cada memória, encontra as top-5 mais similares (threshold 0.75)
 * e escreve a seção connections no frontmatter + ## Relacionados no body.
 *
 * Uso: npx tsx --env-file=.env.local scripts/build-connections.mts
 * Flags: --dry-run (mostra conexões sem escrever)
 */
import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";

const VAULT_DIR = path.join(process.cwd(), "clinica-vault");
const MEMORIES_DIR = path.join(VAULT_DIR, "memories");
const INDEX_FILE = path.join(VAULT_DIR, ".memory-index.json");
const DRY_RUN = process.argv.includes("--dry-run");

interface IndexFile {
  version: number;
  built_at: string;
  entries: Array<{
    slug: string; path: string; content: string;
    memory_type: string; quality_score: number;
    connections: Array<{ slug: string; strength: string }>;
    updated_at: string;
  }>;
  embeddings: Record<string, number[]>;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length || a.length === 0) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]; magA += a[i] * a[i]; magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

async function main() {
  console.log("\n" + "═".repeat(60));
  console.log(`  BUILD CONNECTIONS${DRY_RUN ? " (DRY RUN)" : ""}`);
  console.log("═".repeat(60) + "\n");

  // Carregar índice
  let index: IndexFile;
  try {
    index = JSON.parse(await fs.readFile(INDEX_FILE, "utf-8"));
  } catch {
    console.error("❌ .memory-index.json não encontrado. Execute backfill-embeddings.mts primeiro.");
    process.exit(1);
  }

  const withEmbeddings = index.entries.filter(e => index.embeddings[e.slug]);
  console.log(`${withEmbeddings.length}/${index.entries.length} entries com embeddings`);

  let updated = 0;
  const THRESHOLD = 0.75;
  const MAX_CONNECTIONS = 5;

  for (const entry of withEmbeddings) {
    const emb = index.embeddings[entry.slug];

    // Calcular similaridade com todos os outros
    const candidates = withEmbeddings
      .filter(e => e.slug !== entry.slug)
      .map(e => ({ slug: e.slug, sim: cosineSimilarity(emb, index.embeddings[e.slug]) }))
      .filter(c => c.sim >= THRESHOLD)
      .sort((a, b) => b.sim - a.sim)
      .slice(0, MAX_CONNECTIONS);

    const connections = candidates.map(c => ({
      slug: c.slug,
      strength: c.sim >= 0.85 ? "forte" : "media",
    }));

    // Verificar se mudou (dedup: comparar slugs)
    const oldSlugs = new Set(entry.connections.map(c => c.slug));
    const newSlugs = new Set(connections.map(c => c.slug));
    const changed = oldSlugs.size !== newSlugs.size ||
      [...newSlugs].some(s => !oldSlugs.has(s));

    if (!changed) continue;

    entry.connections = connections;

    if (DRY_RUN) {
      console.log(`  ${entry.slug}: ${connections.length} conexões (${connections.filter(c => c.strength === "forte").length} fortes)`);
      continue;
    }

    // Reescrever o arquivo .md com as novas connections
    try {
      const raw = await fs.readFile(entry.path, "utf-8");
      const newContent = rebuildMdConnections(raw, connections);
      await fs.writeFile(entry.path, newContent, "utf-8");
      updated++;
    } catch (e) {
      console.warn(`  ⚠️ Falha ao reescrever ${entry.slug}: ${e instanceof Error ? e.message : e}`);
    }
  }

  if (!DRY_RUN) {
    // Salvar índice com connections atualizadas
    index.built_at = new Date().toISOString();
    await fs.writeFile(INDEX_FILE, JSON.stringify(index), "utf-8");
    console.log(`\n✅ ${updated} arquivos atualizados. Índice salvo.`);
  } else {
    console.log(`\n✅ DRY RUN concluído.`);
  }
}

function rebuildMdConnections(
  raw: string,
  connections: Array<{ slug: string; strength: string }>
): string {
  // Separar frontmatter do body
  const fmMatch = raw.match(/^(---\r?\n[\s\S]*?\r?\n---\r?\n?)([\s\S]*)$/);
  if (!fmMatch) return raw;

  let frontmatter = fmMatch[1];
  let body = fmMatch[2];

  // Remover connections antigas do frontmatter
  frontmatter = frontmatter.replace(/^connections:[\s\S]*?(?=^[a-z]|\n---)/m, "");

  // Adicionar connections novas antes do "---" final
  if (connections.length > 0) {
    const connYaml = "connections:\n" +
      connections.map(c => `  - slug: ${c.slug}\n    strength: ${c.strength}`).join("\n") + "\n";
    frontmatter = frontmatter.replace(/\n---\n?$/, "\n" + connYaml + "---\n");
  }

  // Remover seção ## Relacionados antiga do body
  body = body.replace(/\n\n## Relacionados[\s\S]*$/, "");

  // Adicionar seção ## Relacionados nova
  if (connections.length > 0) {
    const relSection = "\n\n## Relacionados\n" +
      connections.map(c => `- [[${c.slug}]] (${c.strength})`).join("\n");
    body = body.trimEnd() + relSection;
  }

  return frontmatter + body;
}

main().catch(e => { console.error(e); process.exit(1); });
