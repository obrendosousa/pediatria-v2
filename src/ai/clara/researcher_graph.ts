/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — @langchain/langgraph ships without declaration files; global d.ts in src/types/langgraph.d.ts
import { END, START, StateGraph } from "@langchain/langgraph";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — @langchain/langgraph/prebuilt ships without declaration files
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

import { allResearchTools } from "./tools";
import { getFilteredChatsListTool, getChatCascadeHistoryTool, getAggregatedInsightsTool } from "@/ai/analyst/tools";
import { vaultReadTool, vaultSearchTool, vaultSemanticSearchTool } from "@/ai/vault/tools";

// allResearchTools NÃO inclui analyst tools nem vault tools — adicionados aqui uma única vez, sem duplicatas.
const researcherTools = [
  ...allResearchTools,
  getFilteredChatsListTool,
  getChatCascadeHistoryTool,
  getAggregatedInsightsTool,
  vaultReadTool,
  vaultSearchTool,
  vaultSemanticSearchTool,
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

2. get_aggregated_insights(start_date, end_date)
   → Insights agregados da tabela chat_insights: tópicos, decisões, objeções mais frequentes
   → Use para análises de período específico com datas definidas

4. execute_sql(sql)
   → Para queries personalizadas: financeiro, agendamentos, JOINs, aggregations
   → Você escreve o SQL. Datas BRT: '2026-02-24T00:00:00-03:00'::timestamptz
   → Ex: SELECT unnest(objecoes) AS objecao, COUNT(*) FROM chat_insights WHERE updated_at >= '...' GROUP BY 1 ORDER BY 2 DESC LIMIT 20

5. BUSCA EM MENSAGENS — SEQUÊNCIA OBRIGATÓRIA (2 passos no loop ReAct):
   → Passo 1: get_filtered_chats_list(start_date='...', end_date='...', limit=30) → obtém IDs dos chats
   → Passo 2: get_chat_cascade_history(chat_id=ID) para cada chat relevante → lê o histórico completo
   → Use SOMENTE quando precisar LER o texto das mensagens (padrões de linguagem, argumentos, tom)

6. save_report — NÃO USE. O relatório final é salvo pelo orchestrador após todas as pesquisas. Focar em pesquisar e retornar dados, não em salvar relatórios parciais.

SCHEMA E MAPEAMENTO DE REMETENTES (CRÍTICO — leia antes de escrever qualquer SQL):
• chats: id, contact_name, phone, stage (new|em_triagem|agendando|fila_espera|qualified|lost|won|done), ai_sentiment (positive|negative|neutral), last_interaction_at, status

• chat_messages: id, chat_id, sender, message_text, created_at
  SENDER VALUES (ESSENCIAL):
  → 'HUMAN_AGENT' = secretária/atendente humano (ex: Joana) ← use para analisar SCRIPT de atendimento
  → 'CUSTOMER' = paciente/lead ← use para analisar dúvidas, objeções, linguagem dos pacientes
  → 'AI_AGENT' = bot/Clara ← use para analisar respostas automáticas
  ⚠️ "Joana" NÃO é um contact_name da tabela chats — ela é sender='HUMAN_AGENT' na tabela chat_messages

  SQL PRONTOS:
  • Script da secretária → execute_sql: SELECT cm.message_text, c.contact_name, cm.created_at FROM chat_messages cm JOIN chats c ON c.id = cm.chat_id WHERE cm.sender = 'HUMAN_AGENT' AND cm.message_text IS NOT NULL ORDER BY cm.created_at DESC LIMIT 200
  • Mensagens de pacientes → execute_sql: SELECT cm.message_text, c.contact_name FROM chat_messages cm JOIN chats c ON c.id = cm.chat_id WHERE cm.sender = 'CUSTOMER' AND cm.message_text IS NOT NULL ORDER BY cm.created_at DESC LIMIT 200
  • Contagem por tipo → execute_sql: SELECT sender, COUNT(*) FROM chat_messages WHERE created_at >= '2026-02-01T00:00:00-03:00'::timestamptz GROUP BY sender

• chat_insights: id, chat_id, nota_atendimento (0-10), sentimento, objecoes (text[]), gargalos (text[]), decisao, updated_at

• patients: id, name, phone, email, birth_date, created_at
• appointments: id, patient_id, scheduled_date, status (confirmed|cancelled|no_show|completed), notes, created_at
• financial_transactions: id, patient_id, description, amount, type (revenue|expense), status, created_at

SQL TEMPLATES FINANCEIROS E DE FUNIL:
• Funil de conversão → execute_sql: SELECT stage, COUNT(*) as total FROM chats WHERE last_interaction_at >= '...' GROUP BY stage ORDER BY total DESC
• Pacientes perdidos → execute_sql: SELECT c.id, c.contact_name, c.phone, c.stage, c.ai_sentiment FROM chats c WHERE c.stage = 'lost' AND c.last_interaction_at >= '...' ORDER BY c.last_interaction_at DESC LIMIT 50
• Cruzamento chat × insights → execute_sql: SELECT c.id, c.contact_name, c.stage, ci.nota_atendimento, ci.sentimento, ci.decisao, ci.objecoes FROM chats c JOIN chat_insights ci ON ci.chat_id = c.id WHERE c.last_interaction_at >= '...' ORDER BY ci.nota_atendimento ASC LIMIT 50

REGRA ANTI-SUPERFICIALIDADE: Não retorne apenas contagens agregadas. Para cada categoria, extraia EXEMPLOS CONCRETOS com nomes, IDs de chat e contexto. Inclua sempre o chat.id para gerar links [[chat:ID|Nome (Telefone)]].`;

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

  const today = new Date().toISOString().slice(0, 10);

  const initialPrompt = `${RESEARCHER_SYSTEM}\n\nHoje é ${today}.\nTópico OBRIGATÓRIO a investigar via ferramenta agora:\n"${state.research_topic}"\n\nATENÇÃO: Não responda com texto livre. Emita a chamada de função (tool_call) imediatamente para buscar os dados.`;

  // Construir mensagens do ZERO a cada iteração para evitar erros do Gemini
  // com sequências inválidas (AI sem tool_calls seguido de Human).
  // Mantém apenas pares válidos: AI(tool_calls) → ToolMessage(s)
  const toolPairs: BaseMessage[] = [];
  const msgs = state.researcher_messages;
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i] as any;
    const isAI = m instanceof AIMessage || m._getType?.() === "ai" || m.type === "ai";
    if (isAI && Array.isArray(m.tool_calls) && m.tool_calls.length > 0) {
      toolPairs.push(m);
      // Coletar todos os ToolMessages subsequentes
      for (let j = i + 1; j < msgs.length; j++) {
        if (isToolMessageSafe(msgs[j])) {
          toolPairs.push(msgs[j]);
        } else {
          break;
        }
      }
    }
  }

  const messages: BaseMessage[] = [
    new HumanMessage(initialPrompt),
    ...toolPairs,
  ];

  // Temperatura zero + streaming false para forçar AIMessage (não AIMessageChunk)
  // LangGraph usa streaming interno que retorna AIMessageChunk com tool_call_chunks vazio
  // mesmo quando Gemini retorna functionCall no content.
  const model = new ChatGoogleGenerativeAI({
    model: "gemini-3.1-flash-preview",
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
    temperature: 0,
    streaming: false,
  }).bindTools(researcherTools);

  const response = (await model.invoke(messages)) as AIMessage;

  // Fix: Gemini pode retornar tool calls no content como functionCall
  // em vez de popular tool_calls (bug no adapter com streaming do LangGraph)
  if ((!response.tool_calls || response.tool_calls.length === 0) && Array.isArray(response.content)) {
    const functionCalls = (response.content as any[]).filter(
      (c: any) => c.type === "functionCall" || c.functionCall
    );
    if (functionCalls.length > 0) {
      response.tool_calls = functionCalls.map((fc: any, idx: number) => {
        const call = fc.functionCall || fc;
        return {
          name: call.name,
          args: call.args || {},
          id: `fc_${Date.now()}_${idx}`,
          type: "tool_call" as const,
        };
      });
    }
  }

  return {
    researcher_messages: [response],
    iteration: state.iteration + 1,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// NODE 2: researcher_tools_node (wrapper para usar researcher_messages em vez de messages)
// ─────────────────────────────────────────────────────────────────────────────
const _innerToolNode = new ToolNode(researcherTools);

async function researcherToolsNode(state: ResearcherState): Promise<Partial<ResearcherState>> {
  // ToolNode espera { messages: BaseMessage[] }. Researcher usa researcher_messages.
  const result = await _innerToolNode.invoke({ messages: state.researcher_messages });
  const toolMessages = (result as any).messages || [];
  return { researcher_messages: toolMessages };
}

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
    model: "gemini-3.1-flash-preview",
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

  const lastMsg = state.researcher_messages[state.researcher_messages.length - 1] as any;

  // Verificar tool_calls no campo padrão
  const hasToolCalls =
    (lastMsg instanceof AIMessage || lastMsg?._getType?.() === "ai" || lastMsg?.type === "ai") &&
    Array.isArray(lastMsg.tool_calls) &&
    lastMsg.tool_calls.length > 0;

  // Fallback: verificar functionCall no content (formato Gemini via LangGraph streaming)
  const hasContentToolCalls =
    !hasToolCalls &&
    Array.isArray(lastMsg?.content) &&
    (lastMsg.content as any[]).some((c: any) => c.type === "functionCall" || c.functionCall);

  // Se a IA gerou o tool_call, prossegue para a ferramenta
  if (hasToolCalls || hasContentToolCalls) return "researcher_tools";

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