import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { automationQueue } from "@/lib/queue/config";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cronKey = searchParams.get("key");
  const expectedKey = process.env.CRON_SECRET;
  const allowHttpCron =
    process.env.ENABLE_HTTP_CRON_ENDPOINTS === "true" || process.env.NODE_ENV !== "production";
  if (!allowHttpCron && cronKey !== expectedKey) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 403 }
    );
  }
  try {
    const runId = randomUUID();
    
    // AQUI ESTÁ A MUDANÇA: Em vez de executar o grafo, colocamos na fila do Redis
    await automationQueue.add("dispatch", {
      contractVersion: "v1",
      runId: runId,
      batchSize: 25,
      dryRun: false,
      nowIso: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true, message: "dispatch_job_enqueued", runId });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "enqueue_failed";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}