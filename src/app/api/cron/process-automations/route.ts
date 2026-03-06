import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { runAutomationSchedulerGraph } from "@/lib/automation/graphs/automationScheduler";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * Cron endpoint que executa o scheduler de automações direto (sem Redis).
 * Avalia regras ativas, encontra pacientes elegíveis e enfileira em scheduled_messages.
 * O dispatch (envio via Evolution) é feito pelo cron /api/cron/process-schedule já existente.
 *
 * Deve ser chamado a cada minuto via cron externo (Easypanel, etc).
 * GET /api/cron/process-automations?key=CRON_SECRET
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cronKey = searchParams.get("key");
  const expectedKey = process.env.CRON_SECRET;
  const allowHttpCron = process.env.ENABLE_HTTP_CRON_ENDPOINTS === "true" || process.env.NODE_ENV !== "production";

  if (!allowHttpCron && cronKey !== expectedKey) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 403 }
    );
  }

  const runId = randomUUID();

  try {
    const schedulerResult = await runAutomationSchedulerGraph({
      contractVersion: "v1",
      runId,
      triggerAt: new Date().toISOString(),
      dryRun: false,
    });

    return NextResponse.json({ ok: true, runId, scheduler: schedulerResult });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "unknown_error";
    console.error("[process-automations] Erro:", message);
    return NextResponse.json(
      { ok: false, error: message, runId },
      { status: 500 }
    );
  }
}
