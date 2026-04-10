import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { getGestaoClient, requireBoardAccess } from '@/lib/gestao-auth'
import { updateBoardSchema } from '@/lib/gestao-validators'

type RouteContext = { params: Promise<{ id: string }> }

// PATCH /api/gestao/boards/[id] — atualizar board
export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const auth = await requireAuth()
    if ('error' in auth) return auth.error
    const { user, supabase } = auth

    const { id } = await context.params

    // Verifica permissão mínima: admin
    const access = await requireBoardAccess(supabase, user.id, id, 'admin')
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const body = await req.json()
    const parsed = updateBoardSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const gestao = getGestaoClient(supabase)

    const { data: board, error } = await gestao
      .from('boards')
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[gestao/boards/id] Erro ao atualizar board:', error)
      return NextResponse.json({ error: 'Erro ao atualizar board' }, { status: 500 })
    }

    return NextResponse.json({ data: board })
  } catch (err) {
    console.error('[gestao/boards/id] Erro inesperado:', err)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// DELETE /api/gestao/boards/[id] — excluir board
export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const auth = await requireAuth()
    if ('error' in auth) return auth.error
    const { user, supabase } = auth

    const { id } = await context.params

    // Somente owner pode excluir
    const access = await requireBoardAccess(supabase, user.id, id, 'owner')
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const gestao = getGestaoClient(supabase)

    const { error } = await gestao
      .from('boards')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('[gestao/boards/id] Erro ao excluir board:', error)
      return NextResponse.json({ error: 'Erro ao excluir board' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[gestao/boards/id] Erro inesperado:', err)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
