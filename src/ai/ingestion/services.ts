import { createClient } from "@supabase/supabase-js";

const DEBUG_LOG_ENDPOINT = "http://127.0.0.1:7242/ingest/4058191e-4081-4adb-b80d-3c22067fcea5";
const debugLog = (payload: Record<string, unknown>) =>
  fetch(DEBUG_LOG_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {});

// Função auxiliar para pegar cliente supabase no server action/route
async function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Variáveis NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configuradas.");
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

function normalizePhone(value?: string | null) {
  return (value ?? "").replace(/\D/g, "");
}

export function isLidJid(value?: string | null) {
  const jid = String(value ?? "").trim().toLowerCase();
  return jid.endsWith("@lid");
}

export function normalizeJidToPhone(jid?: string | null) {
  const raw = String(jid ?? "").trim();
  if (!raw) return "";
  const localPart = raw.includes("@") ? raw.split("@")[0] : raw;
  const primaryPart = localPart.split(":")[0];
  return normalizePhone(primaryPart);
}

const LID_CACHE_TTL_MS = 10 * 60 * 1000;
const LID_NEGATIVE_CACHE_TTL_MS = 60 * 1000;
const LID_RESOLVE_TIMEOUT_MS = 2500;
const LID_RESOLVE_MAX_ATTEMPTS = 2;
const LID_MIN_PHONE_LENGTH = 8;
const LID_MAX_PHONE_LENGTH = 15;

type LidResolution = { phone: string; jid: string };
type LidCacheEntry = { value: LidResolution | null; expiresAt: number };

const lidResolutionCache = new Map<string, LidCacheEntry>();

function getFromLidCache(lidJid: string): LidResolution | null | undefined {
  const now = Date.now();
  const entry = lidResolutionCache.get(lidJid);
  if (!entry) return undefined;
  if (entry.expiresAt <= now) {
    lidResolutionCache.delete(lidJid);
    return undefined;
  }
  return entry.value;
}

function setLidCache(lidJid: string, value: LidResolution | null) {
  const ttl = value ? LID_CACHE_TTL_MS : LID_NEGATIVE_CACHE_TTL_MS;
  lidResolutionCache.set(lidJid, { value, expiresAt: Date.now() + ttl });
}

function isLikelyPhone(phone: string) {
  return phone.length >= LID_MIN_PHONE_LENGTH && phone.length <= LID_MAX_PHONE_LENGTH;
}

function normalizeCandidateIdentity(raw: string): LidResolution | null {
  const value = String(raw || "").trim();
  if (!value) return null;

  const lower = value.toLowerCase();
  if (lower.includes("@g.us") || lower.includes("status@broadcast") || lower.includes("@lid")) {
    return null;
  }

  let phone = "";
  if (value.includes("@")) {
    phone = normalizeJidToPhone(value);
  } else {
    phone = normalizePhone(value);
  }

  if (!isLikelyPhone(phone)) return null;
  return { phone, jid: `${phone}@s.whatsapp.net` };
}

function collectIdentityCandidates(payload: unknown, depth = 0): string[] {
  if (depth > 4 || payload == null) return [];

  if (typeof payload === "string") return [payload];
  if (typeof payload !== "object") return [];

  if (Array.isArray(payload)) {
    return payload.flatMap((item) => collectIdentityCandidates(item, depth + 1));
  }

  const obj = payload as Record<string, unknown>;
  const keyRegex = /(remotejid|jid|phone|number|id)$/i;
  const candidates: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string" && keyRegex.test(key)) {
      candidates.push(value);
      continue;
    }

    if (value && typeof value === "object") {
      candidates.push(...collectIdentityCandidates(value, depth + 1));
    }
  }

  return candidates;
}

function parseResolutionFromEvolutionPayload(payload: unknown): LidResolution | null {
  const candidates = collectIdentityCandidates(payload);
  for (const candidate of candidates) {
    const normalized = normalizeCandidateIdentity(candidate);
    if (normalized) return normalized;
  }
  return null;
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function callEvolutionResolver(
  endpoint: string,
  body: Record<string, unknown>
): Promise<LidResolution | null> {
  const apiKey = process.env.EVOLUTION_API_KEY;
  if (!apiKey) return null;

  for (let attempt = 1; attempt <= LID_RESOLVE_MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetchWithTimeout(
        endpoint,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: apiKey },
          body: JSON.stringify(body),
        },
        LID_RESOLVE_TIMEOUT_MS
      );

      if (!res.ok) {
        if (res.status >= 500 && attempt < LID_RESOLVE_MAX_ATTEMPTS) continue;
        return null;
      }

      const payload = (await res.json().catch(() => null)) as unknown;
      return parseResolutionFromEvolutionPayload(payload);
    } catch {
      if (attempt >= LID_RESOLVE_MAX_ATTEMPTS) return null;
    }
  }

  return null;
}

