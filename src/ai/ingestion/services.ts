import { createClient } from "@supabase/supabase-js";

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
}) {
  const supabase = await getSupabase();

  const status = payload.sender === "HUMAN_AGENT" ? "sent" : undefined;
  const insertPayload: Record<string, unknown> = {
    chat_id: payload.chat_id,
    phone: payload.phone,
    message_text: payload.content,
    sender: payload.sender,
    message_type: payload.type,
    media_url: payload.media_url,
    wpp_id: payload.wpp_id,
    created_at: new Date().toISOString(),
  };
  if (status) insertPayload.status = status;
  const { error } = await supabase.from("chat_messages").insert(insertPayload);

  if (error) console.error("Erro fatal ao salvar mensagem:", error);
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
  // Evolution pode retornar { base64 } ou { data: { base64, mimetype, fileName } }
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
 * Faz upload de mídia para o Supabase Storage (equivalente ao "Upload Supabase Final").
 */
async function uploadToSupabase(
  base64: string,
  mimeType: string,
  fileName: string
): Promise<string | null> {
  const supabase = await getSupabase();
  const buf = Buffer.from(base64, "base64");
  const storagePath = `${MEDIA_PATH_PREFIX}${fileName}`;

  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(storagePath, buf, {
    contentType: mimeType,
    upsert: true,
  });

  if (error) {
    console.error("[handleMediaUpload] Erro upload Supabase:", error);
    return null;
  }

  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

/**
 * Lógica de upload de mídia idêntica ao fluxo N8N:
 * 1. Se base64 no webhook → converte e faz upload
 * 2. Senão → busca na Evolution API getBase64FromMediaMessage → upload
 */
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
