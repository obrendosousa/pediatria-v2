import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { getGestaoClient, requireBoardAccess, getTaskBoardId } from '@/lib/gestao-auth'

type RouteContext = { params: Promise<{ id: string }> }

// POST /api/gestao/tasks/[id]/duplicate — Duplicar tarefa
export async function POST(req: NextRequest, ctx: RouteContext) {
  try {
    const auth = await requireAuth()
    if ('error' in auth) return auth.error
    const { user, supabase } = auth

    const { id } = await ctx.params
    const gestao = getGestaoClient(supabase)

    // Verificar acesso ao board da tarefa
    const boardId = await getTaskBoardId(supabase, id)
    if (!boardId) {
      return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 })
    }

    const access = await requireBoardAccess(supabase, user.id, boardId, 'member')
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    // Buscar tarefa original
    const { data: original, error: fetchError } = await gestao
      .from('tasks')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !original) {
      return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 })
    }

    // Inserir cópia
    const { data: newTask, error: insertError } = await gestao
      .from('tasks')
      .insert({
        board_id: original.board_id,
        column_id: original.column_id,
        title: `Cópia de ${original.title}`,
        description: original.description,
        priority: original.priority,
        assignee_id: original.assignee_id,
        creator_id: user.id,
        due_date: original.due_date,
        position: original.position + 1,
        completed_at: null,
        is_archived: false,
      })
      .select()
      .single()

    if (insertError || !newTask) {
      return NextResponse.json({ error: insertError?.message || 'Erro ao duplicar tarefa' }, { status: 500 })
    }

    // Duplicar checklist items
    const { data: checklistItems } = await gestao
      .from('checklist_items')
      .select('text, position')
      .eq('task_id', id)
      .order('position', { ascending: true })

    if (checklistItems && checklistItems.length > 0) {
      const newChecklistRows = checklistItems.map((item) => ({
        task_id: newTask.id,
        text: item.text,
        position: item.position,
        is_done: false,
      }))
      await gestao.from('checklist_items').insert(newChecklistRows)
    }

    // Duplicar labels
    const { data: taskLabels } = await gestao
      .from('task_labels')
      .select('label_id')
      .eq('task_id', id)

    if (taskLabels && taskLabels.length > 0) {
      const newLabelRows = taskLabels.map((tl) => ({
        task_id: newTask.id,
        label_id: tl.label_id,
      }))
      await gestao.from('task_labels').insert(newLabelRows)
    }

    return NextResponse.json({ data: newTask }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/gestao/tasks/[id]/duplicate]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
