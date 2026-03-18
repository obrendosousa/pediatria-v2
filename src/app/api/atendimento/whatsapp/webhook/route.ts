/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createSchemaAdminClient } from '@/lib/supabase/schemaServer';
import { EvolutionWebhookData } from '@/ai/ingestion/state';
import { handleMediaUpload, normalizeJidToPhone, isLidJid, resolveLidToPhone, fetchProfilePictureFromEvolution } from '@/ai/ingestion/services';
import { logWebhook } from '@/lib/webhookLogger';

const SCHEMA = 'atendimento';

// Anti-restauração: ignora backlog/histórico após reconnect
const INGESTION_START_TS_MS = Date.now();
const INCOMING_CLOCK_SKEW_MS = 30_000;

function getSupabase() {
  return createSchemaAdminClient(SCHEMA);
}

function mapEvolutionStatus(raw: unknown): 'sent' | 'delivered' | 'read' | null {
  const v = String(raw ?? '').toUpperCase();
  const n = Number(raw);
  if (n === 3 || v === 'DELIVERED' || v === 'DELIVERED_ACK' || v === 'DELIVERY_ACK') return 'delivered';
  if (n === 4 || v === 'READ' || v === 'READ_ACK' || v === 'PLAYED') return 'read';
  if (n === 2 || n === 1 || v === 'SENT' || v === 'ACK' || v === 'SERVER' || v === 'SERVER_ACK') return 'sent';
  return null;
}

type UpdateItem = { key: Record<string, unknown>; status: unknown; editedText?: string | null };

function extractTextFromAnyMessage(messageLike: unknown): string | null {
  if (!messageLike || typeof messageLike !== 'object') return null;
  const m = messageLike as Record<string, any>;
  const editedMessage = m.editedMessage?.message ?? m.editedMessage;
  const candidates = [
    m.conversation, m.text, m.extendedTextMessage?.text,
    m.imageMessage?.caption, m.videoMessage?.caption,
    // Button/Interactive response messages (WhatsApp buttons, lists)
    m.buttonsResponseMessage?.selectedButtonId,
    m.buttonsResponseMessage?.selectedDisplayText,
    m.templateButtonReplyMessage?.selectedId,
    m.templateButtonReplyMessage?.selectedDisplayText,
    m.listResponseMessage?.singleSelectReply?.selectedRowId,
    m.listResponseMessage?.title,
    editedMessage?.conversation, editedMessage?.text, editedMessage?.extendedTextMessage?.text,
    m.message?.conversation, m.message?.extendedTextMessage?.text,
  ];
  const text = candidates.find((v) => typeof v === 'string' && v.trim().length > 0);
  return typeof text === 'string' ? text.trim() : null;
}

function extractUpdateItems(body: Record<string, unknown>): UpdateItem[] {
  const items: UpdateItem[] = [];
  const data = body.data as Record<string, unknown> | undefined;

  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const d = data as Record<string, unknown>;
    const keyObj = d.key as Record<string, unknown> | undefined;
    const id = d.keyId ?? keyObj?.id ?? body.keyId;
    const status = d.status ?? body.status;
    const fromMe = d.fromMe ?? keyObj?.fromMe ?? body.fromMe;
    const editedText = extractTextFromAnyMessage(d.message ?? d.update ?? body.message);

    if (id && (status !== undefined || editedText)) {
      items.push({ key: { id, fromMe, remoteJid: d.remoteJid ?? keyObj?.remoteJid }, status, editedText });
      return items;
    }
  }

  const updatesArr = (data?.updates ?? body.updates ?? (Array.isArray(data) ? data : undefined)) as unknown[] | undefined;
  if (Array.isArray(updatesArr)) {
    for (const item of updatesArr) {
      const obj = item as Record<string, unknown>;
      const key = (obj.key ?? obj) as Record<string, unknown>;
      const update = obj.update as Record<string, unknown> | undefined;
      const id = key?.id ?? key?.keyId ?? obj.keyId;
      const status2 = update?.status ?? obj.status;
      const editedText = extractTextFromAnyMessage(update?.message ?? obj.message ?? update?.editedMessage ?? obj.editedMessage);
      if (id && (status2 !== undefined || editedText)) {
        items.push({ key: { id, fromMe: key?.fromMe ?? obj.fromMe, remoteJid: key?.remoteJid ?? obj.remoteJid }, status: status2, editedText });
      }
    }
    if (items.length > 0) return items;
  }

  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>;
    const key = (d.key ?? body.key) as Record<string, unknown> | undefined;
    const update = d.update as Record<string, unknown> | undefined;
    const id = key?.id ?? key?.keyId ?? d.keyId;
    const status3 = update?.status ?? d.status ?? body.status;
    const editedText = extractTextFromAnyMessage(update?.message ?? d.message ?? body.message);
    if (id && (status3 !== undefined || editedText)) {
      items.push({ key: { id, fromMe: key?.fromMe ?? d.fromMe, remoteJid: key?.remoteJid ?? d.remoteJid }, status: status3, editedText });
    }
  }

  return items;
}

