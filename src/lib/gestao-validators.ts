import { z } from 'zod'

// === Boards ===

export const createBoardSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório').max(200),
  description: z.string().max(2000).optional(),
  visibility: z.enum(['private', 'team', 'public']).default('team'),
  icon: z.string().max(50).optional(),
  color: z.string().max(20).optional(),
})

export const updateBoardSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  visibility: z.enum(['private', 'team', 'public']).optional(),
  icon: z.string().max(50).nullable().optional(),
  color: z.string().max(20).nullable().optional(),
})

// === Colunas ===

export const createColumnSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório').max(100),
  color: z.string().max(20).default('#6366f1'),
  wip_limit: z.number().int().min(1).nullable().optional(),
  is_done_column: z.boolean().default(false),
})

export const updateColumnSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().max(20).optional(),
  wip_limit: z.number().int().min(1).nullable().optional(),
  is_done_column: z.boolean().optional(),
})

export const reorderColumnsSchema = z.object({
  board_id: z.string().uuid(),
  column_ids: z.array(z.string().uuid()).min(1),
})

// === Tasks ===

export const createTaskSchema = z.object({
  board_id: z.string().uuid(),
  column_id: z.string().uuid().optional(),
  title: z.string().min(1, 'Título obrigatório').max(500),
  description: z.string().max(10000).optional(),
  priority: z.enum(['urgent', 'high', 'medium', 'low', 'none']).default('none'),
  assignee_id: z.string().uuid().optional(),
  due_date: z.string().optional(),
  label_ids: z.array(z.string().uuid()).max(10).optional(),
  checklist: z.array(z.string().min(1).max(500)).max(50).optional(),
})

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(10000).nullable().optional(),
  priority: z.enum(['urgent', 'high', 'medium', 'low', 'none']).optional(),
  assignee_id: z.string().uuid().nullable().optional(),
  due_date: z.string().nullable().optional(),
  column_id: z.string().uuid().optional(),
  position: z.number().int().min(0).optional(),
  completed_at: z.string().nullable().optional(),
  is_archived: z.boolean().optional(),
})

export const moveTaskSchema = z.object({
  column_id: z.string().uuid(),
  position: z.number().int().min(0),
})

export const reorderTasksSchema = z.object({
  board_id: z.string().uuid(),
  tasks: z.array(z.object({
    id: z.string().uuid(),
    column_id: z.string().uuid(),
    position: z.number().int().min(0),
  })).min(1),
})

export const bulkActionSchema = z.object({
  task_ids: z.array(z.string().uuid()).min(1).max(100),
  action: z.enum(['move', 'assign', 'priority', 'archive', 'delete']),
  column_id: z.string().uuid().optional(),
  assignee_id: z.string().uuid().optional(),
  priority: z.enum(['urgent', 'high', 'medium', 'low', 'none']).optional(),
})

// === Comments ===

export const commentSchema = z.object({
  content: z.string().min(1, 'Conteúdo obrigatório').max(5000),
  mentions: z.array(z.string().uuid()).max(20).optional(),
})

// === Checklist ===

export const createChecklistItemSchema = z.object({
  text: z.string().min(1, 'Texto obrigatório').max(500),
  position: z.number().int().min(0).optional(),
})

export const updateChecklistItemSchema = z.object({
  text: z.string().min(1).max(500).optional(),
  is_done: z.boolean().optional(),
  position: z.number().int().min(0).optional(),
})

// === Labels ===

export const createLabelSchema = z.object({
  board_id: z.string().uuid(),
  name: z.string().min(1, 'Nome obrigatório').max(100),
  color: z.string().max(20).default('#6366f1'),
})

export const assignLabelSchema = z.object({
  label_id: z.string().uuid(),
})

// === Preferences ===

export const updatePreferencesSchema = z.object({
  default_board_id: z.string().uuid().nullable().optional(),
  default_view: z.enum(['kanban', 'list', 'calendar']).optional(),
  sidebar_collapsed: z.boolean().optional(),
  density: z.enum(['compact', 'comfortable', 'spacious']).optional(),
  notifications_enabled: z.boolean().optional(),
  notification_sound: z.boolean().optional(),
  email_digest: z.enum(['none', 'daily', 'weekly']).optional(),
})

// === Chat ===

export const messageSchema = z.object({
  content: z.string().min(1).max(5000),
  reply_to_id: z.string().uuid().optional(),
  mentions: z.array(z.string().uuid()).max(20).optional(),
})

export const reactionSchema = z.object({
  emoji: z.string().min(1).max(8),
})

export const createGroupSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório').max(200),
  description: z.string().max(2000).optional(),
  member_ids: z.array(z.string().uuid()).min(1, 'Adicione ao menos 1 membro'),
  include_clara: z.boolean().default(false),
})
