import { runScheduledDispatchGraph } from "./langgraph/graphs/scheduledDispatch";
import { runAutomationSchedulerGraph } from "./langgraph/graphs/automationScheduler";
import { markDispatchRun, markSchedulerRun, markWorkerError } from "./health";
import type { WorkerConfig } from "./config";
import { RobustCronManager, type CronJobSnapshot } from "./cron/robustCron";

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

  await cron.start();

  return {
    stop: async () => {
      shuttingDown = true;
      await cron.stop();
    },
    getCronJobs: () => cron.snapshot(),
  };
}
