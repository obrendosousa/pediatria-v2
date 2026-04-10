import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { getGestaoClient, requireBoardAccess } from '@/lib/gestao-auth'
import { createTaskSchema } from '@/lib/gestao-validators'

// GET /api/gestao/tasks — Listar tarefas com filtros
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth()
    if ('error' in auth) return auth.error
    const { user, supabase } = auth

    const gestao = getGestaoClient(supabase)
    const params = req.nextUrl.searchParams

    const board_id = params.get('board_id')
    if (!board_id) {
      return NextResponse.json({ error: 'board_id é obrigatório' }, { status: 400 })
    }

    // Verificar acesso ao board
    const access = await requireBoardAccess(supabase, user.id, board_id)
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const column_id = params.get('column_id')
    const assignee_id = params.get('assignee_id')
    const priority = params.get('priority')
    const search = params.get('search')
    const is_archived = params.get('is_archived') === 'true'
    const sort_by = params.get('sort_by') || 'position'
    const sort_order = params.get('sort_order') || 'asc'
    const page = Math.max(1, parseInt(params.get('page') || '1'))
    const limit = Math.min(200, Math.max(1, parseInt(params.get('limit') || '50')))
    const offset = (page - 1) * limit

    // Query base na view enriquecida
    let query = gestao
      .from('vw_tasks_enriched')
      .select('*', { count: 'exact' })
      .eq('board_id', board_id)
      .eq('is_archived', is_archived)

    if (column_id) query = query.eq('column_id', column_id)
    if (assignee_id) query = query.eq('assignee_id', assignee_id)
    if (priority) query = query.eq('priority', priority)
    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`)
    }

    query = query
      .order(sort_by, { ascending: sort_order === 'asc' })
      .range(offset, offset + limit - 1)

    const { data: tasks, error, count } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      data: tasks || [],
      totalCount: count || 0,
      page,
    })
  } catch (err) {
    console.error('[GET /api/gestao/tasks]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// POST /api/gestao/tasks — Criar tarefa
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth()
    if ('error' in auth) return auth.error
    const { user, supabase } = auth

    const body = await req.json()
    const parsed = createTaskSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    const { board_id, column_id, title, description, priority, assignee_id, due_date, label_ids, checklist } = parsed.data
    const gestao = getGestaoClient(supabase)

    // Verificar acesso ao board
    const access = await requireBoardAccess(supabase, user.id, board_id, 'member')
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    // Se não informou column_id, pegar a primeira coluna do board
    let targetColumnId = column_id
    if (!targetColumnId) {
      const { data: firstCol } = await gestao
        .from('columns')
        .select('id')
        .eq('board_id', board_id)
        .order('position', { ascending: true })
        .limit(1)
        .single()

      if (!firstCol) {
        return NextResponse.json({ error: 'Board não possui colunas' }, { status: 400 })
      }
      targetColumnId = firstCol.id
    }

    // Calcular próxima posição na coluna
    const { data: maxPosRow } = await gestao
      .from('tasks')
      .select('position')
      .eq('column_id', targetColumnId)
      .order('position', { ascending: false })
      .limit(1)
      .single()

    const nextPosition = (maxPosRow?.position ?? -1) + 1

    // Inserir tarefa
    const { data: task, error: taskError } = await gestao
      .from('tasks')
      .insert({
        board_id,
        column_id: targetColumnId,
        title,
        description: description || null,
        priority,
        assignee_id: assignee_id || null,
        creator_id: user.id,
        due_date: due_date || null,
        position: nextPosition,
      })
      .select()
      .single()

    if (taskError || !task) {
      return NextResponse.json({ error: taskError?.message || 'Erro ao criar tarefa' }, { status: 500 })
    }

    // Inserir labels se fornecidas
    if (label_ids && label_ids.length > 0) {
      const labelRows = label_ids.map((label_id) => ({
        task_id: task.id,
        label_id,
      }))
      await gestao.from('task_labels').insert(labelRows)
    }

    // Inserir checklist se fornecido
    if (checklist && checklist.length > 0) {
      const checklistRows = checklist.map((text, index) => ({
        task_id: task.id,
        text,
        position: index,
        is_done: false,
      }))
      await gestao.from('checklist_items').insert(checklistRows)
    }

    return NextResponse.json({ data: task }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/gestao/tasks]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
