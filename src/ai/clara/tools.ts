import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage } from "@langchain/core/messages";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

// ─────────────────────────────────────────────────────────────────────────────
// FERRAMENTAS ORIGINAIS DA CLARA
// Brain files agora persistidos no Supabase (tabela agent_config)
// para que atualizações entrem em vigor imediatamente sem restart.
// ─────────────────────────────────────────────────────────────────────────────

const CONFIG_KEY_MAP: Record<string, string> = {
  "soul.ts": "soul",
  "company.ts": "company",
  "rules.ts": "rules",
};

export const readBrainFilesTool = new DynamicStructuredTool({
  name: "read_brain_files",
  description:
    "Lê o conteúdo atual da sua personalidade, contexto da empresa e regras operacionais (soul, company, rules) diretamente do banco de dados.",
  schema: z.object({
    filename: z
      .enum(["soul.ts", "company.ts", "rules.ts"])
      .optional()
      .describe("Especifique qual módulo ler, ou deixe em branco para ler todos."),
  }),
  func: async ({ filename }) => {
    try {
      if (filename) {
        const configKey = CONFIG_KEY_MAP[filename];
        const { data, error } = await supabase
          .from("agent_config")
          .select("content")
          .eq("agent_id", "clara")
          .eq("config_key", configKey)
          .single();
        if (error || !data) return `Módulo '${configKey}' não encontrado no banco.`;
        return `CONTEÚDO DE ${filename}:\n\n${data.content}`;
      }

      const { data, error } = await supabase
        .from("agent_config")
        .select("config_key, content")
        .eq("agent_id", "clara")
        .in("config_key", ["soul", "company", "rules"]);

      if (error || !data || data.length === 0) return "Nenhum módulo encontrado no banco.";

      const map = Object.fromEntries(data.map((row: any) => [row.config_key, row.content]));
      return [
        map.soul ? `SOUL:\n${map.soul}` : "",
        map.company ? `COMPANY:\n${map.company}` : "",
        map.rules ? `RULES:\n${map.rules}` : "",
      ].filter(Boolean).join("\n\n");
    } catch (error: any) {
      return `Erro ao ler configurações do cérebro: ${error.message}`;
    }
  },
});

export const updateBrainFileTool = new DynamicStructuredTool({
  name: "update_brain_file",
  description:
    "Atualiza sua configuração (company ou rules) no banco de dados para aprender novas regras permanentemente. As alterações entram em vigor imediatamente, sem necessidade de restart. Envie o TEXTO COMPLETO que substituirá o módulo.",
  schema: z.object({
    filename: z.enum(["company.ts", "rules.ts"]).describe("Qual módulo atualizar."),
    new_content: z.string().describe("O texto completo e atualizado que substituirá o módulo."),
  }),
  func: async ({ filename, new_content }) => {
    try {
      const configKey = CONFIG_KEY_MAP[filename];
      const { error } = await supabase
        .from("agent_config")
        .upsert(
          { agent_id: "clara", config_key: configKey, content: new_content },
          { onConflict: "agent_id,config_key" }
        );
      if (error) throw error;
      return `Sucesso! O módulo '${configKey}' foi atualizado no banco de dados. As alterações estão ativas imediatamente.`;
    } catch (error: any) {
      return `Erro ao atualizar configuração: ${error.message}`;
    }
  },
});

