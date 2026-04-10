import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { getGestaoClient, requireBoardAccess } from '@/lib/gestao-auth'
import { reorderTasksSchema } from '@/lib/gestao-validators'

// PATCH /api/gestao/tasks/reorder — Reordenar tarefas em lote
export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAuth()
    if ('error' in auth) return auth.error
    const { user, supabase } = auth

    const body = await req.json()
    const parsed = reorderTasksSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    const { board_id, tasks } = parsed.data
    const gestao = getGestaoClient(supabase)

    // Verificar acesso ao board
    const access = await requireBoardAccess(supabase, user.id, board_id, 'member')
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    // Atualizar cada tarefa sequencialmente (evitar deadlocks)
    for (const item of tasks) {
      const { error } = await gestao
        .from('tasks')
        .update({ column_id: item.column_id, position: item.position })
        .eq('id', item.id)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[PATCH /api/gestao/tasks/reorder]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
