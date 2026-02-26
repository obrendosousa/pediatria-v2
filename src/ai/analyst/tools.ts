import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/automation/adapters/supabaseAdmin";

type ChatRow = {
  id: number;
  contact_name: string | null;
  phone: string | null;
  stage: string | null;
  ai_sentiment: string | null;
  last_interaction_at: string | null;
  ai_summary: string | null;
  created_at: string | null;
  status: string | null;
};

type ChatMessageRow = {
  chat_id: number;
  sender: string | null;
  message_text: string | null;
  bot_message: string | null;
  user_message: string | null;
  message_type: string | null;
  created_at: string | null;
};

const MAX_LIMIT = 50;

function parseIsoDateOrThrow(value: string, fieldName: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Parametro invalido: ${fieldName} precisa ser uma data ISO valida.`);
  }
  return parsed;
}

function parseDateInput(value: string, fieldName: string, isEnd: boolean): Date {
  const dateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (dateOnlyRegex.test(value)) {
    // Interpreta datas curtas no fuso da operacao (America/Sao_Paulo).
    const withTime = isEnd ? `${value}T23:59:59.999-03:00` : `${value}T00:00:00.000-03:00`;
    return parseIsoDateOrThrow(withTime, fieldName);
  }
  return parseIsoDateOrThrow(value, fieldName);
}

function normalizeDateRange(start_date: string, end_date: string) {
  const start = parseDateInput(start_date, "start_date", false);
  const end = parseDateInput(end_date, "end_date", true);
  if (start > end) {
    throw new Error("Parametro invalido: start_date nao pode ser maior que end_date.");
  }
  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

function normalizeCascadeRole(row: ChatMessageRow): "patient" | "bot" | "secretary" {
  const sender = String(row.sender ?? "").toUpperCase();

  if (sender === "AI_AGENT") return "bot";
  if (sender === "HUMAN_AGENT" || sender === "ME") return "secretary";
  if (sender === "CUSTOMER") return "patient";

  // Fallback por conteudo quando sender nao vier padronizado.
  if (row.bot_message && !row.user_message) return "bot";
  if (row.user_message && !row.bot_message) return "patient";

  return "patient";
}

function normalizeCascadeContent(row: ChatMessageRow): string {
  const content =
    row.message_text?.trim() ||
    row.user_message?.trim() ||
    row.bot_message?.trim() ||
    "";
  return content;
}

// ----------------------------------------------------------------------
// SCHEMAS REVISADOS: Removidas as validacoes estritas (min, max, int)
// para evitar que o LangChain envie JSON schemas incompativeis com o Gemini.
// ----------------------------------------------------------------------

const attendanceOverviewSchema = z.object({
  start_date: z.string().describe("Data inicial em ISO string."),
  end_date: z.string().describe("Data final em ISO string."),
});

const filteredChatsSchema = z.object({
  stage: z.string().optional().describe("Filtra por stage do chat."),
  sentiment: z.string().optional().describe("Filtra por ai_sentiment."),
  is_stalled: z
    .boolean()
    .optional()
    .default(false)
    .describe("Se true, busca chats ativos sem interacao nas ultimas 24h."),
  limit: z
    .number()
    .optional()
    .default(10)
    .describe("Quantidade maxima de chats retornados (max 50)."),
});

const chatCascadeSchema = z.object({
  chat_id: z.number().describe("ID numerico do chat."),
});

const keywordSearchSchema = z.object({
  keyword: z.string().describe("Termo para busca textual nas mensagens."),
});

const aggregatedInsightsSchema = z.object({
  start_date: z.string().describe("Data inicial em ISO string."),
  end_date: z.string().describe("Data final em ISO string."),
});

// ----------------------------------------------------------------------
// TOOLS
// ----------------------------------------------------------------------

export const getAttendanceOverviewMetricsTool = new DynamicStructuredTool({
  name: "get_attendance_overview_metrics",
  description:
    "Retorna metricas agregadas do periodo: total de chats, agrupamento por stage e por sentimento.",
  schema: attendanceOverviewSchema,
  func: async ({ start_date, end_date }) => {
    const { startIso, endIso } = normalizeDateRange(start_date, end_date);
    const supabase = getSupabaseAdminClient();

    const { count, error: totalError } = await supabase
      .from("chats")
      .select("id", { count: "exact", head: true })
      .gte("last_interaction_at", startIso)
      .lte("last_interaction_at", endIso);

    if (totalError) {
      throw new Error(`Falha ao consultar total de chats: ${totalError.message}`);
    }

    const pageSize = 1000;
    let offset = 0;
    const allRows: Array<Pick<ChatRow, "stage" | "ai_sentiment">> = [];

    while (true) {
      const { data, error } = await supabase
        .from("chats")
        .select("stage, ai_sentiment")
        .gte("last_interaction_at", startIso)
        .lte("last_interaction_at", endIso)
        .range(offset, offset + pageSize - 1);

      if (error) {
        throw new Error(`Falha ao consultar agrupamentos: ${error.message}`);
      }

      if (!data || data.length === 0) break;
      allRows.push(...(data as Array<Pick<ChatRow, "stage" | "ai_sentiment">>));
      if (data.length < pageSize) break;
      offset += pageSize;
    }

    const byStage: Record<string, number> = {};
    const bySentiment: Record<string, number> = {};

    for (const row of allRows) {
      const stage = row.stage?.trim() || "unknown";
      const sentiment = row.ai_sentiment?.trim() || "unknown";
      byStage[stage] = (byStage[stage] ?? 0) + 1;
      bySentiment[sentiment] = (bySentiment[sentiment] ?? 0) + 1;
    }

    return JSON.stringify({
      period: { start_date: startIso, end_date: endIso },
      metric_basis: "last_interaction_at",
      total_chats: count ?? 0,
      by_stage: byStage,
      by_sentiment: bySentiment,
    });
  },
});

export const getFilteredChatsListTool = new DynamicStructuredTool({
  name: "get_filtered_chats_list",
  description:
    "Retorna lista de chats por filtros de stage, sentimento e estagnacao (24h sem interacao).",
  schema: filteredChatsSchema,
  func: async ({ stage, sentiment, is_stalled = false, limit = 10 }) => {
    // A trava de seguranca do limite (max 50) e feita aqui no codigo.
    const safeLimit = Math.min(Math.max(limit, 1), MAX_LIMIT);
    const supabase = getSupabaseAdminClient();

    let query = supabase
      .from("chats")
      .select("id, contact_name, phone, stage, ai_sentiment, last_interaction_at, ai_summary, status")
      .order("last_interaction_at", { ascending: true })
      .limit(safeLimit);

    if (stage) query = query.eq("stage", stage);
    if (sentiment) query = query.eq("ai_sentiment", sentiment);

    if (is_stalled) {
      const threshold = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      query = query.eq("status", "ACTIVE").lt("last_interaction_at", threshold);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Falha ao consultar lista de chats: ${error.message}`);
    }

    return JSON.stringify({
      filters: { stage: stage ?? null, sentiment: sentiment ?? null, is_stalled },
      total: data?.length ?? 0,
      chats: (data ?? []) as ChatRow[],
    });
  },
});

