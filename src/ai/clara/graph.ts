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
import { getFilteredChatsListTool, getChatCascadeHistoryTool, getAggregatedInsightsTool } from "@/ai/analyst/tools";
import { researcherGraph } from "./researcher_graph";
import { CLARA_SYSTEM_PROMPT } from "./system_prompt";
import { CLARA_COMPANY } from "./company";
import { CLARA_RULES } from "./rules";

// ─────────────────────────────────────────────────────────────────────────────
// ESTADO PRINCIPAL DA CLARA (arquitetura open_deep_research adaptada)
// ─────────────────────────────────────────────────────────────────────────────

export interface ClaraState {
  messages: BaseMessage[];
  chat_id: number;
  current_user_role: "admin" | "doctor" | "receptionist" | "patient" | "system";
  research_brief: string;
  raw_notes: string[];
  supervisor_messages: BaseMessage[];
  supervisor_iteration: number;
  research_complete: boolean;
  is_deep_research: boolean;
  is_planning_mode: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────────────────────

const MAX_SUPERVISOR_ITERATIONS = 3;
const MAX_PARALLEL_RESEARCHERS = 5;

// ─────────────────────────────────────────────────────────────────────────────
// FERRAMENTAS DO SIMPLE_AGENT
// ─────────────────────────────────────────────────────────────────────────────

// Conjunto canônico de ferramentas do agente — sem duplicatas.
// claraTools NÃO inclui analyst tools nem deepResearch; são adicionados aqui uma única vez.
const simpleAgentTools = [
  ...claraTools,
  deepResearchChatsTool,
  getFilteredChatsListTool,
  getChatCascadeHistoryTool,
  getAggregatedInsightsTool,
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
BANCO DE DADOS — SCHEMA E FERRAMENTAS
════════════════════════════════════════════
TABELAS PRINCIPAIS:
• chats: id, phone, contact_name, stage, ai_sentiment, last_interaction_at, created_at, is_archived, is_pinned, unread_count, status, ai_summary, patient_id
  - stage: 'new'|'em_triagem'|'agendando'|'fila_espera'|'qualified'|'lost'|'won'|'done'
  - ai_sentiment: 'positive'|'negative'|'neutral'
  - status: 'ACTIVE'|'AWAITING_HUMAN'|'ENDED'
  - last_interaction_at = data da última mensagem (campo correto para filtrar atividade)

• chat_messages: id, chat_id→chats.id, sender, message_text, bot_message, user_message, message_type, created_at, media_url
  - sender: 'AI_AGENT'(bot/Clara) | 'HUMAN_AGENT'(secretária humana, ex: Joana) | 'contact'(paciente/lead)
  - IMPORTANTE: para analisar mensagens da secretária → WHERE sender = 'HUMAN_AGENT'
  - IMPORTANTE: para analisar mensagens dos pacientes → WHERE sender = 'contact'
  - IMPORTANTE: para analisar respostas do bot → WHERE sender = 'AI_AGENT'

• chat_insights: id, chat_id→chats.id, nota_atendimento (float 0-10), sentimento, objecoes (text[]), gargalos (text[]), decisao, resumo_analise, topico, novo_conhecimento (bool), updated_at

• clara_reports: id (SERIAL), titulo, conteudo_markdown, tipo, created_at
  - tipo: 'analise_chats'|'financeiro'|'agendamento'|'geral'

• clara_memories: id, memory_type, content, updated_at
• knowledge_base: id, pergunta, resposta_ideal, categoria, tags
• agent_config: agent_id, config_key, content, updated_at
• appointments: id, patient_id→patients.id, chat_id→chats.id, status, scheduled_at
  - status: 'scheduled'|'finished'|'no_show'|'cancelled'

RELACIONAMENTOS:
  chat_messages.chat_id → chats.id
  chat_insights.chat_id → chats.id
  appointments.chat_id → chats.id | appointments.patient_id → patients.id

FERRAMENTAS DE DADOS (use nesta ordem de prioridade):

1. get_volume_metrics(start_date, end_date) ← PRIMEIRA OPÇÃO para:
   "Quantas conversas?", "Volume dia a dia", "Picos de demanda", "Atividade desta semana"
   Usa Supabase SDK — zero risco de falha.

2. execute_sql(sql) ← Para QUALQUER outra consulta. Você escreve o SQL:
   REGRAS OBRIGATÓRIAS:
   • Apenas SELECT/WITH. Proibido INSERT/UPDATE/DELETE/DROP.
   • Datas com offset BRT: '2026-02-24T00:00:00-03:00'::timestamptz
   • Agrupar por dia: DATE(campo AT TIME ZONE 'America/Sao_Paulo')
   • Para contar chats: use chats.last_interaction_at — NUNCA JOIN com chat_messages
   • Adicione LIMIT (máx 500)

3. gerar_relatorio_qualidade_chats(dias_retroativos) ← USE PARA:
   • "Quais foram as objeções?" / "Principais gargalos?" / "Nota média de atendimento?"
   • Acessa tabela chat_insights — rápido, sem precisar ler mensagens

4. get_filtered_chats_list(filters) ← Listar chats com dados de contato e IDs

5. BUSCA EM MENSAGENS (2 passos obrigatórios):
   → Passo 1: get_filtered_chats_list(start_date, end_date, limit=30) — obtém IDs
   → Passo 2: deep_research_chats(chat_ids=[IDs do Passo 1], objetivo_da_analise='...') — analisa conteúdo
   Use quando precisar LER o texto das mensagens (tom, padrões, argumentos)

6. get_chat_cascade_history(chat_id) ← Histórico completo de UM chat específico
7. get_aggregated_insights(start_date, end_date) ← Insights agregados de chat_insights
8. save_report(titulo, conteudo, tipo) ← Salvar relatório no banco

COMO VERIFICAR UM CHAT ESPECÍFICO POR NOME (2 passos):
→ Passo 1: execute_sql("SELECT id, contact_name, phone FROM chats WHERE contact_name ILIKE '%[nome]%' LIMIT 5") — localiza o ID pelo nome
→ Passo 2: get_chat_cascade_history(chat_id=[ID encontrado]) — lê o histórico completo
Use este fluxo quando o usuário mencionar o nome de um paciente, questionar uma análise anterior, ou pedir para "ver a conversa de [nome]".

COMO ANALISAR O SCRIPT/PADRÃO DA SECRETÁRIA (Joana ou outra):
A secretária é identificada por sender = 'HUMAN_AGENT' em chat_messages — NÃO é um contato/lead.
→ Opção A (texto direto, rápido): execute_sql("SELECT cm.message_text, c.contact_name, cm.created_at FROM chat_messages cm JOIN chats c ON c.id = cm.chat_id WHERE cm.sender = 'HUMAN_AGENT' AND cm.message_text IS NOT NULL ORDER BY cm.created_at DESC LIMIT 200")
→ Opção B (análise semântica): get_filtered_chats_list (obtém IDs) → deep_research_chats(chat_ids=[...], objetivo_da_analise='Analise APENAS as mensagens rotuladas [SECRETÁRIA] e identifique o script e padrão de comunicação usado')
Use Opção A para ver amostras do texto. Use Opção B para análise profunda de padrões.

⛔ REGRA CRÍTICA: NUNCA chame save_report automaticamente. Salve APENAS quando o usuário pedir explicitamente ("gere um relatório", "salve", "quero o PDF"). Para perguntas diretas, responda com texto simples.

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
        if (Array.isArray(y) && y.length === 0) return [];
        const items = Array.isArray(y) ? y : typeof y === "string" ? [y] : [];
        return [...(x ?? []), ...items.filter(Boolean)];
      },
      default: () => [] as string[],
    },
    supervisor_messages: {
      reducer: (x: BaseMessage[], y: BaseMessage[] | BaseMessage) => {
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
// NODE 1: classify_node
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

  const researchStateReset = {
    research_complete: false,
    research_brief: "",
    raw_notes: [] as string[],
    supervisor_messages: [] as BaseMessage[],
    supervisor_iteration: 0,
    is_planning_mode: false,
  };

  if (userText.trim().startsWith("[PLANEJAR]")) {
    return { ...researchStateReset, is_deep_research: true, is_planning_mode: true };
  }

  const lower = userText.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const wordCount = lower.split(/\s+/).filter(Boolean).length;
  const isGreeting = SIMPLE_KEYWORDS.some(
    (kw) => lower === kw || lower.startsWith(kw + " ") || lower.endsWith(" " + kw)
  );
  if (isGreeting || wordCount <= 4) {
    return { ...researchStateReset, is_deep_research: false };
  }

  const today = new Date().toISOString().slice(0, 10);

  const CLASSIFIER_SYSTEM = `Você é um roteador de intenções para a Clara, assistente de clínica médica.

Hoje: ${today}

REGRA FUNDAMENTAL:
"simple" = a resposta pode vir de MÉTRICAS, LISTAS, DADOS ESTRUTURADOS, INSIGHTS JÁ PROCESSADOS (tabela chat_insights), ou VERIFICAÇÃO DE UM CHAT ESPECÍFICO por nome/ID.
"research" = SOMENTE quando é necessário LER e ANALISAR o TEXTO BRUTO de MÚLTIPLAS conversas para análise semântica profunda (ex: padrões de linguagem em 30+ chats).

→ EXEMPLOS "simple" — responde com ferramentas diretas (SEM pipeline de pesquisa):
  • "Quantas conversas tivemos esta semana?" → simple
  • "Volume de chats dia a dia" → simple
  • "Picos de demanda desta semana" → simple
  • "Quantos leads estão em qualified?" → simple
  • "Qual o sentimento médio dos leads?" → simple
  • "Quais os chats mais recentes?" → simple
  • "E quais foram as objeções levantadas na semana?" → simple ← usa gerar_relatorio_qualidade_chats
  • "Quais os principais gargalos de atendimento?" → simple ← usa gerar_relatorio_qualidade_chats
  • "Qual a nota média de atendimento?" → simple ← usa gerar_relatorio_qualidade_chats
  • "Relatório de qualidade desta semana" → simple ← usa gerar_relatorio_qualidade_chats
  • "Mostre os leads com sentimento negativo" → simple ← usa get_filtered_chats_list
  • "Me mostra a conversa da Karol" → simple ← execute_sql (acha ID) + get_chat_cascade_history
  • "Verifica o chat da [nome]" → simple ← execute_sql (acha ID) + get_chat_cascade_history
  • "Estava olhando o chat de [nome] e não encontrei o que você disse" → simple ← relê o chat específico
  • "Não achei essa parte na conversa da [nome], você leu errado" → simple ← relê o chat específico
  • "Confirma se [nome] realmente disse isso" → simple ← lê o chat específico
  • "Abre o chat [ID numérico]" → simple ← get_chat_cascade_history direto
  • "O que você já aprendeu sobre X?" → simple ← manage_long_term_memory + search_knowledge_base
  • "O que você sabe sobre o script da Joana?" → simple ← manage_long_term_memory consultar
  • "O que você já aprendeu sobre o padrão de atendimento?" → simple ← consulta memória e knowledge_base

→ EXEMPLOS "research" — SOMENTE para análise semântica de MÚLTIPLAS conversas:
  • "Leia as conversas e me diga o que os pacientes mais reclamam" → research (múltiplos chats)
  • "Analise o tom e linguagem das conversas desta semana" → research (múltiplos chats)
  • "Quais argumentos de vendas funcionaram melhor?" → research (múltiplos chats)
  • "Analise o script que a secretária usa nas conversas" → research (lê mensagens HUMAN_AGENT)
  • "Como a equipe responde leads com objeção de preço?" → research (lê transcrições)

REGRA DE OURO: Verificar UM chat, confirmar uma análise, consultar memória = SEMPRE "simple". "research" é APENAS para descobrir padrões em MÚLTIPLAS conversas lendo o texto bruto.`;

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
    return { ...researchStateReset, is_deep_research: false };
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// NODE 2: simple_agent
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
// NODE 3: write_research_brief_node
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
• chats: id, phone, contact_name, stage (new|em_triagem|agendando|fila_espera|qualified|lost|won|done), ai_sentiment (positive|negative|neutral), last_interaction_at (FILTRO DE DATA — base para "conversas ativas"), is_archived
• chat_messages: id, chat_id, sender, message_text, created_at
  - sender: 'AI_AGENT'=bot | 'HUMAN_AGENT'=secretária/Joana | 'contact'=paciente
  - Para script da secretária: WHERE sender = 'HUMAN_AGENT'
  - Para mensagens de pacientes: WHERE sender = 'contact'
• chat_insights: id, chat_id, nota_atendimento (0-10), sentimento, objecoes[], gargalos[], decisao, resumo_analise, updated_at
• clara_reports: id, titulo, conteudo_markdown, tipo, created_at
• clara_memories: id, memory_type, content, updated_at

FERRAMENTAS DISPONÍVEIS (EM ORDEM DE PRIORIDADE):
• get_volume_metrics(start_date, end_date) — ⭐ USAR PRIMEIRO para volume de conversas, mensagens, picos por dia.
• execute_sql(sql) — Para qualquer outra métrica. O researcher escreve o SQL. Datas BRT: '2026-02-24T00:00:00-03:00'::timestamptz
• get_filtered_chats_list — Lista chats com detalhes de contato
• get_chat_cascade_history — Histórico de um chat específico (use o chat_id)
• deep_research_chats — Análise semântica profunda de múltiplos chats
• gerar_relatorio_qualidade_chats — Métricas de chat_insights (objeções, notas, gargalos)

REGRAS DE SENDER — MENTION NO BRIEF QUANDO RELEVANTE:
• sender = 'HUMAN_AGENT' → secretária/atendente humano (ex: Joana)
• sender = 'contact' → paciente/lead
• sender = 'AI_AGENT' → bot/Clara

Para script/padrão da secretária, inclua no brief a instrução:
"Researcher: execute execute_sql com: SELECT cm.message_text, c.contact_name, cm.created_at FROM chat_messages cm JOIN chats c ON c.id = cm.chat_id WHERE cm.sender = 'HUMAN_AGENT' AND cm.message_text IS NOT NULL ORDER BY cm.created_at DESC LIMIT 200"

Escreva um brief conciso (máx 250 palavras) especificando qual ferramenta e parâmetros exatos o researcher deve usar.`;

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

  if (state.is_planning_mode) {
    const planMessage = new AIMessage(
      `📋 **Plano de Pesquisa**\n\n${brief}\n\n---\n*Para executar este plano, envie a mesma mensagem sem o prefixo [PLANEJAR].*`
    );
    return {
      research_brief: brief,
      messages: [planMessage],
      research_complete: true,
    };
  }

  return { research_brief: brief, research_complete: false };
});

// ─────────────────────────────────────────────────────────────────────────────
// NODE 4: research_supervisor_node
// ─────────────────────────────────────────────────────────────────────────────

const SupervisorDecisionSchema = z.object({
  action: z
    .enum(["conduct_research", "research_complete"])
    .describe("Escolha 'conduct_research' para enviar pesquisadores para coletar dados ou 'research_complete' se os dados já foram coletados ou a pesquisa acabou."),
  research_tasks: z
    .array(
      z.object({
        topic: z.string().describe("Título curto do tópico a investigar."),
        description: z.string().describe("Instrução EXATA de qual ferramenta usar: get_volume_metrics com datas, ou execute_sql com o SQL completo a executar."),
      })
    )
    .max(5)
    .optional()
    .describe("Lista de tarefas. OBRIGATÓRIO preencher se action = 'conduct_research'."),
  reason: z
    .string()
    .optional()
    .describe("Motivo do encerramento. Preencher se action = 'research_complete'."),
});

claraWorkflow.addNode("research_supervisor_node", async (state: ClaraState) => {
  const today = new Date().toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

  let insightCount = 0;
  let recentChatsCount = 0;

  if (state.supervisor_iteration === 0) {
    try {
      const supabase = getSupabaseAdminClient();
      const [insightRes, recentRes] = await Promise.all([
        supabase.from("chat_insights").select("*", { count: "exact", head: true })
          .gte("updated_at", new Date(Date.now() - 90 * 86400000).toISOString()),
        supabase.from("chats").select("*", { count: "exact", head: true })
          .gte("last_interaction_at", new Date(Date.now() - 7 * 86400000).toISOString())
          .eq("is_archived", false),
      ]);
      insightCount = insightRes.count ?? 0;
      recentChatsCount = recentRes.count ?? 0;
      console.log(`ℹ️ [Supervisor] Contexto Global Lido -> Insights(90d): ${insightCount} | Chats Ativos(7d): ${recentChatsCount}`);
    } catch (e: any) {
      console.warn("⚠️ [Supervisor] Falha ao coletar contexto:", e?.message);
    }
  }

  const rawNotesContext =
    state.raw_notes.length > 0
      ? `\n\nDados já coletados pelos researchers:\n${state.raw_notes
        .map((note, i) => `--- Researcher ${i + 1} ---\n${note}`)
        .join("\n\n")}`
      : "";

  const SUPERVISOR_SYSTEM = `Você é o Supervisor de Pesquisa da Clara. Sua função é gerar tarefas precisas para os researchers coletarem dados do banco.

Hoje: ${today}
Iteração atual: ${state.supervisor_iteration + 1}/${MAX_SUPERVISOR_ITERATIONS}

DADOS GLOBAIS DA CLÍNICA (Status Real):
- Chats com atividade nos últimos 7 dias: ${recentChatsCount}
- Insights de qualidade processados (90 dias): ${insightCount}

BRIEF DE PESQUISA:
${state.research_brief}
${rawNotesContext}

REGRA DE SENDER (CRÍTICA — use nos SQL das tasks):
• sender = 'HUMAN_AGENT' → secretária/atendente humano (ex: Joana)
• sender = 'contact' → paciente/lead
• sender = 'AI_AGENT' → bot/Clara

GUIA DE FERRAMENTAS PARA AS TASKS:
• get_volume_metrics(start_date, end_date) → USE PRIMEIRO para volume de chats/mensagens por dia. Datas: YYYY-MM-DD.
  Exemplo: "Chame get_volume_metrics com start_date='${sevenDaysAgo}' e end_date='${today}'"
• execute_sql(sql) → Para agendamentos, financeiro, pacientes, qualquer JOIN ou análise customizada.
  Exemplo volume por stage: "Execute: SELECT stage, COUNT(*) FROM chats WHERE last_interaction_at >= '${sevenDaysAgo}T00:00:00-03:00'::timestamptz GROUP BY stage"
  Exemplo script secretária: "Execute: SELECT cm.message_text, c.contact_name, cm.created_at FROM chat_messages cm JOIN chats c ON c.id = cm.chat_id WHERE cm.sender = 'HUMAN_AGENT' AND cm.message_text IS NOT NULL ORDER BY cm.created_at DESC LIMIT 200"
  Exemplo mensagens pacientes: "Execute: SELECT cm.message_text, c.contact_name, cm.created_at FROM chat_messages cm JOIN chats c ON c.id = cm.chat_id WHERE cm.sender = 'contact' ORDER BY cm.created_at DESC LIMIT 200"
• get_filtered_chats_list → Listar chats com detalhes de contato (stage, sentimento, data)
• deep_research_chats → Analisar conteúdo semântico de conversas (padrões de linguagem, script)

REGRA: Nunca instrua generate_sql_report ou query_database — essas ferramentas foram removidas.

INSTRUÇÕES:
1. Na iteração 1 (raw_notes vazio), escolha OBRIGATORIAMENTE action="conduct_research" e preencha "research_tasks".
2. Tarefas devem ser explícitas: diga qual ferramenta chamar e com quais parâmetros.
3. Somente escolha "research_complete" se raw_notes JÁ tiver dados REAIS coletados.`;

  const model = new ChatGoogleGenerativeAI({
    model: "gemini-3-flash-preview",
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
    temperature: 0,
  }).withStructuredOutput(SupervisorDecisionSchema);

  let decision: z.infer<typeof SupervisorDecisionSchema>;

  try {
    decision = await model.invoke([
      new SystemMessage(SUPERVISOR_SYSTEM),
      new HumanMessage("Analise o brief e os dados. Qual é a próxima ação? Na iteração 1, preencha research_tasks e não encerre a pesquisa."),
    ]);
  } catch (e: any) {
    console.error("⚠️ [Supervisor] Erro no Parse/LLM. Forçando pesquisa de emergência!", e.message);
    decision = {
      action: "conduct_research",
      research_tasks: [
        {
          topic: "Volume Bruto de Chats (Fallback)",
          description: `Chame get_volume_metrics com start_date='${sevenDaysAgo}' e end_date='${today}' para obter o volume de conversas e mensagens dia a dia dos últimos 7 dias.`,
        },
      ],
    };
  }

  if (decision.action === "research_complete" && state.supervisor_iteration === 0) {
    console.warn("⚠️ [Supervisor] LLM tentou abortar na iteração 0. Interceptado e forçado a pesquisar.");
    decision = {
      action: "conduct_research",
      research_tasks: [
        {
          topic: "Volume de Chats Recentes",
          description: `Chame get_volume_metrics com start_date='${sevenDaysAgo}' e end_date='${today}' para obter o volume de conversas e mensagens dia a dia dos últimos 7 dias.`,
        },
      ],
    };
  }

  const EMPTY_INDICATORS = [
    "nenhum dado", "nenhum insight", "não foram encontrados", "sem dados",
    "nenhuma interação", "0 chats", "não possui registros", "não retornou registros",
    "ainda não foram submetidos", "dados brutos existem", "sem registros processados",
    "nenhum chat encontrado", "nenhum resultado", "falha"
  ];

  const hasNoData =
    state.raw_notes.length === 0 ||
    state.raw_notes.every((n) => {
      if (!n?.trim()) return true;
      const lower = n.toLowerCase();
      return EMPTY_INDICATORS.some((indicator) => lower.includes(indicator));
    });

  if (decision.action === "research_complete" && hasNoData && state.supervisor_iteration < MAX_SUPERVISOR_ITERATIONS - 1) {
    decision = {
      action: "conduct_research",
      research_tasks: [
        {
          topic: "Pesquisa Forçada de Volume",
          description: `Chame get_volume_metrics com start_date='${sevenDaysAgo}' e end_date='${today}' para obter o volume de conversas e mensagens dia a dia dos últimos 7 dias. Esta é a ferramenta correta para dados de volume — use-a imediatamente.`,
        },
      ],
    };
  }

  if (decision.action === "research_complete") {
    const reasonText = decision.reason || "Decisão do LLM";
    const supervisorMsg = new AIMessage(`Pesquisa concluída após ${state.supervisor_iteration + 1} iteração(ões). ${reasonText}`);
    return {
      research_complete: true,
      supervisor_messages: [supervisorMsg],
      supervisor_iteration: state.supervisor_iteration + 1,
    };
  }

  const tasks = decision.research_tasks || [];

  const researchResults = await Promise.all(
    tasks.map((task) =>
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

  const newNotes = researchResults
    .map((r) => (r as any).compressed_research as string | undefined)
    .filter((n): n is string => typeof n === "string" && n.trim().length > 0);

  const supervisorMsg = new AIMessage(
    `Rodada ${state.supervisor_iteration + 1}: ${tasks.length} researcher(s) executados.`
  );

  return {
    raw_notes: newNotes,
    supervisor_messages: [supervisorMsg],
    supervisor_iteration: state.supervisor_iteration + 1,
    research_complete: false,
  };
});

// ─────────────────────────────────────────────────────────────────────────────
// NODE 5: final_report_node
// ─────────────────────────────────────────────────────────────────────────────

claraWorkflow.addNode("final_report_node", async (state: ClaraState) => {
  const { custom_rules } = await loadDynamicPromptParts();

  // Usa gemini-3.1-pro-preview para síntese de relatório de maior qualidade
  const model = new ChatGoogleGenerativeAI({
    model: "gemini-3.1-pro-preview",
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
INSTRUÇÕES DO RELATÓRIO FINAL E REGRAS ANTI-ALUCINAÇÃO
════════════════════════════════════════════
Você recebeu os achados consolidados do sistema sobre a seguinte solicitação:

BRIEF: ${state.research_brief}

Sua tarefa é sintetizar esses dados em um relatório Markdown elegante, estruturado e profissional para a clínica.

REGRAS DE CONDUTA, SIGILO E VERACIDADE (OBRIGATÓRIAS E INQUEBRÁVEIS):
1. ⛔ SIGILO DE SISTEMA (ANTI-VAZAMENTO): NUNCA mencione processos internos. PALAVRAS PROIBIDAS: "pesquisadores", "researchers", "banco de dados", "SQL", "query", "tabelas", "motor de análise", "LangGraph", "raw_notes", "ferramentas". Aja com total naturalidade humana.
2. ⛔ VERACIDADE ABSOLUTA (ANTI-ALUCINAÇÃO): É ESTRITAMENTE PROIBIDO inventar, deduzir ou fabricar nomes, IDs de chats, telefones, estágios, sentimentos ou números de volume. Você DEVE usar APENAS e EXATAMENTE os dados numéricos e as listas fornecidos abaixo na seção "DADOS COLETADOS NO SISTEMA". Se o dado não está escrito ali, ele NÃO existe.
3. COMPORTAMENTO EM CASO DE DADOS VAZIOS: Se a seção "DADOS COLETADOS NO SISTEMA" relatar falha ou estiver vazia, VOCÊ ESTÁ PROIBIDA DE GERAR O RELATÓRIO. Não invente nada. Peça desculpas educadamente, explique que não há volume registrado.
4. PRESERVAÇÃO DE DADOS REAIS: Preserve TODOS os links de chats no formato [[chat:ID|Nome (Telefone)]] EXATAMENTE como recebidos dos dados crus.
5. Se os dados forem reais, fartos e concretos, crie o relatório com seções e inclua a tabela "📎 Amostra de Chats" com as colunas | Chat | Sentimento | Stage |.
6. Data de referência atual: ${today}.

DADOS COLETADOS NO SISTEMA:
${rawNotesText || "[Nenhum dado consolidado foi encontrado para este pedido. Aja naturalmente informando que não possui esses registros no momento, sem inventar dados.]"}`;

  const response = (await model.invoke([
    new SystemMessage(REPORT_SYSTEM),
    new HumanMessage(
      "Sintetize os dados recebidos. Atenção máxima à regra Anti-Alucinação e de Sigilo Absoluto: não invente dados."
    ),
  ])) as AIMessage;

  const reportText =
    typeof response.content === "string"
      ? response.content
      : Array.isArray(response.content)
        ? (response.content as Array<any>).map((c) => c?.text ?? "").join("")
        : "";

  // Salva automaticamente apenas quando o brief indica que o usuário pediu um relatório formal
  const saveKeywords = /\b(salvar|save|gere um relat[oó]rio|gerar relat[oó]rio|relat[oó]rio formal|export|pdf)\b/i;
  const shouldAutoSave = saveKeywords.test(state.research_brief) ||
    saveKeywords.test((state.messages[state.messages.length - 1]?.content as string) ?? "");

  if (shouldAutoSave) {
    try {
      const supabase = getSupabaseAdminClient();
      const titulo = `Relatório — ${new Date().toLocaleDateString("pt-BR")}`;
      const { data: saved, error: saveError } = await (supabase as any)
        .from("clara_reports")
        .insert({ titulo, conteudo_markdown: reportText, tipo: "analise_chats", created_at: new Date().toISOString() })
        .select("id")
        .single();

      if (!saveError) {
        const reportId = (saved as any)?.id;
        if (reportId) {
          console.log(`✅ [Clara] Relatório salvo — ID #${reportId}`);
          return {
            messages: [new AIMessage(
              `${reportText}\n\n---\n📄 *Relatório salvo — ID #${reportId}. Acesse em /relatorios/${reportId}*`
            )],
          };
        }
      } else {
        console.error("❌ [Clara] Erro ao salvar relatório:", saveError.message);
      }
    } catch (e: any) {
      console.error("❌ [Clara] Exceção ao salvar relatório:", e?.message ?? e);
    }
  }

  return { messages: [new AIMessage(reportText)] };
});

// ─────────────────────────────────────────────────────────────────────────────
// EDGES
// ─────────────────────────────────────────────────────────────────────────────

// @ts-expect-error
claraWorkflow.addEdge(START, "classify_node");

// @ts-expect-error
claraWorkflow.addConditionalEdges("classify_node", (state: ClaraState) => {
  return state.is_deep_research ? "write_research_brief_node" : "simple_agent";
});

// @ts-expect-error
claraWorkflow.addConditionalEdges("simple_agent", toolsCondition);

// @ts-expect-error
claraWorkflow.addEdge("tools", "simple_agent");

// @ts-expect-error
claraWorkflow.addConditionalEdges("write_research_brief_node", (state: ClaraState) => {
  return state.research_complete ? END : "research_supervisor_node";
});

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