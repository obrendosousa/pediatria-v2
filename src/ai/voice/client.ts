import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const KOKORO_BASE_URL = process.env.KOKORO_TTS_URL || "http://localhost:8880";
const KOKORO_VOICE = process.env.KOKORO_VOICE || "pf_dora";

export interface ParsedVoiceResponse {
    type: "text" | "voice";
    content: string;
    mediaUrl?: string;
}

// ─── SYNC: parse das tags <voice>/<text> ─────────────────────────────────────
export function parseVoiceSegments(
    aiResponseText: string
): Array<{ type: "text" | "voice"; content: string }> {
    const results: Array<{ type: "text" | "voice"; content: string }> = [];
    const regex = /<(voice|text)>([\s\S]*?)<\/\1>/g;
    let match;
    let lastIndex = 0;

    while ((match = regex.exec(aiResponseText)) !== null) {
        const type = match[1] as "voice" | "text";
        const content = match[2].trim();
        if (match.index > lastIndex) {
            const orphan = aiResponseText.slice(lastIndex, match.index).trim();
            if (orphan) results.push({ type: "text", content: orphan });
        }
        if (content) results.push({ type, content });
        lastIndex = regex.lastIndex;
    }

    if (lastIndex < aiResponseText.length) {
        const orphan = aiResponseText.slice(lastIndex).trim();
        if (orphan) results.push({ type: "text", content: orphan });
    }

    if (results.length === 0 && aiResponseText.trim()) {
        results.push({ type: "text", content: aiResponseText.trim() });
    }

    return results;
}

// ─── ASYNC: gera voz e atualiza mensagens no DB (fire-and-forget) ─────────────
export async function generateVoiceForMessages(
    segments: Array<{ id: number; content: string }>
): Promise<void> {
    console.log(`[Voice] Iniciando geração para ${segments.length} segmento(s)...`);
    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        console.log(`[Voice] Segmento ${i + 1}/${segments.length} — msg_id: ${seg.id}, ${seg.content.length} chars`);
        try {
            const url = await generateAndUploadVoice(seg.content);
            if (url) {
                const { error } = await supabase
                    .from("chat_messages")
                    .update({ media_url: url, message_type: "voice", message_text: "🎵 Áudio da Clara" })
                    .eq("id", seg.id);
                if (error) console.error(`[Voice] Erro ao atualizar mensagem ${seg.id}:`, error);
                else console.log(`[Voice] ✅ Áudio atualizado para mensagem ${seg.id}`);
            } else {
                console.warn(`[Voice] ⚠️ Sem áudio para segmento ${i + 1} (msg_id: ${seg.id})`);
            }
        } catch (e) {
            console.error(`[Voice] ❌ Erro no segmento ${i + 1} (msg_id: ${seg.id}):`, e);
        }
    }
    console.log(`[Voice] Geração concluída para ${segments.length} segmento(s).`);
}

// ─── GERAÇÃO + UPLOAD ─────────────────────────────────────────────────────────
export async function generateAndUploadVoice(text: string, voiceOverride?: string): Promise<string | null> {
    try {
        const voice = voiceOverride || KOKORO_VOICE;
        console.log(`[Voice] Gerando via kokoro (${text.length} chars) voice=${voice}`);

        const audioBuffer = await generateWithKokoro(text, voice);
        if (!audioBuffer) return null;

        const fileName = `clara_voice_${Date.now()}_${crypto.randomUUID().split("-")[0]}.wav`;
        const { error } = await supabase.storage
            .from("whatsapp_media")
            .upload(fileName, audioBuffer, { contentType: "audio/wav", upsert: false });

        if (error) {
            console.error("[Voice] Erro no upload:", error);
            return null;
        }

        const { data: urlData } = supabase.storage
            .from("whatsapp_media")
            .getPublicUrl(fileName);

        return urlData.publicUrl;
    } catch (error) {
        console.error("[Voice] Falha ao gerar voz:", error);
        return null;
    }
}

// ─── BACKEND: Kokoro via servidor HTTP (Python server.py ou kokoro-fastapi) ───
async function generateWithKokoro(text: string, voiceOverride?: string): Promise<Buffer | null> {
    const res = await fetch(`${KOKORO_BASE_URL}/v1/audio/speech`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model: "kokoro",
            input: text,
            voice: voiceOverride || KOKORO_VOICE,
            lang_code: "p",
            response_format: "wav",
        }),
        signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
        const err = await res.text();
        console.error(`[Voice] Kokoro erro ${res.status}: ${err}`);
        return null;
    }

    return Buffer.from(await res.arrayBuffer());
}

// ─── COMPAT: mantida para uso legado ─────────────────────────────────────────
export async function parseAndGenerateVoiceBlocks(
    aiResponseText: string
): Promise<ParsedVoiceResponse[]> {
    return parseVoiceSegments(aiResponseText).map((seg) => ({
        type: seg.type,
        content: seg.type === "voice" ? "🎵 Áudio da Clara" : seg.content,
    }));
}
