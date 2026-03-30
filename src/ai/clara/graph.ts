import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { z } from "zod";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — @langchain/langgraph ships without declaration files; global d.ts in src/types/langgraph.d.ts
import { END, START, StateGraph, messagesStateReducer } from "@langchain/langgraph";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — @langchain/langgraph/prebuilt ships without declaration files
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { getSupabaseAdminClient } from "@/lib/automation/adapters/supabaseAdmin";
import { postgresCheckpointer } from "./checkpointer";

import { claraTools, setCurrentTemporalAnchor } from "./tools";
import { getFilteredChatsListTool, getChatCascadeHistoryTool, getAggregatedInsightsTool } from "@/ai/analyst/tools";
import { claraVaultTools } from "@/ai/vault/tools";
import { researcherGraph } from "./researcher_graph";
import { buildClaraSystemPrompt, CLARA_SYSTEM_PROMPT } from "./system_prompt";
import { CLARA_COMPANY } from "./company";
import { CLARA_RULES } from "./rules";

// Clara 2.0 imports
import type { TemporalAnchor } from "./temporal_anchor";
import { resolveTemporalAnchor } from "./temporal_anchor";
import type { DbStats } from "./db_stats";
import { getDbStats } from "./db_stats";
import type { LoadedContext } from "./load_context";
import { loadContextForInteraction } from "./load_context";
import { compactMessages } from "./context_compactor";
import { extractSpotCheckData, spotCheckCitations, type SpotCheckResult } from "./spot_check_verifier";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos auxiliares para respostas LLM e Supabase não-tipado
// ─────────────────────────────────────────────────────────────────────────────

interface LLMContentPart {
  text?: string;
}

interface ResearcherResult {
  compressed_research?: string;
  raw_notes?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// ESTADO PRINCIPAL DA CLARA 2.0
// ─────────────────────────────────────────────────────────────────────────────

export interface ClaraState {
  messages: BaseMessage[];
  chat_id: number;
  current_user_role: "admin" | "doctor" | "receptionist" | "patient" | "system";
  research_brief: string;
  raw_notes: string[];
  supervisor_messages: BaseMessage[];
  supervisor_iteration: number;
  research_complete: boolean;
  is_deep_research: boolean;
  is_planning_mode: boolean;

  // Clara 2.0 — novos campos
  temporal_anchor: TemporalAnchor | null;
  db_stats: DbStats | null;
  loaded_context: LoadedContext | null;
  spot_check_result: SpotCheckResult | null;
  pending_question: string | null;
  tool_call_count: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────────────────────

const MAX_SUPERVISOR_ITERATIONS = 2; // 3→2: rodada 3 foi sistematicamente vazia nos logs (economia ~30-60s)
const MAX_TOOL_CALL_ITERATIONS = 10; // 20→10: previne recursion limit e custo desnecessário

// ─────────────────────────────────────────────────────────────────────────────
// FERRAMENTAS DO SIMPLE_AGENT
// ─────────────────────────────────────────────────────────────────────────────

// Clara 2.0: removidas deepResearchChatsTool e gerarRelatorioQualidadeTool.
// Adicionadas: analyzeRawConversationsTool, askUserQuestionTool, updateChatClassificationTool (via claraTools).
// Vault tools: acesso completo ao cerebro compartilhado (leitura, busca, escrita de memorias, config, decisoes).
const simpleAgentTools = [
  ...claraTools,
  ...claraVaultTools,
  getFilteredChatsListTool,
  getChatCascadeHistoryTool,
  getAggregatedInsightsTool,
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS DE PROMPT DINÂMICO
// ─────────────────────────────────────────────────────────────────────────────

async function loadDynamicPromptParts(): Promise<{
  company: string;
  custom_rules: string;
  voice_rules: string;
}> {
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("agent_config")
      .select("config_key, content")
      .eq("agent_id", "clara")
      .in("config_key", ["company", "rules", "voice_rules"]);

    if (error || !data || data.length === 0) {
      return { company: CLARA_COMPANY, custom_rules: CLARA_RULES, voice_rules: "" };
    }

    const map = Object.fromEntries(
      (data as Array<{ config_key: string; content: string }>).map((row) => [row.config_key, row.content])
    );
    return {
      company: map.company ?? CLARA_COMPANY,
      custom_rules: map.rules ?? CLARA_RULES,
      voice_rules: map.voice_rules ?? "",
    };
  } catch {
    return { company: CLARA_COMPANY, custom_rules: CLARA_RULES, voice_rules: "" };
  }
}

/**
 * Sanitiza mensagens para conformidade com a API do Gemini:
 * 1. Colapsa parallel tool calls (N tool_calls + N ToolMessages) em par 1:1
 * 2. Remove ToolMessages órfãos (sem AIMessage com tool_calls precedente)
 * 3. Converte AIMessage com tool_calls sem ToolMessages seguintes em texto
 * 4. Insere AIMessage ponte entre ToolMessage→HumanMessage para manter
 *    alternância user↔model (Gemini não aceita 2 user turns consecutivos)
 */
function sanitizeMessagesForGemini(messages: BaseMessage[]): BaseMessage[] {
  const result: BaseMessage[] = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const type = msg._getType();

    if (type === "ai" && (msg as AIMessage).tool_calls?.length) {
      const aiMsg = msg as AIMessage;
      const toolMsgs: ToolMessage[] = [];
      let j = i + 1;
      while (j < messages.length && messages[j]._getType() === "tool") {
        toolMsgs.push(messages[j] as ToolMessage);
        j++;
      }

      if (toolMsgs.length > 0) {
        // Merge todas as tool responses em um par 1:1
        const firstCall = aiMsg.tool_calls![0];
        const mergedContent = toolMsgs
          .map((tm) => {
            const name = tm.name || "tool";
            const content = typeof tm.content === "string" ? tm.content : JSON.stringify(tm.content);
            return `[${name}]\n${content}`;
          })
          .join("\n\n---\n\n");

        result.push(new AIMessage({ content: aiMsg.content, tool_calls: [firstCall] }));
        result.push(new ToolMessage({ content: mergedContent, tool_call_id: firstCall.id || "", name: firstCall.name }));

        // Ponte: se próximo é HumanMessage, Gemini veria 2 user turns
        // (ToolMessage=user/functionResponse + HumanMessage=user/text). Inserir AI ponte.
        if (j < messages.length && messages[j]._getType() === "human") {
          result.push(new AIMessage({ content: "Certo, prosseguindo." }));
        }

        i = j - 1;
      } else {
        // AIMessage com tool_calls mas sem ToolMessages → órfão, converte p/ texto
        const text = typeof aiMsg.content === "string" && aiMsg.content.trim()
          ? aiMsg.content
          : "Processando...";
        result.push(new AIMessage({ content: text }));
      }
    } else if (type === "tool") {
      // ToolMessage órfão (sem AIMessage com tool_calls antes) → pular
      continue;
    } else {
      result.push(msg);
    }
  }

