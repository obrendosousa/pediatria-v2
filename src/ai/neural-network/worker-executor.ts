// Clara v2 Neural Network - Worker Executor
// Dispatch & collect pattern based on Claude Code's agent_tool.rs (lines 120-245)
// Handles: task creation → worker spawn → timeout → result collection → retry

import type { AgentId, ClaraTask } from './types';
import { AGENT_DEFINITIONS, DEFAULT_TASK_TIMEOUT_MS } from './types';
import { createTask, startTask, completeTask, failTask } from './task-manager';
import { executeWorkerForTask } from './worker-graph';
import { getToolsForAgent } from './tool-registry';
import { buildWorkerSystemPrompt, type WorkerPromptContext } from './worker-prompts';
import { sendMessage } from './agent-messages';
import { triggerDreamCheck } from './dream-system';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DispatchParams {
  agentId: AgentId;
  description: string;
  inputParams?: Record<string, unknown>;
  outputSchema?: string;
  parentTaskId?: string;
  timeoutMs?: number;
  context?: WorkerPromptContext;
}

interface DispatchResult {
  task: ClaraTask;
  result: Record<string, unknown> | null;
}

interface ParallelResult {
  tasks: ClaraTask[];
  results: Map<string, Record<string, unknown> | null>;
  failed: string[];
}

// ---------------------------------------------------------------------------
// Single Worker Dispatch (based on agent_tool.rs execute flow)
// ---------------------------------------------------------------------------

/**
 * Dispatch a worker and wait for its result.
 *
 * Flow (mirrors agent_tool.rs lines 120-245):
 * 1. createTask() in Supabase
 * 2. startTask() → status='running'
 * 3. Resolve tools via getToolsForAgent()
 * 4. Build system prompt via buildWorkerSystemPrompt()
 * 5. createWorkerGraph(config)
 * 6. Promise.race([execute, timeout])
 * 7. completeTask() or failTask()
 */
export async function dispatchAndWait(params: DispatchParams): Promise<DispatchResult> {
  const definition = AGENT_DEFINITIONS[params.agentId];
  const timeoutMs = params.timeoutMs ?? definition.timeout_ms ?? DEFAULT_TASK_TIMEOUT_MS;

  // 1. Create task in Supabase
  const task = await createTask({
    subject: params.description.slice(0, 100),
    description: params.description,
    agent_id: params.agentId,
    parent_task_id: params.parentTaskId,
    input_params: params.inputParams,
    output_schema: params.outputSchema,
    timeout_ms: timeoutMs,
  });

  // 2. Mark as running
  await startTask(task.id);
  const startTime = Date.now();

  try {
    // 3. Resolve tools (filter_tools_for_mode pattern from coordinator.rs)
    const tools = getToolsForAgent(params.agentId);

    // 4. Build worker graph config
    const config = {
      agentId: params.agentId,
      tools,
      maxIterations: definition.max_iterations,
      systemPromptBuilder: (t: ClaraTask) =>
        buildWorkerSystemPrompt(params.agentId, t, params.context),
    };

    // 5. Execute with timeout (Promise.race pattern, timer cleaned on success)
    const timeout = createTimeout(timeoutMs, task.id);
    let result: { result: Record<string, unknown> | null; messages: import('@langchain/core/messages').BaseMessage[] };
    try {
      result = await Promise.race([
        executeWorkerForTask(config, { ...task, status: 'running', started_at: new Date().toISOString() }),
        timeout.promise,
      ]);
    } finally {
      timeout.cancel();
    }

    const executionTimeMs = Date.now() - startTime;

    // 6. Complete task with result
    const outputData = result.result ?? { raw_response: 'No structured output' };
    const completed = await completeTask(task.id, outputData, {
      execution_time_ms: executionTimeMs,
      model_used: definition.model,
    });

    // Notify parent (if exists) via agent messages
    if (params.parentTaskId) {
      await sendMessage(params.agentId, 'ceo_agent', {
        task_id: task.id,
        status: 'completed',
        summary: params.description.slice(0, 200),
      }, 'result', params.parentTaskId).catch(() => {});
    }

    // Fire-and-forget dream check (don't block the response)
    triggerDreamCheck(params.agentId).catch(() => {});

    return { task: completed, result: outputData };

  } catch (error) {
    const executionTimeMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    // 7. Fail task (with retry logic from tasks.rs)
    const failed = await failTask(task.id, errorMessage);

    // No recursive retry — just mark as failed.
    // CEO Agent or the caller can re-dispatch manually if needed.

    // Notify parent of failure
    if (params.parentTaskId) {
      await sendMessage(params.agentId, 'ceo_agent', {
        task_id: task.id,
        status: 'failed',
        error: errorMessage,
        execution_time_ms: executionTimeMs,
      }, 'error', params.parentTaskId).catch(() => {});
    }

    return { task: failed, result: null };
  }
}

