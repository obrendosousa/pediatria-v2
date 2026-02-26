import { AIMessage, BaseMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { START, StateGraph } from "@langchain/langgraph";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { getChatCascadeHistoryTool } from "@/ai/analyst/tools";
import { searchKnowledgeBaseTool } from "@/ai/clara/tools";

// Grafo exclusivo para o mini-chat da Aba Copiloto na sidebar.
// Diferente do copilotGraph (fire-and-forget), este suporta streaming interativo.
export interface CopilotChatState {
  messages: BaseMessage[];
  chat_id: number;
  patient_name: string;
  // Histórico pré-carregado pela rota de API — injeta contexto sem tool call extra
  chat_history: string;
}

const copilotChatTools = [getChatCascadeHistoryTool, searchKnowledgeBaseTool];

const copilotChatWorkflow = new StateGraph<CopilotChatState>({
  channels: {
    messages: {
      reducer: (x: BaseMessage[], y: BaseMessage[]) => [...(x ?? []), ...(y ?? [])],
      default: () => [],
    },
    chat_id: {
      reducer: (x, y) => y ?? x,
      default: () => 0,
    },
    patient_name: {
      reducer: (x, y) => y ?? x,
      default: () => "Paciente",
    },
    chat_history: {
      reducer: (x, y) => y ?? x,
      default: () => "",
    },
  },
});

copilotChatWorkflow.addNode("agent", async (state: CopilotChatState) => {
  const model = new ChatGoogleGenerativeAI({
    model: "gemini-2.0-flash",
    apiKey: process.env.GOOGLE_API_KEY,
    temperature: 0.3,
    streaming: true,
  });

  const modelWithTools = model.bindTools(copilotChatTools);

  const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

  const systemPrompt = `Você é a Clara, copilota inteligente da secretária Joana da clínica.
Joana está atendendo o(a) paciente "${state.patient_name}" (chat_id interno: ${state.chat_id}).
DATA/HORA ATUAL: ${now}

CONTEXTO RECENTE DA CONVERSA COM O PACIENTE:
-------------------------------------------------
${state.chat_history || "Nenhuma mensagem disponível ainda."}
-------------------------------------------------

SUAS FUNÇÕES:
- Responder perguntas de Joana sobre este paciente ou conversa específica.
- Resumir o caso, identificar objeções, sugerir abordagens, explicar o histórico.
- Se Joana pedir mais histórico (ex: "mostra as últimas 30 mensagens"), use a ferramenta get_chat_cascade_history com o chat_id ${state.chat_id}.
- Se Joana perguntar sobre preços ou procedimentos da clínica, consulte a base de conhecimento.

REGRAS:
- Seja conciso e direto. Joana está em atendimento em tempo real.
- Nunca invente informações que não estejam no histórico ou na base de conhecimento.
- Nunca sugira descontos a menos que esteja explicitamente autorizado.`;

  const messagesToInvoke = [
    new SystemMessage(systemPrompt),
    ...state.messages,
  ];

  const response = (await modelWithTools.invoke(messagesToInvoke)) as AIMessage;

  return { messages: [response] };
});

copilotChatWorkflow.addNode("tools", new ToolNode(copilotChatTools));

// @ts-expect-error - Tipagem dinâmica do LangGraph no runtime
copilotChatWorkflow.addEdge(START, "agent");
// @ts-expect-error - Retorno nativo da condition do Langchain
copilotChatWorkflow.addConditionalEdges("agent", toolsCondition);
// @ts-expect-error - Retorno cíclico
copilotChatWorkflow.addEdge("tools", "agent");

export const copilotChatGraph = copilotChatWorkflow.compile();
