/**
 * Roleplay v2 — Teste de análise massiva + drill-down com validação.
 *
 * Fase 1: Pede análise massiva de todos os chats do mês
 * Fase 2: Pega um insight específico e pede drill-down
 * Fase 3: Verifica coerência numérica entre as respostas
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

type AnySupabase = any;
const sb: AnySupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const CLARA_CHAT_ID = 1495;

async function sendToClara(message: string): Promise<string> {
  // 1. Insere a mensagem do usuário no banco
  await sb.from("chat_messages").insert({
    chat_id: CLARA_CHAT_ID,
    phone: "00000000000",
    sender: "HUMAN_AGENT",
    message_text: message,
    message_type: "text",
    status: "read",
    created_at: new Date().toISOString(),
    wpp_id: `test_${Date.now()}`,
  });

  const startTime = Date.now();

  // 2. Esperar o lock liberar (se sessão anterior ainda rodando)
  for (let attempt = 0; attempt < 20; attempt++) {
    const res = await fetch("http://localhost:3000/api/ai/clara/study-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: message }),
    });

    if (res.ok) break;

    if (res.status === 429) {
      console.log(`  Lock ativo, tentativa ${attempt + 1}/20 — aguardando 15s...`);
      await new Promise((r) => setTimeout(r, 15000));
      continue;
    }

    const text = await res.text();
    console.error(`[HTTP ${res.status}] ${text.slice(0, 200)}`);
    return `ERRO: ${res.status}`;
  }

  // 3. Esperar a resposta da Clara aparecer no banco
  const TIMEOUT = 300_000; // 5 min

  while (Date.now() - startTime < TIMEOUT) {
    await new Promise((r) => setTimeout(r, 5000));

    const { data } = await sb
      .from("chat_messages")
      .select("message_text, created_at")
      .eq("chat_id", CLARA_CHAT_ID)
      .eq("sender", "contact")
      .order("created_at", { ascending: false })
      .limit(1);

    const msg = data?.[0]?.message_text || "";
    if (msg && new Date(data[0].created_at).getTime() > startTime) {
      return msg;
    }
  }

  return "TIMEOUT: Clara não respondeu em 5 minutos.";
}

async function main() {
  console.log("\n" + "═".repeat(70));
  console.log("  ROLEPLAY v2 — Análise Massiva + Drill-down");
  console.log("═".repeat(70));

  // ═══════════════════════════════════════════════════════════════════════
  // FASE 1: Análise massiva de TODOS os chats do mês
  // ═══════════════════════════════════════════════════════════════════════
  console.log("\n🔵 FASE 1: Análise massiva do mês inteiro\n");
  const p1 = `Preciso de um diagnóstico completo da clínica nos últimos 30 dias. Quero saber:
1. Quantos pacientes entraram em contato
2. Quantos foram atendidos pela Joana
3. Quantos agendaram consulta
4. Quantos desistiram e por quê (categorize os motivos)
5. Qual a taxa de conversão real

Não preciso de relatório bonito, preciso dos números exatos.`;

  console.log("[ENVIANDO]", p1.slice(0, 80) + "...");
  const start1 = Date.now();
  const r1 = await sendToClara(p1);
  const time1 = ((Date.now() - start1) / 1000).toFixed(0);
  console.log(`[RESPOSTA ${time1}s] ${r1.length} chars`);
  console.log(r1.slice(0, 600));
  console.log("...\n");

  // Extrair números da resposta para validação
  const nums1 = {
    totalChats: r1.match(/(\d+)\s*(chats|conversas|contatos|pacientes)/i)?.[1],
    atendidos: r1.match(/(\d+)\s*(atendid|respondid|com\s+resposta)/i)?.[1],
    agendados: r1.match(/(\d+)\s*(agend|confirmad|convers)/i)?.[1],
    desistencias: r1.match(/(\d+)\s*(desist|perdid|sem\s+resposta|abandon)/i)?.[1],
    conversao: r1.match(/(\d+[,.]?\d*)\s*%/)?.[1],
  };
  console.log("[NÚMEROS EXTRAÍDOS]", JSON.stringify(nums1));

  // ═══════════════════════════════════════════════════════════════════════
  // FASE 2: Drill-down em um insight específico
  // ═══════════════════════════════════════════════════════════════════════
  console.log("\n🔵 FASE 2: Drill-down nas desistências por preço\n");
  const p2 = `Desses pacientes que desistiram por causa de preço, me dá a lista completa com nome, telefone e o que exatamente aconteceu em cada conversa. Quero entender o padrão.`;

  console.log("[ENVIANDO]", p2.slice(0, 80) + "...");
  const start2 = Date.now();
  const r2 = await sendToClara(p2);
  const time2 = ((Date.now() - start2) / 1000).toFixed(0);
  console.log(`[RESPOSTA ${time2}s] ${r2.length} chars`);
  console.log(r2.slice(0, 600));
  console.log("...\n");

  // ═══════════════════════════════════════════════════════════════════════
  // FASE 3: Pergunta que exige cálculo cruzado
  // ═══════════════════════════════════════════════════════════════════════
  console.log("\n🔵 FASE 3: Cálculo de impacto financeiro cruzado\n");
  const p3 = `Considerando que a consulta custa R$ 500,00, quanto exatamente perdemos com esses pacientes que desistiram por preço? E se a gente oferecesse um desconto de 10% para eles, quantos você acha que converteriam?`;

  console.log("[ENVIANDO]", p3.slice(0, 80) + "...");
  const start3 = Date.now();
  const r3 = await sendToClara(p3);
  const time3 = ((Date.now() - start3) / 1000).toFixed(0);
  console.log(`[RESPOSTA ${time3}s] ${r3.length} chars`);
  console.log(r3.slice(0, 600));
  console.log("...\n");

  // ═══════════════════════════════════════════════════════════════════════
  // FASE 4: Pergunta rápida pra testar se ela mantém contexto
  // ═══════════════════════════════════════════════════════════════════════
  console.log("\n🔵 FASE 4: Teste de contexto (pergunta curta)\n");
  const p4 = `E quantos desses eram urgência?`;

  console.log("[ENVIANDO]", p4);
  const start4 = Date.now();
  const r4 = await sendToClara(p4);
  const time4 = ((Date.now() - start4) / 1000).toFixed(0);
  console.log(`[RESPOSTA ${time4}s] ${r4.length} chars`);
  console.log(r4.slice(0, 400));
  console.log("...\n");

  // ═══════════════════════════════════════════════════════════════════════
  // VALIDAÇÃO
  // ═══════════════════════════════════════════════════════════════════════
  console.log("\n" + "═".repeat(70));
  console.log("  VALIDAÇÃO");
  console.log("═".repeat(70));

  // Pegar dados reais para comparar
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const { count: totalChats } = await sb
    .from("chats")
    .select("*", { count: "exact", head: true })
    .gte("last_interaction_at", since);

  const { data: msgs } = await sb
    .from("chat_messages")
    .select("sender, chat_id")
    .gte("created_at", since)
    .limit(10000);

  const chatsComHumano = new Set(
    (msgs || []).filter((m: any) => m.sender === "HUMAN_AGENT").map((m: any) => m.chat_id)
  );

  console.log(`\n📊 GABARITO REAL:`);
  console.log(`   Total chats ativos (30d): ${totalChats}`);
  console.log(`   Chats com atendimento Joana: ${chatsComHumano.size}`);
  console.log(`   Total mensagens: ${msgs?.length}`);

  console.log(`\n📊 CLARA DISSE:`);
  console.log(`   Total chats: ${nums1.totalChats || "?"}`);
  console.log(`   Atendidos: ${nums1.atendidos || "?"}`);
  console.log(`   Taxa conversão: ${nums1.conversao || "?"}%`);

  console.log(`\n⏱️ TEMPOS:`);
  console.log(`   Fase 1 (massiva): ${time1}s`);
  console.log(`   Fase 2 (drill-down): ${time2}s`);
  console.log(`   Fase 3 (cálculo): ${time3}s`);
  console.log(`   Fase 4 (contexto): ${time4}s`);

  // Salvar resultado completo
  const report = {
    fase1: { question: p1.slice(0, 80), time_s: time1, response_chars: r1.length, numbers: nums1 },
    fase2: { question: p2.slice(0, 80), time_s: time2, response_chars: r2.length },
    fase3: { question: p3.slice(0, 80), time_s: time3, response_chars: r3.length },
    fase4: { question: p4, time_s: time4, response_chars: r4.length },
    gabarito: { totalChats, chatsComHumano: chatsComHumano.size, totalMsgs: msgs?.length },
    fullResponses: { r1, r2, r3, r4 },
  };

  const fs = await import("node:fs/promises");
  await fs.writeFile("scripts/roleplay-v2-result.json", JSON.stringify(report, null, 2));
  console.log(`\n✅ Resultado completo salvo em scripts/roleplay-v2-result.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
