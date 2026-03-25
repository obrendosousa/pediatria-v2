/**
 * Chat Classification Cron — classificação automática de chats a cada 15 minutos.
 *
 * Roda a cada 60s no RobustCronManager, mas internamente checa se passaram
 * 15 minutos desde a última execução (debounce).
 *
 * Ações:
 * - Encontra chats que precisam de classificação (nunca classificados, reclassificação pendente, novos msgs)
 * - Chama classifyChats() do classification_engine
 * - Upsert resultados no chat_insights
 */

import { createClient } from "@supabase/supabase-js";
import { classifyChats } from "@/ai/clara/classification_engine";
import type { ClassificationResult } from "@/ai/clara/classification_engine";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

function getClassificationSupabase(): AnySupabase {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars nao configuradas");
  return createClient(url, key, { auth: { persistSession: false } });
}

// State — debounce para garantir intervalo mínimo de 15 minutos
let lastClassificationRun = 0;
const INTERVAL_MS = 15 * 60 * 1000; // 15 minutos
const MAX_CHATS_PER_RUN = 50;

/**
 * Encontra chats que precisam de (re)classificação.
 * Critérios:
 * 1. chat_insights.classified_at IS NULL (nunca classificado)
 * 2. chat_insights.needs_reclassification = true
 * 3. Chats com novas mensagens desde última classificação
 */
async function findChatsToClassify(supabase: AnySupabase): Promise<number[]> {
  const chatIds = new Set<number>();

  // 1. Nunca classificados — chats com insights mas sem classified_at
  const { data: unclassified } = await supabase
    .from("chat_insights")
    .select("chat_id")
    .is("classified_at", null)
    .limit(MAX_CHATS_PER_RUN);

  if (unclassified) {
    for (const row of unclassified as { chat_id: number }[]) {
      chatIds.add(row.chat_id);
    }
  }

  if (chatIds.size >= MAX_CHATS_PER_RUN) return Array.from(chatIds).slice(0, MAX_CHATS_PER_RUN);

  // 2. Reclassificação pendente
  const { data: needsReclass } = await supabase
    .from("chat_insights")
    .select("chat_id")
    .eq("needs_reclassification", true)
    .limit(MAX_CHATS_PER_RUN - chatIds.size);

  if (needsReclass) {
    for (const row of needsReclass as { chat_id: number }[]) {
      chatIds.add(row.chat_id);
    }
  }

  if (chatIds.size >= MAX_CHATS_PER_RUN) return Array.from(chatIds).slice(0, MAX_CHATS_PER_RUN);

  // 3. Chats com novas mensagens desde última classificação
  // Busca chats onde o message_count atual > message_count_at_classification
  const { data: stale } = await supabase.rpc("find_stale_classified_chats", {
    max_results: MAX_CHATS_PER_RUN - chatIds.size,
  }).catch(() => ({ data: null }));

  // Fallback se a RPC não existir: buscar chats recentes com classificação antiga
  if (!stale) {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentChats } = await supabase
      .from("chat_insights")
      .select("chat_id, message_count_at_classification")
      .not("classified_at", "is", null)
      .lt("classified_at", twentyFourHoursAgo)
      .order("classified_at", { ascending: true })
      .limit(MAX_CHATS_PER_RUN - chatIds.size);

    if (recentChats) {
      // Para cada um, verificar se tem novas mensagens
      for (const row of recentChats as { chat_id: number; message_count_at_classification: number | null }[]) {
        const { count } = await supabase
          .from("chat_messages")
          .select("*", { count: "exact", head: true })
          .eq("chat_id", row.chat_id);

        if (count && (!row.message_count_at_classification || count > row.message_count_at_classification)) {
          chatIds.add(row.chat_id);
          if (chatIds.size >= MAX_CHATS_PER_RUN) break;
        }
      }
    }
  } else {
    for (const row of stale as { chat_id: number }[]) {
      chatIds.add(row.chat_id);
    }
  }

  return Array.from(chatIds).slice(0, MAX_CHATS_PER_RUN);
}

/**
 * Upsert classificações no chat_insights.
 */
async function upsertClassifications(
  supabase: AnySupabase,
  classifications: ClassificationResult[]
): Promise<{ success: number; errors: number }> {
  let success = 0;
  let errors = 0;

  for (const c of classifications) {
    // Contar mensagens atuais do chat
    const { count: msgCount } = await supabase
      .from("chat_messages")
      .select("*", { count: "exact", head: true })
      .eq("chat_id", c.chat_id);

    const now = new Date().toISOString();

    const { error } = await supabase
      .from("chat_insights")
      .upsert(
        {
          chat_id: c.chat_id,
          categoria: c.categoria,
          ai_sentiment: c.sentimento,
          desfecho: c.desfecho,
          citacao_chave: c.citacao_chave,
          objecoes: c.objecoes,
          classified_at: now,
          classified_by: "classification_engine",
          message_count_at_classification: msgCount || 0,
          needs_reclassification: false,
          updated_at: now,
        },
        { onConflict: "chat_id" }
      );

    if (error) {
      console.error(`[chatClassificationCron] Erro ao upsert chat_id=${c.chat_id}: ${error.message}`);
      errors++;
    } else {
      success++;
    }
  }

  return { success, errors };
}

/**
 * Task principal — chamada pelo RobustCronManager a cada 60s.
 * Executa classificação de chats a cada 15 minutos.
 */
export async function chatClassificationTask(): Promise<void> {
  const now = Date.now();

  // Debounce: esperar pelo menos 15 minutos entre execuções
  if (now - lastClassificationRun < INTERVAL_MS) return;

  const supabase = getClassificationSupabase();

  // Encontrar chats que precisam de classificação
  const chatIds = await findChatsToClassify(supabase);

  if (chatIds.length === 0) {
    // Nada para classificar — atualizar timestamp mesmo assim para evitar busca constante
    lastClassificationRun = now;
    return;
  }

  console.log(`[Worker][Chat Classification] Classificando ${chatIds.length} chats...`);
  lastClassificationRun = now;

  try {
    // Classificar
    const classifications = await classifyChats(chatIds, {
      batchSize: 12,
      onProgress: (batch, total) => {
        console.log(`[Worker][Chat Classification] Batch ${batch}/${total}`);
      },
    });

    if (classifications.length === 0) {
      console.warn("[Worker][Chat Classification] Nenhuma classificação retornada");
      return;
    }

    // Upsert resultados
    const { success, errors } = await upsertClassifications(supabase, classifications);

    console.log(
      `[Worker][Chat Classification] Concluído: ${success} classificados, ${errors} erros ` +
      `(${chatIds.length} chats processados)`
    );
  } catch (err) {
    console.error("[Worker][Chat Classification] Erro:", (err as Error).message);
    // Não resetar lastClassificationRun para não entrar em loop de erro
  }
}
