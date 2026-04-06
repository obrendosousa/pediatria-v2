// Clara v2 Neural Network - Model Selector
// Penguin Mode adapted: selects model based on agent role and task complexity
// Based on Claude Code's effort.rs

import { AGENT_DEFINITIONS, type AgentId, type EffortLevel, type ModelConfig } from './types';

// ---------------------------------------------------------------------------
// Model Catalog
// ---------------------------------------------------------------------------

const MODELS = {
  pro: 'gemini-3-flash-preview',  // flash until pro quota resolved
  flash: 'gemini-3-flash-preview',
  flash_lite: 'gemini-3.1-flash-lite-preview',
} as const;

const EFFORT_CONFIGS: Record<EffortLevel, Omit<ModelConfig, 'model'>> = {
  low: {
    temperature: 0,
    maxOutputTokens: 4_096,
  },
  medium: {
    temperature: 0.1,
    maxOutputTokens: 8_192,
  },
  high: {
    temperature: 0,
    maxOutputTokens: 16_384,
  },
};

// ---------------------------------------------------------------------------
// Effort Detection
// ---------------------------------------------------------------------------

const SIMPLE_QUERY_PATTERNS = [
  /^(qual|quanto|quantos|quantas)\s/i,
  /^(me (diga|fala|mostra))\s/i,
  /total\s+de\s/i,
  /^lista(r|e)?\s/i,
  /^busca(r)?\s/i,
];

const COMPLEX_QUERY_PATTERNS = [
  /por\s*que/i,
  /compar(e|ar|ativo)/i,
  /analis(e|ar)/i,
  /tend[eê]ncia/i,
  /correla[cç]/i,
  /estrat[eé]g/i,
  /recomend/i,
  /diagn[oó]stic/i,
  /todos?\s+(os|as)\s/i,
  /\d{4,}\s+(conversa|chat|paciente)/i,  // large volume references
];

export function getEffortLevel(taskDescription: string): EffortLevel {
  const desc = taskDescription.toLowerCase();

  if (COMPLEX_QUERY_PATTERNS.some(p => p.test(desc))) return 'high';
  if (SIMPLE_QUERY_PATTERNS.some(p => p.test(desc))) return 'low';
  return 'medium';
}

// ---------------------------------------------------------------------------
// Model Selection
// ---------------------------------------------------------------------------

export function selectModel(agentId: AgentId, taskDescription?: string): ModelConfig {
  const definition = AGENT_DEFINITIONS[agentId];

  // Coordinator (CEO Agent): Pro for complex, Flash for simple
  if (definition.role === 'coordinator') {
    const effort = taskDescription ? getEffortLevel(taskDescription) : 'high';

    if (effort === 'low') {
      return { model: MODELS.flash, ...EFFORT_CONFIGS.low };
    }
    return { model: MODELS.pro, ...EFFORT_CONFIGS.high };
  }

  // Workers: use their defined model, adjust effort based on task
  const effort = taskDescription ? getEffortLevel(taskDescription) : 'medium';
  const effortConfig = EFFORT_CONFIGS[effort];

  // Flash Lite agents stay on Flash Lite regardless of effort
  if (definition.model === MODELS.flash_lite) {
    return { model: MODELS.flash_lite, ...effortConfig };
  }

  // Flash agents can downgrade to Flash Lite for batch/simple tasks
  if (effort === 'low' && definition.model === MODELS.flash) {
    return { model: MODELS.flash_lite, ...EFFORT_CONFIGS.low };
  }

  return { model: definition.model, ...effortConfig };
}

// ---------------------------------------------------------------------------
// Convenience
// ---------------------------------------------------------------------------

export function getModelDisplayName(model: string): string {
  if (model.includes('pro')) return 'Gemini Pro';
  if (model.includes('flash-lite') || model.includes('flash_lite')) return 'Gemini Flash Lite';
  if (model.includes('flash')) return 'Gemini Flash';
  return model;
}
