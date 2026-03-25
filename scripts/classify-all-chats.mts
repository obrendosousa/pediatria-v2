/**
 * Classifica TODOS os chats individualmente via Gemini.
 * Lê as mensagens reais de cada conversa e gera classificação estruturada.
 *
 * Uso: npx tsx --env-file=.env.local scripts/classify-all-chats.mts
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";

type AnySupabase = any;
const sb: AnySupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY! });

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function fetchAll(table: string, select: string, filter?: { col: string; op: string; val: any }): Promise<any[]> {
  const rows: any[] = [];
  let offset = 0;
  while (true) {
    let q = sb.from(table).select(select).order("created_at", { ascending: true }).range(offset, offset + 999);
    if (filter) q = q.filter(filter.col, filter.op, filter.val);
    const { data, error } = await q;
    if (error || !data || data.length === 0) break;
    rows.push(...data);
    if (data.length < 1000) break;
    offset += 1000;
  }
  return rows;
}

interface ChatClassification {
  chat_id: number;
  categoria: string;
  desfecho: string;
  objecao_principal: string | null;
  sentimento: string;
  nota_atendimento: number;
  citacao_chave: string | null;
  topico: string;
  resumo_analise: string;
  agendou: boolean;
  compareceu: boolean;
  valor_consulta: number | null;
  is_retorno: boolean;
  is_urgencia: boolean;
}

// ═══════════════════════════════════════════════════════════════
// Classificar batch de chats via Gemini
// ═══════════════════════════════════════════════════════════════

async function classifyBatch(
  chatTranscripts: Array<{ chat_id: number; contact_name: string; transcript: string }>
): Promise<ChatClassification[]> {
  const prompt = `Você é um analista de dados de uma clínica pediátrica. Analise cada conversa de WhatsApp abaixo e classifique com PRECISÃO ABSOLUTA.

REGRAS CRÍTICAS:
- "agendou" = paciente CONFIRMOU data/horário de consulta (não basta perguntar disponibilidade)
- "compareceu" = há evidência clara de que o paciente FOI à consulta (menção a chegada, fila, pagamento feito)
- "is_retorno" = é uma consulta de RETORNO (paciente já consultou antes e está voltando)
- "is_urgencia" = paciente mencionou urgência, febre alta, vômito, emergência
- nota_atendimento (0-10): qualidade do atendimento da secretária nessa conversa
- valor_consulta: valor em R$ mencionado na conversa (null se não mencionado)
- NÃO invente dados. Se não tem evidência clara, marque false/null.

CATEGORIAS VÁLIDAS:
- agendamento_confirmado: paciente agendou consulta nova
- retorno_confirmado: paciente agendou retorno
- consulta_realizada: paciente compareceu à consulta
- retorno_realizado: paciente compareceu ao retorno
- desistencia_preco: desistiu por causa do preço
- desistencia_vaga: desistiu por falta de vaga/horário
- desistencia_distancia: desistiu por distância
- desistencia_outro: desistiu por outro motivo
- ghosting_pos_preco: viu o preço e sumiu (sem responder)
- ghosting_pos_info: recebeu informações e sumiu
- em_andamento: conversa ainda aberta/aguardando
- sem_resposta_clinica: paciente mandou mas clínica não respondeu
- informacao_apenas: apenas pediu informação, sem intenção de agendar
- follow_up: lembrete, confirmação de consulta já agendada
- nao_classificavel: não há dados suficientes

SENTIMENTOS VÁLIDOS: positivo, neutro, negativo

CONVERSAS:
${chatTranscripts.map((c, i) => `
--- CHAT #${c.chat_id} (${c.contact_name}) ---
${c.transcript}
--- FIM CHAT #${c.chat_id} ---`).join("\n")}

Retorne um JSON array com uma classificação por chat:
[{
  "chat_id": number,
  "categoria": "string",
  "desfecho": "frase curta descrevendo o resultado final",
  "objecao_principal": "string ou null",
  "sentimento": "positivo|neutro|negativo",
  "nota_atendimento": 0-10,
  "citacao_chave": "frase mais relevante do paciente ou null",
  "topico": "assunto principal da conversa",
  "resumo_analise": "2-3 frases resumindo o que aconteceu",
  "agendou": true/false,
  "compareceu": true/false,
  "valor_consulta": number ou null,
  "is_retorno": true/false,
  "is_urgencia": true/false
}]`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.1,
          maxOutputTokens: 8192,
        },
      });

      const text = response.text?.trim() || "[]";
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) return [];
      return parsed;
    } catch (err) {
      if (attempt === 3) {
        console.error(`  Batch falhou após 3 tentativas:`, (err as Error).message?.slice(0, 100));
        return [];
      }
      await sleep(2000 * attempt);
    }
  }
  return [];
}

// ═══════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════

async function main() {
  console.log("\n" + "═".repeat(60));
  console.log("  CLASSIFICAÇÃO INDIVIDUAL DE TODOS OS CHATS");
  console.log("═".repeat(60));

  // 1. Carregar TODAS as mensagens
  console.log("\n[1/5] Carregando mensagens...");
  const allMsgs = await fetchAll("chat_messages", "id,chat_id,sender,message_text,created_at");
  console.log(`  ${allMsgs.length} mensagens carregadas`);

  // 2. Carregar chats
  const allChats = await fetchAll("chats", "id,contact_name,phone,created_at");
  const chatMap = new Map<number, any>();
  allChats.forEach((c: any) => chatMap.set(c.id, c));
  console.log(`  ${allChats.length} chats carregados`);

  // 3. Agrupar mensagens por chat e montar transcripts
  console.log("\n[2/5] Montando transcripts...");
  const msgsByChat: Record<number, any[]> = {};
  allMsgs.forEach((m: any) => {
    if (!msgsByChat[m.chat_id]) msgsByChat[m.chat_id] = [];
    msgsByChat[m.chat_id].push(m);
  });

  // Filtrar chats com pelo menos 2 mensagens de diferentes senders
  const validChatIds: number[] = [];
  for (const [chatId, msgs] of Object.entries(msgsByChat)) {
    const senders = new Set(msgs.map((m: any) => m.sender));
    if (msgs.length >= 2 && senders.size >= 1) {
      validChatIds.push(parseInt(chatId));
    }
  }
  validChatIds.sort((a, b) => a - b);
  console.log(`  ${validChatIds.length} chats válidos para classificação`);

  // 4. Montar transcripts (limitar a 30 msgs por chat para economizar tokens)
  const transcripts: Array<{ chat_id: number; contact_name: string; transcript: string }> = [];

  for (const chatId of validChatIds) {
    const msgs = msgsByChat[chatId]
      .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .slice(-30); // Últimas 30 msgs

    const chat = chatMap.get(chatId);
    const contactName = chat?.contact_name || `Chat ${chatId}`;

    const transcript = msgs.map((m: any) => {
      const sender = m.sender === "HUMAN_AGENT" ? "CLÍNICA" : m.sender === "CUSTOMER" ? "PACIENTE" : "SISTEMA";
      const text = (m.message_text || "[mídia]").slice(0, 300);
      return `${sender}: ${text}`;
    }).join("\n");

    transcripts.push({ chat_id: chatId, contact_name: contactName, transcript });
  }

  // 5. Classificar em batches de 8 chats
  console.log(`\n[3/5] Classificando ${transcripts.length} chats via Gemini...`);
  const BATCH_SIZE = 8;
  const allResults: ChatClassification[] = [];
  let processed = 0;

  for (let i = 0; i < transcripts.length; i += BATCH_SIZE) {
    const batch = transcripts.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(transcripts.length / BATCH_SIZE);

    process.stdout.write(`  Batch ${batchNum}/${totalBatches} (${batch.length} chats)... `);

    const results = await classifyBatch(batch);
    allResults.push(...results);
    processed += batch.length;

    console.log(`${results.length} classificados ✓`);

    // Rate limit
    if (i + BATCH_SIZE < transcripts.length) await sleep(1500);
  }

  console.log(`\n  Total classificado: ${allResults.length}/${transcripts.length}`);

  // 6. Salvar no banco
  console.log("\n[4/5] Salvando classificações no chat_insights...");
  let saved = 0, errors = 0;

  for (const r of allResults) {
    const upsertData = {
      chat_id: r.chat_id,
      categoria: r.categoria,
      desfecho: r.desfecho,
      objecao_principal: r.objecao_principal || null,
      sentimento: r.sentimento,
      nota_atendimento: r.nota_atendimento || 0,
      citacao_chave: r.citacao_chave || null,
      topico: r.topico,
      resumo_analise: r.resumo_analise,
      classified_at: new Date().toISOString(),
      classified_by: "batch_classify_v2",
      message_count_at_classification: (msgsByChat[r.chat_id] || []).length,
      needs_reclassification: false,
      metricas_extras: {
        agendou: r.agendou,
        compareceu: r.compareceu,
        valor_consulta: r.valor_consulta,
        is_retorno: r.is_retorno,
        is_urgencia: r.is_urgencia,
      },
      updated_at: new Date().toISOString(),
    };

    // Check if insight exists for this chat_id
    const { data: existing } = await sb.from("chat_insights").select("id").eq("chat_id", r.chat_id).limit(1);

    if (existing && existing.length > 0) {
      const { error } = await sb.from("chat_insights").update(upsertData).eq("chat_id", r.chat_id);
      if (error) { errors++; console.error(`  Erro update ${r.chat_id}:`, error.message); }
      else saved++;
    } else {
      const { error } = await sb.from("chat_insights").insert({ ...upsertData, created_at: new Date().toISOString() });
      if (error) { errors++; console.error(`  Erro insert ${r.chat_id}:`, error.message); }
      else saved++;
    }
  }

  console.log(`  Salvos: ${saved} | Erros: ${errors}`);

  // 7. Sumário
  console.log("\n[5/5] Sumário...");

  const catCount: Record<string, number> = {};
  let totalAgendou = 0, totalCompareceu = 0, totalRetorno = 0, totalUrgencia = 0;
  let totalReceita = 0;

  for (const r of allResults) {
    catCount[r.categoria] = (catCount[r.categoria] || 0) + 1;
    if (r.agendou) totalAgendou++;
    if (r.compareceu) totalCompareceu++;
    if (r.is_retorno) totalRetorno++;
    if (r.is_urgencia) totalUrgencia++;
    if (r.agendou && !r.is_retorno && r.valor_consulta) totalReceita += r.valor_consulta;
    else if (r.agendou && !r.is_retorno) totalReceita += 500;
  }

  console.log("\n" + "═".repeat(60));
  console.log("  RESULTADO DA CLASSIFICAÇÃO INDIVIDUAL");
  console.log("═".repeat(60));
  console.log(`Chats analisados: ${allResults.length}`);
  console.log(`\nPor categoria:`);
  Object.entries(catCount).sort((a, b) => b[1] - a[1]).forEach(([cat, cnt]) => {
    console.log(`  ${String(cnt).padStart(4)}× ${cat}`);
  });

  console.log(`\nMétricas de conversão:`);
  console.log(`  Agendaram (consulta ou retorno): ${totalAgendou}`);
  console.log(`  Compareceram: ${totalCompareceu}`);
  console.log(`  Retornos: ${totalRetorno}`);
  console.log(`  Urgências: ${totalUrgencia}`);
  console.log(`  Receita estimada: R$ ${totalReceita.toFixed(2)}`);

  const sentCount: Record<string, number> = {};
  allResults.forEach(r => { sentCount[r.sentimento] = (sentCount[r.sentimento] || 0) + 1; });
  console.log(`\nSentimento:`, JSON.stringify(sentCount));

  const notas = allResults.map(r => r.nota_atendimento).filter(n => n > 0);
  if (notas.length > 0) {
    const avg = notas.reduce((a, b) => a + b, 0) / notas.length;
    console.log(`Nota média de atendimento: ${avg.toFixed(1)}/10 (${notas.length} avaliações)`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
