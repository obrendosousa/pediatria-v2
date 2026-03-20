/**
 * Bateria de Testes de Precisão em Volume — Clara 2.0
 *
 * 10 testes: do detalhe granular (1 dia, 1 chat, 1 remetente)
 * até análises globais (mês inteiro, comparação de semanas, picos).
 *
 * Uso: npx tsx scripts/test-clara-precision.ts
 */

import "dotenv/config";
import { HumanMessage } from "@langchain/core/messages";
import { claraGraph } from "../src/ai/clara/graph";

const TEST_CHAT_ID = 1495;
const THREAD_PREFIX = `vol-${Date.now()}`;

interface TestCase {
  id: string;
  tag: string;
  question: string;
  validate: (r: string) => { pass: boolean; detail: string };
}

function gq(text: string): string {
  return `[MODO COPILOTO — CONSULTA GLOBAL]\nVocê é a Clara, assistente de IA da clínica. O usuário fez uma pergunta GLOBAL sobre a clínica.\n\nPERGUNTA DO USUÁRIO: ${text}\n\nINSTRUÇÕES: Use suas ferramentas para buscar dados de TODO o banco. Não limite a um paciente específico.`;
}

function n(r: string): number[] {
  return (r.match(/\d[\d.,]*\d|\d+/g) || []).map((s) => Number(s.replace(/[.,]/g, "")));
}

function close(arr: number[], target: number, pct = 5): boolean {
  return arr.some((v) => Math.abs(v - target) <= target * (pct / 100));
}

// ─────────────────────────────────────────────────────────────────────────────
// DADOS DE REFERÊNCIA (extraídos do banco via REST antes dos testes)
// Março 2026 (01-20):
//   01:14/3  02:217/33  03:388/40  04:424/34  05:304/35  06:338/31
//   07:77/16 08:0/0     09:274/30  10:208/24  11:86/18   12:140/25
//   13:163/26 14:108/22 15:2/2     16:335/33  17:332/49  18:369/38
//   19:157/26 20:312/35
// Sender 18/03: pac=211 sec=158
// Chat 231 (Andreza Huete) semana 16-20: 55 msgs
// Semana 01-07: 1762 msgs | Semana 16-20: ~1505 msgs
// Total mês: 4248
// ─────────────────────────────────────────────────────────────────────────────

