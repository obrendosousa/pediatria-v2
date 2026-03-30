// ═══════════════════════════════════════════════════════════════════════════
// Load Context — Auto-RAG para Clínica Geral (schema atendimento)
// Carrega memórias, notas de chat e knowledge base automaticamente
// no início de cada interação.
// ═══════════════════════════════════════════════════════════════════════════

import { createSchemaAdminClient } from "@/lib/supabase/schemaServer";
import { GoogleGenAI } from "@google/genai";
import { getVaultService, isVaultAvailable } from "@/ai/vault/service";
import { getMemoryIndex } from "@/ai/vault/memory-index";

export interface LoadedContext {
  relevant_memories: string[];
  chat_notes: string | null;
  relevant_knowledge: string[];
  memory_count: number;
  last_memory_date: string;
  vault_scratchpad?: string;
  vault_recent_decisions?: string[];
}

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY! });

async function embedQuery(text: string): Promise<number[]> {
  const response = await genAI.models.embedContent({
    model: "gemini-embedding-001",
    contents: text,
    config: { outputDimensionality: 768 },
  });
  return response.embeddings?.[0]?.values ?? [];
}

/**
 * Carrega contexto automaticamente ANTES do classify_node.
 * Executa tudo em paralelo (~300-500ms total).
 */
export async function loadContextForInteraction(
  userMessage: string,
  chatId: number
): Promise<LoadedContext> {
  const supabase = createSchemaAdminClient("atendimento");

  const [memoriesResult, chatNotesResult, knowledgeResult, statsResult, vaultResult] =
    await Promise.allSettled([
      // 1. AUTO-RAG: Busca local no vault (GraphRAG)
      (async () => {
        const queryEmbedding = await embedQuery(userMessage);
        const index = await getMemoryIndex();
        if (index.size === 0) return [];

        // Busca vetorial local → top 3 seeds
        const seeds = index.search(queryEmbedding, 3);
        if (seeds.length === 0) return [];

        // Expansão de grafo → vizinhos fortes (1 hop)
        const seedSlugs = seeds.map(r => r.entry.slug);
        const expanded = index.graphExpand(seedSlugs, 8);

        // Retornar conteúdos únicos (seeds já incluídos pelo graphExpand)
        return expanded.map(e => e.content);
      })(),

      // 2. Chat notes do chat atual (schema atendimento)
      (async () => {
        if (!chatId || chatId === 0) return null;
        const { data } = await supabase
          .from("chat_notes")
          .select("notes")
          .eq("chat_id", chatId)
          .maybeSingle();
        return (data as { notes: string } | null)?.notes || null;
      })(),

      // 3. Knowledge base relevante (schema atendimento)
      (async () => {
        const keywords = userMessage
          .toLowerCase()
          .split(/\s+/)
          .filter((w) => w.length > 3)
          .slice(0, 3);

        if (keywords.length === 0) return [];

        const { data } = await supabase
          .from("knowledge_base")
          .select("content:resposta_ideal, category:categoria")
          .or(keywords.map((k) => `pergunta.ilike.%${k.replace(/[%_\\]/g, '\\$&')}%`).join(","))
          .limit(3);
        return (data || []).map((k: { category: string; content: string }) => `[${k.category}] ${k.content}`);
      })(),

      // 4. Stats de memória (vault local)
      (async () => {
        try {
          const index = await getMemoryIndex();
          const allEntries = index.getAllEntries();
          const lastEntry = allEntries.sort((a, b) =>
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
          )[0];
          return {
            count: index.size,
            last_date: lastEntry?.updated_at
              ? new Date(lastEntry.updated_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
              : "N/A",
          };
        } catch {
          return { count: 0, last_date: "N/A" };
        }
      })(),

      // 5. Contexto do vault (scratchpad + decisoes recentes) — path clinica-geral
      (async () => {
        if (!(await isVaultAvailable())) return { scratchpad: undefined, decisions: [] as string[] };
        const vault = getVaultService();
        const [scratchpad, recentDecisions] = await Promise.all([
          vault.readNote("agents/clinica-geral/scratchpad.md").then((n) => n.content).catch(() => undefined),
          vault.listNotes("decisions/", { limit: 3, sortBy: "mtime", order: "desc" })
            .then((notes) => notes.map((d) => (d.frontmatter.summary as string) || d.path))
            .catch(() => [] as string[]),
        ]);
        return { scratchpad, decisions: recentDecisions };
      })(),
    ]);

  const vaultData = vaultResult.status === "fulfilled"
    ? vaultResult.value
    : { scratchpad: undefined, decisions: [] as string[] };

  // Scratchpad só é injetado em sessões admin/internas (não em chats de pacientes)
  const isAdminSession = chatId === 0 || chatId === -1;

  return {
    relevant_memories: memoriesResult.status === "fulfilled" ? memoriesResult.value : [],
    chat_notes: chatNotesResult.status === "fulfilled" ? chatNotesResult.value : null,
    relevant_knowledge: knowledgeResult.status === "fulfilled" ? knowledgeResult.value : [],
    memory_count: statsResult.status === "fulfilled" ? (statsResult.value as { count: number; last_date: string }).count : 0,
    last_memory_date: statsResult.status === "fulfilled" ? (statsResult.value as { count: number; last_date: string }).last_date : "N/A",
    vault_scratchpad: isAdminSession ? vaultData.scratchpad : undefined,
    vault_recent_decisions: vaultData.decisions.length > 0 ? vaultData.decisions : undefined,
  };
}
