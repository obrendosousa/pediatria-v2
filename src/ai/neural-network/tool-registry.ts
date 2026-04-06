// Clara v2 Neural Network - Tool Registry
// Segregates tools by agent role (coordinator vs worker) and sector
// Based on Claude Code's coordinator.rs filter_tools_for_mode pattern

import type { DynamicStructuredTool } from '@langchain/core/tools';
import type { AgentId } from './types';
import { AGENT_DEFINITIONS } from './types';

// Clara core tools
import {
  readBrainFilesTool,
  updateBrainFileTool,
  manageLongTermMemoryTool,
  saveAuthoritativeKnowledgeTool,
  manageChatNotesTool,
  searchKnowledgeBaseTool,
  saveReportTool,
  generateDeepReportTool,
  executeSqlTool,
  getVolumeMetricsTool,
  getDailyKpisTool,
  scheduleTaskTool,
  listScheduledTasksTool,
  cancelScheduledTaskTool,
  criarAgendamentoTool,
  updateChatClassificationTool,
  analisarChatEspecificoTool,
} from '@/ai/clara/tools';

import { analyzeRawConversationsTool } from '@/ai/clara/raw_data_analyzer';

// Vault tools
import {
  claraVaultTools,
} from '@/ai/vault/tools';

// Analyst tools
import {
  getFilteredChatsListTool,
  getChatCascadeHistoryTool,
  getAggregatedInsightsTool,
} from '@/ai/analyst/tools';

// ---------------------------------------------------------------------------
// Tool Name Constants (from coordinator.rs pattern)
// ---------------------------------------------------------------------------

/** Tools ONLY the coordinator (CEO Agent) can use. Workers are blocked.
 * These will be implemented as LangGraph tools in Phase 3 (CEO Agent graph).
 * Exported for use in worker-graph.ts ban list validation.
 */
export const COORDINATOR_ONLY_TOOLS = [
  'dispatch_worker',
  'read_agent_report',
  'send_directive',
  'aggregate_results',
  'manage_tasks',
  'generate_deep_report',
] as const;

/**
 * Tools banned from the coordinator in DISPATCH mode (cross_sector/single_sector).
 * In SIMPLE mode, the CEO can use KPIs/SQL directly — the ban is enforced at
 * the graph node level, not the tool registry level.
 * Only chat-analysis tools remain permanently banned (always delegate).
 */
const COORDINATOR_BANNED_TOOLS = [
  'get_filtered_chats_list',
  'get_chat_cascade_history',
  'get_aggregated_insights',
  'analisar_chat_especifico',
  'update_chat_classification',
] as const;

/** Tools ALL workers are banned from using. */
const WORKER_BANNED_TOOLS = [
  'dispatch_worker',
  'read_agent_report',
  'send_directive',
  'aggregate_results',
  'manage_tasks',
  'generate_deep_report',
  'save_authoritative_knowledge',
] as const;

// ---------------------------------------------------------------------------
// Tool Pool (all available tools indexed by name)
// ---------------------------------------------------------------------------

type ToolInstance = DynamicStructuredTool;

function buildToolPool(): Map<string, ToolInstance> {
  const pool = new Map<string, ToolInstance>();

  const allTools: ToolInstance[] = [
    // Clara core
    readBrainFilesTool,
    updateBrainFileTool,
    manageLongTermMemoryTool,
    saveAuthoritativeKnowledgeTool,
    manageChatNotesTool,
    searchKnowledgeBaseTool,
    saveReportTool,
    generateDeepReportTool,
    executeSqlTool,
    getVolumeMetricsTool,
    getDailyKpisTool,
    scheduleTaskTool,
    listScheduledTasksTool,
    cancelScheduledTaskTool,
    criarAgendamentoTool,
    updateChatClassificationTool,
    analisarChatEspecificoTool,
    analyzeRawConversationsTool,
    // Analyst
    getFilteredChatsListTool,
    getChatCascadeHistoryTool,
    getAggregatedInsightsTool,
    // Vault
    ...claraVaultTools,
  ];

  for (const tool of allTools) {
    pool.set(tool.name, tool);
  }

  return pool;
}

let _toolPool: Map<string, ToolInstance> | null = null;
function getToolPool(): Map<string, ToolInstance> {
  if (!_toolPool) _toolPool = buildToolPool();
  return _toolPool;
}

