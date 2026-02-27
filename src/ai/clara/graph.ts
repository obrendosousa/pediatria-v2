import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { z } from "zod";
import { END, START, StateGraph } from "@langchain/langgraph";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { getSupabaseAdminClient } from "@/lib/automation/adapters/supabaseAdmin";

import {
  claraTools,
  deepResearchChatsTool,
} from "./tools";
import { getFilteredChatsListTool, getChatCascadeHistoryTool } from "@/ai/analyst/tools";
import { CLARA_SYSTEM_PROMPT } from "./system_prompt";
import { CLARA_COMPANY } from "./company";
import { CLARA_RULES } from "./rules";

// ─────────────────────────────────────────────────────────────────────────────
// PASSO 1: ESTADO EXPANDIDO COM SUPORTE A DEEP RESEARCH
// ─────────────────────────────────────────────────────────────────────────────

export interface ClaraState {
  messages: BaseMessage[];
  chat_id: number;
  scratchpad: string[];
  plan: string[];
  current_step_index: number;
  is_deep_research: boolean;
  is_planning_phase: boolean;
  current_user_role: "admin" | "doctor" | "receptionist" | "patient" | "system";
}

// ─────────────────────────────────────────────────────────────────────────────
// FERRAMENTAS
// ─────────────────────────────────────────────────────────────────────────────

const researchTools = [
  ...claraTools,
  deepResearchChatsTool,
  getFilteredChatsListTool,
  getChatCascadeHistoryTool,
];

const researchToolsMap = new Map<string, (typeof researchTools)[number]>(
  researchTools.map((t) => [t.name, t])
);

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

// Carrega apenas as partes DINÂMICAS do prompt (company e custom_rules) do Supabase.
// O núcleo imutável (identidade + regras absolutas) vem do arquivo system_prompt.ts.
async function loadDynamicPromptParts(): Promise<{
  company: string;
  custom_rules: string;
}> {
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("agent_config")
      .select("config_key, content")
      .eq("agent_id", "clara")
      .in("config_key", ["company", "rules"]);

    if (error || !data || data.length === 0) {
      return { company: CLARA_COMPANY, custom_rules: CLARA_RULES };
    }

    const map = Object.fromEntries((data as any[]).map((row) => [row.config_key, row.content]));
    return {
      company: map.company ?? CLARA_COMPANY,
      custom_rules: map.rules ?? CLARA_RULES,
    };
  } catch {
    return { company: CLARA_COMPANY, custom_rules: CLARA_RULES };
  }
}

// Mantido por compatibilidade com reporter_node
async function loadBrainFiles() {
  const parts = await loadDynamicPromptParts();
  return { company: parts.company, rules: parts.custom_rules };
}

