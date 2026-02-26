import { AIMessage, BaseMessage, SystemMessage, HumanMessage } from "@langchain/core/messages";
import { START, StateGraph } from "@langchain/langgraph";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { getSupabaseAdminClient } from "@/lib/automation/adapters/supabaseAdmin";
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
  const model = new ChatGoogleGenerativeAI({
    model: "gemini-3-flash-preview",
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
    temperature: 0.1,
  });

  const modelWithTools = model.bindTools(copilotTools);

  const now = new Date().toISOString();

  // ── RAG: busca exemplos aprovados pela secretária para few-shot prompting ──
  let fewShotBlock = "";
  try {
    const supabase = getSupabaseAdminClient();

    // Extrai a última mensagem do paciente para usar como query de busca
    const historyLines = (state.chat_history || "").split("\n").reverse();
    const lastPatientLine = historyLines.find(
      (line) => line.includes(`${state.patient_name}:`) || line.toLowerCase().includes("paciente:")
    ) || historyLines[0] || "";

    // Obtém a primeira palavra significativa (>4 chars) para o ilike
    const searchWord = lastPatientLine
      .replace(/^\[[\d:]+\]\s*[^:]+:\s*/, "")
      .trim()
      .split(/\s+/)
      .find((w) => w.length > 4) || "";

    if (searchWord) {
      const { data: examples } = await (supabase as any)
        .from("knowledge_base")
        .select("pergunta, resposta_ideal")
        .eq("categoria", "copiloto_feedback")
        .ilike("pergunta", `%${searchWord}%`)
        .order("created_at", { ascending: false })
        .limit(3);

      if (examples && examples.length > 0) {
        fewShotBlock =
          `\n\nEXEMPLOS DE RESPOSTAS APROVADAS PELA SECRETÁRIA (use como referência de tom e formato):\n` +
          examples
            .map(
              (ex: any, i: number) =>
                `[${i + 1}] Resposta aprovada: "${ex.resposta_ideal}"`
            )
            .join("\n");
        console.log(`🎯 [Copiloto RAG] ${examples.length} exemplo(s) encontrado(s) para "${searchWord}".`);
      }
    }
  } catch (ragError) {
    // RAG é best-effort: falha silenciosamente para não bloquear a sugestão
    console.warn("[Copiloto RAG] Falha na busca de exemplos:", ragError);
  }
  // ─────────────────────────────────────────────────────────────────────────

  const SYSTEM_PROMPT = `Você é o Agente Copiloto de Atendimento de uma clínica de saúde.
Sua única função é chamar UMA das três ferramentas disponíveis após analisar o histórico da conversa.

DATA E HORA ATUAL: ${now}
PACIENTE: ${state.patient_name || "Paciente"}
CHAT ID (use OBRIGATORIAMENTE nas ferramentas): ${state.chat_id}

REGRAS ABSOLUTAS — LEIA COM ATENÇÃO:
- PROIBIDO escrever qualquer texto, raciocínio, plano ou código antes de chamar a ferramenta.
- PROIBIDO usar blocos de código, console.log ou simular execução de código. Você NÃO tem acesso a execução de código.
- Chame a ferramenta diretamente, de forma silenciosa, sem nenhum prefácio.
- Use SEMPRE o chat_id numérico ${state.chat_id} no campo 'chat_id' da ferramenta.

LÓGICA DE DECISÃO:
1. Paciente fez pergunta, pedido de agendamento ou a conversa exige resposta imediata → chame 'suggest_immediate_reply'.
2. Conversa esfriou, terminou naturalmente ou paciente pediu um tempo ("vou ver com meu marido", "te aviso depois") → chame 'suggest_scheduled_message' com a data futura correta.
3. Mensagem é apenas encerramento ou agradecimento sem necessidade de acompanhamento → chame 'suggest_ignore'.

QUALIDADE DA SUGESTÃO:
- Tom empático, profissional e acolhedor (clínica de alto padrão).
- Baseie-se SOMENTE no histórico fornecido. Nunca invente valores, procedimentos ou sintomas.
- Nunca ofereça descontos sem autorização explícita no histórico.${fewShotBlock}`;

  const HUMAN_PROMPT = `Aqui está o histórico cronológico exato da conversa:
-------------------------------------------------
${state.chat_history || "Nenhuma mensagem encontrada."}
-------------------------------------------------

Analise o histórico acima e acione a ferramenta adequada agora.`;

  // CORREÇÃO CRÍTICA AQUI:
  // Força o array a SEMPRE começar com o System e o Human, e depois injeta as invocações de ferramenta 
  // salvas no state. Isso mantém a estrita ordem cronológica exigida pela API do Gemini.
  const messagesToInvoke = [
    new SystemMessage(SYSTEM_PROMPT),
    new HumanMessage(HUMAN_PROMPT),
    ...state.messages
  ];

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