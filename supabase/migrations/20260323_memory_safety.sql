-- Soft delete
ALTER TABLE clara_memories ADD COLUMN IF NOT EXISTS archived boolean DEFAULT false;
ALTER TABLE clara_memories ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE clara_memories ADD COLUMN IF NOT EXISTS archive_reason text;
-- Quality fields
ALTER TABLE clara_memories ADD COLUMN IF NOT EXISTS quality_score int DEFAULT NULL;
ALTER TABLE clara_memories ADD COLUMN IF NOT EXISTS embedding_status text DEFAULT 'ok';
-- Backfill embedding_status
UPDATE clara_memories SET embedding_status = CASE WHEN embedding IS NULL THEN 'failed' ELSE 'ok' END;
-- Indexes
CREATE INDEX IF NOT EXISTS idx_clara_memories_active ON clara_memories(archived) WHERE archived = false;
CREATE INDEX IF NOT EXISTS idx_embedding_pending ON clara_memories(embedding_status) WHERE embedding_status IN ('pending', 'failed');
-- Audit log table (separate from clara_memories)
CREATE TABLE IF NOT EXISTS memory_audit_log (
  id serial PRIMARY KEY,
  run_at timestamptz NOT NULL DEFAULT now(),
  operation text NOT NULL,
  memories_before int,
  memories_after int,
  clusters_found int,
  singletons_kept int,
  singletons_discarded int,
  embedding_failures int,
  details jsonb,
  dry_run boolean DEFAULT false
);