export const manageLongTermMemoryTool = new DynamicStructuredTool({
  name: "manage_long_term_memory",
  description: "Salva fatos importantes ou consulta aprendizados passados na tabela 'clara_memories'.",
  schema: z.object({
    action: z.enum(["salvar", "consultar"]),
    memory_type: z.string().describe("Categoria da memória (ex: 'preferencia_paciente')."),
    content: z.string().optional().describe("O fato a ser salvo ou a palavra-chave para busca."),
  }),
  func: async ({ action, memory_type, content }) => {
    if (action === "salvar") {
      if (!content) return "Erro: 'content' é obrigatório para salvar.";
      const { error } = await supabase.from("clara_memories").insert({ memory_type, content });
      if (error) return `Erro ao salvar memória: ${error.message}`;
      return `Memória salva com sucesso na categoria '${memory_type}'.`;
    } else {
      let query = supabase
        .from("clara_memories")
        .select("content, created_at")
        .eq("memory_type", memory_type);
      if (content) query = query.ilike("content", `%${content}%`);
      const { data, error } = await query.order("created_at", { ascending: false }).limit(5);
      if (error) return `Erro ao buscar memórias: ${error.message}`;
      if (!data || data.length === 0) return "Nenhuma memória encontrada com esses critérios.";
      return `Memórias encontradas:\n${data
        .map(
          (m) =>
            `- ${m.content} (salvo em ${new Date(m.created_at).toLocaleDateString()})`
        )
        .join("\n")}`;
    }
  },
});

export const extractAndSaveKnowledgeTool = new DynamicStructuredTool({
  name: "extract_and_save_knowledge",
  description:
    "Salva um 'gabarito' de atendimento na Base de Conhecimento (tabela knowledge_base). Use isto quando identificar uma excelente resposta humana para uma dúvida comum.",
  schema: z.object({
    pergunta: z.string().describe("A dúvida exata ou intenção do paciente."),
    resposta_ideal: z.string().describe("A resposta perfeita que a equipe deu (o gabarito)."),
    categoria: z.string().describe("Categoria (ex: 'Financeiro', 'Agendamento', 'Dúvida Médica')."),
    tags: z.string().describe("Palavras-chave separadas por vírgula para facilitar a busca."),
  }),
  func: async ({ pergunta, resposta_ideal, categoria, tags }) => {
    const { error } = await supabase
      .from("knowledge_base")
      .insert({ pergunta, resposta_ideal, categoria, tags });
    if (error) return `Erro ao salvar na base de conhecimento: ${error.message}`;
    return `Gabarito salvo com sucesso na base de conhecimento. (Categoria: ${categoria})`;
  },
});

