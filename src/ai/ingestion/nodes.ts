import { IngestionState } from "./state";
import {
  ensureChatExists,
  fetchAndUpdateProfilePicture,
  handleMediaUpload,
  isLidJid,
  normalizeJidToPhone,
  resolveLidToPhone,
  saveMessageToDb,
  getContactNameByPhone,
} from "./services";
import { getSupabaseAdminClient } from "@/lib/automation/adapters/supabaseAdmin";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage } from "@langchain/core/messages";

/** Extrai o contextInfo de qualquer tipo de mensagem (texto, imagem, vídeo, áudio, documento) */
function extractContextInfo(message: unknown): Record<string, any> | null {
  if (!message || typeof message !== "object") return null;
  const msg = message as Record<string, any>;
  return (
    msg.extendedTextMessage?.contextInfo ??
    msg.imageMessage?.contextInfo ??
    msg.videoMessage?.contextInfo ??
    msg.audioMessage?.contextInfo ??
    msg.documentMessage?.contextInfo ??
    null
  );
}

/** Extrai texto e tipo da mensagem citada (quotedMessage do contextInfo) */
function extractQuotedContent(quotedMsg: Record<string, any>): { text: string; type: string } {
  if (quotedMsg.conversation) return { text: quotedMsg.conversation, type: "text" };
  if (quotedMsg.extendedTextMessage?.text) return { text: quotedMsg.extendedTextMessage.text, type: "text" };
  if (quotedMsg.imageMessage) return { text: quotedMsg.imageMessage.caption || "", type: "image" };
  if (quotedMsg.videoMessage) return { text: quotedMsg.videoMessage.caption || "", type: "video" };
  if (quotedMsg.audioMessage) return { text: "", type: "audio" };
  if (quotedMsg.stickerMessage) return { text: "", type: "sticker" };
  if (quotedMsg.documentMessage) return {
    text: quotedMsg.documentMessage.fileName || quotedMsg.documentMessage.caption || "",
    type: "document",
  };
  return { text: "", type: "text" };
}

function extractMediaUrl(message: unknown): string | undefined {
  if (!message || typeof message !== "object") return undefined;
  const msg = message as Record<string, unknown>;
  const sticker = (msg.stickerMessage ?? {}) as Record<string, unknown>;
  const image = (msg.imageMessage ?? {}) as Record<string, unknown>;
  const video = (msg.videoMessage ?? {}) as Record<string, unknown>;
  const audio = (msg.audioMessage ?? {}) as Record<string, unknown>;
  const document = (msg.documentMessage ?? {}) as Record<string, unknown>;

  const base64Value = [msg.base64, sticker.base64, image.base64, video.base64, audio.base64, document.base64].find(
    (value) => typeof value === "string" && value.trim().length > 0
  ) as string | undefined;

  if (base64Value) {
    if (base64Value.startsWith("data:")) return base64Value;
    const mimeType =
      (sticker.mimetype as string | undefined) ??
      (image.mimetype as string | undefined) ??
      (video.mimetype as string | undefined) ??
      (audio.mimetype as string | undefined) ??
      (document.mimetype as string | undefined) ??
      "application/octet-stream";
    return `data:${mimeType};base64,${base64Value}`;
  }

  const candidates = [
    sticker.url,
    sticker.mediaUrl,
    sticker.directPath,
    image.url,
    image.mediaUrl,
    image.directPath,
    video.url,
    video.mediaUrl,
    video.directPath,
    audio.url,
    audio.mediaUrl,
    audio.directPath,
    document.url,
    document.mediaUrl,
    document.directPath,
    msg.url,
    msg.mediaUrl,
  ];

  const firstValid = candidates.find((value) => typeof value === "string" && value.trim().length > 0);
  return firstValid ? (firstValid as string) : undefined;
}

function toIsoFromWebhookTimestamp(input: number | string | undefined): string {
  const raw = Number(input);
  if (!Number.isFinite(raw) || raw <= 0) return new Date().toISOString();
  const ms = raw < 1_000_000_000_000 ? raw * 1000 : raw;
  return new Date(ms).toISOString();
}

