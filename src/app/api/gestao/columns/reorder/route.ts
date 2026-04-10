import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { getGestaoClient, requireBoardAccess } from '@/lib/gestao-auth'
import { reorderColumnsSchema } from '@/lib/gestao-validators'

// PATCH /api/gestao/columns/reorder — reordenar colunas
export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAuth()
    if ('error' in auth) return auth.error
    const { user, supabase } = auth

    const body = await req.json()
    const parsed = reorderColumnsSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { board_id, column_ids } = parsed.data

    // Verifica permissão mínima: member
    const access = await requireBoardAccess(supabase, user.id, board_id, 'member')
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const gestao = getGestaoClient(supabase)

    // Atualiza posição de cada coluna
    for (let i = 0; i < column_ids.length; i++) {
      const { error } = await gestao
        .from('columns')
        .update({ position: i })
        .eq('id', column_ids[i])
        .eq('board_id', board_id)

      if (error) {
        console.error(`[gestao/columns/reorder] Erro ao reordenar coluna ${column_ids[i]}:`, error)
        return NextResponse.json({ error: 'Erro ao reordenar colunas' }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[gestao/columns/reorder] Erro inesperado:', err)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
