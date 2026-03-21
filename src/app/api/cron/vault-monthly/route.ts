import { NextResponse } from "next/server";
import { runMonthlyConsolidation } from "@/ai/vault/consolidation";

/**
 * Cron: Meta-analise mensal do vault.
 * Roda no ultimo dia do mes — analisa weeklies + decisoes com Gemini Pro.
 * Atualiza graphs/gap-analysis.md e graphs/topic-map.md.
 * Trigger: cron externo (Vercel Cron / GitHub Actions) ou manual via GET.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cronSecret = searchParams.get("secret");
  if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const targetMonth = searchParams.get("month") || undefined;
    const result = await runMonthlyConsolidation(targetMonth);

    console.log(`[Vault Monthly] Meta-analise concluida: ${result.notePath}`);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Vault Monthly] Erro na meta-analise:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
