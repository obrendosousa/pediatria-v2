// Clara v2 Neural Network - Financeiro Agent (Worker)
// Especialista em dados financeiros: receita, despesas, margem, ticket medio

import type { WorkerGraphConfig } from '../worker-graph';
import { getToolsForAgent } from '../tool-registry';
import { buildWorkerSystemPrompt, type WorkerPromptContext } from '../worker-prompts';
import type { ClaraTask } from '../types';

export function createFinanceiroConfig(
  context?: WorkerPromptContext
): WorkerGraphConfig {
  return {
    agentId: 'financeiro_agent',
    tools: getToolsForAgent('financeiro_agent'),
    maxIterations: 8,
    systemPromptBuilder: (task: ClaraTask) =>
      buildWorkerSystemPrompt('financeiro_agent', task, context),
  };
}
