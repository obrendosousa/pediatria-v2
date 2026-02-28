import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { END, START, StateGraph } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

import { allResearchTools } from "./tools";
import { getFilteredChatsListTool, getChatCascadeHistoryTool, getAggregatedInsightsTool } from "@/ai/analyst/tools";

// allResearchTools NÃO inclui analyst tools — adicionados aqui uma única vez, sem duplicatas.
const researcherTools = [
  ...allResearchTools,
  getFilteredChatsListTool,
  getChatCascadeHistoryTool,
  getAggregatedInsightsTool,
];

// ─────────────────────────────────────────────────────────────────────────────
// ESTADO DO RESEARCHER — completamente isolado do estado principal da Clara
// ─────────────────────────────────────────────────────────────────────────────

export interface ResearcherState {
  researcher_messages: BaseMessage[];
  research_topic: string;
  raw_notes: string[];
  compressed_research: string;
  iteration: number;
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

const MAX_RESEARCHER_ITERATIONS = 8;

const RESEARCHER_SYSTEM = `Você é um Agente de Banco de Dados de altíssima precisão. Sua ÚNICA função é executar ferramentas (tool calls) para extrair dados do sistema.

REGRA DE FERRO: É PROIBIDO responder com texto. Aja IMEDIATAMENTE com uma ferramenta.

GUIA COMPLETO DE FERRAMENTAS:

1. get_volume_metrics(start_date, end_date)
   → Volume de chats/mensagens por dia, totais, breakdown por stage/sentimento.
   → Use para: "quantas conversas", "volume dia a dia", "picos de demanda".

2. gerar_relatorio_qualidade_chats(dias_retroativos)
   → USE PRIMEIRO para: "objeções", "gargalos", "nota de atendimento", "qualidade"
   → Lê tabela chat_insights — MUITO MAIS RÁPIDO que ler mensagens
   → Exemplo: gerar_relatorio_qualidade_chats(dias_retroativos=7)

3. get_aggregated_insights(start_date, end_date)
   → Insights agregados da tabela chat_insights: tópicos, decisões, objeções mais frequentes
   → Use para análises de período específico com datas definidas

4. execute_sql(sql)
   → Para queries personalizadas: financeiro, agendamentos, JOINs, aggregations
   → Você escreve o SQL. Datas BRT: '2026-02-24T00:00:00-03:00'::timestamptz
   → Ex: SELECT unnest(objecoes) AS objecao, COUNT(*) FROM chat_insights WHERE updated_at >= '...' GROUP BY 1 ORDER BY 2 DESC LIMIT 20

5. BUSCA EM MENSAGENS — SEQUÊNCIA OBRIGATÓRIA (2 passos no loop ReAct):
   → Passo 1: get_filtered_chats_list(start_date='...', end_date='...', limit=30) → obtém IDs dos chats
   → Passo 2: deep_research_chats(chat_ids=[IDs do Passo 1], objetivo_da_analise='...') → analisa o conteúdo
   → Use SOMENTE quando precisar LER o texto das mensagens (padrões de linguagem, argumentos, tom)

6. get_chat_cascade_history(chat_id) → Histórico completo de UM chat específico (use com chat_id preciso)
7. save_report(titulo, conteudo, tipo) → Salvar relatório (apenas se o brief pedir explicitamente)

SCHEMA:
• chats: id, contact_name, phone, stage, ai_sentiment, last_interaction_at, status
• chat_messages: id, chat_id, sender (AI_AGENT|HUMAN_AGENT|contact), message_text, created_at
• chat_insights: id, chat_id, nota_atendimento (0-10), sentimento, objecoes (text[]), gargalos (text[]), decisao, updated_at`;

// Helper ultra-seguro para não quebrar o TypeScript do LangChain
function isToolMessageSafe(m: any): boolean {
  if (!m) return false;
  if (typeof m._getType === "function" && m._getType() === "tool") return true;
  if (typeof m.getType === "function" && m.getType() === "tool") return true;
  if (m.constructor && m.constructor.name === "ToolMessage") return true;
  if (m.type === "tool") return true;
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// NODE 1: researcher_node
// ─────────────────────────────────────────────────────────────────────────────

async function researcherNode(state: ResearcherState): Promise<Partial<ResearcherState>> {
  if (state.iteration >= MAX_RESEARCHER_ITERATIONS) {
    return { iteration: state.iteration };
  }

  // Temperatura zero para forçar LLM a usar tools ao invés de tagarelar
  const model = new ChatGoogleGenerativeAI({
    model: "gemini-3-flash-preview",
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
    temperature: 0,
  }).bindTools(researcherTools);

  const today = new Date().toISOString().slice(0, 10);

  const messages: BaseMessage[] =
    state.researcher_messages.length === 0
      ? [new HumanMessage(`${RESEARCHER_SYSTEM}\n\nHoje é ${today}.\nTópico OBRIGATÓRIO a investigar via ferramenta agora:\n"${state.research_topic}"\n\nATENÇÃO: Não responda com texto livre. Emita a chamada de função (tool_call) imediatamente para buscar os dados.`)]
      : state.researcher_messages;

  const response = (await model.invoke(messages)) as AIMessage;

  return {
    researcher_messages: [response],
    iteration: state.iteration + 1,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// NODE 2: researcher_tools_node
// ─────────────────────────────────────────────────────────────────────────────
const researcherToolsNode = new ToolNode(researcherTools);

// ─────────────────────────────────────────────────────────────────────────────
// NODE 3: reprimand_node (O Nó da Bronca para evitar recusa de tool_call)
// ─────────────────────────────────────────────────────────────────────────────
async function reprimandNode(state: ResearcherState): Promise<Partial<ResearcherState>> {
  return {
    researcher_messages: [
      new HumanMessage("⛔ ALERTA DE SISTEMA: Você respondeu apenas com texto. É obrigatório acionar uma ferramenta (tool call) imediatamente. Use get_volume_metrics ou execute_sql agora — sem nenhum texto adicional.")
    ],
    iteration: state.iteration + 1,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// NODE 4: compress_research_node
// ─────────────────────────────────────────────────────────────────────────────
async function compressResearchNode(state: ResearcherState): Promise<Partial<ResearcherState>> {
  const model = new ChatGoogleGenerativeAI({
    model: "gemini-3-flash-preview",
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
    temperature: 0,
  });

  // Filtra de forma ultra-segura para não quebrar no typeof m._getType
  const toolMessages = state.researcher_messages
    .filter(isToolMessageSafe)
    .map((m: any) => `[RETORNO DO BANCO DE DADOS]:\n${m.content || ""}`)
    .join("\n\n");

  if (!toolMessages.trim()) {
    return { compressed_research: `[Researcher: "${state.research_topic}" — falha: Nenhum dado extraído do banco.]` };
  }

  const prompt = `Você é um sintetizador de dados rigoroso. O banco de dados retornou os seguintes dados CRUS (SQL) referentes ao tópico: "${state.research_topic}".

${toolMessages}

Crie um resumo COMPACTO E ESTRUTURADO preservando OBRIGATORIAMENTE:
- Todos os números REAIS do banco de dados (notas, totais, contagens). Se o banco diz 120, repasse 120.
- TODOS os links de chats encontrados no formato [[chat:ID|Nome (Telefone)]].

REGRA ANTI-ALUCINAÇÃO: Não invente nada. Apenas transcreva e organize os dados retornados acima.`;

  const response = await model.invoke([new HumanMessage(prompt)]);
  const compressed =
    typeof response.content === "string"
      ? response.content
      : Array.isArray(response.content)
        ? (response.content as Array<any>).map((c) => c?.text ?? "").join("")
        : "";

  return {
    compressed_research: `[DADOS COLETADOS PARA: "${state.research_topic}"]\n${compressed}`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CONDITION: O Roteador Blindado
// ─────────────────────────────────────────────────────────────────────────────
function researcherRouting(state: ResearcherState): string {
  if (state.iteration >= MAX_RESEARCHER_ITERATIONS) {
    return "compress_research";
  }

  const lastMsg = state.researcher_messages[state.researcher_messages.length - 1];
  const hasToolCalls =
    lastMsg instanceof AIMessage &&
    Array.isArray((lastMsg as any).tool_calls) &&
    (lastMsg as any).tool_calls.length > 0;

  // Se a IA gerou o tool_call, prossegue para a ferramenta
  if (hasToolCalls) return "researcher_tools";

  // Se a IA não gerou tool_call, vamos verificar se ela já havia rodado alguma ferramenta com sucesso antes
  const hasExecutedTool = state.researcher_messages.some(isToolMessageSafe);

  // Se já rodou, deixamos ela ir compilar os dados
  if (hasExecutedTool) return "compress_research";

  // Se não rodou nenhuma ferramenta e não gerou tool_call agora (tagarelou), aplicamos o nó da bronca
  return "reprimand";
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPILAÇÃO DO SUBGRAFO
// ─────────────────────────────────────────────────────────────────────────────
const researcherWorkflow = new StateGraph<ResearcherState>({ channels: stateChannels })
  .addNode("researcher", researcherNode)
  .addNode("researcher_tools", researcherToolsNode)
  .addNode("reprimand", reprimandNode)
  .addNode("compress_research", compressResearchNode);

researcherWorkflow.addEdge(START as any, "researcher" as any);
researcherWorkflow.addConditionalEdges("researcher" as any, researcherRouting as any);
researcherWorkflow.addEdge("researcher_tools" as any, "researcher" as any);
researcherWorkflow.addEdge("reprimand" as any, "researcher" as any);
researcherWorkflow.addEdge("compress_research" as any, END as any);

export const researcherGraph = researcherWorkflow.compile();