import { getPersistedIngestionGraph } from "@/ai/ingestion/graph";
import { NextResponse } from "next/server";
import { EvolutionWebhookData } from "@/ai/ingestion/state";
import { createClient } from "@supabase/supabase-js";

const DEBUG_LOG_ENDPOINT = "http://127.0.0.1:7242/ingest/4058191e-4081-4adb-b80d-3c22067fcea5";
const debugLog = (payload: Record<string, unknown>) =>
  fetch(DEBUG_LOG_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {});

// Política anti-restauração: após reconnect, ignora backlog/histórico e segue apenas mensagens novas.
const INGESTION_START_TS_MS = Date.now();
const INCOMING_CLOCK_SKEW_MS = 30_000;

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase não configurado");
  return createClient(url, key);
}

/** Converte status da Evolution/Baileys para nosso formato */
function mapEvolutionStatus(raw: unknown): "sent" | "delivered" | "read" | null {
  const v = String(raw ?? "").toUpperCase();
  const n = Number(raw);
  if (n === 3 || v === "DELIVERED" || v === "DELIVERED_ACK" || v === "DELIVERY_ACK") return "delivered";
  if (n === 4 || v === "READ" || v === "READ_ACK" || v === "PLAYED") return "read";
  if (n === 2 || n === 1 || v === "SENT" || v === "ACK" || v === "SERVER" || v === "SERVER_ACK") return "sent";
  return null;
}

type UpdateItem = {
  key: Record<string, unknown>;
  status: unknown;
  editedText?: string | null;
};

function extractTextFromAnyMessage(messageLike: unknown): string | null {
  if (!messageLike || typeof messageLike !== "object") return null;
  const m = messageLike as Record<string, any>;
  const editedMessage = m.editedMessage?.message ?? m.editedMessage;
  const candidates = [
    m.conversation,
    m.text,
    m.extendedTextMessage?.text,
    m.imageMessage?.caption,
    m.videoMessage?.caption,
    editedMessage?.conversation,
    editedMessage?.text,
    editedMessage?.extendedTextMessage?.text,
    m.message?.conversation,
    m.message?.extendedTextMessage?.text,
  ];
  const text = candidates.find((v) => typeof v === "string" && v.trim().length > 0);
  return typeof text === "string" ? text.trim() : null;
}

function extractUpdateItems(body: Record<string, unknown>): UpdateItem[] {
  const items: UpdateItem[] = [];
  const data = body.data as Record<string, unknown> | undefined;

  // Lógica de extração de atualizações de status
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const d = data as Record<string, unknown>;
    
    // CORREÇÃO 1: Cast explícito de d.key para objeto antes de acessar .id
    const keyObj = d.key as Record<string, unknown> | undefined;
    const id = d.keyId ?? keyObj?.id ?? body.keyId;
    
    const status = d.status ?? body.status;
    const fromMe = d.fromMe ?? keyObj?.fromMe ?? body.fromMe;
    const editedText = extractTextFromAnyMessage(d.message ?? d.update ?? body.message);

    if (id && (status !== undefined || editedText)) {
      items.push({
        key: { id, fromMe, remoteJid: d.remoteJid ?? keyObj?.remoteJid },
        status,
        editedText,
      });
      return items;
    }
  }

  const updatesArr = (data?.updates ?? body.updates ?? (Array.isArray(data) ? data : undefined)) as unknown[] | undefined;
  if (Array.isArray(updatesArr)) {
    for (const item of updatesArr) {
      const obj = item as Record<string, unknown>;
      const key = (obj.key ?? obj) as Record<string, unknown>;
      const update = obj.update as Record<string, unknown> | undefined;
      const status = update?.status ?? obj.status;
      const editedText = extractTextFromAnyMessage(
        update?.message ?? obj.message ?? update?.editedMessage ?? obj.editedMessage
      );
      const id = key?.id ?? key?.keyId ?? obj.keyId;
      if (id && (status !== undefined || editedText)) {
        items.push({
          key: { id, fromMe: key?.fromMe ?? obj.fromMe, remoteJid: key?.remoteJid ?? obj.remoteJid },
          status,
          editedText,
        });
      }
    }
    if (items.length > 0) return items;
  }

  // Fallback
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    const key = (d.key ?? body.key) as Record<string, unknown> | undefined;
    const update = d.update as Record<string, unknown> | undefined;
    const status = update?.status ?? d.status ?? body.status;
    const editedText = extractTextFromAnyMessage(update?.message ?? d.message ?? body.message);
    const id = key?.id ?? key?.keyId ?? d.keyId;
    if (id && (status !== undefined || editedText)) {
      items.push({
        key: { id, fromMe: key?.fromMe ?? d.fromMe, remoteJid: key?.remoteJid ?? d.remoteJid },
        status,
        editedText,
      });
    }
  }

  return items;
}

