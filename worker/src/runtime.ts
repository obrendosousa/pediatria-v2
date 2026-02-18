import { runScheduledDispatchGraph } from "./langgraph/graphs/scheduledDispatch";
import { runAutomationSchedulerGraph } from "./langgraph/graphs/automationScheduler";
import { markDispatchRun, markSchedulerRun, markWorkerError } from "./health";
import type { WorkerConfig } from "./config";

type StopFn = () => Promise<void>;

export async function startWorkerRuntime(config: WorkerConfig): Promise<StopFn> {
  let shuttingDown = false;

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
    }
  };

  await Promise.all([runDispatch(), runScheduler()]);

  const dispatchTimer = setInterval(() => {
    void runDispatch();
  }, config.pollIntervalMs);

  const schedulerTimer = setInterval(() => {
    void runScheduler();
  }, config.schedulerIntervalMs);

  return async () => {
    shuttingDown = true;
    if (dispatchTimer) clearInterval(dispatchTimer);
    if (schedulerTimer) clearInterval(schedulerTimer);
  };
}