export const processInputNode = async (
  state: IngestionState
): Promise<Partial<IngestionState>> => {
  const data = state.raw_input;
  const jid = String(data.key?.remoteJid ?? "").trim();
  let resolvedPhone = "";
  let resolvedJid = jid;
  let resolverStrategy: IngestionState["resolver_strategy"] = "direct";
  let resolverError: string | undefined;
  const resolverStartedAt = Date.now();

  if (isLidJid(jid)) {
    resolverStrategy = "lid_lookup";
    const resolved = await resolveLidToPhone(jid);
    if (resolved?.phone) {
      resolvedPhone = resolved.phone;
      resolvedJid = resolved.jid;
      resolverStrategy = "lid_resolved";
    } else {
      // Política segura: não persiste telefone inválido derivado de LID.
      resolverError = "LID_RESOLUTION_FAILED";
      resolverStrategy = "lid_unresolved";
    }
  } else {
    resolvedPhone = normalizeJidToPhone(jid);
  }

  // Guard final contra números inválidos.
  if (resolvedPhone && !/^\d{8,15}$/.test(resolvedPhone)) {
    resolvedPhone = "";
  }

  // Extração de conteúdo segura
  let content = "";
  const msg = data.message;
  if (msg?.conversation) content = msg.conversation;
  else if (msg?.extendedTextMessage?.text) content = msg.extendedTextMessage.text;
  else if (msg?.imageMessage?.caption) content = msg.imageMessage.caption;
  else if (msg?.videoMessage?.caption) content = msg.videoMessage.caption;

  let type: IngestionState["message_type"] = "text";
  let mediaUrl: string | undefined;

  // Mídia: sempre usar handleMediaUpload (mesma lógica do N8N - base64 no webhook ou buscar na API)
  if (data.messageType === "audioMessage") {
    type = "audio";
    content = content || "🎵 Áudio recebido";
    mediaUrl = (await handleMediaUpload(msg, data.key, data.base64)) ?? undefined;
  } else if (data.messageType === "imageMessage") {
    type = "image";
    // Para imagem, só persiste texto quando vier caption real.
    content = content || "";
    mediaUrl = (await handleMediaUpload(msg, data.key, data.base64)) ?? undefined;
  } else if (data.messageType === "videoMessage") {
    type = "video";
    // Para vídeo, só persiste texto quando vier caption real.
    content = content || "";
    mediaUrl = (await handleMediaUpload(msg, data.key, data.base64)) ?? undefined;
  } else if (data.messageType === "stickerMessage") {
    type = "sticker";
    content = content || "💟 Figurinha";
    mediaUrl = (await handleMediaUpload(msg, data.key, data.base64)) ?? undefined;
  } else if (data.messageType === "documentMessage") {
    type = "document";
    content = content || "📄 Documento recebido";
    mediaUrl = (await handleMediaUpload(msg, data.key, data.base64)) ?? undefined;
  } else {
    // Texto: usar extractMediaUrl apenas para URLs já existentes (raro)
    mediaUrl = extractMediaUrl(msg);
  }

  // Extração de dados de resposta/citação (quote reply)
  const contextInfo = extractContextInfo(msg);
  let quotedInfo: IngestionState["quoted_info"] = null;

  if (contextInfo?.stanzaId && contextInfo.quotedMessage) {
    const { text: quotedText, type: quotedType } = extractQuotedContent(contextInfo.quotedMessage);
    // Determina o sender da mensagem citada comparando o participant com o remoteJid do chat
    const participantPhone = normalizeJidToPhone(contextInfo.participant || "");
    const remotePhone = normalizeJidToPhone(jid);
    // Se participant == remoteJid → citou mensagem do contato; senão → citou nossa mensagem
    const quotedSender: "HUMAN_AGENT" | "CUSTOMER" =
      participantPhone && participantPhone === remotePhone ? "CUSTOMER" : "HUMAN_AGENT";

    // Tentar descobrir o nome da pessoa citada (quando é CUSTOMER)
    let senderName: string | null = null;
    if (quotedSender === "CUSTOMER" && participantPhone) {
      senderName = await getContactNameByPhone(participantPhone);
    } else if (quotedSender === "HUMAN_AGENT") {
      senderName = "Você"; // Ou "Atendente"
    }

    quotedInfo = {
      wpp_id: String(contextInfo.stanzaId),
      sender: quotedSender,
      sender_name: senderName,
      message_type: quotedType,
      message_text: quotedText,
      remote_jid: contextInfo.participant || jid,
    };
  }

  return {
    phone: resolvedPhone,
    contact_name: data.pushName || resolvedPhone || "contato_sem_telefone",
    message_timestamp_iso: toIsoFromWebhookTimestamp(data.messageTimestamp),
    message_content: content,
    message_type: type,
    media_url: mediaUrl,
    source_jid: jid,
    resolved_jid: resolvedJid,
    resolver_strategy: resolverStrategy,
    resolver_latency_ms: Date.now() - resolverStartedAt,
    resolver_error: resolverError,
    is_forwarded: data.isForwarded === true,
    quoted_info: quotedInfo,
  };
};

