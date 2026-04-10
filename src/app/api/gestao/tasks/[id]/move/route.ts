import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { getGestaoClient, requireBoardAccess, getTaskBoardId } from '@/lib/gestao-auth'
import { moveTaskSchema } from '@/lib/gestao-validators'

type RouteContext = { params: Promise<{ id: string }> }

// PATCH /api/gestao/tasks/[id]/move — Mover tarefa para outra coluna/posição
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    const auth = await requireAuth()
    if ('error' in auth) return auth.error
    const { user, supabase } = auth

    const { id } = await ctx.params
    const gestao = getGestaoClient(supabase)

    const body = await req.json()
    const parsed = moveTaskSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    const { column_id, position } = parsed.data

    // Verificar acesso ao board da tarefa
    const boardId = await getTaskBoardId(supabase, id)
    if (!boardId) {
      return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 })
    }

    const access = await requireBoardAccess(supabase, user.id, boardId, 'member')
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const { data: task, error } = await gestao
      .from('tasks')
      .update({ column_id, position })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: task })
  } catch (err) {
    console.error('[PATCH /api/gestao/tasks/[id]/move]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