async function handleMessagesUpdate(body: Record<string, unknown>) {
  const supabase = getSupabase();
  const items = extractUpdateItems(body);

  for (const { key, status: statusRaw, editedText } of items) {
    const mapped = mapEvolutionStatus(statusRaw);
    const hasEditedText = typeof editedText === "string" && editedText.trim().length > 0;
    if (!mapped && !hasEditedText) continue;

    const wppId = String(key.id ?? "").trim();
    // Permite atualização de status
    const fromMe = Boolean(key.fromMe ?? key.from_me);
    
    if (!wppId) continue;

    const { data: existing, error: existingError } = await supabase
      .from("chat_messages")
      .select("chat_id, tool_data")
      .eq("wpp_id", wppId)
      .limit(1)
      .maybeSingle();

    if (existingError) {
      console.warn("[MESSAGES_UPDATE] Erro DB (fetch):", existingError.message);
      continue;
    }

    if (!existing) continue;

    const updatePayload: Record<string, unknown> = {};
    if (mapped) {
      updatePayload.status = mapped;
    }
    if (hasEditedText) {
      const prevToolData =
        existing.tool_data && typeof existing.tool_data === "object"
          ? (existing.tool_data as Record<string, unknown>)
          : {};
      updatePayload.message_text = editedText!.trim();
      updatePayload.is_edited = true;
      updatePayload.edited_at = new Date().toISOString();
      updatePayload.tool_data = {
        ...prevToolData,
        is_edited: true,
        edited_at: new Date().toISOString(),
      };
    }

    if (Object.keys(updatePayload).length === 0) continue;

    const { error: updateError } = await supabase
      .from("chat_messages")
      .update(updatePayload)
      .eq("wpp_id", wppId);

    if (updateError) {
      console.warn("[MESSAGES_UPDATE] Erro DB (update):", updateError.message);
      continue;
    }

    if (existing.chat_id && mapped) {
      await supabase
        .from("chats")
        .update({ last_message_status: mapped })
        .eq("id", existing.chat_id);
    }
  }
}

async function replaceWithRevokedTombstoneByWppId(targetWppId: string) {
  const supabase = getSupabase();
  const normalized = String(targetWppId || "").trim();
  if (!normalized) return false;

  const { data: original, error: fetchErr } = await supabase
    .from("chat_messages")
    .select("id, message_type")
    .eq("wpp_id", normalized)
    .maybeSingle();

  if (fetchErr || !original) {
    if (fetchErr) console.error("[REVOKE] Erro ao buscar:", fetchErr);
    else console.warn(`[REVOKE] Mensagem wpp_id ${normalized} não encontrada.`);
    return false;
  }

  // Idempotência: se já estiver revogada, não recria popup/tombstone.
  if (original.message_type === "revoked") {
    return true;
  }

  const { error: updErr } = await supabase
    .from("chat_messages")
    .update({
      message_text: "",
      message_type: "revoked",
      media_url: null,
    })
    .eq("id", original.id);

  if (updErr) {
    console.error("[REVOKE] Erro ao marcar como revogada:", updErr);
    return false;
  }

  console.log(`[REVOKE] Sucesso. Mensagem ${original.id} marcada como revogada.`);
  return true;
}

