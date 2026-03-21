// ═══════════════════════════════════════════════════════════════════════════
// VAULT TYPES — Interfaces TypeScript para o Obsidian Vault
// ═══════════════════════════════════════════════════════════════════════════

/** Nota completa do vault (frontmatter + conteudo) */
export interface VaultNote {
  /** Caminho relativo ao vault root (ex: "memories/regra/desconto-retorno.md") */
  path: string;
  /** Conteudo Markdown (sem o frontmatter) */
  content: string;
  /** Frontmatter YAML parseado */
  frontmatter: Record<string, unknown>;
}

/** Metadata de uma nota (sem conteudo completo) */
export interface VaultNoteMeta {
  path: string;
  frontmatter: Record<string, unknown>;
  mtime: Date;
}

/** Resultado de busca no vault */
export interface VaultSearchResult {
  path: string;
  content: string;
  frontmatter: Record<string, unknown>;
  /** Score de relevancia (0-1, presente apenas em busca semantica) */
  score?: number;
  /** Linhas que deram match na busca full-text */
  matchedLines?: string[];
}

/** Input para registrar uma decisao */
export interface DecisionInput {
  summary: string;
  decided_by: string;
  category: "operacional" | "clinico" | "financeiro" | "tecnico";
  context?: string;
  related_chats?: number[];
  tags?: string[];
}

/** Opcoes de busca full-text */
export interface SearchOptions {
  /** Restringir busca a um folder especifico */
  folder?: string;
  /** Limite de resultados */
  limit?: number;
  /** Filtrar por tipo de nota (frontmatter.type) */
  type?: string;
  /** Filtrar por tags (frontmatter.tags) */
  tags?: string[];
}

/** Opcoes de listagem */
export interface ListOptions {
  /** Limite de resultados */
  limit?: number;
  /** Ordenacao */
  sortBy?: "mtime" | "created_at" | "name";
  /** Ordem */
  order?: "asc" | "desc";
  /** Filtrar por tipo de nota */
  type?: string;
}

/** Resultado de busca semantica (enriquecido com vault metadata) */
export interface SemanticSearchResult {
  /** Conteudo da memoria */
  content: string;
  /** Score de similaridade (cosine) */
  similarity: number;
  /** ID no Supabase (clara_memories.id) */
  supabase_id: number;
  /** Caminho da nota correspondente no vault (se encontrada) */
  vault_path?: string;
  /** Frontmatter da nota no vault */
  frontmatter?: Record<string, unknown>;
}
