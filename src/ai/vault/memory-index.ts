/**
 * Memory Index — Singleton para busca local de memórias da Clara.
 *
 * Arquitetura:
 * - Embeddings ficam em clinica-vault/.memory-index.json (NÃO no frontmatter dos .md)
 * - Busca: cosine similarity local, <30ms para 2000 arquivos
 * - Grafo: expande wikilinks strength='forte' dos seeds (1 hop)
 * - Slug: path relativo dentro de memories/, sem extensão .md
 *   Ex: "regra_negocio/consulta-pediatrica-custa-r500"
 */
import fs from "node:fs/promises";
import path from "node:path";
import { RERANK_SIMILARITY_WEIGHT, RERANK_QUALITY_WEIGHT, RERANK_RECENCY_WEIGHT } from "@/ai/clara/constants";

// ── Constantes ───────────────────────────────────────────────────────────────

const VAULT_DIR = path.join(process.cwd(), "clinica-vault");
const MEMORIES_DIR = path.join(VAULT_DIR, "memories");
const INDEX_FILE = path.join(VAULT_DIR, ".memory-index.json");

// ── Tipos Exportados ─────────────────────────────────────────────────────────

export interface MemoryConnection {
  /** Slug do vizinho: path relativo dentro de memories/ sem .md */
  slug: string;
  strength: "forte" | "media";
}

export interface MemoryEntry {
  /** Path relativo dentro de memories/, sem extensão .md
   *  Ex: "regra_negocio/consulta-pediatrica-custa-r500" */
  slug: string;
  /** Path absoluto do arquivo .md no sistema de arquivos */
  path: string;
  content: string;
  memory_type: string;
  quality_score: number;
  connections: MemoryConnection[];
  updated_at: string;
}

export interface SearchResult {
  entry: MemoryEntry;
  similarity: number;
  finalScore: number;
}

// ── Formato do arquivo .memory-index.json ────────────────────────────────────

interface IndexFile {
  version: number;
  built_at: string;
  entries: MemoryEntry[];
  /** slug → embedding (768 floats) */
  embeddings: Record<string, number[]>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length || a.length === 0) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

