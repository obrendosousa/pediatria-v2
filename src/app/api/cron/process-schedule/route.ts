import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { runScheduledDispatchGraph } from "@/lib/automation/graphs/scheduledDispatch";

export async function GET() {
  try {
    const result = await runScheduledDispatchGraph({
      contractVersion: "v1",
      runId: randomUUID(),
      batchSize: 25,
      dryRun: false,
      nowIso: new Date().toISOString(),
    });
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "dispatch_graph_failed";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}