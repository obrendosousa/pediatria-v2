// Clara v2 Neural Network - Comercial Agent (Worker)
// Especialista comercial: funil de conversao, objecoes, retencao, automacoes

import type { WorkerGraphConfig } from '../worker-graph';
import { getToolsForAgent } from '../tool-registry';
import { buildWorkerSystemPrompt, type WorkerPromptContext } from '../worker-prompts';
import type { ClaraTask } from '../types';

export function createComercialConfig(
  context?: WorkerPromptContext
): WorkerGraphConfig {
  return {
    agentId: 'comercial_agent',
    tools: getToolsForAgent('comercial_agent'),
    maxIterations: 8,
    systemPromptBuilder: (task: ClaraTask) =>
      buildWorkerSystemPrompt('comercial_agent', task, context),
  };
}
