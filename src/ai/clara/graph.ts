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
import fs from "fs/promises";
import path from "path";

import {
  claraTools,
  deepResearchChatsTool,
} from "./tools";
import { getFilteredChatsListTool, getChatCascadeHistoryTool } from "@/ai/analyst/tools";
import { CLARA_SOUL } from "./soul";
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

const BRAIN_DIR = path.join(process.cwd(), "src", "ai", "clara");

async function loadBrainFiles(): Promise<{
  soul: string;
  company: string;
  rules: string;
}> {
  try {
    const [soul, company, rules] = await Promise.all([
      fs.readFile(path.join(BRAIN_DIR, "soul.ts"), "utf-8"),
      fs.readFile(path.join(BRAIN_DIR, "company.ts"), "utf-8"),
      fs.readFile(path.join(BRAIN_DIR, "rules.ts"), "utf-8"),
    ]);
    return { soul, company, rules };
  } catch {
    return { soul: CLARA_SOUL, company: CLARA_COMPANY, rules: CLARA_RULES };
  }
}

function buildSimpleAgentPrompt(
  soul: string,
  company: string,
  rules: string,
  chatId: number
): string {
  const now = new Date().toISOString();
  return `Você é a Clara, um Agente Autônomo com arquitetura ReAct (Reasoning and Acting).
DATA E HORA ATUAL DO SISTEMA: ${now}

-----------------------------------------------------------
[MÓDULO DE IDENTIDADE E PERSONALIDADE]
${soul}

[MÓDULO DE CONTEXTO DA EMPRESA]
${company}

[MÓDULO DE REGRAS ESTRITAS DE OPERAÇÃO]
${rules}
-----------------------------------------------------------

OBJETIVO ATUAL:
Você está operando. O ID deste chat é ${chatId}.

DIRETRIZES DE PENSAMENTO, APRENDIZADO E AÇÃO:
1. GABARITOS (BASE DE CONHECIMENTO): Se você receber a rotina de estudos do Heartbeat, analise os logs, encontre as melhores respostas dadas pelos humanos aos pacientes, e USE a ferramenta 'extract_and_save_knowledge' para salvar esse padrão no banco.
2. CONSULTA ANTES DE FALAR: Se alguém te perguntar como resolver o problema de um paciente, use a ferramenta 'search_knowledge_base' PRIMEIRO para ver se você já aprendeu o gabarito no passado.
3. ZERO ACHISMO: Se te perguntarem sobre dados, use a ferramenta 'query_database_table' para descobrir a verdade. Nunca invente relatórios.
4. AUTO-MODIFICAÇÃO: Se te ensinarem uma nova regra permanente, use 'update_brain_file'.
5. Suas respostas finais para a equipe devem ser formatadas de forma clara, elegante e usando Markdown.`;
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
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// NODE 1: router_and_planner_node
// ─────────────────────────────────────────────────────────────────────────────

claraWorkflow.addNode("router_and_planner_node", async (state: ClaraState) => {
  const model = new ChatGoogleGenerativeAI({
    model: "gemini-3-pro-preview",
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
    temperature: 0.1,
  });

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

  const ROUTER_PROMPT = `Você é o classificador de tarefas da Clara. Analise a mensagem abaixo e responda SOMENTE com um JSON válido no formato especificado.

MENSAGEM: "${userText}"

CRITÉRIOS PARA DEEP RESEARCH (is_complex = true):
- O gestor pede análise de MÚLTIPLOS chats ou conversas (ex: "analise", "padrão", "objeção", "leia as conversas").

CRITÉRIOS PARA RESPOSTA DIRETA (is_complex = false):
- Conversas normais com pacientes.
- Perguntas sobre regras ou memórias.
- Saudações e tarefas simples.

Responda APENAS com este JSON:
{
  "is_complex": boolean,
  "plan": ["passo 1", "passo 2"],
  "reasoning": "justificativa em 1 frase"
}`;

  let isComplex = false;
  let plan: string[] = [];

  try {
    // Aqui usamos HumanMessage, o que é seguro para o Gemini.
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
    return { is_deep_research: true, plan, current_step_index: 0 };
  }

  return { is_deep_research: false };
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
  const { soul, rules } = await loadBrainFiles();

  const model = new ChatGoogleGenerativeAI({
    model: "gemini-3-pro-preview",
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
    temperature: 0.3,
  });

  const scratchpadText = state.scratchpad
    .map((note, i) => `=== Nota ${i + 1} ===\n${note}`)
    .join("\n\n");

  const REPORTER_SYSTEM = `Você é a Clara. Você concluiu sua pesquisa profunda e agora deve escrever o relatório final para o gestor.

[SUA IDENTIDADE]
${soul}

[REGRAS DE FORMATAÇÃO]
${rules}

INSTRUÇÕES:
Leia as anotações brutas do seu bloco de notas abaixo e escreva uma resposta final em Markdown elegante. NÃO mencione o "bloco de notas" ou o processo interno ao usuário.

BLOCO DE NOTAS DA PESQUISA:
${scratchpadText}`;

  // CORREÇÃO: Garante que haja pelo menos um HumanMessage para evitar crash.
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
  const { soul, company, rules } = await loadBrainFiles();

  const model = new ChatGoogleGenerativeAI({
    model: "gemini-3-pro-preview",
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
    temperature: 0.3,
  });

  const modelWithTools = model.bindTools(claraTools);
  const systemPrompt = buildSimpleAgentPrompt(soul, company, rules, state.chat_id);

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
claraWorkflow.addConditionalEdges("router_and_planner_node", (state: ClaraState) => state.is_deep_research ? "executor_node" : "simple_agent");

// @ts-expect-error
claraWorkflow.addConditionalEdges("executor_node", (state: ClaraState) => state.current_step_index >= state.plan.length ? "reporter_node" : "executor_node");

// @ts-expect-error
claraWorkflow.addEdge("reporter_node", END);

// @ts-expect-error
claraWorkflow.addConditionalEdges("simple_agent", toolsCondition);

// @ts-expect-error
claraWorkflow.addEdge("tools", "simple_agent");

export const claraGraph = claraWorkflow.compile();