export async function resolveLidToPhone(lidJid: string): Promise<LidResolution | null> {
  const baseUrl = process.env.EVOLUTION_API_URL?.replace(/\/$/, "");
  const instance = process.env.EVOLUTION_INSTANCE;
  const normalizedLidJid = String(lidJid ?? "").trim();
  if (!baseUrl || !instance || !normalizedLidJid || !isLidJid(normalizedLidJid)) {
    return null;
  }

  const cacheHit = getFromLidCache(normalizedLidJid);
  if (cacheHit !== undefined) return cacheHit;

  const lidOnly = normalizedLidJid.split("@")[0];

  const getContactByIdEndpoint = `${baseUrl}/chat/getContactById/${instance}`;
  const byId = await callEvolutionResolver(getContactByIdEndpoint, {
    id: lidOnly,
    remoteJid: normalizedLidJid,
    where: { id: lidOnly },
  });
  if (byId) {
    setLidCache(normalizedLidJid, byId);
    return byId;
  }

  const findContactsEndpoint = `${baseUrl}/chat/findContacts/${instance}`;
  const byFindContacts = await callEvolutionResolver(findContactsEndpoint, {
    where: { id: lidOnly },
  });
  if (byFindContacts) {
    setLidCache(normalizedLidJid, byFindContacts);
    return byFindContacts;
  }

  setLidCache(normalizedLidJid, null);
  return null;
}

