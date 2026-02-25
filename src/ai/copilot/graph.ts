import { AIMessage, BaseMessage, SystemMessage, HumanMessage } from "@langchain/core/messages";
import { START, StateGraph } from "@langchain/langgraph";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { copilotTools } from "./tools";

export interface CopilotState {
  messages: BaseMessage[];
  chat_id: number;
  patient_name: string;
  chat_history: string;
}

const copilotWorkflow = new StateGraph<CopilotState>({
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

copilotWorkflow.addNode("agent", async (state: CopilotState) => {
  // Atualizado para o modelo solicitado
  const model = new ChatGoogleGenerativeAI({
    model: "google/gemini-3-pro-preview", 
    apiKey: process.env.GOOGLE_API_KEY,
    temperature: 0.1, 
  });

  const modelWithTools = model.bindTools(copilotTools);

  const now = new Date().toISOString();

  // O SystemMessage carrega apenas as regras e o cérebro
  const SYSTEM_PROMPT = `Você é o Agente Copiloto de Atendimento de uma clínica de saúde.
Sua função é analisar a "Janela Deslizante" (o histórico recente) da conversa com o paciente e decidir OBRIGATORIAMENTE uma ação através das suas ferramentas.

DATA E HORA ATUAL DO SISTEMA: ${now}

REGRAS DE CONDUTA E LÓGICA:
1. Baseie-se ESTRITAMENTE no histórico fornecido na mensagem do usuário. Não invente procedimentos, valores ou sintomas.
2. Se a última mensagem (ou contexto principal) exige uma resposta imediata da clínica (ex: uma dúvida, um pedido de agendamento), acione a ferramenta 'suggest_immediate_reply'.
3. Se a conversa esfriou, terminou, ou o paciente pediu um tempo para pensar (ex: "vou ver com meu marido", "te aviso depois"), acione a ferramenta 'suggest_scheduled_message' calculando a data futura apropriada.
4. O 'chat_id' que você DEVE usar OBRIGATORIAMENTE na ferramenta é o ID numérico: ${state.chat_id}.
5. Use SEMPRE um tom de voz empático, profissional e acolhedor, típico de uma clínica de alto padrão.
6. Nunca ofereça descontos a menos que isso tenha sido explicitamente autorizado no histórico.

NOME DO PACIENTE PARA CONTEXTO: ${state.patient_name || "Paciente"}`;

  // O HumanMessage carrega o input de fato, evitando o erro de "contents is not specified" da API
  const HUMAN_PROMPT = `Aqui está o histórico cronológico exato da conversa:
-------------------------------------------------
${state.chat_history || "Nenhuma mensagem encontrada."}
-------------------------------------------------

Analise o histórico acima e acione a ferramenta adequada agora.`;

  const messagesToInvoke = state.messages.length > 0 
    ? state.messages 
    : [new SystemMessage(SYSTEM_PROMPT), new HumanMessage(HUMAN_PROMPT)];

  const response = (await modelWithTools.invoke(messagesToInvoke)) as AIMessage;

  return { messages: [response] };
});

copilotWorkflow.addNode("tools", new ToolNode(copilotTools));

// @ts-expect-error - Tipagem dinâmica do LangGraph no runtime
copilotWorkflow.addEdge(START, "agent");
// @ts-expect-error - Retorno nativo da condition do Langchain
copilotWorkflow.addConditionalEdges("agent", toolsCondition);
// @ts-expect-error - Retorno cíclico
copilotWorkflow.addEdge("tools", "agent");

export const copilotGraph = copilotWorkflow.compile();