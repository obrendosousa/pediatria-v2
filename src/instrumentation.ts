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

  // Import dinâmico para evitar carregar código server-side no build
  const { runAutomationSchedulerGraph } = await import(
    "@/lib/automation/graphs/automationScheduler"
  );
  const { runScheduledDispatchGraph } = await import(
    "@/lib/automation/graphs/scheduledDispatch"
  );
  const { randomUUID } = await import("node:crypto");

  let schedulerRunning = false;
  let dispatchRunning = false;
  let autonomousRunning = false;

  // --- Scheduler: a cada 60s, avalia regras e enfileira mensagens ---
  const SCHEDULER_INTERVAL = Number(process.env.EMBEDDED_SCHEDULER_INTERVAL_MS) || 60_000;
  setInterval(async () => {
    if (schedulerRunning) return;
    schedulerRunning = true;
    try {
      await runAutomationSchedulerGraph({
        contractVersion: "v1",
        runId: randomUUID(),
        triggerAt: new Date().toISOString(),
        dryRun: false,
      });
    } catch (err) {
      console.error("[Instrumentation][Scheduler] Erro:", err);
    } finally {
      schedulerRunning = false;
    }
  }, SCHEDULER_INTERVAL);

  // --- Dispatch: a cada 10s, envia mensagens pendentes via WhatsApp ---
  const DISPATCH_INTERVAL = Number(process.env.EMBEDDED_DISPATCH_INTERVAL_MS) || 10_000;
  setInterval(async () => {
    if (dispatchRunning) return;
    dispatchRunning = true;
    try {
      await runScheduledDispatchGraph({
        contractVersion: "v1",
        runId: randomUUID(),
        batchSize: 25,
        dryRun: false,
      });
    } catch (err) {
      console.error("[Instrumentation][Dispatch] Erro:", err);
    } finally {
      dispatchRunning = false;
    }
  }, DISPATCH_INTERVAL);

  // --- Agente Autônomo: a cada 15min, gera rascunhos para chats dormentes ---
  const AUTONOMOUS_INTERVAL = Number(process.env.EMBEDDED_AUTONOMOUS_INTERVAL_MS) || 15 * 60_000;
  setInterval(async () => {
    if (autonomousRunning) return;
    autonomousRunning = true;
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
        return;
      }

      if (!dormantChats || dormantChats.length === 0) return;

      const { autonomousGraph } = await import("@/ai/autonomous/graph");
      await autonomousGraph.invoke({
        messages: [],
        dormant_chats: dormantChats,
      });
      console.log(`[Instrumentation][Autonomous] ${dormantChats.length} rascunhos gerados`);
    } catch (err) {
      console.error("[Instrumentation][Autonomous] Erro:", err);
    } finally {
      autonomousRunning = false;
    }
  }, AUTONOMOUS_INTERVAL);

  // Roda scheduler + dispatch imediatamente na primeira vez
  setTimeout(async () => {
    try {
      schedulerRunning = true;
      await runAutomationSchedulerGraph({
        contractVersion: "v1",
        runId: randomUUID(),
        triggerAt: new Date().toISOString(),
        dryRun: false,
      });
    } catch (err) {
      console.error("[Instrumentation][Scheduler] Erro no boot:", err);
    } finally {
      schedulerRunning = false;
    }
  }, 5_000);

  console.log(
    `[Instrumentation] Crons ativos — Scheduler: ${SCHEDULER_INTERVAL / 1000}s | Dispatch: ${DISPATCH_INTERVAL / 1000}s | Autonomous: ${AUTONOMOUS_INTERVAL / 60_000}min`
  );
}
