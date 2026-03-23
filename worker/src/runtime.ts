import { runScheduledDispatchGraph } from "./langgraph/graphs/scheduledDispatch";
import { runAutomationSchedulerGraph } from "./langgraph/graphs/automationScheduler";
import { markDispatchRun, markSchedulerRun, markWorkerError } from "./health";
import type { WorkerConfig } from "./config";
import { RobustCronManager, type CronJobSnapshot } from "./cron/robustCron";
import { vaultDailyTask, vaultWeeklyTask, vaultMonthlyTask } from "./cron/vaultCrons";
import { claraTaskExecutorTask } from "./cron/claraTaskExecutor";
import { memoryConsolidationTask } from "./cron/memoryCrons";
import { memoryHardDeleteTask } from "./cron/memoryHardDeleteCron";
import { memoryBrainTask } from "./cron/memoryBrainCron";

export interface WorkerRuntimeController {
  stop: () => Promise<void>;
  getCronJobs: () => CronJobSnapshot[];
}

export async function startWorkerRuntime(config: WorkerConfig): Promise<WorkerRuntimeController> {
  let shuttingDown = false;
  const cron = new RobustCronManager();

  const runDispatch = async () => {
    if (shuttingDown) return;
    try {
      await runScheduledDispatchGraph({
        contractVersion: "v1",
        batchSize: 25,
        dryRun: config.dryRun,
      });
      markDispatchRun();
    } catch (error) {
      markWorkerError(error);
      console.error("[Worker] dispatch error:", error);
      throw error;
    }
  };

  const runScheduler = async () => {
    if (shuttingDown) return;
    try {
      await runAutomationSchedulerGraph({
        contractVersion: "v1",
        dryRun: config.dryRun,
      });
      markSchedulerRun();
    } catch (error) {
      markWorkerError(error);
      console.error("[Worker] scheduler error:", error);
      throw error;
    }
  };

  cron.register({
    name: "dispatch",
    intervalMs: config.pollIntervalMs,
    maxBackoffMs: Math.max(config.pollIntervalMs * 10, 60_000),
    runOnStart: true,
    task: runDispatch,
  });

  cron.register({
    name: "scheduler",
    intervalMs: config.schedulerIntervalMs,
    maxBackoffMs: Math.max(config.schedulerIntervalMs * 10, 300_000),
    runOnStart: true,
    task: runScheduler,
  });

  // Vault consolidation — roda a cada 60s mas so executa na hora certa (BRT)
  cron.register({
    name: "vault-daily",
    intervalMs: 60_000,
    maxBackoffMs: 300_000,
    runOnStart: false,
    task: vaultDailyTask,
  });

  cron.register({
    name: "vault-weekly",
    intervalMs: 60_000,
    maxBackoffMs: 300_000,
    runOnStart: false,
    task: vaultWeeklyTask,
  });

  cron.register({
    name: "vault-monthly",
    intervalMs: 60_000,
    maxBackoffMs: 600_000,
    runOnStart: false,
    task: vaultMonthlyTask,
  });

  // Clara scheduled tasks — polls Supabase a cada 30s para tasks agendadas
  cron.register({
    name: "clara-task-executor",
    intervalMs: 30_000,
    maxBackoffMs: 300_000,
    runOnStart: false,
    task: claraTaskExecutorTask,
  });

  // Memory consolidation — dedup, arquivo morto e re-categorização semanal (quarta 02h BRT)
  cron.register({
    name: "memory-consolidation",
    intervalMs: 60_000,
    maxBackoffMs: 300_000,
    runOnStart: false,
    task: memoryConsolidationTask,
  });

  // Memory hard delete — LGPD: remove permanentemente memórias arquivadas >90 dias (sexta 03h BRT)
  cron.register({
    name: "memory-hard-delete",
    intervalMs: 60_000,
    maxBackoffMs: 300_000,
    runOnStart: false,
    task: memoryHardDeleteTask,
  });

  // Memory brain — consolidação, dedup, poda e reconexão do vault (domingo 03h BRT)
  cron.register({
    name: "memory-brain",
    intervalMs: 60_000,
    maxBackoffMs: 600_000,
    runOnStart: false,
    task: memoryBrainTask,
  });

  await cron.start();

  return {
    stop: async () => {
      shuttingDown = true;
      await cron.stop();
    },
    getCronJobs: () => cron.snapshot(),
  };
}