function extractDeleteIds(body: Record<string, unknown>): string[] {
  const ids = new Set<string>();
  const data = body.data as Record<string, unknown> | unknown[] | undefined;

  const pushId = (value: unknown) => {
    const v = String(value ?? "").trim();
    if (v) ids.add(v);
  };

  const pushFromObj = (obj: Record<string, unknown>) => {
    pushId(obj.id);
    pushId(obj.keyId);
    const key = obj.key as Record<string, unknown> | undefined;
    if (key) pushId(key.id);
  };

  if (data && typeof data === "object" && !Array.isArray(data)) {
    pushFromObj(data as Record<string, unknown>);
    const keys = (data as Record<string, unknown>).keys as unknown[] | undefined;
    if (Array.isArray(keys)) {
      keys.forEach((k) => {
        if (k && typeof k === "object") pushFromObj(k as Record<string, unknown>);
        else pushId(k);
      });
    }
  }

  if (Array.isArray(data)) {
    data.forEach((item) => {
      if (item && typeof item === "object") pushFromObj(item as Record<string, unknown>);
      else pushId(item);
    });
  }

  const messages = body.messages as unknown[] | undefined;
  if (Array.isArray(messages)) {
    messages.forEach((item) => {
      if (item && typeof item === "object") pushFromObj(item as Record<string, unknown>);
      else pushId(item);
    });
  }

  pushId(body.id);
  pushId(body.keyId);

  return [...ids];
}

async function handleMessagesDelete(body: Record<string, unknown>) {
  const ids = extractDeleteIds(body);
  for (const id of ids) {
    await replaceWithRevokedTombstoneByWppId(id);
  }
}

async function alreadyProcessedByWppId(wppId: string): Promise<boolean> {
  const supabase = getSupabase();
  const id = String(wppId || "").trim();
  if (!id) return false;
  const { data, error } = await supabase
    .from("chat_messages")
    .select("id")
    .eq("wpp_id", id)
    .limit(1)
    .maybeSingle();
  if (error) return false;
  return Boolean(data?.id);
}

// --- Lógica de Revogação Blindada ---
async function handleRevokeMessage(message: EvolutionWebhookData) {
  const msgContent = message.message as Record<string, any>;
  const protocolMsg = msgContent?.protocolMessage;

  // Se não tem protocolMessage, retorna false para seguir fluxo normal
  if (!protocolMsg) return false;

  const protocolType = protocolMsg.type;
  const isRevoke =
    protocolType === 0 ||
    String(protocolType ?? "").toUpperCase() === "REVOKE";

  if (isRevoke && protocolMsg.key?.id) {
    const targetWppId = String(protocolMsg.key.id).trim();
    console.log(`[REVOKE] Apagando mensagem wpp_id: ${targetWppId}`);
    await replaceWithRevokedTombstoneByWppId(targetWppId);
  }

  // Retorna true para impedir processamento duplicado
  return true; 
}

function detectMessageType(message: unknown): string {
  const msg = (message ?? {}) as Record<string, unknown>;
  if (msg.protocolMessage) return "protocolMessage";
  if (msg.reactionMessage) return "reactionMessage";
  if (msg.audioMessage) return "audioMessage";
  if (msg.imageMessage) return "imageMessage";
  if (msg.videoMessage) return "videoMessage";
  if (msg.stickerMessage) return "stickerMessage";
  if (msg.documentMessage) return "documentMessage";
  if (msg.extendedTextMessage || msg.conversation) return "conversation";
  return "unknown";
}

/** Detecta se a mensagem foi encaminhada (contextInfo.forwarded - Baileys/Evolution) */
function isMessageForwarded(message: unknown): boolean {
  if (!message || typeof message !== "object") return false;
  const msg = message as Record<string, unknown>;
  const contextInfo =
    msg.contextInfo ??
    (msg.extendedTextMessage as Record<string, unknown> | undefined)?.contextInfo ??
    (msg.imageMessage as Record<string, unknown> | undefined)?.contextInfo ??
    (msg.videoMessage as Record<string, unknown> | undefined)?.contextInfo ??
    (msg.audioMessage as Record<string, unknown> | undefined)?.contextInfo ??
    (msg.documentMessage as Record<string, unknown> | undefined)?.contextInfo;
  if (!contextInfo || typeof contextInfo !== "object") return false;
  const ctx = contextInfo as Record<string, unknown>;
  return ctx.forwarded === true || ctx.forwarded === "true";
}

