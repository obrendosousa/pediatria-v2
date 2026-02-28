import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// URL base do Kokoro-FastAPI (sem path — o path é /v1/audio/speech)
const KOKORO_BASE_URL = process.env.KOKORO_TTS_URL || "http://localhost:8880";
// Voz feminina PT-BR do Kokoro: pf_dora (padrão) ou pf_nicola
const KOKORO_VOICE = process.env.KOKORO_VOICE || "pf_dora";

export interface ParsedVoiceResponse {
    type: "text" | "voice";
    content: string;
    mediaUrl?: string;
}

// ─── SYNC: parse das tags <voice>/<text> sem chamadas de API ─────────────────
// Chamado antes de salvar no DB para permitir salvar texto imediatamente
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
// Chamado APÓS o texto já ter sido salvo no banco, sem bloquear a resposta
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
                if (error) {
                    console.error(`[Voice] Erro ao atualizar mensagem ${seg.id}:`, error);
                } else {
                    console.log(`[Voice] ✅ Áudio atualizado para mensagem ${seg.id}`);
                }
            } else {
                console.warn(`[Voice] ⚠️ Nenhum áudio gerado para segmento ${i + 1} (msg_id: ${seg.id}) — pulando`);
            }
        } catch (e) {
            console.error(`[Voice] ❌ Erro inesperado no segmento ${i + 1} (msg_id: ${seg.id}):`, e);
            // Continua para o próximo segmento mesmo em caso de erro
        }
    }
    console.log(`[Voice] Geração concluída para ${segments.length} segmento(s).`);
}

// ─── GERAÇÃO + UPLOAD ─────────────────────────────────────────────────────────
// Backend selecionado por TTS_BACKEND ou presença de ELEVENLABS_API_KEY
export async function generateAndUploadVoice(text: string): Promise<string | null> {
    try {
        const backend =
            process.env.TTS_BACKEND ||
            (process.env.ELEVENLABS_API_KEY ? "elevenlabs" : "kokoro");

        console.log(`[Voice] Gerando via ${backend} (${text.length} chars)`);

        let audioBuffer: Buffer | null = null;
        const mimeType = "audio/mpeg";
        const ext = "mp3";

        if (backend === "elevenlabs") {
            audioBuffer = await generateWithElevenLabs(text);
            if (!audioBuffer) {
                console.warn("[Voice] ⚠️ ElevenLabs falhou. Iniciando fallback para o Kokoro...");
                audioBuffer = await generateWithKokoro(text);
            }
        } else {
            audioBuffer = await generateWithKokoro(text);
        }

        if (!audioBuffer) return null;

        const fileName = `clara_voice_${Date.now()}_${randomUUID().split("-")[0]}.${ext}`;
        const { error } = await supabase.storage
            .from("whatsapp_media")
            .upload(fileName, audioBuffer, { contentType: mimeType, upsert: false });

        if (error) {
            console.error(`[Voice] Erro no upload:`, error);
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

// ─── BACKEND: Kokoro (VPS / produção — CPU, sem GPU) ─────────────────────────
// ~2-4s por frase, API compatível com OpenAI, voz feminina PT-BR: pf_dora
async function generateWithKokoro(text: string): Promise<Buffer | null> {
    const res = await fetch(`${KOKORO_BASE_URL}/v1/audio/speech`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model: "kokoro",
            input: text,
            voice: KOKORO_VOICE,
            lang_code: "p",         // "p" = PT-BR no Kokoro
            response_format: "mp3",
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

// ─── BACKEND: ElevenLabs (fallback cloud) ─────────────────────────────────────
// Rápido (~1-3s), sem GPU, suporta PT-BR com clonagem de voz (Roberta)
async function generateWithElevenLabs(text: string): Promise<Buffer | null> {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    const voiceId = process.env.ELEVENLABS_VOICE_ID;

    if (!apiKey || !voiceId) {
        console.error("[Voice] ELEVENLABS_API_KEY ou ELEVENLABS_VOICE_ID não configurados");
        return null;
    }

    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: "POST",
        headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
            Accept: "audio/mpeg",
        },
        body: JSON.stringify({
            text,
            model_id: "eleven_multilingual_v2",
            voice_settings: {
                stability: 0.65,
                similarity_boost: 0.3,
                style: 0.0,
                use_speaker_boost: true,
            },
        }),
        signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
        const err = await res.text();
        console.error(`[Voice] ElevenLabs erro ${res.status}: ${err}`);
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
