import { AIMessage, BaseMessage, SystemMessage, HumanMessage } from "@langchain/core/messages";
import { START, StateGraph } from "@langchain/langgraph";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { getSupabaseAdminClient } from "@/lib/automation/adapters/supabaseAdmin";
import { copilotTools } from "./tools";
import { getVaultService, isVaultAvailable } from "@/ai/vault/service";
import { semanticSearchSimple } from "@/ai/vault/semantic";

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
      reducer: (x: number, y: number) => y ?? x,
      default: () => 0,
    },
    patient_name: {
      reducer: (x: string, y: string) => y ?? x,
      default: () => "Paciente",
    },
    chat_history: {
      reducer: (x: string, y: string) => y ?? x,
      default: () => "",
    },
  },
});

copilotWorkflow.addNode("agent", async (state: CopilotState) => {
  const model = new ChatGoogleGenerativeAI({
    model: "gemini-3.1-pro-preview",
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
    temperature: 0.1,
  });

  const modelWithTools = model.bindTools(copilotTools);

  const now = new Date().toISOString();

  // ── RAG: busca exemplos aprovados + vault semantic search para few-shot ──
  let fewShotBlock = "";
  try {
    const supabase = getSupabaseAdminClient();

    // Extrai a ultima mensagem do paciente para usar como query de busca
    const historyLines = (state.chat_history || "").split("\n").reverse();
    const lastPatientLine = historyLines.find(
      (line) => line.includes(`${state.patient_name}:`) || line.toLowerCase().includes("paciente:")
    ) || historyLines[0] || "";

    const cleanedLine = lastPatientLine.replace(/^\[[\d:]+\]\s*[^:]+:\s*/, "").trim();

    // Busca em paralelo: ilike no Supabase + semantica no vault + respostas aprovadas do vault
    const searchWord = cleanedLine.split(/\s+/).find((w) => w.length > 4) || "";

    type KBExample = { pergunta: string; resposta_ideal: string };

    const [ilikeFetch, vaultSemanticFetch, vaultApprovedFetch] = await Promise.allSettled([
      // 1. ilike no Supabase (legado, rapido)
      searchWord
        ? supabase
            .from("knowledge_base")
            .select("pergunta, resposta_ideal")
            .eq("categoria", "copiloto_feedback")
            .ilike("pergunta", `%${searchWord}%`)
            .order("created_at", { ascending: false })
            .limit(3)
            .then((res) => (res.data || []) as KBExample[])
        : Promise.resolve([] as KBExample[]),

      // 2. Busca semantica no vault (por significado)
      cleanedLine.length > 10
        ? semanticSearchSimple(cleanedLine, 3)
        : Promise.resolve([] as string[]),

      // 3. Respostas aprovadas compiladas do vault
      isVaultAvailable().then((available) => {
        if (!available) return null;
        return getVaultService()
          .readNote("agents/copilot/approved-responses.md")
          .then((n) => n.content)
          .catch(() => null);
      }),
    ]);

    const ilikExamples = ilikeFetch.status === "fulfilled" ? ilikeFetch.value : [];
    const semanticResults = vaultSemanticFetch.status === "fulfilled" ? vaultSemanticFetch.value : [];
    const approvedContent = vaultApprovedFetch.status === "fulfilled" ? vaultApprovedFetch.value : null;

    const parts: string[] = [];

    if (ilikExamples.length > 0) {
      parts.push(
        ilikExamples
          .map((ex, i) => `[${i + 1}] Resposta aprovada: "${ex.resposta_ideal}"`)
          .join("\n")
      );
      console.log(`[Copiloto RAG] ${ilikExamples.length} exemplo(s) ilike para "${searchWord}".`);
    }

    if (semanticResults.length > 0) {
      parts.push(
        semanticResults
          .map((content, i) => `[Vault ${i + 1}] ${content}`)
          .join("\n")
      );
      console.log(`[Copiloto RAG] ${semanticResults.length} resultado(s) semantico(s) do vault.`);
    }

    if (approvedContent && approvedContent.trim().length > 20) {
      parts.push(`[Respostas compiladas]\n${approvedContent.slice(0, 500)}`);
    }

    if (parts.length > 0) {
      fewShotBlock =
        `\n\nEXEMPLOS DE RESPOSTAS APROVADAS PELA SECRETARIA (use como referencia de tom e formato):\n` +
        parts.join("\n\n");
    }
  } catch (ragError) {
    // RAG e best-effort: falha silenciosamente para nao bloquear a sugestao
    console.warn("[Copiloto RAG] Falha na busca de exemplos:", ragError);
  }
  // ─────────────────────────────────────────────────────────────────────────

  const SYSTEM_PROMPT = `Você é o Copiloto Proativo da Joana, secretária da Clínica Aliança Kids (pediatria).
Sua missão: detectar MOMENTOS CRÍTICOS na conversa e sugerir a resposta perfeita para a Joana enviar.

DATA E HORA ATUAL: ${now}
PACIENTE: ${state.patient_name || "Paciente"}
CHAT ID (use OBRIGATORIAMENTE nas ferramentas): ${state.chat_id}

════════════════════════════════════════════
QUANDO SUGERIR (chame 'suggest_immediate_reply'):
════════════════════════════════════════════
1. OBJEÇÃO DE PREÇO — paciente acha caro, pergunta sobre desconto, reclama do valor
   → Quebre a objeção com VALOR, não com preço. Destaque benefícios clínicos, experiência, segurança.
   → Ex: "Entendo sua preocupação! O valor inclui [benefício]. A Dra. tem mais de X anos de experiência e isso faz toda a diferença para a segurança do seu filho(a)."

2. OBJEÇÃO DE TEMPO — "vou pensar", "depois", "vou ver com meu marido"
   → Respeite a decisão mas deixe a porta aberta. Ofereça informação adicional.
   → Ex: "Sem pressa! Vou te enviar um material sobre o procedimento pra vocês lerem com calma. Se tiver qualquer dúvida, estou aqui 😊"

3. OBJEÇÃO DE INSEGURANÇA — "tenho medo", "dói?", "é seguro?"
   → Acolha com empatia e dê informações que tranquilizem.
   → Ex: "É super tranquilo! É feito com [detalhe]. A Dra. cuida de cada etapa com muito carinho."

4. PERGUNTA SOBRE PREÇO/CONVÊNIO — "quanto custa?", "aceita plano?"
   → Responda diretamente e já agregue valor na mesma mensagem.

5. DÚVIDA CLÍNICA — "como funciona?", "precisa de exame?"
   → Responda de forma simples e acessível. Nunca use jargão médico pesado.

6. URGÊNCIA — "dor", "febre", "emergência"
   → Priorize agilidade: sugira encaixe ou orientação imediata.

════════════════════════════════════════════
QUANDO NÃO SUGERIR (chame 'suggest_ignore'):
════════════════════════════════════════════
- "Ok", "obrigado(a)", "bom dia", "tá bom", stickers, emojis isolados
- Confirmações simples sem necessidade de resposta
- Mensagens que a Joana já respondeu adequadamente
- Quando a conversa está fluindo bem sem obstáculos

════════════════════════════════════════════
QUANDO AGENDAR FOLLOW-UP (chame 'suggest_scheduled_message'):
════════════════════════════════════════════
- Paciente disse "vou pensar" e a conversa esfriou → agende resgate para 24-48h
- Paciente perguntou algo e não respondeu após 2+ horas → agende lembrete gentil

════════════════════════════════════════════
REGRAS DE QUALIDADE:
════════════════════════════════════════════
- Tom: empático, acolhedor, profissional. Nunca agressivo ou insistente.
- Tamanho: mensagens CURTAS (2-3 frases). Joana está em tempo real.
- Emojis: use com moderação (máx 1-2 por mensagem).
- Nunca invente valores, procedimentos ou informações que não estejam no histórico.
- Nunca ofereça descontos sem autorização explícita.
- Baseie-se SOMENTE no histórico fornecido e na base de conhecimento.
- PROIBIDO escrever texto antes de chamar a ferramenta. Chame diretamente.

Use SEMPRE o chat_id numérico ${state.chat_id} no campo 'chat_id' da ferramenta.${fewShotBlock}`;

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

copilotWorkflow.addEdge(START, "agent");
copilotWorkflow.addConditionalEdges("agent", toolsCondition);
copilotWorkflow.addEdge("tools", "agent");

export const copilotGraph = copilotWorkflow.compile();