async function handleMessagesUpdate(body: Record<string, unknown>) {
  const supabase = getSupabase();
  const items = extractUpdateItems(body);

  for (const { key, status: statusRaw, editedText } of items) {
    const mapped = mapEvolutionStatus(statusRaw);
    const hasEditedText = typeof editedText === 'string' && editedText.trim().length > 0;
    if (!mapped && !hasEditedText) continue;

    const wppId = String(key.id ?? '').trim();
    if (!wppId) continue;

    const { data: existing, error } = await supabase
      .from('chat_messages').select('chat_id, tool_data').eq('wpp_id', wppId).limit(1).maybeSingle();
    if (error || !existing) continue;

    const updatePayload: Record<string, unknown> = {};
    if (mapped) updatePayload.status = mapped;
    if (hasEditedText) {
      const prev = existing.tool_data && typeof existing.tool_data === 'object' ? (existing.tool_data as Record<string, unknown>) : {};
      updatePayload.message_text = editedText!.trim();
      // Guardar dados de edição em tool_data (funciona mesmo sem colunas dedicadas)
      updatePayload.tool_data = { ...prev, is_edited: true, edited_at: new Date().toISOString() };
    }

    if (Object.keys(updatePayload).length === 0) continue;
    const { error: updateError } = await supabase.from('chat_messages').update(updatePayload).eq('wpp_id', wppId);
    // Se falhar por colunas inexistentes, tenta sem campos opcionais
    if (updateError && String(updateError.message || '').includes('schema cache')) {
      delete updatePayload.is_edited;
      delete updatePayload.edited_at;
      await supabase.from('chat_messages').update(updatePayload).eq('wpp_id', wppId);
    }
    if (existing.chat_id && mapped) {
      await supabase.from('chats').update({ last_message_status: mapped }).eq('id', existing.chat_id);
    }
  }
}

async function replaceWithRevokedTombstone(targetWppId: string) {
  const supabase = getSupabase();
  const normalized = String(targetWppId || '').trim();
  if (!normalized) return false;

  const { data: original } = await supabase
    .from('chat_messages').select('id, message_type').eq('wpp_id', normalized).maybeSingle();
  if (!original || original.message_type === 'revoked') return Boolean(original);

  await supabase.from('chat_messages')
    .update({ message_text: '', message_type: 'revoked', media_url: null })
    .eq('id', original.id);
  return true;
}

function extractDeleteIds(body: Record<string, unknown>): string[] {
  const ids = new Set<string>();
  const data = body.data as Record<string, unknown> | unknown[] | undefined;
  const pushId = (v: unknown) => { const s = String(v ?? '').trim(); if (s) ids.add(s); };
  const pushFromObj = (obj: Record<string, unknown>) => {
    pushId(obj.id); pushId(obj.keyId);
    const key = obj.key as Record<string, unknown> | undefined;
    if (key) pushId(key.id);
  };

  if (data && typeof data === 'object' && !Array.isArray(data)) {
    pushFromObj(data as Record<string, unknown>);
    const keys = (data as Record<string, unknown>).keys as unknown[] | undefined;
    if (Array.isArray(keys)) keys.forEach((k) => { if (k && typeof k === 'object') pushFromObj(k as Record<string, unknown>); else pushId(k); });
  }
  if (Array.isArray(data)) data.forEach((item) => { if (item && typeof item === 'object') pushFromObj(item as Record<string, unknown>); else pushId(item); });
  pushId(body.id); pushId(body.keyId);
  return [...ids];
}

async function handleMessagesDelete(body: Record<string, unknown>) {
  for (const id of extractDeleteIds(body)) await replaceWithRevokedTombstone(id);
}

async function alreadyProcessedByWppId(wppId: string): Promise<boolean> {
  const supabase = getSupabase();
  const { data } = await supabase.from('chat_messages').select('id').eq('wpp_id', wppId).limit(1).maybeSingle();
  return Boolean(data?.id);
}

async function handleRevokeMessage(message: EvolutionWebhookData) {
  const msgContent = message.message as Record<string, any>;
  const protocolMsg = msgContent?.protocolMessage;
  if (!protocolMsg) return false;

  const protocolType = protocolMsg.type;
  const isRevoke = protocolType === 0 || String(protocolType ?? '').toUpperCase() === 'REVOKE';
  if (isRevoke && protocolMsg.key?.id) {
    await replaceWithRevokedTombstone(String(protocolMsg.key.id).trim());
  }
  return true;
}

/**
 * Desempacota wrapper types do WhatsApp (viewOnce, ephemeral, documentWithCaption, editedMessage).
 */
function unwrapMessage(message: unknown): unknown {
  if (!message || typeof message !== 'object') return message;
  const msg = message as Record<string, unknown>;
  const wrapperKeys = [
    'viewOnceMessage', 'viewOnceMessageV2', 'viewOnceMessageV2Extension',
    'ephemeralMessage', 'documentWithCaptionMessage',
  ];
  for (const key of wrapperKeys) {
    const wrapper = msg[key] as Record<string, unknown> | undefined;
    if (wrapper?.message) return unwrapMessage(wrapper.message);
  }
  const edited = msg.editedMessage as Record<string, unknown> | undefined;
  if (edited?.message) return unwrapMessage(edited.message);
  return message;
}

