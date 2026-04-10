import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { getGestaoClient, requireBoardAccess } from '@/lib/gestao-auth'
import { createLabelSchema } from '@/lib/gestao-validators'

/**
 * GET /api/gestao/labels?board_id=xxx
 * Lista labels de um board.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth()
    if ('error' in auth) return auth.error
    const { user, supabase } = auth

    const boardId = req.nextUrl.searchParams.get('board_id')
    if (!boardId) {
      return NextResponse.json({ error: 'board_id obrigatório' }, { status: 400 })
    }

    const access = await requireBoardAccess(supabase, user.id, boardId, 'viewer')
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const gestao = getGestaoClient(supabase)
    const { data: labels, error } = await gestao
      .from('labels')
      .select('*')
      .eq('board_id', boardId)
      .order('name', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: labels })
  } catch (err) {
    console.error('[GET /api/gestao/labels]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

/**
 * POST /api/gestao/labels
 * Cria uma nova label.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth()
    if ('error' in auth) return auth.error
    const { user, supabase } = auth

    const body = await req.json()
    const parsed = createLabelSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    const access = await requireBoardAccess(supabase, user.id, parsed.data.board_id, 'member')
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const gestao = getGestaoClient(supabase)
    const { data: label, error } = await gestao
      .from('labels')
      .insert({
        board_id: parsed.data.board_id,
        name: parsed.data.name,
        color: parsed.data.color,
      })
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: label }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/gestao/labels]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
