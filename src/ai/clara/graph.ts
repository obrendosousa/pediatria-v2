import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { z } from "zod";
import { END, START, StateGraph, messagesStateReducer } from "@langchain/langgraph";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { getSupabaseAdminClient } from "@/lib/automation/adapters/supabaseAdmin";
import { postgresCheckpointer } from "./checkpointer";

import { claraTools, deepResearchChatsTool } from "./tools";
import { getFilteredChatsListTool, getChatCascadeHistoryTool } from "@/ai/analyst/tools";
import { researcherGraph } from "./researcher_graph";
import { CLARA_SYSTEM_PROMPT } from "./system_prompt";
import { CLARA_COMPANY } from "./company";
import { CLARA_RULES } from "./rules";

// ─────────────────────────────────────────────────────────────────────────────
// ESTADO PRINCIPAL DA CLARA (arquitetura open_deep_research adaptada)
// ─────────────────────────────────────────────────────────────────────────────

export interface ClaraState {
  // Canal público — visível ao usuário via chat
  messages: BaseMessage[];
  chat_id: number;
  current_user_role: "admin" | "doctor" | "receptionist" | "patient" | "system";

  // Canal de pesquisa — interno ao grafo
  research_brief: string;              // gerado pelo write_research_brief_node
  raw_notes: string[];                 // APPEND: achados de cada researcher em paralelo
  supervisor_messages: BaseMessage[];  // conversa interna do supervisor (não vai ao chat)
  supervisor_iteration: number;        // contador do loop do supervisor
  research_complete: boolean;          // supervisor sinaliza quando a pesquisa está pronta