// ---------------------------------------------------------------------------
// Per-Agent Tool Allowlists
// ---------------------------------------------------------------------------

/** Shared tools available to all workers (read-only knowledge + report saving) */
const WORKER_COMMON_TOOLS = [
  'execute_sql',
  'save_report',
  'vault_read',
  'vault_search',
  'vault_semantic_search',
  'read_brain_files',
  'vault_write_memory',
  'vault_log_decision',
  'search_knowledge_base',
  'manage_long_term_memory',
  'manage_chat_notes',
] as const;

const SECTOR_TOOLS: Record<AgentId, readonly string[]> = {
  ceo_agent: [
    // Knowledge & config
    'read_brain_files',
    'update_brain_file',
    'search_knowledge_base',
    'vault_read',
    'vault_search',
    'vault_semantic_search',
    'vault_log_decision',
    'vault_write_memory',
    'manage_long_term_memory',
    'manage_chat_notes',
    // Reports
    'save_report',
    'generate_deep_report',
    // Scheduling
    'schedule_task',
    'list_scheduled_tasks',
    'cancel_scheduled_task',
    // Data tools (used in simple_answer mode, delegated in dispatch mode)
    'get_daily_kpis',
    'get_volume_metrics',
    'execute_sql',
    // User interaction
    'ask_user_question',
  ],
  pediatria_agent: [
    ...WORKER_COMMON_TOOLS,
    'get_volume_metrics',
    'get_daily_kpis',
  ],
  clinica_geral_agent: [
    ...WORKER_COMMON_TOOLS,
    'get_volume_metrics',
    'get_daily_kpis',
  ],
  recepcao_agent: [
    ...WORKER_COMMON_TOOLS,
    'get_volume_metrics',
    'get_daily_kpis',
    'get_filtered_chats_list',
    'get_chat_cascade_history',
    'get_aggregated_insights',
    'analisar_chat_especifico',
    'update_chat_classification',
  ],
  financeiro_agent: [
    ...WORKER_COMMON_TOOLS,
    'get_volume_metrics',
    'get_daily_kpis',
  ],
  comercial_agent: [
    ...WORKER_COMMON_TOOLS,
    'get_volume_metrics',
    'get_daily_kpis',
    'get_filtered_chats_list',
    'get_chat_cascade_history',
    'get_aggregated_insights',
    'analisar_chat_especifico',
  ],
  estoque_agent: [
    ...WORKER_COMMON_TOOLS,
  ],
  rh_ops_agent: [
    ...WORKER_COMMON_TOOLS,
  ],
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get filtered tools for a specific agent.
 * Mirrors coordinator.rs filter_tools_for_mode():
 * - Coordinator gets coordinator-specific tools, banned from data tools
 * - Workers get sector-specific tools, banned from coordination tools
 */
export function getToolsForAgent(agentId: AgentId): ToolInstance[] {
  const pool = getToolPool();
  const definition = AGENT_DEFINITIONS[agentId];
  const allowedNames = SECTOR_TOOLS[agentId] ?? [];

  const bannedSet = new Set<string>(
    definition.role === 'coordinator'
      ? COORDINATOR_BANNED_TOOLS
      : WORKER_BANNED_TOOLS
  );

  const tools: ToolInstance[] = [];

  for (const name of allowedNames) {
    if (bannedSet.has(name)) continue;
    const tool = pool.get(name);
    if (tool) tools.push(tool);
  }

  return tools;
}

/**
 * Check if a specific tool is allowed for an agent.
 */
export function isToolAllowed(agentId: AgentId, toolName: string): boolean {
  const definition = AGENT_DEFINITIONS[agentId];
  const allowedNames = SECTOR_TOOLS[agentId] ?? [];

  const bannedSet = new Set<string>(
    definition.role === 'coordinator'
      ? COORDINATOR_BANNED_TOOLS
      : WORKER_BANNED_TOOLS
  );

  return allowedNames.includes(toolName) && !bannedSet.has(toolName);
}

/**
 * Get tool names available for an agent (useful for system prompt injection).
 */
export function getToolNamesForAgent(agentId: AgentId): string[] {
  return getToolsForAgent(agentId).map(t => t.name);
}
