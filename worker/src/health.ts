export interface WorkerHealthState {
  startedAtIso: string;
  lastDispatchRunAtIso?: string;
  lastSchedulerRunAtIso?: string;
  lastError?: string;
}

export const workerHealthState: WorkerHealthState = {
  startedAtIso: new Date().toISOString(),
};

export function markDispatchRun() {
  workerHealthState.lastDispatchRunAtIso = new Date().toISOString();
}

export function markSchedulerRun() {
  workerHealthState.lastSchedulerRunAtIso = new Date().toISOString();
}

export function markWorkerError(error: unknown) {
  workerHealthState.lastError =
    error instanceof Error ? error.message : typeof error === "string" ? error : "unknown_error";
}
