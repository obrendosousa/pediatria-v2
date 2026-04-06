import { createClient } from "@supabase/supabase-js";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getVaultService, isVaultAvailable } from "./service";

// ═══════════════════════════════════════════════════════════════════════════
// VAULT CONSOLIDATION — Pipeline automatico de evolucao do conhecimento
// inbox → daily → weekly → monthly
// ═══════════════════════════════════════════════════════════════════════════

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

/** Helper para formatar data BRT */
function todayBRT(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Chama Gemini Flash para sintetizar texto */
async function llmSynthesize(systemPrompt: string, content: string): Promise<string> {
  const model = new ChatGoogleGenerativeAI({
    model: "gemini-3-flash-preview",
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
    temperature: 0.2,
  });

  const response = await model.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(content),
  ]);

  return typeof response.content === "string"
    ? response.content
    : Array.isArray(response.content)
      ? (response.content as Array<{ text?: string }>).map((c) => c?.text ?? "").join("")
      : "";
}

// ─────────────────────────────────────────────────────────────────────────
// DAILY CONSOLIDATION
// ─────────────────────────────────────────────────────────────────────────

export interface DailyConsolidationResult {
  date: string;
  notePath: string;
  inboxProcessed: number;
  metricsSnapshot: string;
}

export async function runDailyConsolidation(
  targetDate?: string
): Promise<DailyConsolidationResult> {
  if (!(await isVaultAvailable())) {
    throw new Error("Vault indisponivel");
  }

  const vault = getVaultService();
  const date = targetDate || todayBRT();
  const notePath = `daily/${date}.md`;

  // 1. Coletar itens do inbox do dia
  let inboxItems: { path: string; content: string; source: string }[] = [];
  try {
    const allInbox = await vault.listNotes("inbox/", { sortBy: "mtime", order: "asc" });
    const todayInbox = allInbox.filter((n) => {
      const noteDate = n.path.split("/").pop()?.slice(0, 10) || "";
      return noteDate === date;
    });

    inboxItems = await Promise.all(
      todayInbox.map(async (n) => {
        const note = await vault.readNote(n.path);
        return {
          path: n.path,
          content: note.content,
          source: (note.frontmatter.source as string) || "unknown",
        };
      })
    );
  } catch {
    // inbox vazio ou nao existe
  }

  // 2. Coletar metricas do Supabase
  let metricsSnapshot = "";
  try {
    const startOfDay = `${date}T00:00:00-03:00`;
    const endOfDay = `${date}T23:59:59-03:00`;

    const [chatsRes, msgsRes, appointmentsRes] = await Promise.all([
      supabase
        .from("chats")
        .select("*", { count: "exact", head: true })
        .gte("last_interaction_at", startOfDay)
        .lt("last_interaction_at", endOfDay),
      supabase
        .from("chat_messages")
        .select("*", { count: "exact", head: true })
        .gte("created_at", startOfDay)
        .lt("created_at", endOfDay),
      supabase
        .from("appointments")
        .select("*", { count: "exact", head: true })
        .gte("created_at", startOfDay)
        .lt("created_at", endOfDay),
    ]);

    metricsSnapshot = [
      `- Chats ativos: ${chatsRes.count ?? 0}`,
      `- Mensagens trocadas: ${msgsRes.count ?? 0}`,
      `- Agendamentos criados: ${appointmentsRes.count ?? 0}`,
    ].join("\n");
  } catch (err) {
    metricsSnapshot = `- Erro ao coletar metricas: ${(err as Error).message}`;
  }

  // 3. Coletar memorias e decisoes criadas hoje
  let memoriesCreated = 0;
  let decisionsCreated = 0;
  try {
    const todayMemories = await vault.listNotes("memories/", { sortBy: "mtime" });
    memoriesCreated = todayMemories.filter((n) => {
      const created = String(n.frontmatter.created_at || "");
      return created.startsWith(date);
    }).length;

    const todayDecisions = await vault.listNotes("decisions/", { sortBy: "mtime" });
    decisionsCreated = todayDecisions.filter((n) => {
      const created = String(n.frontmatter.decision_date || "");
      return created === date;
    }).length;
  } catch {
    // sem memorias ou decisoes
  }

  // 4. Gerar nota diaria
  const inboxSection = inboxItems.length > 0
    ? `## Inbox Processado (${inboxItems.length} itens)\n\n${inboxItems.map((item) => `### [${item.source}]\n${item.content}`).join("\n\n---\n\n")}`
    : "## Inbox\n\nNenhum item no inbox hoje.";

  const dailyContent = `# Daily Digest — ${date}

## Metricas do Dia

${metricsSnapshot}
- Memorias criadas: ${memoriesCreated}
- Decisoes registradas: ${decisionsCreated}

${inboxSection}
`;

  await vault.writeNote(notePath, dailyContent, {
    type: "daily_digest",
    date,
    auto_generated: true,
    inbox_processed: inboxItems.length,
    metrics: {
      memories_created: memoriesCreated,
      decisions_created: decisionsCreated,
    },
  });

  // 5. Marcar itens do inbox como processados
  for (const item of inboxItems) {
    try {
      await vault.updateFrontmatter(item.path, { processed: true, processed_at: new Date().toISOString() });
    } catch {
      // nao critico
    }
  }

  return {
    date,
    notePath,
    inboxProcessed: inboxItems.length,
    metricsSnapshot,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// WEEKLY CONSOLIDATION
// ─────────────────────────────────────────────────────────────────────────

export interface WeeklyConsolidationResult {
  weekStart: string;
  weekEnd: string;
  notePath: string;
  dailiesProcessed: number;
}

export async function runWeeklyConsolidation(): Promise<WeeklyConsolidationResult> {
  if (!(await isVaultAvailable())) {
    throw new Error("Vault indisponivel");
  }

  const vault = getVaultService();
  const today = todayBRT();
  const todayDate = new Date(today + "T12:00:00-03:00");

  // Ultimos 7 dias
  const dates: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(todayDate.getTime() - i * 86400000);
    dates.push(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d));
  }

  const weekStart = dates[0];
  const weekEnd = dates[dates.length - 1];

  // 1. Ler daily notes da semana
  const dailyContents: string[] = [];
  for (const date of dates) {
    try {
      const note = await vault.readNote(`daily/${date}.md`);
      dailyContents.push(`## ${date}\n${note.content}`);
    } catch {
      dailyContents.push(`## ${date}\n(sem dados)`);
    }
  }

  // 2. Ler knowledge base e feedback recente
  let recentKnowledge = "";
  try {
    const kbNotes = await vault.listNotes("knowledge/", { limit: 10, sortBy: "mtime", order: "desc" });
    const weekNotes = kbNotes.filter((n) => {
      const created = String(n.frontmatter.created_at || "");
      return created >= weekStart;
    });
    if (weekNotes.length > 0) {
      recentKnowledge = `\n\nKnowledge base criado esta semana: ${weekNotes.length} notas\n${weekNotes.map((n) => `- ${n.path}`).join("\n")}`;
    }
  } catch {
    // sem knowledge
  }

  // 3. Sintetizar com Gemini Flash
  const synthesisInput = dailyContents.join("\n\n---\n\n") + recentKnowledge;

  const synthesis = await llmSynthesize(
    `Voce e um analista de operacoes de uma clinica pediatrica.
Analise os resumos diarios da semana e produza:

1. **Padroes Recorrentes**: topicos que apareceram em mais de um dia
2. **Tendencias de Metricas**: volume subindo/descendo, picos de demanda
3. **Knowledge Gaps**: perguntas frequentes sem resposta na base de conhecimento
4. **Insights Acionaveis**: 3-5 recomendacoes concretas

Seja direto e objetivo. Formato Markdown.`,
    synthesisInput
  );

  // 4. Salvar nota semanal
  const notePath = `reports/${weekStart}-to-${weekEnd}-weekly.md`;
  await vault.writeNote(notePath, synthesis, {
    type: "weekly_report",
    week_start: weekStart,
    week_end: weekEnd,
    auto_generated: true,
    created_at: new Date().toISOString(),
    dailies_processed: dailyContents.length,
  });

  // 5. Atualizar insights-cache do analyst
  try {
    await vault.writeNote("agents/analyst/insights-cache.md", synthesis, {
      type: "insights_cache",
      agent: "analyst",
      week: `${weekStart} a ${weekEnd}`,
      updated_at: new Date().toISOString(),
    });
  } catch {
    // nao critico
  }

  // 6. Compilar feedback do copilot aprovado na semana
  try {
    const kbFeedback = await vault.searchNotes("", {
      folder: "knowledge/operations/",
      limit: 20,
    });
    const weekFeedback = kbFeedback.filter((n) => {
      const created = String(n.frontmatter.created_at || "");
      return created >= weekStart && n.frontmatter.category === "copiloto_feedback";
    });

    if (weekFeedback.length > 0) {
      const compiled = weekFeedback
        .map((n) => n.content.trim())
        .join("\n\n---\n\n");

      await vault.writeNote("agents/copilot/approved-responses.md", compiled, {
        type: "copilot_approved",
        compiled_from: weekFeedback.length,
        week: `${weekStart} a ${weekEnd}`,
        updated_at: new Date().toISOString(),
      });
    }
  } catch {
    // nao critico
  }

  return {
    weekStart,
    weekEnd,
    notePath,
    dailiesProcessed: dailyContents.length,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// MONTHLY META-ANALYSIS
// ─────────────────────────────────────────────────────────────────────────

export interface MonthlyConsolidationResult {
  month: string;
  notePath: string;
  weekliesProcessed: number;
  decisionsProcessed: number;
}

export async function runMonthlyConsolidation(
  targetMonth?: string
): Promise<MonthlyConsolidationResult> {
  if (!(await isVaultAvailable())) {
    throw new Error("Vault indisponivel");
  }

  const vault = getVaultService();
  const month = targetMonth || todayBRT().slice(0, 7); // YYYY-MM

  // 1. Coletar relatorios semanais do mes
  let weeklyContents: string[] = [];
  try {
    const weeklyNotes = await vault.listNotes("reports/", { sortBy: "mtime", order: "asc" });
    const monthlyWeeklies = weeklyNotes.filter(
      (n) => n.path.includes("-weekly") && n.path.includes(month)
    );

    weeklyContents = await Promise.all(
      monthlyWeeklies.map(async (n) => {
        const note = await vault.readNote(n.path);
        return `### ${n.path}\n${note.content}`;
      })
    );
  } catch {
    // sem weeklies
  }

  // 2. Coletar todas as decisoes do mes
  let decisionsContent: string[] = [];
  try {
    const allDecisions = await vault.listNotes("decisions/", { sortBy: "mtime" });
    const monthDecisions = allDecisions.filter((n) => {
      const decDate = String(n.frontmatter.decision_date || "");
      return decDate.startsWith(month);
    });

    decisionsContent = await Promise.all(
      monthDecisions.map(async (n) => {
        const note = await vault.readNote(n.path);
        return `- [${n.frontmatter.category}] ${n.frontmatter.summary || note.content.slice(0, 100)}`;
      })
    );
  } catch {
    // sem decisoes
  }

  // 3. Sintetizar com Gemini Pro
  const analysisInput = [
    "## Relatorios Semanais",
    weeklyContents.length > 0 ? weeklyContents.join("\n\n") : "(nenhum relatorio semanal)",
    "",
    "## Decisoes do Mes",
    decisionsContent.length > 0 ? decisionsContent.join("\n") : "(nenhuma decisao registrada)",
  ].join("\n\n");

  const model = new ChatGoogleGenerativeAI({
    model: "gemini-3-flash-preview",
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
    temperature: 0.3,
  });

  const metaResponse = await model.invoke([
    new SystemMessage(`Voce e um estrategista de operacoes de clinica pediatrica.
Analise os dados do mes e produza uma meta-analise executiva:

1. **Resumo Executivo**: 2-3 frases sobre o mes
2. **Tendencias Principais**: metricas, padroes de atendimento
3. **Decisoes Tomadas**: resumo das decisoes e seu impacto
4. **Evolucao da Base de Conhecimento**: o que foi aprendido
5. **Recomendacoes para o Proximo Mes**: 3-5 acoes prioritarias
6. **Gaps de Conhecimento**: areas que precisam de mais dados/treinamento

Formato Markdown profissional.`),
    new HumanMessage(analysisInput),
  ]);

  const metaContent = typeof metaResponse.content === "string"
    ? metaResponse.content
    : Array.isArray(metaResponse.content)
      ? (metaResponse.content as Array<{ text?: string }>).map((c) => c?.text ?? "").join("")
      : "";

  // 4. Salvar relatorio mensal
  const notePath = `reports/${month}-monthly-meta.md`;
  await vault.writeNote(notePath, metaContent, {
    type: "monthly_meta",
    month,
    auto_generated: true,
    created_at: new Date().toISOString(),
    weeklies_processed: weeklyContents.length,
    decisions_processed: decisionsContent.length,
  });

  // 5. Atualizar gap-analysis
  try {
    const gapSection = metaContent.match(/##?\s*Gaps?.*?\n([\s\S]*?)(?=\n##|$)/i)?.[1]?.trim() || "";
    if (gapSection) {
      await vault.writeNote("graphs/gap-analysis.md", `# Gap Analysis — ${month}\n\n${gapSection}`, {
        type: "graph_analysis",
        analysis_type: "gap_analysis",
        last_generated: new Date().toISOString().slice(0, 10),
        auto_generated: true,
        month,
      });
    }
  } catch {
    // nao critico
  }

  // 6. Atualizar topic-map com topicos recorrentes
  try {
    const topicSection = metaContent.match(/##?\s*Tendencias?.*?\n([\s\S]*?)(?=\n##|$)/i)?.[1]?.trim() || "";
    if (topicSection) {
      await vault.writeNote("graphs/topic-map.md", `# Topic Map — ${month}\n\n${topicSection}`, {
        type: "graph_analysis",
        analysis_type: "topic_map",
        last_generated: new Date().toISOString().slice(0, 10),
        auto_generated: true,
        month,
      });
    }
  } catch {
    // nao critico
  }

  return {
    month,
    notePath,
    weekliesProcessed: weeklyContents.length,
    decisionsProcessed: decisionsContent.length,
  };
}
