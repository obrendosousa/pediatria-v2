import { SupabaseClient } from '@supabase/supabase-js'
import type { BoardMemberRole } from '@/types/gestao'

const ROLE_HIERARCHY: BoardMemberRole[] = ['viewer', 'member', 'admin', 'owner']

/**
 * Retorna um client Supabase apontando para a schema `gestao`.
 * Usar em TODOS os acessos a tabelas da schema gestao.
 */
export function getGestaoClient(supabase: SupabaseClient) {
  return supabase.schema('gestao')
}

/**
 * Verifica se o usuário é membro do board e retorna o role.
 */
export async function getBoardMembership(
  supabase: SupabaseClient,
  userId: string,
  boardId: string
): Promise<BoardMemberRole | null> {
  const gestao = getGestaoClient(supabase)
  const { data } = await gestao
    .from('board_members')
    .select('role')
    .eq('board_id', boardId)
    .eq('user_id', userId)
    .single()
  return (data?.role as BoardMemberRole) || null
}

/**
 * Verifica se o usuário tem o role mínimo no board.
 * Retorna o role se OK, ou um objeto de erro.
 */
export async function requireBoardAccess(
  supabase: SupabaseClient,
  userId: string,
  boardId: string,
  minRole: BoardMemberRole = 'viewer'
): Promise<{ role: BoardMemberRole } | { error: string; status: number }> {
  const role = await getBoardMembership(supabase, userId, boardId)
  if (!role) {
    return { error: 'Não é membro do board', status: 403 }
  }
  if (ROLE_HIERARCHY.indexOf(role) < ROLE_HIERARCHY.indexOf(minRole)) {
    return { error: 'Permissão insuficiente', status: 403 }
  }
  return { role }
}

/**
 * Busca o board_id de uma tarefa (para verificar acesso).
 */
export async function getTaskBoardId(
  supabase: SupabaseClient,
  taskId: string
): Promise<string | null> {
  const gestao = getGestaoClient(supabase)
  const { data } = await gestao
    .from('tasks')
    .select('board_id')
    .eq('id', taskId)
    .single()
  return data?.board_id || null
}

/**
 * Cria uma notificação no schema gestao.
 */
export async function createGestaoNotification(
  supabase: SupabaseClient,
  params: {
    user_id: string
    type: string
    title: string
    body?: string
    entity_type?: string
    entity_id?: string
    actor_id?: string
    action_url?: string
  }
) {
  const gestao = getGestaoClient(supabase)
  await gestao.from('notifications').insert({ ...params, is_read: false })
}