function toRemoteJid(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (raw.includes("@")) return raw;
  const digits = raw.replace(/\D/g, "");
  return digits ? `${digits}@s.whatsapp.net` : "";
}

function normalizeMessagesFromWebhook(body: unknown): EvolutionWebhookData[] {
  const payload = (body ?? {}) as Record<string, unknown>;
  const data = payload.data as unknown;
  const sources: unknown[] = [];

  if (data && typeof data === "object" && !Array.isArray(data)) {
    const dataObj = data as Record<string, unknown>;
    if (dataObj.key) sources.push(dataObj);
    if (Array.isArray(dataObj.messages)) sources.push(...(dataObj.messages as unknown[]));
  }

  if (Array.isArray(data)) sources.push(...data);
  if (Array.isArray(payload.messages)) sources.push(...(payload.messages as unknown[]));

  const normalized: EvolutionWebhookData[] = [];

  for (const source of sources) {
    if (!source || typeof source !== "object") continue;
    const item = source as Record<string, unknown>;
    const keyRaw =
      (item.key as Record<string, unknown> | undefined) ??
      ({
        remoteJid: item.keyRemoteJid ?? item.remoteJid,
        fromMe: item.keyFromMe ?? item.fromMe,
        id: item.keyId ?? item.id ?? "",
      } as Record<string, unknown>);

    const remoteJid = toRemoteJid(
      keyRaw.remoteJid ??
        item.remoteJid ??
        item.jid ??
        item.from ??
        item.sender ??
        item.number ??
        item.phone
    );
    
    if (!remoteJid) continue;
    
    // --- NOVO FILTRO: IGNORAR STATUS/STORIES ---
    if (remoteJid === "status@broadcast") {
      console.log(`[WEBHOOK] Ignorando status/stories (status@broadcast)`);
      continue;
    }

    const messageValue = (item.message ?? item.content ?? {}) as unknown;
    
    const detectedType = detectMessageType(messageValue);
    const messageTypeValue = (item.messageType ?? item.contentType ?? detectedType) as string;
    
    const timestampValue = (item.messageTimestamp ?? item.timestamp ?? Date.now()) as number | string;
    const forwarded = isMessageForwarded(messageValue);

    normalized.push({
      key: {
        remoteJid,
        fromMe: Boolean(keyRaw.fromMe),
        id: String(keyRaw.id ?? ""),
      },
      pushName: typeof item.pushName === "string" ? item.pushName : undefined,
      messageType: messageTypeValue,
      message: messageValue,
      messageTimestamp: timestampValue,
      base64: typeof item.base64 === "string" ? item.base64 : undefined,
      ...(forwarded ? { isForwarded: true } : {}),
    });
  }

  return normalized;
}

function extractPhoneFromRemoteJid(remoteJid?: string | null): string | null {
  const raw = String(remoteJid ?? "").trim();
  if (!raw) return null;
  const beforeAt = raw.includes("@") ? raw.split("@")[0] : raw;
  const digits = beforeAt.replace(/\D/g, "");
  return digits || null;
}

