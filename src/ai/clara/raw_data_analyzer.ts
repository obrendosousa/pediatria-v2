// ═══════════════════════════════════════════════════════════════════════════
// CAMADA 8: Raw Data Analyzer (v2 — Fan-Out Architecture)
// Análise direta na fonte — lê mensagens brutas e analisa com IA.
// Suporta 3 estratégias: single_pass, fan_out_classify, chunked_map_reduce.
// ═══════════════════════════════════════════════════════════════════════════

import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { getSupabaseAdminClient } from "@/lib/automation/adapters/supabaseAdmin";

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────

interface RawChatMessage {
  id: number;
  chat_id: number;
  sender: string | null;
  message_text: string | null;
  created_at: string;
}

interface ChatInfo {
  id: number;
  contact_name: string | null;
  phone: string | null;
}

interface ChatClassification {
  chat_id: number;
  contact_name: string;
  categoria: string;
  sentimento: string;
  desfecho: string;
  objecoes: string[];
  resumo: string;
  citacao_chave: string;
}

interface AnalysisBatch {
  batchIndex: number;
  totalBatches: number;
  chats: {
    chat_id: number;
    contact_name: string;
    transcript: string;
    messageCount: number;
  }[];
}

interface BatchResult {
  batchIndex: number;
  classifications: ChatClassification[];
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

// Callback global para progresso do fan-out (setado pelo route.ts de streaming)
type FanOutProgressCallback = (event: { batch: number; total: number; chatsProcessed: number; chatsTotal: number }) => void;
let _fanOutProgressCb: FanOutProgressCallback | null = null;

export function setFanOutProgressCallback(cb: FanOutProgressCallback | null): void {
  _fanOutProgressCb = cb;
}

function emitProgress(batch: number, total: number, chatsProcessed: number, chatsTotal: number): void {
  if (_fanOutProgressCb) _fanOutProgressCb({ batch, total, chatsProcessed, chatsTotal });
}

function normalizeSender(sender: string | null): string {
  const s = String(sender ?? "").toUpperCase();
  if (s === "HUMAN_AGENT" || s === "ME") return "SECRETÁRIA";
  if (s === "AI_AGENT") return "BOT";
  return "PACIENTE";
}

type AnalysisStrategy = "single_pass" | "fan_out_classify" | "chunked_map_reduce";

function detectStrategy(
  goals: string[],
  approxTokens: number,
  uniqueChats: number,
  forcePerChat: boolean
): AnalysisStrategy {
  if (forcePerChat) return "fan_out_classify";

  const text = goals.join(" ").toLowerCase();
  const perChatKeywords = [
    "cada conversa", "cada chat", "classificar", "classificação",
    "individualmente", "uma por uma", "listar todas", "categorizar cada",
    "todas as conversas", "por conversa", "status de cada", "desfecho de cada",
    "funil", "quantos agendaram", "quantas agendaram",
  ];

  if (perChatKeywords.some((kw) => text.includes(kw)) && uniqueChats > 15) {
    return "fan_out_classify";
  }
  if (approxTokens <= 200_000) return "single_pass";
  return "chunked_map_reduce";
}

function buildBatches(
  allMessages: RawChatMessage[],
  chatNames: Record<number, string>,
  formatMessage: (m: RawChatMessage) => string,
  targetSize = 12
): AnalysisBatch[] {
  const byChat: Record<number, RawChatMessage[]> = {};
  for (const msg of allMessages) {
    if (!byChat[msg.chat_id]) byChat[msg.chat_id] = [];
    byChat[msg.chat_id].push(msg);
  }

  const MAX_CHARS = 240_000;
  const batches: AnalysisBatch[] = [];
  let current: AnalysisBatch["chats"] = [];
  let chars = 0;

  for (const chatId of Object.keys(byChat).map(Number)) {
    const msgs = byChat[chatId];
    // Limitar a 80 msgs por chat pra classificação (suficiente pra entender desfecho)
    const truncated = msgs.length > 80 ? msgs.slice(-80) : msgs;
    const transcript = truncated.map(formatMessage).join("\n");
    const len = transcript.length;

    if ((current.length >= targetSize || chars + len > MAX_CHARS) && current.length > 0) {
      batches.push({ batchIndex: batches.length, totalBatches: 0, chats: current });
      current = [];
      chars = 0;
    }

    current.push({
      chat_id: chatId,
      contact_name: chatNames[chatId] || `Chat #${chatId}`,
      transcript,
      messageCount: msgs.length,
    });
    chars += len;
  }
  if (current.length > 0) {
    batches.push({ batchIndex: batches.length, totalBatches: 0, chats: current });
  }
  for (const b of batches) b.totalBatches = batches.length;
  return batches;
}

// ─────────────────────────────────────────────────────────────────────────────
// FAN-OUT: Análise paralela por lotes
// ─────────────────────────────────────────────────────────────────────────────

const classificationSchema = z.object({
  classificacoes: z.array(z.object({
    chat_id: z.number(),
    categoria: z.string().describe("Ex: agendamento_confirmado, objecao_preco, objecao_vaga, informativo, retorno, sem_resposta, outro"),
    sentimento: z.enum(["positivo", "neutro", "negativo"]),
    desfecho: z.string().describe("O que aconteceu no final da conversa (1 frase)"),
    objecoes: z.array(z.string()).describe("Lista de objeções identificadas (vazio se não houver)"),
    resumo: z.string().describe("1-2 frases resumindo a conversa"),
    citacao_chave: z.string().describe("Trecho mais relevante da conversa (cópia exata)"),
  })),
});

async function analyzeBatch(
  batch: AnalysisBatch,
  goals: string[],
  model: ChatGoogleGenerativeAI,
  period: { start: string; end: string },
  chatNames: Record<number, string>
): Promise<BatchResult> {
  const goalsText = goals.map((g, i) => `${i + 1}. ${g}`).join("\n");
  const transcripts = batch.chats.map((c) =>
    `═══ CONVERSA chat_id=${c.chat_id} | ${c.contact_name} (${c.messageCount} msgs) ═══\n${c.transcript}`
  ).join("\n\n");

  const prompt = `Você é um analista de atendimento de clínica pediátrica. Classifique CADA conversa.

OBJETIVOS:
${goalsText}

PERÍODO: ${period.start} a ${period.end}
LOTE: ${batch.batchIndex + 1}/${batch.totalBatches} (${batch.chats.length} conversas)

CATEGORIAS POSSÍVEIS:
- agendamento_confirmado: paciente forneceu dados e confirmou consulta
- objecao_preco: desistiu por causa do valor
- objecao_vaga: queria atendimento imediato sem disponibilidade
- objecao_logistica: chuva, distância, transporte
- objecao_hesitacao: vai pensar, falar com alguém
- sem_resposta: clínica não respondeu ou paciente sumiu
- informativo: só perguntou valor/horário
- retorno: paciente existente voltando
- venda_produto: compra de produto (não consulta)
- outro: não se encaixa

REGRAS:
1. Retorne EXATAMENTE ${batch.chats.length} classificações (uma por conversa)
2. Use o chat_id exato
3. Baseie-se APENAS no texto fornecido — NÃO invente
4. Se paciente forneceu nome+data nascimento e confirmou = agendamento_confirmado
5. Se pediu encaixe/urgência e não teve vaga = objecao_vaga
6. Copie trecho real na citacao_chave`;

  try {
    const structured = model.withStructuredOutput(classificationSchema);
    const result = await structured.invoke([
      { role: "system", content: prompt },
      { role: "user", content: `Classifique:\n\n${transcripts}` },
    ]);

    return {
      batchIndex: batch.batchIndex,
      classifications: result.classificacoes.map((c) => ({
        ...c,
        contact_name: chatNames[c.chat_id] || batch.chats.find((ch) => ch.chat_id === c.chat_id)?.contact_name || "",
      })),
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[fan_out] Batch ${batch.batchIndex + 1} error: ${msg.substring(0, 200)}`);

    // Se falhou por tamanho, dividir em 2 e tentar de novo
    if (batch.chats.length > 3 && (msg.includes("token") || msg.includes("limit") || msg.includes("size"))) {
      const mid = Math.ceil(batch.chats.length / 2);
      const a: AnalysisBatch = { ...batch, chats: batch.chats.slice(0, mid) };
      const b: AnalysisBatch = { ...batch, chats: batch.chats.slice(mid) };
      const [ra, rb] = await Promise.all([
        analyzeBatch(a, goals, model, period, chatNames),
        analyzeBatch(b, goals, model, period, chatNames),
      ]);
      return {
        batchIndex: batch.batchIndex,
        classifications: [...ra.classifications, ...rb.classifications],
        error: ra.error || rb.error,
      };
    }

    return { batchIndex: batch.batchIndex, classifications: [], error: msg.substring(0, 200) };
  }
}

async function fanOutAnalyze(
  batches: AnalysisBatch[],
  goals: string[],
  period: { start: string; end: string },
  chatNames: Record<number, string>
): Promise<{ classifications: ChatClassification[]; errors: number }> {
  const model = new ChatGoogleGenerativeAI({
    model: "gemini-2.5-flash",
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
    temperature: 0.1,
  });

  const MAX_CONCURRENCY = 5;
  const results: BatchResult[] = [];

  for (let i = 0; i < batches.length; i += MAX_CONCURRENCY) {
    const window = batches.slice(i, i + MAX_CONCURRENCY);
    console.log(`[fan_out] Processando lotes ${i + 1}-${Math.min(i + MAX_CONCURRENCY, batches.length)} de ${batches.length}...`);
    const windowResults = await Promise.all(
      window.map((b) => analyzeBatch(b, goals, model, period, chatNames))
    );
    results.push(...windowResults);

    const processed = results.flatMap((r) => r.classifications).length;
    const totalChats = batches.reduce((s, b) => s + b.chats.length, 0);
    emitProgress(Math.min(i + MAX_CONCURRENCY, batches.length), batches.length, processed, totalChats);
  }

  return {
    classifications: results.flatMap((r) => r.classifications),
    errors: results.filter((r) => r.error).length,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// AGREGAÇÃO (determinística, sem LLM)
// ─────────────────────────────────────────────────────────────────────────────

function buildAggregation(classifications: ChatClassification[]) {
  const byCat: Record<string, ChatClassification[]> = {};
  const byObj: Record<string, ChatClassification[]> = {};
  const bySent: Record<string, number> = {};

  for (const c of classifications) {
    if (!byCat[c.categoria]) byCat[c.categoria] = [];
    byCat[c.categoria].push(c);

    bySent[c.sentimento] = (bySent[c.sentimento] || 0) + 1;

    for (const obj of c.objecoes) {
      const key = obj.toLowerCase().trim();
      if (!byObj[key]) byObj[key] = [];
      byObj[key].push(c);
    }
  }

  const catSorted = Object.entries(byCat)
    .map(([cat, items]) => ({ cat, count: items.length, chats: items.map((i) => `[[chat:${i.chat_id}|${i.contact_name}]]`) }))
    .sort((a, b) => b.count - a.count);

  const objSorted = Object.entries(byObj)
    .map(([obj, items]) => ({ obj, count: items.length, chats: items.map((i) => `[[chat:${i.chat_id}|${i.contact_name}]]`) }))
    .sort((a, b) => b.count - a.count);

  return { byCat: catSorted, byObj: objSorted, bySent, total: classifications.length };
}

function formatFanOutResult(
  classifications: ChatClassification[],
  errors: number,
  totalBatches: number,
  totalMessages: number,
  period: { start: string; end: string }
): string {
  const agg = buildAggregation(classifications);

  const catTable = agg.byCat.map((c) =>
    `| ${c.cat} | ${c.count} | ${((c.count / agg.total) * 100).toFixed(1)}% | ${c.chats.slice(0, 5).join(", ")}${c.chats.length > 5 ? ` (+${c.chats.length - 5})` : ""} |`
  ).join("\n");

  const objTable = agg.byObj.map((o) =>
    `| ${o.obj} | ${o.count} | ${o.chats.slice(0, 3).join(", ")} |`
  ).join("\n");

  const sentLine = Object.entries(agg.bySent).map(([k, v]) => `${k}: ${v}`).join(" | ");

  // Top citações para spot-check
  const topCitations = classifications
    .filter((c) => c.citacao_chave && c.citacao_chave.length > 10)
    .slice(0, 10)
    .map((c) => `- [[chat:${c.chat_id}|${c.contact_name}]]: "${c.citacao_chave}"`)
    .join("\n");

  return `📅 Período: ${period.start} a ${period.end}
📊 Base: ${totalMessages} mensagens brutas de ${agg.total} conversas classificadas
⚙️ Método: Fan-Out Classificação (${totalBatches} lotes paralelos, 5 simultâneos)
${errors > 0 ? `⚠️ ${errors} lotes com erro (resultados parciais)` : "✅ Todos os lotes processados com sucesso"}

---

## 📋 Funil de Conversão (por categoria)

| Categoria | Qtd | % | Chats (amostra) |
| :--- | :---: | :---: | :--- |
${catTable}

---

## 🚩 Objeções Mapeadas (por frequência)

| Objeção | Ocorrências | Chats |
| :--- | :---: | :--- |
${objTable}

---

## 💡 Sentimento Geral
${sentLine}

---

## 🔍 Citações para Verificação
${topCitations}

---

## 📦 Dados Brutos (JSON)
As ${agg.total} classificações individuais estão disponíveis no JSON abaixo para cruzamento:

\`\`\`json
${JSON.stringify(classifications, null, 1)}
\`\`\``;
}

// ─────────────────────────────────────────────────────────────────────────────
// TOOL PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

export const analyzeRawConversationsTool = new DynamicStructuredTool({
  name: "analyze_raw_conversations",
  description: `Lê e analisa as mensagens BRUTAS diretamente da tabela chat_messages.
Use esta ferramenta para QUALQUER análise qualitativa: objeções, padrões de atendimento,
script da secretária, sentimento dos pacientes, gargalos, funil de conversão, etc.
NÃO depende de tabelas intermediárias — vai direto na fonte.
ACEITA MÚLTIPLOS OBJETIVOS numa única chamada.

IMPORTANTE: Quando o objetivo exige classificar CADA conversa individualmente
(ex: funil de conversão, "quantos agendaram", "classificar cada chat"),
ative per_chat_classification=true para usar o modo fan-out de alta precisão
que analisa cada conversa em paralelo e agrega os resultados.`,

  schema: z.object({
    start_date: z.string().describe("Data início YYYY-MM-DD (BRT)"),
    end_date: z.string().describe("Data fim YYYY-MM-DD (BRT)"),
    analysis_goals: z.array(z.string()).describe("Lista de objetivos de análise"),
    sender_filter: z.enum(["ALL", "CUSTOMER", "HUMAN_AGENT", "AI_AGENT"]).optional()
      .describe("Filtrar por remetente. Default: ALL"),
    include_metadata: z.boolean().optional().default(true),
    per_chat_classification: z.boolean().optional().default(false)
      .describe("Se true, classifica CADA conversa individualmente via fan-out paralelo. Use para funil, desfechos, ou quando precisa analisar cada chat."),
  }),

  func: async ({ start_date, end_date, analysis_goals, sender_filter, include_metadata, per_chat_classification }) => {
   try {
    const supabase = getSupabaseAdminClient();
    const startTs = `${start_date}T00:00:00-03:00`;
    const endTs = `${end_date}T23:59:59.999-03:00`;

    // ── PASSO 1: Carregar mensagens brutas com paginação ──
    let allMessages: RawChatMessage[] = [];
    let offset = 0;
    const BATCH = 1000;

    while (true) {
      let query = supabase
        .from("chat_messages")
        .select("id, chat_id, sender, message_text, created_at")
        .gte("created_at", startTs)
        .lte("created_at", endTs)
        .not("message_text", "is", null)
        .order("created_at", { ascending: true })
        .range(offset, offset + BATCH - 1);

      if (sender_filter && sender_filter !== "ALL") {
        query = query.eq("sender", sender_filter);
      }

      const { data, error } = await query;
      if (error) return `Erro ao buscar mensagens: ${error.message}`;
      if (!data || data.length === 0) break;
      allMessages = allMessages.concat(data);
      if (data.length < BATCH) break;
      offset += BATCH;
    }

    console.log(`[analyze_raw] ${start_date} → ${end_date} | sender=${sender_filter || "ALL"} | ${allMessages.length} msgs`);

    if (allMessages.length === 0) {
      const { count } = await supabase
        .from("chat_messages")
        .select("*", { count: "exact", head: true })
        .gte("created_at", startTs)
        .lte("created_at", endTs);
      return `DEBUG: 0 msgs com filtros, count total = ${count ?? "null"}. Params: ${startTs} → ${endTs}, sender=${sender_filter || "ALL"}.`;
    }

    // ── PASSO 2: Nomes dos chats ──
    const chatNames: Record<number, string> = {};
    if (include_metadata) {
      const chatIds = [...new Set(allMessages.map((m) => m.chat_id))];
      for (let i = 0; i < chatIds.length; i += 100) {
        const batch = chatIds.slice(i, i + 100);
        const { data } = await supabase.from("chats").select("id, contact_name, phone").in("id", batch);
        if (data) {
          (data as ChatInfo[]).forEach((c) => {
            chatNames[c.id] = `${c.contact_name || "Sem nome"} (${c.phone || "sem tel"})`;
          });
        }
      }
    }

    // ── PASSO 3: Formatação ──
    const formatMessage = (m: RawChatMessage) => {
      const date = new Date(m.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
      const label = normalizeSender(m.sender);
      const ref = include_metadata ? ` [[chat:${m.chat_id}|${chatNames[m.chat_id] || m.chat_id}]]` : "";
      return `[${date}] ${label}${ref}: ${m.message_text}`;
    };

    // ── PASSO 4: Decidir estratégia ──
    const totalChars = allMessages.reduce((sum, m) => sum + (m.message_text?.length || 0), 0);
    const approxTokens = Math.ceil(totalChars / 3);
    const uniqueChatsCount = new Set(allMessages.map((m) => m.chat_id)).size;
    const strategy = detectStrategy(analysis_goals, approxTokens, uniqueChatsCount, per_chat_classification ?? false);

    console.log(`[analyze_raw] Strategy: ${strategy} | ${uniqueChatsCount} chats | ~${approxTokens.toLocaleString()} tokens`);

    // ═══════════════════════════════════════════════════════════════════════
    // ESTRATÉGIA A: FAN-OUT (classificação individual de cada conversa)
    // ═══════════════════════════════════════════════════════════════════════
    if (strategy === "fan_out_classify") {
      const batches = buildBatches(allMessages, chatNames, formatMessage);
      console.log(`[fan_out] ${uniqueChatsCount} chats → ${batches.length} lotes de ~${Math.ceil(uniqueChatsCount / batches.length)} chats`);

      const { classifications, errors } = await fanOutAnalyze(
        batches, analysis_goals, { start: start_date, end: end_date }, chatNames
      );

      console.log(`[fan_out] Concluído: ${classifications.length} classificados, ${errors} erros`);
      return formatFanOutResult(classifications, errors, batches.length, allMessages.length, { start: start_date, end: end_date });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ESTRATÉGIA B: SINGLE PASS (análise agregada em uma chamada)
    // ═══════════════════════════════════════════════════════════════════════
    const model = new ChatGoogleGenerativeAI({
      model: "gemini-2.5-flash",
      apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
      temperature: 0.1,
    });

    const goalsFormatted = analysis_goals.map((g, i) => `OBJETIVO ${i + 1}: ${g}`).join("\n");

    const ANALYSIS_PROMPT = `Você é uma analista de dados especializada em atendimento médico.

OBJETIVOS DA ANÁLISE:
${goalsFormatted}

REGRAS ABSOLUTAS:
1. Use APENAS os dados fornecidos. NÃO invente.
2. Cite mensagens reais como evidência (trecho exato entre aspas).
3. Preserve links [[chat:ID|Nome]].
4. Quantifique tudo: "X de Y conversas mencionaram..."
5. Se não encontrar dados, diga claramente.
6. Organize com seções em Markdown, UMA POR OBJETIVO.
7. Inclua "📊 Resumo Quantitativo" ao final.
8. Inclua "🔍 CITAÇÕES PARA VERIFICAÇÃO" com 5 citações: [chat_id]|[trecho]|[sender]

PERÍODO: ${start_date} a ${end_date}
TOTAL: ${allMessages.length} mensagens de ${uniqueChatsCount} chats
`;

    let analysisResult: string;
    let method: string;

    const SINGLE_PASS_LIMIT = 200_000;

    if (approxTokens <= SINGLE_PASS_LIMIT) {
      method = "single_pass";
      const transcript = allMessages.map(formatMessage).join("\n");
      try {
        const response = await model.invoke([
          { role: "system", content: ANALYSIS_PROMPT },
          { role: "user", content: `TRANSCRIÇÃO (${allMessages.length} msgs):\n\n${transcript}\n\nAnalise conforme os objetivos.` },
        ]);
        analysisResult = typeof response.content === "string" ? response.content : "";
      } catch (geminiErr: unknown) {
        const errMsg = geminiErr instanceof Error ? geminiErr.message : String(geminiErr);
        console.error(`[analyze_raw] Gemini single_pass error: ${errMsg}`);
        return `Erro: ${errMsg.slice(0, 200)}. Base: ${allMessages.length} msgs de ${uniqueChatsCount} chats.`;
      }
    } else {
      // ═══════════════════════════════════════════════════════════════════
      // ESTRATÉGIA C: CHUNKED MAP-REDUCE
      // ═══════════════════════════════════════════════════════════════════
      method = "chunked_map_reduce";
      const CHARS_PER_CHUNK = 150_000 * 3;
      const messagesByChat: Record<number, RawChatMessage[]> = {};
      for (const msg of allMessages) {
        if (!messagesByChat[msg.chat_id]) messagesByChat[msg.chat_id] = [];
        messagesByChat[msg.chat_id].push(msg);
      }

      const chunks: RawChatMessage[][] = [];
      let currentChunk: RawChatMessage[] = [];
      let currentChars = 0;
      for (const chatId of Object.keys(messagesByChat).map(Number)) {
        const chatMsgs = messagesByChat[chatId];
        const chatChars = chatMsgs.reduce((sum, m) => sum + (m.message_text?.length || 0) + 80, 0);
        if (currentChars + chatChars > CHARS_PER_CHUNK && currentChunk.length > 0) {
          chunks.push(currentChunk);
          currentChunk = [];
          currentChars = 0;
        }
        currentChunk = currentChunk.concat(chatMsgs);
        currentChars += chatChars;
      }
      if (currentChunk.length > 0) chunks.push(currentChunk);

      const chunkResults = await Promise.all(
        chunks.map(async (chunk, i) => {
          const transcript = chunk.map(formatMessage).join("\n");
          const uniqueInChunk = new Set(chunk.map((m) => m.chat_id)).size;
          const response = await model.invoke([
            { role: "system", content: ANALYSIS_PROMPT + `\nCHUNK ${i + 1}/${chunks.length} (${uniqueInChunk} conversas). Retorne achados parciais.` },
            { role: "user", content: `TRANSCRIÇÃO (chunk ${i + 1}, ${chunk.length} msgs):\n\n${transcript}` },
          ]);
          return typeof response.content === "string" ? response.content : "";
        })
      );

      const reduceResponse = await model.invoke([
        { role: "system", content: `Consolide resultados de ${chunks.length} chunks.\n\nOBJETIVOS:\n${goalsFormatted}\n\nREGRAS: Some quantidades, não duplique, preserve citações [[chat:ID|Nome]].` },
        { role: "user", content: chunkResults.map((r, i) => `=== CHUNK ${i + 1} ===\n${r}`).join("\n\n") + "\n\nConsolide." },
      ]);

      analysisResult = typeof reduceResponse.content === "string" ? reduceResponse.content : "";
      method = `map_reduce (${chunks.length} chunks)`;
    }

    // ── Citações para spot-check ──
    const citationRegex = /\[(\d+)\]\|(.+?)\|(\w+)/g;
    const citations: string[] = [];
    let match;
    while ((match = citationRegex.exec(analysisResult)) !== null) {
      citations.push(JSON.stringify({ chat_id: parseInt(match[1]), text: match[2], sender: match[3] }));
    }

    return `📅 Período: ${start_date} a ${end_date}
📊 Base: ${allMessages.length} msgs de ${uniqueChatsCount} conversas
⚙️ Método: ${method}
🔍 ~${approxTokens.toLocaleString()} tokens | Citações: ${citations.length}

---

${analysisResult}

---
__SPOT_CHECK_DATA__: ${JSON.stringify(citations.slice(0, 5))}`;
   } catch (outerErr: unknown) {
     const msg = outerErr instanceof Error ? outerErr.message : String(outerErr);
     console.error(`[analyze_raw] ERRO FATAL: ${msg}`);
     return `ERRO: ${msg.slice(0, 500)}`;
   }
  },
});
