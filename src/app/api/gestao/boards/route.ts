import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { getGestaoClient } from '@/lib/gestao-auth'
import { createBoardSchema } from '@/lib/gestao-validators'

// GET /api/gestao/boards — listar boards do usuário
export async function GET() {
  try {
    const auth = await requireAuth()
    if ('error' in auth) return auth.error
    const { user, supabase } = auth

    const gestao = getGestaoClient(supabase)

    // Busca boards onde o usuário é membro
    const { data: memberships, error: memError } = await gestao
      .from('board_members')
      .select('board_id, role')
      .eq('user_id', user.id)

    if (memError) {
      console.error('[gestao/boards] Erro ao buscar memberships:', memError)
      return NextResponse.json({ error: 'Erro ao buscar boards' }, { status: 500 })
    }

    if (!memberships || memberships.length === 0) {
      return NextResponse.json({ data: [] })
    }

    const boardIds = memberships.map((m) => m.board_id)

    const { data: boards, error: boardsError } = await gestao
      .from('boards')
      .select('*')
      .in('id', boardIds)
      .order('created_at', { ascending: false })

    if (boardsError) {
      console.error('[gestao/boards] Erro ao buscar boards:', boardsError)
      return NextResponse.json({ error: 'Erro ao buscar boards' }, { status: 500 })
    }

    // Anexa o role do usuário em cada board
    const boardsWithRole = (boards || []).map((board) => {
      const membership = memberships.find((m) => m.board_id === board.id)
      return { ...board, user_role: membership?.role || null }
    })

    return NextResponse.json({ data: boardsWithRole })
  } catch (err) {
    console.error('[gestao/boards] Erro inesperado:', err)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// POST /api/gestao/boards — criar board
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth()
    if ('error' in auth) return auth.error
    const { user, supabase } = auth

    const body = await req.json()
    const parsed = createBoardSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const gestao = getGestaoClient(supabase)

    // Cria o board
    const { data: board, error: boardError } = await gestao
      .from('boards')
      .insert({
        ...parsed.data,
        created_by: user.id,
      })
      .select()
      .single()

    if (boardError) {
      console.error('[gestao/boards] Erro ao criar board:', boardError)
      return NextResponse.json({ error: 'Erro ao criar board' }, { status: 500 })
    }

    // Insere o criador como owner
    const { error: memberError } = await gestao
      .from('board_members')
      .insert({
        board_id: board.id,
        user_id: user.id,
        role: 'owner',
      })

    if (memberError) {
      console.error('[gestao/boards] Erro ao inserir membro owner:', memberError)
      // Board foi criado mas membro falhou — tenta limpar
      await gestao.from('boards').delete().eq('id', board.id)
      return NextResponse.json({ error: 'Erro ao configurar permissões do board' }, { status: 500 })
    }

    return NextResponse.json({ data: board }, { status: 201 })
  } catch (err) {
    console.error('[gestao/boards] Erro inesperado:', err)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