export const getChatCascadeHistoryTool = new DynamicStructuredTool({
  name: "get_chat_cascade_history",
  description:
    "Retorna historico cronologico normalizado de um chat para auditoria detalhada.",
  schema: chatCascadeSchema,
  func: async ({ chat_id }) => {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("chat_messages")
      .select("chat_id, sender, message_text, bot_message, user_message, message_type, created_at")
      .eq("chat_id", chat_id)
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(`Falha ao consultar cascata do chat ${chat_id}: ${error.message}`);
    }

    const timeline = ((data ?? []) as ChatMessageRow[])
      .map((row) => ({
        role: normalizeCascadeRole(row),
        content: normalizeCascadeContent(row),
        timestamp: row.created_at ?? "",
        message_type: row.message_type ?? "unknown",
      }))
      .filter((item) => item.content.length > 0);

    return JSON.stringify({
      chat_id,
      total_messages: timeline.length,
      timeline,
    });
  },
});

export const searchChatsByKeywordTool = new DynamicStructuredTool({
  name: "search_chats_by_keyword",
  description:
    "Busca termos em mensagens e retorna os chats relacionados com amostras de contexto.",
  schema: keywordSearchSchema,
  func: async ({ keyword }) => {
    const term = keyword.trim();
    if (!term) {
      throw new Error("Parametro invalido: keyword nao pode ser vazia.");
    }

    const supabase = getSupabaseAdminClient();
    const searchExpr = `%${term}%`;
    const { data: hits, error: hitsError } = await supabase
      .from("chat_messages")
      .select("chat_id, message_text, user_message, created_at")
      .or(`message_text.ilike.${searchExpr},user_message.ilike.${searchExpr}`)
      .order("created_at", { ascending: false })
      .limit(200);

    if (hitsError) {
      throw new Error(`Falha na busca por palavra-chave: ${hitsError.message}`);
    }

    const normalizedHits = (hits ?? []) as Array<{
      chat_id: number;
      message_text: string | null;
      user_message: string | null;
      created_at: string | null;
    }>;

    const uniqueChatIds = Array.from(new Set(normalizedHits.map((h) => h.chat_id))).slice(0, 50);
    if (uniqueChatIds.length === 0) {
      return JSON.stringify({
        keyword: term,
        total_matches: 0,
        chats: [],
      });
    }

    const { data: chats, error: chatsError } = await supabase
      .from("chats")
      .select("id, contact_name, phone, stage, ai_sentiment, last_interaction_at, ai_summary")
      .in("id", uniqueChatIds);

    if (chatsError) {
      throw new Error(`Falha ao carregar chats relacionados: ${chatsError.message}`);
    }

    const chatMap = new Map<number, ChatRow>();
    for (const chat of (chats ?? []) as ChatRow[]) {
      chatMap.set(chat.id, chat);
    }

    const groupedHits: Record<number, { hit_count: number; samples: string[] }> = {};
    for (const hit of normalizedHits) {
      if (!groupedHits[hit.chat_id]) {
        groupedHits[hit.chat_id] = { hit_count: 0, samples: [] };
      }
      groupedHits[hit.chat_id].hit_count += 1;
      const text = (hit.message_text || hit.user_message || "").trim();
      if (text && groupedHits[hit.chat_id].samples.length < 3) {
        groupedHits[hit.chat_id].samples.push(text);
      }
    }

    const results = uniqueChatIds
      .map((chatId) => {
        const chat = chatMap.get(chatId);
        if (!chat) return null;
        return {
          chat,
          hit_count: groupedHits[chatId]?.hit_count ?? 0,
          samples: groupedHits[chatId]?.samples ?? [],
        };
      })
      .filter(Boolean);

    return JSON.stringify({
      keyword: term,
      total_matches: normalizedHits.length,
      chats: results,
    });
  },
});

