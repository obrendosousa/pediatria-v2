import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { getGestaoClient, requireBoardAccess } from '@/lib/gestao-auth'
import { createColumnSchema } from '@/lib/gestao-validators'

type RouteContext = { params: Promise<{ id: string }> }

// GET /api/gestao/boards/[id]/columns — listar colunas do board
export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const auth = await requireAuth()
    if ('error' in auth) return auth.error
    const { user, supabase } = auth

    const { id: boardId } = await context.params

    // Verifica permissão mínima: viewer
    const access = await requireBoardAccess(supabase, user.id, boardId, 'viewer')
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const gestao = getGestaoClient(supabase)

    const { data: columns, error } = await gestao
      .from('columns')
      .select('*')
      .eq('board_id', boardId)
      .order('position', { ascending: true })

    if (error) {
      console.error('[gestao/columns] Erro ao listar colunas:', error)
      return NextResponse.json({ error: 'Erro ao listar colunas' }, { status: 500 })
    }

    return NextResponse.json({ data: columns || [] })
  } catch (err) {
    console.error('[gestao/columns] Erro inesperado:', err)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// POST /api/gestao/boards/[id]/columns — criar coluna
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const auth = await requireAuth()
    if ('error' in auth) return auth.error
    const { user, supabase } = auth

    const { id: boardId } = await context.params

    // Verifica permissão mínima: member
    const access = await requireBoardAccess(supabase, user.id, boardId, 'member')
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const body = await req.json()
    const parsed = createColumnSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const gestao = getGestaoClient(supabase)

    // Calcula próxima posição (max + 1)
    const { data: lastCol } = await gestao
      .from('columns')
      .select('position')
      .eq('board_id', boardId)
      .order('position', { ascending: false })
      .limit(1)
      .single()

    const nextPosition = (lastCol?.position ?? -1) + 1

    const { data: column, error } = await gestao
      .from('columns')
      .insert({
        ...parsed.data,
        board_id: boardId,
        position: nextPosition,
      })
      .select()
      .single()

    if (error) {
      console.error('[gestao/columns] Erro ao criar coluna:', error)
      return NextResponse.json({ error: 'Erro ao criar coluna' }, { status: 500 })
    }

    return NextResponse.json({ data: column }, { status: 201 })
  } catch (err) {
    console.error('[gestao/columns] Erro inesperado:', err)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