const tests: TestCase[] = [
  // ═══ MICRO ═══
  {
    id: "V01", tag: "MICRO_MSG",
    question: gq("Quantas mensagens exatas foram trocadas no dia 04/03/2026? Dê o número."),
    validate: (r) => {
      const ok = close(n(r), 424);
      return { pass: ok, detail: `Esperado: 424 | Achados: ${n(r).filter((x) => x > 50).join(",")}` };
    },
  },
  {
    id: "V02", tag: "MICRO_CHAT",
    question: gq("Quantos chats distintos tiveram pelo menos 1 mensagem no dia 03/03/2026? Número exato."),
    validate: (r) => {
      const ok = close(n(r), 40, 10);
      return { pass: ok, detail: `Esperado: 40 | Achados: ${n(r).filter((x) => x >= 15 && x <= 80).join(",")}` };
    },
  },
  {
    id: "V03", tag: "MICRO_SENDER",
    question: gq("No dia 18/03/2026, quantas mensagens foram de PACIENTES e quantas da SECRETÁRIA? Dois números."),
    validate: (r) => {
      // Senders reais: CUSTOMER=182, contact=29 (ambos são paciente), HUMAN_AGENT=158
      // Clara pode retornar 211 (CUSTOMER+contact) ou 182 (só CUSTOMER) — ambos são aceitáveis
      const vals = n(r);
      const pac = close(vals, 211, 5) || close(vals, 182, 5);
      const sec = close(vals, 158, 5);
      return { pass: pac && sec, detail: `pac=211ou182:${pac ? "✅" : "❌"} sec=158:${sec ? "✅" : "❌"} | ${vals.filter((x) => x > 50).join(",")}` };
    },
  },

  // ═══ DETALHE ═══
  {
    id: "V04", tag: "DETALHE_CHAT",
    question: gq("Quantas mensagens a Andreza Huete (chat 231) trocou entre 16/03 e 20/03? Número exato."),
    validate: (r) => {
      // Real UTC: 55 msgs | Clara usa BRT, timezone pode excluir msgs nos limites = ~46-55
      const vals = n(r);
      const ok = close(vals, 55, 10) || close(vals, 46, 10);
      return { pass: ok, detail: `Esperado: 46-55 | Achados: ${vals.filter((x) => x >= 30 && x <= 80).join(",")}` };
    },
  },

  // ═══ EDGE: dia de baixíssimo volume ═══
  {
    id: "V05", tag: "EDGE_BAIXO",
    question: gq("Quantas mensagens foram trocadas no dia 07/03/2026 (sábado)? E quantos chats ativos? Números exatos."),
    validate: (r) => {
      // Real: 77 mensagens, 16 chats (sábado, volume baixo)
      const vals = n(r);
      const msgs = close(vals, 77, 10);
      const chats = close(vals, 16, 15);
      return { pass: msgs || chats, detail: `msgs≈77:${msgs ? "✅" : "❌"} chats≈16:${chats ? "✅" : "❌"} | ${vals.filter((x) => x >= 10 && x <= 100).join(",")}` };
    },
  },

  // ═══ MÉDIO ═══
  {
    id: "V06", tag: "MEDIO_RANGE",
    question: gq("Volume diário de mensagens dos dias 09, 10 e 11 de março 2026, separado por dia."),
    validate: (r) => {
      const vals = n(r);
      const d9 = close(vals, 274, 5);
      const d10 = close(vals, 208, 5);
      const d11 = close(vals, 86, 10);
      const score = [d9, d10, d11].filter(Boolean).length;
      return { pass: score >= 2, detail: `09=${d9 ? "✅274" : "❌"} 10=${d10 ? "✅208" : "❌"} 11=${d11 ? "✅86" : "❌"} (${score}/3)` };
    },
  },
  {
    id: "V07", tag: "MEDIO_PICO",
    question: gq("Qual o dia com MAIS mensagens em março 2026 (01 a 20/03)? Qual o volume?"),
    validate: (r) => {
      const dia = /0?4[\s/.-]0?3|4 de março|dia 0?4/i.test(r);
      const vol = close(n(r), 424, 5);
      return { pass: dia || vol, detail: `Dia 04/03:${dia ? "✅" : "❌"} Vol 424:${vol ? "✅" : "❌"}` };
    },
  },

  // ═══ COMPARAÇÃO ═══
  {
    id: "V08", tag: "COMPARE_WEEKS",
    question: gq("Compare o volume total de mensagens da semana 01-07/03 com a semana 16-20/03. Qual foi maior e por quantas?"),
    validate: (r) => {
      const vals = n(r);
      const w1 = close(vals, 1762, 8);
      const w3 = close(vals, 1505, 8);
      const w1bigger = /primeira.*mai(or|s)|semana.*1.*mai(or|s)|01.*0?7.*mai(or|s)|1[.,]?76\d/i.test(r);
      return { pass: (w1 || w3) && w1bigger, detail: `S1≈1762:${w1 ? "✅" : "❌"} S3≈1505:${w3 ? "✅" : "❌"} S1>S3:${w1bigger ? "✅" : "❌"}` };
    },
  },

  // ═══ MACRO ═══
  {
    id: "V09", tag: "MACRO_MES",
    question: gq("Total EXATO de mensagens de 01/03 a 20/03/2026."),
    validate: (r) => {
      const ok = close(n(r), 4248, 2);
      return { pass: ok, detail: `Esperado: ~4248 | Achados: ${n(r).filter((x) => x > 1000).join(",")}` };
    },
  },
  {
    id: "V10", tag: "MACRO_RESUMO",
    question: gq("Resumo de volume da semana 16-20/03: total mensagens, total chats ativos, dia de maior pico, e proporção paciente vs secretária."),
    validate: (r) => {
      const vals = n(r);
      const msgs = vals.some((x) => x >= 1400 && x <= 1600);
      const chats = vals.some((x) => x >= 65 && x <= 95);
      const pico = /18[\s/.-]0?3|18 de março|quarta/i.test(r);
      const prop = /paci|55|56|mai(or|s).*paci/i.test(r);
      const score = [msgs, chats, pico, prop].filter(Boolean).length;
      return { pass: score >= 3, detail: `msgs:${msgs ? "✅" : "❌"} chats:${chats ? "✅" : "❌"} pico18:${pico ? "✅" : "❌"} prop:${prop ? "✅" : "❌"} (${score}/4)` };
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────

interface LCMsg {
  _getType?: () => string;
  constructor?: { name?: string };
  content: string | Array<{ text?: string } | string>;
}

function extract(msgs: LCMsg[]): string {
  return msgs
    .filter((m) => m._getType?.() === "ai" || m.constructor?.name === "AIMessage")
    .map((m) => {
      if (typeof m.content === "string") return m.content;
      if (Array.isArray(m.content))
        return m.content.map((p) => (typeof p === "string" ? p : p?.text || "")).join("");
      return "";
    })
    .join("\n");
}

interface Res { id: string; tag: string; pass: boolean; detail: string; ms: number }

async function run(t: TestCase): Promise<Res> {
  const tid = `${THREAD_PREFIX}-${t.id}`;
  const t0 = Date.now();
  const label = t.question.split("PERGUNTA DO USUÁRIO: ")[1]?.split("\n")[0] || "";
  process.stdout.write(`\n─── ${t.id} [${t.tag}] ───\n  ${label.substring(0, 95)}\n`);

  try {
    const res = await claraGraph.invoke(
      {
        messages: [new HumanMessage(t.question)],
        chat_id: TEST_CHAT_ID,
        is_deep_research: false, is_planning_mode: false,
        research_brief: "", raw_notes: [], supervisor_messages: [],
        supervisor_iteration: 0, research_complete: false,
        current_user_role: "admin" as const,
        db_stats: null, loaded_context: null, spot_check_result: null, pending_question: null,
      },
      { configurable: { thread_id: tid }, recursionLimit: 40 },
    );
    const text = extract(Array.isArray(res.messages) ? res.messages : []);
    const ms = Date.now() - t0;
    const v = t.validate(text);
    process.stdout.write(`  ${(ms / 1000).toFixed(1)}s │ ${v.pass ? "✅" : "❌"} ${v.detail}\n`);
    return { id: t.id, tag: t.tag, pass: v.pass, detail: v.detail, ms };
  } catch (err: unknown) {
    const ms = Date.now() - t0;
    const msg = err instanceof Error ? err.message : String(err);
    process.stdout.write(`  ❌ ERRO: ${msg.substring(0, 120)}\n`);
    return { id: t.id, tag: t.tag, pass: false, detail: `ERRO: ${msg.substring(0, 120)}`, ms };
  }
}

async function main() {
  process.stdout.write(`
╔═══════════════════════════════════════════════════════════════════╗
║  VOLUME PRECISION TEST — CLARA 2.0 — 10 testes                  ║
║  MICRO (msg/chat/sender) → MÉDIO (range/pico) → MACRO (mês)     ║
╚═══════════════════════════════════════════════════════════════════╝\n`);

  const results: Res[] = [];
  for (const t of tests) results.push(await run(t));

  const ok = results.filter((r) => r.pass).length;
  process.stdout.write(`\n${"═".repeat(60)}\n  SCORECARD: ${ok}/${results.length} (${((ok / results.length) * 100).toFixed(0)}%)\n${"═".repeat(60)}\n`);
  for (const r of results) process.stdout.write(`  ${r.pass ? "✅" : "❌"} ${r.id} [${r.tag}] ${r.detail.substring(0, 65)}\n`);
  const sec = results.reduce((s, r) => s + r.ms, 0) / 1000;
  process.stdout.write(`\n  Tempo: ${sec.toFixed(0)}s (${(sec / results.length).toFixed(1)}s/teste)\n`);
  if (ok === results.length) process.stdout.write("  🎯 100% — Aprovada em todas as dimensões de volume!\n");
  else process.stdout.write(`  ⚠️ ${results.length - ok} falha(s)\n`);
  process.exit(ok === results.length ? 0 : 1);
}

main().catch((e) => { process.stderr.write(`Fatal: ${e}\n`); process.exit(2); });
