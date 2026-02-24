import { Worker } from "bullmq";
import IORedis from "ioredis";
import { runScheduledDispatchGraph } from "@/lib/automation/graphs/scheduledDispatch";
import { runAutomationSchedulerGraph } from "@/lib/automation/graphs/automationScheduler";
import * as dotenv from "dotenv";
import path from "path";

// Carrega as variáveis de ambiente (.env.local ou do sistema)
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config(); 

const redisConnection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

console.log("🚀 Iniciando Worker de Automações e Disparos...");

// Concurrency: 1 garante que não haverá concorrência dupla no banco de dados (evita enviar 2x a mesma mensagem)
const worker = new Worker("automation-jobs", async (job) => {
  console.log(`[${new Date().toISOString()}] Processando job: ${job.name} (ID: ${job.id})`);

  try {
    if (job.name === "dispatch") {
      const result = await runScheduledDispatchGraph({
        contractVersion: "v1",
        runId: job.data.runId,
        batchSize: job.data.batchSize,
        dryRun: job.data.dryRun,
        nowIso: job.data.nowIso,
      });
      console.log(`✅ Dispatch concluído. Detalhes:`, result.data);
      return result;
    } 
    
    else if (job.name === "scheduler") {
      const result = await runAutomationSchedulerGraph({
        contractVersion: "v1",
        runId: job.data.runId,
        triggerAt: job.data.triggerAt,
        dryRun: job.data.dryRun,
      });
      console.log(`✅ Scheduler concluído. Criados:`, result.data?.createdCount);
      return result;
    }

  } catch (error) {
    console.error(`❌ Erro crítico no job ${job.name}:`, error);
    throw error;
  }
}, { 
  connection: redisConnection,
  concurrency: 1 
});

worker.on("failed", (job, err) => {
  console.error(`🚨 Job ${job?.name} falhou. Motivo: ${err.message}`);
});

worker.on("error", err => {
  console.error("🚨 Erro na conexão do Worker com o Redis:", err);
});