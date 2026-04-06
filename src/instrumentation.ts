/**
 * Next.js Instrumentation — roda UMA vez quando o servidor inicia.
 * Embute scheduler + dispatch + agente autônomo direto no processo Next.js,
 * eliminando a necessidade de Redis e de um serviço worker separado.
 *
 * Seguro para deploy: cada cron usa flag `running` para evitar sobreposição,
 * e o dispatch usa SKIP LOCKED no Postgres para evitar envio duplo.
 */
export async function register() {
  // Só roda no servidor Node.js (não no Edge nem no browser)
  if (typeof globalThis.setTimeout !== "function") return;
  if (process.env.NEXT_RUNTIME === "edge") return;

  // Evita iniciar em build time (next build roda register mas não queremos cron)
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  // Desabilita o cron embutido se houver um worker externo rodando
  if (process.env.DISABLE_EMBEDDED_CRON === "true") return;

  console.log("[Instrumentation] Iniciando crons embutidos...");

  const { markCronStart, markCronSuccess, markCronError } = await import("@/lib/claraActivityStore");

  // Import dinâmico para evitar carregar código server-side no build
  const { runAutomationSchedulerGraph } = await import(
    "@/lib/automation/graphs/automationScheduler"
  );
  const { runScheduledDispatchGraph } = await import(
    "@/lib/automation/graphs/scheduledDispatch"
  );
  let schedulerRunning = false;
  let dispatchRunning = false;
  let autonomousRunning = false;

  // --- Scheduler: a cada 60s, avalia regras e enfileira mensagens ---
  const SCHEDULER_INTERVAL = Number(process.env.EMBEDDED_SCHEDULER_INTERVAL_MS) || 60_000;
  setInterval(async () => {
    if (schedulerRunning) return;
    schedulerRunning = true;
    markCronStart("scheduler");
    try {
      await runAutomationSchedulerGraph({
        contractVersion: "v1",
        runId: crypto.randomUUID(),
        triggerAt: new Date().toISOString(),
        dryRun: false,
      });
      markCronSuccess("scheduler");
    } catch (err) {
      console.error("[Instrumentation][Scheduler] Erro:", err);
      markCronError("scheduler", err);
    } finally {
      schedulerRunning = false;
    }
  }, SCHEDULER_INTERVAL);

  // --- Dispatch: a cada 10s, envia mensagens pendentes via WhatsApp ---
  const DISPATCH_INTERVAL = Number(process.env.EMBEDDED_DISPATCH_INTERVAL_MS) || 10_000;
  setInterval(async () => {
    if (dispatchRunning) return;
    dispatchRunning = true;
    markCronStart("dispatch");
    try {
      await runScheduledDispatchGraph({
        contractVersion: "v1",
        runId: crypto.randomUUID(),
        batchSize: 25,
        dryRun: false,
      });
      markCronSuccess("dispatch");
    } catch (err) {
      console.error("[Instrumentation][Dispatch] Erro:", err);
      markCronError("dispatch", err);
    } finally {
      dispatchRunning = false;
    }
  }, DISPATCH_INTERVAL);

  // --- Agente Autônomo: a cada 15min, gera rascunhos para chats dormentes ---
  const AUTONOMOUS_INTERVAL = Number(process.env.EMBEDDED_AUTONOMOUS_INTERVAL_MS) || 15 * 60_000;
  setInterval(async () => {
    if (autonomousRunning) return;
    autonomousRunning = true;
    markCronStart("autonomous");
    try {
      const { getSupabaseAdminClient } = await import(
        "@/lib/automation/adapters/supabaseAdmin"
      );
      const supabase = getSupabaseAdminClient();

      const threshold = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const { data: dormantChats, error } = await supabase
        .from("chats")
        .select("id, contact_name, stage, ai_summary")
        .eq("status", "ACTIVE")
        .is("ai_draft_reply", null)
        .lt("last_interaction_at", threshold)
        .limit(20);

      if (error) {
        console.error("[Instrumentation][Autonomous] Query error:", error.message);
        markCronError("autonomous", error);
        return;
      }

      if (!dormantChats || dormantChats.length === 0) {
        markCronSuccess("autonomous");
        return;
      }

      const { autonomousGraph } = await import("@/ai/autonomous/graph");
      await autonomousGraph.invoke({
        messages: [],
        dormant_chats: dormantChats,
      });
      console.log(`[Instrumentation][Autonomous] ${dormantChats.length} rascunhos gerados`);
      markCronSuccess("autonomous");
    } catch (err) {
      console.error("[Instrumentation][Autonomous] Erro:", err);
      markCronError("autonomous", err);
    } finally {
      autonomousRunning = false;
    }
  }, AUTONOMOUS_INTERVAL);

  // Roda scheduler + dispatch imediatamente na primeira vez
  setTimeout(async () => {
    markCronStart("scheduler");
    try {
      schedulerRunning = true;
      await runAutomationSchedulerGraph({
        contractVersion: "v1",
        runId: crypto.randomUUID(),
        triggerAt: new Date().toISOString(),
        dryRun: false,
      });
      markCronSuccess("scheduler");
    } catch (err) {
      console.error("[Instrumentation][Scheduler] Erro no boot:", err);
      markCronError("scheduler", err);
    } finally {
      schedulerRunning = false;
    }
  }, 5_000);

  // --- Clara v2: Analise diaria (6h BRT) + Dream check (2h BRT) ---
  const V2_CHECK_INTERVAL = 5 * 60 * 1000;
  let analysisDailyRunning = false;
  let dreamCheckRunning = false;
  let lastAnalysisDate = '';
  let lastDreamDate = '';

  setInterval(async () => {
    const now = new Date();
    const hourBRT = (now.getUTCHours() - 3 + 24) % 24;
    const todayStr = now.toISOString().split('T')[0];
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const secret = process.env.CRON_SECRET || "";

    // Daily analysis at 6h BRT (once per day, secret via header)
    if (hourBRT === 6 && lastAnalysisDate !== todayStr && !analysisDailyRunning) {
      analysisDailyRunning = true;
      lastAnalysisDate = todayStr;
      markCronStart("analysis_daily");
      try {
        await fetch(`${baseUrl}/api/cron/analysis-daily?secret=${secret}`);
        markCronSuccess("analysis_daily");
      } catch (err) {
        markCronError("analysis_daily", err);
      } finally {
        analysisDailyRunning = false;
      }
    }

    // Dream check at 2h BRT (once per day)
    if (hourBRT === 2 && lastDreamDate !== todayStr && !dreamCheckRunning) {
      dreamCheckRunning = true;
      lastDreamDate = todayStr;
      markCronStart("dream_check");
      try {
        await fetch(`${baseUrl}/api/cron/dream-check?secret=${secret}`);
        markCronSuccess("dream_check");
      } catch (err) {
        markCronError("dream_check", err);
      } finally {
        dreamCheckRunning = false;
      }
    }
  }, V2_CHECK_INTERVAL);

  console.log(
    `[Instrumentation] Crons ativos — Scheduler: ${SCHEDULER_INTERVAL / 1000}s | Dispatch: ${DISPATCH_INTERVAL / 1000}s | Autonomous: ${AUTONOMOUS_INTERVAL / 60_000}min | AnalysisDaily: 6h BRT | DreamCheck: 2h BRT`
  );
}