  return result;
}

/** Extrai texto de conteúdo LLM que pode ser string ou array de partes */
function extractLLMText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return (content as LLMContentPart[]).map((c) => c?.text ?? "").join("");
  }
  return "";
}

// ─────────────────────────────────────────────────────────────────────────────
// WORKFLOW
// ─────────────────────────────────────────────────────────────────────────────

const claraWorkflow = new StateGraph<ClaraState>({
  channels: {
    messages: {
      reducer: messagesStateReducer,
      default: () => [] as BaseMessage[],
    },
    chat_id: {
      reducer: (_x: number, y: number) => y ?? _x,
      default: () => 0,
    },
    current_user_role: {
      reducer: (_x: ClaraState["current_user_role"], y: ClaraState["current_user_role"]) => y ?? _x ?? "patient",
      default: () => "patient" as const,
    },
    research_brief: {
      reducer: (_x: string, y: string) => y ?? _x ?? "",
      default: () => "",
    },
    raw_notes: {
      reducer: (x: string[], y: string | string[]) => {
        if (Array.isArray(y) && y.length === 0) return [];
        const items = Array.isArray(y) ? y : typeof y === "string" ? [y] : [];
        return [...(x ?? []), ...items.filter(Boolean)];
      },
      default: () => [] as string[],
    },
    supervisor_messages: {
      reducer: (x: BaseMessage[], y: BaseMessage[] | BaseMessage) => {
        if (Array.isArray(y) && y.length === 0) return [];
        const incoming = Array.isArray(y) ? y : [y];
        return [...(x ?? []), ...incoming];
      },
      default: () => [] as BaseMessage[],
    },
    supervisor_iteration: {
      reducer: (_x: number, y: number) => (typeof y === "number" ? y : _x ?? 0),
      default: () => 0,
    },
    research_complete: {
      reducer: (_x: boolean, y: boolean) => (typeof y === "boolean" ? y : _x ?? false),
      default: () => false,
    },
    is_deep_research: {
      reducer: (_x: boolean, y: boolean) => (typeof y === "boolean" ? y : _x ?? false),
      default: () => false,
    },
    is_planning_mode: {
      reducer: (_x: boolean, y: boolean) => (typeof y === "boolean" ? y : _x ?? false),
      default: () => false,
    },
    // Clara 2.0 — novos canais
    temporal_anchor: {
      reducer: (_x: TemporalAnchor | null, y: TemporalAnchor | null | undefined) => y === undefined ? (_x ?? null) : y,
      default: () => null as TemporalAnchor | null,
    },
    db_stats: {
      reducer: (_x: DbStats | null, y: DbStats | null | undefined) => y === undefined ? (_x ?? null) : y,
      default: () => null as DbStats | null,
    },
    loaded_context: {
      reducer: (_x: LoadedContext | null, y: LoadedContext | null | undefined) => y === undefined ? (_x ?? null) : y,
      default: () => null as LoadedContext | null,
    },
    spot_check_result: {
      reducer: (_x: SpotCheckResult | null, y: SpotCheckResult | null | undefined) => y === undefined ? (_x ?? null) : y,
      default: () => null as SpotCheckResult | null,
    },
    pending_question: {
      reducer: (_x: string | null, y: string | null | undefined) => y === undefined ? (_x ?? null) : y,
      default: () => null as string | null,
    },
    tool_call_count: {
      reducer: (_x: number, y: number) => (typeof y === "number" ? y : _x ?? 0),
      default: () => 0,
    },
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// NODE 0: load_context_node (Clara 2.0 — roda ANTES do classify)
// Resolve temporal anchor, carrega DB stats e Auto-RAG em paralelo.
// ─────────────────────────────────────────────────────────────────────────────

claraWorkflow.addNode("load_context_node", async (state: ClaraState) => {
  const lastMessage = state.messages[state.messages.length - 1];
  const userText =
    typeof lastMessage?.content === "string"
      ? lastMessage.content
      : Array.isArray(lastMessage?.content)
        ? (lastMessage.content as Array<{ type: string; text?: string }>)
          .filter((c) => c.type === "text")
          .map((c) => c.text ?? "")
          .join(" ")
        : "";

  // Extrair apenas a pergunta do usuário (remover o contexto do copilot wrapper)
  const questionMatch = new RegExp("PERGUNTA DO USUÁRIO:\\s*(.+?)(?:\\n|INSTRUÇÕES CRÍTICAS)", "s").exec(userText);
  const pureQuestion = questionMatch ? questionMatch[1].trim() : userText;

  // Multi-turn: usar temporal_anchor anterior como referência
  const previousAnchor = state.temporal_anchor ?? null;

  // Paralelizar: temporal anchor + DB stats + Auto-RAG
  const [temporalAnchor, dbStats, loadedContext] = await Promise.all([
    Promise.resolve(resolveTemporalAnchor(pureQuestion, previousAnchor)),
    getDbStats(),
    loadContextForInteraction(pureQuestion, state.chat_id).catch(() => null),
  ]);

  // Definir temporal anchor no módulo tools para validação de queries
  setCurrentTemporalAnchor(temporalAnchor);

  return {
    temporal_anchor: temporalAnchor,
    db_stats: dbStats,
    loaded_context: loadedContext,
  };
});

// ─────────────────────────────────────────────────────────────────────────────
// NODE 1: classify_node
// ─────────────────────────────────────────────────────────────────────────────

const SIMPLE_KEYWORDS = [
  "oi", "olá", "ola", "tudo bem", "bom dia", "boa tarde", "boa noite",
  "obrigado", "obrigada", "valeu", "ok", "certo", "entendi", "beleza", "ótimo", "otimo",
];

const ACTION_VERBS = [
  "faz", "faca", "cria", "escreve", "manda", "envia", "gera", "prepara",
  "agenda", "monta", "marca", "registra", "salva", "atualiza", "mostra",
  "lista", "busca", "verifica", "confere", "abre", "me da", "me fala",
];

const ClassifySchema = z.object({
  classification: z
    .enum(["simple", "research"])
    .describe("'simple' para conversa/pergunta direta. 'research' para análise de dados, relatórios ou investigação de múltiplos chats."),
  reasoning: z.string().describe("Justificativa em 1 frase."),
});

claraWorkflow.addNode("classify_node", async (state: ClaraState) => {
  const lastMessage = state.messages[state.messages.length - 1];
  const userText =
    typeof lastMessage?.content === "string"
      ? lastMessage.content
      : Array.isArray(lastMessage?.content)
        ? (lastMessage.content as Array<{ type: string; text?: string }>)
          .filter((c) => c.type === "text")
          .map((c) => c.text ?? "")
          .join(" ")
        : "";

  const researchStateReset = {
    research_complete: false,
    research_brief: "",
    raw_notes: [] as string[],
    supervisor_messages: [] as BaseMessage[],
    supervisor_iteration: 0,
    is_planning_mode: false,
    tool_call_count: 0,
  };

  console.log(`[classify_node] userText (${userText.length} chars): "${userText.substring(0, 120)}..."`);

  // Detecta [PLANEJAR] em qualquer posição (pode ser precedido por [NOTAS INTERNAS...])
  if (userText.includes("[PLANEJAR]")) {
    console.log("[classify_node] → PLANEJAR detectado → research + planning_mode");
    return { ...researchStateReset, is_deep_research: true, is_planning_mode: true };
  }

  const lower = userText.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const isGreeting = SIMPLE_KEYWORDS.some(
    (kw) => lower === kw || lower.startsWith(kw + " ") || lower.endsWith(" " + kw)
  );
  const isActionRequest = ACTION_VERBS.some(
    (v) => lower.startsWith(v + " ") || lower.startsWith(v + ",")
  );
  // Palavras que indicam análise — não devem ser capturadas pelo fast-path
  const ANALYSIS_KEYWORDS = ["analis", "relat", "desempenho", "qualidade", "gargalo", "obje", "avali", "funil", "perda", "atendimento"];
  const looksLikeAnalysis = ANALYSIS_KEYWORDS.some(k => lower.includes(k));

  if (isGreeting) {
    return { ...researchStateReset, is_deep_research: false };
  }
  if (isActionRequest && !looksLikeAnalysis) {
    return { ...researchStateReset, is_deep_research: false };
  }

  const today = new Date().toISOString().slice(0, 10);

  const CLASSIFIER_SYSTEM = `Você é um roteador de intenções para a Clara, assistente de clínica médica.

Hoje: ${today}

REGRA DE DECISÃO:

"simple" = Clara responde com suas ferramentas diretas (SQL, analyze_raw_conversations, busca).
           Cobre desde perguntas simples até análises aprofundadas de um tema específico.

"research" = Pipeline com múltiplos pesquisadores paralelos especializados.
             Só quando a pergunta exige investigar VÁRIOS EIXOS SIMULTANEAMENTE
             (ex: qualidade + financeiro + gargalos + script da equipe, tudo junto).

→ EXEMPLOS "simple" (a maioria das situações):
  • "Quantas conversas tivemos esta semana?" → simple
  • "Qual o impacto financeiro das urgências?" → simple
  • "Analise os chats de pacientes que reclamaram de demora" → simple
  • "Me dá um relatório de objeções de preço" → simple
  • "Como está o atendimento da Joana?" → simple
  • "Onde estamos perdendo mais pacientes?" → simple
  • "Analisa com mais profundidade X" → simple
  • Qualquer pergunta sobre UM tema específico → simple

→ EXEMPLOS "research" (raramente necessário):
  • "Relatório executivo completo da semana com análise de qualidade, finanças, gargalos e oportunidades" → research
  • "Auditoria 360° da operação" → research
  • "Relatório profissional para apresentar para investidores" → research

REGRA: Na dúvida → simple. O simple_agent é poderoso e responde bem a análises focadas.
Use research APENAS quando o escopo for genuinamente multi-dimensional e o usuário pedir explicitamente.`;

  try {
    const classifierModel = new ChatGoogleGenerativeAI({
      model: "gemini-3.1-pro-preview",
      apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
      temperature: 0,
    }).withStructuredOutput(ClassifySchema);

    const result = await classifierModel.invoke([
      new SystemMessage(CLASSIFIER_SYSTEM),
      new HumanMessage(userText),
    ]);

    return {
      ...researchStateReset,
      is_deep_research: result.classification === "research",
    };
  } catch {
    return { ...researchStateReset, is_deep_research: false };
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// NODE 2: simple_agent (Clara 2.0 — usa buildClaraSystemPrompt)
// ─────────────────────────────────────────────────────────────────────────────

claraWorkflow.addNode("simple_agent", async (state: ClaraState) => {
  const { company, custom_rules, voice_rules } = await loadDynamicPromptParts();

  const model = new ChatGoogleGenerativeAI({
    model: "gemini-3.1-pro-preview", // Pro para máxima inteligência nas análises com Brendo
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
    temperature: 0.3,
  });

  const modelWithTools = model.bindTools(simpleAgentTools);

  // Clara 2.0: usa buildClaraSystemPrompt com temporal anchor, DB stats e memória
  const systemPrompt = buildClaraSystemPrompt({
    company,
    rules: custom_rules,
    voiceRules: voice_rules,
    chatId: state.chat_id,
    userRole: state.current_user_role,
    temporalAnchor: state.temporal_anchor,
    dbStats: state.db_stats,
    loadedContext: state.loaded_context,
  });

  // Clara 2.0: compacta mensagens longas
  const compactedMessages = await compactMessages(
    state.messages.length > 0 ? state.messages : [new HumanMessage("Olá.")]
  );

  // Fix: Gemini não suporta parallel tool calls com múltiplos ToolMessages separados
  const sanitizedMessages = sanitizeMessagesForGemini(compactedMessages);

  // Debug: log types para diagnóstico de erros Gemini
  console.log("[simple_agent] msgs:", sanitizedMessages.map((m) => m._getType?.() || (m as unknown as Record<string, unknown>).type || "unknown").join(" → "));

  let response: AIMessage;
  try {
    response = (await modelWithTools.invoke([
      new SystemMessage(systemPrompt),
      ...sanitizedMessages,
    ])) as AIMessage;
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("[simple_agent] Erro na invocação:", errMsg.substring(0, 300));
    // Se Gemini recusar o formato, tenta com apenas a última HumanMessage (sem histórico)
    if (errMsg.includes("function call turn") || errMsg.includes("function response turn")) {
      console.warn("[simple_agent] Gemini rejeitou histórico, tentando sem contexto anterior...");
      const lastHuman = [...compactedMessages].reverse().find((m) => m._getType?.() === "human") || new HumanMessage("Olá.");
      response = (await modelWithTools.invoke([
        new SystemMessage(systemPrompt),
        lastHuman,
      ])) as AIMessage;
    } else {
      throw err;
    }
  }

  // Debug: conteúdo da resposta
  const contentStr = typeof response.content === "string" ? response.content : JSON.stringify(response.content);
  const hasToolCalls = response.tool_calls && response.tool_calls.length > 0;
  console.log(`[simple_agent] response: content=${contentStr.length} chars, tool_calls=${hasToolCalls ? response.tool_calls!.length : 0}`);

  // Limita a 1 tool call por turno para evitar o mesmo problema no próximo ciclo
  if (response.tool_calls && response.tool_calls.length > 1) {
    return {
      messages: [new AIMessage({ content: response.content, tool_calls: [response.tool_calls[0]] })],
    };
  }

  // Guard: se não tem tool calls E content é vazio, retry com prompt simplificado
  if (!hasToolCalls && contentStr.trim().length === 0) {
    console.warn("[simple_agent] Resposta vazia sem tool calls — tentando retry...");
    const lastHuman = [...compactedMessages].reverse().find((m) => m._getType?.() === "human") || new HumanMessage("Olá.");
    const retryResponse = (await modelWithTools.invoke([
      new SystemMessage(systemPrompt),
      lastHuman,
    ])) as AIMessage;
    const retryContent = typeof retryResponse.content === "string" ? retryResponse.content : JSON.stringify(retryResponse.content);
    console.log(`[simple_agent] retry: content=${retryContent.length} chars`);
    return { messages: [retryResponse] };
  }

  return { messages: [response] };
});

claraWorkflow.addNode("tools", new ToolNode(simpleAgentTools));

// ─────────────────────────────────────────────────────────────────────────────
// NODE 2.5: spot_check_node (Clara 2.0 — verifica citações após tool calls)
// ─────────────────────────────────────────────────────────────────────────────

claraWorkflow.addNode("spot_check_node", async (state: ClaraState) => {
  const lastMessage = state.messages[state.messages.length - 1];
  const content = typeof lastMessage?.content === "string" ? lastMessage.content : "";

  // Incrementar contador de tool calls
  const newCount = (state.tool_call_count ?? 0) + 1;

  // Só executa spot-check se o último tool output contém __SPOT_CHECK_DATA__
  if (!content.includes("__SPOT_CHECK_DATA__")) {
    return { tool_call_count: newCount };
  }

  try {
    const citations = extractSpotCheckData(content);
    if (citations.length === 0) return {};

    const supabase = getSupabaseAdminClient();
    const result = await spotCheckCitations(citations, supabase);

    return { spot_check_result: result, tool_call_count: newCount };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn("[spot_check_node] Erro no spot-check:", message);
    return { tool_call_count: newCount };
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// NODE 3: write_research_brief_node
// ─────────────────────────────────────────────────────────────────────────────

claraWorkflow.addNode("write_research_brief_node", async (state: ClaraState) => {
  const lastMessage = state.messages[state.messages.length - 1];
  const userText =
    typeof lastMessage?.content === "string"
      ? lastMessage.content.replace(/\[PLANEJAR\]\s*/gi, "").trim()
      : Array.isArray(lastMessage?.content)
        ? (lastMessage.content as Array<{ type: string; text?: string }>)
          .filter((c) => c.type === "text")
          .map((c) => c.text ?? "")
          .join(" ")
          .replace(/\[PLANEJAR\]\s*/gi, "")
          .trim()
        : "";

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  // Clara 2.0: inclui temporal anchor no brief
  const temporalInfo = state.temporal_anchor
    ? `\nPERÍODO RESOLVIDO: ${state.temporal_anchor.period_label}\nSQL start: ${state.temporal_anchor.sql_start}\nSQL end: ${state.temporal_anchor.sql_end}`
    : "";

  const BRIEF_SYSTEM = `Você é o Estrategista de Pesquisa da Clara. Transforme a solicitação em um plano de pesquisa estruturado.

Hoje: ${today} | Ontem: ${yesterday}${temporalInfo}

BANCO DE DADOS:
• chats: id, phone, contact_name, stage, ai_sentiment, last_interaction_at, is_archived
• chat_messages: id, chat_id, sender, message_text, created_at
  - sender: 'AI_AGENT'=bot | 'HUMAN_AGENT'=secretária | 'CUSTOMER'=paciente
• patients, appointments, sales, financial_transactions, medical_records

FERRAMENTAS:
• get_volume_metrics(start_date, end_date) — volume de conversas/mensagens
• execute_sql(sql) — consultas SQL (SELECT/WITH, datas BRT)
• analyze_raw_conversations(start_date, end_date, analysis_goals) — análise qualitativa
• get_filtered_chats_list — listar chats com filtros
• get_chat_cascade_history — histórico de um chat

REGRAS DO BRIEF:
1. SEMPRE inclua tarefa QUALITATIVA: analyze_raw_conversations com per_chat_classification=true e analysis_goals detalhados
2. SEMPRE inclua tarefa QUANTITATIVA: execute_sql (funil por stage, contagens) ou get_volume_metrics
3. Se envolve pacientes/leads: cruzamento chats × stages × sentimentos via SQL
4. Especifique analysis_goals DETALHADOS (ex: "classificar cada chat: agendou/desistiu/preço/vaga/sem resposta")
5. Inclua tarefa para identificar FUROS FINANCEIROS: pacientes perdidos por falta de vaga, demora, preço

Escreva um brief conciso (máx 300 palavras) com tarefas numeradas e ferramentas explícitas.`;

  const model = new ChatGoogleGenerativeAI({
    model: "gemini-3.1-pro-preview",
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
    temperature: 0,
  });

  const response = await model.invoke([
    new SystemMessage(BRIEF_SYSTEM),
    new HumanMessage(`Crie o brief de pesquisa para: "${userText}"`),
  ]);

  const brief = extractLLMText(response.content);

  if (state.is_planning_mode) {
    const planMessage = new AIMessage(
      `${brief}\n\n📋 **Plano gerado.** Clique em ▶ Executar para iniciar.`
    );
    return {
      research_brief: brief,
      messages: [planMessage],
      research_complete: true,
    };
  }

  return { research_brief: brief, research_complete: false };
});

// ─────────────────────────────────────────────────────────────────────────────
// NODE 4: research_supervisor_node
// ─────────────────────────────────────────────────────────────────────────────

const SupervisorDecisionSchema = z.object({
  action: z
    .enum(["conduct_research", "research_complete"])
    .describe("Escolha 'conduct_research' para coletar dados ou 'research_complete' se dados já coletados."),
  research_tasks: z
    .array(
      z.object({
        topic: z.string().describe("Título curto do tópico."),
        description: z.string().describe("Instrução EXATA de qual ferramenta usar com parâmetros."),
      })
    )
    .max(5)
    .optional()
    .describe("Lista de tarefas. OBRIGATÓRIO se action = 'conduct_research'."),
  reason: z
    .string()
    .optional()
    .describe("Motivo do encerramento se action = 'research_complete'."),
});

claraWorkflow.addNode("research_supervisor_node", async (state: ClaraState) => {
  const today = new Date().toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

  let insightCount = 0;
  let recentChatsCount = 0;

  if (state.supervisor_iteration === 0) {
    try {
      const supabase = getSupabaseAdminClient();
      const [insightRes, recentRes] = await Promise.all([
        supabase.from("chat_insights").select("*", { count: "exact", head: true })
          .gte("updated_at", new Date(Date.now() - 90 * 86400000).toISOString()),
        supabase.from("chats").select("*", { count: "exact", head: true })
          .gte("last_interaction_at", new Date(Date.now() - 7 * 86400000).toISOString())
          .eq("is_archived", false),
      ]);
      insightCount = insightRes.count ?? 0;
      recentChatsCount = recentRes.count ?? 0;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.warn("⚠️ [Supervisor] Falha ao coletar contexto:", message);
    }
  }

  const rawNotesContext =
    state.raw_notes.length > 0
      ? `\n\nDados já coletados:\n${state.raw_notes
        .map((note, i) => `--- Researcher ${i + 1} ---\n${note}`)
        .join("\n\n")}`
      : "";

  // Clara 2.0: inclui temporal anchor
  const temporalInfo = state.temporal_anchor
    ? `\nPERÍODO: ${state.temporal_anchor.period_label}\nSQL start: ${state.temporal_anchor.sql_start}\nSQL end: ${state.temporal_anchor.sql_end}`
    : "";

  const SUPERVISOR_SYSTEM = `Você é o Supervisor de Pesquisa da Clara.

Hoje: ${today}
Iteração: ${state.supervisor_iteration + 1}/${MAX_SUPERVISOR_ITERATIONS}${temporalInfo}

Chats ativos (7d): ${recentChatsCount} | Insights (90d): ${insightCount}

BRIEF:
${state.research_brief}
${rawNotesContext}

FERRAMENTAS:
• get_volume_metrics(start_date, end_date)
• execute_sql(sql) — datas BRT
• analyze_raw_conversations(start_date, end_date, analysis_goals)
• get_filtered_chats_list
• get_chat_cascade_history

REGRAS:
1. Iteração 1 → OBRIGATORIAMENTE action="conduct_research" com PELO MENOS 2 tarefas:
   - Uma QUALITATIVA: analyze_raw_conversations(per_chat_classification=true) ou get_chat_cascade_history de chats específicos
   - Uma QUANTITATIVA: execute_sql (funil por stage, contagens, cruzamentos) ou get_volume_metrics
2. Tarefas explícitas com ferramenta e parâmetros EXATOS
3. Se dados coletados só têm números sem contexto qualitativo → gere tarefas qualitativas (ler conversas)
4. Se dados coletados são só qualitativos sem números → gere tarefas SQL para cruzar
5. "research_complete" só se raw_notes tem PROFUNDIDADE: números + exemplos concretos + links de chat
6. PRIORIZE: funil de conversão (new→won), pacientes perdidos (lost), motivos de perda, oportunidades financeiras`;

  const model = new ChatGoogleGenerativeAI({
    model: "gemini-3.1-pro-preview",
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
    temperature: 0,
  }).withStructuredOutput(SupervisorDecisionSchema);

  let decision: z.infer<typeof SupervisorDecisionSchema>;

  try {
    decision = await model.invoke([
      new SystemMessage(SUPERVISOR_SYSTEM),
      new HumanMessage("Analise o brief e os dados. Qual é a próxima ação?"),
    ]);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("⚠️ [Supervisor] Erro. Forçando pesquisa.", message);
    decision = {
      action: "conduct_research",
      research_tasks: [
        {
          topic: "Volume Bruto (Fallback)",
          description: `Chame get_volume_metrics com start_date='${sevenDaysAgo}' e end_date='${today}'.`,
        },
      ],
    };
  }

  if (decision.action === "research_complete" && state.supervisor_iteration === 0) {
    decision = {
      action: "conduct_research",
      research_tasks: [
        {
          topic: "Volume de Chats",
          description: `Chame get_volume_metrics com start_date='${sevenDaysAgo}' e end_date='${today}'.`,
        },
      ],
    };
  }

  const EMPTY_INDICATORS = [
    "nenhum dado", "nenhum insight", "não foram encontrados", "sem dados",
    "nenhuma interação", "0 chats", "não possui registros", "sem registros",
    "nenhum chat encontrado", "nenhum resultado", "falha"
  ];

  const hasNoData =
    state.raw_notes.length === 0 ||
    state.raw_notes.every((n) => {
      if (!n?.trim()) return true;
      const lower = n.toLowerCase();
      return EMPTY_INDICATORS.some((ind) => lower.includes(ind));
    });

  if (decision.action === "research_complete" && hasNoData && state.supervisor_iteration < MAX_SUPERVISOR_ITERATIONS - 1) {
    decision = {
      action: "conduct_research",
      research_tasks: [
        {
          topic: "Pesquisa Forçada",
          description: `Chame get_volume_metrics com start_date='${sevenDaysAgo}' e end_date='${today}'.`,
        },
      ],
    };
  }

  if (decision.action === "research_complete") {
    const reasonText = decision.reason || "Decisão do LLM";
    const supervisorMsg = new AIMessage(`Pesquisa concluída após ${state.supervisor_iteration + 1} iteração(ões). ${reasonText}`);
    return {
      research_complete: true,
      supervisor_messages: [supervisorMsg],
      supervisor_iteration: state.supervisor_iteration + 1,
    };
  }

  const tasks = decision.research_tasks || [];

  const researchResults = await Promise.all(
    tasks.map((task) =>
      researcherGraph
        .invoke({
          research_topic: `${task.topic}: ${task.description}`,
          researcher_messages: [],
          raw_notes: [],
          compressed_research: "",
          iteration: 0,
        })
        .catch((e: Error) => ({
          compressed_research: `[Erro no researcher "${task.topic}": ${e.message}]`,
          raw_notes: [],
        }))
    )
  );

  const newNotes = researchResults
    .map((r: ResearcherResult) => r.compressed_research)
    .filter((n: unknown): n is string => typeof n === "string" && (n as string).trim().length > 0);

  const supervisorMsg = new AIMessage(
    `Rodada ${state.supervisor_iteration + 1}: ${tasks.length} researcher(s) executados.`
  );

  return {
    raw_notes: newNotes,
    supervisor_messages: [supervisorMsg],
    supervisor_iteration: state.supervisor_iteration + 1,
    research_complete: false,
  };
});

// ─────────────────────────────────────────────────────────────────────────────
// NODE 5: final_report_node
// ─────────────────────────────────────────────────────────────────────────────

claraWorkflow.addNode("final_report_node", async (state: ClaraState) => {
  const { custom_rules } = await loadDynamicPromptParts();

  const model = new ChatGoogleGenerativeAI({
    model: "gemini-3.1-pro-preview",
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
    temperature: 0.3,
  });

  const rawNotesText = state.raw_notes
    .map((note, i) => `=== Researcher ${i + 1} ===\n${note}`)
    .join("\n\n");

  const today = new Date().toISOString().slice(0, 10);

  // Clara 2.0: inclui período resolvido
  const periodInfo = state.temporal_anchor
    ? `\nPERÍODO ANALISADO: ${state.temporal_anchor.period_label}`
    : "";

  const REPORT_SYSTEM = `${CLARA_SYSTEM_PROMPT}

${custom_rules ? `REGRAS APRENDIDAS:\n${custom_rules}` : ""}

════════════════════════════════════════════
INSTRUÇÕES DO RELATÓRIO FINAL
════════════════════════════════════════════
BRIEF: ${state.research_brief}${periodInfo}

FORMATO OBRIGATÓRIO DO RELATÓRIO:

## Visão Geral do Período
Números-chave: total de conversas, taxa de conversão, distribuição por stage.

## Análise por Categoria
Para cada categoria relevante (agendados, perdidos, em triagem, etc.):
- Quantidade e % do total
- Exemplos concretos com links [[chat:ID|Nome (Telefone)]]
- Padrões identificados

## Problemas Críticos Encontrados
Listar cada problema com:
- Descrição objetiva
- Quantidade de casos afetados
- Exemplos específicos com links
- Impacto estimado (R$ se possível)

## Oportunidades e Impacto Financeiro
- Pacientes perdidos por motivos evitáveis (falta de vaga, demora, preço)
- Cálculo: X pacientes × ticket médio = R$ Y de receita perdida
- Ações sugeridas para recuperar

## Recomendações Prioritárias
Top 3-5 ações concretas, ordenadas por impacto.

## Chats de Destaque
Casos que merecem atenção individual com links.

REGRAS:
1. SIGILO: NUNCA mencione "pesquisadores", "researchers", "SQL", "query", "tabelas", "LangGraph".
2. VERACIDADE: É PROIBIDO inventar nomes, IDs, telefones, números. Use APENAS os dados abaixo.
3. Se dados vazios, não gere relatório — peça desculpas.
4. Preserve links [[chat:ID|Nome (Telefone)]] exatamente como recebidos.
5. Data de referência: ${today}.
6. CADA afirmação deve ter PROVA (número do banco ou link de chat).
7. Se não há dados financeiros exatos, ESTIME com base nos chats perdidos × ticket médio da clínica.

DADOS COLETADOS:
${rawNotesText || "[Nenhum dado encontrado.]"}`;

  const response = (await model.invoke([
    new SystemMessage(REPORT_SYSTEM),
    new HumanMessage("Sintetize os dados. Atenção máxima à veracidade."),
  ])) as AIMessage;

  const reportText = extractLLMText(response.content);

  // Auto-save apenas quando pedido
  const saveKeywords = /\b(salvar|save|gere um relat[oó]rio|gerar relat[oó]rio|relat[oó]rio formal|export|pdf)\b/i;
  const lastMsgContent = state.messages[state.messages.length - 1]?.content;
  const shouldAutoSave = saveKeywords.test(state.research_brief) ||
    saveKeywords.test(typeof lastMsgContent === "string" ? lastMsgContent : "");

  if (shouldAutoSave) {
    try {
      const supabase = getSupabaseAdminClient();
      const titulo = `Relatório — ${new Date().toLocaleDateString("pt-BR")}`;
      const insertResult = await supabase
        .from("clara_reports")
        // @ts-expect-error — Supabase untyped admin client, clara_reports not in generated types
        .insert({ titulo, conteudo_markdown: reportText, tipo: "analise_chats", created_at: new Date().toISOString() })
        .select("id")
        .single();
      const saved = insertResult.data as { id: number } | null;
      const saveError = insertResult.error as { message: string } | null;

      if (!saveError && saved?.id) {
        return {
          messages: [new AIMessage(
            `${reportText}\n\n---\n📄 *Relatório salvo — ID #${saved.id}. Acesse em /relatorios/${saved.id}*`
          )],
        };
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.error("❌ [Clara] Exceção ao salvar relatório:", message);
    }
  }

  return { messages: [new AIMessage(reportText)] };
});

// ─────────────────────────────────────────────────────────────────────────────
// EDGES (Clara 2.0)
// ─────────────────────────────────────────────────────────────────────────────

claraWorkflow.addEdge(START, "load_context_node");
claraWorkflow.addEdge("load_context_node", "classify_node");
claraWorkflow.addConditionalEdges("classify_node", (state: ClaraState) => {
  return state.is_deep_research ? "write_research_brief_node" : "simple_agent";
});
claraWorkflow.addConditionalEdges("simple_agent", (state: ClaraState) => {
  if ((state.tool_call_count ?? 0) >= MAX_TOOL_CALL_ITERATIONS) return END;
  return toolsCondition(state);
});
claraWorkflow.addEdge("tools", "spot_check_node");
claraWorkflow.addEdge("spot_check_node", "simple_agent");
claraWorkflow.addConditionalEdges("write_research_brief_node", (state: ClaraState) => {
  return state.research_complete ? END : "research_supervisor_node";
});
claraWorkflow.addConditionalEdges("research_supervisor_node", (state: ClaraState) => {
  if (state.research_complete || state.supervisor_iteration >= MAX_SUPERVISOR_ITERATIONS) {
    return "final_report_node";
  }
  return "research_supervisor_node";
});
claraWorkflow.addEdge("final_report_node", END);

export const claraGraph = claraWorkflow.compile({
  checkpointer: postgresCheckpointer,
  recursionLimit: 75, // default=25 → 75: acomoda tool calls + checkpointer state
});