/**
 * Dispatch a worker (fire-and-forget). Returns task immediately.
 * Use getTask() or waitForTask() to poll result later.
 */
export async function dispatchWorker(params: DispatchParams): Promise<ClaraTask> {
  const definition = AGENT_DEFINITIONS[params.agentId];
  const timeoutMs = params.timeoutMs ?? definition.timeout_ms ?? DEFAULT_TASK_TIMEOUT_MS;

  const task = await createTask({
    subject: params.description.slice(0, 100),
    description: params.description,
    agent_id: params.agentId,
    parent_task_id: params.parentTaskId,
    input_params: params.inputParams,
    output_schema: params.outputSchema,
    timeout_ms: timeoutMs,
  });

  // Fire-and-forget execution
  executeInBackground(task, params).catch((err) => {
    console.error(`[worker-executor] Background execution failed for task ${task.id}:`, err);
  });

  return task;
}

// ---------------------------------------------------------------------------
// Parallel Dispatch (coordinator Research Phase pattern)
// ---------------------------------------------------------------------------

/**
 * Dispatch multiple workers in parallel and collect all results.
 * Uses Promise.allSettled() so one failure doesn't abort others.
 *
 * Based on coordinator system prompt's Research Phase:
 * "Spawn workers to gather information in parallel"
 */
export async function dispatchParallel(workers: DispatchParams[]): Promise<ParallelResult> {
  const settled = await Promise.allSettled(
    workers.map(w => dispatchAndWait(w))
  );

  const tasks: ClaraTask[] = [];
  const results = new Map<string, Record<string, unknown> | null>();
  const failed: string[] = [];

  for (let i = 0; i < settled.length; i++) {
    const outcome = settled[i];
    if (outcome.status === 'fulfilled') {
      tasks.push(outcome.value.task);
      results.set(outcome.value.task.id, outcome.value.result);
      if (outcome.value.task.status === 'failed') {
        failed.push(outcome.value.task.id);
      }
    } else {
      // Promise itself rejected (shouldn't happen with our error handling, but just in case)
      failed.push(`worker_${i}_rejected`);
    }
  }

  return { tasks, results, failed };
}

// ---------------------------------------------------------------------------
// Internal Helpers
// ---------------------------------------------------------------------------

async function executeInBackground(task: ClaraTask, params: DispatchParams): Promise<void> {
  const definition = AGENT_DEFINITIONS[params.agentId];
  await startTask(task.id);
  const startTime = Date.now();

  try {
    const tools = getToolsForAgent(params.agentId);
    const config = {
      agentId: params.agentId,
      tools,
      maxIterations: definition.max_iterations,
      systemPromptBuilder: (t: ClaraTask) =>
        buildWorkerSystemPrompt(params.agentId, t, params.context),
    };

    const timeoutMs = task.timeout_ms ?? DEFAULT_TASK_TIMEOUT_MS;
    const bgTimeout = createTimeout(timeoutMs, task.id);
    const result = await Promise.race([
      executeWorkerForTask(config, { ...task, status: 'running', started_at: new Date().toISOString() }),
      bgTimeout.promise,
    ]);
    bgTimeout.cancel();

    await completeTask(task.id, result.result ?? { raw_response: 'No output' }, {
      execution_time_ms: Date.now() - startTime,
      model_used: definition.model,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await failTask(task.id, errorMessage);
  }
}

function createTimeout(
  ms: number,
  taskId: string
): { promise: Promise<never>; cancel: () => void } {
  let timer: ReturnType<typeof setTimeout>;
  const promise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Task ${taskId} timed out after ${ms}ms`)), ms);
  });
  return { promise, cancel: () => clearTimeout(timer!) };
}
