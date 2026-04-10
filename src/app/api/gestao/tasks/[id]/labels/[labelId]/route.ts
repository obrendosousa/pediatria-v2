import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { getGestaoClient, requireBoardAccess, getTaskBoardId } from '@/lib/gestao-auth'

type RouteContext = { params: Promise<{ id: string; labelId: string }> }

/**
 * DELETE /api/gestao/tasks/[id]/labels/[labelId]
 * Remove uma label de uma tarefa.
 */
export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  try {
    const auth = await requireAuth()
    if ('error' in auth) return auth.error
    const { user, supabase } = auth

    const { id: taskId, labelId } = await ctx.params

    // Verificar acesso ao board
    const boardId = await getTaskBoardId(supabase, taskId)
    if (!boardId) {
      return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 })
    }

    const access = await requireBoardAccess(supabase, user.id, boardId, 'member')
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const gestao = getGestaoClient(supabase)
    const { error } = await gestao
      .from('task_labels')
      .delete()
      .eq('task_id', taskId)
      .eq('label_id', labelId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/gestao/tasks/[id]/labels/[labelId]]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
