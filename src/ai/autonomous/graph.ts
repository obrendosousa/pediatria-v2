import { AIMessage, BaseMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — @langchain/langgraph ships without declaration files; global d.ts in src/types/langgraph.d.ts
import { START, StateGraph } from "@langchain/langgraph";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — @langchain/langgraph/prebuilt ships without declaration files
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { autonomousTools } from "./tools";

// O Estado recebe a lista crua de chats dormentes para processamento em lote
export interface AutonomousAgentState {
  messages: BaseMessage[];
  dormant_chats: Array<{
    id: number;
    contact_name: string | null;
    stage: string | null;
    ai_summary: string | null;
  }>;
}

const autonomousWorkflow = new StateGraph<AutonomousAgentState>({
  channels: {
    messages: {
      reducer: (x: BaseMessage[], y: BaseMessage[]) => [...(x ?? []), ...(y ?? [])],
      default: () => [],
    },
    dormant_chats: {
      reducer: (x: AutonomousAgentState["dormant_chats"], y: AutonomousAgentState["dormant_chats"]) => y ?? x,
      default: () => [],
    },
  },
});

autonomousWorkflow.addNode("agent", async (state: AutonomousAgentState) => {
  // Inicializamos o modelo dentro do nó para garantir a leitura do .env
  const model = new ChatGoogleGenerativeAI({
    model: "gemini-2.5-flash",
    apiKey: process.env.GOOGLE_API_KEY,
    temperature: 0.2, // Temperatura baixa para respostas mais objetivas e focadas
  });

  const modelWithTools = model.bindTools(autonomousTools);

  // Formatamos a lista de chats de forma estruturada para o LLM entender
  const chatsContext = state.dormant_chats.map(chat => 
    `[CHAT ID: ${chat.id}] 
NOME: ${chat.contact_name || "Desconhecido"}
ESTÁGIO NO FUNIL: ${chat.stage || "N/A"}
RESUMO DA CONVERSA: ${chat.ai_summary || "Sem resumo disponível"}`
  ).join("\n\n------------------------\n\n");

  const DYNAMIC_SYSTEM_PROMPT = `Você é um Agente de Retenção Proativo de uma clínica de saúde.
Seu trabalho é analisar uma lista de clientes que pararam de responder no WhatsApp há mais de 2 horas.

Para CADA cliente na lista abaixo, você deve analisar o contexto e OBRIGATORIAMENTE acionar a ferramenta 'save_draft_reply' para gerar uma sugestão de mensagem de resgate.

REGRAS DE CONDUTA E SEGURANÇA:
1. Não crie informações médicas, não dê diagnósticos e não ofereça descontos.
2. Seja empático, curto e direto. Ninguém gosta de ler textos longos no WhatsApp.
3. Faça perguntas abertas para reengajar a conversa de forma natural. (Ex: "Ficou alguma dúvida sobre os valores?", "Posso ajudar a encontrar um horário melhor?").
4. Aja estritamente sobre os chats fornecidos abaixo. Chame a ferramenta uma vez para cada ID.

📋 LISTA DE CLIENTES DORMENTES NESTE LOTE:
${chatsContext || "Nenhum chat dormente no momento."}`;

  const response = (await modelWithTools.invoke([
    new SystemMessage(DYNAMIC_SYSTEM_PROMPT),
    new HumanMessage("Analise os chats dormentes listados e gere os rascunhos de resgate agora."),
    ...state.messages,
  ])) as AIMessage;

  return { messages: [response] };
});

autonomousWorkflow.addNode("tools", new ToolNode(autonomousTools));

autonomousWorkflow.addEdge(START, "agent");
autonomousWorkflow.addConditionalEdges("agent", toolsCondition);
autonomousWorkflow.addEdge("tools", "agent");

export const autonomousGraph = autonomousWorkflow.compile();