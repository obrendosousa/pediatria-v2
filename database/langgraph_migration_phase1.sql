-- LangGraph Big-Bang Migration - Phase 1
-- Safe and additive schema changes for worker orchestration.

ALTER TABLE chats
  ADD COLUMN IF NOT EXISTS langgraph_thread_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_chats_langgraph_thread_id
  ON chats (langgraph_thread_id)
  WHERE langgraph_thread_id IS NOT NULL;

ALTER TABLE scheduled_messages
  ADD COLUMN IF NOT EXISTS run_id UUID,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS dispatch_locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dispatch_locked_by TEXT,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_status_scheduled_for
  ON scheduled_messages (status, scheduled_for);

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_status_next_retry_at
  ON scheduled_messages (status, next_retry_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_scheduled_messages_idempotency_key
  ON scheduled_messages (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE automation_logs
  ADD COLUMN IF NOT EXISTS run_id UUID,
  ADD COLUMN IF NOT EXISTS node_name TEXT;

CREATE TABLE IF NOT EXISTS langgraph_dead_letter (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  run_id UUID,
  thread_id TEXT,
  source_graph TEXT NOT NULL,
  source_node TEXT,
  scheduled_message_id BIGINT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  retryable BOOLEAN NOT NULL DEFAULT true,
  next_retry_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_langgraph_dead_letter_retryable_next
  ON langgraph_dead_letter (retryable, next_retry_at);

CREATE INDEX IF NOT EXISTS idx_langgraph_dead_letter_run_id
  ON langgraph_dead_letter (run_id);

CREATE TABLE IF NOT EXISTS worker_run_logs (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  run_id UUID NOT NULL,
  thread_id TEXT,
  graph_name TEXT NOT NULL,
  node_name TEXT,
  level TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_worker_run_logs_run_id
  ON worker_run_logs (run_id);

-- Claim pending messages with SKIP LOCKED to avoid duplicate dispatch in parallel workers.
CREATE OR REPLACE FUNCTION claim_scheduled_messages(
  p_limit INTEGER,
  p_worker_id TEXT,
  p_now TIMESTAMPTZ DEFAULT NOW(),
  p_lock_timeout_seconds INTEGER DEFAULT 180
)
RETURNS SETOF scheduled_messages
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT id
    FROM scheduled_messages
    WHERE
      (
        status = 'pending'
        AND scheduled_for <= p_now
        AND (next_retry_at IS NULL OR next_retry_at <= p_now)
      )
      OR (
        status = 'processing'
        AND dispatch_locked_at IS NOT NULL
        AND dispatch_locked_at <= (p_now - make_interval(secs => GREATEST(p_lock_timeout_seconds, 30)))
      )
    ORDER BY scheduled_for ASC, id ASC
    FOR UPDATE SKIP LOCKED
    LIMIT GREATEST(p_limit, 1)
  ), updated AS (
    UPDATE scheduled_messages s
    SET status = 'processing',
        dispatch_locked_at = p_now,
        dispatch_locked_by = p_worker_id
    FROM candidates c
    WHERE s.id = c.id
    RETURNING s.*
  )
  SELECT * FROM updated;
END;
$$;
