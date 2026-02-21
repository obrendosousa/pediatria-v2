import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { runAutomationSchedulerGraph } from "@/lib/automation/graphs/automationScheduler";

export async function GET() {
  const allowHttpCron =
    process.env.ENABLE_HTTP_CRON_ENDPOINTS === "true" || process.env.NODE_ENV !== "production";
  if (!allowHttpCron) {
    return NextResponse.json(
      { ok: false, error: "http_cron_disabled_use_dedicated_worker" },
      { status: 403 }
    );
  }
  try {
    const result = await runAutomationSchedulerGraph({
      contractVersion: "v1",
      runId: randomUUID(),
      triggerAt: new Date().toISOString(),
      dryRun: false,
    });
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "scheduler_graph_failed";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