function parseFrontmatter(raw: string): { frontmatter: Record<string, unknown>; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: raw };
  try {
    // Parse manual simples para evitar dependência de yaml em runtime
    const fm: Record<string, unknown> = {};
    const lines = match[1].split(/\r?\n/);
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      const kvMatch = line.match(/^(\w[\w_-]*):\s*(.*)$/);
      if (!kvMatch) { i++; continue; }
      const key = kvMatch[1];
      const val = kvMatch[2].trim();
      // Array inline: [a, b, c]
      if (val.startsWith("[") && val.endsWith("]")) {
        try { fm[key] = JSON.parse(val); } catch { fm[key] = val; }
        i++;
        continue;
      }
      // Array multiline: next lines start with "  - "
      if (val === "" && i + 1 < lines.length && lines[i + 1].match(/^\s+-\s/)) {
        const items: Record<string, unknown>[] = [];
        i++;
        while (i < lines.length && lines[i].match(/^\s+-\s/)) {
          const itemLine = lines[i].replace(/^\s+-\s*/, "").trim();
          // objeto inline: "key: value"
          const obj: Record<string, unknown> = {};
          // parse sub-object if next lines are indented deeper
          obj["_raw"] = itemLine;
          // Try to parse "slug: value" style
          const slugMatch = itemLine.match(/^slug:\s*(.+)$/);
          if (slugMatch) { obj["slug"] = slugMatch[1]; i++; continue; }
          // Check if next line has strength
          if (i + 1 < lines.length) {
            const nextLine = lines[i + 1].trim();
            if (nextLine.startsWith("slug:") || nextLine.startsWith("strength:")) {
              // Multi-line object item
              const item: Record<string, string> = {};
              while (i < lines.length && !lines[i].match(/^\s*-\s(?!\s)/)) {
                const pl = lines[i].trim();
                if (pl.startsWith("- ")) {
                  const rest = pl.slice(2);
                  const [k, v] = rest.split(":").map(s => s.trim());
                  if (k && v) item[k] = v;
                } else {
                  const [k, v] = pl.split(":").map(s => s.trim());
                  if (k && v) item[k] = v;
                }
                i++;
                if (i < lines.length && lines[i].match(/^\s*-\s/) && !lines[i].match(/^\s{4,}-\s/)) break;
              }
              items.push(item);
              continue;
            }
          }
          items.push({ value: itemLine });
          i++;
        }
        fm[key] = items;
        continue;
      }
      // String simples
      fm[key] = val.replace(/^['"]|['"]$/g, "");
      i++;
    }
    return { frontmatter: fm, body: match[2].trim() };
  } catch {
    return { frontmatter: {}, body: raw };
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────

export class MemoryIndex {
  private static _instance: MemoryIndex | null = null;

  private entries: MemoryEntry[] = [];
  private embeddings: Record<string, number[]> = {};
  private loaded = false;
  private loading: Promise<void> | null = null;

  static getInstance(): MemoryIndex {
    if (!MemoryIndex._instance) {
      MemoryIndex._instance = new MemoryIndex();
    }
    return MemoryIndex._instance;
  }

  // ── Carregamento ──────────────────────────────────────────────────────────

  async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    if (this.loading) return this.loading;
    this.loading = this._load().finally(() => { this.loading = null; });
    return this.loading;
  }

  private async _load(): Promise<void> {
    try {
      const raw = await fs.readFile(INDEX_FILE, "utf-8");
      const idx: IndexFile = JSON.parse(raw);
      if (idx.version === 1 && Array.isArray(idx.entries)) {
        this.entries = idx.entries;
        this.embeddings = idx.embeddings || {};
        this.loaded = true;
        return;
      }
    } catch {
      // Index não existe ainda — rebuild
    }
    // Fallback: scanear .md sem embeddings
    await this._scanMdFiles();
    this.loaded = true;
  }

  /** Escaneia os .md e carrega entries sem embeddings (usado quando .memory-index.json não existe) */
  private async _scanMdFiles(): Promise<void> {
    this.entries = [];
    await this._walkDir(MEMORIES_DIR);
  }

  private async _walkDir(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const e of entries) {
      const fullPath = path.join(dir, e.name);
      if (e.isDirectory()) { await this._walkDir(fullPath); continue; }
      if (!e.name.endsWith(".md") || e.name.startsWith("_")) continue;
      await this._loadMdFile(fullPath);
    }
  }

  private async _loadMdFile(absPath: string): Promise<void> {
    try {
      const raw = await fs.readFile(absPath, "utf-8");
      const { frontmatter, body } = parseFrontmatter(raw);
      if (frontmatter.type !== "memory") return;

      const slug = this._pathToSlug(absPath);
      const connections = this._parseConnections(frontmatter.connections);

      this.entries.push({
        slug,
        path: absPath,
        content: body,
        memory_type: String(frontmatter.memory_type || "padrao_comportamental"),
        quality_score: Number(frontmatter.quality_score ?? 50),
        connections,
        updated_at: String(frontmatter.updated_at || new Date().toISOString()),
      });
    } catch { /* arquivo com problema — pular */ }
  }

  private _pathToSlug(absPath: string): string {
    const rel = path.relative(MEMORIES_DIR, absPath).replace(/\\/g, "/");
    return rel.replace(/\.md$/, "");
  }

  private _slugToPath(slug: string): string {
    return path.join(MEMORIES_DIR, slug + ".md");
  }

  private _parseConnections(raw: unknown): MemoryConnection[] {
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((c): c is Record<string, string> => typeof c === "object" && c !== null)
      .map(c => ({
        slug: String(c.slug || c._raw || ""),
        strength: (c.strength === "forte" || c.strength === "media") ? c.strength as "forte" | "media" : "media" as const,
      }))
      .filter(c => c.slug.length > 0);
  }

  // ── Busca ─────────────────────────────────────────────────────────────────

  search(queryEmbedding: number[], topK: number = 3): SearchResult[] {
    if (!this.loaded || this.entries.length === 0) return [];

    const now = Date.now();
    const results: SearchResult[] = [];

    for (const entry of this.entries) {
      const emb = this.embeddings[entry.slug];
      if (!emb) continue;

      const similarity = cosineSimilarity(queryEmbedding, emb);
      if (similarity < 0.50) continue; // pre-filtro

      const ageDays = (now - new Date(entry.updated_at).getTime()) / 86_400_000;
      const recencyScore = Math.max(0, 1 - ageDays / 365);
      const qualityNorm = entry.quality_score / 100;

      const finalScore =
        RERANK_SIMILARITY_WEIGHT * similarity +
        RERANK_QUALITY_WEIGHT * qualityNorm +
        RERANK_RECENCY_WEIGHT * recencyScore;

      results.push({ entry, similarity, finalScore });
    }

    return results
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, topK);
  }

  // ── Expansão de Grafo ─────────────────────────────────────────────────────

  graphExpand(seedSlugs: string[], maxTotal: number = 8): MemoryEntry[] {
    const entryMap = new Map(this.entries.map(e => [e.slug, e]));
    const visited = new Set<string>(seedSlugs);
    const result: MemoryEntry[] = [];

    // Adicionar seeds primeiro
    for (const slug of seedSlugs) {
      const entry = entryMap.get(slug);
      if (entry) result.push(entry);
    }

    // Expandir vizinhos fortes (1 hop)
    for (const slug of seedSlugs) {
      if (result.length >= maxTotal) break;
      const entry = entryMap.get(slug);
      if (!entry) continue;

      for (const conn of entry.connections) {
        if (conn.strength !== "forte") continue;
        if (visited.has(conn.slug)) continue;
        visited.add(conn.slug);

        const neighbor = entryMap.get(conn.slug);
        if (neighbor) {
          result.push(neighbor);
          if (result.length >= maxTotal) break;
        }
      }
    }

    return result;
  }

  // ── Escrita ───────────────────────────────────────────────────────────────

  /**
   * Salva uma nova memória no vault e atualiza o índice.
   * Retorna o slug da memória salva.
   */
  async saveEntry(
    data: {
      content: string;
      memory_type: string;
      quality_score: number;
      source_role: string;
      folder?: string; // subpasta dentro de memories/ (default: memory_type)
    },
    embedding: number[]
  ): Promise<string> {
    await this.ensureLoaded();

    const folder = data.folder || data.memory_type;
    const slugName = slugify(data.content.slice(0, 80));
    let slug = `${folder}/${slugName}`;

    // Proteção contra colisão de slug (conteúdo diferente, mesmo slug gerado)
    if (this.entries.some(e => e.slug === slug)) {
      slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
    }

    // Dedup: verifica se existe entrada com similarity >= 0.80
    const existing = this._findDuplicate(embedding, 0.80);
    if (existing) {
      if (data.quality_score >= existing.entry.quality_score) {
        await this.updateEntry(existing.entry.slug, {
          content: data.content,
          memory_type: data.memory_type,
          quality_score: data.quality_score,
          updated_at: new Date().toISOString(),
        }, embedding);
        return existing.entry.slug;
      }
      return existing.entry.slug; // existente já é melhor
    }

    // Calcular connections com threshold 0.75
    const connections = this._calculateConnections(embedding, 0.75, slug);

    const entry: MemoryEntry = {
      slug,
      path: this._slugToPath(slug),
      content: data.content,
      memory_type: data.memory_type,
      quality_score: data.quality_score,
      connections,
      updated_at: new Date().toISOString(),
    };

    // Escrever arquivo .md
    await this._writeMdFile(entry, data.source_role);

    // Atualizar índice em memória
    this.entries.push(entry);
    this.embeddings[slug] = embedding;

    // Persistir índice
    await this._persistIndex();

    return slug;
  }

  async updateEntry(slug: string, patch: Partial<MemoryEntry>, embedding?: number[]): Promise<void> {
    const idx = this.entries.findIndex(e => e.slug === slug);
    if (idx < 0) return;

    const updated: MemoryEntry = {
      ...this.entries[idx],
      ...patch,
      slug, // nunca muda o slug
      path: this.entries[idx].path,
      updated_at: new Date().toISOString(),
    };
    this.entries[idx] = updated;
    if (embedding) this.embeddings[slug] = embedding;

    await this._writeMdFile(updated, "system");
    await this._persistIndex();
  }

  private _findDuplicate(embedding: number[], threshold: number): SearchResult | null {
    const results = this.search(embedding, 1);
    if (results.length > 0 && results[0].similarity >= threshold) return results[0];
    return null;
  }

  private _calculateConnections(embedding: number[], threshold: number, excludeSlug: string): MemoryConnection[] {
    const candidates: Array<{ slug: string; sim: number }> = [];

    for (const entry of this.entries) {
      if (entry.slug === excludeSlug) continue;
      const emb = this.embeddings[entry.slug];
      if (!emb) continue;
      const sim = cosineSimilarity(embedding, emb);
      if (sim >= threshold) candidates.push({ slug: entry.slug, sim });
    }

    return candidates
      .sort((a, b) => b.sim - a.sim)
      .slice(0, 5)
      .map(c => ({
        slug: c.slug,
        strength: c.sim >= 0.85 ? "forte" : "media",
      }));
  }

  private async _writeMdFile(entry: MemoryEntry, source_role: string): Promise<void> {
    await fs.mkdir(path.dirname(entry.path), { recursive: true });

    const frontmatterLines = [
      "---",
      `type: memory`,
      `memory_type: ${entry.memory_type}`,
      `quality_score: ${entry.quality_score}`,
      `source_role: ${source_role}`,
      `updated_at: '${entry.updated_at}'`,
    ];

    if (entry.connections.length > 0) {
      frontmatterLines.push("connections:");
      for (const c of entry.connections) {
        frontmatterLines.push(`  - slug: ${c.slug}`);
        frontmatterLines.push(`    strength: ${c.strength}`);
      }
    }

    frontmatterLines.push("---");
    frontmatterLines.push("");

    // Seção Relacionados em Markdown para Obsidian (wikilinks legíveis)
    const related = entry.connections.length > 0
      ? "\n\n## Relacionados\n" + entry.connections.map(
          c => `- [[${c.slug}]] (${c.strength})`
        ).join("\n")
      : "";

    const fileContent = frontmatterLines.join("\n") + entry.content + related;
    await fs.writeFile(entry.path, fileContent, "utf-8");
  }

  // ── Persistência do índice ────────────────────────────────────────────────

  private async _persistIndex(): Promise<void> {
    const indexData: IndexFile = {
      version: 1,
      built_at: new Date().toISOString(),
      entries: this.entries,
      embeddings: this.embeddings,
    };
    await fs.writeFile(INDEX_FILE, JSON.stringify(indexData), "utf-8");
  }

  /** Reconstrói o índice completo a partir dos .md existentes.
   *  Embeddings existentes são preservados, novos arquivos ficam sem embedding
   *  até o backfill-embeddings.mts rodar. */
  async rebuild(): Promise<void> {
    const oldEmbeddings = { ...this.embeddings };
    this.entries = [];
    this.embeddings = {};
    await this._scanMdFiles();
    // Restaurar embeddings para entries que ainda existem
    for (const entry of this.entries) {
      if (oldEmbeddings[entry.slug]) {
        this.embeddings[entry.slug] = oldEmbeddings[entry.slug];
      }
    }
    await this._persistIndex();
    this.loaded = true;
  }

  /** Força reload no próximo uso (ex: após consolidação semanal) */
  invalidate(): void {
    this.loaded = false;
    this.entries = [];
    this.embeddings = {};
  }

  // ── Utilitários ───────────────────────────────────────────────────────────

  get size(): number { return this.entries.length; }
  get embeddingCount(): number { return Object.keys(this.embeddings).length; }

  getEntry(slug: string): MemoryEntry | undefined {
    return this.entries.find(e => e.slug === slug);
  }

  getAllEntries(): MemoryEntry[] { return [...this.entries]; }
}

/** Atalho para obter o singleton já carregado */
export async function getMemoryIndex(): Promise<MemoryIndex> {
  const idx = MemoryIndex.getInstance();
  await idx.ensureLoaded();
  return idx;
}