function detectMessageType(message: unknown): string {
  const msg = (message ?? {}) as Record<string, unknown>;
  if (msg.protocolMessage) return 'protocolMessage';
  if (msg.reactionMessage) return 'reactionMessage';
  if (msg.audioMessage) return 'audioMessage';
  if (msg.imageMessage) return 'imageMessage';
  if (msg.videoMessage) return 'videoMessage';
  if (msg.stickerMessage) return 'stickerMessage';
  if (msg.documentMessage) return 'documentMessage';
  if (msg.ptvMessage) return 'ptvMessage';
  if (msg.contactMessage) return 'contactMessage';
  if (msg.contactsArrayMessage) return 'contactsArrayMessage';
  if (msg.locationMessage) return 'locationMessage';
  if (msg.liveLocationMessage) return 'liveLocationMessage';
  if (msg.pollCreationMessage || msg.pollCreationMessageV2 || msg.pollCreationMessageV3) return 'pollCreationMessage';
  if (msg.pollUpdateMessage) return 'pollUpdateMessage';
  if (msg.buttonsMessage) return 'buttonsMessage';
  if (msg.buttonsResponseMessage) return 'buttonsResponseMessage';
  if (msg.listMessage) return 'listMessage';
  if (msg.listResponseMessage) return 'listResponseMessage';
  if (msg.templateMessage) return 'templateMessage';
  if (msg.templateButtonReplyMessage) return 'templateButtonReplyMessage';
  if (msg.interactiveMessage) return 'interactiveMessage';
  if (msg.interactiveResponseMessage) return 'interactiveResponseMessage';
  if (msg.orderMessage) return 'orderMessage';
  if (msg.productMessage) return 'productMessage';
  if (msg.groupInviteMessage) return 'groupInviteMessage';
  if (msg.extendedTextMessage || msg.conversation) return 'conversation';
  return 'unknown';
}

function isMessageForwarded(message: unknown): boolean {
  if (!message || typeof message !== 'object') return false;
  const msg = message as Record<string, unknown>;
  const contextInfo =
    msg.contextInfo ??
    (msg.extendedTextMessage as Record<string, unknown> | undefined)?.contextInfo ??
    (msg.imageMessage as Record<string, unknown> | undefined)?.contextInfo ??
    (msg.videoMessage as Record<string, unknown> | undefined)?.contextInfo ??
    (msg.audioMessage as Record<string, unknown> | undefined)?.contextInfo ??
    (msg.documentMessage as Record<string, unknown> | undefined)?.contextInfo;
  if (!contextInfo || typeof contextInfo !== 'object') return false;
  const ctx = contextInfo as Record<string, unknown>;
  return ctx.forwarded === true || ctx.forwarded === 'true';
}

function toRemoteJid(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (raw.includes('@')) return raw;
  const digits = raw.replace(/\D/g, '');
  return digits ? `${digits}@s.whatsapp.net` : '';
}

function normalizeMessagesFromWebhook(body: unknown): EvolutionWebhookData[] {
  const payload = (body ?? {}) as Record<string, unknown>;
  const data = payload.data as unknown;
  const sources: unknown[] = [];

  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const dataObj = data as Record<string, unknown>;
    if (dataObj.key) sources.push(dataObj);
    if (Array.isArray(dataObj.messages)) sources.push(...(dataObj.messages as unknown[]));
  }
  if (Array.isArray(data)) sources.push(...data);
  if (Array.isArray(payload.messages)) sources.push(...(payload.messages as unknown[]));

  const normalized: EvolutionWebhookData[] = [];

  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;
    const item = source as Record<string, unknown>;
    const keyRaw = (item.key as Record<string, unknown> | undefined) ??
      ({ remoteJid: item.keyRemoteJid ?? item.remoteJid, fromMe: item.keyFromMe ?? item.fromMe, id: item.keyId ?? item.id ?? '' } as Record<string, unknown>);

    let remoteJid = toRemoteJid(keyRaw.remoteJid ?? item.remoteJid ?? item.jid ?? item.from ?? item.sender ?? item.number ?? item.phone);
    if (!remoteJid || remoteJid === 'status@broadcast') continue;
    if (remoteJid.endsWith('@g.us')) continue;

    // --- RESOLUÇÃO DE LID: usar senderPn ou remoteJidAlt (Evolution API v2) ---
    const senderPn = (keyRaw.senderPn ?? item.senderPn) as string | undefined;
    const remoteJidAlt = (keyRaw.remoteJidAlt ?? item.remoteJidAlt) as string | undefined;
    const addressingMode = (keyRaw.addressingMode ?? item.addressingMode) as string | undefined;
    const participant = (keyRaw.participant ?? item.participant) as string | undefined;

    if (remoteJid.endsWith('@lid')) {
      if (senderPn && senderPn.includes('@s.whatsapp.net')) {
        remoteJid = senderPn;
      } else if (remoteJidAlt && remoteJidAlt.includes('@s.whatsapp.net')) {
        remoteJid = remoteJidAlt;
      }
    }

    // --- DESEMPACOTAR WRAPPERS (viewOnce, ephemeral, documentWithCaption) ---
    const rawMessageValue = (item.message ?? item.content ?? {}) as unknown;
    const messageValue = unwrapMessage(rawMessageValue);

    const detectedType = detectMessageType(messageValue);
    const rawMessageType = (item.messageType ?? item.contentType ?? detectedType) as string;
    const WRAPPER_TYPES = [
      'viewOnceMessage', 'viewOnceMessageV2', 'viewOnceMessageV2Extension',
      'ephemeralMessage', 'documentWithCaptionMessage', 'editedMessage',
    ];
    const messageTypeValue = WRAPPER_TYPES.includes(rawMessageType) ? detectedType : rawMessageType;

    const timestampValue = (item.messageTimestamp ?? item.timestamp ?? Date.now()) as number | string;
    const forwarded = isMessageForwarded(messageValue);

    normalized.push({
      key: {
        remoteJid, fromMe: Boolean(keyRaw.fromMe), id: String(keyRaw.id ?? ''),
        senderPn: senderPn || undefined, remoteJidAlt: remoteJidAlt || undefined,
        addressingMode: addressingMode || undefined, participant: participant || undefined,
      },
      pushName: typeof item.pushName === 'string' ? item.pushName : undefined,
      messageType: messageTypeValue,
      message: messageValue,
      messageTimestamp: timestampValue,
      base64: typeof item.base64 === 'string' ? item.base64
        : (messageValue && typeof messageValue === 'object' && typeof (messageValue as Record<string, unknown>).base64 === 'string')
          ? (messageValue as Record<string, unknown>).base64 as string
          : undefined,
      ...(forwarded ? { isForwarded: true } : {}),
    });
  }

  return normalized;
}

