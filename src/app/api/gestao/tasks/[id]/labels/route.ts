import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { getGestaoClient, requireBoardAccess, getTaskBoardId } from '@/lib/gestao-auth'
import { assignLabelSchema } from '@/lib/gestao-validators'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * POST /api/gestao/tasks/[id]/labels
 * Atribui uma label a uma tarefa. Upsert para evitar duplicatas.
 */
export async function POST(req: NextRequest, ctx: RouteContext) {
  try {
    const auth = await requireAuth()
    if ('error' in auth) return auth.error
    const { user, supabase } = auth

    const { id: taskId } = await ctx.params

    // Verificar acesso ao board
    const boardId = await getTaskBoardId(supabase, taskId)
    if (!boardId) {
      return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 })
    }

    const access = await requireBoardAccess(supabase, user.id, boardId, 'member')
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    // Validar body
    const body = await req.json()
    const parsed = assignLabelSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    const gestao = getGestaoClient(supabase)
    const { error } = await gestao
      .from('task_labels')
      .upsert(
        { task_id: taskId, label_id: parsed.data.label_id },
        { onConflict: 'task_id,label_id' }
      )

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/gestao/tasks/[id]/labels]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
