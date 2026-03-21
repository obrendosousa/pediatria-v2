import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";
import { getVaultService, isVaultAvailable } from "./service";
import { semanticSearch } from "./semantic";
import { syncMemoryToVault, syncConfigToVault } from "./sync";
import { runGraphAnalysis, getBacklinksFor } from "./graph-analyzer";
import { MEMORY_TYPES, MEMORY_TYPE_DESCRIPTIONS } from "../clara/memory_types";
import { stripPIIAndReferences, isGeneralizablePattern } from "../clara/memory_quality";

// ═══════════════════════════════════════════════════════════════════════════
// VAULT TOOLS — Ferramentas LangGraph para acesso ao Obsidian Vault
// ═══════════════════════════════════════════════════════════════════════════

// Client Supabase sem generics de tipo (igual ao src/ai/clara/tools.ts)
// para poder acessar tabelas sem generated types.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

const genAI = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY!,
});

async function embedText768(text: string): Promise<number[]> {
  const response = await genAI.models.embedContent({
    model: "gemini-embedding-001",
    contents: text,
    config: { outputDimensionality: 768 },
  });
  return response.embeddings?.[0]?.values ?? [];
}

// ─────────────────────────────────────────────────────────────────────────
// vault_read — Ler qualquer nota do vault
// ─────────────────────────────────────────────────────────────────────────

export const vaultReadTool = new DynamicStructuredTool({
  name: "vault_read",
  description:
    "Le uma nota do Obsidian Vault (cerebro compartilhado). " +
    "Use para ler configuracoes, memorias, relatorios, decisoes ou knowledge base. " +
    "O path e relativo ao vault root (ex: 'agents/clara/company.md', 'knowledge/clinical/faq-patients.md').",
  schema: z.object({
    path: z.string().describe("Caminho relativo da nota no vault (ex: 'agents/clara/rules.md')"),
  }),
  func: async ({ path }) => {
    if (!(await isVaultAvailable())) return "Vault indisponivel.";
    try {
      const vault = getVaultService();
      const note = await vault.readNote(path);
      const meta = Object.entries(note.frontmatter)
        .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
        .join("\n");
      return `---\n${meta}\n---\n\n${note.content}`;
    } catch (err) {
      return `Erro ao ler nota '${path}': ${(err as Error).message}`;
    }
  },
});

// ─────────────────────────────────────────────────────────────────────────
// vault_search — Busca full-text no vault
// ─────────────────────────────────────────────────────────────────────────

export const vaultSearchTool = new DynamicStructuredTool({
  name: "vault_search",
  description:
    "Busca textual no Obsidian Vault. Procura por palavras-chave no conteudo e titulos das notas. " +
    "Use para encontrar informacoes especificas no knowledge base, memorias ou relatorios.",
  schema: z.object({
    query: z.string().describe("Termo de busca"),
    folder: z
      .string()
      .optional()
      .describe("Restringir a um folder (ex: 'knowledge/', 'memories/', 'reports/')"),
    limit: z.number().optional().default(10).describe("Max resultados (padrao: 10)"),
  }),
  func: async ({ query, folder, limit }) => {
    if (!(await isVaultAvailable())) return "Vault indisponivel.";
    try {
      const vault = getVaultService();
      const results = await vault.searchNotes(query, { folder, limit });
      if (results.length === 0) return `Nenhum resultado para "${query}".`;

      return results
        .map((r) => {
          const type = r.frontmatter.type || "unknown";
          const lines = r.matchedLines?.length ? `\nTrechos: ${r.matchedLines.join(" | ")}` : "";
          return `[${type}] ${r.path}${lines}`;
        })
        .join("\n\n");
    } catch (err) {
      return `Erro na busca: ${(err as Error).message}`;
    }
  },
});

// ─────────────────────────────────────────────────────────────────────────
// vault_semantic_search — Busca por significado (pgvector + vault)
// ─────────────────────────────────────────────────────────────────────────

