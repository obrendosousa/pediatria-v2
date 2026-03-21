import { AIMessage, BaseMessage, SystemMessage } from "@langchain/core/messages";
import { START, StateGraph } from "@langchain/langgraph";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { AnalystAgentState } from "./state";
import { analystTools } from "./tools";
import { analystVaultTools } from "@/ai/vault/tools";
import { getVaultService, isVaultAvailable } from "@/ai/vault/service";

// Analyst tools + vault tools (leitura, busca, log de decisoes)
const allAnalystTools = [
  ...analystTools,
  ...analystVaultTools,
];

const analystWorkflow = new StateGraph<AnalystAgentState>({
  channels: {
    messages: {
      reducer: (x: BaseMessage[] | undefined, y: BaseMessage[] | undefined) => [...(x ?? []), ...(y ?? [])],
      default: () => [] as BaseMessage[],
    },
    current_analysis_context: {
      reducer: (x: string | undefined, y: string | undefined) => y ?? x,
      default: () => undefined,
    },
    active_filters: {
      reducer: (
        x: AnalystAgentState["active_filters"] | undefined,
        y: AnalystAgentState["active_filters"] | undefined
      ) => y ?? x,
      default: () => undefined,
    },
  },
});

// Node de pre-carregamento do vault: insights anteriores + decisoes recentes
analystWorkflow.addNode("load_vault_context", async () => {
  if (!(await isVaultAvailable())) return {};
  try {
    const vault = getVaultService();
    const [insights, decisions] = await Promise.all([
      vault.readNote("agents/analyst/insights-cache.md").then((n) => n.content).catch(() => null),
      vault.listNotes("decisions/", { limit: 5, sortBy: "mtime", order: "desc" })
        .then((notes) => notes.map((d) => (d.frontmatter.summary as string) || d.path))
        .catch(() => [] as string[]),
    ]);
    const contextBlock = [
      insights ? `INSIGHTS ANTERIORES:\n${insights}` : "",
      decisions.length ? `DECISOES RECENTES:\n${decisions.join("\n")}` : "",
    ].filter(Boolean).join("\n\n");
    return { current_analysis_context: contextBlock || undefined };
  } catch {
    return {};
  }
});

analystWorkflow.addNode("analyst_agent", async (state: AnalystAgentState) => {
  // 1. INICIALIZAMOS O MODELO AQUI DENTRO (Garante que o .env já foi lido pelo Next.js no runtime)
  const model = new ChatGoogleGenerativeAI({
    model: "gemini-3.1-pro-preview",
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
    temperature: 0.1,
  });
  const modelWithTools = model.bindTools(allAnalystTools);

  // 2. Lógica de Tempo
  const now = new Date();
  const dataAtual = now.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const partesData = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const dataIsoCurta = partesData;

  // Contexto do vault (insights + decisoes) carregado pelo node anterior
  const vaultContextBlock = state.current_analysis_context
    ? `\n\n  📂 CONTEXTO DO VAULT (cerebro compartilhado):\n  ${state.current_analysis_context}`
    : "";

  // 3. Prompt
  const DYNAMIC_SYSTEM_PROMPT = `Você é o "Cérebro" da operação, um Analista de Dados Sênior e Auditor de Qualidade clínico. Você é altamente analítico, pró-ativo e focado em melhorar a conversão e o atendimento via WhatsApp da clínica.

  🕒 CONTEXTO TEMPORAL (MUITO IMPORTANTE):
  - Hoje é exatamente: ${dataAtual} (Data de referência ISO: ${dataIsoCurta}).
  - Se o gestor pedir dados de "hoje", "ontem", ou "esta semana", use EXATAMENTE estas datas como base para seus cálculos e para os parâmetros de data das ferramentas.
  - NUNCA assuma que estamos em 2023 ou em qualquer outra data que não seja a informada acima.

  🧠 AUTONOMIA E REGRAS DE EXECUÇÃO (CUMPRA RIGOROSAMENTE):
  Você NÃO é um assistente passivo. Você é um investigador.

  1. A SÍNDROME DO ID É PROIBIDA: NUNCA, sob hipótese alguma, peça um "ID de chat" para o gestor se ele fizer uma pergunta qualitativa (ex: "como estão as respostas da secretária?", "leia algumas conversas", "analise o atendimento").

  2. ENCADEAMENTO DE FERRAMENTAS (Aja sozinho):
     Se o gestor quiser saber sobre a "qualidade do atendimento", "respostas da secretária" ou "motivos de perda", VOCÊ DEVE agir proativamente em sequência:
     - Passo A: Chame a ferramenta 'get_filtered_chats_list' para buscar uma amostra de chats recentes (use limit de 3 a 5).
     - Passo B: Com a resposta em mãos, extraia os IDs dos chats retornados.
     - Passo C: Chame IMEDIATAMENTE a ferramenta 'get_chat_cascade_history' para ler a transcrição cronológica das mensagens de cada um desses IDs.
     - Passo D: Somente após ler as conversas linha por linha, formule sua resposta para o gestor. Critique tempo de espera, tom de voz, quebras de roteiro, erros de português ou destaque coisas positivas.

  3. MÉTRICAS MACRO: Se o gestor perguntar sobre o "desempenho geral", "como foi o dia" ou "conversão", use a ferramenta 'get_attendance_overview_metrics' passando as datas corretas.

  4. ZERO ALUCINAÇÃO: Suas conclusões devem ser extraídas ESTRITAMENTE dos dados retornados pelas ferramentas. Nunca invente ou presuma conversas.

  5. VAULT (Cerebro Compartilhado): Você tem acesso a ferramentas de leitura e busca no vault:
     - vault_read(path) — ler notas (ex: 'agents/analyst/insights-cache.md')
     - vault_search(query) — busca textual no vault
     - vault_log_decision(summary, decided_by, category) — registrar decisoes importantes

  Seu objetivo é ser cirúrgico. Vá atrás dos dados, cruze as informações usando as ferramentas múltiplas vezes se for preciso, e entregue respostas inteligentes e resolutivas.${vaultContextBlock}`;

  const response = (await modelWithTools.invoke([
    new SystemMessage(DYNAMIC_SYSTEM_PROMPT),
    ...state.messages,
  ])) as AIMessage;

  return { messages: [response] };
});

analystWorkflow.addNode("tools", new ToolNode(allAnalystTools));

// @ts-expect-error Tipagem dos nomes de node no StateGraph nao acompanha nodes dinamicos, mas o runtime funciona corretamente.
analystWorkflow.addEdge(START, "load_vault_context");
// @ts-expect-error Tipagem dos nomes de node no StateGraph nao acompanha nodes dinamicos, mas o runtime funciona corretamente.
analystWorkflow.addEdge("load_vault_context", "analyst_agent");
// @ts-expect-error toolsCondition retorna rota valida para "tools" ou END em runtime.
analystWorkflow.addConditionalEdges("analyst_agent", toolsCondition);
// @ts-expect-error Tipagem dos nomes de node no StateGraph nao acompanha nodes dinamicos, mas o runtime funciona corretamente.
analystWorkflow.addEdge("tools", "analyst_agent");

let compiledGraphPromise: Promise<ReturnType<typeof analystWorkflow.compile>> | null = null;

export async function getAnalystGraph() {
  if (!compiledGraphPromise) {
    compiledGraphPromise = Promise.resolve(analystWorkflow.compile());
  }
  return compiledGraphPromise;
}