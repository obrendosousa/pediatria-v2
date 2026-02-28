import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { END, START, StateGraph } from "@langchain/langgraph";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

import { allResearchTools } from "./tools";
import { getFilteredChatsListTool, getChatCascadeHistoryTool } from "@/ai/analyst/tools";

// Ferramentas completas disponíveis para cada researcher isolado.
// Inclui ferramentas de dados da Clara + ferramentas do analyst.
const researcherTools = [
  ...allResearchTools,
  getFilteredChatsListTool,
  getChatCascadeHistoryTool,
];

const researcherToolsMap = new Map<string, (typeof researcherTools)[number]>(
  researcherTools.map((t) => [t.name, t])
);

// ─────────────────────────────────────────────────────────────────────────────
// ESTADO DO RESEARCHER — completamente isolado do estado principal da Clara
// ─────────────────────────────────────────────────────────────────────────────

export interface ResearcherState {
  researcher_messages: BaseMessage[]; // conversa interna do researcher (append)
  research_topic: string;             // tópico atribuído pelo supervisor (override)
  raw_notes: string[];                // resultados brutos das tools (append)
  compressed_research: string;        // resumo compacto gerado pelo compress_node (override)
  iteration: number;                  // contador de iterações do loop ReAct (override)
}

const stateChannels = {
  researcher_messages: {
    reducer: (x: BaseMessage[], y: BaseMessage[] | BaseMessage) => {
      const incoming = Array.isArray(y) ? y : [y];
      return [...(x ?? []), ...incoming];
    },
    default: () => [] as BaseMessage[],
  },
  research_topic: {
    reducer: (_x: string, y: string) => y ?? _x ?? "",
    default: () => "",
  },
  raw_notes: {
    reducer: (x: string[], y: string | string[]) => {
      const items = Array.isArray(y) ? y : typeof y === "string" ? [y] : [];
      return [...(x ?? []), ...items.filter(Boolean)];
    },
    default: () => [] as string[],
  },
  compressed_research: {
    reducer: (_x: string, y: string) => y ?? _x ?? "",
    default: () => "",
  },
  iteration: {
    reducer: (_x: number, y: number) => (typeof y === "number" ? y : _x ?? 0),
    default: () => 0,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// NODE 1: researcher_node — ReAct loop com todas as ferramentas de dados
// ─────────────────────────────────────────────────────────────────────────────

const MAX_RESEARCHER_ITERATIONS = 8;

const RESEARCHER_SYSTEM = `Você é um Researcher Autônomo especializado em análise de dados de clínica médica.

Sua missão é investigar exatamente o tópico atribuído pelo supervisor, coletando dados reais do banco de dados via ferramentas.

REGRAS:
1. Use APENAS as ferramentas disponíveis para buscar dados reais — NUNCA invente informações.
2. Seja específico e focado no tópico — não saia do escopo atribuído.
3. Colete dados suficientes e pare quando tiver o que precisa.
4. Suas descobertas serão sumarizadas e enviadas ao supervisor para consolidação.
5. Quando terminar a coleta, NÃO chame mais ferramentas — apenas escreva um resumo estruturado dos achados.

PROTOCOLO OBRIGATÓRIO DE PESQUISA DE DESEMPENHO:
Quando pesquisar métricas, desempenho ou qualidade de atendimento, siga ESTA ORDEM:

PASSO 1 — Chame \`gerar_relatorio_qualidade_chats\` com \`dias_retroativos: 60\`
→ Esta é a fonte primária de verdade — dados pré-calculados pelo sistema (nota, gargalos, objeções).
→ Se retornar dados, use-os. Não continue para o PASSO 2.

PASSO 2 — (somente se PASSO 1 vazio) Chame \`get_filtered_chats_list\` com \`days_ago: 30\`, \`limit: 50\`
→ Para obter IDs dos chats recentes.

PASSO 3 — (somente se PASSO 2 foi executado) Chame \`analisar_chat_especifico\` com os IDs do PASSO 2
→ Isso gera e persiste os insights na tabela chat_insights.
→ Após completar, repita o PASSO 1 para ler os novos dados.

ESTRUTURA DO BANCO (REFERÊNCIA):
- chats: id, contact_name, stage (new/qualified/lost/won), ai_sentiment, last_interaction_at
  → filtro de data: usar campo last_interaction_at (NÃO created_at)
- chat_messages: id, chat_id, sender (AI_AGENT/HUMAN_AGENT/contact), message_text, created_at
  → filtro de data: usar campo created_at
- chat_insights: chat_id, nota_atendimento (0-10), sentimento, gargalos, objecao_principal, decisao, resumo_analise, updated_at
  → filtro de data: usar campo updated_at (NÃO created_at)

FERRAMENTAS DISPONÍVEIS:
- gerar_relatorio_qualidade_chats: Agrega métricas de chat_insights (USAR PRIMEIRO)
- query_database: Consulta qualquer tabela com filtros precisos
- generate_sql_report: Executa SQL para métricas (COUNT, AVG, SUM, GROUP BY)
- get_filtered_chats_list: Lista IDs de chats por stage, sentimento, data
- get_chat_cascade_history: Transcrição completa de um chat
- deep_research_chats: Análise semântica rápida de múltiplos chats (Map-Reduce)
- analisar_chat_especifico: Análise estruturada com persistência em chat_insights
- search_knowledge_base: Busca gabaritos de atendimento
- manage_long_term_memory: Consulta memórias da Clara
- save_report: Persiste relatório no banco`;

async function researcherNode(state: ResearcherState): Promise<Partial<ResearcherState>> {
  // Limite de segurança: se atingiu o máximo de iterações, para
  if (state.iteration >= MAX_RESEARCHER_ITERATIONS) {
    return { iteration: state.iteration };
  }

  const model = new ChatGoogleGenerativeAI({
    model: "gemini-3-flash-preview",
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
    temperature: 0.1,
  }).bindTools(researcherTools);

  const today = new Date().toISOString().slice(0, 10);

  // Na primeira iteração, instrui o researcher com o tópico
  const messages: BaseMessage[] =
    state.researcher_messages.length === 0
      ? [new HumanMessage(`Investigue o seguinte tópico e colete dados reais: "${state.research_topic}"\n\nHoje é ${today}. Use as ferramentas disponíveis para coletar os dados necessários.`)]
      : state.researcher_messages;

  const response = (await model.invoke([
    new SystemMessage(RESEARCHER_SYSTEM),
    ...messages,
  ])) as AIMessage;

  return {
    researcher_messages: [response],
    iteration: state.iteration + 1,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// NODE 2: researcher_tools_node — executa as tool calls do researcher
// ─────────────────────────────────────────────────────────────────────────────

const researcherToolsNode = new ToolNode(researcherTools);

// ─────────────────────────────────────────────────────────────────────────────
// NODE 3: compress_research_node — sumariza raw_notes em compressed_research
// ─────────────────────────────────────────────────────────────────────────────

async function compressResearchNode(state: ResearcherState): Promise<Partial<ResearcherState>> {
  const model = new ChatGoogleGenerativeAI({
    model: "gemini-3-flash-preview",
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
    temperature: 0,
  });

  // Extrai o último AIMessage (resultado final do researcher)
  const lastAiMsg = [...state.researcher_messages]
    .reverse()
    .find((m) => m instanceof AIMessage);

  const lastContent =
    typeof lastAiMsg?.content === "string"
      ? lastAiMsg.content
      : Array.isArray(lastAiMsg?.content)
        ? (lastAiMsg.content as Array<any>).map((c) => c?.text ?? "").join("")
        : "";

  if (!lastContent.trim()) {
    return { compressed_research: `[Researcher: "${state.research_topic}" — nenhum dado coletado]` };
  }

  const prompt = `Você é um sintetizador de dados. Abaixo estão os achados de um researcher sobre o tópico: "${state.research_topic}".

Crie um resumo COMPACTO e ESTRUTURADO (máx. 400 palavras) preservando:
- Todos os números e métricas encontrados
- IDs de chats relevantes
- Padrões identificados
- Dados concretos (datas, contagens, percentuais)

NÃO invente dados. Apenas organize e comprima o que foi encontrado.

ACHADOS DO RESEARCHER:
${lastContent}`;

  const response = await model.invoke([new HumanMessage(prompt)]);
  const compressed =
    typeof response.content === "string"
      ? response.content
      : Array.isArray(response.content)
        ? (response.content as Array<any>).map((c) => c?.text ?? "").join("")
        : "";

  return {
    compressed_research: `[Tópico: "${state.research_topic}"]\n${compressed}`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CONDITION: para quando atingiu o limite de iterações (sem mais tool calls)
// ─────────────────────────────────────────────────────────────────────────────

function researcherRouting(state: ResearcherState): string {
  if (state.iteration >= MAX_RESEARCHER_ITERATIONS) {
    return "compress_research";
  }
  // toolsCondition retorna "tools" ou END ("__end__") — precisamos mapear para nossos nós
  const lastMsg = state.researcher_messages[state.researcher_messages.length - 1];
  const hasToolCalls =
    lastMsg instanceof AIMessage &&
    Array.isArray((lastMsg as any).tool_calls) &&
    (lastMsg as any).tool_calls.length > 0;

  return hasToolCalls ? "researcher_tools" : "compress_research";
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPILAÇÃO DO SUBGRAFO
// ─────────────────────────────────────────────────────────────────────────────

const researcherWorkflow = new StateGraph<ResearcherState>({ channels: stateChannels })
  .addNode("researcher", researcherNode)
  .addNode("researcher_tools", researcherToolsNode)
  .addNode("compress_research", compressResearchNode);

researcherWorkflow.addEdge(START as any, "researcher" as any);
researcherWorkflow.addConditionalEdges("researcher" as any, researcherRouting as any);
researcherWorkflow.addEdge("researcher_tools" as any, "researcher" as any);
researcherWorkflow.addEdge("compress_research" as any, END as any);

export const researcherGraph = researcherWorkflow.compile();
