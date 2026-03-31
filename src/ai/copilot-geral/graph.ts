import { AIMessage, BaseMessage, SystemMessage, HumanMessage } from "@langchain/core/messages";
import { START, StateGraph } from "@langchain/langgraph";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { createSchemaAdminClient } from "@/lib/supabase/schemaServer";
import { copilotGeralTools } from "./tools";
import { getVaultService, isVaultAvailable } from "@/ai/vault/service";
import { semanticSearchSimple } from "@/ai/vault/semantic";

export interface CopilotGeralState {
  messages: BaseMessage[];
  chat_id: number;
  patient_name: string;
  chat_history: string;
}

const copilotGeralWorkflow = new StateGraph<CopilotGeralState>({
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

copilotGeralWorkflow.addNode("agent", async (state: CopilotGeralState) => {
  const model = new ChatGoogleGenerativeAI({
    model: "gemini-3.1-flash-lite-preview",
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
    temperature: 0.1,
  });

  const modelWithTools = model.bindTools(copilotGeralTools);

  const now = new Date().toISOString();

  // -- RAG: busca exemplos aprovados + vault semantic search para few-shot --
  let fewShotBlock = "";
  try {
    const supabase = createSchemaAdminClient('atendimento');

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
        ? (supabase as ReturnType<typeof createSchemaAdminClient>)
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
          .readNote("agents/copilot-geral/approved-responses.md")
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
      console.log(`[Copiloto Geral RAG] ${ilikExamples.length} exemplo(s) ilike para "${searchWord}".`);
    }

    if (semanticResults.length > 0) {
      parts.push(
        semanticResults
          .map((content, i) => `[Vault ${i + 1}] ${content}`)
          .join("\n")
      );
      console.log(`[Copiloto Geral RAG] ${semanticResults.length} resultado(s) semantico(s) do vault.`);
    }

    if (approvedContent && approvedContent.trim().length > 20) {
      parts.push(`[Respostas compiladas]\n${approvedContent.slice(0, 500)}`);
    }

    if (parts.length > 0) {
      fewShotBlock =
        `\n\nEXEMPLOS DE RESPOSTAS APROVADAS PELO ATENDIMENTO (use como referencia de tom e formato):\n` +
        parts.join("\n\n");
    }
  } catch (ragError) {
    // RAG e best-effort: falha silenciosamente para nao bloquear a sugestao
    console.warn("[Copiloto Geral RAG] Falha na busca de exemplos:", ragError);
  }
  // -------------------------------------------------------------------------

  const SYSTEM_PROMPT = `Voce e o Copiloto Proativo do Atendimento da Clinica Alianca (clinica geral).
Sua missao: detectar MOMENTOS CRITICOS na conversa e sugerir a resposta perfeita para o atendente enviar.

DATA E HORA ATUAL: ${now}
PACIENTE: ${state.patient_name || "Paciente"}
CHAT ID (use OBRIGATORIAMENTE nas ferramentas): ${state.chat_id}

════════════════════════════════════════════
QUANDO SUGERIR (chame 'suggest_immediate_reply'):
════════════════════════════════════════════
1. OBJECAO DE PRECO — paciente acha caro, pergunta sobre desconto, reclama do valor
   → Quebre a objecao com VALOR, nao com preco. Destaque beneficios clinicos, experiencia, seguranca.
   → Ex: "Entendo sua preocupacao! O valor inclui [beneficio]. Nossos profissionais possuem ampla experiencia e isso faz toda a diferenca para o seu tratamento."

2. OBJECAO DE TEMPO — "vou pensar", "depois", "vou ver com meu marido/esposa"
   → Respeite a decisao mas deixe a porta aberta. Ofereca informacao adicional.
   → Ex: "Sem pressa! Vou te enviar um material sobre o procedimento pra voce ler com calma. Se tiver qualquer duvida, estou aqui."

3. OBJECAO DE INSEGURANCA — "tenho medo", "doi?", "e seguro?"
   → Acolha com empatia e de informacoes que tranquilizem.
   → Ex: "E super tranquilo! O procedimento e feito com [detalhe]. Nossa equipe cuida de cada etapa com muito cuidado."

4. PERGUNTA SOBRE PRECO/CONVENIO — "quanto custa?", "aceita plano?"
   → Responda diretamente e ja agregue valor na mesma mensagem.

5. DUVIDA CLINICA — "como funciona?", "precisa de exame?"
   → Responda de forma simples e acessivel. Nunca use jargao medico pesado.

6. URGENCIA — "dor", "febre", "emergencia"
   → Priorize agilidade: sugira encaixe ou orientacao imediata.

════════════════════════════════════════════
QUANDO NAO SUGERIR (chame 'suggest_ignore'):
════════════════════════════════════════════
- "Ok", "obrigado(a)", "bom dia", "ta bom", stickers, emojis isolados
- Confirmacoes simples sem necessidade de resposta
- Mensagens que o atendente ja respondeu adequadamente
- Quando a conversa esta fluindo bem sem obstaculos
- REGRA CRITICA: Se a ULTIMA mensagem no historico e da Clinica/atendente (nao do paciente), chame 'suggest_ignore' OBRIGATORIAMENTE. Nao faz sentido sugerir resposta para nossa propria mensagem.

════════════════════════════════════════════
QUANDO AGENDAR FOLLOW-UP (chame 'suggest_scheduled_message'):
════════════════════════════════════════════
- Paciente disse "vou pensar" e a conversa esfriou → agende resgate para 24-48h
- Paciente perguntou algo e nao respondeu apos 2+ horas → agende lembrete gentil

════════════════════════════════════════════
REGRAS DE QUALIDADE:
════════════════════════════════════════════
- Tom: empatico, acolhedor, profissional. Nunca agressivo ou insistente.
- Tamanho: mensagens CURTAS (2-3 frases). O atendente esta em tempo real.
- Emojis: use com moderacao (max 1-2 por mensagem).
- Nunca invente valores, procedimentos ou informacoes que nao estejam no historico.
- Nunca ofereca descontos sem autorizacao explicita.
- Baseie-se SOMENTE no historico fornecido e na base de conhecimento.
- PROIBIDO escrever texto antes de chamar a ferramenta. Chame diretamente.

Use SEMPRE o chat_id numerico ${state.chat_id} no campo 'chat_id' da ferramenta.${fewShotBlock}`;

  const HUMAN_PROMPT = `Aqui esta o historico cronologico exato da conversa:
-------------------------------------------------
${state.chat_history || "Nenhuma mensagem encontrada."}
-------------------------------------------------

Analise o historico acima e acione a ferramenta adequada agora.`;

  // Forca o array a SEMPRE comecar com o System e o Human, e depois injeta as invocacoes de ferramenta
  // salvas no state. Isso mantem a estrita ordem cronologica exigida pela API do Gemini.
  const messagesToInvoke = [
    new SystemMessage(SYSTEM_PROMPT),
    new HumanMessage(HUMAN_PROMPT),
    ...state.messages
  ];

  const response = (await modelWithTools.invoke(messagesToInvoke)) as AIMessage;

  return { messages: [response] };
});

copilotGeralWorkflow.addNode("tools", new ToolNode(copilotGeralTools));

// @ts-expect-error LangGraph tipagem dinâmica de nós
copilotGeralWorkflow.addEdge(START, "agent");
// @ts-expect-error LangGraph tipagem dinâmica de nós
copilotGeralWorkflow.addConditionalEdges("agent", toolsCondition);
// @ts-expect-error LangGraph tipagem dinâmica de nós
copilotGeralWorkflow.addEdge("tools", "agent");

export const copilotGeralGraph = copilotGeralWorkflow.compile();
