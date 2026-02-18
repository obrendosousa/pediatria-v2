import { randomUUID } from "node:crypto";
import { runAutomationSchedulerGraph } from "./langgraph/graphs/automationScheduler";
import { runScheduledDispatchGraph } from "./langgraph/graphs/scheduledDispatch";

async function run() {
  const runId = randomUUID();
  const [scheduler, dispatch] = await Promise.all([
    runAutomationSchedulerGraph({
      contractVersion: "v1",
      runId,
      triggerAt: new Date().toISOString(),
      dryRun: true,
    }),
    runScheduledDispatchGraph({
      contractVersion: "v1",
      runId,
      nowIso: new Date().toISOString(),
      batchSize: 25,
      dryRun: true,
    }),
  ]);

  console.log(
    JSON.stringify(
      {
        ok: scheduler.ok && dispatch.ok,
        runId,
        scheduler,
        dispatch,
      },
      null,
      2
    )
  );
}

run().catch((error) => {
  console.error("[Worker] dry-run failed", error);
  process.exit(1);
});
