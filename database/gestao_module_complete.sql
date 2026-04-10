-- =============================================================================
-- Módulo de Gestão de Tarefas & Chat Interno — Schema Completo
-- Versão: 2.0 (com todas as correções da errata §11 do PRD Backend)
-- Executar no Supabase SQL Editor
-- =============================================================================

-- =============================================================================
-- 0. Extensões necessárias
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =============================================================================
-- 1. Schema e Permissões (SEM anon — errata §11.4.1)
-- =============================================================================
CREATE SCHEMA IF NOT EXISTS gestao;

GRANT USAGE ON SCHEMA gestao TO authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA gestao TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA gestao GRANT ALL ON TABLES TO authenticated, service_role;

-- =============================================================================
-- 2. Função utilitária: verificar usuário aprovado
-- =============================================================================
CREATE OR REPLACE FUNCTION gestao.is_approved_user()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND status = 'approved'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =============================================================================
-- 3. Tabelas do Kanban
-- =============================================================================

CREATE TABLE IF NOT EXISTS gestao.boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  visibility TEXT DEFAULT 'team' CHECK (visibility IN ('private','team','public')),
  icon TEXT,
  color TEXT,
  is_default BOOLEAN DEFAULT false,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gestao.board_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES gestao.boards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner','admin','member','viewer')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(board_id, user_id)
);

