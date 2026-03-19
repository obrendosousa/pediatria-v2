/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, @typescript-eslint/no-require-imports */
import { getPersistedIngestionGraph } from "@/ai/ingestion/graph";
import { NextResponse } from "next/server";
import { EvolutionWebhookData } from "@/ai/ingestion/state";
import { createClient } from "@supabase/supabase-js";
import { logWebhook } from "@/lib/webhookLogger";

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
    // Button/Interactive response messages (WhatsApp buttons, lists)
    m.buttonsResponseMessage?.selectedButtonId,
    m.buttonsResponseMessage?.selectedDisplayText,
    m.templateButtonReplyMessage?.selectedId,
    m.templateButtonReplyMessage?.selectedDisplayText,
    m.listResponseMessage?.singleSelectReply?.selectedRowId,
    m.listResponseMessage?.title,
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

/**
 * Desempacota wrapper types do WhatsApp (viewOnce, ephemeral, documentWithCaption, editedMessage)
 * para extrair o conteúdo real da mensagem. Recursivo para wrappers aninhados.
 */
function unwrapMessage(message: unknown): unknown {
  if (!message || typeof message !== "object") return message;
  const msg = message as Record<string, unknown>;
  const wrapperKeys = [
    "viewOnceMessage", "viewOnceMessageV2", "viewOnceMessageV2Extension",
    "ephemeralMessage", "documentWithCaptionMessage",
  ];
  for (const key of wrapperKeys) {
    const wrapper = msg[key] as Record<string, unknown> | undefined;
    if (wrapper?.message) {
      return unwrapMessage(wrapper.message);
    }
  }
  // editedMessage: desempacota o conteúdo editado
  const edited = msg.editedMessage as Record<string, unknown> | undefined;
  if (edited?.message) {
    return unwrapMessage(edited.message);
  }
  return message;
}

