// Tipos do módulo de Gestão de Tarefas & Chat Interno

// UUID reservado da Clara IA
export const CLARA_AI_UUID = '00000000-0000-0000-0000-00000000c1a4'

// === Enums ===

export type TaskPriority = 'urgent' | 'high' | 'medium' | 'low' | 'none'
export type BoardVisibility = 'private' | 'team' | 'public'
export type BoardMemberRole = 'owner' | 'admin' | 'member' | 'viewer'
export type ConversationType = 'direct' | 'group'
export type UserStatus = 'online' | 'offline' | 'away' | 'busy'
export type DefaultView = 'kanban' | 'list' | 'calendar'
export type Density = 'compact' | 'comfortable' | 'spacious'
export type EmailDigest = 'none' | 'daily' | 'weekly'
export type NotificationType =
  | 'task_assigned'
  | 'task_completed'
  | 'task_due_soon'
  | 'task_overdue'
  | 'chat_mention'
  | 'chat_message'
  | 'clara_action'
export type NotificationEntityType = 'task' | 'comment' | 'chat' | 'clara'
export type ActivityAction =
  | 'moved'
  | 'priority_changed'
  | 'assigned'
  | 'title_changed'
  | 'due_date_changed'
  | 'completed'
  | 'archived'
  | 'unarchived'

// === Boards ===

export interface GestaoBoard {
  id: string
  name: string
  description: string | null
  visibility: BoardVisibility
  icon: string | null
  color: string | null
  is_default: boolean
  created_by: string
  created_at: string
  updated_at: string
}

export interface BoardMember {
  id: string
  board_id: string
  user_id: string
  role: BoardMemberRole
  created_at: string
  // Joined
  profile?: {
    id: string
    full_name: string | null
    photo_url: string | null
    email: string
    role: string
  }
}

// === Colunas ===

export interface GestaoColumn {
  id: string
  board_id: string
  name: string
  color: string
  position: number
  wip_limit: number | null
  is_done_column: boolean
  created_at: string
}

// === Tarefas ===

export interface GestaoTask {
  id: string
  board_id: string
  column_id: string | null
  title: string
  description: string | null
  priority: TaskPriority
  position: number
  assignee_id: string | null
  creator_id: string
  due_date: string | null
  completed_at: string | null
  is_archived: boolean
  source_message_id: string | null
  legacy_task_id: number | null
  created_at: string
  updated_at: string
}

export interface GestaoTaskEnriched extends GestaoTask {
  assignee_name: string | null
  assignee_photo: string | null
  creator_name: string | null
  column_name: string | null
  board_name: string | null
  comments_count: number
  checklist_total: number
  checklist_done: number
  labels: { id: string; name: string; color: string }[] | null
  is_overdue: boolean
}

// === Labels ===

export interface GestaoLabel {
  id: string
  board_id: string
  name: string
  color: string
  created_at: string
}

// === Checklist ===

export interface ChecklistItem {
  id: string
  task_id: string
  text: string
  is_done: boolean
  position: number
  created_at: string
}

// === Comentários ===

export interface TaskComment {
  id: string
  task_id: string
  author_id: string
  content: string
  mentions: string[]
  is_system: boolean
  created_at: string
  updated_at: string
  // Joined
  author_profile?: {
    full_name: string | null
    photo_url: string | null
    role: string
  }
}

// === Activity Log ===

export interface TaskActivityLog {
  id: string
  task_id: string
  actor_id: string | null
  action: ActivityAction
  old_value: Record<string, unknown> | null
  new_value: Record<string, unknown> | null
  created_at: string
  // Joined
  actor_profile?: {
    full_name: string | null
    photo_url: string | null
  }
}

// === Chat (evolução) ===

