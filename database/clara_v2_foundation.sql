-- Clara v2 Neural Network - Foundation Tables
-- Migration: clara_v2_foundation.sql
-- Date: 2026-04-02
-- Description: Creates coordination tables for multi-agent architecture
--   - clara_tasks: TaskStore for coordinator/worker task tracking
--   - clara_agent_messages: Inter-agent communication bus
--   - clara_dream_state: Memory consolidation state per agent
--   - ALTER clara_reports: Add agent_id, report_type, structured_data
--   - ALTER clara_memories: Add agent_id for per-agent segmentation

-- =========================================================================
-- TABLE 1: clara_tasks (TaskStore)
-- Based on Claude Code's tasks.rs pattern, adapted for Supabase persistence
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.clara_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  parent_task_id UUID REFERENCES public.clara_tasks(id) ON DELETE SET NULL,

  -- Status lifecycle: pending → running → completed/failed/cancelled
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),

  -- Dependencies (from tasks.rs blocks/blocked_by pattern)
  blocked_by UUID[] DEFAULT '{}',
  blocks UUID[] DEFAULT '{}',

  -- Input/Output
  input_params JSONB,
  output_data JSONB,
  output_schema TEXT,
  error_message TEXT,

  -- Metrics
  token_usage INTEGER DEFAULT 0,
  execution_time_ms INTEGER,
  model_used TEXT,

  -- Retry control
  max_retries INTEGER DEFAULT 2,
  retry_count INTEGER DEFAULT 0,
  timeout_ms INTEGER DEFAULT 120000,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_clara_tasks_status ON public.clara_tasks(status);
CREATE INDEX IF NOT EXISTS idx_clara_tasks_agent ON public.clara_tasks(agent_id);
CREATE INDEX IF NOT EXISTS idx_clara_tasks_parent ON public.clara_tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_clara_tasks_created ON public.clara_tasks(created_at DESC);

-- RLS: Service role full access (agents run server-side)
ALTER TABLE public.clara_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Service role full access on clara_tasks"
  ON public.clara_tasks FOR ALL
  USING (true)
  WITH CHECK (true);


-- =========================================================================
-- TABLE 2: clara_agent_messages (Inter-Agent Communication)
-- Based on Claude Code's send_message.rs DashMap inbox, adapted for Supabase
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.clara_agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_agent TEXT NOT NULL,
  to_agent TEXT NOT NULL,
  task_id UUID REFERENCES public.clara_tasks(id) ON DELETE SET NULL,
  message_type TEXT NOT NULL
    CHECK (message_type IN ('directive', 'result', 'error', 'status_update')),
  content JSONB NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_messages_to ON public.clara_agent_messages(to_agent, read_at);
CREATE INDEX IF NOT EXISTS idx_agent_messages_task ON public.clara_agent_messages(task_id);
CREATE INDEX IF NOT EXISTS idx_agent_messages_created ON public.clara_agent_messages(created_at DESC);

ALTER TABLE public.clara_agent_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Service role full access on clara_agent_messages"
  ON public.clara_agent_messages FOR ALL
  USING (true)
  WITH CHECK (true);


-- =========================================================================
-- TABLE 3: clara_dream_state (Memory Consolidation State)
-- Based on Claude Code's auto_dream.rs 3-gate system
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.clara_dream_state (
  id TEXT PRIMARY KEY,  -- agent_id as PK
  last_consolidated_at TIMESTAMPTZ,
  lock_acquired_at TIMESTAMPTZ,
  lock_acquired_by TEXT,
  session_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.clara_dream_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Service role full access on clara_dream_state"
  ON public.clara_dream_state FOR ALL
  USING (true)
  WITH CHECK (true);


-- =========================================================================
-- ALTER: clara_reports — Add multi-agent fields
-- =========================================================================

DO $$
BEGIN
  -- Add agent_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clara_reports' AND column_name = 'agent_id'
  ) THEN
    ALTER TABLE public.clara_reports ADD COLUMN agent_id TEXT DEFAULT 'ceo_agent';
  END IF;

  -- Add report_type column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clara_reports' AND column_name = 'report_type'
  ) THEN
    ALTER TABLE public.clara_reports ADD COLUMN report_type TEXT DEFAULT 'on_demand';
  END IF;

  -- Add structured_data column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clara_reports' AND column_name = 'structured_data'
  ) THEN
    ALTER TABLE public.clara_reports ADD COLUMN structured_data JSONB;
  END IF;

  -- Add period columns
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clara_reports' AND column_name = 'period_start'
  ) THEN
    ALTER TABLE public.clara_reports ADD COLUMN period_start DATE;
    ALTER TABLE public.clara_reports ADD COLUMN period_end DATE;
  END IF;

  -- Add quality metrics
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clara_reports' AND column_name = 'confidence_score'
  ) THEN
    ALTER TABLE public.clara_reports ADD COLUMN confidence_score REAL;
    ALTER TABLE public.clara_reports ADD COLUMN data_sources TEXT[];
    ALTER TABLE public.clara_reports ADD COLUMN execution_time_ms INTEGER;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_clara_reports_agent_type
  ON public.clara_reports(agent_id, report_type);


-- =========================================================================
-- ALTER: clara_memories — Add agent_id for per-agent segmentation
-- =========================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clara_memories' AND column_name = 'agent_id'
  ) THEN
    ALTER TABLE public.clara_memories ADD COLUMN agent_id TEXT DEFAULT 'ceo_agent';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_clara_memories_agent
  ON public.clara_memories(agent_id);
