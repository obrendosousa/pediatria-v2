import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { getGestaoClient, requireBoardAccess, getTaskBoardId } from '@/lib/gestao-auth'
import { createChecklistItemSchema } from '@/lib/gestao-validators'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * POST /api/gestao/tasks/[id]/checklist
 * Adiciona item ao checklist de uma tarefa.
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
    const parsed = createChecklistItemSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    const gestao = getGestaoClient(supabase)

    // Auto-set position se não fornecido
    let position = parsed.data.position
    if (position === undefined) {
      const { data: maxItem } = await gestao
        .from('checklist_items')
        .select('position')
        .eq('task_id', taskId)
        .order('position', { ascending: false })
        .limit(1)
        .single()

      position = (maxItem?.position ?? -1) + 1
    }

    const { data: item, error } = await gestao
      .from('checklist_items')
      .insert({
        task_id: taskId,
        text: parsed.data.text,
        position,
      })
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: item }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/gestao/tasks/[id]/checklist]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
