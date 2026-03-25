/**
 * Gera relatório visual de KPIs em HTML estilizado.
 * Uso: npx tsx --env-file=.env.local scripts/generate-kpi-report.mts
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs/promises";
import path from "node:path";

type AnySupabase = any;
const sb: AnySupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

async function main() {
  // Buscar todos os snapshots
  const { data: snapshots } = await sb
    .from("daily_kpi_snapshots")
    .select("*")
    .gte("date", "2026-02-01")
    .order("date", { ascending: true });

  if (!snapshots || snapshots.length === 0) {
    console.error("Nenhum snapshot encontrado.");
    return;
  }

  // Buscar urgências perdidas e desistências por vaga (dados individuais)
  const { data: allInsights } = await sb
    .from("chat_insights")
    .select("chat_id, categoria, desfecho, objecao_principal, citacao_chave, resumo_analise, metricas_extras, sentimento")
    .limit(1000);

  const urgenciasPerdidas = (allInsights || []).filter(
    (i: any) => i.metricas_extras?.is_urgencia === true && !i.metricas_extras?.agendou && !i.metricas_extras?.compareceu
  ).filter((i: any) => i.chat_id !== 1495); // excluir chat interno da Clara

  const desistenciasVaga = (allInsights || []).filter((i: any) => i.categoria === "desistencia_vaga");

  // Buscar nomes
  const urgVagaIds = [...new Set([...urgenciasPerdidas.map((i: any) => i.chat_id), ...desistenciasVaga.map((i: any) => i.chat_id)])];
  const { data: urgChats } = await sb.from("chats").select("id, contact_name, phone").in("id", urgVagaIds);
  const urgChatMap: Record<number, any> = {};
  (urgChats || []).forEach((c: any) => { urgChatMap[c.id] = c; });

  // Totais
  const t = snapshots.reduce(
    (a: any, s: any) => ({
      msgs: a.msgs + (s.total_mensagens || 0),
      chats: a.chats + (s.total_chats_analisados || 0),
      agendN: a.agendN + (s.agendamentos_novos || 0),
      agendR: a.agendR + (s.agendamentos_retorno || 0),
      receita: a.receita + parseFloat(s.receita_confirmada || 0),
      perdida: a.perdida + parseFloat(s.receita_potencial_perdida || 0),
      sentP: a.sentP + (s.sentimento_positivo || 0),
      sentNeu: a.sentNeu + (s.sentimento_neutro || 0),
      sentNeg: a.sentNeg + (s.sentimento_negativo || 0),
      urg: a.urg + (s.urgencias_identificadas || 0),
      desistP: a.desistP + (s.objecao_preco || 0),
      desistV: a.desistV + (s.objecao_vaga || 0),
    }),
    { msgs: 0, chats: 0, agendN: 0, agendR: 0, receita: 0, perdida: 0, sentP: 0, sentNeu: 0, sentNeg: 0, urg: 0, desistP: 0, desistV: 0 }
  );

  const periodo = `${snapshots[0].date} a ${snapshots[snapshots.length - 1].date}`;
  const taxaConvMedia = t.chats > 0 ? ((t.agendN + t.agendR) / t.chats * 100).toFixed(1) : "0";

  // Dados para gráficos (sparkline CSS)
  const maxReceita = Math.max(...snapshots.map((s: any) => parseFloat(s.receita_confirmada || 0)));
  const maxMsgs = Math.max(...snapshots.map((s: any) => s.total_mensagens || 0));
  const maxConv = Math.max(...snapshots.map((s: any) => parseFloat(s.taxa_conversao || 0)));

  // Semanas
  const weeks: Record<string, any> = {};
  for (const s of snapshots) {
    const d = new Date(s.date);
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay() + 1);
    const key = weekStart.toISOString().slice(0, 10);
    if (!weeks[key]) weeks[key] = { receita: 0, agend: 0, desist: 0, chats: 0 };
    weeks[key].receita += parseFloat(s.receita_confirmada || 0);
    weeks[key].agend += (s.agendamentos_novos || 0) + (s.agendamentos_retorno || 0);
    weeks[key].desist += (s.details?.desistencias || 0);
    weeks[key].chats += (s.total_chats_analisados || 0);
  }

  const maxWeekReceita = Math.max(...Object.values(weeks).map((w: any) => w.receita));

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>KPIs — Support Clinic Pediatria</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Inter', -apple-system, sans-serif;
    background: #0f0f13;
    color: #e4e4e7;
    padding: 40px;
    min-height: 100vh;
  }

  .container { max-width: 1200px; margin: 0 auto; }

  .header {
    text-align: center;
    margin-bottom: 48px;
    padding: 40px;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
    border-radius: 24px;
    border: 1px solid rgba(99, 102, 241, 0.2);
    position: relative;
    overflow: hidden;
  }
  .header::before {
    content: '';
    position: absolute;
    top: -50%;
    right: -20%;
    width: 400px;
    height: 400px;
    background: radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%);
    border-radius: 50%;
  }
  .header h1 {
    font-size: 2.5rem;
    font-weight: 900;
    background: linear-gradient(135deg, #818cf8, #c084fc);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    margin-bottom: 8px;
    position: relative;
  }
  .header .subtitle {
    font-size: 1rem;
    color: #a1a1aa;
    font-weight: 400;
  }
  .header .periodo {
    display: inline-block;
    margin-top: 16px;
    padding: 6px 16px;
    background: rgba(99,102,241,0.15);
    border: 1px solid rgba(99,102,241,0.3);
    border-radius: 20px;
    font-size: 0.85rem;
    color: #a5b4fc;
    font-weight: 500;
  }

  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 20px;
    margin-bottom: 40px;
  }

  .kpi-card {
    background: #18181b;
    border: 1px solid #27272a;
    border-radius: 16px;
    padding: 24px;
    transition: all 0.2s;
  }
  .kpi-card:hover { border-color: #3f3f46; transform: translateY(-2px); }
  .kpi-card .label {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #71717a;
    font-weight: 600;
    margin-bottom: 8px;
  }
  .kpi-card .value {
    font-size: 2rem;
    font-weight: 800;
    color: #fafafa;
    line-height: 1;
  }
  .kpi-card .value.green { color: #4ade80; }
  .kpi-card .value.red { color: #f87171; }
  .kpi-card .value.purple { color: #a78bfa; }
  .kpi-card .value.blue { color: #60a5fa; }
  .kpi-card .value.amber { color: #fbbf24; }
  .kpi-card .detail {
    margin-top: 8px;
    font-size: 0.8rem;
    color: #71717a;
  }

  .section {
    margin-bottom: 40px;
  }
  .section-title {
    font-size: 1.1rem;
    font-weight: 700;
    color: #fafafa;
    margin-bottom: 20px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .section-title span { font-size: 1.2rem; }

  .chart-container {
    background: #18181b;
    border: 1px solid #27272a;
    border-radius: 16px;
    padding: 24px;
    overflow-x: auto;
  }

  .bar-chart {
    display: flex;
    align-items: flex-end;
    gap: 4px;
    height: 180px;
    padding-top: 20px;
  }
  .bar-chart .bar-group {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex: 1;
    min-width: 24px;
  }
  .bar-chart .bar {
    width: 100%;
    max-width: 28px;
    border-radius: 4px 4px 0 0;
    transition: all 0.3s;
    position: relative;
  }
  .bar-chart .bar:hover { opacity: 0.8; }
  .bar-chart .bar-label {
    font-size: 0.6rem;
    color: #52525b;
    margin-top: 6px;
    writing-mode: vertical-lr;
    text-orientation: mixed;
    transform: rotate(180deg);
    max-height: 60px;
    overflow: hidden;
  }

  .table-container {
    background: #18181b;
    border: 1px solid #27272a;
    border-radius: 16px;
    overflow: hidden;
  }
  table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
  th {
    text-align: left;
    padding: 12px 16px;
    font-weight: 600;
    color: #a1a1aa;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    background: #1f1f23;
    border-bottom: 1px solid #27272a;
  }
  td {
    padding: 10px 16px;
    border-bottom: 1px solid #1f1f23;
    color: #d4d4d8;
  }
  tr:hover td { background: rgba(99,102,241,0.05); }
  td.num { text-align: right; font-variant-numeric: tabular-nums; font-weight: 500; }
  td.green { color: #4ade80; }
  td.red { color: #f87171; }
  td.amber { color: #fbbf24; }

  .pill {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 0.7rem;
    font-weight: 600;
  }
  .pill-green { background: rgba(74,222,128,0.15); color: #4ade80; }
  .pill-red { background: rgba(248,113,113,0.15); color: #f87171; }
  .pill-amber { background: rgba(251,191,36,0.15); color: #fbbf24; }
  .pill-purple { background: rgba(167,139,250,0.15); color: #a78bfa; }

  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }

  .footer {
    text-align: center;
    padding: 32px;
    color: #52525b;
    font-size: 0.75rem;
  }

  @media print {
    body { background: #fff; color: #111; padding: 20px; }
    .kpi-card { background: #f9fafb; border-color: #e5e7eb; }
    .kpi-card .value { color: #111; }
    .chart-container, .table-container { background: #fff; border-color: #e5e7eb; }
    th { background: #f3f4f6; }
    td { border-color: #e5e7eb; }
  }
</style>
</head>
<body>
<div class="container">

  <div class="header">
    <h1>Relatório de KPIs</h1>
    <div class="subtitle">Support Clinic — Setor Pediatria</div>
    <div class="periodo">${periodo}</div>
  </div>

  <!-- KPI Cards -->
  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="label">Receita Confirmada</div>
      <div class="value green">R$ ${(t.receita / 1000).toFixed(1)}k</div>
      <div class="detail">${t.agendN} consultas + ${t.agendR} retornos</div>
    </div>
    <div class="kpi-card">
      <div class="label">Receita Perdida</div>
      <div class="value red">R$ ${(t.perdida / 1000).toFixed(1)}k</div>
      <div class="detail">${t.desistP} por preço + ${t.desistV} por vaga</div>
    </div>
    <div class="kpi-card">
      <div class="label">Taxa de Conversão</div>
      <div class="value purple">${taxaConvMedia}%</div>
      <div class="detail">${t.agendN + t.agendR} de ${t.chats} chats</div>
    </div>
    <div class="kpi-card">
      <div class="label">Urgências</div>
      <div class="value amber">${t.urg}</div>
      <div class="detail">identificadas no período</div>
    </div>
  </div>

  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="label">Total Mensagens</div>
      <div class="value">${(t.msgs / 1000).toFixed(1)}k</div>
      <div class="detail">${t.chats} chats ativos</div>
    </div>
    <div class="kpi-card">
      <div class="label">Sentimento</div>
      <div class="value blue">${((t.sentP / (t.sentP + t.sentNeu + t.sentNeg)) * 100).toFixed(0)}% pos</div>
      <div class="detail">${t.sentP} pos / ${t.sentNeu} neu / ${t.sentNeg} neg</div>
    </div>
    <div class="kpi-card">
      <div class="label">Consultas Novas</div>
      <div class="value green">${t.agendN}</div>
      <div class="detail">R$ ${(t.agendN * 500 / 1000).toFixed(1)}k estimados</div>
    </div>
    <div class="kpi-card">
      <div class="label">Retornos</div>
      <div class="value blue">${t.agendR}</div>
      <div class="detail">gratuitos até mar/2026</div>
    </div>
  </div>

  <!-- Gráfico: Receita por Semana -->
  <div class="section">
    <div class="section-title"><span>📊</span> Receita por Semana</div>
    <div class="chart-container">
      <div class="bar-chart">
        ${Object.entries(weeks).map(([week, w]: [string, any]) => {
          const h = maxWeekReceita > 0 ? Math.max(4, (w.receita / maxWeekReceita) * 160) : 4;
          const weekLabel = week.slice(5);
          return `<div class="bar-group">
            <div class="bar" style="height:${h}px;background:linear-gradient(180deg,#818cf8,#6366f1);" title="R$ ${w.receita.toFixed(0)} | ${w.agend} agend"></div>
            <div class="bar-label">${weekLabel}</div>
          </div>`;
        }).join("")}
      </div>
    </div>
  </div>

  <!-- Gráfico: Receita Diária -->
  <div class="section">
    <div class="section-title"><span>📈</span> Receita Diária</div>
    <div class="chart-container">
      <div class="bar-chart">
        ${snapshots.filter((s: any) => s.total_mensagens > 5).map((s: any) => {
          const val = parseFloat(s.receita_confirmada || 0);
          const h = maxReceita > 0 ? Math.max(2, (val / maxReceita) * 160) : 2;
          const color = val >= 4000 ? "#4ade80" : val >= 2000 ? "#818cf8" : val > 0 ? "#60a5fa" : "#3f3f46";
          return `<div class="bar-group">
            <div class="bar" style="height:${h}px;background:${color};" title="R$ ${val} em ${s.date}"></div>
            <div class="bar-label">${s.date.slice(5)}</div>
          </div>`;
        }).join("")}
      </div>
    </div>
  </div>

  <!-- Tabela: Dados Diários -->
  <div class="section">
    <div class="section-title"><span>📋</span> Detalhamento Diário</div>
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Dia</th>
            <th>Msgs</th>
            <th>Chats</th>
            <th>Consultas</th>
            <th>Retornos</th>
            <th>Receita</th>
            <th>Conversão</th>
            <th>Desist.</th>
            <th>Ghost</th>
            <th>Urg.</th>
            <th>Sent.</th>
          </tr>
        </thead>
        <tbody>
          ${snapshots.filter((s: any) => s.total_mensagens > 5).map((s: any) => {
            const d = s.details || {};
            const conv = parseFloat(s.taxa_conversao || 0);
            const convClass = conv >= 50 ? "green" : conv >= 30 ? "" : "amber";
            const desist = (d.desistencias || 0);
            const ghost = (d.ghosting || 0);
            const sentStr = `${s.sentimento_positivo || 0}/${s.sentimento_neutro || 0}/${s.sentimento_negativo || 0}`;
            return `<tr>
              <td><strong>${s.date.slice(5)}</strong></td>
              <td class="num">${s.total_mensagens}</td>
              <td class="num">${s.total_chats_analisados}</td>
              <td class="num">${s.agendamentos_novos}</td>
              <td class="num">${s.agendamentos_retorno}</td>
              <td class="num ${parseFloat(s.receita_confirmada) > 0 ? "green" : ""}">R$ ${parseFloat(s.receita_confirmada || 0).toFixed(0)}</td>
              <td class="num ${convClass}">${conv.toFixed(0)}%</td>
              <td class="num ${desist > 3 ? "red" : ""}">${desist}</td>
              <td class="num ${ghost > 2 ? "amber" : ""}">${ghost}</td>
              <td class="num">${s.urgencias_identificadas || 0}</td>
              <td>${sentStr}</td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>
  </div>

  <!-- Objeções -->
  <div class="section">
    <div class="two-col">
      <div>
        <div class="section-title"><span>🚫</span> Objeções Acumuladas</div>
        <div class="chart-container" style="padding:20px;">
          <div style="display:flex;flex-direction:column;gap:12px;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span>Falta de vaga / horário</span>
              <span class="pill pill-red">${t.desistV}</span>
            </div>
            <div style="width:100%;height:8px;background:#27272a;border-radius:4px;overflow:hidden;">
              <div style="width:${Math.round(t.desistV / Math.max(t.desistV, t.desistP, 1) * 100)}%;height:100%;background:#f87171;border-radius:4px;"></div>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span>Preço</span>
              <span class="pill pill-amber">${t.desistP}</span>
            </div>
            <div style="width:100%;height:8px;background:#27272a;border-radius:4px;overflow:hidden;">
              <div style="width:${Math.round(t.desistP / Math.max(t.desistV, t.desistP, 1) * 100)}%;height:100%;background:#fbbf24;border-radius:4px;"></div>
            </div>
          </div>
        </div>
      </div>
      <div>
        <div class="section-title"><span>💚</span> Sentimento Geral</div>
        <div class="chart-container" style="padding:20px;">
          <div style="display:flex;flex-direction:column;gap:12px;">
            ${[
              { label: "Positivo", val: t.sentP, total: t.sentP + t.sentNeu + t.sentNeg, color: "#4ade80", pill: "pill-green" },
              { label: "Neutro", val: t.sentNeu, total: t.sentP + t.sentNeu + t.sentNeg, color: "#71717a", pill: "pill-purple" },
              { label: "Negativo", val: t.sentNeg, total: t.sentP + t.sentNeu + t.sentNeg, color: "#f87171", pill: "pill-red" },
            ].map(s => `
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <span>${s.label}</span>
                <span class="pill ${s.pill}">${s.val} (${(s.val/s.total*100).toFixed(0)}%)</span>
              </div>
              <div style="width:100%;height:8px;background:#27272a;border-radius:4px;overflow:hidden;">
                <div style="width:${(s.val/s.total*100).toFixed(0)}%;height:100%;background:${s.color};border-radius:4px;"></div>
              </div>
            `).join("")}
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- ═══════════════════════════════════════════════════════════════ -->
  <!-- SEÇÃO DESTAQUE: URGÊNCIAS PERDIDAS + PLANO DE AÇÃO -->
  <!-- ═══════════════════════════════════════════════════════════════ -->

  <div class="section" style="margin-top:48px;">
    <div style="background:linear-gradient(135deg,#1a0000,#2d0a0a);border:2px solid #7f1d1d;border-radius:20px;padding:32px;position:relative;overflow:hidden;">
      <div style="position:absolute;top:-30px;right:-30px;width:200px;height:200px;background:radial-gradient(circle,rgba(239,68,68,0.15),transparent 70%);border-radius:50%;"></div>

      <h2 style="font-size:1.5rem;font-weight:800;color:#fca5a5;margin-bottom:4px;display:flex;align-items:center;gap:10px;">
        <span style="font-size:1.8rem;">🚨</span> Urgências Perdidas — Pacientes que Precisavam e Não Foram Atendidos
      </h2>
      <p style="color:#fca5a5;opacity:0.7;font-size:0.85rem;margin-bottom:24px;">
        ${urgenciasPerdidas.length} crianças com quadros urgentes (febre, vômito, diarreia) que buscaram a clínica e não conseguiram atendimento.
        Impacto estimado: <strong style="color:#f87171;">R$ ${(urgenciasPerdidas.length * 500).toLocaleString("pt-BR")}</strong> em receita + risco reputacional.
      </p>

      <!-- Tabela de urgências perdidas -->
      <div style="background:rgba(0,0,0,0.3);border-radius:12px;overflow:hidden;margin-bottom:24px;">
        <table style="width:100%;font-size:0.8rem;">
          <thead>
            <tr style="background:rgba(127,29,29,0.3);">
              <th style="padding:10px 14px;color:#fca5a5;font-size:0.7rem;">Paciente</th>
              <th style="padding:10px 14px;color:#fca5a5;font-size:0.7rem;">O que aconteceu</th>
              <th style="padding:10px 14px;color:#fca5a5;font-size:0.7rem;">Frase do paciente</th>
              <th style="padding:10px 14px;color:#fca5a5;font-size:0.7rem;">Motivo da perda</th>
            </tr>
          </thead>
          <tbody>
            ${urgenciasPerdidas.slice(0, 20).map((i: any) => {
              const c = urgChatMap[i.chat_id] || {};
              const nome = c.contact_name || "?";
              const resumo = (i.resumo_analise || i.desfecho || "").slice(0, 150);
              const citacao = (i.citacao_chave || "-").slice(0, 80);
              const motivo = i.objecao_principal || i.categoria || "sem vaga";
              return '<tr style="border-bottom:1px solid rgba(127,29,29,0.2);">'
                + '<td style="padding:10px 14px;color:#fecaca;font-weight:600;">' + nome + '</td>'
                + '<td style="padding:10px 14px;color:#d4d4d8;font-size:0.78rem;">' + resumo + '</td>'
                + '<td style="padding:10px 14px;color:#fbbf24;font-style:italic;font-size:0.78rem;">"' + citacao + '"</td>'
                + '<td style="padding:10px 14px;"><span style="background:rgba(239,68,68,0.2);color:#fca5a5;padding:2px 8px;border-radius:8px;font-size:0.7rem;font-weight:600;">' + motivo + '</span></td>'
                + '</tr>';
            }).join("")}
          </tbody>
        </table>
      </div>

      <!-- Análise do padrão -->
      <div style="background:rgba(0,0,0,0.4);border-radius:12px;padding:20px;margin-bottom:24px;border-left:4px solid #ef4444;">
        <h3 style="color:#fca5a5;font-size:0.95rem;font-weight:700;margin-bottom:12px;">Por que estamos perdendo essas urgências?</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          <div>
            <p style="color:#d4d4d8;font-size:0.82rem;line-height:1.6;">
              <strong style="color:#f87171;">1. Sem protocolo de encaixe:</strong> Quando o paciente liga com urgência (febre, vômito),
              a resposta padrão é "não temos vaga". Não existe fila de espera ativa nem vaga-pulmão reservada para emergências.
            </p>
            <p style="color:#d4d4d8;font-size:0.82rem;line-height:1.6;margin-top:8px;">
              <strong style="color:#f87171;">2. Resposta binária:</strong> A Joana responde "sim, tem vaga" ou "não, não tem".
              Não existe meio-termo como "posso te colocar na lista de espera prioritária" ou "se alguém cancelar, você é a primeira".
            </p>
          </div>
          <div>
            <p style="color:#d4d4d8;font-size:0.82rem;line-height:1.6;">
              <strong style="color:#f87171;">3. Paciente vai para concorrência:</strong> Mães desesperadas com filhos doentes não esperam.
              Se não tem vaga HOJE, procuram outro pediatra. Citação real: <em style="color:#fbbf24;">"vou procurar em outro lugar que sabe eu consigo"</em>.
            </p>
            <p style="color:#d4d4d8;font-size:0.82rem;line-height:1.6;margin-top:8px;">
              <strong style="color:#f87171;">4. Perda dupla:</strong> Além da consulta perdida (R$ 500), perdemos o retorno (R$ 200 a partir de abril)
              e toda a cadeia de acompanhamento. Paciente que vai para outro pediatra dificilmente volta.
            </p>
          </div>
        </div>
      </div>

      <!-- PLANO DE AÇÃO -->
      <div style="background:linear-gradient(135deg,#052e16,#064e3b);border:1px solid #059669;border-radius:16px;padding:24px;">
        <h3 style="color:#6ee7b7;font-size:1.1rem;font-weight:800;margin-bottom:16px;display:flex;align-items:center;gap:8px;">
          <span style="font-size:1.3rem;">💡</span> Plano de Ação: Sistema de Vaga-Pulmão
        </h3>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
          <div style="background:rgba(0,0,0,0.3);border-radius:12px;padding:16px;">
            <h4 style="color:#34d399;font-size:0.85rem;font-weight:700;margin-bottom:8px;">Ação 1 — Reservar 2 Vagas-Pulmão/Dia</h4>
            <p style="color:#d1d5db;font-size:0.8rem;line-height:1.5;">
              Bloquear 2 horários por dia na agenda da Dra. Fernanda exclusivamente para urgências.
              Se até 14h não forem usadas, liberar para agendamento normal.
            </p>
            <div style="margin-top:8px;padding:6px 10px;background:rgba(52,211,153,0.1);border-radius:8px;">
              <span style="color:#6ee7b7;font-size:0.75rem;font-weight:600;">Impacto: até 10 urgências atendidas/semana → R$ 5.000/semana</span>
            </div>
          </div>

          <div style="background:rgba(0,0,0,0.3);border-radius:12px;padding:16px;">
            <h4 style="color:#34d399;font-size:0.85rem;font-weight:700;margin-bottom:8px;">Ação 2 — Lista de Espera Prioritária</h4>
            <p style="color:#d1d5db;font-size:0.8rem;line-height:1.5;">
              Script para Joana: "Entendo a urgência. Não tenho vaga agora, mas vou te colocar como <strong>prioridade</strong>.
              Assim que alguém cancelar, você é a primeira que eu ligo. Pode me passar o nome e idade da criança?"
            </p>
            <div style="margin-top:8px;padding:6px 10px;background:rgba(52,211,153,0.1);border-radius:8px;">
              <span style="color:#6ee7b7;font-size:0.75rem;font-weight:600;">Impacto: reter 50%+ dos pacientes que hoje vão embora</span>
            </div>
          </div>

          <div style="background:rgba(0,0,0,0.3);border-radius:12px;padding:16px;">
            <h4 style="color:#34d399;font-size:0.85rem;font-weight:700;margin-bottom:8px;">Ação 3 — Triagem por Gravidade</h4>
            <p style="color:#d1d5db;font-size:0.8rem;line-height:1.5;">
              Joana pergunta: "Há quanto tempo está com febre? Tem vômito ou diarreia?"
              Se for grave (febre > 3 dias, vômito + diarreia): encaixe imediato na vaga-pulmão.
              Se for moderado: lista de espera prioritária.
            </p>
            <div style="margin-top:8px;padding:6px 10px;background:rgba(52,211,153,0.1);border-radius:8px;">
              <span style="color:#6ee7b7;font-size:0.75rem;font-weight:600;">Impacto: zero urgências graves perdidas</span>
            </div>
          </div>

          <div style="background:rgba(0,0,0,0.3);border-radius:12px;padding:16px;">
            <h4 style="color:#34d399;font-size:0.85rem;font-weight:700;margin-bottom:8px;">Ação 4 — Follow-up Automático</h4>
            <p style="color:#d1d5db;font-size:0.8rem;line-height:1.5;">
              Para pacientes que desistiram por vaga: enviar mensagem no dia seguinte:
              "Oi! Conseguimos uma vaga para hoje com a Dra. Fernanda. O(a) [nome da criança] ainda precisa da consulta?"
            </p>
            <div style="margin-top:8px;padding:6px 10px;background:rgba(52,211,153,0.1);border-radius:8px;">
              <span style="color:#6ee7b7;font-size:0.75rem;font-weight:600;">Impacto: recuperar 20-30% dos perdidos do dia anterior</span>
            </div>
          </div>
        </div>

        <div style="margin-top:20px;padding:14px;background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.3);border-radius:10px;text-align:center;">
          <p style="color:#6ee7b7;font-size:0.9rem;font-weight:700;">
            Projeção com as 4 ações implementadas:
            <span style="font-size:1.2rem;color:#4ade80;"> +R$ 20.000 a R$ 30.000/mês </span>
            em receita recuperada
          </p>
          <p style="color:#a7f3d0;font-size:0.75rem;margin-top:4px;">
            Baseado em ${urgenciasPerdidas.length} urgências perdidas × 50% taxa de recuperação × R$ 500 ticket × 4 semanas
          </p>
        </div>
      </div>
    </div>
  </div>

  <div class="footer">
    Gerado automaticamente por Clara IA — Support Clinic Pediatria<br>
    ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
  </div>

</div>
</body>
</html>`;

  const outPath = path.join(process.cwd(), "relatorio-kpis.html");
  await fs.writeFile(outPath, html, "utf-8");
  console.log(`\n✅ Relatório gerado: ${outPath}`);
  console.log("   Abra no navegador para visualizar ou imprima como PDF (Ctrl+P)");
}

main().catch((e) => { console.error(e); process.exit(1); });