export const vaultSemanticSearchTool = new DynamicStructuredTool({
  name: "vault_semantic_search",
  description:
    "Busca semantica no cerebro compartilhado. Encontra memorias e conhecimento por significado, " +
    "nao apenas por palavras-chave. Usa embeddings para encontrar conteudo similar.",
  schema: z.object({
    query: z.string().describe("Pergunta ou descricao do que voce procura"),
    folder: z.string().optional().describe("Restringir a folder (ex: 'memories/', 'knowledge/')"),
    limit: z.number().optional().default(5).describe("Max resultados (padrao: 5)"),
  }),
  func: async ({ query, folder, limit }) => {
    try {
      const results = await semanticSearch(query, folder, limit);
      if (results.length === 0) return `Nenhuma memoria similar a "${query}".`;

      return results
        .map((r) => {
          const vaultInfo = r.vault_path ? ` | vault: ${r.vault_path}` : "";
          const tags = r.frontmatter?.tags
            ? ` | tags: ${(r.frontmatter.tags as string[]).join(", ")}`
            : "";
          return `[sim: ${r.similarity.toFixed(2)}${vaultInfo}${tags}]\n${r.content}`;
        })
        .join("\n\n---\n\n");
    } catch (err) {
      return `Erro na busca semantica: ${(err as Error).message}`;
    }
  },
});

// ─────────────────────────────────────────────────────────────────────────
// vault_write_memory — Salvar nova memoria (dual-write: Supabase + Vault)
// ─────────────────────────────────────────────────────────────────────────

