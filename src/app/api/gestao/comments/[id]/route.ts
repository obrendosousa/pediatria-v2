import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { getGestaoClient, requireBoardAccess, getTaskBoardId } from '@/lib/gestao-auth'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * DELETE /api/gestao/comments/[id]
 * Deleta um comentário. Autor ou admin do board.
 */
export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  try {
    const auth = await requireAuth()
    if ('error' in auth) return auth.error
    const { user, supabase } = auth

    const { id: commentId } = await ctx.params
    const gestao = getGestaoClient(supabase)

    // Buscar comentário para obter task_id e author_id
    const { data: comment, error: fetchErr } = await gestao
      .from('task_comments')
      .select('id, task_id, author_id')
      .eq('id', commentId)
      .single()

    if (fetchErr || !comment) {
      return NextResponse.json({ error: 'Comentário não encontrado' }, { status: 404 })
    }

    // Verificar acesso ao board da tarefa
    const boardId = await getTaskBoardId(supabase, comment.task_id)
    if (!boardId) {
      return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 })
    }

    // Autor pode deletar o próprio comentário; caso contrário, precisa ser admin
    if (comment.author_id !== user.id) {
      const access = await requireBoardAccess(supabase, user.id, boardId, 'admin')
      if ('error' in access) {
        return NextResponse.json({ error: access.error }, { status: access.status })
      }
    } else {
      // Mesmo o autor precisa ser membro do board
      const access = await requireBoardAccess(supabase, user.id, boardId, 'viewer')
      if ('error' in access) {
        return NextResponse.json({ error: access.error }, { status: access.status })
      }
    }

    const { error: deleteErr } = await gestao
      .from('task_comments')
      .delete()
      .eq('id', commentId)

    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/gestao/comments/[id]]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
