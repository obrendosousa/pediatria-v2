/**
 * Daily KPI Cron — computa KPIs do dia anterior e insere em daily_kpi_snapshots.
 *
 * Roda a cada 60s no RobustCronManager, mas internamente checa:
 * - Se são 03:00-03:59 BRT
 * - Se já rodou hoje
 *
 * Fontes de dados:
 * - appointments: receita, agendamentos
 * - chat_messages: funil, operacional
 * - chat_insights: objeções, sentimento (classificados pelo chatClassificationCron)
 * - chats: contatos
 */

import { createClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

function getKpiSupabase(): AnySupabase {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars nao configuradas");
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Retorna data/hora atual em BRT */
function nowBRT(): { date: string; hour: number; yesterday: string } {
  const now = new Date();
  const brt = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const year = brt.getFullYear();
  const month = brt.getMonth();
  const day = brt.getDate();
  const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  // Yesterday
  const yd = new Date(brt);
  yd.setDate(yd.getDate() - 1);
  const yYear = yd.getFullYear();
  const yMonth = yd.getMonth();
  const yDay = yd.getDate();
  const yesterdayStr = `${yYear}-${String(yMonth + 1).padStart(2, "0")}-${String(yDay).padStart(2, "0")}`;

  return { date: dateStr, hour: brt.getHours(), yesterday: yesterdayStr };
}

// State — flag para evitar execução duplicada
let lastKpiDate = "";

interface KpiSnapshot {
  date: string;
  // Receita
  receita_confirmada: number;
  receita_potencial_perdida: number;
  ticket_medio: number;
  agendamentos_novos: number;
  agendamentos_retorno: number;
  // Funil
  novos_contatos: number;
  chats_com_resposta: number;
  chats_sem_resposta: number;
  taxa_resposta: number;
  tempo_medio_resposta_min: number | null;
  taxa_conversao: number;
  // Objeções
  objecao_preco: number;
  objecao_vaga: number;
  objecao_distancia: number;
  objecao_especialidade: number;
  ghosting_pos_preco: number;
  // Operacional
  msgs_por_chat_media: number;
  chats_fora_horario: number;
  urgencias_identificadas: number;
  urgencias_atendidas: number;
  // Crescimento
  sentimento_positivo: number;
  sentimento_neutro: number;
  sentimento_negativo: number;
  // Meta
  total_chats_analisados: number;
  total_mensagens: number;
  details: Record<string, unknown>;
}

async function computeKpis(supabase: AnySupabase, targetDate: string): Promise<KpiSnapshot> {
  const dayStart = `${targetDate}T00:00:00-03:00`;
  const dayEnd = `${targetDate}T23:59:59.999-03:00`;

  const kpi: KpiSnapshot = {
    date: targetDate,
    receita_confirmada: 0,
    receita_potencial_perdida: 0,
    ticket_medio: 0,
    agendamentos_novos: 0,
    agendamentos_retorno: 0,
    novos_contatos: 0,
    chats_com_resposta: 0,
    chats_sem_resposta: 0,
    taxa_resposta: 0,
    tempo_medio_resposta_min: null,
    taxa_conversao: 0,
    objecao_preco: 0,
    objecao_vaga: 0,
    objecao_distancia: 0,
    objecao_especialidade: 0,
    ghosting_pos_preco: 0,
    msgs_por_chat_media: 0,
    chats_fora_horario: 0,
    urgencias_identificadas: 0,
    urgencias_atendidas: 0,
    sentimento_positivo: 0,
    sentimento_neutro: 0,
    sentimento_negativo: 0,
    total_chats_analisados: 0,
    total_mensagens: 0,
    details: {},
  };

  // ═══ RECEITA (appointments) ═══
  const { data: appointments } = await supabase
    .from("appointments")
    .select("id, patient_id, patient_name, start_time, status, appointment_type, total_amount, chat_id")
    .gte("start_time", dayStart)
    .lte("start_time", dayEnd);

  if (appointments && appointments.length > 0) {
    const confirmed = (appointments as { id: number; total_amount: number | null; appointment_type: string | null; patient_name: string | null }[])
      .filter((a) => a.patient_name !== "Agendamento" && a.patient_name !== "Agendamento de teste");

    const receita = confirmed.reduce((sum, a) => sum + (a.total_amount || 0), 0);
    kpi.receita_confirmada = receita;
    kpi.ticket_medio = confirmed.length > 0 ? receita / confirmed.length : 0;

    kpi.agendamentos_novos = confirmed.filter((a) => a.appointment_type !== "retorno").length;
    kpi.agendamentos_retorno = confirmed.filter((a) => a.appointment_type === "retorno").length;
  }

  // ═══ FUNIL (chats + chat_messages) ═══
  // Novos contatos do dia
  const { count: newChatsCount } = await supabase
    .from("chats")
    .select("*", { count: "exact", head: true })
    .gte("created_at", dayStart)
    .lte("created_at", dayEnd);

  kpi.novos_contatos = newChatsCount || 0;

  // Total de mensagens do dia
  const { count: totalMsgs } = await supabase
    .from("chat_messages")
    .select("*", { count: "exact", head: true })
    .gte("created_at", dayStart)
    .lte("created_at", dayEnd);

  kpi.total_mensagens = totalMsgs || 0;

  // Chats com resposta da clínica (HUMAN_AGENT)
  const { data: respondedChats } = await supabase
    .from("chat_messages")
    .select("chat_id")
    .eq("sender", "HUMAN_AGENT")
    .gte("created_at", dayStart)
    .lte("created_at", dayEnd);

  const respondedChatIds = new Set(
    (respondedChats as { chat_id: number }[] || []).map((r) => r.chat_id)
  );
  kpi.chats_com_resposta = respondedChatIds.size;

  // Chats com mensagem de paciente mas sem resposta da clínica
  const { data: customerChats } = await supabase
    .from("chat_messages")
    .select("chat_id")
    .eq("sender", "CUSTOMER")
    .gte("created_at", dayStart)
    .lte("created_at", dayEnd);

  const customerChatIds = new Set(
    (customerChats as { chat_id: number }[] || []).map((r) => r.chat_id)
  );

  const unansweredChatIds = new Set<number>();
  for (const chatId of customerChatIds) {
    if (!respondedChatIds.has(chatId)) {
      unansweredChatIds.add(chatId);
    }
  }
  kpi.chats_sem_resposta = unansweredChatIds.size;

  const totalActiveChats = customerChatIds.size;
  kpi.taxa_resposta = totalActiveChats > 0
    ? Math.round((kpi.chats_com_resposta / totalActiveChats) * 10000) / 100
    : 0;

  // Taxa de conversão (chats que resultaram em agendamento)
  const appointmentChatIds = new Set(
    ((appointments as { chat_id: number | null }[] || [])
      .filter((a) => a.chat_id != null)
      .map((a) => a.chat_id!))
  );
  kpi.taxa_conversao = totalActiveChats > 0
    ? Math.round((appointmentChatIds.size / totalActiveChats) * 10000) / 100
    : 0;

  // Msgs por chat (média)
  if (totalActiveChats > 0) {
    kpi.msgs_por_chat_media = Math.round((kpi.total_mensagens / totalActiveChats) * 10) / 10;
  }

  // Chats fora de horário (antes das 7h ou depois das 19h BRT)
  const { data: offHoursMsgs } = await supabase
    .from("chat_messages")
    .select("chat_id, created_at")
    .eq("sender", "CUSTOMER")
    .gte("created_at", dayStart)
    .lte("created_at", dayEnd);

  if (offHoursMsgs) {
    const offHoursChats = new Set<number>();
    for (const msg of offHoursMsgs as { chat_id: number; created_at: string }[]) {
      const msgDate = new Date(msg.created_at);
      const brtHour = new Date(msgDate.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })).getHours();
      if (brtHour < 7 || brtHour >= 19) {
        offHoursChats.add(msg.chat_id);
      }
    }
    kpi.chats_fora_horario = offHoursChats.size;
  }

  // ═══ OBJEÇÕES E SENTIMENTO (chat_insights) ═══
  const { data: insights } = await supabase
    .from("chat_insights")
    .select("chat_id, categoria, ai_sentiment, desfecho, objecoes, citacao_chave, classified_at")
    .not("classified_at", "is", null)
    .gte("classified_at", dayStart)
    .lte("classified_at", dayEnd);

  const classifiedInsights = (insights as {
    chat_id: number;
    categoria: string | null;
    ai_sentiment: string | null;
    desfecho: string | null;
    objecoes: string[] | null;
    citacao_chave: string | null;
  }[] || []);

  kpi.total_chats_analisados = classifiedInsights.length;

  // Também include insights classified before today but for chats created today
  // We'll use the insights we have — they represent the best available data

  // Contagem por categoria
  const topObjArr: { type: string; count: number; sample_chat_ids: number[] }[] = [];

  for (const insight of classifiedInsights) {
    const cat = insight.categoria;

    if (cat === "objecao_preco") kpi.objecao_preco++;
    if (cat === "objecao_vaga") kpi.objecao_vaga++;
    if (cat === "objecao_distancia") kpi.objecao_distancia++;
    if (cat === "objecao_especialidade") kpi.objecao_especialidade++;
    if (cat === "ghosting") kpi.ghosting_pos_preco++;

    if (cat === "urgencia_atendida" || cat === "urgencia_nao_atendida") {
      kpi.urgencias_identificadas++;
      if (cat === "urgencia_atendida") kpi.urgencias_atendidas++;
    }

    // Sentimento
    const sent = insight.ai_sentiment;
    if (sent === "positivo") kpi.sentimento_positivo++;
    else if (sent === "negativo") kpi.sentimento_negativo++;
    else kpi.sentimento_neutro++;
  }

  // Receita potencial perdida (objeções de preço * ticket padrão R$500)
  kpi.receita_potencial_perdida = kpi.objecao_preco * 500;

  // ═══ DETAILS (JSON para drill-down) ═══

  // top_objections
  const objectionCounts: Record<string, { count: number; sample_chat_ids: number[] }> = {};
  for (const insight of classifiedInsights) {
    if (insight.categoria?.startsWith("objecao_") || insight.categoria === "ghosting") {
      const type = insight.categoria;
      if (!objectionCounts[type]) objectionCounts[type] = { count: 0, sample_chat_ids: [] };
      objectionCounts[type].count++;
      if (objectionCounts[type].sample_chat_ids.length < 5) {
        objectionCounts[type].sample_chat_ids.push(insight.chat_id);
      }
    }
  }
  for (const [type, data] of Object.entries(objectionCounts)) {
    topObjArr.push({ type, count: data.count, sample_chat_ids: data.sample_chat_ids });
  }
  topObjArr.sort((a, b) => b.count - a.count);

  // urgencias
  const urgencias = classifiedInsights
    .filter((i) => i.categoria === "urgencia_atendida" || i.categoria === "urgencia_nao_atendida")
    .map((i) => ({ chat_id: i.chat_id, desfecho: i.desfecho || "", contact_name: "" }));

  // Fill contact names for urgencias
  if (urgencias.length > 0) {
    const urgChatIds = urgencias.map((u) => u.chat_id);
    const { data: urgChats } = await supabase
      .from("chats")
      .select("id, contact_name")
      .in("id", urgChatIds);
    if (urgChats) {
      const nameMap = Object.fromEntries(
        (urgChats as { id: number; contact_name: string | null }[]).map((c) => [c.id, c.contact_name || ""])
      );
      for (const u of urgencias) {
        u.contact_name = nameMap[u.chat_id] || "";
      }
    }
  }

  // perdas_por_preco
  const perdasPreco = classifiedInsights
    .filter((i) => i.categoria === "objecao_preco")
    .slice(0, 10)
    .map((i) => ({ chat_id: i.chat_id, contact_name: "", citacao: i.citacao_chave || "" }));

  if (perdasPreco.length > 0) {
    const precoChatIds = perdasPreco.map((p) => p.chat_id);
    const { data: precoChats } = await supabase
      .from("chats")
      .select("id, contact_name")
      .in("id", precoChatIds);
    if (precoChats) {
      const nameMap = Object.fromEntries(
        (precoChats as { id: number; contact_name: string | null }[]).map((c) => [c.id, c.contact_name || ""])
      );
      for (const p of perdasPreco) {
        p.contact_name = nameMap[p.chat_id] || "";
      }
    }
  }

  // melhor_conversao — best example of confirmed appointment
  const bestConversion = classifiedInsights.find((i) => i.categoria === "agendamento_confirmado");
  let melhorConversao: { chat_id: number; contact_name: string } | null = null;
  if (bestConversion) {
    const { data: convChat } = await supabase
      .from("chats")
      .select("id, contact_name")
      .eq("id", bestConversion.chat_id)
      .single();
    if (convChat) {
      melhorConversao = {
        chat_id: bestConversion.chat_id,
        contact_name: (convChat as { contact_name: string | null }).contact_name || "",
      };
    }
  }

  kpi.details = {
    top_objections: topObjArr,
    urgencias,
    perdas_por_preco: perdasPreco,
    melhor_conversao: melhorConversao,
  };

  return kpi;
}

