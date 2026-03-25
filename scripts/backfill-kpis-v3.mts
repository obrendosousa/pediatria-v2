/**
 * Backfill KPIs v3 — usa classificações individuais do chat_insights (LLM) + metricas_extras.
 * Dados 100% baseados na análise individual de cada chat.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

type AnySupabase = any;
const sb: AnySupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

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

async function main() {
  console.log("═".repeat(60));
  console.log("  BACKFILL KPIs v3 — DADOS CLASSIFICADOS INDIVIDUALMENTE");
  console.log("═".repeat(60));

  console.log("\nCarregando dados...");
  const msgs = await fetchAll("chat_messages", "id,chat_id,sender,created_at,message_text");
  const chats = await fetchAll("chats", "id,created_at,contact_name");
  const appts = await fetchAll("appointments", "id,created_at,status,total_amount,appointment_type,patient_name,chat_id");
  const insights = await fetchAll("chat_insights", "id,chat_id,categoria,desfecho,objecao_principal,sentimento,nota_atendimento,citacao_chave,resumo_analise,metricas_extras,created_at,updated_at");

  console.log(`  Msgs: ${msgs.length} | Chats: ${chats.length} | Appts: ${appts.length} | Insights: ${insights.length}`);

  // Index
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
    if (dayMsgs.length < 2) continue;

    const dayAppts = (apptsByDay[day] || []).filter((a: any) => !(a.patient_name || "").toLowerCase().includes("teste"));
    const activeChatIds = new Set(dayMsgs.map((m: any) => m.chat_id));
    const chatsComHumano = new Set(dayMsgs.filter((m: any) => m.sender === "HUMAN_AGENT").map((m: any) => m.chat_id));
    const chatsComCustomer = new Set(dayMsgs.filter((m: any) => m.sender === "CUSTOMER").map((m: any) => m.chat_id));
    const chatsSemResposta = [...chatsComCustomer].filter((id) => !chatsComHumano.has(id));

    // Classificar chats do dia via insights (dados do LLM individual)
    let agendConsulta = 0, agendRetorno = 0, consultaRealizada = 0, retornoRealizado = 0;
    let desistPreco = 0, desistVaga = 0, desistDist = 0, desistOutro = 0;
    let ghostPreco = 0, ghostInfo = 0;
    let sentPos = 0, sentNeu = 0, sentNeg = 0;
    let urgencias = 0, urgAtendidas = 0;
    let notasSum = 0, notasCount = 0;
    const desistenciasDetalhe: any[] = [];
    const urgenciasDetalhe: any[] = [];
    const conversoesDDetalhe: any[] = [];

    for (const chatId of activeChatIds) {
      const insight = insightsByChat[chatId as number];
      if (!insight || !insight.categoria) continue;

      const cat = insight.categoria;
      const extras = insight.metricas_extras || {};
      const chat = chats.find((c: any) => c.id === chatId);
      const nome = chat?.contact_name || `Chat ${chatId}`;

      // Contagem por categoria
      if (cat === "agendamento_confirmado") { agendConsulta++; conversoesDDetalhe.push({ chat_id: chatId, nome, tipo: "consulta" }); }
      if (cat === "retorno_confirmado") { agendRetorno++; conversoesDDetalhe.push({ chat_id: chatId, nome, tipo: "retorno" }); }
      if (cat === "consulta_realizada") { consultaRealizada++; conversoesDDetalhe.push({ chat_id: chatId, nome, tipo: "consulta_realizada" }); }
      if (cat === "retorno_realizado") { retornoRealizado++; conversoesDDetalhe.push({ chat_id: chatId, nome, tipo: "retorno_realizado" }); }
      if (cat === "desistencia_preco") { desistPreco++; desistenciasDetalhe.push({ chat_id: chatId, nome, motivo: "preco", citacao: insight.citacao_chave }); }
      if (cat === "desistencia_vaga") { desistVaga++; desistenciasDetalhe.push({ chat_id: chatId, nome, motivo: "vaga", citacao: insight.citacao_chave }); }
      if (cat === "desistencia_distancia") { desistDist++; desistenciasDetalhe.push({ chat_id: chatId, nome, motivo: "distancia", citacao: insight.citacao_chave }); }
      if (cat === "desistencia_outro") { desistOutro++; desistenciasDetalhe.push({ chat_id: chatId, nome, motivo: "outro", citacao: insight.citacao_chave }); }
      if (cat === "ghosting_pos_preco") { ghostPreco++; desistenciasDetalhe.push({ chat_id: chatId, nome, motivo: "ghost_preco", citacao: insight.citacao_chave }); }
      if (cat === "ghosting_pos_info") { ghostInfo++; }

      // Urgência (do metricas_extras.is_urgencia ou da categoria)
      if (extras.is_urgencia) {
        urgencias++;
        if (cat.includes("realizada") || cat.includes("confirmado")) urgAtendidas++;
        urgenciasDetalhe.push({ chat_id: chatId, nome, desfecho: insight.desfecho });
      }

      // Sentimento
      const s = (insight.sentimento || "").toLowerCase();
      if (s === "positivo") sentPos++;
      if (s === "neutro") sentNeu++;
      if (s === "negativo") sentNeg++;

      // Nota
      if (typeof insight.nota_atendimento === "number" && insight.nota_atendimento > 0) {
        notasSum += insight.nota_atendimento;
        notasCount++;
      }
    }

    // Tempo médio de resposta
    const tempos: number[] = [];
    for (const chatId of chatsComHumano) {
      const cm = dayMsgs.filter((m: any) => m.chat_id === chatId).sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
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

    // Receita: appointments table (real) OU estimativa
    const receitaAppts = dayAppts.reduce((s: number, a: any) => s + parseFloat(a.total_amount || 0), 0);
    const consultasTotal = agendConsulta + consultaRealizada;
    const receitaFinal = receitaAppts > 0 ? receitaAppts : consultasTotal * 500;
    const totalConversoes = consultasTotal + agendRetorno + retornoRealizado;
    const taxaConv = activeChatIds.size > 0 ? (totalConversoes / activeChatIds.size) * 100 : 0;
    const novosContatos = chats.filter((c: any) => dateBRT(c.created_at) === day).length;
    const totalDesist = desistPreco + desistVaga + desistDist + desistOutro;
    const totalGhost = ghostPreco + ghostInfo;

    snapshots.push({
      date: day,
      receita_confirmada: receitaFinal,
      receita_potencial_perdida: (totalDesist + ghostPreco) * 500,
      ticket_medio: consultasTotal > 0 ? Math.round(receitaFinal / consultasTotal) : 0,
      agendamentos_novos: consultasTotal,
      agendamentos_retorno: agendRetorno + retornoRealizado,
      novos_contatos: novosContatos,
      chats_com_resposta: chatsComHumano.size,
      chats_sem_resposta: chatsSemResposta.length,
      taxa_resposta: chatsComCustomer.size > 0 ? Math.round((chatsComHumano.size / chatsComCustomer.size) * 10000) / 100 : 0,
      tempo_medio_resposta_min: tempos.length > 0 ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length * 100) / 100 : null,
      taxa_conversao: Math.round(taxaConv * 100) / 100,
      objecao_preco: desistPreco + ghostPreco,
      objecao_vaga: desistVaga,
      objecao_distancia: desistDist,
      objecao_especialidade: 0,
      ghosting_pos_preco: ghostPreco,
      msgs_por_chat_media: activeChatIds.size > 0 ? Math.round(dayMsgs.length / activeChatIds.size * 10) / 10 : 0,
      chats_fora_horario: foraHorario.size,
      urgencias_identificadas: urgencias,
      urgencias_atendidas: urgAtendidas,
      sentimento_positivo: sentPos,
      sentimento_neutro: sentNeu,
      sentimento_negativo: sentNeg,
      total_chats_analisados: activeChatIds.size,
      total_mensagens: dayMsgs.length,
      computed_at: new Date().toISOString(),
      details: {
        consultas_realizadas: consultaRealizada,
        retornos_realizados: retornoRealizado,
        agendamentos_confirmados: agendConsulta,
        retornos_confirmados: agendRetorno,
        desistencias: totalDesist,
        ghosting: totalGhost,
        desistencias_detalhe: desistenciasDetalhe,
        urgencias_detalhe: urgenciasDetalhe,
        conversoes_detalhe: conversoesDDetalhe,
        nota_media: notasCount > 0 ? Math.round(notasSum / notasCount * 10) / 10 : null,
        fonte: receitaAppts > 0 ? "appointments" : "chat_insights_llm",
      },
    });
  }

  // Upsert
  console.log(`\nInserindo ${snapshots.length} snapshots...`);
  for (const snap of snapshots) {
    const { error } = await sb.from("daily_kpi_snapshots").upsert(snap, { onConflict: "date" });
    if (error) console.error(`Erro ${snap.date}:`, error.message);
  }

  // Print tabela final
  console.log("\n" + "═".repeat(110));
  console.log("  DIA        | MSGS  | CHATS | AGEND(C+R) | RECEITA   | CONV  | DESIST | GHOST | URG | SENT(+/=/-)  | NOTA");
  console.log("─".repeat(110));

  let totals = { msgs: 0, chats: 0, agendN: 0, agendR: 0, receita: 0, desist: 0, ghost: 0, urg: 0, sentP: 0, sentN: 0, sentNeg: 0, perdida: 0 };

  for (const s of snapshots) {
    if (s.total_mensagens < 5) continue;
    const d = s.details;
    console.log(
      `  ${s.date} | ${String(s.total_mensagens).padStart(5)} | ${String(s.total_chats_analisados).padStart(5)} | ` +
      `${String(s.agendamentos_novos).padStart(3)}c+${String(s.agendamentos_retorno).padStart(2)}r | ` +
      `R$${String(s.receita_confirmada).padStart(7)} | ${String(s.taxa_conversao).padStart(4)}% | ` +
      `${String(d.desistencias || 0).padStart(5)}  | ${String(d.ghosting || 0).padStart(4)}  | ${String(s.urgencias_identificadas).padStart(2)}  | ` +
      `${s.sentimento_positivo}/${s.sentimento_neutro}/${s.sentimento_negativo} | ${d.nota_media || "-"}`
    );
    totals.msgs += s.total_mensagens;
    totals.chats += s.total_chats_analisados;
    totals.agendN += s.agendamentos_novos;
    totals.agendR += s.agendamentos_retorno;
    totals.receita += s.receita_confirmada;
    totals.desist += (d.desistencias || 0);
    totals.ghost += (d.ghosting || 0);
    totals.urg += s.urgencias_identificadas;
    totals.sentP += s.sentimento_positivo;
    totals.sentN += s.sentimento_neutro;
    totals.sentNeg += s.sentimento_negativo;
    totals.perdida += s.receita_potencial_perdida;
  }

  console.log("─".repeat(110));
  console.log(
    `  TOTAL      | ${String(totals.msgs).padStart(5)} | ${String(totals.chats).padStart(5)} | ` +
    `${String(totals.agendN).padStart(3)}c+${String(totals.agendR).padStart(2)}r | ` +
    `R$${String(totals.receita).padStart(7)} | ${totals.chats > 0 ? ((totals.agendN + totals.agendR) / totals.chats * 100).toFixed(0) : 0}%  | ` +
    `${String(totals.desist).padStart(5)}  | ${String(totals.ghost).padStart(4)}  | ${String(totals.urg).padStart(2)}  | ` +
    `${totals.sentP}/${totals.sentN}/${totals.sentNeg}`
  );

  console.log("\n" + "═".repeat(60));
  console.log("  RESUMO EXECUTIVO");
  console.log("═".repeat(60));
  console.log(`  Período: ${snapshots[0]?.date} → ${snapshots[snapshots.length - 1]?.date}`);
  console.log(`  Total mensagens: ${totals.msgs}`);
  console.log(`  Consultas novas agendadas: ${totals.agendN}`);
  console.log(`  Retornos agendados: ${totals.agendR}`);
  console.log(`  Receita estimada: R$ ${totals.receita.toFixed(2)}`);
  console.log(`  Receita perdida (desist+ghost preço): R$ ${totals.perdida.toFixed(2)}`);
  console.log(`  Desistências: ${totals.desist} | Ghosting: ${totals.ghost}`);
  console.log(`  Urgências: ${totals.urg}`);
  console.log(`  Sentimento: ${totals.sentP} positivos, ${totals.sentN} neutros, ${totals.sentNeg} negativos`);
  console.log(`  ✅ ${snapshots.length} snapshots atualizados no banco`);
}

main().catch((e) => { console.error(e); process.exit(1); });