export interface GestaoChatGroup {
  id: string
  type: ConversationType
  name: string | null
  avatar_url: string | null
  description: string | null
  created_by: string | null
  include_clara: boolean
  is_pinned_by: string[]
  is_archived_by: string[]
  created_at: string
  updated_at: string
  // Joined
  participants?: GestaoChatMember[]
  last_message?: GestaoChatMessage
  unread_count?: number
}

export interface GestaoChatMember {
  id: string
  conversation_id: string
  user_id: string
  role: 'admin' | 'member'
  is_muted: boolean
  last_read_at: string | null
  created_at: string
  // Joined
  profile?: {
    id: string
    full_name: string | null
    photo_url: string | null
    email: string
    role: string
  }
}

export interface GestaoChatMessage {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  message_type: string
  file_url: string | null
  file_name: string | null
  file_size: number | null
  reply_to_id: string | null
  mentions: string[]
  is_pinned: boolean
  edited_at: string | null
  is_deleted: boolean
  metadata: Record<string, unknown> | null
  created_at: string
  // Joined
  sender_profile?: {
    full_name: string | null
    photo_url: string | null
    role: string
  }
  reactions?: MessageReaction[]
  reply_to?: GestaoChatMessage | null
}

export interface MessageReaction {
  id: string
  message_id: string
  user_id: string
  emoji: string
  created_at: string
  // Joined
  user_profile?: {
    full_name: string | null
  }
}

// === Notificações ===

export interface GestaoNotification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  body: string | null
  is_read: boolean
  entity_type: NotificationEntityType | null
  entity_id: string | null
  action_url: string | null
  actor_id: string | null
  created_at: string
  // Joined
  actor_profile?: {
    full_name: string | null
    photo_url: string | null
  }
}

// === Preferências ===

export interface GestaoPreferences {
  user_id: string
  default_board_id: string | null
  default_view: DefaultView
  sidebar_collapsed: boolean
  density: Density
  notifications_enabled: boolean
  notification_sound: boolean
  email_digest: EmailDigest
  updated_at: string
}

// === Dashboard ===

export interface DashboardKPIs {
  total_tasks: number
  completed_tasks: number
  overdue_tasks: number
  completion_rate: number
  // Deltas comparativos (calculados no endpoint)
  total_delta: number
  completed_delta: number
  overdue_delta: number
  rate_delta: number
}

export interface DashboardChartPoint {
  date: string
  created: number
  completed: number
}

export interface DashboardWorkload {
  user_id: string
  full_name: string | null
  photo_url: string | null
  assigned_active: number
  completed_this_week: number
  overdue: number
}

export interface DashboardRanking {
  user_id: string
  full_name: string | null
  photo_url: string | null
  completed_count: number
  position: number
}

export interface DashboardOverdueTask {
  id: string
  title: string
  due_date: string
  assignee_name: string | null
  assignee_photo: string | null
  days_overdue: number
}

// === Params de API ===

export interface TaskListParams {
  board_id: string
  column_id?: string
  assignee_id?: string
  creator_id?: string
  priority?: TaskPriority
  label_ids?: string[]
  due_date_from?: string
  due_date_to?: string
  is_overdue?: boolean
  is_archived?: boolean
  search?: string
  sort_by?: 'created_at' | 'due_date' | 'priority' | 'title' | 'position'
  sort_order?: 'asc' | 'desc'
  page?: number
  limit?: number
}

export interface CreateTaskParams {
  board_id: string
  column_id?: string
  title: string
  description?: string
  priority?: TaskPriority
  assignee_id?: string
  due_date?: string
  label_ids?: string[]
  checklist?: string[]
}

export interface UpdateTaskParams {
  title?: string
  description?: string
  priority?: TaskPriority
  assignee_id?: string | null
  due_date?: string | null
  column_id?: string
  position?: number
  completed_at?: string | null
  is_archived?: boolean
}

export interface BulkActionParams {
  task_ids: string[]
  action: 'move' | 'assign' | 'priority' | 'archive' | 'delete'
  column_id?: string
  assignee_id?: string
  priority?: TaskPriority
}
