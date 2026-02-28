import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

const appPort = process.env.PORT || "3000";
const localAppUrl = `http://127.0.0.1:${appPort}`;
const webhookPath = "/api/whatsapp/webhook";

let shuttingDown = false;
let tunnelUrl = null;

function log(message) {
  process.stdout.write(`${message}\n`);
}

function logWebhookReady(baseUrl) {
  const webhookUrl = `${baseUrl}${webhookPath}`;
  log("\n================ WEBHOOK LOCAL PRONTO ================");
  log(`URL publica do app: ${baseUrl}`);
  log(`Webhook para colar na Evolution: ${webhookUrl}`);
  log("======================================================\n");
}

function pipeOutput(prefix, child) {
  child.stdout.on("data", (chunk) => {
    const text = chunk.toString();
    process.stdout.write(text);

    if (!tunnelUrl) {
      const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
      if (match?.[0]) {
        tunnelUrl = match[0];
        logWebhookReady(tunnelUrl);
      }
    }
  });

  child.stderr.on("data", (chunk) => {
    const text = chunk.toString();
    process.stderr.write(text);

    if (!tunnelUrl) {
      const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
      if (match?.[0]) {
        tunnelUrl = match[0];
        logWebhookReady(tunnelUrl);
      }
    }
  });

  child.on("exit", (code) => {
    if (!shuttingDown && code !== 0) {
      log(`[${prefix}] finalizou com codigo ${code ?? "desconhecido"}`);
    }
  });
}

function commandExists(command) {
  const paths = (process.env.PATH || "").split(":");
  return paths.some((entry) => existsSync(`${entry}/${command}`));
}

const nextDev = spawn("npx", ["next", "dev"], {
  stdio: ["inherit", "pipe", "pipe"],
  env: process.env,
});
pipeOutput("next", nextDev);

const workerDev = spawn("npm", ["run", "worker:dev"], {
  stdio: ["inherit", "pipe", "pipe"],
  env: {
    ...process.env,
    WORKER_DRY_RUN: process.env.WORKER_DRY_RUN || "true",
  },
});
pipeOutput("worker", workerDev);

// Kokoro TTS via Python nativo (CPU)
const ttsCommand = `
  cd src/ai/voice
  if [ ! -d ".venv" ]; then
    echo "[TTS] Criando ambiente virtual Python..."
    python3 -m venv .venv
  fi
  source .venv/bin/activate
  echo "[TTS] Instalando dependencias (se necessario)..."
  pip install -r requirements.txt -q
  echo "[TTS] Iniciando Kokoro TTS nativo - voz da Clara (Porta 8880)..."
  python server.py
`;

const ttsDev = spawn("bash", ["-c", ttsCommand], {
  stdio: ["inherit", "pipe", "pipe"],
  env: process.env,
});
pipeOutput("kokoro-tts", ttsDev);

let cloudflared = null;

if (commandExists("cloudflared")) {
  cloudflared = spawn(
    "cloudflared",
    ["tunnel", "--no-autoupdate", "--url", localAppUrl],
    {
      stdio: ["inherit", "pipe", "pipe"],
      env: process.env,
    }
  );
  pipeOutput("cloudflared", cloudflared);
} else {
  log("\ncloudflared nao encontrado no PATH.");
  log("Instale para ter URL publica automatica no npm run dev:");
  log("  brew install cloudflared");
  log("Enquanto isso, rode manualmente outro tunel (ex.: ngrok).\n");
}

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;

  nextDev.kill("SIGTERM");
  workerDev.kill("SIGTERM");
  ttsDev.kill("SIGTERM");
  if (cloudflared) cloudflared.kill("SIGTERM");

  setTimeout(() => {
    nextDev.kill("SIGKILL");
    workerDev.kill("SIGKILL");
    ttsDev.kill("SIGKILL");
    if (cloudflared) cloudflared.kill("SIGKILL");
    process.exit(0);
  }, 2000);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
