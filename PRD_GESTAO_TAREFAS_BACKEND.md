# PRD — Gestão de Tarefas & Chat Interno (Backend)

> **Versão:** 1.0
> **Data:** 2026-04-09
> **Fase atual:** 2 de 3 (Planejamento Backend)
> **Depende de:** `PRD_GESTAO_TAREFAS_FRONTEND.md`

---

## Sumário

1. [Schema SQL Completo](#1-schema-sql-completo)
2. [API Routes (38 endpoints)](#2-api-routes-38-endpoints)
3. [Tipos TypeScript Compartilhados](#3-tipos-typescript-compartilhados)
4. [Supabase Realtime (7 canais)](#4-supabase-realtime-7-canais)
5. [Integração com Clara (IA)](#5-integração-com-clara-ia)
6. [Hooks React (6 hooks)](#6-hooks-react-6-hooks)
7. [Plano de Migração](#7-plano-de-migração)
8. [Integração com Sistema Existente](#8-integração-com-sistema-existente)
9. [Helpers e Utilitários](#9-helpers-e-utilitários)
10. [Estrutura de Arquivos Backend](#10-estrutura-de-arquivos-backend)

---

## 1. Schema SQL Completo

### 1.1 Criar Schema

```sql
CREATE SCHEMA IF NOT EXISTS gestao;
```

### 1.2 Tabelas do Kanban

```sql
-- Boards de tarefas
CREATE TABLE gestao.boards (
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

-- Membros de cada board (controle de acesso)
CREATE TABLE gestao.board_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES gestao.boards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner','admin','member','viewer')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(board_id, user_id)
);

-- Colunas do Kanban
CREATE TABLE gestao.columns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES gestao.boards(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  position INT NOT NULL DEFAULT 0,
  wip_limit INT,
  is_done_column BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_columns_board_position ON gestao.columns(board_id, position);
```

### 1.3 Tabelas de Tarefas

```sql
-- Tarefas (substitui atendimento.tasks)
CREATE TABLE gestao.tasks (
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

CREATE INDEX idx_tasks_board_column ON gestao.tasks(board_id, column_id, position) WHERE NOT is_archived;
CREATE INDEX idx_tasks_assignee ON gestao.tasks(assignee_id) WHERE NOT is_archived;
CREATE INDEX idx_tasks_overdue ON gestao.tasks(due_date, assignee_id) WHERE completed_at IS NULL AND NOT is_archived;
CREATE INDEX idx_tasks_completed ON gestao.tasks(completed_at DESC) WHERE completed_at IS NOT NULL;

-- Labels por board
CREATE TABLE gestao.labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID REFERENCES gestao.boards(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(board_id, name)
);

-- Relação N:N tarefa↔label
CREATE TABLE gestao.task_labels (
  task_id UUID NOT NULL REFERENCES gestao.tasks(id) ON DELETE CASCADE,
  label_id UUID NOT NULL REFERENCES gestao.labels(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, label_id)
);

-- Checklist normalizado
CREATE TABLE gestao.checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES gestao.tasks(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  is_done BOOLEAN DEFAULT false,
  position INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_checklist_task ON gestao.checklist_items(task_id, position);

-- Comentários em tarefas
CREATE TABLE gestao.task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES gestao.tasks(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id),
  content TEXT NOT NULL,
  mentions UUID[] DEFAULT '{}',
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_comments_task ON gestao.task_comments(task_id, created_at);

-- Log de atividade (imutável — LGPD)
CREATE TABLE gestao.task_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES gestao.tasks(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.profiles(id),
  action TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_activity_task ON gestao.task_activity_log(task_id, created_at DESC);
```

### 1.4 Evolução do Chat Interno

```sql
-- Adicionar colunas ao internal_conversations existente
ALTER TABLE public.internal_conversations
  ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'direct' CHECK (type IN ('direct','group')),
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS include_clara BOOLEAN DEFAULT false;

-- Adicionar colunas ao internal_conversation_participants
ALTER TABLE public.internal_conversation_participants
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'member' CHECK (role IN ('admin','member')),
  ADD COLUMN IF NOT EXISTS is_muted BOOLEAN DEFAULT false;

-- Adicionar colunas ao internal_messages
ALTER TABLE public.internal_messages
  ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES public.internal_messages(id),
  ADD COLUMN IF NOT EXISTS mentions UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Permitir message_type 'system'
-- (se houver CHECK constraint, fazer ALTER)

CREATE INDEX idx_internal_messages_reply ON public.internal_messages(reply_to_id) WHERE reply_to_id IS NOT NULL;
CREATE INDEX idx_internal_messages_pinned ON public.internal_messages(conversation_id) WHERE is_pinned = true;
CREATE INDEX idx_internal_messages_mentions ON public.internal_messages USING GIN (mentions);

-- Reações em mensagens (tabela nova)
CREATE TABLE public.message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.internal_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

-- Vínculo mensagem↔tarefa
CREATE TABLE gestao.message_task_links (
  message_id UUID NOT NULL REFERENCES public.internal_messages(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES gestao.tasks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (message_id, task_id)
);

-- Fila de processamento da Clara
CREATE TABLE gestao.clara_queue (
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

CREATE INDEX idx_clara_queue_pending ON gestao.clara_queue(status, created_at) WHERE status = 'pending';
```

### 1.5 Sistema de Notificações e Preferências

```sql
-- Notificações
CREATE TABLE gestao.notifications (
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

CREATE INDEX idx_notifications_user_unread ON gestao.notifications(user_id, created_at DESC) WHERE NOT is_read;

-- Preferências do usuário
CREATE TABLE gestao.user_preferences (
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
```

### 1.6 Views Utilitárias

```sql
-- View: tarefas enriquecidas (evita N+1 no Kanban)
CREATE OR REPLACE VIEW gestao.vw_tasks_enriched AS
SELECT
  t.*,
  p_assignee.full_name AS assignee_name,
  p_assignee.photo_url AS assignee_photo,
  p_creator.full_name AS creator_name,
  c.name AS column_name,
  b.name AS board_name,
  (SELECT COUNT(*) FROM gestao.task_comments tc WHERE tc.task_id = t.id) AS comments_count,
  (SELECT COUNT(*) FROM gestao.checklist_items ci WHERE ci.task_id = t.id) AS checklist_total,
  (SELECT COUNT(*) FROM gestao.checklist_items ci WHERE ci.task_id = t.id AND ci.is_done) AS checklist_done,
  (SELECT array_agg(json_build_object('id', l.id, 'name', l.name, 'color', l.color))
   FROM gestao.task_labels tl JOIN gestao.labels l ON l.id = tl.label_id
   WHERE tl.task_id = t.id) AS labels,
  CASE WHEN t.due_date < CURRENT_DATE AND t.completed_at IS NULL AND NOT t.is_archived
       THEN true ELSE false END AS is_overdue
FROM gestao.tasks t
LEFT JOIN public.profiles p_assignee ON p_assignee.id = t.assignee_id
LEFT JOIN public.profiles p_creator ON p_creator.id = t.creator_id
LEFT JOIN gestao.columns c ON c.id = t.column_id
LEFT JOIN gestao.boards b ON b.id = t.board_id;

-- View: métricas do dashboard
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

-- View: workload por membro
CREATE OR REPLACE VIEW gestao.vw_user_workload AS
SELECT
  p.id AS user_id,
  p.full_name,
  p.photo_url,
  COUNT(*) FILTER (WHERE t.completed_at IS NULL AND NOT t.is_archived) AS assigned_active,
  COUNT(*) FILTER (WHERE t.completed_at IS NOT NULL AND t.completed_at >= date_trunc('week', now() AT TIME ZONE 'America/Sao_Paulo')) AS completed_this_week,
  COUNT(*) FILTER (WHERE t.due_date < CURRENT_DATE AND t.completed_at IS NULL AND NOT t.is_archived) AS overdue
FROM public.profiles p
LEFT JOIN gestao.tasks t ON t.assignee_id = p.id
WHERE p.status = 'approved'
GROUP BY p.id, p.full_name, p.photo_url;
```

### 1.7 Triggers

```sql
-- Trigger: updated_at automático
CREATE OR REPLACE FUNCTION gestao.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_boards_updated_at BEFORE UPDATE ON gestao.boards
  FOR EACH ROW EXECUTE FUNCTION gestao.set_updated_at();
CREATE TRIGGER trg_tasks_updated_at BEFORE UPDATE ON gestao.tasks
  FOR EACH ROW EXECUTE FUNCTION gestao.set_updated_at();
CREATE TRIGGER trg_comments_updated_at BEFORE UPDATE ON gestao.task_comments
  FOR EACH ROW EXECUTE FUNCTION gestao.set_updated_at();
CREATE TRIGGER trg_preferences_updated_at BEFORE UPDATE ON gestao.user_preferences
  FOR EACH ROW EXECUTE FUNCTION gestao.set_updated_at();

-- Trigger: log de atividade quando tarefa muda
CREATE OR REPLACE FUNCTION gestao.log_task_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.column_id IS DISTINCT FROM NEW.column_id THEN
    INSERT INTO gestao.task_activity_log(task_id, actor_id, action, old_value, new_value)
    VALUES (NEW.id, NEW.creator_id, 'moved',
      jsonb_build_object('column_id', OLD.column_id),
      jsonb_build_object('column_id', NEW.column_id));
  END IF;
  IF OLD.priority IS DISTINCT FROM NEW.priority THEN
    INSERT INTO gestao.task_activity_log(task_id, actor_id, action, old_value, new_value)
    VALUES (NEW.id, NEW.creator_id, 'priority_changed',
      jsonb_build_object('priority', OLD.priority),
      jsonb_build_object('priority', NEW.priority));
  END IF;
  IF OLD.assignee_id IS DISTINCT FROM NEW.assignee_id THEN
    INSERT INTO gestao.task_activity_log(task_id, actor_id, action, old_value, new_value)
    VALUES (NEW.id, NEW.creator_id, 'assigned',
      jsonb_build_object('assignee_id', OLD.assignee_id),
      jsonb_build_object('assignee_id', NEW.assignee_id));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_task_changes AFTER UPDATE ON gestao.tasks
  FOR EACH ROW EXECUTE FUNCTION gestao.log_task_changes();

-- Trigger: notificar quando tarefa é atribuída
CREATE OR REPLACE FUNCTION gestao.notify_task_assigned()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.assignee_id IS NOT NULL AND NEW.assignee_id IS DISTINCT FROM OLD.assignee_id
     AND NEW.assignee_id != NEW.creator_id THEN
    INSERT INTO gestao.notifications(user_id, type, title, body, entity_type, entity_id, actor_id, action_url)
    VALUES (
      NEW.assignee_id,
      'task_assigned',
      'Nova tarefa atribuída a você',
      NEW.title,
      'task',
      NEW.id,
      COALESCE(NEW.creator_id, OLD.creator_id),
      '/gestao?task=' || NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_notify_assigned AFTER INSERT OR UPDATE ON gestao.tasks
  FOR EACH ROW EXECUTE FUNCTION gestao.notify_task_assigned();

-- Trigger: detectar @Clara em mensagens
CREATE OR REPLACE FUNCTION gestao.detect_clara_mention()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.mentions IS NOT NULL AND 'clara-ai' = ANY(
    SELECT unnest(NEW.mentions)::text
  ) THEN
    INSERT INTO gestao.clara_queue(conversation_id, message_id, message_content, sender_id)
    VALUES (NEW.conversation_id, NEW.id, NEW.content, NEW.sender_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_clara_mention AFTER INSERT ON public.internal_messages
  FOR EACH ROW EXECUTE FUNCTION gestao.detect_clara_mention();
```

### 1.8 RLS Policies

```sql
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
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

-- Boards: membros veem
CREATE POLICY "board_members_select" ON gestao.boards FOR SELECT USING (
  id IN (SELECT board_id FROM gestao.board_members WHERE user_id = auth.uid())
);
CREATE POLICY "approved_users_insert" ON gestao.boards FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND status = 'approved')
);
CREATE POLICY "board_owner_admin_update" ON gestao.boards FOR UPDATE USING (
  id IN (SELECT board_id FROM gestao.board_members WHERE user_id = auth.uid() AND role IN ('owner','admin'))
);
CREATE POLICY "board_owner_delete" ON gestao.boards FOR DELETE USING (
  id IN (SELECT board_id FROM gestao.board_members WHERE user_id = auth.uid() AND role = 'owner')
);

-- Tasks: membros do board
CREATE POLICY "task_board_members_select" ON gestao.tasks FOR SELECT USING (
  board_id IN (SELECT board_id FROM gestao.board_members WHERE user_id = auth.uid())
);
CREATE POLICY "task_board_members_insert" ON gestao.tasks FOR INSERT WITH CHECK (
  board_id IN (SELECT board_id FROM gestao.board_members WHERE user_id = auth.uid() AND role != 'viewer')
);
CREATE POLICY "task_board_members_update" ON gestao.tasks FOR UPDATE USING (
  board_id IN (SELECT board_id FROM gestao.board_members WHERE user_id = auth.uid() AND role != 'viewer')
);
CREATE POLICY "task_creator_admin_delete" ON gestao.tasks FOR DELETE USING (
  creator_id = auth.uid() OR
  board_id IN (SELECT board_id FROM gestao.board_members WHERE user_id = auth.uid() AND role IN ('owner','admin'))
);

-- Columns: membros do board
CREATE POLICY "columns_board_members" ON gestao.columns FOR ALL USING (
  board_id IN (SELECT board_id FROM gestao.board_members WHERE user_id = auth.uid())
);

-- Comments: membros do board
CREATE POLICY "comments_select" ON gestao.task_comments FOR SELECT USING (
  task_id IN (SELECT id FROM gestao.tasks WHERE board_id IN
    (SELECT board_id FROM gestao.board_members WHERE user_id = auth.uid()))
);
CREATE POLICY "comments_insert" ON gestao.task_comments FOR INSERT WITH CHECK (author_id = auth.uid());
CREATE POLICY "comments_delete" ON gestao.task_comments FOR DELETE USING (
  author_id = auth.uid() OR
  task_id IN (SELECT id FROM gestao.tasks WHERE board_id IN
    (SELECT board_id FROM gestao.board_members WHERE user_id = auth.uid() AND role IN ('owner','admin')))
);

-- Activity log: imutável (somente SELECT + INSERT via trigger)
CREATE POLICY "activity_select" ON gestao.task_activity_log FOR SELECT USING (
  task_id IN (SELECT id FROM gestao.tasks WHERE board_id IN
    (SELECT board_id FROM gestao.board_members WHERE user_id = auth.uid()))
);

-- Notifications: somente as próprias
CREATE POLICY "notifications_own" ON gestao.notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "notifications_update" ON gestao.notifications FOR UPDATE USING (user_id = auth.uid());

-- Preferences: somente as próprias
CREATE POLICY "preferences_own" ON gestao.user_preferences FOR ALL USING (user_id = auth.uid());

-- Reactions: participantes da conversa
CREATE POLICY "reactions_participants" ON public.message_reactions FOR ALL USING (
  message_id IN (SELECT id FROM public.internal_messages WHERE conversation_id IN
    (SELECT conversation_id FROM public.internal_conversation_participants WHERE user_id = auth.uid()))
);
```

### 1.9 Realtime Publication

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE gestao.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE gestao.columns;
ALTER PUBLICATION supabase_realtime ADD TABLE gestao.task_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE gestao.checklist_items;
ALTER PUBLICATION supabase_realtime ADD TABLE gestao.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
```

### 1.10 Seed: Board Padrão

```sql
CREATE OR REPLACE FUNCTION gestao.seed_default_board()
RETURNS void AS $$
DECLARE
  v_board_id UUID;
  v_admin_id UUID;
BEGIN
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

  -- Adicionar todos os usuários aprovados ao board
  INSERT INTO gestao.board_members(board_id, user_id, role)
  SELECT v_board_id, id, 'member'
  FROM public.profiles
  WHERE status = 'approved' AND id != v_admin_id;
END;
$$ LANGUAGE plpgsql;
```

---

## 2. API Routes (38 endpoints)

### Estrutura de Arquivos

```
src/app/api/gestao/
├── boards/
│   ├── route.ts                        # GET + POST
│   └── [id]/
│       ├── route.ts                    # PATCH + DELETE
│       └── columns/
│           └── route.ts                # GET + POST
├── columns/
│   ├── [id]/route.ts                   # PATCH + DELETE
│   └── reorder/route.ts               # PATCH
├── tasks/
│   ├── route.ts                        # GET + POST
│   ├── [id]/
│   │   ├── route.ts                    # GET + PATCH + DELETE
│   │   ├── move/route.ts              # PATCH
│   │   ├── comments/route.ts          # GET + POST
│   │   ├── checklist/route.ts         # POST
│   │   └── labels/
│   │       ├── route.ts               # POST
│   │       └── [labelId]/route.ts     # DELETE
│   ├── reorder/route.ts               # PATCH
│   └── bulk/route.ts                  # POST
├── comments/[id]/route.ts             # DELETE
├── checklist/[id]/route.ts            # PATCH + DELETE
├── labels/route.ts                    # GET + POST
├── chat/
│   ├── groups/
│   │   ├── route.ts                   # POST
│   │   └── [id]/
│   │       ├── route.ts              # PATCH
│   │       └── members/
│   │           ├── route.ts          # POST
│   │           └── [userId]/route.ts # DELETE
│   ├── messages/[id]/
│   │   ├── reactions/route.ts        # POST
│   │   └── task/route.ts            # POST
│   └── clara/route.ts               # POST
├── dashboard/
│   ├── kpis/route.ts                 # GET
│   ├── chart/route.ts                # GET
│   ├── workload/route.ts             # GET
│   ├── ranking/route.ts              # GET
│   └── overdue/route.ts              # GET
├── notifications/
│   ├── route.ts                      # GET
│   ├── read/route.ts                 # PATCH
│   └── read-all/route.ts            # PATCH
└── preferences/route.ts              # GET + PATCH
```

**Total: 30 arquivos route.ts · 38 endpoints**

### Tabela Resumo de Endpoints

| # | Método | Rota | Descrição | Auth |
|---|--------|------|-----------|------|
| 1 | GET | `/api/gestao/boards` | Listar boards | Aprovado |
| 2 | POST | `/api/gestao/boards` | Criar board | Aprovado |
| 3 | PATCH | `/api/gestao/boards/[id]` | Atualizar board | Owner/Admin |
| 4 | DELETE | `/api/gestao/boards/[id]` | Deletar board | Owner |
| 5 | GET | `/api/gestao/boards/[id]/columns` | Listar colunas | Membro |
| 6 | POST | `/api/gestao/boards/[id]/columns` | Criar coluna | Membro+ |
| 7 | PATCH | `/api/gestao/columns/[id]` | Atualizar coluna | Membro+ |
| 8 | DELETE | `/api/gestao/columns/[id]` | Deletar coluna | Owner/Admin |
| 9 | PATCH | `/api/gestao/columns/reorder` | Reordenar colunas | Membro+ |
| 10 | GET | `/api/gestao/tasks` | Listar tarefas (filtros) | Aprovado |
| 11 | POST | `/api/gestao/tasks` | Criar tarefa | Membro+ |
| 12 | GET | `/api/gestao/tasks/[id]` | Detalhe tarefa | Membro |
| 13 | PATCH | `/api/gestao/tasks/[id]` | Atualizar tarefa | Membro+ |
| 14 | DELETE | `/api/gestao/tasks/[id]` | Deletar tarefa | Creator/Admin |
| 15 | PATCH | `/api/gestao/tasks/[id]/move` | Mover entre colunas | Membro+ |
| 16 | PATCH | `/api/gestao/tasks/reorder` | Reordenar na coluna | Membro+ |
| 17 | POST | `/api/gestao/tasks/bulk` | Ações em lote | Membro+ |
| 18 | GET | `/api/gestao/tasks/[id]/comments` | Listar comentários | Membro |
| 19 | POST | `/api/gestao/tasks/[id]/comments` | Adicionar comentário | Membro+ |
| 20 | DELETE | `/api/gestao/comments/[id]` | Deletar comentário | Autor/Admin |
| 21 | POST | `/api/gestao/tasks/[id]/checklist` | Adicionar item | Membro+ |
| 22 | PATCH | `/api/gestao/checklist/[id]` | Toggle/editar item | Membro+ |
| 23 | DELETE | `/api/gestao/checklist/[id]` | Deletar item | Membro+ |
| 24 | GET | `/api/gestao/labels` | Listar labels | Aprovado |
| 25 | POST | `/api/gestao/labels` | Criar label | Membro+ |
| 26 | POST | `/api/gestao/tasks/[id]/labels` | Atribuir label | Membro+ |
| 27 | DELETE | `/api/gestao/tasks/[id]/labels/[labelId]` | Remover label | Membro+ |
| 28 | POST | `/api/gestao/chat/groups` | Criar grupo | Aprovado |
| 29 | PATCH | `/api/gestao/chat/groups/[id]` | Atualizar grupo | Admin grupo |
| 30 | POST | `/api/gestao/chat/groups/[id]/members` | Add membro | Admin grupo |
| 31 | DELETE | `/api/gestao/chat/groups/[id]/members/[userId]` | Remover membro | Admin/Self |
| 32 | POST | `/api/gestao/chat/messages/[id]/reactions` | Toggle reação | Participante |
| 33 | POST | `/api/gestao/chat/messages/[id]/task` | Msg→Tarefa | Participante+Membro |
| 34 | POST | `/api/gestao/chat/clara` | Enviar para Clara | Participante |
| 35 | GET | `/api/gestao/dashboard/kpis` | KPIs | Aprovado |
| 36 | GET | `/api/gestao/dashboard/chart` | Gráfico | Aprovado |
| 37 | GET | `/api/gestao/dashboard/workload` | Workload equipe | Aprovado |
| 38 | GET | `/api/gestao/dashboard/ranking` | Ranking semanal | Aprovado |
| 39 | GET | `/api/gestao/dashboard/overdue` | Tarefas atrasadas | Aprovado |
| 40 | GET | `/api/gestao/notifications` | Listar notificações | Próprio |
| 41 | PATCH | `/api/gestao/notifications/read` | Marcar lidas | Próprio |
| 42 | PATCH | `/api/gestao/notifications/read-all` | Marcar todas lidas | Próprio |
| 43 | GET | `/api/gestao/preferences` | Preferências | Próprio |
| 44 | PATCH | `/api/gestao/preferences` | Atualizar prefs | Próprio |

### Helper de Autorização

```typescript
// src/lib/gestao-auth.ts
import { requireAuth } from '@/lib/api-auth'

export async function getBoardMembership(
  supabase: any, userId: string, boardId: string
): Promise<'owner' | 'admin' | 'member' | 'viewer' | null> {
  const { data } = await supabase
    .from('gestao.board_members')
    .select('role')
    .eq('board_id', boardId)
    .eq('user_id', userId)
    .single()
  return data?.role || null
}

export async function requireBoardAccess(
  supabase: any, userId: string, boardId: string, minRole: string = 'viewer'
) {
  const role = await getBoardMembership(supabase, userId, boardId)
  if (!role) return { error: 'Não é membro do board', status: 403 }
  const hierarchy = ['viewer', 'member', 'admin', 'owner']
  if (hierarchy.indexOf(role) < hierarchy.indexOf(minRole)) {
    return { error: 'Permissão insuficiente', status: 403 }
  }
  return { role }
}

export async function createGestaoNotification(supabase: any, params: {
  user_id: string; type: string; title: string; body: string;
  entity_type: string; entity_id?: string; actor_id?: string; action_url?: string;
}) {
  await supabase.from('gestao.notifications').insert({ ...params, is_read: false })
}
```

---

## 3. Tipos TypeScript Compartilhados

Arquivo: `src/types/gestao.ts` — tipos completos para todos os endpoints. Inclui:

- `TaskPriority`, `BoardVisibility`, `NotificationType`, `ChatConversationType`
- `GestaoBoard`, `BoardMember`, `GestaoColumn`, `GestaoTask`, `ChecklistItem`
- `GestaoLabel`, `TaskComment`, `MessageReaction`
- `GestaoChatGroup`, `GestaoChatMember`, `GestaoChatMessage`
- `GestaoNotification`, `GestaoPreferences`
- `DashboardKPIs`, `DashboardChartData`, `DashboardWorkload`, `DashboardRanking`, `DashboardOverdueTask`

(Tipos completos detalhados no output do agente de API routes)

---

## 4. Supabase Realtime (7 canais)

| Canal | Tipo | Publicador | Assinantes |
|-------|------|-----------|-----------|
| `gestao:board:{boardId}` | postgres_changes | Supabase (tasks, columns) | Membros do board |
| `gestao:task:{taskId}` | postgres_changes + broadcast | Supabase + clients | Quem abriu o modal |
| `gestao:chat:{conversationId}` | postgres_changes + broadcast | Supabase + clients | Participantes |
| `gestao:chat:presence` | presence | Clients (track) | Todos no módulo |
| `gestao:notifications:{userId}` | postgres_changes | Supabase | O próprio usuário |
| `gestao:typing:{conversationId}` | broadcast | Clients | Participantes |
| `gestao:clara:status` | broadcast | Backend API | Chat com Clara |

### Detalhes dos Canais

**`gestao:board:{boardId}`** — Sincroniza Kanban em tempo real:
- INSERT/UPDATE/DELETE em `tasks` → add/move/remove cards
- INSERT/UPDATE/DELETE em `columns` → add/rename/reorder colunas

**`gestao:chat:{conversationId}`** — Mensagens + reações:
- INSERT em `internal_messages` → nova mensagem
- INSERT/DELETE em `message_reactions` → atualizar reações
- Broadcast: `typing`, `clara_action_buttons`, `message_to_task`

**`gestao:chat:presence`** — Quem está online:
- Track: `{ user_id, full_name, photo_url, status, active_conversation_id, online_at }`
- Detecção de away: `visibilitychange` → 'away' após 5min em background

**`gestao:typing:{conversationId}`** — Canal separado para evitar ruído:
- Debounce 300ms no client
- TTL implícito: 5s sem `typing_stop` → client remove indicador

---

## 5. Integração com Clara (IA)

### 5.1 Fluxo @Clara no Chat

```
1. Usuário digita "@Clara" → MentionAutocomplete
2. Envia mensagem → INSERT em internal_messages com mentions: ['clara-ai']
3. Trigger PostgreSQL → INSERT em gestao.clara_queue
4. API /api/gestao/chat/clara processa a fila
5. Broadcast 'thinking' no canal gestao:clara:status
6. Invoca grafo da Clara com contexto do grupo
7. Clara responde → INSERT em internal_messages (sender_id especial)
8. Broadcast 'done'
```

### 5.2 Tools Novas da Clara

| Tool | Operação | Quando usar |
|------|----------|-------------|
| `create_gestao_task` | INSERT em gestao.tasks | Criar tarefa a partir de conversa |
| `update_gestao_task` | UPDATE em gestao.tasks | Alterar status/prioridade/assignee |
| `list_gestao_tasks` | SELECT em gestao.tasks | Listar tarefas filtradas |
| `summarize_thread` | SELECT em internal_messages | Sumarizar thread |
| `get_team_workload` | SELECT vw_user_workload | Verificar carga de trabalho |
| `search_chat_history` | SELECT em internal_messages | Buscar em histórico |

### 5.3 Regras de Comportamento em Grupo

1. Responder **apenas quando mencionada** com @Clara
2. Responder **em thread** por default (não poluir chat principal)
3. Sempre **confirmar com botões** antes de criar tarefas
4. Priorizar **ações concretas** sobre explicações longas
5. Formato batch (não streaming) com indicador "Clara está pensando..."

---

## 6. Hooks React (6 hooks)

| Hook | Estado | Realtime | Mutations |
|------|--------|----------|-----------|
| `useGestaoBoard(boardId)` | board, columns, tasks | `gestao:board:{id}` | addColumn, moveTask, reorder |
| `useGestaoTasks(filters)` | tasks, totalCount | `gestao:board:{id}` filtrado | updateTask, bulkUpdate, delete |
| `useGestaoChat(conversationId)` | messages, reactions | `gestao:chat:{id}` | sendMessage, react, pin, convertToTask |
| `useGestaoPresence()` | onlineUsers | `gestao:chat:presence` | setMyStatus, setActiveConversation |
| `useGestaoNotifications()` | notifications, unreadCount | `gestao:notifications:{id}` | markAsRead, markAllAsRead |
| `useGestaoSearch(query)` | results | — | — (debounce 300ms) |

Todos seguem o padrão de **mutations otimistas** com rollback automático.

---

## 7. Plano de Migração

### Fase 1: Criar Schema (Zero Downtime)
- Executar SQL completo no Supabase SQL Editor
- `SELECT gestao.seed_default_board()`
- Nenhum impacto no sistema existente

### Fase 2: Migrar Dados (Script One-Shot)
- Script `scripts/migrate-tasks-to-gestao.ts`
- Migra `atendimento.tasks` → `gestao.tasks` (mantém `legacy_task_id`)
- Migra `internal_conversations` → evolui com colunas novas (ALTER TABLE)
- **Não deleta dados originais**

### Fase 3: Ativar Realtime + Deploy Frontend
- `ALTER PUBLICATION supabase_realtime ADD TABLE ...`
- Deploy do módulo `/gestao`
- Rota `/tasks` continua funcionando em paralelo

### Fase 4: Redirect e Deprecação
- Env `GESTAO_MIGRATION_COMPLETE=true`
- `/tasks` redireciona para `/gestao`
- Deprecar `InternalChatContext` (substituído por hooks)

### Rollback
- Reverter env var → `/tasks` volta a funcionar
- `DROP SCHEMA gestao CASCADE` como último recurso
- Dados originais intactos em `atendimento.tasks` e `internal_*`

---

## 8. Integração com Sistema Existente

### Chat Gestão vs Chat WhatsApp

| Aspecto | Chat WhatsApp (Sidebar) | Chat Gestão |
|---------|------------------------|-------------|
| Backend | `public.chats` + `chat_messages` | Evolução de `internal_*` |
| Participantes | Pacientes externos | Equipe interna |
| IA | Clara via phone='00000000000' | Clara via @menção |
| Mídia | Bucket `chat-media` | Bucket `gestao-chat-files` |

**Sem cross-reference direta.** Clara acessa ambos via tools.

### TopBar Unificada

```typescript
function useUnifiedNotifications() {
  const { totalUnread: chatInternalUnread } = useInternalChat()
  const { unreadCount: gestaoUnread } = useGestaoNotifications()
  return { totalBadge: chatInternalUnread + gestaoUnread }
}
```

### Coexistência do InternalChatContext

- **Fase A:** Coexistem (dock na TopBar usa o antigo)
- **Fase B:** Dentro de `/gestao`, usa hooks novos
- **Fase C:** Dock aponta para `/gestao/chat`, remove antigo

---

## 9. Helpers e Utilitários

```
src/lib/
├── gestao-auth.ts          # getBoardMembership, requireBoardAccess, createNotification
├── gestao-validators.ts    # Zod schemas para todos os endpoints
└── gestao-realtime.ts      # Helpers para broadcast (status Clara, typing)
```

---

## 10. Estrutura de Arquivos Backend

```
src/
├── app/api/gestao/         # 30 arquivos route.ts (38 endpoints)
├── lib/
│   ├── gestao-auth.ts      # Autorização por board
│   ├── gestao-validators.ts # Zod schemas
│   └── gestao-realtime.ts  # Broadcast helpers
├── types/
│   └── gestao.ts           # Tipos compartilhados
├── hooks/
│   ├── useGestaoBoard.ts
│   ├── useGestaoTasks.ts
│   ├── useGestaoChat.ts
│   ├── useGestaoPresence.ts
│   ├── useGestaoNotifications.ts
│   └── useGestaoSearch.ts
├── ai/clara/tools/
│   └── gestao_tools.ts     # 6 tools novas da Clara
└── database/
    ├── gestao_schema.sql    # SQL completo
    └── gestao_seed.sql      # Seed do board padrão
```

---

## 11. ERRATA — Tripla Revisão de Consistência, Bugs e Segurança

> Revisão executada em 2026-04-09. Todos os itens abaixo DEVEM ser aplicados antes da Fase 3 (execução).

---

### 11.1 Correções de Schema SQL

#### 11.1.1 Supabase JS Client — Sintaxe de Schema Customizado

**BUG:** `supabase.from('gestao.board_members')` NÃO funciona. O Supabase JS aceita apenas nomes de tabela.

**Correção:** Em TODO o código backend, usar:
```typescript
// Criar client com schema gestao
const gestaoClient = supabase.schema('gestao')
gestaoClient.from('board_members').select('*')
gestaoClient.from('notifications').insert({ ... })
```

#### 11.1.2 Trigger `detect_clara_mention` — UUID vs String

**BUG:** `mentions` é `UUID[]` mas o trigger compara com `'clara-ai'` (string literal). O trigger NUNCA dispara.

**Correção:** Definir UUID fixo para a Clara e usar em todas as referências:
```sql
-- UUID reservado da Clara
-- '00000000-0000-0000-0000-00000000c1a4' (mnemônico: "c1a4" = "cla(ra)")

CREATE OR REPLACE FUNCTION gestao.detect_clara_mention()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.mentions IS NOT NULL AND '00000000-0000-0000-0000-00000000c1a4'::uuid = ANY(NEW.mentions) THEN
    INSERT INTO gestao.clara_queue(conversation_id, message_id, message_content, sender_id)
    VALUES (NEW.conversation_id, NEW.id, NEW.content, NEW.sender_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Obs:** Criar row em `public.profiles` com esse UUID para a Clara.

#### 11.1.3 Trigger `log_task_changes` — Actor ID Errado

**BUG:** Usa `NEW.creator_id` como `actor_id`. Se Maria move tarefa de João, o log diz que João moveu.

**Correção:**
```sql
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
  -- Campos adicionais que faltavam no log
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
$$ LANGUAGE plpgsql;
```

#### 11.1.4 RLS Policy `columns_board_members` — FOR ALL é Permissiva Demais

**BUG:** Viewers podem deletar/criar colunas.

**Correção:** Substituir policy única por policies granulares:
```sql
DROP POLICY IF EXISTS "columns_board_members" ON gestao.columns;

CREATE POLICY "columns_select" ON gestao.columns FOR SELECT USING (
  board_id IN (SELECT board_id FROM gestao.board_members WHERE user_id = auth.uid())
);
CREATE POLICY "columns_insert" ON gestao.columns FOR INSERT WITH CHECK (
  board_id IN (SELECT board_id FROM gestao.board_members WHERE user_id = auth.uid() AND role != 'viewer')
);
CREATE POLICY "columns_update" ON gestao.columns FOR UPDATE USING (
  board_id IN (SELECT board_id FROM gestao.board_members WHERE user_id = auth.uid() AND role != 'viewer')
);
CREATE POLICY "columns_delete" ON gestao.columns FOR DELETE USING (
  board_id IN (SELECT board_id FROM gestao.board_members WHERE user_id = auth.uid() AND role IN ('owner','admin'))
);
```

#### 11.1.5 `task_activity_log` — Policy INSERT Faltando

**BUG:** Sem policy INSERT, o trigger falha ao tentar inserir logs com RLS habilitado.

**Correção:**
```sql
CREATE POLICY "activity_insert" ON gestao.task_activity_log FOR INSERT
  WITH CHECK (true); -- triggers SECURITY DEFINER bypassam RLS, mas por segurança:
-- Alternativa mais segura: usar função SECURITY DEFINER para inserts de log
```

#### 11.1.6 Seed Idempotente

**BUG:** `seed_default_board()` sem guarda de duplicação — execução dupla causa UNIQUE violation.

**Correção:** Adicionar no início da função:
```sql
IF EXISTS (SELECT 1 FROM gestao.boards WHERE is_default = true) THEN
  RAISE NOTICE 'Board padrão já existe, pulando seed.';
  RETURN;
END IF;
```

#### 11.1.7 Default de Prioridade — Alinhar com Frontend

**Mudança:** Frontend espera default "Média", backend tem "none".

**Decisão:** Manter `DEFAULT 'none'` no banco (semanticamente correto — nem toda tarefa tem prioridade). O frontend deve setar visualmente "Média" como pré-selecionado no modal, mas enviar `'medium'` explicitamente no POST.

---

### 11.2 Endpoints Faltantes (14 novos)

Adicionar os seguintes endpoints ao plano (total atualizado: **58 endpoints**):

| # | Método | Rota | Descrição |
|---|--------|------|-----------|
| 45 | POST | `/api/gestao/tasks/[id]/duplicate` | Duplicar tarefa |
| 46 | PATCH | `/api/gestao/tasks/[id]/archive` | Toggle arquivar/desarquivar |
| 47 | PATCH | `/api/gestao/chat/messages/[id]/pin` | Toggle fixar mensagem |
| 48 | DELETE | `/api/gestao/chat/messages/[id]` | Soft-delete mensagem |
| 49 | PATCH | `/api/gestao/chat/conversations/[id]/read` | Marcar conversa como lida |
| 50 | PATCH | `/api/gestao/chat/conversations/[id]/pin` | Fixar conversa no topo |
| 51 | PATCH | `/api/gestao/chat/conversations/[id]/mute` | Toggle silenciar conversa |
| 52 | PATCH | `/api/gestao/chat/conversations/[id]/archive` | Arquivar conversa |
| 53 | DELETE | `/api/gestao/chat/conversations/[id]/leave` | Sair do grupo |
| 54 | GET | `/api/gestao/chat/conversations/[id]/search` | Buscar mensagens na conversa |
| 55 | GET | `/api/gestao/chat/conversations/[id]/pinned` | Listar mensagens fixadas |
| 56 | GET | `/api/gestao/chat/conversations/[id]/tasks` | Tarefas vinculadas à conversa |
| 57 | GET | `/api/gestao/chat/conversations/[id]/media` | Mídia compartilhada |
| 58 | POST | `/api/gestao/chat/conversations` | Criar conversa direta |

**Colunas faltantes no chat (ALTER TABLE):**
```sql
ALTER TABLE public.internal_conversations
  ADD COLUMN IF NOT EXISTS is_pinned_by UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_archived_by UUID[] DEFAULT '{}';

ALTER TABLE public.internal_conversation_participants
  ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMPTZ;
```

**Endpoint GET /api/gestao/tasks — Documentar query params:**
```typescript
// Query params suportados:
interface TaskListParams {
  board_id: string           // obrigatório
  column_id?: string         // filtro por coluna
  assignee_id?: string       // filtro por responsável
  creator_id?: string        // filtro por criador
  priority?: string          // filtro por prioridade
  label_ids?: string[]       // filtro por labels (ANY)
  due_date_from?: string     // ISO date — filtro range
  due_date_to?: string       // ISO date — filtro range
  is_overdue?: boolean       // filtro overdue
  is_archived?: boolean      // default: false
  search?: string            // busca fuzzy em title+description
  sort_by?: 'created_at' | 'due_date' | 'priority' | 'title' | 'position'
  sort_order?: 'asc' | 'desc'
  page?: number              // default: 1
  limit?: number             // default: 50, max: 200
}
// Response inclui: { data: GestaoTask[], totalCount: number, page: number }
```

---

### 11.3 Triggers de Notificação Faltantes

#### 11.3.1 Notificação de Tarefa Concluída

```sql
CREATE OR REPLACE FUNCTION gestao.notify_task_completed()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.completed_at IS NULL AND NEW.completed_at IS NOT NULL THEN
    -- Notifica criador (se diferente de quem concluiu)
    IF NEW.creator_id != COALESCE(auth.uid(), NEW.assignee_id) THEN
      INSERT INTO gestao.notifications(user_id, type, title, body, entity_type, entity_id, actor_id, action_url)
      VALUES (NEW.creator_id, 'task_completed', 'Tarefa concluída', NEW.title, 'task', NEW.id,
        COALESCE(auth.uid(), NEW.assignee_id), '/gestao?task=' || NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_notify_completed AFTER UPDATE ON gestao.tasks
  FOR EACH ROW EXECUTE FUNCTION gestao.notify_task_completed();
```

#### 11.3.2 Cron para Prazo Próximo e Overdue

```sql
-- Rota: /api/cron/gestao-notifications (rodar diariamente às 08:00 BRT)
-- Lógica:
-- 1. SELECT tarefas WHERE due_date = CURRENT_DATE + 1 AND completed_at IS NULL → notif 'task_due_soon'
-- 2. SELECT tarefas WHERE due_date < CURRENT_DATE AND completed_at IS NULL → notif 'task_overdue'
-- 3. Deduplicar: NOT EXISTS (notif com mesmo entity_id e type criada hoje)
```

#### 11.3.3 Notificação de Menção no Chat

```sql
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
      -- Pular Clara e o próprio remetente
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
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_notify_mention AFTER INSERT ON public.internal_messages
  FOR EACH ROW EXECUTE FUNCTION gestao.notify_chat_mention();
```

---

### 11.4 Correções de Segurança

#### 11.4.1 Remover `anon` dos GRANTs

```sql
REVOKE ALL ON ALL TABLES IN SCHEMA gestao FROM anon;
REVOKE USAGE ON SCHEMA gestao FROM anon;
```

#### 11.4.2 Imutabilidade do Activity Log

```sql
REVOKE UPDATE, DELETE ON gestao.task_activity_log FROM authenticated, anon;

-- Trigger de proteção extra
CREATE OR REPLACE FUNCTION gestao.prevent_activity_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'O log de atividades é imutável (LGPD)';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_activity_mutation
  BEFORE UPDATE OR DELETE ON gestao.task_activity_log
  FOR EACH ROW EXECUTE FUNCTION gestao.prevent_activity_log_mutation();
```

#### 11.4.3 RLS na `clara_queue`

```sql
ALTER TABLE gestao.clara_queue ENABLE ROW LEVEL SECURITY;

-- Apenas service_role pode ler/processar
-- INSERT via trigger SECURITY DEFINER (detect_clara_mention)
-- Nenhuma policy para authenticated (bloqueado por RLS)
CREATE POLICY "clara_queue_service_only" ON gestao.clara_queue FOR ALL
  USING (auth.role() = 'service_role');
```

#### 11.4.4 Storage Policies Corrigidas

```sql
-- Substituir policy permissiva por verificação de board membership
DROP POLICY IF EXISTS "gestao_attachments_select" ON storage.objects;
DROP POLICY IF EXISTS "gestao_attachments_delete" ON storage.objects;

CREATE POLICY "gestao_attachments_select" ON storage.objects FOR SELECT
USING (
  bucket_id = 'gestao-attachments'
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM gestao.board_members bm
    WHERE bm.user_id = auth.uid()
    AND bm.board_id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "gestao_attachments_delete" ON storage.objects FOR DELETE
USING (
  bucket_id = 'gestao-attachments'
  AND (storage.foldername(name))[2] = auth.uid()::text  -- só owner do arquivo
);
```

#### 11.4.5 Input Validation (Zod Schemas Obrigatórios)

```typescript
// src/lib/gestao-validators.ts
import { z } from 'zod'

export const createTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(10000).optional(),
  board_id: z.string().uuid(),
  column_id: z.string().uuid().optional(),
  priority: z.enum(['urgent', 'high', 'medium', 'low', 'none']).default('none'),
  assignee_id: z.string().uuid().optional(),
  due_date: z.string().date().optional(),
  label_ids: z.array(z.string().uuid()).max(10).optional(),
})

export const messageSchema = z.object({
  content: z.string().min(1).max(5000),
  reply_to_id: z.string().uuid().optional(),
  mentions: z.array(z.string().uuid()).max(20).optional(),
})

export const reactionSchema = z.object({
  emoji: z.string().min(1).max(8).regex(/^[\p{Emoji}]+$/u, 'Emoji inválido'),
})

export const commentSchema = z.object({
  content: z.string().min(1).max(5000),
  mentions: z.array(z.string().uuid()).max(20).optional(),
})
```

---

### 11.5 Correções de Performance

#### 11.5.1 View `vw_tasks_enriched` — Reescrever com CTEs

```sql
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
```

#### 11.5.2 Índices de Busca (pg_trgm)

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_tasks_title_trgm ON gestao.tasks USING GIN (title gin_trgm_ops);
CREATE INDEX idx_tasks_description_trgm ON gestao.tasks USING GIN (description gin_trgm_ops);
```

#### 11.5.3 Índice Composto para Filtros

```sql
CREATE INDEX idx_tasks_filters ON gestao.tasks(board_id, assignee_id, priority, due_date)
  WHERE NOT is_archived;
```

#### 11.5.4 Dashboard — Cache Headers

```typescript
// Em todos os endpoints /api/gestao/dashboard/*
return NextResponse.json(data, {
  headers: {
    'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
  }
})
```

---

### 11.6 Realtime — Fallback para Schema Customizado

**RISCO:** Supabase Realtime pode não suportar `postgres_changes` em tabelas da schema `gestao`.

**Plano de contingência:**
```sql
-- Teste: verificar se publicação funcionou
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'gestao';

-- Se vazio → implementar broadcast manual via trigger:
CREATE OR REPLACE FUNCTION gestao.broadcast_task_change()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify('gestao_tasks',
    json_build_object('type', TG_OP, 'board_id', NEW.board_id, 'task', row_to_json(NEW))::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

No frontend, usar `supabase.channel('gestao:board:' + boardId).on('broadcast', ...)` como fallback.

---

### 11.7 Resumo Quantitativo da Errata

| Categoria | Itens | Ação |
|-----------|-------|------|
| Schema SQL corrigido | 7 | Aplicar antes da migration |
| Endpoints novos | 14 | Implementar (total: 58) |
| Triggers novos | 3 | Adicionar ao schema |
| Segurança | 5 | Aplicar no SQL |
| Performance | 4 | Aplicar no SQL + código |
| Realtime fallback | 1 | Testar e implementar se necessário |
| **Total de correções** | **34** | |

---

## Próximos Passos

- **Fase 3:** Execução (implementação componente a componente, aplicando todas as correções da errata)

---

> Documento gerado com análise completa de **58 endpoints**, 17 tabelas, 7 canais Realtime, 6 hooks, e 6 tools de IA
> Errata aplicada após tripla revisão: consistência FE↔BE, bugs/pontas soltas, segurança/performance
