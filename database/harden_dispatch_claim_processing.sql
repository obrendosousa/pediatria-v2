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
