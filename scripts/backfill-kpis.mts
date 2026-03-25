/**
 * Backfill de KPIs históricos — preenche daily_kpi_snapshots para todos os dias com dados.
 *
 * Uso: npx tsx --env-file=.env.local scripts/backfill-kpis.mts
 *
 * IMPORTANTE: Rode a migration 20260324_daily_kpi_snapshots.sql ANTES deste script.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

type AnySupabase = any;
const sb: AnySupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

// ═══════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════

function toBRT(utcStr: string): Date {
  const utc = new Date(utcStr);
  return new Date(utc.getTime() - 3 * 60 * 60 * 1000);
}

function dateBRT(utcStr: string): string {
  return toBRT(utcStr).toISOString().slice(0, 10);
}

async function fetchAll(table: string, select: string): Promise<any[]> {
  const rows: any[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await sb
      .from(table)
      .select(select)
      .order("created_at", { ascending: true })
      .range(offset, offset + 999);
    if (error) { console.error(`Erro ${table}:`, error.message); break; }
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < 1000) break;
    offset += 1000;
  }
  return rows;
}

// ═══════════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════════

async function main() {
  console.log("\n" + "═".repeat(60));
  console.log("  BACKFILL DE KPIs HISTÓRICOS");
  console.log("═".repeat(60) + "\n");

  // 1. Carregar TODOS os dados
  console.log("Carregando dados completos...");
  const msgs = await fetchAll("chat_messages", "id,chat_id,sender,created_at,message_text");
  const chats = await fetchAll("chats", "id,created_at,contact_name,phone");
  const appts = await fetchAll("appointments", "id,created_at,status,total_amount,appointment_type,patient_name,chat_id,start_time");
  const insights = await fetchAll("chat_insights", "id,chat_id,objecao_principal,sentimento,nota_atendimento,decisao,topico,resumo_analise,created_at");

  console.log(`  Mensagens: ${msgs.length}`);
  console.log(`  Chats: ${chats.length}`);
  console.log(`  Agendamentos: ${appts.length}`);
  console.log(`  Insights: ${insights.length}`);

  // 2. Indexar por dia (BRT)
  const msgsByDay: Record<string, typeof msgs> = {};
  msgs.forEach((m: any) => {
    const d = dateBRT(m.created_at);
    if (!msgsByDay[d]) msgsByDay[d] = [];
    msgsByDay[d].push(m);
  });

  const chatsByDay: Record<string, typeof chats> = {};
  chats.forEach((c: any) => {
    const d = dateBRT(c.created_at);
    if (!chatsByDay[d]) chatsByDay[d] = [];
    chatsByDay[d].push(c);
  });

  const apptsByDay: Record<string, typeof appts> = {};
  appts.forEach((a: any) => {
    const d = dateBRT(a.created_at);
    if (!apptsByDay[d]) apptsByDay[d] = [];
    apptsByDay[d].push(a);
  });

  // Index insights by chat_id for lookup
  const insightsByChat: Record<number, any> = {};
  insights.forEach((i: any) => { insightsByChat[i.chat_id] = i; });

  // 3. Determinar range de dias
  const allDays = new Set<string>();
  Object.keys(msgsByDay).forEach((d) => allDays.add(d));
  Object.keys(chatsByDay).forEach((d) => allDays.add(d));
  Object.keys(apptsByDay).forEach((d) => allDays.add(d));

  const sortedDays = [...allDays].sort();
  console.log(`\nPeríodo: ${sortedDays[0]} a ${sortedDays[sortedDays.length - 1]}`);
  console.log(`Total de dias com dados: ${sortedDays.length}\n`);

  // 4. Computar KPIs para cada dia
  const snapshots: any[] = [];

  for (const day of sortedDays) {
    const dayMsgs = msgsByDay[day] || [];
    const dayChats = chatsByDay[day] || [];
    const dayAppts = apptsByDay[day] || [];

    // Chats ativos no dia (que tiveram mensagem)
    const activeChatIds = new Set(dayMsgs.map((m: any) => m.chat_id));

    // --- RECEITA ---
    const realAppts = dayAppts.filter((a: any) => !a.patient_name?.includes("teste") && !a.patient_name?.includes("Agendamento de teste"));
    const consultasNovas = realAppts.filter((a: any) => a.appointment_type === "consulta");
    const retornos = realAppts.filter((a: any) => a.appointment_type === "retorno");
    const receitaConfirmada = realAppts.reduce((s: number, a: any) => s + parseFloat(a.total_amount || 0), 0);
    const ticketMedio = consultasNovas.length > 0
      ? consultasNovas.filter((a: any) => parseFloat(a.total_amount || 0) > 0).reduce((s: number, a: any) => s + parseFloat(a.total_amount), 0) / Math.max(1, consultasNovas.filter((a: any) => parseFloat(a.total_amount || 0) > 0).length)
      : 0;

    // --- FUNIL ---
    const novosContatos = dayChats.length;
    const chatsComHumano = new Set(dayMsgs.filter((m: any) => m.sender === "HUMAN_AGENT").map((m: any) => m.chat_id));
    const chatsComCustomer = new Set(dayMsgs.filter((m: any) => m.sender === "CUSTOMER").map((m: any) => m.chat_id));
    const chatsSemResposta = [...chatsComCustomer].filter((id) => !chatsComHumano.has(id));
    const taxaResposta = chatsComCustomer.size > 0 ? (chatsComHumano.size / chatsComCustomer.size) * 100 : 0;
    const taxaConversao = activeChatIds.size > 0 ? (realAppts.length / activeChatIds.size) * 100 : 0;

    // Tempo médio de resposta (1ª msg CUSTOMER → 1ª msg HUMAN_AGENT no mesmo chat)
    const tempos: number[] = [];
    for (const chatId of chatsComHumano) {
      const chatMsgs = dayMsgs.filter((m: any) => m.chat_id === chatId);
      const firstCustomer = chatMsgs.find((m: any) => m.sender === "CUSTOMER");
      const firstHuman = chatMsgs.find((m: any) => m.sender === "HUMAN_AGENT");
      if (firstCustomer && firstHuman) {
        const diff = (new Date(firstHuman.created_at).getTime() - new Date(firstCustomer.created_at).getTime()) / 60000;
        if (diff > 0 && diff < 1440) tempos.push(diff); // ignorar >24h
      }
    }
    const tempoMedioResposta = tempos.length > 0 ? tempos.reduce((a, b) => a + b, 0) / tempos.length : null;

    // --- OBJEÇÕES (do chat_insights existente) ---
    let objecaoPreco = 0, objecaoVaga = 0, objecaoDistancia = 0, objecaoEspecialidade = 0, ghostingPosPreco = 0;
    let sentPositivo = 0, sentNeutro = 0, sentNegativo = 0;
    let urgenciasIdentificadas = 0;

    for (const chatId of activeChatIds) {
      const insight = insightsByChat[chatId];
      if (!insight) continue;

      const obj = (insight.objecao_principal || "").toLowerCase();
      if (obj.includes("preço") || obj.includes("preco") || obj.includes("valor") || obj.includes("preço elevado") || obj.includes("preço alto")) objecaoPreco++;
      if (obj.includes("vaga") || obj.includes("disponibilidade") || obj.includes("indisponibilidade") || obj.includes("horário") || obj.includes("horario")) objecaoVaga++;
      if (obj.includes("distância") || obj.includes("distancia") || obj.includes("transporte") || obj.includes("deslocamento") || obj.includes("geografica")) objecaoDistancia++;
      if (obj.includes("especialidade") || obj.includes("alergista") || obj.includes("medico") || obj.includes("médico")) objecaoEspecialidade++;

      const sent = (insight.sentimento || "").toLowerCase();
      if (sent === "positivo") sentPositivo++;
      if (sent === "neutro") sentNeutro++;
      if (sent === "negativo") sentNegativo++;
    }

    // Ghosting pós-preço: última msg da clínica menciona R$ e paciente não respondeu
    for (const chatId of activeChatIds) {
      const chatMsgs = dayMsgs.filter((m: any) => m.chat_id === chatId).sort((a: any, b: any) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      if (chatMsgs.length < 2) continue;
      const lastMsg = chatMsgs[chatMsgs.length - 1];
      const secondLast = chatMsgs[chatMsgs.length - 2];
      if (
        lastMsg.sender === "HUMAN_AGENT" &&
        (lastMsg.message_text || "").match(/R\$\s*\d/) &&
        secondLast.sender === "CUSTOMER"
      ) {
        ghostingPosPreco++;
      }
    }

    // Urgências: mensagens com termos de urgência
    const urgencyTerms = /urgente|emergência|emergencia|febre\s+alt|vomit|desidrat|encaixe\s+urgente|desesper/i;
    const urgencyChats = new Set<number>();
    for (const m of dayMsgs) {
      if (m.sender === "CUSTOMER" && urgencyTerms.test(m.message_text || "")) {
        urgencyChats.add(m.chat_id);
      }
    }
    urgenciasIdentificadas = urgencyChats.size;
    const urgenciasAtendidas = [...urgencyChats].filter((id) =>
      dayAppts.some((a: any) => a.chat_id === id) || chatsComHumano.has(id)
    ).length;

    // --- OPERACIONAL ---
    const msgsPerChat: number[] = [];
    for (const chatId of activeChatIds) {
      msgsPerChat.push(dayMsgs.filter((m: any) => m.chat_id === chatId).length);
    }
    const msgsPorChatMedia = msgsPerChat.length > 0 ? msgsPerChat.reduce((a, b) => a + b, 0) / msgsPerChat.length : 0;

    // Chats fora do horário (antes 8h ou depois 18h BRT)
    const foraHorario = new Set<number>();
    for (const m of dayMsgs) {
      if (m.sender !== "CUSTOMER") continue;
      const brt = toBRT(m.created_at);
      const h = brt.getHours();
      if (h < 8 || h >= 18) foraHorario.add(m.chat_id);
    }

    // --- RECEITA POTENCIAL PERDIDA ---
    // Chats onde paciente mandou msg mas não agendou (excluindo retornos)
    const chatsQueAgendaram = new Set(dayAppts.map((a: any) => a.chat_id).filter(Boolean));
    const chatsAtivosNaoAgendaram = [...chatsComCustomer].filter((id) => !chatsQueAgendaram.has(id));
    const receitaPotencialPerdida = chatsAtivosNaoAgendaram.length * 500; // ticket R$500

    // --- DETAILS (drill-down) ---
    const topObjecoes: any[] = [];
    const objecoesMap: Record<string, number> = {};
    for (const chatId of activeChatIds) {
      const insight = insightsByChat[chatId];
      if (insight?.objecao_principal) {
        objecoesMap[insight.objecao_principal] = (objecoesMap[insight.objecao_principal] || 0) + 1;
      }
    }
    Object.entries(objecoesMap).sort((a, b) => b[1] - a[1]).slice(0, 5).forEach(([type, count]) => {
      topObjecoes.push({ type, count });
    });

    const snapshot = {
      date: day,
      receita_confirmada: receitaConfirmada,
      receita_potencial_perdida: receitaPotencialPerdida,
      ticket_medio: ticketMedio,
      agendamentos_novos: consultasNovas.length,
      agendamentos_retorno: retornos.length,
      novos_contatos: novosContatos,
      chats_com_resposta: chatsComHumano.size,
      chats_sem_resposta: chatsSemResposta.length,
      taxa_resposta: Math.round(taxaResposta * 100) / 100,
      tempo_medio_resposta_min: tempoMedioResposta ? Math.round(tempoMedioResposta * 100) / 100 : null,
      taxa_conversao: Math.round(taxaConversao * 100) / 100,
      objecao_preco: objecaoPreco,
      objecao_vaga: objecaoVaga,
      objecao_distancia: objecaoDistancia,
      objecao_especialidade: objecaoEspecialidade,
      ghosting_pos_preco: ghostingPosPreco,
      msgs_por_chat_media: Math.round(msgsPorChatMedia * 10) / 10,
      chats_fora_horario: foraHorario.size,
      urgencias_identificadas: urgenciasIdentificadas,
      urgencias_atendidas: urgenciasAtendidas,
      sentimento_positivo: sentPositivo,
      sentimento_neutro: sentNeutro,
      sentimento_negativo: sentNegativo,
      total_chats_analisados: activeChatIds.size,
      total_mensagens: dayMsgs.length,
      computed_at: new Date().toISOString(),
      details: {
        top_objections: topObjecoes,
        urgencias: [...urgencyChats].map((id) => {
          const chat = chats.find((c: any) => c.id === id);
          return { chat_id: id, contact_name: chat?.contact_name || "?" };
        }),
      },
    };

    snapshots.push(snapshot);

    // Log resumo do dia
    const hasData = dayMsgs.length > 5;
    if (hasData) {
      console.log(
        `${day} | ${String(dayMsgs.length).padStart(4)} msgs | ${String(activeChatIds.size).padStart(3)} chats | ` +
        `${String(realAppts.length).padStart(2)} agend | R$${String(receitaConfirmada).padStart(6)} | ` +
        `resp: ${taxaResposta.toFixed(0)}% | conv: ${taxaConversao.toFixed(0)}% | ` +
        `obj_preço: ${objecaoPreco} | obj_vaga: ${objecaoVaga} | urgências: ${urgenciasIdentificadas}`
      );
    }
  }

  // 5. Inserir no banco
  console.log(`\nInserindo ${snapshots.length} snapshots no banco...`);

  for (const snap of snapshots) {
    const { error } = await sb.from("daily_kpi_snapshots").upsert(snap, { onConflict: "date" });
    if (error) {
      console.error(`Erro ${snap.date}:`, error.message);
    }
  }

  console.log("✅ Backfill completo!");

  // 6. Sumário
  console.log("\n" + "═".repeat(60));
  console.log("  SUMÁRIO GERAL");
  console.log("═".repeat(60));

  const totalReceita = snapshots.reduce((s, snap) => s + (snap.receita_confirmada || 0), 0);
  const totalAgend = snapshots.reduce((s, snap) => s + snap.agendamentos_novos + snap.agendamentos_retorno, 0);
  const totalMsgs = snapshots.reduce((s, snap) => s + snap.total_mensagens, 0);
  const totalNovos = snapshots.reduce((s, snap) => s + snap.novos_contatos, 0);
  const totalPreco = snapshots.reduce((s, snap) => s + snap.objecao_preco, 0);
  const totalVaga = snapshots.reduce((s, snap) => s + snap.objecao_vaga, 0);
  const totalUrg = snapshots.reduce((s, snap) => s + snap.urgencias_identificadas, 0);

  console.log(`Período: ${sortedDays[0]} a ${sortedDays[sortedDays.length - 1]}`);
  console.log(`Dias com dados: ${snapshots.length}`);
  console.log(`Total mensagens: ${totalMsgs}`);
  console.log(`Novos contatos: ${totalNovos}`);
  console.log(`Agendamentos: ${totalAgend}`);
  console.log(`Receita confirmada: R$ ${totalReceita.toFixed(2)}`);
  console.log(`Objeções preço: ${totalPreco}`);
  console.log(`Objeções vaga: ${totalVaga}`);
  console.log(`Urgências: ${totalUrg}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
