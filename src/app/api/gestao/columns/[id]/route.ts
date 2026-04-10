import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { getGestaoClient, requireBoardAccess } from '@/lib/gestao-auth'
import { updateColumnSchema } from '@/lib/gestao-validators'

type RouteContext = { params: Promise<{ id: string }> }

// PATCH /api/gestao/columns/[id] — atualizar coluna
export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const auth = await requireAuth()
    if ('error' in auth) return auth.error
    const { user, supabase } = auth

    const { id } = await context.params

    const gestao = getGestaoClient(supabase)

    // Busca a coluna para descobrir o board_id
    const { data: existingCol, error: fetchError } = await gestao
      .from('columns')
      .select('board_id')
      .eq('id', id)
      .single()

    if (fetchError || !existingCol) {
      return NextResponse.json({ error: 'Coluna não encontrada' }, { status: 404 })
    }

    // Verifica permissão mínima: member
    const access = await requireBoardAccess(supabase, user.id, existingCol.board_id, 'member')
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const body = await req.json()
    const parsed = updateColumnSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { data: column, error } = await gestao
      .from('columns')
      .update(parsed.data)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[gestao/columns/id] Erro ao atualizar coluna:', error)
      return NextResponse.json({ error: 'Erro ao atualizar coluna' }, { status: 500 })
    }

    return NextResponse.json({ data: column })
  } catch (err) {
    console.error('[gestao/columns/id] Erro inesperado:', err)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// DELETE /api/gestao/columns/[id] — excluir coluna
export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const auth = await requireAuth()
    if ('error' in auth) return auth.error
    const { user, supabase } = auth

    const { id } = await context.params

    const gestao = getGestaoClient(supabase)

    // Busca a coluna para descobrir o board_id
    const { data: existingCol, error: fetchError } = await gestao
      .from('columns')
      .select('board_id')
      .eq('id', id)
      .single()

    if (fetchError || !existingCol) {
      return NextResponse.json({ error: 'Coluna não encontrada' }, { status: 404 })
    }

    // Somente admin pode excluir colunas
    const access = await requireBoardAccess(supabase, user.id, existingCol.board_id, 'admin')
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const { error } = await gestao
      .from('columns')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('[gestao/columns/id] Erro ao excluir coluna:', error)
      return NextResponse.json({ error: 'Erro ao excluir coluna' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[gestao/columns/id] Erro inesperado:', err)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
