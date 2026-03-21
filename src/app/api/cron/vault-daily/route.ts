import { NextResponse } from "next/server";
import { runDailyConsolidation } from "@/ai/vault/consolidation";

/**
 * Cron: Consolidacao diaria do vault.
 * Roda 23:59 BRT — processa inbox, coleta metricas, gera daily note.
 * Trigger: cron externo (Vercel Cron / GitHub Actions) ou manual via GET.
 */
export async function GET(request: Request) {
  // Verificar cron secret (opcional)
  const { searchParams } = new URL(request.url);
  const cronSecret = searchParams.get("secret");
  if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const targetDate = searchParams.get("date") || undefined;
    const result = await runDailyConsolidation(targetDate);

    console.log(`[Vault Daily] Consolidacao concluida: ${result.notePath} (${result.inboxProcessed} inbox items)`);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Vault Daily] Erro na consolidacao:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
