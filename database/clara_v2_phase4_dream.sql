-- Clara v2 Phase 4 - Dream System + Scheduled Analysis
-- Migration: clara_v2_phase4_dream.sql
-- Date: 2026-04-02

-- Tracking de execucao de crons (evitar duplicatas, historico)
CREATE TABLE IF NOT EXISTS public.clara_cron_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cron_type TEXT NOT NULL,
  executed_at TIMESTAMPTZ DEFAULT NOW(),
  agents_processed TEXT[],
  reports_created INTEGER DEFAULT 0,
  alerts_count INTEGER DEFAULT 0,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  execution_time_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_cron_executions_type_date
  ON public.clara_cron_executions(cron_type, executed_at DESC);

ALTER TABLE public.clara_cron_executions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on clara_cron_executions" ON public.clara_cron_executions;
CREATE POLICY "Service role full access on clara_cron_executions"
  ON public.clara_cron_executions FOR ALL
  USING (true) WITH CHECK (true);