export const sessionManagerNode = async (
  state: IngestionState
): Promise<Partial<IngestionState>> => {
  if (!state.phone) {
    return { should_continue: false };
  }

  const isMe = state.raw_input.key.fromMe;

  // Chama o serviço com a lógica de proteção de nome
  const chat = await ensureChatExists(state.phone, state.contact_name, isMe);

  // Buscar foto de perfil em background (Evolution API fetchProfilePictureUrl)
  if (!isMe && !chat.profile_pic && state.phone) {
    fetchAndUpdateProfilePicture(state.phone, chat.id);
  }

  return {
    chat_id: chat.id,
    is_ai_paused: chat.is_ai_paused,
  };
};

export const saveToDbNode = async (
  state: IngestionState
): Promise<Partial<IngestionState>> => {
  if (!state.should_continue || !state.chat_id || !state.phone) {
    return {};
  }

  const isMe = state.raw_input.key.fromMe;

  await saveMessageToDb({
    chat_id: state.chat_id!,
    phone: state.phone,
    content: state.message_content,
    sender: isMe ? "HUMAN_AGENT" : "CUSTOMER",
    type: state.message_type,
    media_url: state.media_url,
    wpp_id: state.raw_input.key.id,
    message_timestamp_iso: state.message_timestamp_iso,
    forwarded: state.is_forwarded === true,
    quoted_info: state.quoted_info ?? undefined,
  });
  return {};
};

async function runBackgroundInsightExtraction(chatId: number) {
  try {
    const supabase = getSupabaseAdminClient();

    const { data: messages } = await (supabase as any)
      .from("chat_messages")
      .select("sender, message_text, bot_message, user_message")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (!messages || messages.length < 3) return;

    const history = messages.reverse().map((m: any) => {
      const senderStr = String(m.sender || "").toUpperCase();
      const label = senderStr === "AI_AGENT" ? "BOT" : senderStr.includes("HUMAN") ? "SECRETÁRIA" : "PACIENTE";
      const txt = m.message_text || m.user_message || m.bot_message || "";
      return `[${label}]: ${txt}`;
    }).join("\n");

    const model = new ChatGoogleGenerativeAI({
      model: "gemini-3-flash-preview",
      apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
      temperature: 0.1,
    });

    const extractionPrompt = `Você é um observador silencioso. Leia as últimas mensagens do chat abaixo e identifique se algo de relevante aconteceu.
Extraia os insights no seguinte formato JSON estrito:
{
  "topico": "Assunto principal das mensagens",
  "decisao": "O que foi decidido (ex: agendado, preço informado, paciente disse que vai pensar)",
  "novo_conhecimento": boolean (true se houver uma nova preferência do paciente ou regra que deve ser memorizada a longo prazo, false caso contrário)
}

HISTÓRICO:
${history}

Responda APENAS o JSON estruturado.`;

    const response = await model.invoke([new HumanMessage(extractionPrompt)]);
    const resultText = Array.isArray(response.content)
      ? response.content.map(c => (c as any).text ?? "").join("")
      : response.content.toString();

    const jsonText = resultText.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();

    let parsed: any;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      return;
    }

    await (supabase as any).from("chat_insights").insert({
      chat_id: chatId,
      topico: parsed.topico || "Indefinido",
      decisao: parsed.decisao || "Nenhuma conclusão",
      novo_conhecimento: Boolean(parsed.novo_conhecimento)
    });

    if (parsed.novo_conhecimento) {
      const { manageLongTermMemoryTool } = await import("../clara/tools");
      const memoryContent = `Insight do chat ${chatId}: Tópico: ${parsed.topico}. Decisão/Fato Relevante: ${parsed.decisao}`;
      await manageLongTermMemoryTool.invoke({
        action: "salvar",
        memory_type: "insight_observador",
        content: memoryContent,
        source_role: "system"
      });
    }

  } catch (error) {
    console.error(`[Insight Extractor] Erro ao extrair insights do chat ${chatId}:`, error);
  }
}

export const insightExtractorNode = async (
  state: IngestionState
): Promise<Partial<IngestionState>> => {
  if (state.chat_id && state.should_continue && state.phone) {
    // Engatilha execução assíncrona (não-bloqueante na esteira principal)
    Promise.resolve().then(() => runBackgroundInsightExtraction(state.chat_id!));
  }
  return {};
};