export const searchKnowledgeBaseTool = new DynamicStructuredTool({
  name: "search_knowledge_base",
  description:
    "Busca na sua Base de Conhecimento (gabaritos) se já existe uma resposta padrão aprovada para a dúvida atual de um paciente.",
  schema: z.object({
    termo_busca: z.string().describe("Palavra-chave ou tema da dúvida para buscar no gabarito."),
  }),
  func: async ({ termo_busca }) => {
    const { data, error } = await supabase
      .from("knowledge_base")
      .select("pergunta, resposta_ideal, categoria")
      .or(`pergunta.ilike.%${termo_busca}%,tags.ilike.%${termo_busca}%`)
      .limit(3);

    if (error) return `Erro ao buscar conhecimento: ${error.message}`;
    if (!data || data.length === 0)
      return "Nenhum gabarito encontrado para este tema na sua base de conhecimento.";

    return `Gabaritos Encontrados:\n${data
      .map((d) => `[Categoria: ${d.categoria}]\nQ: ${d.pergunta}\nR: ${d.resposta_ideal}`)
      .join("\n\n")}`;
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// PASSO 2: FERRAMENTA MAP-REDUCE — deep_research_chats
// ─────────────────────────────────────────────────────────────────────────────

const CHUNK_SIZE = 5;

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function normalizeSenderLabel(sender: string | null): string {
  const s = String(sender ?? "").toUpperCase();
  if (s === "AI_AGENT") return "BOT";
  if (s === "HUMAN_AGENT" || s === "ME") return "SECRETÁRIA";
  if (s === "CONTACT") return "BOT";
  return "PACIENTE";
}

export const deepResearchChatsTool = new DynamicStructuredTool({
  name: "deep_research_chats",
  description:
    "OBRIGATÓRIO: Ferramenta de análise profunda de múltiplos chats via processamento em lote (Map-Reduce). Use sempre que precisar ler 2 ou mais conversas ao mesmo tempo para encontrar padrões, objeções ou resumir situações. Processa os chats em lotes para não estourar a memória.",
  schema: z.object({
    objetivo_da_analise: z
      .string()
      .describe(
        "O objetivo claro da análise (ex: 'Mapear as principais objeções de preço' ou 'Resumir o histórico desses 3 pacientes')."
      ),
    chat_ids: z
      .array(z.number())
      .describe("Lista de IDs numéricos dos chats a serem analisados."),
  }),
  func: async ({ objetivo_da_analise, chat_ids }) => {
    if (chat_ids.length === 0) {
      return "Nenhum chat_id fornecido para análise.";
    }

    const chunks = chunkArray(chat_ids, CHUNK_SIZE);
    const batch_insights: string[] = [];

    // ── MAP: Processa cada lote com um LLM interno ──────────────────────────
    for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
      const chunk = chunks[chunkIdx];
      try {
        const transcripts: string[] = [];

        for (const chatId of chunk) {
          try {
            const { data, error } = await supabase
              .from("chat_messages")
              .select("sender, message_text, bot_message, user_message, message_type, created_at")
              .eq("chat_id", chatId)
              .order("created_at", { ascending: true });

            if (error || !data || data.length === 0) continue;

            const timeline = data
              .map((row) => {
                const content = (
                  row.message_text?.trim() ||
                  row.user_message?.trim() ||
                  row.bot_message?.trim() ||
                  ""
                );
                if (!content || row.message_type === "audio" || row.message_type === "image") {
                  return null;
                }
                const label = normalizeSenderLabel(row.sender);
                return `[${label}]: ${content}`;
              })
              .filter((line): line is string => line !== null)
              .join("\n");

            if (timeline.trim()) {
              transcripts.push(`--- Chat #${chatId} ---\n${timeline}`);
            }
          } catch {
            // Ignora chats individuais que falham sem quebrar o lote
          }
        }

        if (transcripts.length === 0) continue;

        const internalModel = new ChatGoogleGenerativeAI({
          model: "gemini-3-pro-preview",
          apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
          temperature: 0.1,
        });

        const mapPrompt = `Você é um operário de extração de dados. O objetivo principal é: ${objetivo_da_analise}. Leia as transcrições abaixo e extraia apenas os pontos relevantes para o objetivo. Seja conciso. Formate como uma lista de bullets com os achados mais importantes.\n\nTranscrições:\n${transcripts.join("\n\n")}`;

        const response = await internalModel.invoke([new HumanMessage(mapPrompt)]);
        const insight = response.content.toString().trim();
        if (insight) {
          batch_insights.push(insight);
        }
      } catch (error: any) {
        batch_insights.push(`[Erro no lote ${chunkIdx + 1}: ${error.message}]`);
      }
    }

    if (batch_insights.length === 0) {
      return "Nenhum dado relevante encontrado nos chats fornecidos.";
    }

    if (batch_insights.length === 1) {
      return batch_insights[0];
    }

    // ── REDUCE: Consolida todos os insights em um único relatório ───────────
    try {
      const consolidationModel = new ChatGoogleGenerativeAI({
        model: "gemini-3-pro-preview",
        apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
        temperature: 0.1,
      });

      const reducePrompt = `Aqui estão as análises parciais de ${batch_insights.length} lotes de conversas. Consolide-as em um único relatório estruturado focado no objetivo: "${objetivo_da_analise}". Remova duplicações, agrupe por tema e organize por relevância/frequência.\n\n${batch_insights
        .map((insight, i) => `=== Análise do Lote ${i + 1} ===\n${insight}`)
        .join("\n\n")}`;

      const consolidated = await consolidationModel.invoke([new HumanMessage(reducePrompt)]);
      return consolidated.content.toString();
    } catch {
      return batch_insights.join("\n\n---\n\n");
    }
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS (Removido query_database_table e get_database_schema)
// ─────────────────────────────────────────────────────────────────────────────

export const claraTools = [
  readBrainFilesTool,
  updateBrainFileTool,
  manageLongTermMemoryTool,
  extractAndSaveKnowledgeTool,
  searchKnowledgeBaseTool,
];