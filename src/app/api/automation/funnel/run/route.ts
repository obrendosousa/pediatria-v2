import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { funnelRunCommandSchema } from "@/lib/automation/contracts";
import { runChatFunnelGraph } from "@/lib/automation/graphs/chatFunnel";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const command = funnelRunCommandSchema.parse({
      contractVersion: "v1",
      runId: body.runId || randomUUID(),
      threadId: body.threadId,
      chatId: body.chatId,
      phone: body.phone,
      title: body.title,
      steps: body.steps,
      initiatedBy: body.initiatedBy || "ui",
    });

    const result = await runChatFunnelGraph(command);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "funnel_run_failed";
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "FUNNEL_RUN_FAILED",
          message,
          retryable: false,
        },
      },
      { status: 500 }
    );
  }
}