  // Roteamento
  is_deep_research: boolean;           // classify_node decide: simple vs research
  is_planning_mode: boolean;           // prefixo [PLANEJAR]: exibe brief sem executar
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────────────────────

const MAX_SUPERVISOR_ITERATIONS = 3; // Máximo de rodadas de pesquisa paralela
const MAX_PARALLEL_RESEARCHERS = 5;  // Máximo de researchers simultâneos por rodada

// ─────────────────────────────────────────────────────────────────────────────
// FERRAMENTAS DO SIMPLE_AGENT — acesso completo a dados + ferramentas de config
// ─────────────────────────────────────────────────────────────────────────────

const simpleAgentTools = [
  ...claraTools,
  deepResearchChatsTool,
  getFilteredChatsListTool,
  getChatCascadeHistoryTool,
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS DE PROMPT DINÂMICO
// ─────────────────────────────────────────────────────────────────────────────

async function loadDynamicPromptParts(): Promise<{
  company: string;
  custom_rules: string;
  voice_rules: string;
}> {
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("agent_config")
      .select("config_key, content")
      .eq("agent_id", "clara")
      .in("config_key", ["company", "rules", "voice_rules"]);

    if (error || !data || data.length === 0) {
      return { company: CLARA_COMPANY, custom_rules: CLARA_RULES, voice_rules: "" };
    }

    const map = Object.fromEntries((data as any[]).map((row) => [row.config_key, row.content]));
    return {
      company: map.company ?? CLARA_COMPANY,
      custom_rules: map.rules ?? CLARA_RULES,
      voice_rules: map.voice_rules ?? "",
    };
  } catch {
    return { company: CLARA_COMPANY, custom_rules: CLARA_RULES, voice_rules: "" };
  }
}

function buildSystemPrompt(
  company: string,
  custom_rules: string,
  voice_rules: string,
  chatId: number,
  currentUserRole: string = "patient"
): string {
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
DIRETRIZES DE PERSONALIDADE DA VOZ (DINÂMICO)
════════════════════════════════════════════
${voice_rules || "Nenhuma diretriz de voz definida."}

════════════════════════════════════════════
SESSÃO ATUAL
════════════════════════════════════════════
DATA E HORA: ${now}
CHAT ID: ${chatId}
PERFIL DO USUÁRIO: ${currentUserRole}${authorityRule}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// WORKFLOW
// ─────────────────────────────────────────────────────────────────────────────

const claraWorkflow = new StateGraph<ClaraState>({
  channels: {
    messages: {
      reducer: messagesStateReducer,
      default: () => [] as BaseMessage[],
    },
    chat_id: {
      reducer: (_x, y) => y ?? _x,
      default: () => 0,
    },
    current_user_role: {
      reducer: (_x: any, y: any) => y ?? _x ?? "patient",
      default: () => "patient" as const,
    },
    research_brief: {
      reducer: (_x: string, y: string) => y ?? _x ?? "",
      default: () => "",
    },
    raw_notes: {
      reducer: (x: string[], y: string | string[]) => {
        // Array vazio = sinal de RESET (classify_node no início de cada run)
        if (Array.isArray(y) && y.length === 0) return [];
        const items = Array.isArray(y) ? y : typeof y === "string" ? [y] : [];
        return [...(x ?? []), ...items.filter(Boolean)];
      },
      default: () => [] as string[],
    },
    supervisor_messages: {
      reducer: (x: BaseMessage[], y: BaseMessage[] | BaseMessage) => {
        // Array vazio = sinal de RESET (classify_node no início de cada run)
        if (Array.isArray(y) && y.length === 0) return [];
        const incoming = Array.isArray(y) ? y : [y];
        return [...(x ?? []), ...incoming];
      },
      default: () => [] as BaseMessage[],
    },
    supervisor_iteration: {
      reducer: (_x: number, y: number) => (typeof y === "number" ? y : _x ?? 0),
      default: () => 0,
    },
    research_complete: {
      reducer: (_x: boolean, y: boolean) => (typeof y === "boolean" ? y : _x ?? false),
      default: () => false,
    },
    is_deep_research: {
      reducer: (_x: boolean, y: boolean) => (typeof y === "boolean" ? y : _x ?? false),
      default: () => false,
    },
    is_planning_mode: {
      reducer: (_x: boolean, y: boolean) => (typeof y === "boolean" ? y : _x ?? false),
      default: () => false,
    },
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// NODE 1: classify_node — roteador leve (fast-path + LLM para casos ambíguos)
// ─────────────────────────────────────────────────────────────────────────────

const SIMPLE_KEYWORDS = [
  "oi", "olá", "ola", "tudo bem", "bom dia", "boa tarde", "boa noite",
  "obrigado", "obrigada", "valeu", "ok", "certo", "entendi", "beleza", "ótimo", "otimo",
];

const ClassifySchema = z.object({
  classification: z
    .enum(["simple", "research"])
    .describe("'simple' para conversa/pergunta direta. 'research' para análise de dados, relatórios ou investigação de múltiplos chats."),
  reasoning: z.string().describe("Justificativa em 1 frase."),
});

claraWorkflow.addNode("classify_node", async (state: ClaraState) => {
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

  // ── RESET OBRIGATÓRIO DO ESTADO DE PESQUISA ──────────────────────────────
  // O PostgresSaver persiste TODO o estado entre invocações no mesmo thread.
  // Se não zerarmos os campos de pesquisa aqui, a run atual herda
  // research_complete: true da run anterior e pula toda a pipeline.
  const researchStateReset = {
    research_complete: false,
    research_brief: "",
    raw_notes: [] as string[],
    supervisor_messages: [] as BaseMessage[],
    supervisor_iteration: 0,
    is_planning_mode: false,
  };

  // Detecta modo [PLANEJAR] — usuário quer ver o plano sem executar
  if (userText.trim().startsWith("[PLANEJAR]")) {
    return { ...researchStateReset, is_deep_research: true, is_planning_mode: true };
  }

  // Fast-path: saudações e mensagens muito curtas vão direto para simple_agent
  const lower = userText.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const wordCount = lower.split(/\s+/).filter(Boolean).length;
  const isGreeting = SIMPLE_KEYWORDS.some(
    (kw) => lower === kw || lower.startsWith(kw + " ") || lower.endsWith(" " + kw)
  );
  if (isGreeting || wordCount <= 4) {
    return { ...researchStateReset, is_deep_research: false };
  }

  // LLM classifier — decide se precisa de pesquisa estruturada
  const today = new Date().toISOString().slice(0, 10);

  const CLASSIFIER_SYSTEM = `Você é um roteador de intenções para a Clara, assistente de clínica médica.

Hoje: ${today}

Classifique a mensagem como:
- "simple": pergunta direta, conversa, instrução de configuração, consulta rápida de dados, ou qualquer coisa que um agente ReAct com ferramentas pode resolver em 1-3 tool calls
- "research": requer análise de múltiplos chats, relatórios consolidados, investigação de padrões em lote (ex: "analise os últimos 30 chats", "gera relatório de objeções do mês", "quais são os padrões dos leads perdidos")

Dúvida? Prefira "simple" — o simple_agent tem todas as ferramentas.`;

  try {
    const classifierModel = new ChatGoogleGenerativeAI({
      model: "gemini-3-flash-preview",
      apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
      temperature: 0,
    }).withStructuredOutput(ClassifySchema);

    const result = await classifierModel.invoke([
      new SystemMessage(CLASSIFIER_SYSTEM),
      new HumanMessage(userText),
    ]);

    return {
      ...researchStateReset,
      is_deep_research: result.classification === "research",
    };
  } catch {
    // Fallback seguro: simple_agent
    return { ...researchStateReset, is_deep_research: false };
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// NODE 2: simple_agent — ReAct clássico para respostas conversacionais
// Inalterado em relação à arquitetura anterior.
// ─────────────────────────────────────────────────────────────────────────────

claraWorkflow.addNode("simple_agent", async (state: ClaraState) => {
  const { company, custom_rules, voice_rules } = await loadDynamicPromptParts();

  const model = new ChatGoogleGenerativeAI({
    model: "gemini-3-flash-preview",
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
    temperature: 0.3,
  });

  const modelWithTools = model.bindTools(simpleAgentTools);
  const systemPrompt = buildSystemPrompt(
    company, custom_rules, voice_rules, state.chat_id, state.current_user_role
  );

  const safeMessages = state.messages.length > 0
    ? state.messages
    : [new HumanMessage("Olá.")];

  const response = (await modelWithTools.invoke([
    new SystemMessage(systemPrompt),
    ...safeMessages,
  ])) as AIMessage;

  return { messages: [response] };
});

claraWorkflow.addNode("tools", new ToolNode(simpleAgentTools));

// ─────────────────────────────────────────────────────────────────────────────
// NODE 3: write_research_brief_node — transforma a query em brief estruturado
// Inspirado em write_research_brief do open_deep_research.
// ─────────────────────────────────────────────────────────────────────────────

claraWorkflow.addNode("write_research_brief_node", async (state: ClaraState) => {
  const lastMessage = state.messages[state.messages.length - 1];
  const userText =
    typeof lastMessage?.content === "string"
      ? lastMessage.content.replace(/^\[PLANEJAR\]\s*/i, "").trim()
      : Array.isArray(lastMessage?.content)
        ? (lastMessage.content as Array<{ type: string; text?: string }>)
          .filter((c) => c.type === "text")
          .map((c) => c.text ?? "")
          .join(" ")
          .replace(/^\[PLANEJAR\]\s*/i, "")
          .trim()
        : "";

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  const BRIEF_SYSTEM = `Você é o Estrategista de Pesquisa da Clara. Sua função é transformar a solicitação do usuário em um plano de pesquisa estruturado.

Hoje: ${today} | Ontem: ${yesterday}

BANCO DE DADOS DISPONÍVEL:
• chats: id, phone, contact_name, stage (new|qualified|lost|won), ai_sentiment, last_interaction_at (FILTRO DE DATA), is_archived
• chat_messages: id, chat_id, sender (AI_AGENT|HUMAN_AGENT|contact), message_text, created_at (FILTRO DE DATA)
• chat_insights: id, chat_id, nota_atendimento (0-10), sentimento, objecoes[], gargalos[], decisao, resumo_analise, updated_at (FILTRO DE DATA — usar updated_at NÃO created_at)
• clara_reports: id, titulo, conteudo_markdown, tipo, created_at
• clara_memories: id, memory_type, content, updated_at

FERRAMENTAS DISPONÍVEIS:
• query_database — Consulta com filtros (tabela, colunas, datas, eq/ilike filters)
• generate_sql_report — SQL avançado (COUNT, AVG, SUM, GROUP BY) para métricas
• get_filtered_chats_list — Lista IDs por stage/sentimento/data (máx 100)
• get_chat_cascade_history — Transcrição completa de 1 chat
• deep_research_chats — Análise semântica de múltiplos chats (Map-Reduce, não persiste)
• analisar_chat_especifico — Análise estruturada com persistência (max 30 por chamada)
• gerar_relatorio_qualidade_chats — Métricas agregadas de chat_insights
• search_knowledge_base — Busca em gabaritos
• save_report — Persiste relatório

Escreva um brief de pesquisa conciso (máx 200 palavras) que descreve:
1. O objetivo principal
2. Quais dados precisam ser coletados (com fontes/tabelas específicas)
3. Quais aspectos podem ser investigados em paralelo`;

  const model = new ChatGoogleGenerativeAI({
    model: "gemini-3-flash-preview",
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
    temperature: 0,
  });

  const response = await model.invoke([
    new SystemMessage(BRIEF_SYSTEM),
    new HumanMessage(`Crie o brief de pesquisa para: "${userText}"`),
  ]);

  const brief =
    typeof response.content === "string"
      ? response.content
      : Array.isArray(response.content)
        ? (response.content as Array<any>).map((c) => c?.text ?? "").join("")
        : "";

  // Se é modo de planejamento: exibe o brief ao usuário e para a execução
  if (state.is_planning_mode) {
    const planMessage = new AIMessage(
      `📋 **Plano de Pesquisa**\n\n${brief}\n\n---\n*Para executar este plano, envie a mesma mensagem sem o prefixo [PLANEJAR].*`
    );
    return {
      research_brief: brief,
      messages: [planMessage],
      research_complete: true, // sinaliza para não entrar no loop do supervisor
    };
  }

  return { research_brief: brief, research_complete: false };
});

// ─────────────────────────────────────────────────────────────────────────────
// NODE 4: research_supervisor_node — orquestra researchers em paralelo (loop)
// Adaptado de research_supervisor do open_deep_research.
// ─────────────────────────────────────────────────────────────────────────────

const SupervisorDecisionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("conduct_research"),
    research_tasks: z
      .array(
        z.object({
          topic: z.string().describe("Título curto do tópico a investigar."),
          description: z
            .string()
            .describe("O que exatamente coletar: tabelas, filtros, datas, métricas específicas."),
        })
      )
      .min(1)
      .max(5)
      .describe(`Lista de tópicos para pesquisar em paralelo (máx ${MAX_PARALLEL_RESEARCHERS}).`),
  }),
  z.object({
    action: z.literal("research_complete"),
    reason: z.string().describe("Por que a pesquisa está completa e pronta para o relatório final."),
  }),
]);

claraWorkflow.addNode("research_supervisor_node", async (state: ClaraState) => {
  const today = new Date().toISOString().slice(0, 10);

  const rawNotesContext =
    state.raw_notes.length > 0
      ? `\n\nDados já coletados pelos researchers:\n${state.raw_notes
        .map((note, i) => `--- Researcher ${i + 1} ---\n${note}`)
        .join("\n\n")}`
      : "";

  const SUPERVISOR_SYSTEM = `Você é o Supervisor de Pesquisa da Clara, responsável por orquestrar researchers paralelos.

Hoje: ${today}
Iteração atual: ${state.supervisor_iteration + 1}/${MAX_SUPERVISOR_ITERATIONS}

BRIEF DE PESQUISA:
${state.research_brief}
${rawNotesContext}

INSTRUÇÕES:
1. Analise o brief e os dados já coletados.
2. REGRA CRÍTICA: Se esta é a iteração 1 (raw_notes ainda vazio), você DEVE escolher "conduct_research" — nunca pule a primeira rodada de pesquisa.
3. Se ainda há aspectos não investigados que são necessários: escolha "conduct_research" e defina tópicos específicos (máx ${MAX_PARALLEL_RESEARCHERS} em paralelo).
4. Somente escolha "research_complete" se raw_notes JÁ contém dados coletados E são suficientes para responder.
5. Na última iteração (${MAX_SUPERVISOR_ITERATIONS}/${MAX_SUPERVISOR_ITERATIONS}), SEMPRE escolha "research_complete".
6. Cada tópico deve ser independente dos outros — os researchers trabalham em paralelo sem comunicação entre si.`;

  const model = new ChatGoogleGenerativeAI({
    model: "gemini-3-flash-preview",
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
    temperature: 0,
  }).withStructuredOutput(SupervisorDecisionSchema);

  let decision: z.infer<typeof SupervisorDecisionSchema>;
  try {
    decision = await model.invoke([
      new SystemMessage(SUPERVISOR_SYSTEM),
      new HumanMessage("Analise o brief e os dados coletados. Qual é a próxima ação?"),
    ]);
  } catch {
    // Fallback: se o supervisor falhar, marca como completo
    return { research_complete: true, supervisor_iteration: state.supervisor_iteration + 1 };
  }

  // ── SALVAGUARDA IMPERATIVA ────────────────────────────────────────────────
  // Se o LLM decidiu research_complete MAS ainda não temos dados coletados,
  // força uma rodada de pesquisa. Isso evita que o grafo caia no fallback
  // retornando o histórico antigo do LangGraph em vez de dados reais.
  const hasNoData = state.raw_notes.length === 0 || state.raw_notes.every((n) => !n?.trim());
  if (decision.action === "research_complete" && hasNoData && state.supervisor_iteration < MAX_SUPERVISOR_ITERATIONS - 1) {
    console.warn("⚠️ [Supervisor] Decisão 'research_complete' bloqueada — raw_notes vazio! Forçando conduct_research.");
    decision = {
      action: "conduct_research",
      research_tasks: [
        {
          topic: "Dados de qualidade e desempenho",
          description: `Chame gerar_relatorio_qualidade_chats com dias_retroativos: 60 para buscar dados da tabela chat_insights. Se retornar vazio, chame get_filtered_chats_list com days_ago: 30 para listar chats recentes. Brief original: ${state.research_brief}`,
        },
      ],
    };
  }

  if (decision.action === "research_complete") {
    const supervisorMsg = new AIMessage(
      `Pesquisa concluída após ${state.supervisor_iteration + 1} iteração(ões). ${decision.reason}`
    );
    return {
      research_complete: true,
      supervisor_messages: [supervisorMsg],
      supervisor_iteration: state.supervisor_iteration + 1,
    };
  }

  // Spawn paralelo de researchers — o core da arquitetura open_deep_research
  const today2 = new Date().toISOString().slice(0, 10);
  const researchResults = await Promise.all(
    decision.research_tasks.map((task) =>
      researcherGraph
        .invoke({
          research_topic: `${task.topic}: ${task.description}`,
          researcher_messages: [],
          raw_notes: [],
          compressed_research: "",
          iteration: 0,
        })
        .catch((e: Error) => ({
          compressed_research: `[Erro no researcher "${task.topic}": ${e.message}]`,
          raw_notes: [],
        }))
    )
  );

  // Agrega os resultados comprimidos de todos os researchers
  const newNotes = researchResults
    .map((r) => (r as any).compressed_research as string | undefined)
    .filter((n): n is string => typeof n === "string" && n.trim().length > 0);

  const supervisorMsg = new AIMessage(
    `Rodada ${state.supervisor_iteration + 1}: ${decision.research_tasks.length} researcher(s) concluídos. Tópicos: ${decision.research_tasks.map((t) => t.topic).join(", ")}.`
  );

  return {
    raw_notes: newNotes,
    supervisor_messages: [supervisorMsg],
    supervisor_iteration: state.supervisor_iteration + 1,
    research_complete: false,
  };
});

// ─────────────────────────────────────────────────────────────────────────────
// NODE 5: final_report_node — sintetiza raw_notes em relatório elegante
// Usa gemini-3-pro-preview para qualidade máxima na síntese final.
// ─────────────────────────────────────────────────────────────────────────────

claraWorkflow.addNode("final_report_node", async (state: ClaraState) => {
  const { custom_rules } = await loadDynamicPromptParts();

  const model = new ChatGoogleGenerativeAI({
    model: "gemini-3-flash-preview",
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
    temperature: 0.3,
  });

  const rawNotesText = state.raw_notes
    .map((note, i) => `=== Researcher ${i + 1} ===\n${note}`)
    .join("\n\n");

  const today = new Date().toISOString().slice(0, 10);

  const REPORT_SYSTEM = `${CLARA_SYSTEM_PROMPT}

${custom_rules ? `REGRAS APRENDIDAS:\n${custom_rules}` : ""}

════════════════════════════════════════════
INSTRUÇÕES DO RELATÓRIO FINAL
════════════════════════════════════════════
Você recebeu os achados de ${state.raw_notes.length} pesquisadores paralelos sobre a seguinte solicitação:

BRIEF: ${state.research_brief}

Sua tarefa é sintetizar esses dados em um relatório Markdown elegante, estruturado e profissional.

REGRAS OBRIGATÓRIAS:
1. NÃO mencione "researcher", "brief", "raw_notes" ou qualquer detalhe do processo interno.
2. Escreva APENAS o relatório final, como se você tivesse pesquisado tudo diretamente.
3. Se os dados contiverem IDs de chats e nomes (contact_name), inclua uma tabela Markdown no formato:
   | # | Chat ID | Contato | Sentimento | Estágio |
4. Use Markdown completo: ##, ###, negrito, tabelas, listas, separadores ---.
5. Termine com "💡 Conclusão e Recomendações" com insights acionáveis.
6. Se o relatório for extenso (>800 palavras), use a ferramenta save_report e informe o ID ao usuário.
7. Data de referência: ${today}

DADOS COLETADOS PELOS RESEARCHERS:
${rawNotesText || "[Nenhum dado coletado — informe ao usuário que não foram encontrados dados para a análise solicitada.]"}`;

  // final_report_node pode chamar save_report se necessário
  const modelWithTools = model.bindTools([claraTools.find((t) => t.name === "save_report")!]);

  const response = (await modelWithTools.invoke([
    new SystemMessage(REPORT_SYSTEM),
    new HumanMessage(
      "Sintetize os dados coletados em um relatório final completo. NÃO liste próximas etapas — apenas o relatório."
    ),
  ])) as AIMessage;

  // Se o modelo chamou save_report, executa a ferramenta e retorna a confirmação
  if (
    Array.isArray((response as any).tool_calls) &&
    (response as any).tool_calls.length > 0
  ) {
    const tc = (response as any).tool_calls[0];
    if (tc.name === "save_report") {
      const saveReportTool = claraTools.find((t) => t.name === "save_report")!;
      const saveResult = await (saveReportTool as any).invoke(tc.args);
      const finalMsg = new AIMessage(
        `Relatório gerado e salvo com sucesso! ${saveResult}\n\n**Resumo:** ${tc.args.titulo}`
      );
      return { messages: [finalMsg] };
    }
  }

  return { messages: [response] };
});

// ─────────────────────────────────────────────────────────────────────────────
// EDGES
// ─────────────────────────────────────────────────────────────────────────────

// @ts-expect-error
claraWorkflow.addEdge(START, "classify_node");

// classify_node → simple_agent | write_research_brief_node
// @ts-expect-error
claraWorkflow.addConditionalEdges("classify_node", (state: ClaraState) => {
  return state.is_deep_research ? "write_research_brief_node" : "simple_agent";
});

// simple_agent ⇄ tools (ReAct loop) — toolsCondition é a forma validada pelo LangGraph
// @ts-expect-error
claraWorkflow.addConditionalEdges("simple_agent", toolsCondition);

// @ts-expect-error
claraWorkflow.addEdge("tools", "simple_agent");

// write_research_brief_node → research_supervisor_node | END (se planning_mode)
// @ts-expect-error
claraWorkflow.addConditionalEdges("write_research_brief_node", (state: ClaraState) => {
  return state.research_complete ? END : "research_supervisor_node";
});

// research_supervisor_node → final_report_node | research_supervisor_node (loop)
// @ts-expect-error
claraWorkflow.addConditionalEdges("research_supervisor_node", (state: ClaraState) => {
  if (state.research_complete || state.supervisor_iteration >= MAX_SUPERVISOR_ITERATIONS) {
    return "final_report_node";
  }
  return "research_supervisor_node";
});

// @ts-expect-error
claraWorkflow.addEdge("final_report_node", END);

export const claraGraph = claraWorkflow.compile({ checkpointer: postgresCheckpointer });
