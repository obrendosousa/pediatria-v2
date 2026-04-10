import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { getGestaoClient, requireBoardAccess, getTaskBoardId } from '@/lib/gestao-auth'

type RouteContext = { params: Promise<{ id: string }> }

// PATCH /api/gestao/tasks/[id]/archive — Alternar arquivamento da tarefa
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    const auth = await requireAuth()
    if ('error' in auth) return auth.error
    const { user, supabase } = auth

    const { id } = await ctx.params
    const gestao = getGestaoClient(supabase)

    // Verificar acesso ao board da tarefa
    const boardId = await getTaskBoardId(supabase, id)
    if (!boardId) {
      return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 })
    }

    const access = await requireBoardAccess(supabase, user.id, boardId, 'member')
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    // Buscar estado atual
    const { data: current, error: fetchError } = await gestao
      .from('tasks')
      .select('is_archived')
      .eq('id', id)
      .single()

    if (fetchError || !current) {
      return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 })
    }

    // Toggle
    const { data: task, error } = await gestao
      .from('tasks')
      .update({ is_archived: !current.is_archived })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: task })
  } catch (err) {
    console.error('[PATCH /api/gestao/tasks/[id]/archive]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