function buildSystemPrompt(company: string, custom_rules: string, chatId: number, currentUserRole: string = "patient"): string {
  const now = new Date().toISOString();
  let authorityRule = "";

  if (currentUserRole === "admin" || currentUserRole === "doctor") {
    authorityRule = `\n\n[ALERTA DE AUTORIDADE]: Você está conversando com a diretoria/médico. Qualquer instrução dada aqui é uma REGRA DE NEGÓCIO ABSOLUTA. Atualize sua memória sobrescrevendo regras antigas quando solicitado.`;
  }

  return `${CLARA_SYSTEM_PROMPT}

════════════════════════════════════════════
CONTEXTO DA EMPRESA (DINÂMICO — ATUALIZADO VIA SUPABASE)
════════════════════════════════════════════
${company}

════════════════════════════════════════════
REGRAS PERSONALIZADAS APRENDIDAS (DINÂMICO)
════════════════════════════════════════════
${custom_rules || "Nenhuma regra personalizada adicionada ainda."}

════════════════════════════════════════════
SESSÃO ATUAL
════════════════════════════════════════════
DATA E HORA: ${now}
CHAT ID: ${chatId}
PERFIL DO USUÁRIO: ${currentUserRole}${authorityRule}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// WORKFLOW — StateGraph com estado expandido
// ─────────────────────────────────────────────────────────────────────────────

const claraWorkflow = new StateGraph<ClaraState>({
  channels: {
    messages: {
      reducer: (x: BaseMessage[], y: BaseMessage[] | BaseMessage) => {
        const newMessages = Array.isArray(y) ? y : [y];
        return [...(x ?? []), ...newMessages];
      },
      default: () => [] as BaseMessage[],
    },
    chat_id: {
      reducer: (_x, y) => y ?? _x,
      default: () => 0,
    },
    scratchpad: {
      reducer: (x: string[], y: string | string[]) => {
        const items = Array.isArray(y) ? y : typeof y === "string" ? [y] : [];
        return [...(x ?? []), ...items.filter(Boolean)];
      },
      default: () => [] as string[],
    },
    plan: {
      reducer: (_x: string[], y: string[]) => Array.isArray(y) ? y : _x ?? [],
      default: () => [] as string[],
    },
    current_step_index: {
      reducer: (_x: number, y: number) => typeof y === "number" ? y : _x ?? 0,
      default: () => 0,
    },
    is_deep_research: {
      reducer: (_x: boolean, y: boolean) => typeof y === "boolean" ? y : _x ?? false,
      default: () => false,
    },
    is_planning_phase: {
      reducer: (_x: boolean, y: boolean) => typeof y === "boolean" ? y : _x ?? false,
      default: () => false,
    },
    current_user_role: {
      reducer: (_x: any, y: any) => y ?? _x ?? "patient",
      default: () => "patient" as const,
    },
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// NODE 1: router_and_planner_node — PLANEJADOR DINÂMICO (Camada 2)
// Substituiu o sistema de keywords hardcoded + planos fixos por um LLM que gera
// planos arbitrários baseados no esquema real do banco e nas ferramentas disponíveis.
// Inspirado na arquitetura open_deep_research (langchain-ai/open_deep_research).
// ─────────────────────────────────────────────────────────────────────────────

// Fast-path apenas para saudações/acks — evita chamar LLM para "oi", "ok", etc.
const SIMPLE_KEYWORDS = [
  "oi", "olá", "ola", "tudo bem", "bom dia", "boa tarde", "boa noite",
  "obrigado", "obrigada", "valeu", "ok", "certo", "entendi", "beleza", "ótimo", "otimo",
];

// Schema de saída estruturada do planejador
const PlanSchema = z.object({
  classification: z
    .enum(["simple", "complex"])
    .describe("'simple' para perguntas diretas/conversas. 'complex' para análise de dados, relatórios, pesquisas."),
  reasoning: z.string().describe("Justificativa em 1 frase do plano escolhido."),
  plan: z.array(z.string()).describe("Lista de 1-5 passos de execução com ferramenta e parâmetros explícitos. Vazio se 'simple'."),
});

claraWorkflow.addNode("router_and_planner_node", async (state: ClaraState) => {
  const lastMessage = state.messages[state.messages.length - 1];
  const userText =
    typeof lastMessage?.content === "string"
      ? lastMessage.content
      : Array.isArray(lastMessage?.content)
        ? (lastMessage.content as Array<{ type: string; text?: string }>)
          .filter((c) => c.type === "text")
          .map((c) => c.text ?? "")
          .join(" ")
        : "";

  // ── Fast-path: saudações/acks → simple_agent sem LLM ─────────────────────
  const lower = userText.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const wordCount = lower.split(/\s+/).filter(Boolean).length;
  const isGreeting = SIMPLE_KEYWORDS.some(
    (kw) => lower === kw || lower.startsWith(kw + " ") || lower.endsWith(" " + kw)
  );
  if (isGreeting || wordCount <= 4) {
    return { is_deep_research: false, is_planning_phase: false };
  }

  // ── Planejador Dinâmico via LLM com Structured Output ────────────────────
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const nowBR = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
  const cleanUserText = userText;

  const PLANNER_SYSTEM = `Você é o Planejador Estratégico da Clara, assistente analítica de uma clínica médica.

CONTEXTO TEMPORAL:
• Hoje: ${today} | Ontem: ${yesterday} | Hora atual (SP): ${nowBR}

════════════════════════════════════════════
BANCO DE DADOS — ESQUEMA COMPLETO (Supabase)
════════════════════════════════════════════
• chats: id, phone, contact_name, stage (new|qualified|lost|won), ai_sentiment (positivo|neutro|negativo), last_interaction_at, ai_summary, status, is_archived, unread_count
• chat_messages: id, chat_id, phone, sender (AI_AGENT|HUMAN_AGENT|CUSTOMER|me), message_text, created_at, message_type (text|audio|image|document)
• chat_insights: id, chat_id, nota_atendimento (0-10), sentimento, objecoes[], gargalos[], decisao, resumo_analise, metricas_extras, created_at
• clara_reports: id, titulo, conteudo_markdown, tipo (analise_chats|financeiro|agendamento|geral), created_at
• clara_memories: id, memory_type, content, source_role, created_at
• knowledge_base: pergunta, resposta_ideal, categoria, tags

════════════════════════════════════════════
FERRAMENTAS DISPONÍVEIS (use nomes exatos)
════════════════════════════════════════════
BANCO DE DADOS:
• query_database — Consulta qualquer tabela com filtros precisos. Parâmetros: table, columns, date_from (YYYY-MM-DD), date_to (YYYY-MM-DD), date_field, eq_filters {campo: valor}, ilike_filters {campo: "texto"}, order_by, limit (máx 200). Para chats inclua sempre "id, contact_name" em columns.
• generate_sql_report — (NOVO) Consulta AVANÇADA e contagens precisas (COUNT, SUM, AVG) gerando SQL puro no PostgreSQL. Ideal para relatórios de métricas, total de leads, ticket médio ou agrupamentos. Parâmetro: pergunta_em_linguagem_natural.
• get_filtered_chats_list — Lista IDs de chats. Parâmetros: stage, sentiment, start_date (YYYY-MM-DD), end_date (YYYY-MM-DD), limit (máx 100).
• get_chat_cascade_history — Transcrição completa de UM chat. Parâmetros: chat_id.

ANÁLISE DE CONVERSAS:
• deep_research_chats — Análise exploratória rápida de múltiplos chats (Map-Reduce, NÃO persiste). Parâmetros: objetivo_da_analise, chat_ids[]. Use para investigar semântica e conteúdo.
• analisar_chat_especifico — Análise estruturada profunda com persistência em chat_insights. Parâmetros: chat_ids[] (máx 30). Use quando precisar de nota, objeções, gargalos por chat.
• gerar_relatorio_qualidade_chats — Compila métricas de chat_insights. Parâmetros: dias_retroativos.

INTERNET:
• web_search — Pesquisa na internet. Parâmetros: query, max_results.

MEMÓRIA & CONHECIMENTO:
• manage_long_term_memory — Lê/salva memórias. Parâmetros: action (salvar|consultar), memory_type, content.
• search_knowledge_base — Busca gabaritos. Parâmetros: termo_busca.
• read_brain_files — Lê configurações. Parâmetros: module (company|rules|all).
• update_brain_file — Atualiza configurações. Parâmetros: module, new_content.

RELATÓRIOS:
• save_report — Persiste relatório. Parâmetros: titulo, conteudo_markdown, tipo.

════════════════════════════════════════════
REGRAS DE PLANEJAMENTO
════════════════════════════════════════════
1. MÁXIMO 5 passos — seja cirúrgico e específico
2. Use datas EXATAS: hoje=${today}, ontem=${yesterday}
3. MÉTRICAS, CONTAGENS NUMÉRICAS E TOTAIS: SEMPRE USE 'generate_sql_report' como primeiro passo. NUNCA conte "na mão" (usando array .length no map_reduce).
4. SEMPRE inclua "id, contact_name" nos resultados de chats ao usar query_database para gerar referências precisas
5. ANÁLISE SEMÂNTICA EM LOTE: Para investigar razões de desistência (lost) ou feedbacks narrativos (resumos e objeções), use a rota: query_database (buscar IDs) → deep_research_chats (analisar contexto de dezenas simultaneamente).
6. ANÁLISE COM PERSISTÊNCIA: Use avaliar_chat_especifico apenas quando o usuário exigir o salvamento da Nota, Feeback Unitário e Metadados persistidos no \`chat_insights\`.
7. O 'deep_research_chats' recebe chat_ids como array numérico direto.
8. Para fechar um dashboard consolidado complexo, use \`save_report\`.
9. Mensagens simples (saudação, pergunta de regra, instrução pontual, pergunta sobre configuração) → classification: "simple"`;

  try {
    const plannerModel = new ChatGoogleGenerativeAI({
      model: "gemini-3-flash-preview", // Flash para planning — rápido e suficiente
      apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
      temperature: 0,
    }).withStructuredOutput(PlanSchema);

    const result = await plannerModel.invoke([
      new SystemMessage(PLANNER_SYSTEM),
      new HumanMessage(cleanUserText),
    ]);

    if (result.classification === "simple") {
      return { is_deep_research: false, is_planning_phase: false };
    }

    const plan = result.plan.filter(Boolean);
    if (plan.length === 0) {
      return { is_deep_research: false, is_planning_phase: false };
    }

    return { is_deep_research: true, is_planning_phase: false, plan, current_step_index: 0 };
  } catch {
    // Fallback seguro: se o planejador falhar, usa simple_agent
    return { is_deep_research: false, is_planning_phase: false };
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// NODE 2: executor_node (CORRIGIDO)
// ─────────────────────────────────────────────────────────────────────────────

claraWorkflow.addNode("executor_node", async (state: ClaraState) => {
  const stepIndex = state.current_step_index;
  const currentStep = state.plan[stepIndex];
  const totalSteps = state.plan.length;

  const model = new ChatGoogleGenerativeAI({
    model: "gemini-3-flash-preview",
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
    temperature: 0.1,
  }).bindTools(researchTools);

  const scratchpadContext =
    state.scratchpad.length > 0
      ? `\n\nSEU BLOCO DE NOTAS (resultados dos passos anteriores):\n${state.scratchpad
        .map((note, i) => `--- Passo ${i + 1} ---\n${note}`)
        .join("\n\n")}`
      : "";

  const STEP_INSTRUCTIONS = `Passo ${stepIndex + 1} de ${totalSteps}: "${currentStep}"

Use as ferramentas necessárias para completar APENAS este passo. Quando terminar, forneça um resumo estruturado e conciso dos seus achados. Este resumo será salvo no bloco de notas para os próximos passos.${scratchpadContext}

CRÍTICO: VOCÊ DEVE USAR A INVOCAÇÃO DE FERRAMENTAS NATIVA (FUNCTION CALLING). É PROIBIDO ESCREVER BLOCOS DE CÓDIGO HTML/MARKDOWN COMO \`<tool_code>\` NAS SUAS RESPOSTAS. INVOQUE A FERRAMENTA DIRETAMENTE PELA API. RESPONDa EXPLICITAMENTE COMO FUNCTION CALL.`;

  // CORREÇÃO CRÍTICA: O Gemini exige obrigatoriamente um HumanMessage no array para não dar o erro de "contents is not specified".
  const internalMessages: BaseMessage[] = [
    new SystemMessage("Você é um agente autônomo executando um plano de pesquisa de dados em etapas."),
    new HumanMessage(STEP_INSTRUCTIONS)
  ];

  let response = (await model.invoke(internalMessages)) as AIMessage;
  let iterations = 0;
  const MAX_ITERATIONS = 12;

  while (
    response.tool_calls &&
    response.tool_calls.length > 0 &&
    iterations < MAX_ITERATIONS
  ) {
    iterations++;
    internalMessages.push(response);

    const toolResults = await Promise.all(
      response.tool_calls.map(async (tc) => {
        const tool = researchToolsMap.get(tc.name);
        if (!tool) {
          return new ToolMessage({
            tool_call_id: tc.id ?? tc.name,
            content: `Ferramenta '${tc.name}' não encontrada.`,
          });
        }
        try {
          const result = await (tool as any).invoke(tc.args);
          return new ToolMessage({
            tool_call_id: tc.id ?? tc.name,
            content: typeof result === "string" ? result : JSON.stringify(result),
          });
        } catch (e: any) {
          return new ToolMessage({
            tool_call_id: tc.id ?? tc.name,
            content: `Erro ao executar '${tc.name}': ${e.message} `,
          });
        }
      })
    );

    internalMessages.push(...toolResults);
    response = (await model.invoke(internalMessages)) as AIMessage;
  }

  const stepResult =
    typeof response.content === "string"
      ? response.content
      : Array.isArray(response.content)
        ? response.content.map((c: any) => c.text ?? "").join("")
        : JSON.stringify(response.content);

  return {
    scratchpad: [`[Passo ${stepIndex + 1}] ${stepResult} `],
    current_step_index: stepIndex + 1,
  };
});

// ─────────────────────────────────────────────────────────────────────────────
// NODE 3: reporter_node (CORRIGIDO)
// ─────────────────────────────────────────────────────────────────────────────

claraWorkflow.addNode("reporter_node", async (state: ClaraState) => {
  const { rules } = await loadBrainFiles();

  const model = new ChatGoogleGenerativeAI({
    model: "gemini-3-flash-preview",
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
    temperature: 0.3,
  });

  const scratchpadText = state.scratchpad
    .map((note, i) => `=== Nota ${i + 1} ===\n${note} `)
    .join("\n\n");

  const todayReporter = new Date().toISOString().slice(0, 10);
  const REPORTER_SYSTEM = `${CLARA_SYSTEM_PROMPT}

${rules ? `REGRAS APRENDIDAS ADICIONAIS:\n${rules}` : ""}

════════════════════════════════════════════
INSTRUÇÕES DO RELATÓRIO FINAL
════════════════════════════════════════════
Você recebeu as anotações brutas de uma pesquisa de dados. Sua tarefa é transformá-las em um relatório Markdown elegante, estruturado e profissional.

REGRAS OBRIGATÓRIAS:
1. NÃO mencione "bloco de notas", "scratchpad", "passo X", "nota Y" ou qualquer detalhe do processo interno. Escreva APENAS o relatório final.
2. REFERÊNCIAS DE CHATS — OBRIGATÓRIO: Se as notas contiverem IDs de chats (id) e nomes (contact_name), inclua uma seção "📋 Chats Analisados" com uma tabela Markdown no formato:
   | # | Chat ID | Contato | Sentimento | Estágio |
   |---|---------|---------|------------|---------|
   | 1 | 42      | João Silva | positivo | qualified |
3. Use Markdown completo: títulos (##, ###), negrito, tabelas, listas, separadores (---).
4. Termine com um bloco "💡 Conclusão e Recomendações" com insights acionáveis.
5. Se o relatório for extenso, salve-o usando a ferramenta save_report (tipo: analise_chats) e mencione ao usuário que o relatório completo foi salvo.
6. Data de referência desta análise: ${todayReporter}

BLOCO DE NOTAS DA PESQUISA:
${scratchpadText}`;

  // CRÍTICO: NÃO passar state.messages aqui — o modelo receberia o HumanMessage original
  // e geraria um plano futuro em vez de sintetizar os resultados já coletados.
  const response = (await model.invoke([
    new SystemMessage(REPORTER_SYSTEM),
    new HumanMessage("Os dados acima já foram coletados e estão no bloco de notas. NÃO planeje nem liste próximas etapas. Escreva APENAS o relatório final em Markdown com os resultados obtidos."),
  ])) as AIMessage;

  return { messages: [response] };
});

// ─────────────────────────────────────────────────────────────────────────────
// NODE: simple_agent (CORRIGIDO)
// ─────────────────────────────────────────────────────────────────────────────

claraWorkflow.addNode("simple_agent", async (state: ClaraState) => {
  const { company, rules } = await loadBrainFiles();

  const model = new ChatGoogleGenerativeAI({
    model: "gemini-3-flash-preview", // Flash para respostas rápidas
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
    temperature: 0.3,
  });

  const modelWithTools = model.bindTools(claraTools);
  const systemPrompt = buildSystemPrompt(company, rules, state.chat_id, state.current_user_role);

  // CORREÇÃO: Garante que haja pelo menos um HumanMessage.
  const safeMessages = state.messages.length > 0
    ? state.messages
    : [new HumanMessage("Olá.")];

  const response = (await modelWithTools.invoke([
    new SystemMessage(systemPrompt),
    ...safeMessages,
  ])) as AIMessage;

  return { messages: [response] };
});

claraWorkflow.addNode("tools", new ToolNode(claraTools));

// ─────────────────────────────────────────────────────────────────────────────
// EDGES
// ─────────────────────────────────────────────────────────────────────────────

// @ts-expect-error
claraWorkflow.addEdge(START, "router_and_planner_node");

// @ts-expect-error
claraWorkflow.addConditionalEdges("router_and_planner_node", (state: ClaraState) => {
  if (state.is_planning_phase) return END; // Pausa após gerar o plano no painel (que envia via saveStatusMessage)
  return state.is_deep_research ? "executor_node" : "simple_agent";
});

// @ts-expect-error
claraWorkflow.addConditionalEdges("executor_node", (state: ClaraState) => state.current_step_index >= state.plan.length ? "reporter_node" : "executor_node");

// @ts-expect-error
claraWorkflow.addEdge("reporter_node", END);

// @ts-expect-error
claraWorkflow.addConditionalEdges("simple_agent", toolsCondition);

// @ts-expect-error
claraWorkflow.addEdge("tools", "simple_agent");

export const claraGraph = claraWorkflow.compile();