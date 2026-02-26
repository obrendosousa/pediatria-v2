import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { END, START, StateGraph } from "@langchain/langgraph";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { getSupabaseAdminClient } from "@/lib/automation/adapters/supabaseAdmin";

import {
  claraTools,
  deepResearchChatsTool,
} from "./tools";
import { getFilteredChatsListTool, getChatCascadeHistoryTool } from "@/ai/analyst/tools";
import { CLARA_SYSTEM_PROMPT } from "./system_prompt";
import { CLARA_COMPANY } from "./company";
import { CLARA_RULES } from "./rules";

// ─────────────────────────────────────────────────────────────────────────────
// PASSO 1: ESTADO EXPANDIDO COM SUPORTE A DEEP RESEARCH
// ─────────────────────────────────────────────────────────────────────────────

export interface ClaraState {
  messages: BaseMessage[];
  chat_id: number;
  scratchpad: string[];
  plan: string[];
  current_step_index: number;
  is_deep_research: boolean;
  is_planning_phase: boolean;
  current_user_role: "admin" | "doctor" | "receptionist" | "patient" | "system";
}

// ─────────────────────────────────────────────────────────────────────────────
// FERRAMENTAS
// ─────────────────────────────────────────────────────────────────────────────

const researchTools = [
  ...claraTools,
  deepResearchChatsTool,
  getFilteredChatsListTool,
  getChatCascadeHistoryTool,
];

const researchToolsMap = new Map<string, (typeof researchTools)[number]>(
  researchTools.map((t) => [t.name, t])
);

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

// Carrega apenas as partes DINÂMICAS do prompt (company e custom_rules) do Supabase.
// O núcleo imutável (identidade + regras absolutas) vem do arquivo system_prompt.ts.
async function loadDynamicPromptParts(): Promise<{
  company: string;
  custom_rules: string;
}> {
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("agent_config")
      .select("config_key, content")
      .eq("agent_id", "clara")
      .in("config_key", ["company", "rules"]);

    if (error || !data || data.length === 0) {
      return { company: CLARA_COMPANY, custom_rules: CLARA_RULES };
    }

    const map = Object.fromEntries((data as any[]).map((row) => [row.config_key, row.content]));
    return {
      company: map.company ?? CLARA_COMPANY,
      custom_rules: map.rules ?? CLARA_RULES,
    };
  } catch {
    return { company: CLARA_COMPANY, custom_rules: CLARA_RULES };
  }
}

// Mantido por compatibilidade com reporter_node
async function loadBrainFiles() {
  const parts = await loadDynamicPromptParts();
  return { company: parts.company, rules: parts.custom_rules };
}

