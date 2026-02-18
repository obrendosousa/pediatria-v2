import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/automation/adapters/supabaseAdmin";

export async function GET() {
  try {
    const supabase = getSupabaseAdminClient();
    const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [sentRes, failedRes, deadLetterRes] = await Promise.all([
      supabase
        .from("scheduled_messages")
        .select("id", { count: "exact", head: true })
        .gte("sent_at", sinceIso)
        .eq("status", "sent"),
      supabase
        .from("scheduled_messages")
        .select("id", { count: "exact", head: true })
        .gte("updated_at", sinceIso)
        .eq("status", "failed"),
      supabase
        .from("langgraph_dead_letter")
        .select("id", { count: "exact", head: true })
        .gte("created_at", sinceIso),
    ]);

    if (sentRes.error) throw sentRes.error;
    if (failedRes.error) throw failedRes.error;
    if (deadLetterRes.error) throw deadLetterRes.error;

    const sent = sentRes.count || 0;
    const failed = failedRes.count || 0;
    const deadLetter = deadLetterRes.count || 0;
    const total = sent + failed;
    const successRate = total > 0 ? (sent / total) * 100 : 100;

    return NextResponse.json({
      ok: true,
      window: "24h",
      sent,
      failed,
      deadLetter,
      successRate,
      sloTargets: {
        successRateMin: 95,
        deadLetterMax: 20,
      },
      sloStatus: {
        successRate: successRate >= 95 ? "pass" : "fail",
        deadLetter: deadLetter <= 20 ? "pass" : "fail",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "slo_metrics_failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
