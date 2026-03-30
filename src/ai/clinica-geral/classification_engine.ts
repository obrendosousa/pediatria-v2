// ===================================================================
// Classification Engine -- modulo reutilizavel de classificacao de chats.
// Extraido do raw_data_analyzer.ts para uso compartilhado entre:
//   - analyze_raw_conversations (tool interativa)
//   - chatClassificationCron (classificacao automatica a cada 15min)
//   - dailyKpiCron (agregacao diaria de KPIs)
// Adaptado para schema atendimento (clinica-geral).
// ===================================================================

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { z } from "zod";
import { createSchemaAdminClient } from "@/lib/supabase/schemaServer";

// ---------------------------------------------------------------------------
// TIPOS
// ---------------------------------------------------------------------------

export interface ClassificationResult {
  chat_id: number;
  categoria: string;
  sentimento: string;
  desfecho: string;
  objecao_principal: string;
  objecoes: string[];
  citacao_chave: string;
  nota_atendimento: number;
}

export const CATEGORIAS = [
  "agendamento_confirmado",
  "retorno_confirmado",
  "objecao_preco",
  "objecao_vaga",
  "objecao_distancia",
  "objecao_especialidade",
  "urgencia_atendida",
  "urgencia_nao_atendida",
  "ghosting",
  "informacao_apenas",
  "encaminhamento_externo",
  "em_andamento",
  "sem_resposta_clinica",
] as const;

export type Categoria = (typeof CATEGORIAS)[number];

interface RawChatMessage {
  id: number;
  chat_id: number;
  sender: string | null;
  message_text: string | null;
  created_at: string;
}

interface ChatTranscript {
  chat_id: number;
  contact_name: string;
  transcript: string;
  messageCount: number;
}

interface BatchPayload {
  batchIndex: number;
  totalBatches: number;
  chats: ChatTranscript[];
}

interface BatchResult {
  batchIndex: number;
  classifications: ClassificationResult[];
  error?: string;
}

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

function normalizeSender(sender: string | null): string {
  const s = String(sender ?? "").toUpperCase();
  if (s === "HUMAN_AGENT" || s === "ME") return "SECRETARIA";
  if (s === "AI_AGENT") return "BOT";
  return "PACIENTE";
}