function detectMessageType(message: unknown): string {
  const msg = (message ?? {}) as Record<string, unknown>;
  // System/protocol
  if (msg.protocolMessage) return "protocolMessage";
  if (msg.reactionMessage) return "reactionMessage";
  // Media
  if (msg.audioMessage) return "audioMessage";
  if (msg.imageMessage) return "imageMessage";
  if (msg.videoMessage) return "videoMessage";
  if (msg.stickerMessage) return "stickerMessage";
  if (msg.documentMessage) return "documentMessage";
  if (msg.ptvMessage) return "ptvMessage";
  // Contact
  if (msg.contactMessage) return "contactMessage";
  if (msg.contactsArrayMessage) return "contactsArrayMessage";
  // Location
  if (msg.locationMessage) return "locationMessage";
  if (msg.liveLocationMessage) return "liveLocationMessage";
  // Poll
  if (msg.pollCreationMessage || msg.pollCreationMessageV2 || msg.pollCreationMessageV3) return "pollCreationMessage";
  if (msg.pollUpdateMessage) return "pollUpdateMessage";
  // Interactive / Buttons / Lists
  if (msg.buttonsMessage) return "buttonsMessage";
  if (msg.buttonsResponseMessage) return "buttonsResponseMessage";
  if (msg.listMessage) return "listMessage";
  if (msg.listResponseMessage) return "listResponseMessage";
  if (msg.templateMessage) return "templateMessage";
  if (msg.templateButtonReplyMessage) return "templateButtonReplyMessage";
  if (msg.interactiveMessage) return "interactiveMessage";
  if (msg.interactiveResponseMessage) return "interactiveResponseMessage";
  // Commerce
  if (msg.orderMessage) return "orderMessage";
  if (msg.productMessage) return "productMessage";
  // Group
  if (msg.groupInviteMessage) return "groupInviteMessage";
  // Text (must be last)
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

    let remoteJid = toRemoteJid(
      keyRaw.remoteJid ??
      item.remoteJid ??
      item.jid ??
      item.from ??
      item.sender ??
      item.number ??
      item.phone
    );

    if (!remoteJid) continue;

    // --- FILTRO: IGNORAR STATUS/STORIES ---
    if (remoteJid === "status@broadcast") {
      console.log(`[WEBHOOK] Ignorando status/stories (status@broadcast)`);
      continue;
    }

    // --- FILTRO: IGNORAR MENSAGENS DE GRUPO ---
    if (remoteJid.endsWith("@g.us")) {
      continue;
    }

    // --- RESOLUÇÃO DE LID: usar senderPn ou remoteJidAlt (Evolution API v2) ---
    const senderPn = (keyRaw.senderPn ?? item.senderPn) as string | undefined;
    const remoteJidAlt = (keyRaw.remoteJidAlt ?? item.remoteJidAlt) as string | undefined;
    const addressingMode = (keyRaw.addressingMode ?? item.addressingMode) as string | undefined;
    const participant = (keyRaw.participant ?? item.participant) as string | undefined;
    const rawRemoteJid = remoteJid;

    if (remoteJid.endsWith("@lid")) {
      if (senderPn && senderPn.includes("@s.whatsapp.net")) {
        remoteJid = senderPn;
      } else if (remoteJidAlt && remoteJidAlt.includes("@s.whatsapp.net")) {
        remoteJid = remoteJidAlt;
      }
      // Se ainda for @lid, será resolvido no processInputNode via API
    }

    // --- DESEMPACOTAR WRAPPERS (viewOnce, ephemeral, documentWithCaption) ---
    const rawMessageValue = (item.message ?? item.content ?? {}) as unknown;
    const messageValue = unwrapMessage(rawMessageValue);

    const detectedType = detectMessageType(messageValue);
    // Se o messageType original é um wrapper, usar o tipo detectado do conteúdo real
    const rawMessageType = (item.messageType ?? item.contentType ?? detectedType) as string;
    const WRAPPER_TYPES = [
      "viewOnceMessage", "viewOnceMessageV2", "viewOnceMessageV2Extension",
      "ephemeralMessage", "documentWithCaptionMessage", "editedMessage",
    ];
    const messageTypeValue = WRAPPER_TYPES.includes(rawMessageType) ? detectedType : rawMessageType;

    const timestampValue = (item.messageTimestamp ?? item.timestamp ?? Date.now()) as number | string;
    const forwarded = isMessageForwarded(messageValue);

    normalized.push({
      key: {
        remoteJid,
        fromMe: Boolean(keyRaw.fromMe),
        id: String(keyRaw.id ?? ""),
        senderPn: senderPn || undefined,
        remoteJidAlt: remoteJidAlt || undefined,
        addressingMode: addressingMode || undefined,
        participant: participant || undefined,
        rawRemoteJid: rawRemoteJid !== remoteJid ? rawRemoteJid : undefined,
      },
      pushName: typeof item.pushName === "string" ? item.pushName : undefined,
      messageType: messageTypeValue,
      message: messageValue,
      messageTimestamp: timestampValue,
      base64: typeof item.base64 === "string" ? item.base64
        : (messageValue && typeof messageValue === "object" && typeof (messageValue as Record<string, unknown>).base64 === "string")
          ? (messageValue as Record<string, unknown>).base64 as string
          : undefined,
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

/**
 * Processa eventos CONTACTS_UPSERT/UPDATE da Evolution API para atualizar
 * nomes e fotos de perfil dos contatos existentes.
 */
async function handleContactsEvent(body: Record<string, unknown>) {
  const supabase = getSupabase();
  const data = body.data as unknown;
  const contacts: unknown[] = Array.isArray(data) ? data : (data && typeof data === "object" ? [data] : []);

  for (const contact of contacts) {
    if (!contact || typeof contact !== "object") continue;
    const c = contact as Record<string, unknown>;
    const remoteJid = String(c.remoteJid ?? c.id ?? "");
    if (!remoteJid || remoteJid.endsWith("@g.us") || remoteJid === "status@broadcast" || remoteJid.endsWith("@lid")) continue;

    const phone = extractPhoneFromRemoteJid(remoteJid);
    if (!phone || !/^\d{8,15}$/.test(phone)) continue;

    const pushName = typeof c.pushName === "string" ? c.pushName.trim() : null;
    const profilePicUrl = typeof c.profilePicUrl === "string" && (c.profilePicUrl as string).startsWith("http") ? c.profilePicUrl as string : null;

    if (!pushName && !profilePicUrl) continue;

    const { data: existingChat } = await supabase
      .from("chats")
      .select("id, contact_name, profile_pic")
      .eq("phone", phone)
      .maybeSingle();

    if (!existingChat) continue;

    const updatePayload: Record<string, unknown> = {};

    // Atualizar nome se o atual é vazio ou igual ao telefone
    if (pushName) {
      const currentName = (existingChat.contact_name ?? "").trim();
      const normalizedCurrentName = currentName.replace(/\D/g, "");
      if (!currentName || normalizedCurrentName === phone) {
        updatePayload.contact_name = pushName;
      }
    }

    // Atualizar foto de perfil
    if (profilePicUrl) {
      updatePayload.profile_pic = profilePicUrl;
    }

    if (Object.keys(updatePayload).length > 0) {
      await supabase.from("chats").update(updatePayload).eq("id", existingChat.id);
      console.log(`[CONTACTS] Atualizado chat ${existingChat.id} (${phone}):`, Object.keys(updatePayload).join(", "));
    }
  }
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
      logWebhook({ schema_source: "public", event, status: "ignored", reason: "history_restore_disabled", payload: body });
      return NextResponse.json({ status: "ignored", reason: "history_restore_disabled" });
    }

    // Ignorar eventos de chats
    const isChatsEvent = ["CHATS_SET", "CHATS_UPSERT", "CHATS_UPDATE"].includes(eventUpper) ||
      ["chats.set", "chats.upsert", "chats.update"].includes(event);
    if (isChatsEvent) {
      return NextResponse.json({ status: "ignored", reason: "chats_event_passive" });
    }

    // Processar CONTACTS_UPSERT/UPDATE para atualizar nomes e fotos de perfil
    const isContactsEvent = ["CONTACTS_UPSERT", "CONTACTS_UPDATE", "CONTACTS_SET"].includes(eventUpper) ||
      ["contacts.upsert", "contacts.update", "contacts.set"].includes(event);
    if (isContactsEvent) {
      handleContactsEvent(body).catch((e) =>
        console.error("[WEBHOOK] Erro ao processar contacts event:", e)
      );
      return NextResponse.json({ status: "processed", event: "contacts_sync" });
    }

    const rawMessages = normalizeMessagesFromWebhook(body);

    // Log detalhado quando nenhuma mensagem é normalizada (debug de mensagens perdidas)
    if (rawMessages.length === 0 && (eventUpper === "MESSAGES_UPSERT" || event === "messages.upsert")) {
      const dataSnippet = JSON.stringify(body.data ?? body).substring(0, 300);
      console.warn(`[WEBHOOK] Nenhuma mensagem normalizada do payload. event=${event} data=${dataSnippet}`);
    }

    // --- APLICAÇÃO DO FILTRO DE TEMPO: Bloqueia mensagens mais velhas que 24h ---
    const messages = rawMessages.filter(
      (msg) =>
        !isMessageOlderThan24Hours(msg.messageTimestamp) &&
        !isMessageBeforeIngestionStart(msg.messageTimestamp)
    );

    // Se o webhook veio com mensagens, mas TODAS eram antigas e foram filtradas, descartamos o evento.
    if (rawMessages.length > 0 && messages.length === 0) {
      for (const m of rawMessages) {
        logWebhook({
          schema_source: "public", event, status: "ignored",
          reason: isMessageOlderThan24Hours(m.messageTimestamp) ? "older_than_24h" : "before_ingestion_start",
          remote_jid: m.key?.remoteJid, phone: extractPhoneFromRemoteJid(m.key?.remoteJid) || undefined,
          message_type: m.messageType, push_name: m.pushName, wpp_id: m.key?.id,
          resolver_info: { ts: m.messageTimestamp, ingestionStart: INGESTION_START_TS_MS },
        });
      }
      console.warn(`[WEBHOOK] Ignorado: ${rawMessages.length} msgs fora da janela.`);
      return NextResponse.json({ status: "ignored", reason: "messages_outside_live_window" });
    }

    if (messages.length === 0) {
      logWebhook({
        schema_source: "public", event, status: "ignored",
        reason: "no_messages_normalized", payload: body,
      });
      console.warn("[WEBHOOK] Ignorado: nenhum payload normalizado", { event: eventUpper || event || "unknown" });
      return NextResponse.json({ status: "ignored", reason: "no_messages_normalized" });
    }

    const persistedIngestionGraph = await getPersistedIngestionGraph();
    for (const message of messages) {
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

      // Log de resultado da ingestão
      const wasDropped = !ingestionResult.should_continue || !ingestionResult.chat_id;
      logWebhook({
        schema_source: "public", event, status: wasDropped ? "ignored" : "processed",
        reason: wasDropped ? `phone_not_resolved(${ingestionResult.resolver_strategy || "unknown"})` : undefined,
        remote_jid: remoteJid, phone: String(ingestionResult.phone || "") || extractPhoneFromRemoteJid(remoteJid) || undefined,
        message_type: message.messageType, push_name: message.pushName, wpp_id: wppId,
        resolver_info: wasDropped ? {
          source_jid: ingestionResult.source_jid, resolved_jid: ingestionResult.resolved_jid,
          strategy: ingestionResult.resolver_strategy, error: ingestionResult.resolver_error,
          senderPn: message.key?.senderPn, remoteJidAlt: message.key?.remoteJidAlt,
        } : undefined,
      });

      // ── AUTO-RESPOSTA DE PAUSA (server-side) ──────────────────────────────
      // Quando o atendimento está pausado, agenda auto-resposta 1 min após
      // a primeira mensagem do paciente. Deduplicado por sessão de pausa.
      // ── COPILOTO PROATIVO ────────────────────────────────────────────────
      // Dispara automaticamente quando detecta momento crítico na conversa.
      // Requisitos: (1) mensagem do paciente, (2) IA pausada (Joana atuando),
      // (3) mensagem contém sinal de objeção, preço, dúvida ou urgência.
      if (!message.key?.fromMe) {
        const phone = extractPhoneFromRemoteJid(message.key?.remoteJid);
        if (phone) {
          // Fire-and-forget: não bloqueia o processamento do webhook
          (async () => {
            try {
              const { data: chatRow } = await getSupabase()
                .from("chats")
                .select("id, is_ai_paused, contact_name, pause_auto_message, pause_session_id")
                .eq("phone", phone)
                .maybeSingle();

              if (!chatRow?.id || !chatRow.is_ai_paused) return;

              // ── Auto-resposta de pausa ──
              if (chatRow.pause_auto_message && chatRow.pause_session_id) {
                const idempotencyKey = `pause:${chatRow.id}:${chatRow.pause_session_id}`;
                const scheduledFor = new Date(Date.now() + 60_000).toISOString();
                await getSupabase().from("scheduled_messages").upsert(
                  {
                    chat_id: chatRow.id,
                    item_type: "adhoc" as const,
                    title: "Auto-resposta (Pausa)",
                    content: { type: "text", content: chatRow.pause_auto_message },
                    scheduled_for: scheduledFor,
                    status: "pending",
                    idempotency_key: idempotencyKey,
                  },
                  { onConflict: "idempotency_key", ignoreDuplicates: true }
                );
              }

              // ── Copiloto proativo ──

              const text = extractTextFromAnyMessage(message.message) || "";
              const lower = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

              // Classificador rápido por keywords — sem LLM call
              const OBJECTION_KEYWORDS = [
                "caro", "muito caro", "vou pensar", "vou ver", "depois", "marido",
                "esposa", "nao sei", "nao tenho certeza", "nao posso", "dificil",
                "complicado", "nao da", "sem dinheiro", "nao vale", "achei caro",
                "ta caro", "preco alto", "nao agora", "outro dia", "vou avaliar",
                "preciso pensar", "deixa pra la", "desisto", "cancela", "cancelar",
              ];
              const PRICE_KEYWORDS = [
                "quanto custa", "valor", "preco", "quanto", "tabela",
                "convenio", "plano", "plano de saude", "unimed", "bradesco",
                "aceita", "parcela", "parcelar", "desconto", "promocao",
                "forma de pagamento", "pix", "cartao",
              ];
              const CLINICAL_KEYWORDS = [
                "doi", "como funciona", "precisa de exame", "exame",
                "efeito colateral", "risco", "anestesia", "recuperacao",
                "quanto tempo", "demora", "resultado", "retorno",
              ];
              const URGENCY_KEYWORDS = [
                "dor", "urgente", "emergencia", "hoje", "agora",
                "socorro", "febre", "sangue", "grave",
              ];

              const isCritical =
                OBJECTION_KEYWORDS.some((kw) => lower.includes(kw)) ||
                PRICE_KEYWORDS.some((kw) => lower.includes(kw)) ||
                CLINICAL_KEYWORDS.some((kw) => lower.includes(kw)) ||
                URGENCY_KEYWORDS.some((kw) => lower.includes(kw));

              if (!isCritical) return;

              console.log(`🤖 [Copiloto Proativo] Momento crítico detectado no chat ${chatRow.id}: "${text.slice(0, 60)}..."`);

              // Dispara o copiloto via API interna (fire-and-forget)
              fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL ? 'http://localhost:3000' : ''}/api/ai/copilot/trigger`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chat_id: chatRow.id }),
              }).catch((e) => console.warn("[Copiloto Proativo] Falha no trigger:", e.message));
            } catch (e) {
              // Best-effort: não deve nunca bloquear o webhook
            }
          })();
        }
      }
    }

    return NextResponse.json({ status: "processed", messages: messages.length });
  } catch (error) {
    console.error("Erro no Webhook:", error);
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}

async function verifyWebhookSignature(req: Request): Promise<{ body: Record<string, unknown>; error?: string }> {
  const secret = process.env.EVOLUTION_WEBHOOK_SECRET;

  const rawBody = await req.text();
  const body = JSON.parse(rawBody) as Record<string, unknown>;

  // Se não há secret configurado, aceitar (backward-compatible, mas logar warning)
  if (!secret) {
    return { body };
  }

  const signature = req.headers.get("x-webhook-signature") || req.headers.get("x-hub-signature-256");
  if (!signature) {
    return { body, error: "Missing webhook signature header" };
  }

  const { createHmac } = await import("node:crypto");
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const signatureHex = signature.replace("sha256=", "");

  if (expected !== signatureHex) {
    return { body, error: "Invalid webhook signature" };
  }

  return { body };
}

export async function POST(req: Request) {
  try {
    const { body, error } = await verifyWebhookSignature(req);
    if (error) {
      console.warn("[Webhook] Signature verification failed:", error);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return processWebhookBody(body, req.url);
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}