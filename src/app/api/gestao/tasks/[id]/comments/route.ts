import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { getGestaoClient, requireBoardAccess, getTaskBoardId } from '@/lib/gestao-auth'
import { commentSchema } from '@/lib/gestao-validators'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/gestao/tasks/[id]/comments
 * Lista comentários de uma tarefa com cursor pagination.
 */
export async function GET(req: NextRequest, ctx: RouteContext) {
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

    const access = await requireBoardAccess(supabase, user.id, boardId, 'viewer')
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    // Cursor pagination
    const { searchParams } = req.nextUrl
    const cursor = searchParams.get('cursor')
    const limit = Math.min(Number(searchParams.get('limit')) || 20, 100)

    const gestao = getGestaoClient(supabase)
    let query = gestao
      .from('task_comments')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true })
      .limit(limit + 1)

    if (cursor) {
      query = query.gt('created_at', cursor)
    }

    const { data: comments, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const hasMore = (comments?.length || 0) > limit
    const results = hasMore ? comments!.slice(0, limit) : (comments || [])

    // Buscar perfis dos autores (cross-schema: profiles está em public)
    const authorIds = [...new Set(results.map(c => c.author_id))]
    let profiles: Record<string, { full_name: string | null; photo_url: string | null; role: string }> = {}

    if (authorIds.length > 0) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, photo_url, role')
        .in('id', authorIds)

      if (profilesData) {
        profiles = Object.fromEntries(
          profilesData.map(p => [p.id, { full_name: p.full_name, photo_url: p.photo_url, role: p.role }])
        )
      }
    }

    // Enriquecer comentários com dados do autor
    const enriched = results.map(c => ({
      ...c,
      author_profile: profiles[c.author_id] || null,
    }))

    return NextResponse.json({ data: enriched, hasMore })
  } catch (err) {
    console.error('[GET /api/gestao/tasks/[id]/comments]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

/**
 * POST /api/gestao/tasks/[id]/comments
 * Adiciona comentário a uma tarefa.
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
    const parsed = commentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    const gestao = getGestaoClient(supabase)
    const { data: comment, error } = await gestao
      .from('task_comments')
      .insert({
        task_id: taskId,
        author_id: user.id,
        content: parsed.data.content,
        mentions: parsed.data.mentions || [],
      })
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: comment }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/gestao/tasks/[id]/comments]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