function formatMessage(m: RawChatMessage): string {
  const date = new Date(m.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const label = normalizeSender(m.sender);
  return `[${date}] ${label}: ${m.message_text}`;
}

// ---------------------------------------------------------------------------
// SCHEMA DE CLASSIFICACAO (Gemini structured output)
// ---------------------------------------------------------------------------

const classificationSchema = z.object({
  classificacoes: z.array(z.object({
    chat_id: z.number(),
    categoria: z.string().describe(`Uma de: ${CATEGORIAS.join(", ")}`),
    sentimento: z.enum(["positivo", "neutro", "negativo"]),
    desfecho: z.string().describe("O que aconteceu no final da conversa (1 frase)"),
    objecao_principal: z.string().describe("Objecao principal identificada (vazio se nao houver)"),
    objecoes: z.array(z.string()).describe("Lista de objecoes identificadas (vazio se nao houver)"),
    citacao_chave: z.string().describe("Trecho mais relevante da conversa (copia exata)"),
    nota_atendimento: z.number().min(0).max(10).describe("Nota de 0-10 para qualidade do atendimento da clinica"),
  })),
});

// ---------------------------------------------------------------------------
// CLASSIFICACAO DE UM BATCH
// ---------------------------------------------------------------------------

const CLASSIFICATION_PROMPT = `Voce e um analista de atendimento de clinica medica. Classifique CADA conversa.

CATEGORIAS POSSIVEIS:
- agendamento_confirmado: paciente forneceu dados e confirmou consulta
- retorno_confirmado: paciente existente voltando para nova consulta
- objecao_preco: desistiu/hesitou por causa do valor
- objecao_vaga: queria atendimento imediato sem disponibilidade
- objecao_distancia: desistiu por distancia/logistica
- objecao_especialidade: procurava especialidade nao disponivel
- urgencia_atendida: caso urgente que foi resolvido
- urgencia_nao_atendida: caso urgente sem resolucao
- ghosting: paciente sumiu apos interacao inicial
- informacao_apenas: so perguntou valor/horario sem intencao clara
- encaminhamento_externo: encaminhado para outro local/servico
- em_andamento: conversa ainda em curso, sem desfecho claro
- sem_resposta_clinica: clinica nao respondeu o paciente

REGRAS:
1. Retorne EXATAMENTE uma classificacao por conversa
2. Use o chat_id exato fornecido
3. Baseie-se APENAS no texto -- NAO invente
4. Se paciente forneceu nome+data nascimento e confirmou = agendamento_confirmado
5. Se pediu encaixe/urgencia e nao teve vaga = objecao_vaga
6. Copie trecho REAL na citacao_chave
7. nota_atendimento: 0 = pessimo (sem resposta), 5 = mediano, 10 = excelente
8. objecao_principal: a objecao mais forte; vazio se nao houver objecoes`;

async function classifyBatch(
  batch: BatchPayload,
  model: ChatGoogleGenerativeAI
): Promise<BatchResult> {
  const transcripts = batch.chats
    .map(
      (c) =>
        `=== CONVERSA chat_id=${c.chat_id} | ${c.contact_name} (${c.messageCount} msgs) ===\n${c.transcript}`
    )
    .join("\n\n");

  try {
    const structured = model.withStructuredOutput(classificationSchema);
    const result = await structured.invoke([
      { role: "system", content: `${CLASSIFICATION_PROMPT}\n\nLOTE: ${batch.batchIndex + 1}/${batch.totalBatches} (${batch.chats.length} conversas)` },
      { role: "user", content: `Classifique:\n\n${transcripts}` },
    ]);

    return {
      batchIndex: batch.batchIndex,
      classifications: result.classificacoes.map((c) => ({
        chat_id: c.chat_id,
        categoria: c.categoria,
        sentimento: c.sentimento,
        desfecho: c.desfecho,
        objecao_principal: c.objecao_principal || "",
        objecoes: c.objecoes || [],
        citacao_chave: c.citacao_chave || "",
        nota_atendimento: c.nota_atendimento,
      })),
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[classification_engine] Batch ${batch.batchIndex + 1} error: ${msg.substring(0, 200)}`);

    // Se falhou por tamanho, dividir em 2 e tentar de novo
    if (batch.chats.length > 3 && (msg.includes("token") || msg.includes("limit") || msg.includes("size"))) {
      const mid = Math.ceil(batch.chats.length / 2);
      const a: BatchPayload = { ...batch, chats: batch.chats.slice(0, mid) };
      const b: BatchPayload = { ...batch, chats: batch.chats.slice(mid) };
      const [ra, rb] = await Promise.all([
        classifyBatch(a, model),
        classifyBatch(b, model),
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

// ---------------------------------------------------------------------------
// FUNCAO PRINCIPAL: classifyChats
// ---------------------------------------------------------------------------

export interface ClassifyChatsOptions {
  batchSize?: number;
  onProgress?: (batch: number, total: number) => void;
}

/**
 * Classifica uma lista de chats por ID.
 * 1. Carrega mensagens do Supabase (schema atendimento)
 * 2. Agrupa em batches de ~12 chats
 * 3. Chama gemini-3.1-flash-lite-preview para cada batch
 * 4. Retorna classificacoes estruturadas
 */
export async function classifyChats(
  chatIds: number[],
  options?: ClassifyChatsOptions
): Promise<ClassificationResult[]> {
  if (chatIds.length === 0) return [];

  const batchSize = options?.batchSize ?? 12;
  const onProgress = options?.onProgress;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSchemaAdminClient("atendimento") as any;

  // 1. Carregar mensagens para os chat_ids
  let allMessages: RawChatMessage[] = [];
  const FETCH_BATCH = 1000;

  for (let offset = 0; ; offset += FETCH_BATCH) {
    const { data, error } = await supabase
      .from("chat_messages")
      .select("id, chat_id, sender, message_text, created_at")
      .in("chat_id", chatIds)
      .not("message_text", "is", null)
      .order("created_at", { ascending: true })
      .range(offset, offset + FETCH_BATCH - 1);

    if (error) {
      console.error(`[classification_engine] Erro ao buscar mensagens: ${error.message}`);
      return [];
    }
    if (!data || data.length === 0) break;
    allMessages = allMessages.concat(data as RawChatMessage[]);
    if (data.length < FETCH_BATCH) break;
  }

  if (allMessages.length === 0) {
    console.warn(`[classification_engine] Nenhuma mensagem encontrada para ${chatIds.length} chats`);
    return [];
  }

  // 2. Buscar nomes dos contatos
  const chatNames: Record<number, string> = {};
  for (let i = 0; i < chatIds.length; i += 100) {
    const batch = chatIds.slice(i, i + 100);
    const { data } = await supabase.from("chats").select("id, contact_name, phone").in("id", batch);
    if (data) {
      for (const c of data as { id: number; contact_name: string | null; phone: string | null }[]) {
        chatNames[c.id] = `${c.contact_name || "Sem nome"} (${c.phone || "sem tel"})`;
      }
    }
  }

  // 3. Agrupar mensagens por chat e construir transcripts
  const byChat: Record<number, RawChatMessage[]> = {};
  for (const msg of allMessages) {
    if (!byChat[msg.chat_id]) byChat[msg.chat_id] = [];
    byChat[msg.chat_id].push(msg);
  }

  // 4. Construir batches
  const MAX_CHARS = 240_000;
  const batches: BatchPayload[] = [];
  let current: ChatTranscript[] = [];
  let chars = 0;

  for (const chatId of Object.keys(byChat).map(Number)) {
    const msgs = byChat[chatId];
    // Limitar a 80 msgs por chat (suficiente para entender desfecho)
    const truncated = msgs.length > 80 ? msgs.slice(-80) : msgs;
    const transcript = truncated.map(formatMessage).join("\n");
    const len = transcript.length;

    if ((current.length >= batchSize || chars + len > MAX_CHARS) && current.length > 0) {
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

  console.log(`[classification_engine] ${chatIds.length} chats -> ${batches.length} batches de ~${batchSize}`);

  // 5. Classificar em paralelo (max 8 concorrentes)
  const model = new ChatGoogleGenerativeAI({
    model: "gemini-3.1-flash-lite-preview",
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
    temperature: 0.1,
  });

  const MAX_CONCURRENCY = 8;
  const results: BatchResult[] = [];

  for (let i = 0; i < batches.length; i += MAX_CONCURRENCY) {
    const window = batches.slice(i, i + MAX_CONCURRENCY);
    const windowResults = await Promise.all(
      window.map((b) => classifyBatch(b, model))
    );
    results.push(...windowResults);

    if (onProgress) {
      onProgress(Math.min(i + MAX_CONCURRENCY, batches.length), batches.length);
    }
  }

  const classifications = results.flatMap((r) => r.classifications);
  const errors = results.filter((r) => r.error).length;

  if (errors > 0) {
    console.warn(`[classification_engine] ${errors}/${batches.length} batches com erro`);
  }

  console.log(`[classification_engine] Concluido: ${classifications.length} chats classificados`);
  return classifications;
}
