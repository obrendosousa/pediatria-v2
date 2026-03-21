import { GoogleGenAI } from "@google/genai";
import { getSupabaseAdminClient } from "@/lib/automation/adapters/supabaseAdmin";
import { getVaultService } from "./service";
import type { SemanticSearchResult } from "./types";

// ═══════════════════════════════════════════════════════════════════════════
// VAULT SEMANTIC — Bridge entre pgvector (Supabase) e Obsidian Vault
// Embeddings continuam no Supabase; vault adiciona contexto estruturado.
// ═══════════════════════════════════════════════════════════════════════════

const genAI = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY!,
});

/** Gera embedding 768-dim compativel com o schema do banco */
async function embedText768(text: string): Promise<number[]> {
  const response = await genAI.models.embedContent({
    model: "gemini-embedding-001",
    contents: text,
    config: { outputDimensionality: 768 },
  });
  return response.embeddings?.[0]?.values ?? [];
}

/**
 * Busca semantica hibrida: pgvector (velocidade) + vault (contexto).
 *
 * 1. Gera embedding da query
 * 2. Executa match_memories no Supabase (pgvector, <100ms)
 * 3. Enriquece resultados com metadata do vault (backlinks, tags, folder)
 */
export async function semanticSearch(
  query: string,
  folder?: string,
  limit: number = 5,
  threshold: number = 0.65
): Promise<SemanticSearchResult[]> {
  const supabase = getSupabaseAdminClient();

  // 1. Gerar embedding
  const queryEmbedding = await embedText768(query);

  // 2. Busca pgvector no Supabase
  // @ts-expect-error — match_memories RPC nao esta nos generated types
  const { data, error } = await supabase.rpc("match_memories", {
    query_embedding: queryEmbedding,
    match_threshold: threshold,
    match_count: limit,
  });

  if (error || !data) {
    console.warn("[Vault Semantic] Erro na busca pgvector:", error?.message);
    return [];
  }

  const matches = data as Array<{
    id: number;
    content: string;
    similarity: number;
    memory_type?: string;
  }>;

  // 3. Enriquecer com metadata do vault
  const vault = getVaultService();
  const results: SemanticSearchResult[] = await Promise.all(
    matches.map(async (match) => {
      const result: SemanticSearchResult = {
        content: match.content,
        similarity: match.similarity,
        supabase_id: match.id,
      };

      // Tentar encontrar a nota correspondente no vault pelo supabase_id
      try {
        const searchFolder = folder || "memories";
        const notes = await vault.searchNotes("", { folder: searchFolder, limit: 100 });
        const vaultNote = notes.find(
          (n) => n.frontmatter.supabase_id === match.id
        );
        if (vaultNote) {
          result.vault_path = vaultNote.path;
          result.frontmatter = vaultNote.frontmatter;
        }
      } catch {
        // Vault indisponivel — retorna resultado sem enriquecimento
      }

      return result;
    })
  );

  return results;
}

/**
 * Busca semantica simplificada que retorna apenas os conteudos (strings).
 * Compativel com o formato esperado pelo load_context.ts.
 */
export async function semanticSearchSimple(
  query: string,
  limit: number = 5
): Promise<string[]> {
  const results = await semanticSearch(query, undefined, limit);
  return results.map((r) => r.content);
}
