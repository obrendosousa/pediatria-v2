-- Tabela de status dos crons da Clara
-- Persiste o estado entre reinícios do servidor
CREATE TABLE IF NOT EXISTS clara_cron_status (
  name              text PRIMARY KEY,
  run_count         int  DEFAULT 0,
  last_run_at       timestamptz,
  last_success_at   timestamptz,
  last_failure_at   timestamptz,
  last_error        text,
  updated_at        timestamptz DEFAULT now()
);

-- Audit log das consolidações de memória
CREATE TABLE IF NOT EXISTS memory_audit_log (
  id                serial PRIMARY KEY,
  run_at            timestamptz NOT NULL DEFAULT now(),
  operation         text NOT NULL,
  memories_before   int,
  memories_after    int,
  clusters_found    int,
  singletons_kept   int,
  singletons_discarded int,
  embedding_failures int,
  details           jsonb,
  dry_run           boolean DEFAULT false
);