function extractPhoneFromRemoteJid(remoteJid?: string | null): string | null {
  const raw = String(remoteJid ?? '').trim();
  if (!raw) return null;
  const beforeAt = raw.includes('@') ? raw.split('@')[0] : raw;
  return beforeAt.replace(/\D/g, '') || null;
}

async function upsertReactionMessage(message: EvolutionWebhookData) {
  const supabase = getSupabase();
  const msg = (message.message ?? {}) as Record<string, any>;
  const reaction = msg.reactionMessage as Record<string, any> | undefined;
  if (!reaction?.key?.id) return;

  const targetWppId = String(reaction.key.id || '').trim();
  if (!targetWppId) return;
  const emoji = typeof reaction.text === 'string' ? reaction.text.trim() : '';
  const remoteJid = String(reaction.key.remoteJid || message.key?.remoteJid || '').trim() || null;
  const fromMe = Boolean(message.key?.fromMe ?? reaction.key.fromMe);
  const senderPhone = fromMe ? '__me__' : extractPhoneFromRemoteJid(remoteJid);
  const senderName = typeof message.pushName === 'string' ? message.pushName : null;

  const { data: targetMessage } = await supabase
    .from('chat_messages').select('id, chat_id').eq('wpp_id', targetWppId).maybeSingle();
  if (!targetMessage?.chat_id) return;

  if (!emoji) {
    const q = supabase.from('message_reactions').delete().eq('target_wpp_id', targetWppId).eq('from_me', fromMe);
    if (senderPhone) q.eq('sender_phone', senderPhone); else q.is('sender_phone', null);
    await q;
    return;
  }

  await supabase.from('message_reactions').upsert({
    chat_id: targetMessage.chat_id, message_id: targetMessage.id,
    target_wpp_id: targetWppId, emoji, sender_phone: senderPhone, sender_name: senderName,
    from_me: fromMe, created_at: new Date().toISOString(),
  }, { onConflict: 'target_wpp_id,sender_phone,from_me' });
}

