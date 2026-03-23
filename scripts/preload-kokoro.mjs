/**
 * Pré-baixa o modelo Kokoro ONNX do HuggingFace durante o `docker build`.
 * Isso evita delay na primeira requisição TTS em produção.
 *
 * Executado via: node scripts/preload-kokoro.mjs
 */
import { KokoroTTS } from "kokoro-js";

console.log("[preload] Baixando modelo Kokoro ONNX (onnx-community/Kokoro-82M-v1.0-ONNX)...");
await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", { dtype: "fp32" });
console.log("[preload] Modelo Kokoro pronto e cacheado.");
