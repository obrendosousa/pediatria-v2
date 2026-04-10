import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { getGestaoClient, requireBoardAccess, getTaskBoardId } from '@/lib/gestao-auth'
import { updateTaskSchema } from '@/lib/gestao-validators'

type RouteContext = { params: Promise<{ id: string }> }

// GET /api/gestao/tasks/[id] — Detalhes da tarefa
export async function GET(req: NextRequest, ctx: RouteContext) {
  try {
    const auth = await requireAuth()
    if ('error' in auth) return auth.error
    const { user, supabase } = auth

    const { id } = await ctx.params
    const gestao = getGestaoClient(supabase)

    // Buscar tarefa na view enriquecida
    const { data: task, error: taskError } = await gestao
      .from('vw_tasks_enriched')
      .select('*')
      .eq('id', id)
      .single()

    if (taskError || !task) {
      return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 })
    }

    // Verificar acesso ao board
    const access = await requireBoardAccess(supabase, user.id, task.board_id)
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    // Buscar checklist
    const { data: checklist } = await gestao
      .from('checklist_items')
      .select('*')
      .eq('task_id', id)
      .order('position', { ascending: true })

    // Buscar comentários recentes (limite 20)
    const { data: comments } = await gestao
      .from('task_comments')
      .select('*')
      .eq('task_id', id)
      .order('created_at', { ascending: false })
      .limit(20)

    return NextResponse.json({
      data: {
        ...task,
        checklist: checklist || [],
        comments: comments || [],
      },
    })
  } catch (err) {
    console.error('[GET /api/gestao/tasks/[id]]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// PATCH /api/gestao/tasks/[id] — Atualizar tarefa
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    const auth = await requireAuth()
    if ('error' in auth) return auth.error
    const { user, supabase } = auth

    const { id } = await ctx.params
    const gestao = getGestaoClient(supabase)

    // Verificar acesso via board da tarefa
    const boardId = await getTaskBoardId(supabase, id)
    if (!boardId) {
      return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 })
    }

    const access = await requireBoardAccess(supabase, user.id, boardId, 'member')
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const body = await req.json()
    const parsed = updateTaskSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    const updateData: Record<string, unknown> = { ...parsed.data }

    // Se completed_at está sendo definido (era null, agora não é), usar timestamp atual
    if (parsed.data.completed_at !== undefined && parsed.data.completed_at !== null) {
      // Buscar valor atual para verificar se era null
      const { data: current } = await gestao
        .from('tasks')
        .select('completed_at')
        .eq('id', id)
        .single()

      if (current && current.completed_at === null) {
        updateData.completed_at = new Date().toISOString()
      }
    }

    const { data: task, error } = await gestao
      .from('tasks')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: task })
  } catch (err) {
    console.error('[PATCH /api/gestao/tasks/[id]]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// DELETE /api/gestao/tasks/[id] — Deletar tarefa
export async function DELETE(req: NextRequest, ctx: RouteContext) {
  try {
    const auth = await requireAuth()
    if ('error' in auth) return auth.error
    const { user, supabase } = auth

    const { id } = await ctx.params
    const gestao = getGestaoClient(supabase)

    // Verificar se a tarefa existe e obter board_id + creator_id
    const boardId = await getTaskBoardId(supabase, id)
    if (!boardId) {
      return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 })
    }

    // Buscar creator_id da tarefa
    const { data: taskData } = await gestao
      .from('tasks')
      .select('creator_id')
      .eq('id', id)
      .single()

    // Permitir se é o criador ou admin+ do board
    const isCreator = taskData?.creator_id === user.id
    if (!isCreator) {
      const access = await requireBoardAccess(supabase, user.id, boardId, 'admin')
      if ('error' in access) {
        return NextResponse.json({ error: access.error }, { status: access.status })
      }
    }

    const { error } = await gestao
      .from('tasks')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/gestao/tasks/[id]]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
