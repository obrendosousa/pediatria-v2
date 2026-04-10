import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { getGestaoClient, requireBoardAccess, getTaskBoardId } from '@/lib/gestao-auth'
import { bulkActionSchema } from '@/lib/gestao-validators'

// POST /api/gestao/tasks/bulk — Ações em lote
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth()
    if ('error' in auth) return auth.error
    const { user, supabase } = auth

    const body = await req.json()
    const parsed = bulkActionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    const { task_ids, action, column_id, assignee_id, priority } = parsed.data
    const gestao = getGestaoClient(supabase)

    // Verificar acesso usando o board da primeira tarefa
    const firstBoardId = await getTaskBoardId(supabase, task_ids[0])
    if (!firstBoardId) {
      return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 })
    }

    const minRole = action === 'delete' ? 'admin' as const : 'member' as const
    const access = await requireBoardAccess(supabase, user.id, firstBoardId, minRole)
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    let affected = 0

    // Executar ações sequencialmente para evitar deadlocks
    for (const taskId of task_ids) {
      let error = null

      switch (action) {
        case 'move':
          if (!column_id) {
            return NextResponse.json({ error: 'column_id obrigatório para ação move' }, { status: 400 })
          }
          ({ error } = await gestao.from('tasks').update({ column_id }).eq('id', taskId))
          break

        case 'assign':
          ({ error } = await gestao.from('tasks').update({ assignee_id: assignee_id || null }).eq('id', taskId))
          break

        case 'priority':
          if (!priority) {
            return NextResponse.json({ error: 'priority obrigatório para ação priority' }, { status: 400 })
          }
          ({ error } = await gestao.from('tasks').update({ priority }).eq('id', taskId))
          break

        case 'archive':
          ({ error } = await gestao.from('tasks').update({ is_archived: true }).eq('id', taskId))
          break

        case 'delete':
          ({ error } = await gestao.from('tasks').delete().eq('id', taskId))
          break
      }

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      affected++
    }

    return NextResponse.json({ success: true, affected })
  } catch (err) {
    console.error('[POST /api/gestao/tasks/bulk]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