function buildSystemPrompt(company: string, custom_rules: string, chatId: number, currentUserRole: string = "patient"): string {
  const now = new Date().toISOString();
  let authorityRule = "";

  if (currentUserRole === "admin" || currentUserRole === "doctor") {
    authorityRule = `\n\n[ALERTA DE AUTORIDADE]: Você está conversando com a diretoria/médico. Qualquer instrução dada aqui é uma REGRA DE NEGÓCIO ABSOLUTA. Atualize sua memória sobrescrevendo regras antigas quando solicitado.`;
  }

  return `${CLARA_SYSTEM_PROMPT}

════════════════════════════════════════════
CONTEXTO DA EMPRESA (DINÂMICO — ATUALIZADO VIA SUPABASE)
════════════════════════════════════════════
${company}

════════════════════════════════════════════
REGRAS PERSONALIZADAS APRENDIDAS (DINÂMICO)
════════════════════════════════════════════
${custom_rules || "Nenhuma regra personalizada adicionada ainda."}

════════════════════════════════════════════
SESSÃO ATUAL
════════════════════════════════════════════
DATA E HORA: ${now}
CHAT ID: ${chatId}
PERFIL DO USUÁRIO: ${currentUserRole}${authorityRule}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// WORKFLOW — StateGraph com estado expandido
// ─────────────────────────────────────────────────────────────────────────────

const claraWorkflow = new StateGraph<ClaraState>({
  channels: {
    messages: {
      reducer: (x: BaseMessage[], y: BaseMessage[] | BaseMessage) => {
        const newMessages = Array.isArray(y) ? y : [y];
        return [...(x ?? []), ...newMessages];
      },
      default: () => [] as BaseMessage[],
    },
    chat_id: {
      reducer: (_x, y) => y ?? _x,
      default: () => 0,
    },
    scratchpad: {
      reducer: (x: string[], y: string | string[]) => {
        const items = Array.isArray(y) ? y : typeof y === "string" ? [y] : [];
        return [...(x ?? []), ...items.filter(Boolean)];
      },
      default: () => [] as string[],
    },
    plan: {
      reducer: (_x: string[], y: string[]) => Array.isArray(y) ? y : _x ?? [],
      default: () => [] as string[],
    },
    current_step_index: {
      reducer: (_x: number, y: number) => typeof y === "number" ? y : _x ?? 0,
      default: () => 0,
    },
    is_deep_research: {
      reducer: (_x: boolean, y: boolean) => typeof y === "boolean" ? y : _x ?? false,
      default: () => false,
    },
    is_planning_phase: {
      reducer: (_x: boolean, y: boolean) => typeof y === "boolean" ? y : _x ?? false,
      default: () => false,
    },
    current_user_role: {
      reducer: (_x: any, y: any) => y ?? _x ?? "patient",
      default: () => "patient" as const,
    },
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// NODE 1: router_and_planner_node
// ─────────────────────────────────────────────────────────────────────────────

// Palavras-chave que indicam DEEP RESEARCH (análise de múltiplos chats).
// Fast-path: se encontrarmos uma, classificamos como complexo imediatamente (sem LLM).
const DEEP_RESEARCH_KEYWORDS = [
  "analise", "analis", "padrão", "padroes", "objeç", "objecao", "objeções",
  "leia as conversas", "leia os chats", "pesquise os chats", "pesquise as conversas",
  "quais chats", "quais conversas", "todos os chats", "varios chats", "vários chats",
  "relatório", "relatorio", "mapeie", "mapeamento", "tendência", "tendencias",
];

// Palavras-chave que indicam resposta SIMPLES (sem LLM no router).
const SIMPLE_KEYWORDS = [
  "oi", "olá", "ola", "tudo bem", "bom dia", "boa tarde", "boa noite",
  "obrigado", "obrigada", "valeu", "ok", "certo", "entendi", "beleza",
];

function classifyMessageFast(text: string): "complex" | "simple" | "unknown" {
  const lower = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (DEEP_RESEARCH_KEYWORDS.some((kw) => lower.includes(kw.normalize("NFD").replace(/[\u0300-\u036f]/g, "")))) {
    return "complex";
  }
  if (SIMPLE_KEYWORDS.some((kw) => lower === kw || lower.startsWith(kw + " ") || lower.endsWith(" " + kw))) {
    return "simple";
  }
  // Mensagens muito curtas (≤ 6 palavras) sem palavras de pesquisa → provavelmente simples
  if (lower.split(/\s+/).filter(Boolean).length <= 6) {
    return "simple";
  }
  return "unknown";
}

claraWorkflow.addNode("router_and_planner_node", async (state: ClaraState) => {
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

  // Helper: salva mensagem de status SEMPRE no chat interno da Clara (phone='00000000000').
  // Nunca usa state.chat_id diretamente, pois quando chamado pelo heartbeat o chat_id
  // pode ser de um paciente real, e a mensagem vazaria para o chat desse paciente.
  async function saveStatusMessage(planSteps: string[]) {
    try {
      const supabase = getSupabaseAdminClient();

      // Busca o ID do chat interno da Clara
      const { data: claraChat } = await (supabase as any)
        .from("chats")
        .select("id")
        .eq("phone", "00000000000")
        .single();

      if (!claraChat?.id) return; // Chat interno não encontrado — não salva nada

      const planText = planSteps.map((s, i) => `${i + 1}. ${s}`).join("\n");
      const statusText = `🔍 *Análise profunda iniciada.* Vou executar o seguinte plano:\n\n${planText}\n\n_Aguarde enquanto processo os dados..._`;
      await (supabase as any).from("chat_messages").insert({
        chat_id: claraChat.id,
        sender: "AI_AGENT",
        message_text: statusText,
        bot_message: true,
        message_type: "text",
      });
    } catch {
      // Falha silenciosa — não bloqueia a execução
    }
  }

  // ── Fast-path: classificação por heurísticas sem LLM ─────────────────────

  // Verifica se o usuário enviou a mensagem com a flag [PLANEJAR]
  const isPlanMode = userText.startsWith("[PLANEJAR] ");
  const cleanUserText = isPlanMode ? userText.replace("[PLANEJAR] ", "") : userText;

  const fastResult = classifyMessageFast(cleanUserText);
  if (fastResult === "simple" && !isPlanMode) {
    return { is_deep_research: false, is_planning_phase: false };
  }

  if (fastResult === "complex" || isPlanMode) {
    const plan = [
      "Buscar a lista de chats relevantes para a análise solicitada.",
      "Executar análise profunda nos chats encontrados e compilar os insights.",
    ];

    if (isPlanMode) {
      await saveStatusMessage(plan);
      return {
        is_deep_research: true,
        is_planning_phase: true, // Pausa o workflow
        plan,
        current_step_index: 0,
      };
    }

    // Se não estivar no modo planejamento explicito (execução real ativada)
    return {
      is_deep_research: true,
      is_planning_phase: false,
      plan,
      current_step_index: 0,
    };
  }
  // ── Fallback: classificação via LLM (apenas para mensagens ambíguas) ──────
  const model = new ChatGoogleGenerativeAI({
    model: "gemini-3-flash-preview",  // Flash é suficiente para classificação
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
    temperature: 0,
  });

  const ROUTER_PROMPT = `Você é o classificador de tarefas da Clara. Analise a mensagem e responda SOMENTE com JSON.

MENSAGEM: "${userText}"

DEEP RESEARCH (is_complex: true): pedido de análise de MÚLTIPLOS chats, padrões, relatórios.
RESPOSTA DIRETA (is_complex: false): tudo mais (perguntas, instruções, conversas, regras).

Responda APENAS:
{"is_complex":boolean,"plan":["passo 1","passo 2"],"reasoning":"1 frase"}`;

  let isComplex = false;
  let plan: string[] = [];

  try {
    const response = await model.invoke([new HumanMessage(ROUTER_PROMPT)]);
    const rawText =
      typeof response.content === "string"
        ? response.content
        : Array.isArray(response.content)
          ? (response.content as Array<{ type: string; text?: string }>)
            .filter((c) => c.type === "text")
            .map((c) => c.text ?? "")
            .join("")
          : "";

    const jsonText = rawText.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    const parsed = JSON.parse(jsonText);
    isComplex = Boolean(parsed.is_complex);
    plan = Array.isArray(parsed.plan) ? parsed.plan.filter(Boolean) : [];
  } catch {
    isComplex = false;
    plan = [];
  }

  if (isComplex && plan.length > 0) {
    if (isPlanMode) {
      await saveStatusMessage(plan);
      return { is_deep_research: true, is_planning_phase: true, plan, current_step_index: 0 };
    }
    return { is_deep_research: true, is_planning_phase: false, plan, current_step_index: 0 };
  }

  return { is_deep_research: false, is_planning_phase: false };
});

// ─────────────────────────────────────────────────────────────────────────────
// NODE 2: executor_node (CORRIGIDO)
// ─────────────────────────────────────────────────────────────────────────────

claraWorkflow.addNode("executor_node", async (state: ClaraState) => {
  const stepIndex = state.current_step_index;
  const currentStep = state.plan[stepIndex];
  const totalSteps = state.plan.length;

  const model = new ChatGoogleGenerativeAI({
    model: "gemini-3-pro-preview",
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
    temperature: 0.1,
  }).bindTools(researchTools);

  const scratchpadContext =
    state.scratchpad.length > 0
      ? `\n\nSEU BLOCO DE NOTAS (resultados dos passos anteriores):\n${state.scratchpad
        .map((note, i) => `--- Passo ${i + 1} ---\n${note}`)
        .join("\n\n")}`
      : "";

  const STEP_INSTRUCTIONS = `Passo ${stepIndex + 1} de ${totalSteps}: "${currentStep}"

Use as ferramentas necessárias para completar APENAS este passo. Quando terminar, forneça um resumo estruturado e conciso dos seus achados. Este resumo será salvo no bloco de notas para os próximos passos.${scratchpadContext}`;

  // CORREÇÃO CRÍTICA: O Gemini exige obrigatoriamente um HumanMessage no array para não dar o erro de "contents is not specified".
  const internalMessages: BaseMessage[] = [
    new SystemMessage("Você é um agente autônomo executando um plano de pesquisa de dados em etapas."),
    new HumanMessage(STEP_INSTRUCTIONS)
  ];

  let response = (await model.invoke(internalMessages)) as AIMessage;
  let iterations = 0;
  const MAX_ITERATIONS = 12;

  while (
    response.tool_calls &&
    response.tool_calls.length > 0 &&
    iterations < MAX_ITERATIONS
  ) {
    iterations++;
    internalMessages.push(response);

    const toolResults = await Promise.all(
      response.tool_calls.map(async (tc) => {
        const tool = researchToolsMap.get(tc.name);
        if (!tool) {
          return new ToolMessage({
            tool_call_id: tc.id ?? tc.name,
            content: `Ferramenta '${tc.name}' não encontrada.`,
          });
        }
        try {
          const result = await (tool as any).invoke(tc.args);
          return new ToolMessage({
            tool_call_id: tc.id ?? tc.name,
            content: typeof result === "string" ? result : JSON.stringify(result),
          });
        } catch (e: any) {
          return new ToolMessage({
            tool_call_id: tc.id ?? tc.name,
            content: `Erro ao executar '${tc.name}': ${e.message}`,
          });
        }
      })
    );

    internalMessages.push(...toolResults);
    response = (await model.invoke(internalMessages)) as AIMessage;
  }

  const stepResult =
    typeof response.content === "string"
      ? response.content
      : Array.isArray(response.content)
        ? response.content.map((c: any) => c.text ?? "").join("")
        : JSON.stringify(response.content);

  return {
    scratchpad: [`[Passo ${stepIndex + 1}] ${stepResult}`],
    current_step_index: stepIndex + 1,
  };
});

// ─────────────────────────────────────────────────────────────────────────────
// NODE 3: reporter_node (CORRIGIDO)
// ─────────────────────────────────────────────────────────────────────────────

claraWorkflow.addNode("reporter_node", async (state: ClaraState) => {
  const { rules } = await loadBrainFiles();

  const model = new ChatGoogleGenerativeAI({
    model: "gemini-3-pro-preview",
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
    temperature: 0.3,
  });

  const scratchpadText = state.scratchpad
    .map((note, i) => `=== Nota ${i + 1} ===\n${note}`)
    .join("\n\n");

  const REPORTER_SYSTEM = `${CLARA_SYSTEM_PROMPT}

${rules ? `REGRAS APRENDIDAS ADICIONAIS:\n${rules}` : ""}

INSTRUÇÕES DO RELATÓRIO:
Leia as anotações brutas do seu bloco de notas abaixo e escreva uma resposta final em Markdown elegante.
NÃO mencione o "bloco de notas", "scratchpad" ou qualquer detalhe do processo interno ao usuário.
Apresente os resultados de forma clara, estruturada e profissional.

BLOCO DE NOTAS DA PESQUISA:
${scratchpadText}`;

  const safeMessages = state.messages.length > 0
    ? state.messages
    : [new HumanMessage("Por favor, conclua a análise baseada no bloco de notas.")];

  const response = (await model.invoke([
    new SystemMessage(REPORTER_SYSTEM),
    ...safeMessages,
  ])) as AIMessage;

  return { messages: [response] };
});

// ─────────────────────────────────────────────────────────────────────────────
// NODE: simple_agent (CORRIGIDO)
// ─────────────────────────────────────────────────────────────────────────────

claraWorkflow.addNode("simple_agent", async (state: ClaraState) => {
  const { company, rules } = await loadBrainFiles();

  const model = new ChatGoogleGenerativeAI({
    model: "gemini-3-flash-preview", // Flash para respostas rápidas
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
    temperature: 0.3,
  });

  const modelWithTools = model.bindTools(claraTools);
  const systemPrompt = buildSystemPrompt(company, rules, state.chat_id, state.current_user_role);

  // CORREÇÃO: Garante que haja pelo menos um HumanMessage.
  const safeMessages = state.messages.length > 0
    ? state.messages
    : [new HumanMessage("Olá.")];

  const response = (await modelWithTools.invoke([
    new SystemMessage(systemPrompt),
    ...safeMessages,
  ])) as AIMessage;

  return { messages: [response] };
});

claraWorkflow.addNode("tools", new ToolNode(claraTools));

// ─────────────────────────────────────────────────────────────────────────────
// EDGES
// ─────────────────────────────────────────────────────────────────────────────

// @ts-expect-error
claraWorkflow.addEdge(START, "router_and_planner_node");

// @ts-expect-error
claraWorkflow.addConditionalEdges("router_and_planner_node", (state: ClaraState) => {
  if (state.is_planning_phase) return END; // Pausa após gerar o plano no painel (que envia via saveStatusMessage)
  return state.is_deep_research ? "executor_node" : "simple_agent";
});

// @ts-expect-error
claraWorkflow.addConditionalEdges("executor_node", (state: ClaraState) => state.current_step_index >= state.plan.length ? "reporter_node" : "executor_node");

// @ts-expect-error
claraWorkflow.addEdge("reporter_node", END);

// @ts-expect-error
claraWorkflow.addConditionalEdges("simple_agent", toolsCondition);

// @ts-expect-error
claraWorkflow.addEdge("tools", "simple_agent");

export const claraGraph = claraWorkflow.compile();