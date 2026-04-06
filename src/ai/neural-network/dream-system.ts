// Clara v2 Neural Network - Dream System
// Per-agent background memory consolidation with 3-gate trigger
// Adapted from Claude Code's auto_dream.rs

import { getSupabaseAdminClient } from '@/lib/automation/adapters/supabaseAdmin';
import type { AgentId } from './types';
import { AGENT_DEFINITIONS, DREAM_LOCK_STALENESS_MS } from './types';
import { buildDreamPrompt } from './dream-prompts';
// worker-executor used indirectly via createWorkerGraph
import { getToolsForAgent } from './tool-registry';
import { createWorkerGraph } from './worker-graph';
import { HumanMessage } from '@langchain/core/messages';

// ---------------------------------------------------------------------------
// Dream Config per Agent (from PRD section 4.2)
// ---------------------------------------------------------------------------

interface DreamConfig {
  min_hours: number;
  min_sessions: number;
}

const DREAM_CONFIG: Record<AgentId, DreamConfig> = {
  ceo_agent:           { min_hours: 24, min_sessions: 3 },
  pediatria_agent:     { min_hours: 48, min_sessions: 5 },
  clinica_geral_agent: { min_hours: 48, min_sessions: 5 },
  recepcao_agent:      { min_hours: 24, min_sessions: 10 },
  financeiro_agent:    { min_hours: 24, min_sessions: 3 },
  comercial_agent:     { min_hours: 24, min_sessions: 5 },
  estoque_agent:       { min_hours: 72, min_sessions: 3 },
  rh_ops_agent:        { min_hours: 72, min_sessions: 3 },
};

// ---------------------------------------------------------------------------
// Dream State (Supabase-backed, replaces file-based locks from auto_dream.rs)
// ---------------------------------------------------------------------------

interface DreamState {
  id: string;
  last_consolidated_at: string | null;
  lock_acquired_at: string | null;
  lock_acquired_by: string | null;
  session_count: number;
}

async function loadDreamState(agentId: string): Promise<DreamState> {
  const supabase = getSupabaseAdminClient();
  const { data } = await supabase
    .from('clara_dream_state')
    .select()
    .eq('id', agentId)
    .single();

  if (data) return data as DreamState;

  // First time: create initial state
  const { data: created } = await supabase
    .from('clara_dream_state')
    .insert({ id: agentId, session_count: 0 })
    .select()
    .single();

  return (created ?? { id: agentId, last_consolidated_at: null, lock_acquired_at: null, lock_acquired_by: null, session_count: 0 }) as DreamState;
}

async function updateDreamState(agentId: string, updates: Partial<DreamState>): Promise<void> {
  const supabase = getSupabaseAdminClient();
  await supabase
    .from('clara_dream_state')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', agentId);
}

// ---------------------------------------------------------------------------
// 3-Gate System (cheapest-first, exactly like auto_dream.rs)
// ---------------------------------------------------------------------------

/**
 * Gate 1: Time — cheapest check (1 arithmetic operation)
 * Has enough time elapsed since last consolidation?
 */
function timeGatePasses(state: DreamState, config: DreamConfig): boolean {
  if (!state.last_consolidated_at) return true; // Never dreamed → always pass

  const lastMs = new Date(state.last_consolidated_at).getTime();
  const hoursElapsed = (Date.now() - lastMs) / 3_600_000;
  return hoursElapsed >= config.min_hours;
}

/**
 * Gate 2: Sessions — counts completed tasks since last dream (1 query)
 * Enough new work has happened to justify consolidation?
 */
async function sessionGatePasses(agentId: string, state: DreamState, config: DreamConfig): Promise<boolean> {
  const supabase = getSupabaseAdminClient();
  const since = state.last_consolidated_at ?? '1970-01-01T00:00:00Z';

  const { count } = await supabase
    .from('clara_tasks')
    .select('*', { count: 'exact', head: true })
    .eq('agent_id', agentId)
    .eq('status', 'completed')
    .gt('completed_at', since);

  return (count ?? 0) >= config.min_sessions;
}

/**
 * Gate 3: Lock — no other process mid-consolidation (1 query)
 * Stale locks (>1 hour) are treated as released.
 */
function lockGatePasses(state: DreamState): boolean {
  if (!state.lock_acquired_at) return true;

  const lockAge = Date.now() - new Date(state.lock_acquired_at).getTime();
  return lockAge > DREAM_LOCK_STALENESS_MS; // >1h = stale, treat as released
}

// ---------------------------------------------------------------------------
// Lock Management (atomic via Supabase)
// ---------------------------------------------------------------------------

