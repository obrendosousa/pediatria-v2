import { Worker } from "bullmq";
import IORedis from "ioredis";
import { runScheduledDispatchGraph } from "@/lib/automation/graphs/scheduledDispatch";
import { runAutomationSchedulerGraph } from "@/lib/automation/graphs/automationScheduler";
import { automationQueue } from "@/lib/queue/config";
import { randomUUID } from "node:crypto";
import cron from "node-cron";
import * as dotenv from "dotenv";
import path from "path";

// Importações do Agente Autónomo
import { getSupabaseAdminClient } from "@/lib/automation/adapters/supabaseAdmin";
import { autonomousGraph } from "@/ai/autonomous/graph";

// Carrega as variáveis de ambiente
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config();

// Verifica se o Redis está configurado antes de iniciar
const REDIS_URL = process.env.REDIS_URL;
if (!REDIS_URL) {
  console.warn("⚠️ [Worker] REDIS_URL não configurada. Worker não será iniciado.");
  console.warn("⚠️ [Worker] Configure REDIS_URL para habilitar filas de automação.");
  process.exit(0);
}

// Conecta ao Redis
const redisConnection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
  retryStrategy(times) {
    if (times > 10) {
      console.error("❌ [Worker] Redis: Desistindo após 10 tentativas de reconexão.");
      return null;
    }
    return Math.min(times * 500, 5000);
  },
});

redisConnection.on("error", (err) => {
  console.error("🚨 [Worker] Erro de conexão com Redis:", err.message);
});

console.log("🚀 Iniciando Worker de Automações, Disparos e Agentes...");

// -----------------------------------------------------------------
// 1. O RELÓGIO (CRON INTERNO)
// -----------------------------------------------------------------
console.log("⏰ Relógio interno ativado.");

// Cron 1: Roda a cada 1 minuto (Disparos e Agendamentos tradicionais)
cron.schedule('* * * * *', async () => {
  try {
    const now = new Date().toISOString();

    await automationQueue.add("dispatch", {
      contractVersion: "v1",
      runId: randomUUID(),
      batchSize: 25,
      dryRun: false,
      nowIso: now,
    });

    await automationQueue.add("scheduler", {
      contractVersion: "v1",
      runId: randomUUID(),
      triggerAt: now,
      dryRun: false,
    });

  } catch (err) {
    console.error("🚨 Erro ao injetar rotina no Redis via Cron interno (1 min):", err);
  }
});

// Cron 2: Roda a cada 15 minutos (O Batimento do Agente Autónomo)
cron.schedule('*/15 * * * *', async () => {
  try {
    // Apenas coloca na fila. A decisão de chamar a IA será feita no Worker de forma segura.
    await automationQueue.add("autonomous-heartbeat", {
      runId: randomUUID(),
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error("🚨 Erro ao injetar rotina do Agente Autónomo no Redis:", err);
  }
});

// -----------------------------------------------------------------
// 2. O TRABALHADOR (WORKER)
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

    // A Lógica de Custo-Zero do Agente Autónomo
    else if (job.name === "autonomous-heartbeat") {
      const supabase = getSupabaseAdminClient();

      // Filtro estrito: Apenas chats ATIVOS, sem rascunho pendente e intocados há mais de 2 horas
      const threshold = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

      const { data: dormantChats, error } = await supabase
        .from("chats")
        .select("id, contact_name, stage, ai_summary")
        .eq("status", "ACTIVE")
        .is("ai_draft_reply", null)
        .lt("last_interaction_at", threshold)
        .limit(20);

      if (error) {
        throw new Error(`Falha na query de chats dormentes: ${error.message}`);
      }

      // Proteção contra custos desnecessários da API
      if (!dormantChats || dormantChats.length === 0) {
        console.log("💤 Nenhum chat dormente encontrado. Custo zero alcançado (IA não foi acordada).");
        return { status: "skipped_no_data" };
      }

      console.log(`🤖 Acordando Agente Autónomo para processar ${dormantChats.length} chats dormentes...`);

      // Invocamos o Grafo passando o lote de pacientes (Batch Processing)
      const result = await autonomousGraph.invoke({
        messages: [],
        dormant_chats: dormantChats
      });

      console.log("✅ Rascunhos gerados com sucesso pelo Agente Autónomo.");
      return { status: "processed", count: dormantChats.length };
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