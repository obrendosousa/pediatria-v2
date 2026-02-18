import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { runAutomationSchedulerGraph } from "@/lib/automation/graphs/automationScheduler";
import { runScheduledDispatchGraph } from "@/lib/automation/graphs/scheduledDispatch";

export async function POST() {
  try {
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

    return NextResponse.json({
      ok: scheduler.ok && dispatch.ok,
      runId,
      scheduler,
      dispatch,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "dry_run_failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
