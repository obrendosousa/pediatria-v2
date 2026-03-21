// ═══════════════════════════════════════════════════════════════════════════
// CAMADA 5: Load Context — Auto-RAG
// Carrega memórias, notas de chat e knowledge base automaticamente
// no início de cada interação.
// ═══════════════════════════════════════════════════════════════════════════

import { getSupabaseAdminClient } from "@/lib/automation/adapters/supabaseAdmin";
import { GoogleGenAI } from "@google/genai";
import { getVaultService, isVaultAvailable } from "@/ai/vault/service";

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
  const supabase = getSupabaseAdminClient();

  const [memoriesResult, chatNotesResult, knowledgeResult, statsResult, vaultResult] =
    await Promise.allSettled([
      // 1. AUTO-RAG: Busca semântica na clara_memories
      (async () => {
        const queryEmbedding = await embedQuery(userMessage);
        // @ts-expect-error — match_memories RPC not in generated Supabase types
        const { data } = await supabase.rpc("match_memories", {
          query_embedding: queryEmbedding,
          match_threshold: 0.65,
          match_count: 5,
        });
        return (data || []).map((m: { content: string }) => m.content);
      })(),

      // 2. Chat notes do chat atual
      (async () => {
        if (!chatId || chatId === 0) return null;
        const { data } = await supabase
          .from("chat_notes")
          .select("notes")
          .eq("chat_id", chatId)
          .maybeSingle();
        return (data as { notes: string } | null)?.notes || null;
      })(),

      // 3. Knowledge base relevante
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

      // 4. Stats de memória
      (async () => {
        const { count } = await supabase
          .from("clara_memories")
          .select("*", { count: "exact", head: true });
        const { data: latest } = await supabase
          .from("clara_memories")
          .select("updated_at")
          .order("updated_at", { ascending: false })
          .limit(1);
        const latestTyped = latest as Array<{ updated_at: string }> | null;
        return {
          count: count || 0,
          last_date: latestTyped?.[0]?.updated_at
            ? new Date(latestTyped[0].updated_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
            : "N/A",
        };
      })(),

      // 5. Contexto do vault (scratchpad + decisoes recentes)
      (async () => {
        if (!(await isVaultAvailable())) return { scratchpad: undefined, decisions: [] as string[] };
        const vault = getVaultService();
        const [scratchpad, recentDecisions] = await Promise.all([
          vault.readNote("agents/clara/scratchpad.md").then((n) => n.content).catch(() => undefined),
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

  return {
    relevant_memories: memoriesResult.status === "fulfilled" ? memoriesResult.value : [],
    chat_notes: chatNotesResult.status === "fulfilled" ? chatNotesResult.value : null,
    relevant_knowledge: knowledgeResult.status === "fulfilled" ? knowledgeResult.value : [],
    memory_count: statsResult.status === "fulfilled" ? (statsResult.value as { count: number; last_date: string }).count : 0,
    last_memory_date: statsResult.status === "fulfilled" ? (statsResult.value as { count: number; last_date: string }).last_date : "N/A",
    vault_scratchpad: vaultData.scratchpad,
    vault_recent_decisions: vaultData.decisions.length > 0 ? vaultData.decisions : undefined,
  };
}
