// Clara v2 Neural Network - Recepcao Agent (Worker)
// Especialista em recepcao: tempo de resposta, objecoes, funil de atendimento

import type { WorkerGraphConfig } from '../worker-graph';
import { getToolsForAgent } from '../tool-registry';
import { buildWorkerSystemPrompt, type WorkerPromptContext } from '../worker-prompts';
import type { ClaraTask } from '../types';

export function createRecepcaoConfig(
  context?: WorkerPromptContext
): WorkerGraphConfig {
  return {
    agentId: 'recepcao_agent',
    tools: getToolsForAgent('recepcao_agent'),
    maxIterations: 8,
    systemPromptBuilder: (task: ClaraTask) =>
      buildWorkerSystemPrompt('recepcao_agent', task, context),
  };
}