export const vaultWriteMemoryTool = new DynamicStructuredTool({
  name: "vault_write_memory",
  description:
    `Salva um PADRAO GENERALIZAVEL no cerebro compartilhado. A memoria e armazenada tanto no banco ` +
    `(para busca semantica rapida) quanto no vault (para contexto rico e organizacao). ` +
    `NUNCA salve dados individuais de pacientes. Categorias: ${MEMORY_TYPES.join(", ")}.`,
  schema: z.object({
    memory_type: z.string().describe(
      `Categoria. Valores válidos: ${MEMORY_TYPES.join(", ")}. ${Object.entries(MEMORY_TYPE_DESCRIPTIONS).map(([k, v]) => `${k}: ${v}`).join(". ")}`
    ),
    content: z.string().describe("Conteudo da memoria (padrao generalizavel)"),
    source_role: z.string().optional().default("system").describe("Quem gerou: admin, doctor, system"),
  }),
  func: async ({ memory_type, content, source_role }) => {
    // Quality gate: limpar PII e validar padrao generalizavel
    const cleaned = stripPIIAndReferences(content);
    if (!cleaned) {
      return "Memoria rejeitada: conteudo contem apenas dados pessoais/especificos ou ficou muito curto.";
    }
    if (!isGeneralizablePattern(cleaned)) {
      return "Memoria rejeitada: observacao individual, nao um padrao generalizavel.";
    }

    try {
      const embedding = await embedText768(cleaned);

      const { data: matches } = await supabase.rpc("match_memories", {
        query_embedding: embedding,
        match_threshold: 0.80,
        match_count: 1,
      });

      let supabaseId: number;
      const matchesTyped = matches as Array<{ id: number; content: string; similarity: number }> | null;

      if (matchesTyped && matchesTyped.length > 0) {
        const existingId = matchesTyped[0].id;
        await supabase
          .from("clara_memories")
          .update({
            content: cleaned,
            memory_type,
            source_role,
            embedding,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingId);
        supabaseId = existingId;
      } else {
        const { data } = await supabase
          .from("clara_memories")
          .insert({
            content: cleaned,
            memory_type,
            source_role,
            embedding,
            updated_at: new Date().toISOString(),
          })
          .select("id")
          .single();
        supabaseId = (data as { id: number } | null)?.id ?? 0;
      }

      await syncMemoryToVault(supabaseId, memory_type, cleaned, source_role);

      const action = matchesTyped && matchesTyped.length > 0 ? "atualizada" : "criada";
      return `Memoria ${action} com sucesso (ID: ${supabaseId}, tipo: ${memory_type}). Salva no banco e no vault.`;
    } catch (err) {
      return `Erro ao salvar memoria: ${(err as Error).message}`;
    }
  },
});

// ─────────────────────────────────────────────────────────────────────────
// vault_read_config — Ler configuracao do agente
// ─────────────────────────────────────────────────────────────────────────

export const vaultReadConfigTool = new DynamicStructuredTool({
  name: "vault_read_config",
  description:
    "Le a configuracao da Clara (empresa, regras, regras de voz) do cerebro compartilhado. " +
    "Equivalente ao read_brain_files mas lendo do vault.",
  schema: z.object({
    module: z
      .enum(["company", "rules", "voice_rules", "all"])
      .describe("Qual modulo ler: company, rules, voice_rules ou all"),
  }),
  func: async ({ module }) => {
    if (!(await isVaultAvailable())) return "Vault indisponivel.";
    try {
      const vault = getVaultService();
      const moduleMap: Record<string, string> = {
        company: "agents/clara/company.md",
        rules: "agents/clara/rules.md",
        voice_rules: "agents/clara/voice-rules.md",
      };

      if (module === "all") {
        const parts: string[] = [];
        for (const [key, notePath] of Object.entries(moduleMap)) {
          try {
            const note = await vault.readNote(notePath);
            parts.push(`=== ${key.toUpperCase()} ===\n${note.content}`);
          } catch {
            parts.push(`=== ${key.toUpperCase()} ===\n(nao configurado)`);
          }
        }
        return parts.join("\n\n");
      }

      const filePath = moduleMap[module];
      if (!filePath) return `Modulo desconhecido: ${module}`;

      const note = await vault.readNote(filePath);
      return note.content;
    } catch (err) {
      return `Erro ao ler config: ${(err as Error).message}`;
    }
  },
});

// ─────────────────────────────────────────────────────────────────────────
// vault_update_config — Atualizar configuracao do agente
// ─────────────────────────────────────────────────────────────────────────

export const vaultUpdateConfigTool = new DynamicStructuredTool({
  name: "vault_update_config",
  description:
    "Atualiza a configuracao da Clara (empresa, regras, regras de voz). " +
    "Salva tanto no banco (efeito imediato) quanto no vault (versionado).",
  schema: z.object({
    module: z.enum(["company", "rules", "voice_rules"]).describe("Qual modulo atualizar"),
    new_content: z.string().describe("Novo conteudo completo do modulo"),
  }),
  func: async ({ module, new_content }) => {
    try {
      // 1. Salvar no Supabase (efeito imediato)
      const { error } = await supabase
        .from("agent_config")
        .upsert(
          {
            agent_id: "clara",
            config_key: module,
            content: new_content,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "agent_id,config_key" }
        );

      if (error) return `Erro ao salvar no banco: ${error.message}`;

      // 2. Sync para o vault
      await syncConfigToVault(module, new_content);

      return `Configuracao '${module}' atualizada com sucesso no banco e no vault.`;
    } catch (err) {
      return `Erro ao atualizar config: ${(err as Error).message}`;
    }
  },
});

// ─────────────────────────────────────────────────────────────────────────
// vault_log_decision — Registrar decisao no audit trail
// ─────────────────────────────────────────────────────────────────────────

export const vaultLogDecisionTool = new DynamicStructuredTool({
  name: "vault_log_decision",
  description:
    "Registra uma decisao importante no cerebro compartilhado. " +
    "Cria um registro de auditoria com quem decidiu, o que, por que e quais chats estao relacionados. " +
    "Use para registrar mudancas de regras, decisoes clinicas, mudancas de precos, etc.",
  schema: z.object({
    summary: z.string().describe("Resumo da decisao (1 frase)"),
    decided_by: z.string().describe("Quem decidiu: admin, doctor, clara, analyst"),
    category: z
      .enum(["operacional", "clinico", "financeiro", "tecnico"])
      .describe("Categoria da decisao"),
    context: z.string().optional().describe("Contexto detalhado (por que essa decisao foi tomada)"),
    related_chats: z
      .array(z.number())
      .optional()
      .describe("IDs de chats relacionados a essa decisao"),
  }),
  func: async ({ summary, decided_by, category, context, related_chats }) => {
    if (!(await isVaultAvailable())) return "Vault indisponivel.";
    try {
      const vault = getVaultService();
      const notePath = await vault.logDecision({
        summary,
        decided_by,
        category,
        context,
        related_chats,
      });
      return `Decisao registrada: ${notePath}`;
    } catch (err) {
      return `Erro ao registrar decisao: ${(err as Error).message}`;
    }
  },
});

// ─────────────────────────────────────────────────────────────────────────
// vault_get_daily_digest — Ler resumo do dia
// ─────────────────────────────────────────────────────────────────────────

export const vaultGetDailyDigestTool = new DynamicStructuredTool({
  name: "vault_get_daily_digest",
  description:
    "Le o resumo diario do vault. Contem metricas, atividades dos agentes, " +
    "memorias criadas e decisoes do dia. Use para contexto sobre o que aconteceu recentemente.",
  schema: z.object({
    date: z
      .string()
      .optional()
      .describe("Data no formato YYYY-MM-DD (padrao: hoje)"),
  }),
  func: async ({ date }) => {
    if (!(await isVaultAvailable())) return "Vault indisponivel.";
    try {
      const vault = getVaultService();
      const targetDate =
        date || new Date().toISOString().slice(0, 10);
      const note = await vault.readNote(`daily/${targetDate}.md`);
      return note.content;
    } catch {
      return `Nenhum resumo diario encontrado para ${date || "hoje"}.`;
    }
  },
});

// ─────────────────────────────────────────────────────────────────────────
// vault_analyze_graph — Analise estrutural do grafo de conhecimento
// ─────────────────────────────────────────────────────────────────────────

export const vaultAnalyzeGraphTool = new DynamicStructuredTool({
  name: "vault_analyze_graph",
  description:
    "Analisa a estrutura do grafo de conhecimento do vault. " +
    "Identifica notas orfas (sem conexoes), links quebrados (dead ends), " +
    "hubs (notas mais referenciadas), clusters tematicos e notas-ponte. " +
    "Use para entender gaps de conhecimento e a saude da base.",
  schema: z.object({
    save_results: z
      .boolean()
      .optional()
      .default(true)
      .describe("Se true, salva resultados em graphs/topic-map.md e graphs/gap-analysis.md"),
  }),
  func: async ({ save_results }) => {
    try {
      if (save_results) {
        const result = await runGraphAnalysis();
        return result.summary;
      }
      // Analise sem salvar (read-only)
      const { VaultGraphAnalyzer } = await import("./graph-analyzer");
      const analyzer = new VaultGraphAnalyzer();
      await analyzer.build();
      const result = analyzer.analyze();
      return result.summary;
    } catch (err) {
      return `Erro na analise de grafo: ${(err as Error).message}`;
    }
  },
});

// ─────────────────────────────────────────────────────────────────────────
// vault_get_backlinks — Backlinks de uma nota especifica
// ─────────────────────────────────────────────────────────────────────────

export const vaultGetBacklinksTool = new DynamicStructuredTool({
  name: "vault_get_backlinks",
  description:
    "Retorna todas as notas que referenciam uma nota especifica via [[wikilinks]]. " +
    "Use para entender o contexto e as conexoes de uma nota no grafo de conhecimento.",
  schema: z.object({
    path: z.string().describe("Caminho relativo da nota (ex: 'knowledge/clinical/vacinas.md')"),
  }),
  func: async ({ path }) => {
    try {
      const backlinks = await getBacklinksFor(path);
      if (backlinks.length === 0) return `Nenhum backlink encontrado para '${path}'.`;

      return `Backlinks para '${path}' (${backlinks.length}):\n${backlinks
        .map((bl) => `- [${bl.type}] ${bl.path}`)
        .join("\n")}`;
    } catch (err) {
      return `Erro ao buscar backlinks: ${(err as Error).message}`;
    }
  },
});

// ─────────────────────────────────────────────────────────────────────────
// EXPORTS AGRUPADOS POR AGENTE
// ─────────────────────────────────────────────────────────────────────────

/** Tools do vault para a Clara (acesso completo) */
export const claraVaultTools = [
  vaultReadTool,
  vaultSearchTool,
  vaultSemanticSearchTool,
  vaultWriteMemoryTool,
  vaultReadConfigTool,
  vaultUpdateConfigTool,
  vaultLogDecisionTool,
  vaultGetDailyDigestTool,
  vaultAnalyzeGraphTool,
  vaultGetBacklinksTool,
];

/** Tools do vault para o Analyst (leitura + decisoes + grafo) */
export const analystVaultTools = [
  vaultReadTool,
  vaultSearchTool,
  vaultLogDecisionTool,
  vaultAnalyzeGraphTool,
  vaultGetBacklinksTool,
];

/** Tools do vault para o Copilot (leitura limitada) */
export const copilotVaultTools = [
  vaultReadTool,
  vaultSearchTool,
];
