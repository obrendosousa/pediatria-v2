import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { automationQueue } from "@/lib/queue/config";

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
    const runId = randomUUID();

    // AQUI ESTÁ A MUDANÇA: Em vez de executar o grafo, colocamos na fila do Redis
    await automationQueue.add("scheduler", {
      contractVersion: "v1",
      runId: runId,
      triggerAt: new Date().toISOString(),
      dryRun: false,
    });

    return NextResponse.json({ ok: true, message: "scheduler_job_enqueued", runId });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "enqueue_failed";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}