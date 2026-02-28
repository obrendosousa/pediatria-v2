import { KokoroTTS } from "kokoro-js";
import fs from "fs";

async function main() {
    console.log("Loading model...");
    const tts = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-ONNX", {
        dtype: "fp32", // fp32 to avoid precision issues on some CPUs
    });

    console.log("Generating audio...");
    // Use a voice from the web (pf_dora or pf_nicola are PT-BR, according to previous configuration)
    const audio = await tts.generate("Olá, eu sou a Clara, assistente da clínica.", {
        voice: "pf_dora",
    });

    console.log("Exporting to wav format...");
    // audio object contains float32 array, we can use it directly or via toWav
    // However, I need to see exactly what toWav() returns (Blob, Buffer, Uint8Array?)
    // Actually, wait, transformers.js audio is already in a raw format?
    // Let's just log the properties of the result.
    console.log(audio);

    // If there's a quick way to save to wav to test
    try {
        const wavBuffer = Buffer.from(audio.audio);
        console.log("Audio shape:", audio.audio.length);
    } catch (e) {
        console.error(e);
    }
}

main().catch(console.error);