/**
 * Task principal — chamada pelo RobustCronManager a cada 60s.
 * Computa KPIs diários às 03:00-03:59 BRT.
 */
export async function dailyKpiTask(): Promise<void> {
  const { date, hour, yesterday } = nowBRT();

  // Rodar entre 03:00-03:59 BRT
  if (hour < 3 || hour >= 4) return;

  // Já rodou hoje?
  if (lastKpiDate === date) return;

  console.log(`[Worker][Daily KPI] Computando KPIs para ${yesterday}...`);

  const supabase = getKpiSupabase();

  try {
    const kpi = await computeKpis(supabase, yesterday);
    lastKpiDate = date;

    // Upsert na tabela
    const { error } = await supabase.from("daily_kpi_snapshots").upsert(
      {
        date: kpi.date,
        receita_confirmada: kpi.receita_confirmada,
        receita_potencial_perdida: kpi.receita_potencial_perdida,
        ticket_medio: kpi.ticket_medio,
        agendamentos_novos: kpi.agendamentos_novos,
        agendamentos_retorno: kpi.agendamentos_retorno,
        novos_contatos: kpi.novos_contatos,
        chats_com_resposta: kpi.chats_com_resposta,
        chats_sem_resposta: kpi.chats_sem_resposta,
        taxa_resposta: kpi.taxa_resposta,
        tempo_medio_resposta_min: kpi.tempo_medio_resposta_min,
        taxa_conversao: kpi.taxa_conversao,
        objecao_preco: kpi.objecao_preco,
        objecao_vaga: kpi.objecao_vaga,
        objecao_distancia: kpi.objecao_distancia,
        objecao_especialidade: kpi.objecao_especialidade,
        ghosting_pos_preco: kpi.ghosting_pos_preco,
        msgs_por_chat_media: kpi.msgs_por_chat_media,
        chats_fora_horario: kpi.chats_fora_horario,
        urgencias_identificadas: kpi.urgencias_identificadas,
        urgencias_atendidas: kpi.urgencias_atendidas,
        sentimento_positivo: kpi.sentimento_positivo,
        sentimento_neutro: kpi.sentimento_neutro,
        sentimento_negativo: kpi.sentimento_negativo,
        total_chats_analisados: kpi.total_chats_analisados,
        total_mensagens: kpi.total_mensagens,
        computed_at: new Date().toISOString(),
        details: kpi.details,
      },
      { onConflict: "date" }
    );

    if (error) {
      console.error(`[Worker][Daily KPI] Erro ao inserir KPIs: ${error.message}`);
      lastKpiDate = ""; // Reset para tentar novamente
      return;
    }

    console.log(
      `[Worker][Daily KPI] Concluído para ${yesterday}: ` +
      `receita=R$${kpi.receita_confirmada.toFixed(2)}, ` +
      `chats=${kpi.total_chats_analisados}, ` +
      `msgs=${kpi.total_mensagens}, ` +
      `objeções=${kpi.objecao_preco + kpi.objecao_vaga + kpi.objecao_distancia + kpi.objecao_especialidade}`
    );
  } catch (err) {
    console.error("[Worker][Daily KPI] Erro:", (err as Error).message);
    lastKpiDate = ""; // Reset para tentar novamente
  }
}
