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
    model: "gemini-2.0-flash",
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
Sua função é analisar a "Janela Deslizante" (o histórico recente) da conversa com o paciente e decidir OBRIGATORIAMENTE uma ação através das suas ferramentas.

DATA E HORA ATUAL DO SISTEMA: ${now}

REGRAS DE CONDUTA E LÓGICA:
1. Baseie-se ESTRITAMENTE no histórico fornecido na mensagem do usuário. Não invente procedimentos, valores ou sintomas.
2. Se a última mensagem (ou contexto principal) exige uma resposta imediata da clínica (ex: uma dúvida, um pedido de agendamento), acione a ferramenta 'suggest_immediate_reply'.
3. Se a conversa esfriou, terminou, ou o paciente pediu um tempo para pensar (ex: "vou ver com meu marido", "te aviso depois"), acione a ferramenta 'suggest_scheduled_message' calculando a data futura apropriada.
4. Se a última mensagem for apenas um encerramento natural (ex: "ok", "obrigado", "beleza") e a conversa não exigir NENHUMA resposta da clínica nem acompanhamento futuro, acione a ferramenta 'suggest_ignore'.
5. O 'chat_id' que você DEVE usar OBRIGATORIAMENTE na ferramenta é o ID numérico: ${state.chat_id}.
6. Use SEMPRE um tom de voz empático, profissional e acolhedor, típico de uma clínica de alto padrão.
7. Nunca ofereça descontos a menos que isso tenha sido explicitamente autorizado no histórico.

NOME DO PACIENTE PARA CONTEXTO: ${state.patient_name || "Paciente"}${fewShotBlock}`;

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