export async function ensureChatExists(phone: string, pushName: string, fromMe: boolean) {
  const supabase = await getSupabase();

  // 1. Tenta buscar o chat existente
  const { data: existingChat } = await supabase
    .from("chats")
    .select("*")
    .eq("phone", phone)
    .single();

  if (existingChat) {
    // Regra de proteção de nome (anti sobrescrita):
    // - Nunca troca nome já definido manualmente.
    // - Só permite auto-preenchimento se o nome atual for vazio ou ainda o telefone.
    const currentName = (existingChat.contact_name ?? "").trim();
    const normalizedCurrentName = normalizePhone(currentName);
    const normalizedPhone = normalizePhone(phone);
    const canAutoFillName = !currentName || normalizedCurrentName === normalizedPhone;

    if (!fromMe && pushName && canAutoFillName && currentName !== pushName) {
      await supabase.from("chats").update({ contact_name: pushName }).eq("id", existingChat.id);
      return { ...existingChat, contact_name: pushName };
    }
    return existingChat;
  }

  // 2. Se não existe, cria um novo
  // Para novo contato, o nome principal inicia pelo telefone.
  // Isso evita usar seu próprio pushName em mensagens enviadas do celular.
  const newContactName = phone;

  const { data: newChat, error } = await supabase
    .from("chats")
    .insert({
      phone,
      contact_name: newContactName,
      status: "ACTIVE",
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw new Error(`Erro ao criar chat no Supabase: ${error.message}`);
  return newChat;
}

export async function saveMessageToDb(payload: {
  chat_id: number;
  phone: string;
  content: string;
  sender: "HUMAN_AGENT" | "CUSTOMER";
  type: string;
  media_url?: string;
  wpp_id: string;
  message_timestamp_iso?: string;
  /** Se true, persiste tool_data.forwarded = true para exibir "Encaminhada" na UI */
  forwarded?: boolean;
}) {
  const supabase = await getSupabase();
  // #region agent log
  debugLog({
    runId: "pre-fix",
    hypothesisId: "H5",
    location: "ingestion/services.ts:saveMessageToDb-entry",
    message: "Saving incoming/outgoing message",
    data: {
      chatId: payload.chat_id,
      sender: payload.sender,
      type: payload.type,
      hasMedia: Boolean(payload.media_url),
    },
    timestamp: Date.now(),
  });
  // #endregion

  if (payload.type === "reaction") {
    // #region agent log
    debugLog({
      runId: "post-fix",
      hypothesisId: "H5",
      location: "ingestion/services.ts:saveMessageToDb-skip-reaction",
      message: "Skipping chat_messages insert for reaction type",
      data: {
        chatId: payload.chat_id,
      },
      timestamp: Date.now(),
    });
    // #endregion
    return;
  }

  // Volta para undefined se for recebida para não estourar a trava do Postgres.
  const status = payload.sender === "HUMAN_AGENT" ? "sent" : undefined;
  
  const messageCreatedAt = payload.message_timestamp_iso || new Date().toISOString();

  const insertPayload: Record<string, unknown> = {
    chat_id: payload.chat_id,
    phone: payload.phone,
    message_text: payload.content,
    sender: payload.sender,
    message_type: payload.type,
    media_url: payload.media_url,
    wpp_id: payload.wpp_id,
    created_at: messageCreatedAt,
  };
  
  if (status) insertPayload.status = status;
  if (payload.forwarded === true) {
    insertPayload.tool_data = { forwarded: true };
  }
  
  const { error } = await supabase.from("chat_messages").insert(insertPayload);
  if (error) {
    const lowerMessage = String(error.message || "").toLowerCase();
    const isDuplicateWppId =
      lowerMessage.includes("duplicate key value") &&
      (lowerMessage.includes("wpp_id") || lowerMessage.includes("chat_messages"));
    if (isDuplicateWppId) {
      // Idempotência forte: quando já existir wpp_id, não replica efeitos colaterais.
      return;
    }

    // #region agent log
    debugLog({
      runId: "post-fix",
      hypothesisId: "H5",
      location: "ingestion/services.ts:saveMessageToDb-insert-error",
      message: "Failed to insert message",
      data: {
        chatId: payload.chat_id,
        sender: payload.sender,
        error: error.message,
      },
      timestamp: Date.now(),
    });
    // #endregion
    console.error("Erro fatal ao salvar mensagem:", error);
    return;
  }

  const isIncoming = payload.sender === "CUSTOMER";
  const messageTimeMs = new Date(messageCreatedAt).getTime();
  const nowIso = new Date().toISOString();
  const previewText =
    payload.type === "audio"
      ? "Áudio"
      : payload.type === "image"
      ? "Foto"
      : payload.type === "video"
      ? "Vídeo"
      : payload.type === "sticker"
      ? "Figurinha"
      : payload.type === "document"
      ? "Documento"
      : (payload.content || "").trim();

  const chatUpdatePayload: Record<string, unknown> = {};
  
  // Limpa o status visual de "lido" se for mensagem recebida, 
  // senão mantém o status de envio do atendente.
  const { data: chatRowForOrdering } = await supabase
    .from("chats")
    .select("unread_count, last_interaction_at")
    .eq("id", payload.chat_id)
    .maybeSingle();

  const currentUnread = Number(chatRowForOrdering?.unread_count || 0);
  const lastInteractionMs = new Date(String(chatRowForOrdering?.last_interaction_at || 0)).getTime();
  const isNewerOrEqual = !Number.isFinite(lastInteractionMs) || messageTimeMs >= lastInteractionMs;

  // Mantém contador de não lidas consistente para toda mensagem recebida.
  if (isIncoming) {
    chatUpdatePayload.unread_count = currentUnread + 1;
  }

  // Só atualiza preview e ordenação se a mensagem for a mais recente daquele chat.
  if (isNewerOrEqual) {
    chatUpdatePayload.last_message = previewText;
    chatUpdatePayload.last_message_type = payload.type || "text";
    chatUpdatePayload.last_message_sender = isIncoming ? "contact" : "me";
    chatUpdatePayload.last_interaction_at = messageCreatedAt || nowIso;
    if (isIncoming) {
      chatUpdatePayload.last_message_status = null;
    } else if (status) {
      chatUpdatePayload.last_message_status = status;
    }
  }

  const { error: chatUpdateError } = await supabase
    .from("chats")
    .update(chatUpdatePayload)
    .eq("id", payload.chat_id);

  const { data: chatAfterUpdate } = await supabase
    .from("chats")
    .select("id, unread_count, last_message_sender, last_interaction_at")
    .eq("id", payload.chat_id)
    .maybeSingle();

  // #region agent log
  debugLog({
    runId: "post-fix",
    hypothesisId: "H5",
    location: "ingestion/services.ts:after-chat-update",
    message: "Chat row state after server-side update",
    data: {
      chatId: payload.chat_id,
      sender: payload.sender,
      chatUpdateError: chatUpdateError?.message || null,
      unreadCount: Number(chatAfterUpdate?.unread_count || 0),
      lastMessageSender: String(chatAfterUpdate?.last_message_sender || ""),
      messageCreatedAt,
      isNewerOrEqual,
    },
    timestamp: Date.now(),
  });
  // #endregion
}

/**
 * Busca a URL da foto de perfil do contato na Evolution API (endpoint oficial fetchProfilePictureUrl).
 * Retorna a URL ou null se falhar (contato sem foto, API indisponível, etc).
 */
export async function fetchProfilePictureFromEvolution(phone: string): Promise<string | null> {
  const baseUrl = process.env.EVOLUTION_API_URL?.replace(/\/$/, "");
  const instance = process.env.EVOLUTION_INSTANCE;
  const apiKey = process.env.EVOLUTION_API_KEY;

  if (!baseUrl || !instance || !apiKey) {
    return null;
  }

  const endpoint = `${baseUrl}/chat/fetchProfilePictureUrl/${instance}`;
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({ number: phone }),
    });

    if (!res.ok) return null;

    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const url = (data.profilePictureUrl ?? data.profile_picture_url) as string | undefined;
    if (typeof url === "string" && url.startsWith("http")) return url;
    return null;
  } catch {
    return null;
  }
}