async function acquireLock(agentId: string): Promise<boolean> {
  const supabase = getSupabaseAdminClient();
  const processId = `dream_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();

  // Step 1: Check lock state
  const state = await loadDreamState(agentId);

  // If locked and not stale, fail
  if (state.lock_acquired_at) {
    const lockAge = Date.now() - new Date(state.lock_acquired_at).getTime();
    if (lockAge < DREAM_LOCK_STALENESS_MS) return false; // Lock is active
    // Lock is stale — proceed to acquire
  }

  // Step 2: Try to acquire (check-and-set pattern)
  const { data, error } = await supabase
    .from('clara_dream_state')
    .update({
      lock_acquired_at: now,
      lock_acquired_by: processId,
      updated_at: now,
    })
    .eq('id', agentId)
    .select()
    .single();

  if (error || !data) return false;

  // Step 3: Verify we own the lock (re-read to detect race)
  const verify = await loadDreamState(agentId);
  return verify.lock_acquired_by === processId;
}

async function releaseLock(agentId: string): Promise<void> {
  await updateDreamState(agentId, {
    lock_acquired_at: null,
    lock_acquired_by: null,
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check all 3 gates for an agent. Returns true if agent should dream.
 */
export async function shouldDream(agentId: AgentId): Promise<boolean> {
  const config = DREAM_CONFIG[agentId];
  if (!config) return false;

  const state = await loadDreamState(agentId);

  // Gate 1: Time (cheapest)
  if (!timeGatePasses(state, config)) return false;

  // Gate 2: Sessions (1 DB query)
  if (!await sessionGatePasses(agentId, state, config)) return false;

  // Gate 3: Lock (already loaded)
  if (!lockGatePasses(state)) return false;

  return true;
}

/**
 * Execute a dream cycle for an agent.
 * Acquires lock, runs 4-phase consolidation via worker graph, releases lock.
 */
export async function executeDream(agentId: AgentId): Promise<{ success: boolean; error?: string }> {
  const locked = await acquireLock(agentId);
  if (!locked) return { success: false, error: 'Could not acquire lock' };

  const startTime = Date.now();

  try {
    const dreamPrompt = buildDreamPrompt(agentId);

    // Dream uses a subset of tools (read-only + vault write)
    const tools = getToolsForAgent(agentId);
    const config = {
      agentId,
      tools,
      maxIterations: 6, // Dreams are shorter than normal tasks
      systemPromptBuilder: () => dreamPrompt,
    };

    const graph = createWorkerGraph(config);
    await graph.invoke({
      messages: [new HumanMessage('Execute seu ciclo de sonho. Siga as 4 fases descritas no system prompt.')],
      task: {
        id: `dream_${agentId}_${Date.now()}`,
        description: `Dream cycle for ${agentId}`,
        agent_id: agentId,
        status: 'running',
      },
      agent_id: agentId,
      iteration: 0,
      result: null,
    });

    // Update state: last_consolidated_at = now
    await updateDreamState(agentId, {
      last_consolidated_at: new Date().toISOString(),
    });

    const executionMs = Date.now() - startTime;
    console.log(`[dream] ${agentId} dreamed in ${executionMs}ms`);

    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[dream] ${agentId} dream failed:`, msg);
    return { success: false, error: msg };
  } finally {
    await releaseLock(agentId);
  }
}

/**
 * Check gates and execute dream if conditions met.
 * Fire-and-forget safe — catches all errors.
 */
export async function triggerDreamCheck(agentId: AgentId): Promise<{ dreamed: boolean; reason: string }> {
  try {
    const should = await shouldDream(agentId);
    if (!should) return { dreamed: false, reason: 'Gates not met' };

    const result = await executeDream(agentId);
    return { dreamed: result.success, reason: result.error ?? 'OK' };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { dreamed: false, reason: msg };
  }
}

/**
 * Check all agents and trigger dreams for those that qualify.
 * Used by the dream-check cron route.
 */
export async function runDreamCheckForAll(): Promise<{
  agents_checked: number;
  agents_dreamed: string[];
  agents_skipped: string[];
  errors: Array<{ agent_id: string; error: string }>;
}> {
  const allAgents = Object.keys(AGENT_DEFINITIONS) as AgentId[];
  const results = {
    agents_checked: allAgents.length,
    agents_dreamed: [] as string[],
    agents_skipped: [] as string[],
    errors: [] as Array<{ agent_id: string; error: string }>,
  };

  // Check each agent sequentially (dreams are heavy, don't parallelize)
  for (const agentId of allAgents) {
    const { dreamed, reason } = await triggerDreamCheck(agentId);
    if (dreamed) {
      results.agents_dreamed.push(agentId);
    } else if (reason.includes('Gates not met')) {
      results.agents_skipped.push(agentId);
    } else {
      results.errors.push({ agent_id: agentId, error: reason });
    }
  }

  return results;
}
