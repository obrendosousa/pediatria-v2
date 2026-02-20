export interface CronJobDefinition {
  name: string;
  intervalMs: number;
  task: () => Promise<void>;
  runOnStart?: boolean;
  maxBackoffMs?: number;
}

export interface CronJobSnapshot {
  name: string;
  intervalMs: number;
  running: boolean;
  runCount: number;
  skipCount: number;
  consecutiveFailures: number;
  lastRunAtIso?: string;
  lastSuccessAtIso?: string;
  lastFailureAtIso?: string;
  nextRunAtIso?: string;
  lastError?: string;
}

interface CronJobInternalState {
  definition: CronJobDefinition;
  running: boolean;
  runCount: number;
  skipCount: number;
  consecutiveFailures: number;
  timer: NodeJS.Timeout | null;
  lastRunAtIso?: string;
  lastSuccessAtIso?: string;
  lastFailureAtIso?: string;
  nextRunAtIso?: string;
  lastError?: string;
}

function parsePositiveInt(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function calcBackoffMs(intervalMs: number, failures: number, maxBackoffMs: number): number {
  if (failures <= 0) return intervalMs;
  const multiplier = Math.pow(2, Math.min(failures - 1, 6));
  return Math.min(intervalMs * multiplier, maxBackoffMs);
}

export class RobustCronManager {
  private jobs = new Map<string, CronJobInternalState>();
  private started = false;
  private stopping = false;

  register(definition: CronJobDefinition) {
    if (this.jobs.has(definition.name)) {
      throw new Error(`cron_job_already_registered:${definition.name}`);
    }
    const intervalMs = parsePositiveInt(definition.intervalMs, 1000);
    const maxBackoffMs = parsePositiveInt(definition.maxBackoffMs || intervalMs * 10, intervalMs * 10);
    this.jobs.set(definition.name, {
      definition: {
        ...definition,
        intervalMs,
        maxBackoffMs,
      },
      running: false,
      runCount: 0,
      skipCount: 0,
      consecutiveFailures: 0,
      timer: null,
    });
  }

  async start() {
    if (this.started) return;
    this.started = true;
    this.stopping = false;

    await Promise.all(
      Array.from(this.jobs.values()).map(async (job) => {
        if (job.definition.runOnStart ?? true) {
          await this.execute(job);
          return;
        }
        this.schedule(job, job.definition.intervalMs);
      })
    );
  }

  async stop() {
    this.stopping = true;
    for (const job of this.jobs.values()) {
      if (job.timer) {
        clearTimeout(job.timer);
        job.timer = null;
      }
    }
  }

  snapshot(): CronJobSnapshot[] {
    return Array.from(this.jobs.values()).map((job) => ({
      name: job.definition.name,
      intervalMs: job.definition.intervalMs,
      running: job.running,
      runCount: job.runCount,
      skipCount: job.skipCount,
      consecutiveFailures: job.consecutiveFailures,
      lastRunAtIso: job.lastRunAtIso,
      lastSuccessAtIso: job.lastSuccessAtIso,
      lastFailureAtIso: job.lastFailureAtIso,
      nextRunAtIso: job.nextRunAtIso,
      lastError: job.lastError,
    }));
  }

  private schedule(job: CronJobInternalState, delayMs: number) {
    if (this.stopping) return;
    const nextDelayMs = parsePositiveInt(delayMs, job.definition.intervalMs);
    job.nextRunAtIso = new Date(Date.now() + nextDelayMs).toISOString();
    job.timer = setTimeout(() => {
      void this.execute(job);
    }, nextDelayMs);
  }

  private async execute(job: CronJobInternalState) {
    if (this.stopping) return;
    if (job.running) {
      job.skipCount += 1;
      this.schedule(job, job.definition.intervalMs);
      return;
    }

    job.running = true;
    job.runCount += 1;
    job.lastRunAtIso = new Date().toISOString();
    job.nextRunAtIso = undefined;

    try {
      await job.definition.task();
      job.consecutiveFailures = 0;
      job.lastError = undefined;
      job.lastSuccessAtIso = new Date().toISOString();
      this.schedule(job, job.definition.intervalMs);
    } catch (error) {
      job.consecutiveFailures += 1;
      job.lastFailureAtIso = new Date().toISOString();
      job.lastError =
        error instanceof Error ? error.message : typeof error === "string" ? error : "unknown_error";
      const nextDelay = calcBackoffMs(
        job.definition.intervalMs,
        job.consecutiveFailures,
        job.definition.maxBackoffMs || job.definition.intervalMs * 10
      );
      this.schedule(job, nextDelay);
    } finally {
      job.running = false;
    }
  }
}
