import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { VAULT_ROOT, VAULT_ENABLED, VAULT_LIMITS } from "./config";
import type {
  VaultNote,
  VaultNoteMeta,
  VaultSearchResult,
  SearchOptions,
  ListOptions,
  DecisionInput,
} from "./types";

// ═══════════════════════════════════════════════════════════════════════════
// VAULT SERVICE — Operacoes core de leitura/escrita no Obsidian Vault
// ═══════════════════════════════════════════════════════════════════════════

class VaultService {
  private root: string;

  constructor(root: string = VAULT_ROOT) {
    this.root = root;
  }

  /** Caminho absoluto para uma nota */
  private abs(relativePath: string): string {
    return path.join(this.root, relativePath);
  }

  /** Garante que o diretorio pai existe */
  private async ensureDir(filePath: string): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // READ
  // ─────────────────────────────────────────────────────────────────────────

  /** Le uma nota e parseia o frontmatter YAML */
  async readNote(relativePath: string): Promise<VaultNote> {
    const absPath = this.abs(relativePath);
    const raw = await fs.readFile(absPath, "utf-8");
    const { data, content } = matter(raw);
    return { path: relativePath, content: content.trim(), frontmatter: data };
  }

  /** Lista notas de um folder com metadata */
  async listNotes(folder: string, options: ListOptions = {}): Promise<VaultNoteMeta[]> {
    const {
      limit = VAULT_LIMITS.MAX_LIST_RESULTS,
      sortBy = "mtime",
      order = "desc",
      type,
    } = options;

    const absFolder = this.abs(folder);
    const results: VaultNoteMeta[] = [];

    try {
      await this._walkDir(absFolder, async (filePath) => {
        if (!filePath.endsWith(".md")) return;

        const relativePath = path.relative(this.root, filePath);
        const stat = await fs.stat(filePath);
        const raw = await fs.readFile(filePath, "utf-8");
        const { data } = matter(raw);

        if (type && data.type !== type) return;

        results.push({
          path: relativePath,
          frontmatter: data,
          mtime: stat.mtime,
        });
      });
    } catch {
      // Folder nao existe ainda
      return [];
    }

    // Ordenar
    results.sort((a, b) => {
      let va: string | number | Date, vb: string | number | Date;
      if (sortBy === "mtime") {
        va = a.mtime.getTime();
        vb = b.mtime.getTime();
      } else if (sortBy === "created_at") {
        va = String(a.frontmatter.created_at ?? "");
        vb = String(b.frontmatter.created_at ?? "");
      } else {
        va = a.path;
        vb = b.path;
      }
      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return order === "desc" ? -cmp : cmp;
    });

    return results.slice(0, limit);
  }

  /** Busca full-text em notas do vault */
  async searchNotes(query: string, options: SearchOptions = {}): Promise<VaultSearchResult[]> {
    const {
      folder,
      limit = VAULT_LIMITS.MAX_SEARCH_RESULTS,
      type,
      tags,
    } = options;

    const searchRoot = folder ? this.abs(folder) : this.root;
    const queryLower = query.toLowerCase();
    const results: VaultSearchResult[] = [];

    try {
      await this._walkDir(searchRoot, async (filePath) => {
        if (!filePath.endsWith(".md")) return;
        if (results.length >= limit) return;

        const raw = await fs.readFile(filePath, "utf-8");
        const { data, content } = matter(raw);

        // Filtros de frontmatter
        if (type && data.type !== type) return;
        if (tags && tags.length > 0) {
          const noteTags = Array.isArray(data.tags) ? data.tags as string[] : [];
          if (!tags.some((t) => noteTags.includes(t))) return;
        }

        // Match de conteudo (query vazia = listar tudo)
        if (query) {
          const contentLower = content.toLowerCase();
          const titleLower = (String(data.titulo || data.title || "")).toLowerCase();

          if (!contentLower.includes(queryLower) && !titleLower.includes(queryLower)) return;
        }

        const relativePath = path.relative(this.root, filePath);

        // Extrair linhas que deram match
        const matchedLines = query
          ? content
              .split("\n")
              .filter((line) => line.toLowerCase().includes(queryLower))
              .slice(0, 3)
          : [];

        results.push({
          path: relativePath,
          content: content.trim(),
          frontmatter: data,
          matchedLines,
        });
      });
    } catch {
      return [];
    }

    return results;
  }

