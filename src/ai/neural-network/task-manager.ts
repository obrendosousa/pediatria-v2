// Clara v2 Neural Network - Task Manager
// CRUD for clara_tasks table (Supabase-backed TaskStore)
// Based on Claude Code's tasks.rs pattern

import { getSupabaseAdminClient } from '@/lib/automation/adapters/supabaseAdmin';
import type { ClaraTask, CreateTaskInput, TaskFilters } from './types';

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createTask(params: CreateTaskInput): Promise<ClaraTask> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from('clara_tasks')
    .insert({
      subject: params.subject,
      description: params.description,
      agent_id: params.agent_id,
      parent_task_id: params.parent_task_id ?? null,
      blocked_by: params.blocked_by ?? [],
      blocks: params.blocks ?? [],
      input_params: params.input_params ?? null,
      output_schema: params.output_schema ?? null,
      max_retries: params.max_retries ?? 2,
      timeout_ms: params.timeout_ms ?? 120_000,
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create task: ${error.message}`);
  return data as ClaraTask;
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function getTask(taskId: string): Promise<ClaraTask | null> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from('clara_tasks')
    .select()
    .eq('id', taskId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // not found
    throw new Error(`Failed to get task: ${error.message}`);
  }
  return data as ClaraTask;
}

export async function listTasks(filters?: TaskFilters): Promise<ClaraTask[]> {
  const supabase = getSupabaseAdminClient();

  let query = supabase.from('clara_tasks').select();

  if (filters?.agent_id) {
    query = query.eq('agent_id', filters.agent_id);
  }

  if (filters?.status) {
    if (Array.isArray(filters.status)) {
      query = query.in('status', filters.status);
    } else {
      query = query.eq('status', filters.status);
    }
  }

  if (filters?.parent_task_id) {
    query = query.eq('parent_task_id', filters.parent_task_id);
  }

  if (!filters?.include_completed) {
    query = query.not('status', 'in', '("completed","cancelled")');
  }

  query = query.order('created_at', { ascending: false });

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list tasks: ${error.message}`);
  return (data ?? []) as ClaraTask[];
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export async function updateTask(
  taskId: string,
  updates: Partial<Pick<ClaraTask, 'status' | 'output_data' | 'error_message' | 'token_usage' | 'execution_time_ms' | 'model_used' | 'retry_count' | 'started_at' | 'completed_at'>>
): Promise<ClaraTask> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from('clara_tasks')
    .update(updates)
    .eq('id', taskId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update task: ${error.message}`);
  return data as ClaraTask;
}

export async function completeTask(
  taskId: string,
  outputData: Record<string, unknown>,
  metrics?: { token_usage?: number; execution_time_ms?: number; model_used?: string }
): Promise<ClaraTask> {
  return updateTask(taskId, {
    status: 'completed',
    output_data: outputData,
    completed_at: new Date().toISOString(),
    ...(metrics?.token_usage != null && { token_usage: metrics.token_usage }),
    ...(metrics?.execution_time_ms != null && { execution_time_ms: metrics.execution_time_ms }),
    ...(metrics?.model_used != null && { model_used: metrics.model_used }),
  });
}

export async function failTask(taskId: string, errorMessage: string): Promise<ClaraTask> {
  return updateTask(taskId, {
    status: 'failed',
    error_message: errorMessage,
    completed_at: new Date().toISOString(),
  });
}

export async function cancelTask(taskId: string, reason: string): Promise<ClaraTask> {
  return updateTask(taskId, {
    status: 'cancelled',
    error_message: reason,
    completed_at: new Date().toISOString(),
  });
}

export async function startTask(taskId: string): Promise<ClaraTask> {
  return updateTask(taskId, {
    status: 'running',
    started_at: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Dependency Helpers (from tasks.rs blocks/blocked_by pattern)
// ---------------------------------------------------------------------------

export async function arePrerequisitesMet(taskId: string): Promise<boolean> {
  const task = await getTask(taskId);
  if (!task || task.blocked_by.length === 0) return true;

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('clara_tasks')
    .select('id, status')
    .in('id', task.blocked_by);

  if (error) throw new Error(`Failed to check prerequisites: ${error.message}`);

  return (data ?? []).every(
    (t: { status: string }) => t.status === 'completed'
  );
}

export async function getBlockedTasks(taskId: string): Promise<ClaraTask[]> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from('clara_tasks')
    .select()
    .contains('blocked_by', [taskId]);

  if (error) throw new Error(`Failed to get blocked tasks: ${error.message}`);
  return (data ?? []) as ClaraTask[];
}

// ---------------------------------------------------------------------------
// Wait for Task (polling with timeout)
// Based on tasks.rs TaskOutputTool blocking behavior
// ---------------------------------------------------------------------------

export async function waitForTask(
  taskId: string,
  timeoutMs: number = 120_000
): Promise<ClaraTask> {
  const pollInterval = 1_000;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const task = await getTask(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);

    if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
      return task;
    }

    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  throw new Error(`Task ${taskId} timed out after ${timeoutMs}ms`);
}