/**
 * Busca foto de perfil na Evolution API e atualiza o chat no banco.
 * Execução em background (fire-and-forget) para não bloquear o webhook.
 */
export function fetchAndUpdateProfilePicture(phone: string, chatId: number): void {
  if (!phone || !chatId) return;
  fetchProfilePictureFromEvolution(phone)
    .then(async (url) => {
      if (!url) return;
      const supabase = await getSupabase();
      await supabase.from("chats").update({ profile_pic: url }).eq("id", chatId);
    })
    .catch(() => {});
}

/** Bucket Supabase para mídia (áudio, imagem, sticker) - mesmo bucket usado pelo app (ChatWindow, CRM) */
const MEDIA_BUCKET = "midia";
const MEDIA_PATH_PREFIX = "uploads/";

interface MediaUploadContext {
  message: Record<string, unknown>;
  key: { id: string; remoteJid?: string };
  /** base64 do body.data (alguns webhooks enviam assim) */
  bodyBase64?: string | null;
}

/**
 * Extrai base64 e metadados do payload de mídia (mesma lógica do N8N "Lógica Prepara Áudio").
 */
function extractMediaFromMessage(ctx: MediaUploadContext): {
  base64: string;
  mimeType: string;
  fileName: string;
} | null {
  const { message: msg, key, bodyBase64 } = ctx;
  const keyId = key?.id || `media_${Date.now()}`;

  let mimeType = "audio/ogg";
  let fileName = `audio_${keyId}.ogg`;
  let base64: string | null = null;

  const image = (msg.imageMessage ?? {}) as Record<string, unknown>;
  const video = (msg.videoMessage ?? {}) as Record<string, unknown>;
  const sticker = (msg.stickerMessage ?? {}) as Record<string, unknown>;
  const audio = (msg.audioMessage ?? {}) as Record<string, unknown>;
  const document = (msg.documentMessage ?? {}) as Record<string, unknown>;

  if (Object.keys(image).length && msg.imageMessage) {
    mimeType = (image.mimetype as string) || "image/jpeg";
    const ext = mimeType.split("/")[1] || "jpeg";
    fileName = `image_${keyId}.${ext}`;
    base64 = (image.base64 as string) || bodyBase64 || null;
  } else if (Object.keys(video).length && msg.videoMessage) {
    mimeType = (video.mimetype as string) || "video/mp4";
    const ext = mimeType.split("/")[1] || "mp4";
    fileName = `video_${keyId}.${ext}`;
    base64 = (video.base64 as string) || bodyBase64 || null;
  } else if (Object.keys(sticker).length && msg.stickerMessage) {
    mimeType = (sticker.mimetype as string) || "image/webp";
    fileName = `sticker_${keyId}.webp`;
    base64 = (sticker.base64 as string) || bodyBase64 || null;
  } else if (Object.keys(audio).length && msg.audioMessage) {
    mimeType = (audio.mimetype as string) || "audio/ogg";
    fileName = `audio_${keyId}.ogg`;
    base64 = (audio.base64 as string) || bodyBase64 || null;
  } else if (Object.keys(document).length && msg.documentMessage) {
    mimeType = (document.mimetype as string) || "application/octet-stream";
    const ext = mimeType.split("/")[1] || "bin";
    fileName = `document_${keyId}.${ext}`;
    base64 = (document.base64 as string) || bodyBase64 || null;
  } else if (bodyBase64) {
    const mt = (msg as Record<string, unknown>).mimetype as string | undefined;
    if (mt) {
      mimeType = mt;
      const ext = mimeType.split("/")[1] || "bin";
      const prefix = mimeType.includes("video")
        ? "video_"
        : mimeType.includes("image")
        ? "image_"
        : mimeType.includes("webp")
        ? "sticker_"
        : mimeType.includes("application")
        ? "document_"
        : "audio_";
      fileName = `${prefix}${keyId}.${ext}`;
    }
    base64 = bodyBase64;
  }

  if (base64 && typeof base64 === "string" && base64.trim().length > 0) {
    const clean = base64.replace(/^data:[^;]+;base64,/, "");
    return { base64: clean, mimeType, fileName };
  }
  return null;
}

