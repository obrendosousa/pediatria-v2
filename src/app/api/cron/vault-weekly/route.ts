import { NextResponse } from "next/server";
import { runWeeklyConsolidation } from "@/ai/vault/consolidation";

/**
 * Cron: Consolidacao semanal do vault.
 * Roda domingo 23:59 BRT — sintetiza 7 daily notes, atualiza knowledge e insights.
 * Trigger: cron externo (Vercel Cron / GitHub Actions) ou manual via GET.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cronSecret = searchParams.get("secret");
  if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runWeeklyConsolidation();

    console.log(`[Vault Weekly] Consolidacao concluida: ${result.notePath} (${result.dailiesProcessed} dailies)`);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Vault Weekly] Erro na consolidacao:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
