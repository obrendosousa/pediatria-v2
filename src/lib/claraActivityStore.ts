/**
 * Clara Activity Store — estado global dos crons e atividades em tempo real.
 * Persiste em memória durante a sessão E no Supabase entre reinícios.
 */
import { createClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

function getDb(): AnySupabase | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Persiste o status de um cron no Supabase (fire-and-forget) */
function persistToDb(status: CronStatus): void {
  const db = getDb();
  if (!db) return;
  db.from("clara_cron_status").upsert({
    name: status.name,
    run_count: status.runCount,
    last_run_at: status.lastRunAt ?? null,
    last_success_at: status.lastSuccessAt ?? null,
    last_failure_at: status.lastFailureAt ?? null,
    last_error: status.lastError ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "name" }).then().catch(() => {});
}

/** Carrega status persistidos do Supabase na inicialização */
async function hydrateFromDb(): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    const { data } = await db.from("clara_cron_status").select("*");
    if (!data) return;
    for (const row of data as Array<{
      name: string; run_count: number;
      last_run_at?: string; last_success_at?: string;
      last_failure_at?: string; last_error?: string;
    }>) {
      const current = store.get(row.name);
      if (!current) continue;
      const hasRun = !!row.last_success_at || !!row.last_failure_at;
      store.set(row.name, {
        ...current,
        runCount: row.run_count ?? 0,
        lastRunAt: row.last_run_at,
        lastSuccessAt: row.last_success_at,
        lastFailureAt: row.last_failure_at,
        lastError: row.last_error ?? undefined,
        status: row.last_failure_at && (!row.last_success_at || row.last_failure_at > row.last_success_at)
          ? 'error'
          : hasRun ? 'ok' : 'never',
      });
    }
  } catch { /* silencioso — Supabase pode estar offline */ }
}

export interface CronStatus {
  name: string;
  label: string;
  description: string;
  intervalLabel: string;
  running: boolean;
  runCount: number;
  lastRunAt?: string;
  lastSuccessAt?: string;
  lastFailureAt?: string;
  lastError?: string;
  status: 'idle' | 'running' | 'ok' | 'error' | 'never';
}

const CRON_DEFINITIONS: Record<string, { label: string; description: string; intervalLabel: string }> = {
  scheduler:           { label: 'Agendador de Automações',    description: 'Avalia regras de automação e enfileira mensagens',    intervalLabel: '60s' },
  dispatch:            { label: 'Disparador de Mensagens',    description: 'Envia mensagens pendentes via WhatsApp',              intervalLabel: '10s' },
  'vault-daily':       { label: 'Vault — Diário',             description: 'Atualiza scratchpad e métricas diárias do vault',     intervalLabel: 'Diário 01h BRT' },
  'vault-weekly':      { label: 'Vault — Semanal',            description: 'Gera relatório semanal e atualiza MOCs',              intervalLabel: 'Domingo 02h BRT' },
  'vault-monthly':     { label: 'Vault — Mensal',             description: 'Consolida conhecimento mensal e atualiza índice',     intervalLabel: 'Dia 1 03h BRT' },
  'clara-task-executor': { label: 'Executor de Tarefas',      description: 'Executa tarefas agendadas pela Clara',                intervalLabel: '30s' },
  'memory-consolidation': { label: 'Consolidação de Memória', description: 'Deduplica e re-categoriza memórias (quarta 02h BRT)', intervalLabel: 'Quarta 02h BRT' },
  'memory-hard-delete': { label: 'Limpeza LGPD',              description: 'Remove memórias arquivadas há >90 dias',              intervalLabel: 'Sexta 03h BRT' },
  'memory-brain':      { label: '🧠 Brain — Ciclo de Sono',   description: 'Poda, dedup, consolida e reconecta o vault de memórias', intervalLabel: 'Domingo 03h BRT' },
  autonomous:          { label: 'Agente Autônomo',             description: 'Gera rascunhos de resgate para chats dormentes',     intervalLabel: '15min' },
};

// Store de estado — persiste em memória enquanto o processo rodar
const store = new Map<string, CronStatus>();

// Inicializar com todos os crons definidos
for (const [name, def] of Object.entries(CRON_DEFINITIONS)) {
  store.set(name, {
    name,
    ...def,
    running: false,
    runCount: 0,
    status: 'never',
  });
}

export function markCronStart(name: string) {
  const current = store.get(name) ?? createDefault(name);
  store.set(name, { ...current, running: true, status: 'running', lastRunAt: new Date().toISOString() });
}

export function markCronSuccess(name: string) {
  const current = store.get(name) ?? createDefault(name);
  const updated: CronStatus = {
    ...current,
    running: false,
    status: 'ok',
    runCount: current.runCount + 1,
    lastSuccessAt: new Date().toISOString(),
    lastError: undefined,
  };
  store.set(name, updated);
  persistToDb(updated);
}

export function markCronError(name: string, error: unknown) {
  const current = store.get(name) ?? createDefault(name);
  const updated: CronStatus = {
    ...current,
    running: false,
    status: 'error',
    runCount: current.runCount + 1,
    lastFailureAt: new Date().toISOString(),
    lastError: error instanceof Error ? error.message : String(error),
  };
  store.set(name, updated);
  persistToDb(updated);
}

// Lock de sessão de estudo — impede heartbeat de colidir com study-session
let _studyRunning = false;
export function setStudySessionRunning(v: boolean) { _studyRunning = v; }
export function isStudySessionRunning(): boolean { return _studyRunning; }

// Hidrata do Supabase na primeira leitura (lazy, fire-and-forget)
let hydrated = false;
export function ensureHydrated(): void {
  if (hydrated) return;
  hydrated = true;
  hydrateFromDb().catch(() => {});
}

export function getCronStatuses(): CronStatus[] {
  return Array.from(store.values());
}

function createDefault(name: string): CronStatus {
  const def = CRON_DEFINITIONS[name];
  return {
    name,
    label: def?.label ?? name,
    description: def?.description ?? '',
    intervalLabel: def?.intervalLabel ?? '?',
    running: false,
    runCount: 0,
    status: 'never',
  };
}