CREATE TABLE IF NOT EXISTS gestao.columns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES gestao.boards(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  position INT NOT NULL DEFAULT 0,
  wip_limit INT,
  is_done_column BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_columns_board_position ON gestao.columns(board_id, position);

-- =============================================================================
-- 4. Tabelas de Tarefas
-- =============================================================================

CREATE TABLE IF NOT EXISTS gestao.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES gestao.boards(id) ON DELETE CASCADE,
  column_id UUID REFERENCES gestao.columns(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'none' CHECK (priority IN ('urgent','high','medium','low','none')),
  position INT DEFAULT 0,
  assignee_id UUID REFERENCES public.profiles(id),
  creator_id UUID NOT NULL REFERENCES public.profiles(id),
  due_date DATE,
  completed_at TIMESTAMPTZ,
  is_archived BOOLEAN DEFAULT false,
  source_message_id UUID,
  legacy_task_id INT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_board_column ON gestao.tasks(board_id, column_id, position) WHERE NOT is_archived;
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON gestao.tasks(assignee_id) WHERE NOT is_archived;
CREATE INDEX IF NOT EXISTS idx_tasks_overdue ON gestao.tasks(due_date, assignee_id) WHERE completed_at IS NULL AND NOT is_archived;
CREATE INDEX IF NOT EXISTS idx_tasks_completed ON gestao.tasks(completed_at DESC) WHERE completed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_filters ON gestao.tasks(board_id, assignee_id, priority, due_date) WHERE NOT is_archived;
CREATE INDEX IF NOT EXISTS idx_tasks_title_trgm ON gestao.tasks USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_tasks_description_trgm ON gestao.tasks USING GIN (description gin_trgm_ops);

CREATE TABLE IF NOT EXISTS gestao.labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID REFERENCES gestao.boards(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(board_id, name)
);

CREATE TABLE IF NOT EXISTS gestao.task_labels (
  task_id UUID NOT NULL REFERENCES gestao.tasks(id) ON DELETE CASCADE,
  label_id UUID NOT NULL REFERENCES gestao.labels(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, label_id)
);

CREATE TABLE IF NOT EXISTS gestao.checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES gestao.tasks(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  is_done BOOLEAN DEFAULT false,
  position INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checklist_task ON gestao.checklist_items(task_id, position);

CREATE TABLE IF NOT EXISTS gestao.task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES gestao.tasks(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id),
  content TEXT NOT NULL,
  mentions UUID[] DEFAULT '{}',
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comments_task ON gestao.task_comments(task_id, created_at);

-- Log de atividade (imutável — LGPD)
CREATE TABLE IF NOT EXISTS gestao.task_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES gestao.tasks(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.profiles(id),
  action TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_task ON gestao.task_activity_log(task_id, created_at DESC);

-- Imutabilidade: revogar UPDATE/DELETE (errata §11.4.2)
REVOKE UPDATE, DELETE ON gestao.task_activity_log FROM authenticated, anon;

-- =============================================================================
-- 5. Tabelas de Chat (vínculo msg↔tarefa + fila Clara)
-- =============================================================================

CREATE TABLE IF NOT EXISTS gestao.message_task_links (
  message_id UUID NOT NULL REFERENCES public.internal_messages(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES gestao.tasks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (message_id, task_id)
);

CREATE TABLE IF NOT EXISTS gestao.clara_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  message_id UUID NOT NULL,
  message_content TEXT NOT NULL,
  sender_id UUID NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','processing','done','error')),
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_clara_queue_pending ON gestao.clara_queue(status, created_at) WHERE status = 'pending';

-- =============================================================================
-- 6. Notificações e Preferências
-- =============================================================================

CREATE TABLE IF NOT EXISTS gestao.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  is_read BOOLEAN DEFAULT false,
  entity_type TEXT CHECK (entity_type IN ('task','comment','chat','clara')),
  entity_id UUID,
  action_url TEXT,
  actor_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON gestao.notifications(user_id, created_at DESC) WHERE NOT is_read;

CREATE TABLE IF NOT EXISTS gestao.user_preferences (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id),
  default_board_id UUID REFERENCES gestao.boards(id),
  default_view TEXT DEFAULT 'kanban' CHECK (default_view IN ('kanban','list','calendar')),
  sidebar_collapsed BOOLEAN DEFAULT false,
  density TEXT DEFAULT 'comfortable' CHECK (density IN ('compact','comfortable','spacious')),
  notifications_enabled BOOLEAN DEFAULT true,
  notification_sound BOOLEAN DEFAULT true,
  email_digest TEXT DEFAULT 'none' CHECK (email_digest IN ('none','daily','weekly')),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 7. Evolução do Chat Interno (ALTER TABLE em tabelas existentes)
-- =============================================================================

ALTER TABLE public.internal_conversations
  ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'direct',
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS include_clara BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_pinned_by UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_archived_by UUID[] DEFAULT '{}';

-- CHECK constraint separada (ADD COLUMN IF NOT EXISTS não suporta inline CHECK)
DO $$ BEGIN
  ALTER TABLE public.internal_conversations
    ADD CONSTRAINT internal_conversations_type_check CHECK (type IN ('direct','group'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.internal_conversation_participants
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'member',
  ADD COLUMN IF NOT EXISTS is_muted BOOLEAN DEFAULT false;

DO $$ BEGIN
  ALTER TABLE public.internal_conversation_participants
    ADD CONSTRAINT icp_role_check CHECK (role IN ('admin','member'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.internal_messages
  ADD COLUMN IF NOT EXISTS reply_to_id UUID,
  ADD COLUMN IF NOT EXISTS mentions UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS metadata JSONB;

CREATE INDEX IF NOT EXISTS idx_internal_messages_reply ON public.internal_messages(reply_to_id) WHERE reply_to_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_internal_messages_pinned ON public.internal_messages(conversation_id) WHERE is_pinned = true;
CREATE INDEX IF NOT EXISTS idx_internal_messages_mentions ON public.internal_messages USING GIN (mentions);

-- Reações em mensagens do chat interno (NÃO confundir com public.message_reactions que é WhatsApp/bigint)
CREATE TABLE IF NOT EXISTS public.internal_message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.internal_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

-- =============================================================================
-- 8. Views Utilitárias (com CTEs otimizados — errata §11.5.1)
-- =============================================================================

CREATE OR REPLACE VIEW gestao.vw_tasks_enriched AS
WITH label_agg AS (
  SELECT tl.task_id, array_agg(jsonb_build_object('id', l.id, 'name', l.name, 'color', l.color)) AS labels
  FROM gestao.task_labels tl JOIN gestao.labels l ON l.id = tl.label_id
  GROUP BY tl.task_id
),
checklist_agg AS (
  SELECT task_id, COUNT(*) AS total, COUNT(*) FILTER (WHERE is_done) AS done
  FROM gestao.checklist_items GROUP BY task_id
),
comment_counts AS (
  SELECT task_id, COUNT(*) AS cnt FROM gestao.task_comments GROUP BY task_id
)
SELECT
  t.*,
  p_assignee.full_name AS assignee_name,
  p_assignee.photo_url AS assignee_photo,
  p_creator.full_name AS creator_name,
  c.name AS column_name,
  b.name AS board_name,
  COALESCE(cc.cnt, 0) AS comments_count,
  COALESCE(ca.total, 0) AS checklist_total,
  COALESCE(ca.done, 0) AS checklist_done,
  la.labels,
  CASE WHEN t.due_date < CURRENT_DATE AND t.completed_at IS NULL AND NOT t.is_archived
       THEN true ELSE false END AS is_overdue
FROM gestao.tasks t
LEFT JOIN public.profiles p_assignee ON p_assignee.id = t.assignee_id
LEFT JOIN public.profiles p_creator ON p_creator.id = t.creator_id
LEFT JOIN gestao.columns c ON c.id = t.column_id
LEFT JOIN gestao.boards b ON b.id = t.board_id
LEFT JOIN label_agg la ON la.task_id = t.id
LEFT JOIN checklist_agg ca ON ca.task_id = t.id
LEFT JOIN comment_counts cc ON cc.task_id = t.id;

CREATE OR REPLACE VIEW gestao.vw_dashboard_metrics AS
SELECT
  t.board_id,
  COUNT(*) FILTER (WHERE NOT t.is_archived) AS total_tasks,
  COUNT(*) FILTER (WHERE t.completed_at IS NOT NULL) AS completed_tasks,
  COUNT(*) FILTER (WHERE t.due_date < CURRENT_DATE AND t.completed_at IS NULL AND NOT t.is_archived) AS overdue_tasks,
  ROUND(
    COUNT(*) FILTER (WHERE t.completed_at IS NOT NULL)::numeric /
    NULLIF(COUNT(*) FILTER (WHERE NOT t.is_archived), 0) * 100, 1
  ) AS completion_rate
FROM gestao.tasks t
GROUP BY t.board_id;

CREATE OR REPLACE VIEW gestao.vw_user_workload AS
SELECT
  p.id AS user_id,
  p.full_name,
  p.photo_url,
  COUNT(t.id) FILTER (WHERE t.completed_at IS NULL AND NOT t.is_archived) AS assigned_active,
  COUNT(t.id) FILTER (WHERE t.completed_at IS NOT NULL AND t.completed_at >= date_trunc('week', now() AT TIME ZONE 'America/Sao_Paulo')) AS completed_this_week,
  COUNT(t.id) FILTER (WHERE t.due_date < CURRENT_DATE AND t.completed_at IS NULL AND NOT t.is_archived) AS overdue
FROM public.profiles p
LEFT JOIN gestao.tasks t ON t.assignee_id = p.id
WHERE p.status = 'approved'
GROUP BY p.id, p.full_name, p.photo_url;

-- =============================================================================
-- 9. Triggers
-- =============================================================================

-- 9.1 updated_at automático
CREATE OR REPLACE FUNCTION gestao.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER trg_boards_updated_at BEFORE UPDATE ON gestao.boards FOR EACH ROW EXECUTE FUNCTION gestao.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_tasks_updated_at BEFORE UPDATE ON gestao.tasks FOR EACH ROW EXECUTE FUNCTION gestao.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_comments_updated_at BEFORE UPDATE ON gestao.task_comments FOR EACH ROW EXECUTE FUNCTION gestao.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_preferences_updated_at BEFORE UPDATE ON gestao.user_preferences FOR EACH ROW EXECUTE FUNCTION gestao.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 9.2 Log de atividade (actor = auth.uid() — errata §11.1.3)
CREATE OR REPLACE FUNCTION gestao.log_task_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_actor UUID := COALESCE(auth.uid(), NEW.creator_id);
BEGIN
  IF OLD.column_id IS DISTINCT FROM NEW.column_id THEN
    INSERT INTO gestao.task_activity_log(task_id, actor_id, action, old_value, new_value)
    VALUES (NEW.id, v_actor, 'moved',
      jsonb_build_object('column_id', OLD.column_id),
      jsonb_build_object('column_id', NEW.column_id));
  END IF;
  IF OLD.priority IS DISTINCT FROM NEW.priority THEN
    INSERT INTO gestao.task_activity_log(task_id, actor_id, action, old_value, new_value)
    VALUES (NEW.id, v_actor, 'priority_changed',
      jsonb_build_object('priority', OLD.priority),
      jsonb_build_object('priority', NEW.priority));
  END IF;
  IF OLD.assignee_id IS DISTINCT FROM NEW.assignee_id THEN
    INSERT INTO gestao.task_activity_log(task_id, actor_id, action, old_value, new_value)
    VALUES (NEW.id, v_actor, 'assigned',
      jsonb_build_object('assignee_id', OLD.assignee_id),
      jsonb_build_object('assignee_id', NEW.assignee_id));
  END IF;
  IF OLD.title IS DISTINCT FROM NEW.title THEN
    INSERT INTO gestao.task_activity_log(task_id, actor_id, action, old_value, new_value)
    VALUES (NEW.id, v_actor, 'title_changed',
      jsonb_build_object('title', OLD.title),
      jsonb_build_object('title', NEW.title));
  END IF;
  IF OLD.due_date IS DISTINCT FROM NEW.due_date THEN
    INSERT INTO gestao.task_activity_log(task_id, actor_id, action, old_value, new_value)
    VALUES (NEW.id, v_actor, 'due_date_changed',
      jsonb_build_object('due_date', OLD.due_date),
      jsonb_build_object('due_date', NEW.due_date));
  END IF;
  IF OLD.completed_at IS NULL AND NEW.completed_at IS NOT NULL THEN
    INSERT INTO gestao.task_activity_log(task_id, actor_id, action, old_value, new_value)
    VALUES (NEW.id, v_actor, 'completed', NULL, jsonb_build_object('completed_at', NEW.completed_at));
  END IF;
  IF OLD.is_archived IS DISTINCT FROM NEW.is_archived THEN
    INSERT INTO gestao.task_activity_log(task_id, actor_id, action, old_value, new_value)
    VALUES (NEW.id, v_actor, CASE WHEN NEW.is_archived THEN 'archived' ELSE 'unarchived' END, NULL, NULL);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$ BEGIN
  CREATE TRIGGER trg_task_changes AFTER UPDATE ON gestao.tasks FOR EACH ROW EXECUTE FUNCTION gestao.log_task_changes();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 9.3 Notificar atribuição
CREATE OR REPLACE FUNCTION gestao.notify_task_assigned()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.assignee_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.assignee_id IS DISTINCT FROM OLD.assignee_id)
     AND NEW.assignee_id != COALESCE(auth.uid(), NEW.creator_id) THEN
    INSERT INTO gestao.notifications(user_id, type, title, body, entity_type, entity_id, actor_id, action_url)
    VALUES (NEW.assignee_id, 'task_assigned', 'Nova tarefa atribuída a você', NEW.title,
      'task', NEW.id, COALESCE(auth.uid(), NEW.creator_id), '/gestao?task=' || NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$ BEGIN
  CREATE TRIGGER trg_notify_assigned AFTER INSERT OR UPDATE ON gestao.tasks FOR EACH ROW EXECUTE FUNCTION gestao.notify_task_assigned();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 9.4 Notificar tarefa concluída (errata §11.3.1)
CREATE OR REPLACE FUNCTION gestao.notify_task_completed()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.completed_at IS NULL AND NEW.completed_at IS NOT NULL THEN
    IF NEW.creator_id != COALESCE(auth.uid(), NEW.assignee_id) THEN
      INSERT INTO gestao.notifications(user_id, type, title, body, entity_type, entity_id, actor_id, action_url)
      VALUES (NEW.creator_id, 'task_completed', 'Tarefa concluída', NEW.title,
        'task', NEW.id, COALESCE(auth.uid(), NEW.assignee_id), '/gestao?task=' || NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$ BEGIN
  CREATE TRIGGER trg_notify_completed AFTER UPDATE ON gestao.tasks FOR EACH ROW EXECUTE FUNCTION gestao.notify_task_completed();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 9.5 Detectar @Clara (UUID fixo — errata §11.1.2)
CREATE OR REPLACE FUNCTION gestao.detect_clara_mention()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.mentions IS NOT NULL AND '00000000-0000-0000-0000-00000000c1a4'::uuid = ANY(NEW.mentions) THEN
    INSERT INTO gestao.clara_queue(conversation_id, message_id, message_content, sender_id)
    VALUES (NEW.conversation_id, NEW.id, NEW.content, NEW.sender_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$ BEGIN
  CREATE TRIGGER trg_clara_mention AFTER INSERT ON public.internal_messages FOR EACH ROW EXECUTE FUNCTION gestao.detect_clara_mention();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 9.6 Notificar menção no chat (errata §11.3.3)
CREATE OR REPLACE FUNCTION gestao.notify_chat_mention()
RETURNS TRIGGER AS $$
DECLARE
  v_mentioned UUID;
  v_conv_name TEXT;
BEGIN
  IF NEW.mentions IS NOT NULL AND array_length(NEW.mentions, 1) > 0 THEN
    SELECT COALESCE(ic.name, 'conversa direta') INTO v_conv_name
    FROM public.internal_conversations ic WHERE ic.id = NEW.conversation_id;
    FOREACH v_mentioned IN ARRAY NEW.mentions LOOP
      IF v_mentioned != '00000000-0000-0000-0000-00000000c1a4'::uuid
         AND v_mentioned != NEW.sender_id THEN
        INSERT INTO gestao.notifications(user_id, type, title, body, entity_type, entity_id, actor_id, action_url)
        VALUES (v_mentioned, 'chat_mention', 'Você foi mencionado(a)',
          'em ' || v_conv_name, 'chat', NEW.conversation_id, NEW.sender_id,
          '/gestao/chat/' || NEW.conversation_id);
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$ BEGIN
  CREATE TRIGGER trg_notify_mention AFTER INSERT ON public.internal_messages FOR EACH ROW EXECUTE FUNCTION gestao.notify_chat_mention();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 9.7 Proteção imutabilidade do activity log (errata §11.4.2)
CREATE OR REPLACE FUNCTION gestao.prevent_activity_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'O log de atividades é imutável (LGPD)';
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER trg_prevent_activity_mutation BEFORE UPDATE OR DELETE ON gestao.task_activity_log FOR EACH ROW EXECUTE FUNCTION gestao.prevent_activity_log_mutation();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- 10. RLS Policies
-- =============================================================================

ALTER TABLE gestao.boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE gestao.board_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE gestao.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE gestao.columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE gestao.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE gestao.task_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE gestao.labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE gestao.task_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE gestao.checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE gestao.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE gestao.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE gestao.message_task_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE gestao.clara_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_message_reactions ENABLE ROW LEVEL SECURITY;

-- Boards
DO $$ BEGIN CREATE POLICY "board_members_select" ON gestao.boards FOR SELECT USING (
  id IN (SELECT board_id FROM gestao.board_members WHERE user_id = auth.uid())
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "approved_users_insert" ON gestao.boards FOR INSERT WITH CHECK (
  gestao.is_approved_user()
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "board_owner_admin_update" ON gestao.boards FOR UPDATE USING (
  id IN (SELECT board_id FROM gestao.board_members WHERE user_id = auth.uid() AND role IN ('owner','admin'))
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "board_owner_delete" ON gestao.boards FOR DELETE USING (
  id IN (SELECT board_id FROM gestao.board_members WHERE user_id = auth.uid() AND role = 'owner')
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Board members
DO $$ BEGIN CREATE POLICY "board_members_see_members" ON gestao.board_members FOR SELECT USING (
  board_id IN (SELECT bm2.board_id FROM gestao.board_members bm2 WHERE bm2.user_id = auth.uid())
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "board_members_admin_insert" ON gestao.board_members FOR INSERT WITH CHECK (
  board_id IN (SELECT bm2.board_id FROM gestao.board_members bm2 WHERE bm2.user_id = auth.uid() AND bm2.role IN ('owner','admin'))
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "board_members_admin_delete" ON gestao.board_members FOR DELETE USING (
  board_id IN (SELECT bm2.board_id FROM gestao.board_members bm2 WHERE bm2.user_id = auth.uid() AND bm2.role IN ('owner','admin'))
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tasks
DO $$ BEGIN CREATE POLICY "task_board_members_select" ON gestao.tasks FOR SELECT USING (
  board_id IN (SELECT board_id FROM gestao.board_members WHERE user_id = auth.uid())
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "task_board_members_insert" ON gestao.tasks FOR INSERT WITH CHECK (
  board_id IN (SELECT board_id FROM gestao.board_members WHERE user_id = auth.uid() AND role != 'viewer')
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "task_board_members_update" ON gestao.tasks FOR UPDATE USING (
  board_id IN (SELECT board_id FROM gestao.board_members WHERE user_id = auth.uid() AND role != 'viewer')
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "task_creator_admin_delete" ON gestao.tasks FOR DELETE USING (
  creator_id = auth.uid() OR board_id IN (SELECT board_id FROM gestao.board_members WHERE user_id = auth.uid() AND role IN ('owner','admin'))
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Columns (granulares — errata §11.1.4)
DO $$ BEGIN CREATE POLICY "columns_select" ON gestao.columns FOR SELECT USING (
  board_id IN (SELECT board_id FROM gestao.board_members WHERE user_id = auth.uid())
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "columns_insert" ON gestao.columns FOR INSERT WITH CHECK (
  board_id IN (SELECT board_id FROM gestao.board_members WHERE user_id = auth.uid() AND role != 'viewer')
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "columns_update" ON gestao.columns FOR UPDATE USING (
  board_id IN (SELECT board_id FROM gestao.board_members WHERE user_id = auth.uid() AND role != 'viewer')
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "columns_delete" ON gestao.columns FOR DELETE USING (
  board_id IN (SELECT board_id FROM gestao.board_members WHERE user_id = auth.uid() AND role IN ('owner','admin'))
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Labels
DO $$ BEGIN CREATE POLICY "labels_select" ON gestao.labels FOR SELECT USING (
  board_id IN (SELECT board_id FROM gestao.board_members WHERE user_id = auth.uid())
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "labels_insert" ON gestao.labels FOR INSERT WITH CHECK (
  board_id IN (SELECT board_id FROM gestao.board_members WHERE user_id = auth.uid() AND role != 'viewer')
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "labels_delete" ON gestao.labels FOR DELETE USING (
  board_id IN (SELECT board_id FROM gestao.board_members WHERE user_id = auth.uid() AND role IN ('owner','admin'))
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Task labels
DO $$ BEGIN CREATE POLICY "task_labels_select" ON gestao.task_labels FOR SELECT USING (
  task_id IN (SELECT id FROM gestao.tasks WHERE board_id IN (SELECT board_id FROM gestao.board_members WHERE user_id = auth.uid()))
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "task_labels_insert" ON gestao.task_labels FOR INSERT WITH CHECK (
  task_id IN (SELECT id FROM gestao.tasks WHERE board_id IN (SELECT board_id FROM gestao.board_members WHERE user_id = auth.uid() AND role != 'viewer'))
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "task_labels_delete" ON gestao.task_labels FOR DELETE USING (
  task_id IN (SELECT id FROM gestao.tasks WHERE board_id IN (SELECT board_id FROM gestao.board_members WHERE user_id = auth.uid() AND role != 'viewer'))
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Checklist
DO $$ BEGIN CREATE POLICY "checklist_select" ON gestao.checklist_items FOR SELECT USING (
  task_id IN (SELECT id FROM gestao.tasks WHERE board_id IN (SELECT board_id FROM gestao.board_members WHERE user_id = auth.uid()))
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "checklist_insert" ON gestao.checklist_items FOR INSERT WITH CHECK (
  task_id IN (SELECT id FROM gestao.tasks WHERE board_id IN (SELECT board_id FROM gestao.board_members WHERE user_id = auth.uid() AND role != 'viewer'))
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "checklist_update" ON gestao.checklist_items FOR UPDATE USING (
  task_id IN (SELECT id FROM gestao.tasks WHERE board_id IN (SELECT board_id FROM gestao.board_members WHERE user_id = auth.uid() AND role != 'viewer'))
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "checklist_delete" ON gestao.checklist_items FOR DELETE USING (
  task_id IN (SELECT id FROM gestao.tasks WHERE board_id IN (SELECT board_id FROM gestao.board_members WHERE user_id = auth.uid() AND role != 'viewer'))
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Comments
DO $$ BEGIN CREATE POLICY "comments_select" ON gestao.task_comments FOR SELECT USING (
  task_id IN (SELECT id FROM gestao.tasks WHERE board_id IN (SELECT board_id FROM gestao.board_members WHERE user_id = auth.uid()))
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "comments_insert" ON gestao.task_comments FOR INSERT WITH CHECK (author_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "comments_update" ON gestao.task_comments FOR UPDATE USING (author_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "comments_delete" ON gestao.task_comments FOR DELETE USING (
  author_id = auth.uid() OR task_id IN (SELECT id FROM gestao.tasks WHERE board_id IN
    (SELECT board_id FROM gestao.board_members WHERE user_id = auth.uid() AND role IN ('owner','admin')))
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Activity log (imutável: SELECT + INSERT via trigger)
DO $$ BEGIN CREATE POLICY "activity_select" ON gestao.task_activity_log FOR SELECT USING (
  task_id IN (SELECT id FROM gestao.tasks WHERE board_id IN (SELECT board_id FROM gestao.board_members WHERE user_id = auth.uid()))
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "activity_insert" ON gestao.task_activity_log FOR INSERT WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Message task links
DO $$ BEGIN CREATE POLICY "message_task_links_select" ON gestao.message_task_links FOR SELECT USING (
  task_id IN (SELECT id FROM gestao.tasks WHERE board_id IN (SELECT board_id FROM gestao.board_members WHERE user_id = auth.uid()))
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "message_task_links_insert" ON gestao.message_task_links FOR INSERT WITH CHECK (
  task_id IN (SELECT id FROM gestao.tasks WHERE board_id IN (SELECT board_id FROM gestao.board_members WHERE user_id = auth.uid() AND role != 'viewer'))
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Clara queue (service_role only — errata §11.4.3)
DO $$ BEGIN CREATE POLICY "clara_queue_service_only" ON gestao.clara_queue FOR ALL USING (
  auth.role() = 'service_role'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Notifications (próprias)
DO $$ BEGIN CREATE POLICY "notifications_select" ON gestao.notifications FOR SELECT USING (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "notifications_update" ON gestao.notifications FOR UPDATE USING (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "notifications_insert" ON gestao.notifications FOR INSERT WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Preferences (próprias)
DO $$ BEGIN CREATE POLICY "preferences_own" ON gestao.user_preferences FOR ALL USING (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Reactions (chat interno)
DO $$ BEGIN CREATE POLICY "int_reactions_select" ON public.internal_message_reactions FOR SELECT USING (
  message_id IN (SELECT id FROM public.internal_messages WHERE conversation_id IN
    (SELECT conversation_id FROM public.internal_conversation_participants WHERE user_id = auth.uid()))
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "int_reactions_insert" ON public.internal_message_reactions FOR INSERT WITH CHECK (
  user_id = auth.uid() AND message_id IN (SELECT id FROM public.internal_messages WHERE conversation_id IN
    (SELECT conversation_id FROM public.internal_conversation_participants WHERE user_id = auth.uid()))
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "int_reactions_delete" ON public.internal_message_reactions FOR DELETE USING (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- 11. Realtime Publication
-- =============================================================================
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE gestao.tasks; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE gestao.columns; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE gestao.task_comments; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE gestao.checklist_items; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE gestao.notifications; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_message_reactions; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- 12. Seed: Board Padrão (idempotente — errata §11.1.6)
-- =============================================================================
CREATE OR REPLACE FUNCTION gestao.seed_default_board()
RETURNS void AS $$
DECLARE
  v_board_id UUID;
  v_admin_id UUID;
BEGIN
  IF EXISTS (SELECT 1 FROM gestao.boards WHERE is_default = true) THEN
    RAISE NOTICE 'Board padrão já existe, pulando seed.';
    RETURN;
  END IF;

  SELECT id INTO v_admin_id FROM public.profiles WHERE role = 'admin' AND status = 'approved' LIMIT 1;
  IF v_admin_id IS NULL THEN RAISE EXCEPTION 'Nenhum admin aprovado encontrado'; END IF;

  INSERT INTO gestao.boards(name, description, is_default, created_by)
  VALUES ('Geral', 'Board padrão da clínica', true, v_admin_id)
  RETURNING id INTO v_board_id;

  INSERT INTO gestao.board_members(board_id, user_id, role) VALUES (v_board_id, v_admin_id, 'owner');

  INSERT INTO gestao.columns(board_id, name, color, position, is_done_column) VALUES
    (v_board_id, 'Backlog',  '#6b7280', 0, false),
    (v_board_id, 'Fazendo',  '#3b82f6', 1, false),
    (v_board_id, 'Revisão',  '#f59e0b', 2, false),
    (v_board_id, 'Feito',    '#22c55e', 3, true);

  INSERT INTO gestao.labels(board_id, name, color) VALUES
    (v_board_id, 'Recepção',     '#6366f1'),
    (v_board_id, 'Pediatria',    '#ec4899'),
    (v_board_id, 'Financeiro',   '#14b8a6'),
    (v_board_id, 'Comercial',    '#f97316'),
    (v_board_id, 'Urgente',      '#ef4444'),
    (v_board_id, 'Melhoria',     '#8b5cf6'),
    (v_board_id, 'Documentação', '#06b6d4'),
    (v_board_id, 'Reunião',      '#84cc16');

  INSERT INTO gestao.board_members(board_id, user_id, role)
  SELECT v_board_id, id, 'member'
  FROM public.profiles
  WHERE status = 'approved' AND id != v_admin_id;
END;
$$ LANGUAGE plpgsql;

SELECT gestao.seed_default_board();
