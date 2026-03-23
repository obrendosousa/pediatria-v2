import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Voz padrão PT-BR do Kokoro
const KOKORO_VOICE = process.env.KOKORO_VOICE || "pf_dora";

export interface ParsedVoiceResponse {
    type: "text" | "voice";
    content: string;
    mediaUrl?: string;
}

// ─── KOKORO-JS: roda o modelo ONNX direto no Node.js, sem servidor Python ─────
// O modelo (~300MB) é baixado do HuggingFace na primeira chamada e cacheado.
// O singleton persiste enquanto o processo Node.js estiver rodando.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _kokoro: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _kokoroLoading: Promise<any> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getKokoro(): Promise<any> {
    if (_kokoro) return _kokoro;
    if (_kokoroLoading) return _kokoroLoading;
    _kokoroLoading = (async () => {
        console.log("[Voice] Carregando modelo Kokoro ONNX (primeira vez pode demorar)...");
        const { KokoroTTS } = await import("kokoro-js");
        _kokoro = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", { dtype: "fp32" });
        _kokoroLoading = null;
        console.log("[Voice] Kokoro pronto.");
        return _kokoro;
    })();
    return _kokoroLoading;
}

/** Converte Float32Array de PCM mono para um buffer WAV válido. */
function float32ToWav(samples: Float32Array, sampleRate: number): Buffer {
    const dataSize = samples.length * 2; // 16-bit = 2 bytes por sample
    const buf = Buffer.allocUnsafe(44 + dataSize);
    buf.write("RIFF", 0);
    buf.writeUInt32LE(36 + dataSize, 4);
    buf.write("WAVE", 8);
    buf.write("fmt ", 12);
    buf.writeUInt32LE(16, 16);
    buf.writeUInt16LE(1, 20);            // PCM
    buf.writeUInt16LE(1, 22);            // mono
    buf.writeUInt32LE(sampleRate, 24);
    buf.writeUInt32LE(sampleRate * 2, 28);
    buf.writeUInt16LE(2, 32);
    buf.writeUInt16LE(16, 34);
    buf.write("data", 36);
    buf.writeUInt32LE(dataSize, 40);
    for (let i = 0; i < samples.length; i++) {
        const s = Math.max(-1, Math.min(1, samples[i]));
        buf.writeInt16LE(Math.round(s < 0 ? s * 32768 : s * 32767), 44 + i * 2);
    }
    return buf;
}

async function generateWithKokoro(text: string, voiceOverride?: string): Promise<Buffer | null> {
    const tts = await getKokoro();
    const voice = voiceOverride || KOKORO_VOICE;
    const result = await tts.generate(text, { voice });
    return float32ToWav(result.audio as Float32Array, result.sampling_rate ?? 24000);
}

// ─── SYNC: parse das tags <voice>/<text> sem chamadas de API ─────────────────
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
                if (error) {
                    console.error(`[Voice] Erro ao atualizar mensagem ${seg.id}:`, error);
                } else {
                    console.log(`[Voice] ✅ Áudio atualizado para mensagem ${seg.id}`);
                }
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
        console.log(`[Voice] Gerando via kokoro-js (${text.length} chars) voice=${voice}`);

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

// ─── COMPAT: mantida para uso legado ─────────────────────────────────────────
export async function parseAndGenerateVoiceBlocks(
    aiResponseText: string
): Promise<ParsedVoiceResponse[]> {
    return parseVoiceSegments(aiResponseText).map((seg) => ({
        type: seg.type,
        content: seg.type === "voice" ? "🎵 Áudio da Clara" : seg.content,
    }));
}
