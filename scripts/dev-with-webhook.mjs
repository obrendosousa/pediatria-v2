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
  child.on("error", (err) => {
    log(`[${prefix}] erro ao iniciar processo: ${err.message}`);
  });

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

const isWindows = process.platform === "win32";
const pathSeparator = isWindows ? ";" : ":";

function commandExists(command) {
  const paths = (process.env.PATH || "").split(pathSeparator);
  const suffixes = isWindows ? [".exe", ".cmd", ".bat", ""] : [""];
  return paths.some((entry) =>
    suffixes.some((suffix) => existsSync(`${entry}/${command}${suffix}`))
  );
}

const nextDev = spawn("npx", ["next", "dev"], {
  stdio: ["inherit", "pipe", "pipe"],
  env: process.env,
  shell: true,
});
pipeOutput("next", nextDev);

const workerDev = spawn("npx", ["tsx", "-r", "dotenv/config", "worker/src/main.ts"], {
  stdio: ["inherit", "pipe", "pipe"],
  env: {
    ...process.env,
    DOTENV_CONFIG_PATH: ".env.local",
    WORKER_DRY_RUN: process.env.WORKER_DRY_RUN || "true",
  },
  shell: true,
});
pipeOutput("worker", workerDev);

// ── Kokoro TTS Server (porta 8880) ──────────────────────────────────────────
// Tenta Docker primeiro (cross-platform), depois Python com venv.
let ttsDev = null;

if (commandExists("docker")) {
  log("[TTS] Iniciando Kokoro via Docker (ghcr.io/remsky/kokoro-fastapi-cpu)...");
  // Remove container anterior se existir, depois sobe o novo
  const rmOld = spawn("docker", ["rm", "-f", "kokoro-tts-dev"], { stdio: "ignore", shell: true });
  rmOld.on("close", () => {
    ttsDev = spawn(
      "docker",
      ["run", "--rm", "--name", "kokoro-tts-dev", "-p", "8880:8880",
       "ghcr.io/remsky/kokoro-fastapi-cpu:v0.2.2"],
      { stdio: ["inherit", "pipe", "pipe"], env: process.env, shell: true }
    );
    pipeOutput("kokoro-tts", ttsDev);
  });
} else if (commandExists(isWindows ? "python" : "python3")) {
  log("[TTS] Iniciando Kokoro via Python (venv)...");
  const cmd = isWindows
    ? `cd src\\ai\\voice && (if not exist .venv python -m venv .venv) && .venv\\Scripts\\pip install -r requirements.txt -q && .venv\\Scripts\\python server.py`
    : `cd src/ai/voice && ([ -d .venv ] || python3 -m venv .venv) && source .venv/bin/activate && pip install -r requirements.txt -q && python server.py`;
  ttsDev = spawn(isWindows ? "cmd" : "bash", [isWindows ? "/c" : "-c", cmd], {
    stdio: ["inherit", "pipe", "pipe"],
    env: process.env,
  });
  pipeOutput("kokoro-tts", ttsDev);
} else {
  log("[TTS] ⚠️  Nem Docker nem Python encontrados. Kokoro TTS não iniciará.");
  log("[TTS]    Instale Docker Desktop ou Python 3 para ter geração de voz no dev.");
}

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
  log(isWindows ? "  winget install Cloudflare.cloudflared" : "  brew install cloudflared");
  log("Enquanto isso, rode manualmente outro tunel (ex.: ngrok).\n");
}

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;

  nextDev.kill("SIGTERM");
  workerDev.kill("SIGTERM");
  if (ttsDev) ttsDev.kill("SIGTERM");
  if (cloudflared) cloudflared.kill("SIGTERM");

  // Para o container Docker do Kokoro se foi iniciado via Docker
  if (commandExists("docker")) {
    spawn("docker", ["rm", "-f", "kokoro-tts-dev"], { stdio: "ignore", shell: true });
  }

  setTimeout(() => {
    nextDev.kill("SIGKILL");
    workerDev.kill("SIGKILL");
    if (ttsDev) ttsDev.kill("SIGKILL");
    if (cloudflared) cloudflared.kill("SIGKILL");
    process.exit(0);
  }, 2000);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