/**
 * Busca mídia em base64 na Evolution API (equivalente ao nó "Buscar Base64 na Evolution1").
 */
async function fetchMediaFromEvolutionApi(
  messageId: string,
  remoteJid: string
): Promise<{ base64: string; mimeType?: string; fileName?: string } | null> {
  const baseUrl = process.env.EVOLUTION_API_URL?.replace(/\/$/, "");
  const instance = process.env.EVOLUTION_INSTANCE;
  const apiKey = process.env.EVOLUTION_API_KEY;

  if (!baseUrl || !instance || !apiKey) {
    console.warn("[handleMediaUpload] Evolution API não configurada (EVOLUTION_API_URL, EVOLUTION_INSTANCE, EVOLUTION_API_KEY)");
    return null;
  }

  const endpoint = `${baseUrl}/chat/getBase64FromMediaMessage/${instance}`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: apiKey },
    body: JSON.stringify({
      message: { key: { id: messageId, remoteJid } },
      convertToMp4: false,
    }),
  });

  if (!res.ok) {
    console.warn("[handleMediaUpload] Evolution API getBase64 falhou:", res.status, await res.text());
    return null;
  }

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const inner = (data.data as Record<string, unknown>) ?? data;
  const b64 = (inner.base64 ?? data.base64) as string | undefined;
  if (!b64 || typeof b64 !== "string") return null;

  const clean = String(b64).replace(/^data:[^;]+;base64,/, "");
  const mimetype = (inner.mimetype ?? data.mimetype) as string | undefined;
  const mime = mimetype || "audio/ogg";
  const ext = mime.split("/")[1] || "ogg";
  const fileName = (inner.fileName ?? data.fileName) as string | undefined;
  const fName = fileName || `audio_${messageId}.${ext}`;

  return { base64: clean, mimeType: mime, fileName: fName };
}

/**
 * Faz upload de mídia para o Supabase Storage com sanitização de nome de arquivo.
 */
async function uploadToSupabase(
  base64: string,
  mimeType: string,
  fileName: string
): Promise<string | null> {
  const supabase = await getSupabase();
  const buf = Buffer.from(base64, "base64");
  
  const safeFileName = fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .toLowerCase();

  const uniqueSafeFileName = `${Date.now()}_${safeFileName}`;
  const storagePath = `${MEDIA_PATH_PREFIX}${uniqueSafeFileName}`;

  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(storagePath, buf, {
    contentType: mimeType,
    upsert: true,
  });

  if (error) {
    console.error(`[handleMediaUpload] Erro upload Supabase (${storagePath}):`, error);
    return null;
  }

  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

export async function handleMediaUpload(
  messageData: Record<string, unknown>,
  key: { id: string; remoteJid?: string },
  bodyBase64?: string | null
): Promise<string | null> {
  const ctx: MediaUploadContext = { message: messageData, key, bodyBase64 };

  const extracted = extractMediaFromMessage(ctx);
  let base64: string;
  let mimeType: string;
  let fileName: string;

  if (extracted) {
    ({ base64, mimeType, fileName } = extracted);
  } else {
    const remoteJid = key?.remoteJid;
    if (!remoteJid) {
      console.warn("[handleMediaUpload] remoteJid ausente para buscar mídia na API");
      return null;
    }
    const apiData = await fetchMediaFromEvolutionApi(key.id, remoteJid);
    if (!apiData) return null;
    base64 = apiData.base64;
    mimeType = apiData.mimeType ?? "audio/ogg";
    fileName = apiData.fileName ?? `audio_${key.id}.ogg`;
  }

  return uploadToSupabase(base64, mimeType, fileName);
}