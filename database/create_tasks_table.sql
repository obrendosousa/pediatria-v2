-- Migração: Tabela de Tarefas (tasks)
-- Schema: atendimento
-- Executar no Supabase SQL Editor

-- ── Criar tabela (se não existir) ──
CREATE TABLE IF NOT EXISTS atendimento.tasks (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  description TEXT DEFAULT '',
  type TEXT NOT NULL DEFAULT 'general'
    CHECK (type IN ('general', 'sticky_note')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'done', 'deleted')),
  due_date DATE,
  due_time TIME,
  metadata JSONB DEFAULT '{}',
  position INTEGER DEFAULT 0,
  chat_id BIGINT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Adicionar user_id se a tabela já existir mas sem a coluna ──
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'atendimento' AND table_name = 'tasks' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE atendimento.tasks ADD COLUMN user_id UUID;
  END IF;
END $$;

-- ── Índices ──
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON atendimento.tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_type ON atendimento.tasks(type);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON atendimento.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON atendimento.tasks(due_date);

-- ── RLS ──
ALTER TABLE atendimento.tasks ENABLE ROW LEVEL SECURITY;

-- Política: cada usuário só vê/edita suas próprias tarefas
DROP POLICY IF EXISTS "tasks_user_own" ON atendimento.tasks;
CREATE POLICY "tasks_user_own" ON atendimento.tasks
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