async function upsertReactionMessage(message: EvolutionWebhookData) {
  const supabase = getSupabase();
  const msg = (message.message ?? {}) as Record<string, any>;
  const reaction = msg.reactionMessage as Record<string, any> | undefined;
  if (!reaction?.key?.id) return;

  const targetWppId = String(reaction.key.id || "").trim();
  if (!targetWppId) return;
  const emoji = typeof reaction.text === "string" ? reaction.text.trim() : "";
  const remoteJid = String(reaction.key.remoteJid || message.key?.remoteJid || "").trim() || null;
  const fromMe = Boolean(message.key?.fromMe ?? reaction.key.fromMe);
  const senderPhone = fromMe ? "__me__" : extractPhoneFromRemoteJid(remoteJid);
  const senderName = typeof message.pushName === "string" ? message.pushName : null;

  const { data: targetMessage } = await supabase
    .from("chat_messages")
    .select("id, chat_id")
    .eq("wpp_id", targetWppId)
    .maybeSingle();

  if (!targetMessage?.chat_id) return;

  if (!emoji) {
    const deleteQuery = supabase
      .from("message_reactions")
      .delete()
      .eq("target_wpp_id", targetWppId)
      .eq("from_me", fromMe);

    if (senderPhone) deleteQuery.eq("sender_phone", senderPhone);
    else deleteQuery.is("sender_phone", null);

    await deleteQuery;
    return;
  }

  await supabase
    .from("message_reactions")
    .upsert(
      {
        chat_id: targetMessage.chat_id,
        message_id: targetMessage.id,
        target_wpp_id: targetWppId,
        emoji,
        sender_phone: senderPhone,
        sender_name: senderName,
        from_me: fromMe,
        created_at: new Date().toISOString(),
      },
      { onConflict: "target_wpp_id,sender_phone,from_me" }
    );
}

// --- FUNÇÃO NOVA: Filtro de segurança de tempo ---
function isMessageOlderThan24Hours(timestamp: number | string | undefined): boolean {
  if (!timestamp) return false;
  let ts = Number(timestamp);
  if (isNaN(ts)) return false;

  // A Evolution manda timestamp em segundos. Se tiver menos de 13 dígitos, convertemos para milissegundos
  if (ts < 1000000000000) {
    ts *= 1000;
  }

  const twentyFourHoursMs = 24 * 60 * 60 * 1000;
  // Compara o tempo atual com a data da mensagem original
  return (Date.now() - ts) > twentyFourHoursMs;
}

function toTimestampMs(input: number | string | undefined): number | null {
  if (!input) return null;
  let ts = Number(input);
  if (!Number.isFinite(ts) || ts <= 0) return null;
  if (ts < 1000000000000) ts *= 1000;
  return ts;
}

function isMessageBeforeIngestionStart(timestamp: number | string | undefined): boolean {
  const ts = toTimestampMs(timestamp);
  if (ts == null) return false;
  return ts < (INGESTION_START_TS_MS - INCOMING_CLOCK_SKEW_MS);
}

