import { KokoroTTS } from "kokoro-js";
import fs from "fs";

async function main() {
    console.log("Loading model v1.0...");
    try {
        const tts = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
            dtype: "fp32",
        });

        console.log("Generating audio with pf_dora...");
        const audio = await tts.generate("Olá, eu sou a Clara, assistente da clínica.", {
            voice: "pf_dora",
        });

        console.log("Audio generated successfully");
        console.log(audio);
        const buffer = Buffer.from(audio.audio);
        fs.writeFileSync("test.wav", buffer);
        console.log("Saved to test.wav");
    } catch (e) {
        console.error("Error:", e);
    }
}

main().catch(console.error);