  /** Encontra todos os backlinks para uma nota (quem referencia [[nota]]) */
  async getBacklinks(relativePath: string): Promise<VaultNoteMeta[]> {
    const noteName = path.basename(relativePath, ".md");
    const wikiLinkPattern = new RegExp(`\\[\\[${this._escapeRegex(noteName)}(\\|[^\\]]*)?\\]\\]`, "gi");
    const results: VaultNoteMeta[] = [];

    await this._walkDir(this.root, async (filePath) => {
      if (!filePath.endsWith(".md")) return;

      const rel = path.relative(this.root, filePath);
      if (rel === relativePath) return; // Nao incluir a propria nota

      const raw = await fs.readFile(filePath, "utf-8");
      if (wikiLinkPattern.test(raw)) {
        wikiLinkPattern.lastIndex = 0; // Reset regex
        const { data } = matter(raw);
        const stat = await fs.stat(filePath);
        results.push({ path: rel, frontmatter: data, mtime: stat.mtime });
      }
    });

    return results;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // WRITE
  // ─────────────────────────────────────────────────────────────────────────

  /** Escreve uma nota com frontmatter YAML */
  async writeNote(
    relativePath: string,
    content: string,
    frontmatter: Record<string, unknown> = {}
  ): Promise<void> {
    const absPath = this.abs(relativePath);
    await this.ensureDir(absPath);

    const output = matter.stringify(content, frontmatter);
    await fs.writeFile(absPath, output, "utf-8");
  }

  /** Append ao final do conteudo de uma nota */
  async appendToNote(relativePath: string, content: string): Promise<void> {
    const absPath = this.abs(relativePath);

    try {
      const raw = await fs.readFile(absPath, "utf-8");
      const { data, content: existingContent } = matter(raw);
      const newContent = existingContent.trim() + "\n\n" + content;
      const output = matter.stringify(newContent, data);
      await fs.writeFile(absPath, output, "utf-8");
    } catch {
      // Nota nao existe, criar nova
      await this.writeNote(relativePath, content);
    }
  }

  /** Merge parcial no frontmatter de uma nota */
  async updateFrontmatter(
    relativePath: string,
    updates: Record<string, unknown>
  ): Promise<void> {
    const absPath = this.abs(relativePath);
    const raw = await fs.readFile(absPath, "utf-8");
    const { data, content } = matter(raw);
    const merged = { ...data, ...updates };
    const output = matter.stringify(content, merged);
    await fs.writeFile(absPath, output, "utf-8");
  }

  /** Remove uma nota */
  async deleteNote(relativePath: string): Promise<void> {
    const absPath = this.abs(relativePath);
    try {
      await fs.unlink(absPath);
    } catch {
      // Nota ja nao existe
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DECISIONS
  // ─────────────────────────────────────────────────────────────────────────

  /** Registra uma decisao no vault */
  async logDecision(input: DecisionInput): Promise<string> {
    const now = new Date();
    const dateSlug = now.toISOString().slice(0, 10);
    const slug = this._slugify(input.summary.slice(0, 60));
    const relativePath = `decisions/${dateSlug}-${slug}.md`;

    const frontmatter = {
      type: "decision",
      decision_date: dateSlug,
      decided_by: input.decided_by,
      category: input.category,
      status: "active",
      related_chats: input.related_chats || [],
      tags: input.tags || [],
      created_at: now.toISOString(),
    };

    const content = [
      `# ${input.summary}`,
      "",
      input.context ? `## Contexto\n\n${input.context}` : "",
      input.related_chats?.length
        ? `## Chats Relacionados\n\n${input.related_chats.map((id) => `- [[chat-${id}]]`).join("\n")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    await this.writeNote(relativePath, content, frontmatter);
    return relativePath;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HELPERS INTERNOS
  // ─────────────────────────────────────────────────────────────────────────

  /** Percorre recursivamente um diretorio */
  private async _walkDir(
    dir: string,
    callback: (filePath: string) => Promise<void>
  ): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // Ignorar pastas internas do Obsidian e .git
        if (entry.name.startsWith(".")) continue;
        await this._walkDir(full, callback);
      } else {
        await callback(full);
      }
    }
  }

  /** Converte texto em slug para nomes de arquivo */
  private _slugify(text: string): string {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Remove acentos
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80);
  }

  /** Escapa caracteres especiais de regex */
  private _escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}

// ─────────────────────────────────────────────────────────────────────────
// SINGLETON
// ─────────────────────────────────────────────────────────────────────────

let _instance: VaultService | null = null;

/** Retorna a instancia singleton do VaultService */
export function getVaultService(): VaultService {
  if (!_instance) {
    _instance = new VaultService();
  }
  return _instance;
}

/** Verifica se o vault esta habilitado e o diretorio existe */
export async function isVaultAvailable(): Promise<boolean> {
  if (!VAULT_ENABLED) return false;
  try {
    await fs.access(VAULT_ROOT);
    return true;
  } catch {
    return false;
  }
}
