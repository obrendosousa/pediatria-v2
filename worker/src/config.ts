export interface WorkerConfig {
  port: number;
  pollIntervalMs: number;
  schedulerIntervalMs: number;
  dryRun: boolean;
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export function getWorkerConfig(): WorkerConfig {
  const isProd = process.env.NODE_ENV === "production";
  const dryRunEnv = String(process.env.WORKER_DRY_RUN || "").toLowerCase();
  const dryRun =
    dryRunEnv === "true"
      ? true
      : dryRunEnv === "false"
      ? false
      : !isProd;

  return {
    port: parsePositiveInt(process.env.WORKER_PORT, 4040),
    pollIntervalMs: parsePositiveInt(process.env.WORKER_POLL_INTERVAL_MS, 5000),
    schedulerIntervalMs: parsePositiveInt(process.env.WORKER_SCHEDULER_INTERVAL_MS, 60000),
    dryRun,
  };
}
