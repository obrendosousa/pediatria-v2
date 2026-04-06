// Clara v2 Neural Network - CEO Tools
// Tools available to the CEO Agent in simple_answer mode
// Re-exports filtered tools from tool-registry for convenience

import { getToolsForAgent } from './tool-registry';

/**
 * Tools for the CEO Agent's simple_answer node.
 * Includes KPIs, SQL, vault, reports — everything the CEO
 * can use directly without dispatching workers.
 */
export function getCeoSimpleTools() {
  return getToolsForAgent('ceo_agent');
}