export const getAggregatedInsightsTool = new DynamicStructuredTool({
  name: "get_aggregated_insights",
  description:
    "Ferramenta OBRIGATÓRIA para resumos e relatórios de alto nível. Consulta a tabela de chat_insights e traz estatísticas agregadas ultra-rápidas do período: tópicos mais frequentes, principais objeções e decisões tomadas. Use para responder perguntas amplas antes de detalhar.",
  schema: aggregatedInsightsSchema,
  func: async ({ start_date, end_date }) => {
    const { startIso, endIso } = normalizeDateRange(start_date, end_date);
    const supabase = getSupabaseAdminClient();

    const pageSize = 1000;
    let offset = 0;
    const allInsights: Array<{ topico: string | null; decisao: string | null; novo_conhecimento: boolean | null }> = [];

    while (true) {
      const { data, error } = await supabase
        .from("chat_insights")
        .select("topico, decisao, novo_conhecimento")
        .gte("created_at", startIso)
        .lte("created_at", endIso)
        .range(offset, offset + pageSize - 1);

      if (error) {
        throw new Error(`Falha ao consultar insights agregados: ${error.message}`);
      }
      if (!data || data.length === 0) break;

      allInsights.push(...data as any[]);
      if (data.length < pageSize) break;
      offset += pageSize;
    }

    const topicsCount: Record<string, number> = {};
    const decisionsCount: Record<string, number> = {};
    let novosConhecimentosCount = 0;

    for (const row of allInsights) {
      const topic = row.topico?.trim() || "Indefinido";
      const decision = row.decisao?.trim() || "Indefinido";
      topicsCount[topic] = (topicsCount[topic] || 0) + 1;
      decisionsCount[decision] = (decisionsCount[decision] || 0) + 1;
      if (row.novo_conhecimento) novosConhecimentosCount++;
    }

    const sortMap = (map: Record<string, number>) => Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([k, v]) => `${k} (${v}x)`);

    return JSON.stringify({
      period: { start_date: startIso, end_date: endIso },
      total_insights_analisados: allInsights.length,
      top_topicos: sortMap(topicsCount),
      top_decisoes_e_objecoes: sortMap(decisionsCount),
      novos_conhecimentos_extraidos: novosConhecimentosCount
    });
  },
});

export const analystTools = [
  getAttendanceOverviewMetricsTool,
  getFilteredChatsListTool,
  getChatCascadeHistoryTool,
  searchChatsByKeywordTool,
  getAggregatedInsightsTool,
];