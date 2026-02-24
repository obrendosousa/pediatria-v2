import { Worker } from "bullmq";
import IORedis from "ioredis";
import { runScheduledDispatchGraph } from "@/lib/automation/graphs/scheduledDispatch";
import { runAutomationSchedulerGraph } from "@/lib/automation/graphs/automationScheduler";
import { automationQueue } from "@/lib/queue/config"; // Importamos a fila
import { randomUUID } from "node:crypto";
import cron from "node-cron"; // O nosso novo relógio interno
import * as dotenv from "dotenv";
import path from "path";

// Carrega as variáveis de ambiente
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config(); 

// Conecta ao Redis
const redisConnection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

console.log("🚀 Iniciando Worker de Automações e Disparos...");

// -----------------------------------------------------------------
// 1. O RELÓGIO (CRON INTERNO)
// A cada 1 minuto, ele joga o trabalho na fila de forma isolada
// -----------------------------------------------------------------
console.log("⏰ Relógio interno ativado. Rodando a cada 1 minuto.");
cron.schedule('* * * * *', async () => {
  try {
    const now = new Date().toISOString();
    
    // Adiciona a rotina de disparos na fila
    await automationQueue.add("dispatch", {
      contractVersion: "v1",
      runId: randomUUID(),
      batchSize: 25,
      dryRun: false,
      nowIso: now,
    });

    // Adiciona a rotina de automações (idade, retorno, etc) na fila
    await automationQueue.add("scheduler", {
      contractVersion: "v1",
      runId: randomUUID(),
      triggerAt: now,
      dryRun: false,
    });
    
  } catch (err) {
    console.error("🚨 Erro ao injetar rotina no Redis via Cron interno:", err);
  }
});

// -----------------------------------------------------------------
// 2. O TRABALHADOR (WORKER)
// Fica olhando a fila. Quando o relógio acima jogar algo lá, ele executa.
// -----------------------------------------------------------------
const worker = new Worker("automation-jobs", async (job) => {
  console.log(`[${new Date().toISOString()}] Iniciando tarefa: ${job.name} (ID: ${job.id})`);

  try {
    if (job.name === "dispatch") {
      const result = await runScheduledDispatchGraph({
        contractVersion: "v1",
        runId: job.data.runId,
        batchSize: job.data.batchSize,
        dryRun: job.data.dryRun,
        nowIso: job.data.nowIso,
      });
      console.log(`✅ Disparo concluído. Status:`, result.data);
      return result;
    } 
    
    else if (job.name === "scheduler") {
      const result = await runAutomationSchedulerGraph({
        contractVersion: "v1",
        runId: job.data.runId,
        triggerAt: job.data.triggerAt,
        dryRun: job.data.dryRun,
      });
      console.log(`✅ Agendamento concluído. Mensagens preparadas:`, result.data?.createdCount);
      return result;
    }

  } catch (error) {
    console.error(`❌ Erro crítico na tarefa ${job.name}:`, error);
    throw error;
  }
}, { 
  connection: redisConnection,
  concurrency: 1 
});

worker.on("failed", (job, err) => {
  console.error(`🚨 Tarefa ${job?.name} falhou. Motivo: ${err.message}`);
});

worker.on("error", err => {
  console.error("🚨 Erro de conexão entre o Worker e o Redis:", err);
});