export async function processWebhookBody(body: Record<string, unknown>, requestUrl = "") {
  try {
    const event = (body.event ?? body.type ?? "") as string;
    const eventUpper = String(event).toUpperCase().replace(/\./g, "_");

    // Detecta MESSAGES_UPDATE / MESSAGES_DELETE
    const path = requestUrl || "";
    const isUpdateByPath = /messages-update|messages\.update/i.test(path);
    const isUpdateByEvent = eventUpper === "MESSAGES_UPDATE" || event === "messages.update";
    const isDeleteByPath = /messages-delete|messages\.delete/i.test(path);
    const isDeleteByEvent = eventUpper === "MESSAGES_DELETE" || event === "messages.delete";
    const isHistorySetEvent = eventUpper === "MESSAGES_SET" || event === "messages.set";
    const data = body.data as Record<string, unknown> | undefined;
    const hasUpdateStructure = data && (data.update ?? (Array.isArray(data) && (data as unknown[])[0] && ((data as unknown[])[0] as Record<string, unknown>)?.update));

    if (isUpdateByPath || isUpdateByEvent || (hasUpdateStructure && !data?.message && !(data as Record<string, unknown>)?.messages)) {
      await handleMessagesUpdate(body);
      return NextResponse.json({ status: "processed", event: "messages_update" });
    }
    if (isDeleteByPath || isDeleteByEvent) {
      await handleMessagesDelete(body);
      return NextResponse.json({ status: "processed", event: "messages_delete" });
    }
    if (isHistorySetEvent) {
      return NextResponse.json({ status: "ignored", reason: "history_restore_disabled" });
    }

    const rawMessages = normalizeMessagesFromWebhook(body);
    
    // --- APLICAÇÃO DO FILTRO DE TEMPO: Bloqueia mensagens mais velhas que 24h ---
    const messages = rawMessages.filter(
      (msg) =>
        !isMessageOlderThan24Hours(msg.messageTimestamp) &&
        !isMessageBeforeIngestionStart(msg.messageTimestamp)
    );

    // Se o webhook veio com mensagens, mas TODAS eram antigas e foram filtradas, descartamos o evento.
    if (rawMessages.length > 0 && messages.length === 0) {
      console.warn(
        `[WEBHOOK] Ignorado: histórico/backlog descartado. ${rawMessages.length} mensagens fora da janela ativa.`
      );
      return NextResponse.json({ status: "ignored", reason: "messages_outside_live_window" });
    }

    if (messages.length === 0) {
      console.warn("[WEBHOOK] Ignorado: nenhum payload normalizado", {
        event: eventUpper || event || "unknown",
      });
      return NextResponse.json({ status: "ignored", reason: "no_messages_normalized" });
    }

    const persistedIngestionGraph = await getPersistedIngestionGraph();
    for (const message of messages) {
      // #region agent log
      debugLog({
        runId: "pre-fix",
        hypothesisId: "H1",
        location: "webhook/route.ts:for-message-start",
        message: "Incoming normalized message",
        data: {
          wppId: String(message.key?.id || ""),
          fromMe: Boolean(message.key?.fromMe),
          messageType: String(message.messageType || ""),
        },
        timestamp: Date.now(),
      });
      // #endregion
      const wppId = String(message.key?.id || "").trim();
      if (wppId && (await alreadyProcessedByWppId(wppId))) {
        continue;
      }

      // 1. Verificação crítica: É uma ProtocolMessage?
      const isProtocol = message.messageType === 'protocolMessage' || 
                         (message.message as any)?.protocolMessage;

      if (isProtocol) {
        await handleRevokeMessage(message);
        // Impede duplicação: não envia para o grafo
        continue; 
      }

      const isReaction =
        message.messageType === "reactionMessage" ||
        Boolean((message.message as Record<string, unknown> | undefined)?.reactionMessage);
      if (isReaction) {
        await upsertReactionMessage(message);
        continue;
      }

      const remoteJid = String(message.key?.remoteJid || "");
      const threadId = remoteJid || `webhook-${wppId || Date.now()}`;
      const ingestionResult = await persistedIngestionGraph.invoke(
        {
          raw_input: message as any,
        },
        {
          configurable: {
            thread_id: threadId,
          },
        }
      );

      // #region agent log
      debugLog({
        runId: "pre-fix",
        hypothesisId: "H1",
        location: "webhook/route.ts:after-ingestion-invoke",
        message: "Message sent to ingestion graph",
        data: {
          wppId,
          remoteJid: String(message.key?.remoteJid || ""),
          jid_original:
            String((ingestionResult as Record<string, unknown>)?.source_jid ?? message.key?.remoteJid ?? ""),
          jid_resolvido:
            String((ingestionResult as Record<string, unknown>)?.resolved_jid ?? message.key?.remoteJid ?? ""),
          resolver_strategy: String(
            (ingestionResult as Record<string, unknown>)?.resolver_strategy ?? "direct"
          ),
          resolver_latency_ms: Number(
            (ingestionResult as Record<string, unknown>)?.resolver_latency_ms ?? 0
          ),
          resolver_error:
            (ingestionResult as Record<string, unknown>)?.resolver_error
              ? String((ingestionResult as Record<string, unknown>)?.resolver_error)
              : null,
          should_continue: Boolean((ingestionResult as Record<string, unknown>)?.should_continue ?? true),
          fromMe: Boolean(message.key?.fromMe),
        },
        timestamp: Date.now(),
      });
      // #endregion
    }

    return NextResponse.json({ status: "processed", messages: messages.length });
  } catch (error) {
    console.error("Erro no Webhook:", error);
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const body = (await req.json()) as Record<string, unknown>;
  return processWebhookBody(body, req.url);
}