/**
 * Backfill KPIs v2 — usa chat_insights (decisao) para contar agendamentos reais,
 * não apenas a tabela appointments.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

type AnySupabase = any;
const sb: AnySupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

async function fetchAll(table: string, select: string): Promise<any[]> {
  const rows: any[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await sb.from(table).select(select).order("created_at", { ascending: true }).range(offset, offset + 999);
    if (error || !data || data.length === 0) break;
    rows.push(...data);
    if (data.length < 1000) break;
    offset += 1000;
  }
  return rows;
}

function toBRT(utcStr: string): Date {
  return new Date(new Date(utcStr).getTime() - 3 * 60 * 60 * 1000);
}
function dateBRT(utcStr: string): string {
  return toBRT(utcStr).toISOString().slice(0, 10);
}

function classifyDecisao(d: string): string {
  d = (d || "").toLowerCase();
  if (d.includes("compareceu") || d.includes("realizou consulta") || d.includes("realizou o retorno") || d.includes("concluído com sucesso")) return "compareceu";
  if (d.includes("agendou") || d.includes("confirmou") || d.includes("marcou") || d.includes("pagou")) return "agendou";
  if (d.includes("desistiu") || d.includes("cancelou") || d.includes("recusou") || d.includes("não agendou")) return "desistiu";
  if (d.includes("visualizou") && (d.includes("não respondeu") || d.includes("não confirmou"))) return "ghosting";
  if (d.includes("aguardando") || d.includes("em aberto") || d.includes("em andamento")) return "aguardando";
  if (d.includes("sem resposta") || d.includes("não houve") || d.includes("interrompida") || d.includes("encerrada")) return "sem_resposta";
  return "outro";
}

function isRetorno(d: string): boolean {
  return (d || "").toLowerCase().includes("retorno");
}

async function main() {
  console.log("Carregando dados...");
  const msgs = await fetchAll("chat_messages", "id,chat_id,sender,created_at,message_text");
  const chats = await fetchAll("chats", "id,created_at,contact_name");
  const appts = await fetchAll("appointments", "id,created_at,status,total_amount,appointment_type,patient_name,chat_id");
  const insights = await fetchAll("chat_insights", "id,chat_id,decisao,objecao_principal,sentimento,nota_atendimento,created_at");

  console.log(`Msgs: ${msgs.length} | Chats: ${chats.length} | Appts: ${appts.length} | Insights: ${insights.length}`);

  const insightsByChat: Record<number, any> = {};
  insights.forEach((i: any) => { insightsByChat[i.chat_id] = i; });

  const msgsByDay: Record<string, any[]> = {};
  msgs.forEach((m: any) => {
    const d = dateBRT(m.created_at);
    if (!msgsByDay[d]) msgsByDay[d] = [];
    msgsByDay[d].push(m);
  });

  const apptsByDay: Record<string, any[]> = {};
  appts.forEach((a: any) => {
    const d = dateBRT(a.created_at);
    if (!apptsByDay[d]) apptsByDay[d] = [];
    apptsByDay[d].push(a);
  });

  const sortedDays = Object.keys(msgsByDay).filter(d => d >= "2026-01-01").sort();
  const snapshots: any[] = [];

  for (const day of sortedDays) {
    const dayMsgs = msgsByDay[day] || [];
    if (dayMsgs.length < 3) continue;

    const dayAppts = (apptsByDay[day] || []).filter((a: any) => !(a.patient_name || "").toLowerCase().includes("teste"));
    const activeChatIds = new Set(dayMsgs.map((m: any) => m.chat_id));
    const chatsComHumano = new Set(dayMsgs.filter((m: any) => m.sender === "HUMAN_AGENT").map((m: any) => m.chat_id));
    const chatsComCustomer = new Set(dayMsgs.filter((m: any) => m.sender === "CUSTOMER").map((m: any) => m.chat_id));
    const chatsSemResposta = [...chatsComCustomer].filter((id) => !chatsComHumano.has(id));

    let compareceu = 0, agendouCount = 0, desistiu = 0, ghosting = 0, retornosCount = 0;
    let objPreco = 0, objVaga = 0, objDist = 0, objEsp = 0;
    let sentPos = 0, sentNeu = 0, sentNeg = 0;

    for (const chatId of activeChatIds) {
      const insight = insightsByChat[chatId as number];
      if (!insight) continue;

      const cls = classifyDecisao(insight.decisao);
      if (cls === "compareceu") { compareceu++; if (isRetorno(insight.decisao)) retornosCount++; }
      if (cls === "agendou") { agendouCount++; if (isRetorno(insight.decisao)) retornosCount++; }
      if (cls === "desistiu") desistiu++;
      if (cls === "ghosting") ghosting++;

      const obj = (insight.objecao_principal || "").toLowerCase();
      if (/pre[cç]o|valor|elevad/.test(obj)) objPreco++;
      if (/vaga|disponibilid|indisponibil|hor[aá]rio|data/.test(obj)) objVaga++;
      if (/dist[aâ]ncia|transporte|deslocamento|geograf/.test(obj)) objDist++;
      if (/especialidade|alergista|m[eé]dic/.test(obj)) objEsp++;

      const s = (insight.sentimento || "").toLowerCase();
      if (s === "positivo") sentPos++;
      if (s === "neutro") sentNeu++;
      if (s === "negativo") sentNeg++;
    }

    // Urgências
    const urgencyTerms = /urgente|emerg[eê]ncia|febre\s*alt|vomit|desidrat|encaixe\s*urgente|desesper/i;
    const urgencyChats = new Set<number>();
    for (const m of dayMsgs) {
      if (m.sender === "CUSTOMER" && urgencyTerms.test(m.message_text || "")) urgencyChats.add(m.chat_id);
    }

    // Tempo médio de resposta
    const tempos: number[] = [];
    for (const chatId of chatsComHumano) {
      const cm = dayMsgs.filter((m: any) => m.chat_id === chatId);
      const fc = cm.find((m: any) => m.sender === "CUSTOMER");
      const fh = cm.find((m: any) => m.sender === "HUMAN_AGENT");
      if (fc && fh) {
        const diff = (new Date(fh.created_at).getTime() - new Date(fc.created_at).getTime()) / 60000;
        if (diff > 0 && diff < 1440) tempos.push(diff);
      }
    }

    // Fora do horário
    const foraHorario = new Set<number>();
    for (const m of dayMsgs) {
      if (m.sender !== "CUSTOMER") continue;
      const h = toBRT(m.created_at).getHours();
      if (h < 8 || h >= 18) foraHorario.add(m.chat_id);
    }

    // Agendamentos: insights-based (mais preciso que appointments table pré-produção)
    const totalAgendamentos = compareceu + agendouCount;
    const consultasNovas = totalAgendamentos - retornosCount;
    const receitaAppts = dayAppts.reduce((s: number, a: any) => s + parseFloat(a.total_amount || 0), 0);
    const receitaFinal = receitaAppts > 0 ? receitaAppts : consultasNovas * 500;
    const taxaConv = activeChatIds.size > 0 ? (totalAgendamentos / activeChatIds.size) * 100 : 0;

    const novosContatos = chats.filter((c: any) => dateBRT(c.created_at) === day).length;

    snapshots.push({
      date: day,
      receita_confirmada: receitaFinal,
      receita_potencial_perdida: (desistiu + ghosting) * 500,
      ticket_medio: consultasNovas > 0 ? Math.round(receitaFinal / consultasNovas) : 0,
      agendamentos_novos: consultasNovas,
      agendamentos_retorno: retornosCount,
      novos_contatos: novosContatos,
      chats_com_resposta: chatsComHumano.size,
      chats_sem_resposta: chatsSemResposta.length,
      taxa_resposta: chatsComCustomer.size > 0 ? Math.round((chatsComHumano.size / chatsComCustomer.size) * 10000) / 100 : 0,
      tempo_medio_resposta_min: tempos.length > 0 ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length * 100) / 100 : null,
      taxa_conversao: Math.round(taxaConv * 100) / 100,
      objecao_preco: objPreco,
      objecao_vaga: objVaga,
      objecao_distancia: objDist,
      objecao_especialidade: objEsp,
      ghosting_pos_preco: ghosting, // simplificado
      msgs_por_chat_media: activeChatIds.size > 0 ? Math.round(dayMsgs.length / activeChatIds.size * 10) / 10 : 0,
      chats_fora_horario: foraHorario.size,
      urgencias_identificadas: urgencyChats.size,
      urgencias_atendidas: [...urgencyChats].filter((id) => chatsComHumano.has(id)).length,
      sentimento_positivo: sentPos,
      sentimento_neutro: sentNeu,
      sentimento_negativo: sentNeg,
      total_chats_analisados: activeChatIds.size,
      total_mensagens: dayMsgs.length,
      computed_at: new Date().toISOString(),
      details: {
        compareceram: compareceu,
        agendaram: agendouCount,
        desistiram: desistiu,
        ghosting: ghosting,
        retornos: retornosCount,
        fonte: receitaAppts > 0 ? "appointments_table" : "chat_insights_estimated",
      },
    });

    // Log
    console.log(
      `${day} | ${String(dayMsgs.length).padStart(4)} msgs | ${String(activeChatIds.size).padStart(3)} chats | ` +
        `${totalAgendamentos} agend (${consultasNovas}c+${retornosCount}r) | R$${String(receitaFinal).padStart(6)} | ` +
        `conv: ${taxaConv.toFixed(0)}% | desist: ${desistiu} | ghost: ${ghosting} | urg: ${urgencyChats.size}`
    );
  }

  // Upsert
  console.log(`\nInserindo ${snapshots.length} snapshots...`);
  for (const snap of snapshots) {
    const { error } = await sb.from("daily_kpi_snapshots").upsert(snap, { onConflict: "date" });
    if (error) console.error(`Erro ${snap.date}:`, error.message);
  }

  // Sumário
  const t = snapshots.reduce(
    (a, s) => ({
      receita: a.receita + (s.receita_confirmada || 0),
      perdida: a.perdida + (s.receita_potencial_perdida || 0),
      agendN: a.agendN + s.agendamentos_novos,
      agendR: a.agendR + s.agendamentos_retorno,
      comp: a.comp + (s.details.compareceram || 0),
      desist: a.desist + (s.details.desistiram || 0),
      ghost: a.ghost + (s.details.ghosting || 0),
      msgs: a.msgs + s.total_mensagens,
    }),
    { receita: 0, perdida: 0, agendN: 0, agendR: 0, comp: 0, desist: 0, ghost: 0, msgs: 0 }
  );

  console.log("\n" + "═".repeat(60));
  console.log("  RESULTADO FINAL CORRIGIDO");
  console.log("═".repeat(60));
  console.log(`Período: ${snapshots[0]?.date} → ${snapshots[snapshots.length - 1]?.date}`);
  console.log(`Dias: ${snapshots.length} | Mensagens: ${t.msgs}`);
  console.log(`\nCONVERSÕES:`);
  console.log(`  Compareceram: ${t.comp}`);
  console.log(`  Consultas novas: ${t.agendN}`);
  console.log(`  Retornos: ${t.agendR}`);
  console.log(`  Receita confirmada: R$ ${t.receita.toFixed(2)}`);
  console.log(`\nPERDAS:`);
  console.log(`  Desistências: ${t.desist}`);
  console.log(`  Ghosting: ${t.ghost}`);
  console.log(`  Receita perdida: R$ ${t.perdida.toFixed(2)}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
