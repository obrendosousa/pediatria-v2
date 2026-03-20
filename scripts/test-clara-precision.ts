/**
 * Script de Teste de Precisão da Clara 2.0
 *
 * Invoca a Clara diretamente via LangGraph, coleta respostas e valida
 * contra dados reais do banco.
 *
 * Uso: npx tsx scripts/test-clara-precision.ts
 */

import "dotenv/config";
import { HumanMessage } from "@langchain/core/messages";
import { claraGraph } from "../src/ai/clara/graph";

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────

const TEST_CHAT_ID = 1495; // Chat da Clara (teste)
const THREAD_PREFIX = `test-precision-${Date.now()}`;

interface TestCase {
  id: string;
  category: string;
  question: string;
  validate: (response: string) => { pass: boolean; detail: string };
}

// ─────────────────────────────────────────────────────────────────────────────
// BATERIA DE TESTES
// ─────────────────────────────────────────────────────────────────────────────

const tests: TestCase[] = [
  // ── TESTE 1: Volume de mensagens (precisão quantitativa) ──
  {
    id: "T1",
    category: "VOLUME",
    question: `[MODO COPILOTO — CONSULTA GLOBAL]
Você é a Clara, assistente de IA da clínica. O usuário fez uma pergunta GLOBAL sobre a clínica.

PERGUNTA DO USUÁRIO: Quantas mensagens foram trocadas no dia 18/03/2026? Me dê o número exato.

INSTRUÇÕES: Use suas ferramentas para buscar dados de TODO o banco. Não limite a um paciente específico.`,
    validate: (r) => {
      // Real: 369 mensagens em 18/03
      const nums = r.match(/\d{2,4}/g)?.map(Number) || [];
      const found369 = nums.some(n => n >= 360 && n <= 380);
      return {
        pass: found369,
        detail: `Esperado: ~369 mensagens. Números encontrados: ${nums.join(", ")}`,
      };
    },
  },

  // ── TESTE 2: Chats ativos por dia (BUG CORRIGIDO?) ──
  {
    id: "T2",
    category: "CHATS_ATIVOS",
    question: `[MODO COPILOTO — CONSULTA GLOBAL]
Você é a Clara, assistente de IA da clínica. O usuário fez uma pergunta GLOBAL sobre a clínica.

PERGUNTA DO USUÁRIO: Quantos chats únicos tiveram atividade no dia 17/03/2026? Quero o número exato de chats distintos que trocaram pelo menos uma mensagem nesse dia.

INSTRUÇÕES: Use suas ferramentas para buscar dados de TODO o banco. Não limite a um paciente específico.`,
    validate: (r) => {
      // Real: 49 chats únicos em 17/03
      const nums = r.match(/\d{2,3}/g)?.map(Number) || [];
      const closeEnough = nums.some(n => n >= 40 && n <= 55);
      const oldBugValue = nums.some(n => n >= 18 && n <= 25);
      return {
        pass: closeEnough,
        detail: closeEnough
          ? `CORRIGIDO! Encontrou ~49 chats. Números: ${nums.join(", ")}`
          : oldBugValue
            ? `BUG PERSISTE! Ainda reportando ~22 chats (real: 49). Números: ${nums.join(", ")}`
            : `Resultado inesperado. Números: ${nums.join(", ")}`,
      };
    },
  },

  // ── TESTE 3: Identificação de contato por ID (precisão de referência) ──
  {
    id: "T3",
    category: "REFERENCIA",
    question: `[MODO COPILOTO — CHAT DO PACIENTE]
Você é a Clara, assistente de IA da clínica. O usuário está na tela do chat de: Cris Brandão🌹 (chat_id: 1637).

HISTÓRICO RECENTE (últimas 20 mensagens):
------------------------------------------------------
Nenhuma mensagem disponível.
------------------------------------------------------

PERGUNTA DO USUÁRIO: Qual o nome completo do paciente (filho) desse chat e qual a situação atual? Leia o histórico completo.

INSTRUÇÕES: A pergunta é sobre ESTE paciente. Use o histórico acima e ferramentas para ajudar.`,
    validate: (r) => {
      // Chat 1637 = Cris Brandão🌹, paciente = Mavie Louise
      const hasMavie = /mavie/i.test(r);
      const hasCris = /cris|brand[aã]o/i.test(r);
      return {
        pass: hasMavie || hasCris,
        detail: `Mavie citada: ${hasMavie}, Cris citada: ${hasCris}`,
      };
    },
  },

  // ── TESTE 4: Classificação de desfecho (BUG DE FALSO POSITIVO CORRIGIDO?) ──
  {
    id: "T4",
    category: "CLASSIFICACAO",
    question: `[MODO COPILOTO — CHAT DO PACIENTE]
Você é a Clara, assistente de IA da clínica. O usuário está na tela do chat de: Deus é Fiel 🙏 (chat_id: 1638).

HISTÓRICO RECENTE (últimas 20 mensagens):
------------------------------------------------------
Nenhuma mensagem disponível.
------------------------------------------------------

PERGUNTA DO USUÁRIO: Leia o histórico COMPLETO desse chat e me diga: essa paciente foi perdida ou convertida? Ela agendou consulta? Dê as provas.

INSTRUÇÕES: A pergunta é sobre ESTE paciente. Use ferramentas para ler TODO o histórico.`,
    validate: (r) => {
      // Chat 1638: paciente pediu exceção, mas AGENDOU para o dia seguinte
      // Enviou dados: Sara Silva de Barros, 02/08/2022
      // Clara pode responder de forma nuançada: "converteu no chat mas não no sistema"
      const mentionsScheduled = /agend|marcou|confirm|conver(tida|são|s[aã]o)|dados|sara/i.test(r);
      const hasProof = /sara|02\/08|barros/i.test(r);
      // "Perdida" pura = Clara acha que não agendou de forma alguma
      // Excluímos menções de "não concretizada no sistema" que é uma resposta correta
      const purelyLost = /perd(ida|eu|a)|desist/i.test(r) && !mentionsScheduled;
      return {
        pass: mentionsScheduled && !purelyLost,
        detail: mentionsScheduled
          ? `CORRETO! Identificou conversão. Provas (sara/barros/data): ${hasProof}`
          : purelyLost
            ? `BUG PERSISTE! Classificou como perdida (real: convertida)`
            : `Resultado ambíguo.`,
      };
    },
  },

  // ── TESTE 5: Análise qualitativa com citação (spot-check de provas) ──
  {
    id: "T5",
    category: "QUALITATIVO",
    question: `[MODO COPILOTO — CONSULTA GLOBAL]
Você é a Clara, assistente de IA da clínica. O usuário fez uma pergunta GLOBAL sobre a clínica.

PERGUNTA DO USUÁRIO: Analise o chat 1669 (Leudimar Sousa Rocha). Me cite a frase exata onde ela diz que vai procurar outro lugar. Qual foi o desfecho real dessa conversa?

INSTRUÇÕES: Use suas ferramentas para buscar dados de TODO o banco. Não limite a um paciente específico.`,
    validate: (r) => {
      // Frase real: "Ok tem vc problema não vou procura em outro outro lugar que sabe eu consigo"
      const hasQuote = /procura.*outro.*lugar/i.test(r);
      const hasLoss = /perd|desist|n[aã]o.agend|foi embora|outro lugar/i.test(r);
      return {
        pass: hasQuote && hasLoss,
        detail: `Citação correta: ${hasQuote}. Desfecho correto (perda): ${hasLoss}`,
      };
    },
  },

  // ── TESTE 6: Volume mensal consolidado ──
  {
    id: "T6",
    category: "VOLUME_MENSAL",
    question: `[MODO COPILOTO — CONSULTA GLOBAL]
Você é a Clara, assistente de IA da clínica. O usuário fez uma pergunta GLOBAL sobre a clínica.

PERGUNTA DO USUÁRIO: Quantas mensagens foram trocadas no total em março de 2026 (de 01/03 até hoje 20/03)? Me dê o número exato.

INSTRUÇÕES: Use suas ferramentas para buscar dados de TODO o banco. Não limite a um paciente específico.`,
    validate: (r) => {
      // Real: 4246 mensagens em março (1-20)
      const nums = r.match(/\d[\d.,]{2,}/g)?.map(s => Number(s.replace(/[.,]/g, ""))) || [];
      const closeEnough = nums.some(n => n >= 4000 && n <= 4500);
      return {
        pass: closeEnough,
        detail: `Esperado: ~4246 mensagens. Números encontrados: ${nums.join(", ")}`,
      };
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// RUNNER
// ─────────────────────────────────────────────────────────────────────────────

interface LangChainMessage {
  _getType?: () => string;
  constructor?: { name?: string };
  content: string | Array<{ text?: string } | string>;
}

function extractTextFromMessages(messages: LangChainMessage[]): string {
  return messages
    .filter((m) => m._getType?.() === "ai" || m.constructor?.name === "AIMessage")
    .map((m) => {
      if (typeof m.content === "string") return m.content;
      if (Array.isArray(m.content)) {
        return m.content
          .map((part) => (typeof part === "string" ? part : part?.text || ""))
          .join("");
      }
      return "";
    })
    .join("\n");
}

async function runTest(test: TestCase): Promise<{
  id: string;
  category: string;
  pass: boolean;
  detail: string;
  responsePreview: string;
  durationMs: number;
}> {
  const threadId = `${THREAD_PREFIX}-${test.id}`;
  const start = Date.now();

  console.log(`\n${"=".repeat(60)}`);
  console.log(`▶ ${test.id} [${test.category}]`);
  console.log(`  Pergunta: ${test.question.split("PERGUNTA DO USUÁRIO: ")[1]?.split("\n")[0] || "..."}`);

  try {
    const result = await claraGraph.invoke(
      {
        messages: [new HumanMessage(test.question)],
        chat_id: TEST_CHAT_ID,
        is_deep_research: false,
        is_planning_mode: false,
        research_brief: "",
        raw_notes: [],
        supervisor_messages: [],
        supervisor_iteration: 0,
        research_complete: false,
        current_user_role: "admin" as const,
        db_stats: null,
        loaded_context: null,
        spot_check_result: null,
        pending_question: null,
      },
      {
        configurable: { thread_id: threadId },
        recursionLimit: 40,
      }
    );

    const responseText = extractTextFromMessages(result.messages || []);
    const duration = Date.now() - start;
    const validation = test.validate(responseText);

    console.log(`  Duração: ${(duration / 1000).toFixed(1)}s`);
    console.log(`  Resposta (preview): ${responseText.substring(0, 200).replace(/\n/g, " ")}...`);
    console.log(`  ${validation.pass ? "✅ PASS" : "❌ FAIL"}: ${validation.detail}`);

    return {
      id: test.id,
      category: test.category,
      pass: validation.pass,
      detail: validation.detail,
      responsePreview: responseText.substring(0, 300),
      durationMs: duration,
    };
  } catch (err: unknown) {
    const duration = Date.now() - start;
    const errMsg = err instanceof Error ? err.message : String(err);
    console.log(`  ❌ ERRO: ${errMsg.substring(0, 200)}`);
    return {
      id: test.id,
      category: test.category,
      pass: false,
      detail: `ERRO: ${errMsg.substring(0, 200)}`,
      responsePreview: "",
      durationMs: duration,
    };
  }
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║        BATERIA DE TESTES DE PRECISÃO — CLARA 2.0           ║");
  console.log("║        Data: 20/03/2026 | 6 testes | Pós-correção          ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");

  const results = [];

  for (const test of tests) {
    const result = await runTest(test);
    results.push(result);
  }

  // ── SCORECARD FINAL ──
  console.log("\n" + "═".repeat(60));
  console.log("                    SCORECARD FINAL");
  console.log("═".repeat(60));

  const passed = results.filter(r => r.pass).length;
  const total = results.length;

  for (const r of results) {
    console.log(`  ${r.pass ? "✅" : "❌"} ${r.id} [${r.category}] — ${r.detail.substring(0, 80)}`);
  }

  console.log(`\n  RESULTADO: ${passed}/${total} testes passaram (${((passed / total) * 100).toFixed(0)}%)`);
  console.log(`  TEMPO TOTAL: ${(results.reduce((s, r) => s + r.durationMs, 0) / 1000).toFixed(1)}s`);

  if (passed === total) {
    console.log("\n  🎯 Clara 2.0 está APROVADA com 100% de precisão nos testes!");
  } else if (passed >= total * 0.8) {
    console.log(`\n  ⚠️ Clara 2.0 está BOA mas com ${total - passed} falha(s) a investigar.`);
  } else {
    console.log(`\n  🚨 Clara 2.0 precisa de CORREÇÕES — ${total - passed} falhas encontradas.`);
  }

  process.exit(passed === total ? 0 : 1);
}

main().catch((err) => {
  console.error("Erro fatal:", err);
  process.exit(2);
});
