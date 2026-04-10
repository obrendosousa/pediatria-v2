import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { getGestaoClient, requireBoardAccess, getTaskBoardId } from '@/lib/gestao-auth'
import { updateChecklistItemSchema } from '@/lib/gestao-validators'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * PATCH /api/gestao/checklist/[id]
 * Atualiza item do checklist (toggle done, editar texto, reordenar).
 */
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    const auth = await requireAuth()
    if ('error' in auth) return auth.error
    const { user, supabase } = auth

    const { id: itemId } = await ctx.params
    const gestao = getGestaoClient(supabase)

    // Buscar item para obter task_id
    const { data: existing, error: fetchErr } = await gestao
      .from('checklist_items')
      .select('id, task_id')
      .eq('id', itemId)
      .single()

    if (fetchErr || !existing) {
      return NextResponse.json({ error: 'Item não encontrado' }, { status: 404 })
    }

    // Verificar acesso ao board
    const boardId = await getTaskBoardId(supabase, existing.task_id)
    if (!boardId) {
      return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 })
    }

    const access = await requireBoardAccess(supabase, user.id, boardId, 'member')
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    // Validar body
    const body = await req.json()
    const parsed = updateChecklistItemSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    const { data: item, error } = await gestao
      .from('checklist_items')
      .update(parsed.data)
      .eq('id', itemId)
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: item })
  } catch (err) {
    console.error('[PATCH /api/gestao/checklist/[id]]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

/**
 * DELETE /api/gestao/checklist/[id]
 * Remove item do checklist.
 */
export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  try {
    const auth = await requireAuth()
    if ('error' in auth) return auth.error
    const { user, supabase } = auth

    const { id: itemId } = await ctx.params
    const gestao = getGestaoClient(supabase)

    // Buscar item para obter task_id
    const { data: existing, error: fetchErr } = await gestao
      .from('checklist_items')
      .select('id, task_id')
      .eq('id', itemId)
      .single()

    if (fetchErr || !existing) {
      return NextResponse.json({ error: 'Item não encontrado' }, { status: 404 })
    }

    // Verificar acesso ao board
    const boardId = await getTaskBoardId(supabase, existing.task_id)
    if (!boardId) {
      return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 })
    }

    const access = await requireBoardAccess(supabase, user.id, boardId, 'member')
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const { error: deleteErr } = await gestao
      .from('checklist_items')
      .delete()
      .eq('id', itemId)

    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/gestao/checklist/[id]]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