function isMessageOlderThan24Hours(timestamp: number | string | undefined): boolean {
  if (!timestamp) return false;
  let ts = Number(timestamp);
  if (isNaN(ts)) return false;
  if (ts < 1000000000000) ts *= 1000;
  return (Date.now() - ts) > 24 * 60 * 60 * 1000;
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
 * Processa eventos CONTACTS_UPSERT/UPDATE para atualizar nomes e fotos no schema atendimento.
 */
async function handleContactsEventAtd(body: Record<string, unknown>) {
  const supabase = getSupabase();
  const data = body.data as unknown;
  const contacts: unknown[] = Array.isArray(data) ? data : (data && typeof data === 'object' ? [data] : []);

  for (const contact of contacts) {
    if (!contact || typeof contact !== 'object') continue;
    const c = contact as Record<string, unknown>;
    const remoteJid = String(c.remoteJid ?? c.id ?? '');
    if (!remoteJid || remoteJid.endsWith('@g.us') || remoteJid === 'status@broadcast' || remoteJid.endsWith('@lid')) continue;

    const phone = extractPhoneFromRemoteJid(remoteJid);
    if (!phone || !/^\d{8,15}$/.test(phone)) continue;

    const pushName = typeof c.pushName === 'string' ? c.pushName.trim() : null;
    const profilePicUrl = typeof c.profilePicUrl === 'string' && (c.profilePicUrl as string).startsWith('http') ? c.profilePicUrl as string : null;
    if (!pushName && !profilePicUrl) continue;

    const { data: existingChat } = await supabase
      .from('chats').select('id, contact_name, profile_pic').eq('phone', phone).maybeSingle();
    if (!existingChat) continue;

    const updatePayload: Record<string, unknown> = {};
    if (pushName) {
      const currentName = (existingChat.contact_name ?? '').trim();
      const normalizedCurrentName = currentName.replace(/\D/g, '');
      if (!currentName || normalizedCurrentName === phone) {
        updatePayload.contact_name = pushName;
      }
    }
    if (profilePicUrl) {
      updatePayload.profile_pic = profilePicUrl;
    }
    if (Object.keys(updatePayload).length > 0) {
      await supabase.from('chats').update(updatePayload).eq('id', existingChat.id);
    }
  }
}

async function processWebhookBody(body: Record<string, unknown>, requestUrl = '') {
  try {
    const event = (body.event ?? body.type ?? '') as string;
    const eventUpper = String(event).toUpperCase().replace(/\./g, '_');

    const path = requestUrl || '';
    const isUpdateByPath = /messages-update|messages\.update/i.test(path);
    const isUpdateByEvent = eventUpper === 'MESSAGES_UPDATE' || event === 'messages.update';
    const isDeleteByPath = /messages-delete|messages\.delete/i.test(path);
    const isDeleteByEvent = eventUpper === 'MESSAGES_DELETE' || event === 'messages.delete';
    const isHistorySetEvent = eventUpper === 'MESSAGES_SET' || event === 'messages.set';
    const data = body.data as Record<string, unknown> | undefined;
    const hasUpdateStructure = data && (data.update ?? (Array.isArray(data) && (data as unknown[])[0] && ((data as unknown[])[0] as Record<string, unknown>)?.update));

    if (isUpdateByPath || isUpdateByEvent || (hasUpdateStructure && !data?.message && !(data as Record<string, unknown>)?.messages)) {
      await handleMessagesUpdate(body);
      return NextResponse.json({ status: 'processed', event: 'messages_update' });
    }
    if (isDeleteByPath || isDeleteByEvent) {
      await handleMessagesDelete(body);
      return NextResponse.json({ status: 'processed', event: 'messages_delete' });
    }
    if (isHistorySetEvent) {
      return NextResponse.json({ status: 'ignored', reason: 'history_restore_disabled' });
    }

    // Ignorar eventos de chats
    const isChatsEvent = ['CHATS_SET', 'CHATS_UPSERT', 'CHATS_UPDATE'].includes(eventUpper) ||
      ['chats.set', 'chats.upsert', 'chats.update'].includes(event);
    if (isChatsEvent) {
      return NextResponse.json({ status: 'ignored', reason: 'chats_event_passive' });
    }

    // Processar CONTACTS_UPSERT/UPDATE para atualizar nomes e fotos de perfil
    const isContactsEvent = ['CONTACTS_UPSERT', 'CONTACTS_UPDATE', 'CONTACTS_SET'].includes(eventUpper) ||
      ['contacts.upsert', 'contacts.update', 'contacts.set'].includes(event);
    if (isContactsEvent) {
      handleContactsEventAtd(body).catch((e) =>
        console.error('[ATD/Webhook] Erro ao processar contacts event:', e)
      );
      return NextResponse.json({ status: 'processed', event: 'contacts_sync' });
    }

    const rawMessages = normalizeMessagesFromWebhook(body);
    const messages = rawMessages.filter(
      (msg) => !isMessageOlderThan24Hours(msg.messageTimestamp) && !isMessageBeforeIngestionStart(msg.messageTimestamp)
    );

    if (rawMessages.length > 0 && messages.length === 0) {
      for (const m of rawMessages) {
        logWebhook({
          schema_source: 'atendimento', event, status: 'ignored',
          reason: isMessageOlderThan24Hours(m.messageTimestamp) ? 'older_than_24h' : 'before_ingestion_start',
          remote_jid: m.key?.remoteJid, phone: extractPhoneFromRemoteJid(m.key?.remoteJid) || undefined,
          message_type: m.messageType, push_name: m.pushName, wpp_id: m.key?.id,
          resolver_info: { ts: m.messageTimestamp, ingestionStart: INGESTION_START_TS_MS },
        });
      }
      return NextResponse.json({ status: 'ignored', reason: 'messages_outside_live_window' });
    }
    if (messages.length === 0) {
      logWebhook({ schema_source: 'atendimento', event, status: 'ignored', reason: 'no_messages_normalized', payload: body });
      return NextResponse.json({ status: 'ignored', reason: 'no_messages_normalized' });
    }

    // Ingestão inline no schema atendimento (sem usar grafo da pediatria)
    for (const message of messages) {
      const wppId = String(message.key?.id || '').trim();
      if (wppId && (await alreadyProcessedByWppId(wppId))) continue;

      const isProtocol = message.messageType === 'protocolMessage' || (message.message as any)?.protocolMessage;
      if (isProtocol) { await handleRevokeMessage(message); continue; }

      const isReaction = message.messageType === 'reactionMessage' || Boolean((message.message as Record<string, unknown> | undefined)?.reactionMessage);
      if (isReaction) { await upsertReactionMessage(message); continue; }

      await ingestMessageToAtendimento(message);
    }

    return NextResponse.json({ status: 'processed', messages: messages.length });
  } catch (error) {
    console.error('[ATD/Webhook] Erro:', error);
    return NextResponse.json({ status: 'error' }, { status: 500 });
  }
}

// ── INGESTÃO INLINE (schema atendimento) ──────────────────────────────────

function toIsoFromTimestamp(input: number | string | undefined): string {
  const raw = Number(input);
  if (!Number.isFinite(raw) || raw <= 0) return new Date().toISOString();
  const ms = raw < 1_000_000_000_000 ? raw * 1000 : raw;
  return new Date(ms).toISOString();
}

function normalizePhone(value?: string | null) {
  return (value ?? '').replace(/\D/g, '');
}

async function ensureChatExistsInAtendimento(phone: string, pushName: string, fromMe: boolean) {
  const supabase = getSupabase();

  // IMPORTANTE: usar .limit(1).maybeSingle() em vez de .single()
  // .single() falha se houver 0 ou 2+ resultados, causando duplicatas em cascata
  const { data: existing } = await supabase
    .from('chats').select('*').eq('phone', phone).order('id', { ascending: true }).limit(1).maybeSingle();

  if (existing) {
    const currentName = (existing.contact_name ?? '').trim();
    const canAutoFill = !currentName || normalizePhone(currentName) === normalizePhone(phone);
    if (!fromMe && pushName && canAutoFill && currentName !== pushName) {
      await supabase.from('chats').update({ contact_name: pushName }).eq('id', existing.id);
      return { ...existing, contact_name: pushName };
    }
    return existing;
  }

  // Para mensagem recebida (não fromMe), usa pushName se disponível.
  const newContactName = (!fromMe && pushName && pushName !== phone) ? pushName : phone;

  const { data: newChat, error } = await supabase.from('chats').insert({
    phone,
    contact_name: newContactName,
    status: 'ACTIVE',
    created_at: new Date().toISOString(),
  }).select().single();

  if (error) throw new Error(`Erro ao criar chat (atendimento): ${error.message}`);
  return newChat;
}

async function saveMessageInAtendimento(payload: {
  chat_id: number; phone: string; content: string;
  sender: 'HUMAN_AGENT' | 'CUSTOMER'; type: string;
  media_url?: string; wpp_id: string;
  message_timestamp_iso?: string; forwarded?: boolean;
  quoted_info?: { wpp_id: string; sender: string; sender_name?: string; message_type: string; message_text: string; remote_jid?: string } | null;
  extra_tool_data?: Record<string, unknown>;
}) {
  const supabase = getSupabase();
  if (payload.type === 'reaction') return;

  const status = payload.sender === 'HUMAN_AGENT' ? 'sent' : undefined;
  const createdAt = payload.message_timestamp_iso || new Date().toISOString();
  const isIncoming = payload.sender === 'CUSTOMER';

  const toolData: Record<string, unknown> = {};
  if (payload.forwarded) toolData.forwarded = true;
  if (payload.quoted_info) toolData.reply_to = payload.quoted_info;
  if (payload.extra_tool_data) Object.assign(toolData, payload.extra_tool_data);

  const insertPayload: Record<string, unknown> = {
    chat_id: payload.chat_id, phone: payload.phone,
    message_text: payload.content, sender: payload.sender,
    message_type: payload.type, media_url: payload.media_url,
    wpp_id: payload.wpp_id, created_at: createdAt,
  };
  if (status) insertPayload.status = status;
  if (Object.keys(toolData).length > 0) insertPayload.tool_data = toolData;
  if (payload.quoted_info?.wpp_id) insertPayload.quoted_wpp_id = payload.quoted_info.wpp_id;

  let { error } = await supabase.from('chat_messages').insert(insertPayload);

  // Se falhou por coluna inexistente (quoted_wpp_id, edited_at, etc.), tenta sem ela
  if (error && String(error.message || '').includes('schema cache')) {
    console.warn('[ATD/Ingest] Coluna inexistente detectada, tentando sem campos opcionais:', error.message);
    delete insertPayload.quoted_wpp_id;
    delete insertPayload.is_edited;
    delete insertPayload.edited_at;
    const retry = await supabase.from('chat_messages').insert(insertPayload);
    error = retry.error;
  }

  if (error) {
    if (String(error.message || '').toLowerCase().includes('duplicate key')) return;
    console.error('[ATD/Ingest] Erro ao salvar mensagem:', error);
    return;
  }

  const previewText = payload.type === 'audio' ? 'Áudio'
    : payload.type === 'image' ? 'Foto'
    : payload.type === 'video' ? 'Vídeo'
    : payload.type === 'sticker' ? 'Figurinha'
    : payload.type === 'document' ? 'Documento'
    : payload.type === 'contact' ? 'Contato'
    : (payload.content || '').trim();

  const { data: chatRow } = await supabase
    .from('chats').select('unread_count, last_interaction_at').eq('id', payload.chat_id).maybeSingle();

  const currentUnread = Number(chatRow?.unread_count || 0);
  const chatUpdate: Record<string, unknown> = {
    last_message: previewText,
    last_message_type: payload.type || 'text',
    last_message_sender: isIncoming ? 'contact' : 'me',
    last_interaction_at: createdAt,
  };
  if (isIncoming) {
    chatUpdate.unread_count = currentUnread + 1;
    chatUpdate.last_message_status = null;
  } else if (status) {
    chatUpdate.last_message_status = status;
  }

  await supabase.from('chats').update(chatUpdate).eq('id', payload.chat_id);
}

async function ingestMessageToAtendimento(message: EvolutionWebhookData) {
  try {
    const jid = String(message.key?.remoteJid ?? '').trim();
    let phone = '';

    if (isLidJid(jid)) {
      // Tentar resolver LID via senderPn ou remoteJidAlt (Evolution API v2)
      const senderPn = message.key?.senderPn;
      const remoteJidAlt = message.key?.remoteJidAlt;

      if (senderPn && senderPn.includes('@s.whatsapp.net')) {
        phone = normalizeJidToPhone(senderPn);
      } else if (remoteJidAlt && remoteJidAlt.includes('@s.whatsapp.net')) {
        phone = normalizeJidToPhone(remoteJidAlt);
      } else {
        // Fallback: resolver via Evolution API
        const resolved = await resolveLidToPhone(jid);
        if (resolved?.phone) {
          phone = resolved.phone;
        } else {
          console.warn('[ATD/Ingest] LID JID não resolvido:', jid);
          logWebhook({
            schema_source: 'atendimento', status: 'ignored', reason: 'lid_unresolved',
            remote_jid: jid, message_type: message.messageType, push_name: message.pushName,
            wpp_id: message.key?.id, resolver_info: { senderPn: message.key?.senderPn, remoteJidAlt: message.key?.remoteJidAlt },
          });
          return;
        }
      }
    } else {
      phone = normalizeJidToPhone(jid);
    }
    if (!phone || !/^\d{8,15}$/.test(phone)) {
      logWebhook({
        schema_source: 'atendimento', status: 'ignored', reason: 'invalid_phone',
        remote_jid: jid, phone: phone || undefined, message_type: message.messageType,
        push_name: message.pushName, wpp_id: message.key?.id,
      });
      return;
    }

    const isMe = message.key?.fromMe === true;
    const pushName = message.pushName || phone;
    const msg = message.message as Record<string, any>;

    // Extrair conteúdo de texto
    let content = '';
    if (msg?.conversation) content = msg.conversation;
    else if (msg?.extendedTextMessage?.text) content = msg.extendedTextMessage.text;
    else if (msg?.imageMessage?.caption) content = msg.imageMessage.caption;
    else if (msg?.videoMessage?.caption) content = msg.videoMessage.caption;
    else if (msg?.buttonsResponseMessage?.selectedDisplayText) content = msg.buttonsResponseMessage.selectedDisplayText;
    else if (msg?.listResponseMessage?.title) content = msg.listResponseMessage.title;
    else if (msg?.listResponseMessage?.singleSelectReply?.selectedRowId) content = msg.listResponseMessage.singleSelectReply.selectedRowId;
    else if (msg?.templateButtonReplyMessage?.selectedDisplayText) content = msg.templateButtonReplyMessage.selectedDisplayText;
    else if (msg?.interactiveResponseMessage?.body?.text) content = msg.interactiveResponseMessage.body.text;

    let type = 'text';
    let mediaUrl: string | undefined;
    const instanceKey = 'EVOLUTION_ATENDIMENTO_INSTANCE';

    if (message.messageType === 'audioMessage') {
      type = 'audio'; content = content || '🎵 Áudio recebido';
      mediaUrl = (await handleMediaUpload(msg, message.key as any, message.base64, instanceKey)) ?? undefined;
    } else if (message.messageType === 'imageMessage') {
      type = 'image'; content = content || '';
      mediaUrl = (await handleMediaUpload(msg, message.key as any, message.base64, instanceKey)) ?? undefined;
    } else if (message.messageType === 'videoMessage' || message.messageType === 'ptvMessage') {
      type = 'video'; content = content || '';
      mediaUrl = (await handleMediaUpload(msg, message.key as any, message.base64, instanceKey)) ?? undefined;
    } else if (message.messageType === 'stickerMessage') {
      type = 'sticker'; content = content || '💟 Figurinha';
      mediaUrl = (await handleMediaUpload(msg, message.key as any, message.base64, instanceKey)) ?? undefined;
    } else if (message.messageType === 'documentMessage') {
      type = 'document';
      const fileName = msg?.documentMessage?.fileName || msg?.documentMessage?.title || '';
      content = content || (fileName ? `📄 ${fileName}` : '📄 Documento recebido');
      mediaUrl = (await handleMediaUpload(msg, message.key as any, message.base64, instanceKey)) ?? undefined;
    } else if (message.messageType === 'contactMessage') {
      type = 'contact';
      content = `📇 Contato: ${msg?.contactMessage?.displayName || 'Contato'}`;
    } else if (message.messageType === 'contactsArrayMessage') {
      type = 'contact';
      const contacts = msg?.contactsArrayMessage?.contacts;
      const names = Array.isArray(contacts) ? contacts.map((c: any) => c.displayName || 'Contato').join(', ') : 'Contatos';
      content = `📇 Contatos: ${names}`;
    } else if (message.messageType === 'locationMessage' || message.messageType === 'liveLocationMessage') {
      type = 'text';
      const loc = msg?.locationMessage || msg?.liveLocationMessage;
      const lat = loc?.degreesLatitude ?? '';
      const lng = loc?.degreesLongitude ?? '';
      const name = loc?.name || '';
      content = message.messageType === 'liveLocationMessage'
        ? `📍 Localização ao vivo${name ? `: ${name}` : ''}`
        : `📍 Localização${name ? `: ${name}` : ''} (${lat}, ${lng})`;
    } else if (message.messageType === 'pollCreationMessage') {
      type = 'text';
      const poll = msg?.pollCreationMessage || msg?.pollCreationMessageV2 || msg?.pollCreationMessageV3;
      content = `📊 Enquete: ${poll?.name || 'Enquete'}`;
    } else if (message.messageType === 'pollUpdateMessage') {
      type = 'text';
      content = '📊 Voto em enquete';
    } else if (message.messageType === 'orderMessage') {
      type = 'text'; content = '🛒 Pedido recebido';
    } else if (message.messageType === 'productMessage') {
      type = 'text'; content = '🏷️ Produto';
    }

    // Upsert chat no schema atendimento
    const chat = await ensureChatExistsInAtendimento(phone, pushName, isMe);

    // Buscar foto de perfil em background (usa instância atendimento)
    if (!isMe && phone && !chat.profile_pic) {
      fetchProfilePictureFromEvolution(phone, 'EVOLUTION_ATENDIMENTO_INSTANCE').then(async (url) => {
        if (!url) return;
        const supabase = getSupabase();
        await supabase.from('chats').update({ profile_pic: url }).eq('id', chat.id);
        console.log(`[ATD/ProfilePic] Foto atualizada: chat=${chat.id} phone=${phone}`);
      }).catch((e) => {
        console.warn(`[ATD/ProfilePic] Erro ao buscar foto para ${phone}:`, (e as Error).message);
      });
    }

    // Extrair informações de mensagem citada (reply-to / contextInfo)
    let quotedInfo: { wpp_id: string; sender: string; sender_name?: string; message_type: string; message_text: string; remote_jid?: string } | null = null;
    const contextInfo = msg?.extendedTextMessage?.contextInfo ?? msg?.imageMessage?.contextInfo
      ?? msg?.videoMessage?.contextInfo ?? msg?.audioMessage?.contextInfo ?? msg?.documentMessage?.contextInfo
      ?? msg?.stickerMessage?.contextInfo ?? msg?.contextInfo;
    if (contextInfo?.stanzaId) {
      const quotedMsg = contextInfo.quotedMessage as Record<string, unknown> | undefined;
      const quotedParticipant = String(contextInfo.participant || contextInfo.remoteJid || '');
      const quotedPhone = extractPhoneFromRemoteJid(quotedParticipant);
      const isSenderMe = quotedPhone === phone ? false : true; // se o participant é diferente do contato, foi eu quem enviou
      let quotedType = 'text';
      if (quotedMsg?.imageMessage) quotedType = 'image';
      else if (quotedMsg?.videoMessage) quotedType = 'video';
      else if (quotedMsg?.audioMessage) quotedType = 'audio';
      else if (quotedMsg?.stickerMessage) quotedType = 'sticker';
      else if (quotedMsg?.documentMessage) quotedType = 'document';

      const quotedText = (quotedMsg?.conversation
        ?? (quotedMsg?.extendedTextMessage as Record<string, unknown> | undefined)?.text
        ?? (quotedMsg?.imageMessage as Record<string, unknown> | undefined)?.caption
        ?? (quotedMsg?.videoMessage as Record<string, unknown> | undefined)?.caption
        ?? '') as string;

      quotedInfo = {
        wpp_id: String(contextInfo.stanzaId),
        sender: isSenderMe ? 'HUMAN_AGENT' : 'CUSTOMER',
        message_type: quotedType,
        message_text: String(quotedText || ''),
        remote_jid: String(contextInfo.remoteJid || jid),
      };
    }

    // Extrair dados de contato (vCard) para persistir em tool_data
    let extraToolData: Record<string, unknown> | undefined;
    if (type === 'contact') {
      const contactMsg = msg?.contactMessage;
      const contactsArray = msg?.contactsArrayMessage;
      if (contactMsg) {
        extraToolData = { contact: { displayName: contactMsg.displayName || '', vcard: contactMsg.vcard || '' } };
      } else if (contactsArray?.contacts) {
        extraToolData = {
          contacts: (contactsArray.contacts as any[]).map((c: any) => ({
            displayName: c.displayName || '', vcard: c.vcard || '',
          })),
        };
      }
    }

    // Salvar mensagem
    await saveMessageInAtendimento({
      chat_id: chat.id, phone, content,
      sender: isMe ? 'HUMAN_AGENT' : 'CUSTOMER',
      type, media_url: mediaUrl,
      wpp_id: message.key?.id || `atd_${Date.now()}`,
      message_timestamp_iso: toIsoFromTimestamp(message.messageTimestamp),
      forwarded: message.isForwarded === true,
      quoted_info: quotedInfo,
      extra_tool_data: extraToolData,
    });

    console.log(`[ATD/Ingest] Mensagem salva: chat=${chat.id} phone=${phone} type=${type}`);
  } catch (error) {
    console.error('[ATD/Ingest] Erro:', error);
  }
}

export async function POST(req: Request) {
  const body = (await req.json()) as Record<string, unknown>;
  const event = body.event ?? body.type ?? 'unknown';
  console.log(`[ATD/Webhook] Recebido evento: ${event}`, JSON.stringify(body).slice(0, 500));
  return processWebhookBody(body, req.url);
}
