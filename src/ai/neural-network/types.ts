// Clara v2 Neural Network - Central Types & Constants
// Based on Claude Code's coordinator.rs + effort.rs patterns

// ---------------------------------------------------------------------------
// Agent Identity
// ---------------------------------------------------------------------------

export type AgentId =
  | 'ceo_agent'
  | 'pediatria_agent'
  | 'clinica_geral_agent'
  | 'recepcao_agent'
  | 'financeiro_agent'
  | 'comercial_agent'
  | 'estoque_agent'
  | 'rh_ops_agent';

export type AgentRole = 'coordinator' | 'worker';

// ---------------------------------------------------------------------------
// Task Management
// ---------------------------------------------------------------------------

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface ClaraTask {
  id: string;
  subject: string;
  description: string;
  agent_id: AgentId;
  parent_task_id: string | null;
  status: TaskStatus;
  blocked_by: string[];
  blocks: string[];
  input_params: Record<string, unknown> | null;
  output_data: Record<string, unknown> | null;
  output_schema: string | null;
  error_message: string | null;
  token_usage: number;
  execution_time_ms: number | null;
  model_used: string | null;
  max_retries: number;
  retry_count: number;
  timeout_ms: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface CreateTaskInput {
  subject: string;
  description: string;
  agent_id: AgentId;
  parent_task_id?: string;
  blocked_by?: string[];
  blocks?: string[];
  input_params?: Record<string, unknown>;
  output_schema?: string;
  max_retries?: number;
  timeout_ms?: number;
}

export interface TaskFilters {
  agent_id?: AgentId;
  status?: TaskStatus | TaskStatus[];
  parent_task_id?: string;
  include_completed?: boolean;
}

// ---------------------------------------------------------------------------
// Inter-Agent Messages
// ---------------------------------------------------------------------------

export type MessageType = 'directive' | 'result' | 'error' | 'status_update';

export interface AgentMessage {
  id: string;
  from_agent: string;
  to_agent: string;
  task_id: string | null;
  message_type: MessageType;
  content: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export type ReportType = 'daily' | 'weekly' | 'monthly' | 'on_demand';

// ---------------------------------------------------------------------------
// Effort / Model Selection
// ---------------------------------------------------------------------------

export type EffortLevel = 'low' | 'medium' | 'high';

export interface ModelConfig {
  model: string;
  temperature: number;
  maxOutputTokens: number;
}

// ---------------------------------------------------------------------------
// Agent Definitions
// ---------------------------------------------------------------------------

export interface AgentDefinition {
  id: AgentId;
  name: string;
  role: AgentRole;
  model: string;
  temperature: number;
  description: string;
  schema_access: string[];
  max_iterations: number;
  timeout_ms: number;
}

export const AGENT_DEFINITIONS: Record<AgentId, AgentDefinition> = {
  ceo_agent: {
    id: 'ceo_agent',
    name: 'CEO Agent (Clara Global)',
    role: 'coordinator',
    model: 'gemini-3-flash-preview',  // flash until pro quota issue resolved
    temperature: 0,
    description: 'Agente global do CEO. Orquestra workers, sintetiza resultados cross-setor.',
    schema_access: ['clara_tasks', 'clara_agent_messages', 'clara_agent_reports', 'agent_config', 'clara_memories', 'knowledge_base'],
    max_iterations: 3,
    timeout_ms: 300_000,
  },
  pediatria_agent: {
    id: 'pediatria_agent',
    name: 'Pediatria Agent',
    role: 'worker',
    model: 'gemini-3-flash-preview',
    temperature: 0.1,
    description: 'Especialista em dados pediatricos: consultas, curvas de crescimento, protocolos.',
    schema_access: ['patients', 'appointments', 'medical_records', 'anthropometry_entries', 'growth_standards', 'patient_cids', 'patient_allergies', 'anamneses', 'clinical_evolutions', 'medical_certificates', 'medical_reports', 'exam_results', 'therapeutic_plans', 'procedures', 'clinical_protocols'],
    max_iterations: 8,
    timeout_ms: 180_000,
  },
  clinica_geral_agent: {
    id: 'clinica_geral_agent',
    name: 'Clinica Geral Agent',
    role: 'worker',
    model: 'gemini-3-flash-preview',
    temperature: 0.1,
    description: 'Especialista em clinica geral: produtividade por profissional, procedimentos, orcamentos.',
    schema_access: ['appointments', 'medical_records', 'medical_checkouts', 'doctors', 'professionals', 'professional_procedures', 'procedures', 'clinical_evolutions', 'anamneses', 'budgets', 'budget_items'],
    max_iterations: 8,
    timeout_ms: 180_000,
  },
  recepcao_agent: {
    id: 'recepcao_agent',
    name: 'Recepcao Agent',
    role: 'worker',
    model: 'gemini-3-flash-preview',
    temperature: 0.1,
    description: 'Especialista em recepcao: conversas WhatsApp, tempo de resposta, funil de atendimento.',
    schema_access: ['chats', 'chat_messages', 'appointments', 'tasks', 'macros', 'saved_call_messages'],
    max_iterations: 8,
    timeout_ms: 180_000,
  },
  financeiro_agent: {
    id: 'financeiro_agent',
    name: 'Financeiro Agent',
    role: 'worker',
    model: 'gemini-3-flash-preview',
    temperature: 0.1,
    description: 'Especialista financeiro: transacoes, fechamentos, DRE, ticket medio, margens.',
    schema_access: ['financial_transactions', 'financial_transaction_payments', 'financial_daily_closures', 'sales', 'sale_items', 'medical_checkouts', 'checkout_items', 'budgets', 'budget_items', 'invoices'],
    max_iterations: 8,
    timeout_ms: 180_000,
  },
  comercial_agent: {
    id: 'comercial_agent',
    name: 'Comercial Agent',
    role: 'worker',
    model: 'gemini-3-flash-preview',
    temperature: 0.1,
    description: 'Especialista comercial: funil de conversao, objecoes, automacoes, retencao.',
    schema_access: ['chats', 'chat_messages', 'appointments', 'automation_rules', 'automation_logs', 'automation_sent_history', 'scheduled_messages', 'tasks'],
    max_iterations: 8,
    timeout_ms: 180_000,
  },
  estoque_agent: {
    id: 'estoque_agent',
    name: 'Estoque Agent',
    role: 'worker',
    model: 'gemini-3-flash-preview',
    temperature: 0.1,
    description: 'Especialista em estoque: niveis, giro, curva ABC, lotes.',
    schema_access: ['products', 'product_batches', 'stock_movements', 'sales', 'sale_items'],
    max_iterations: 8,
    timeout_ms: 180_000,
  },
  rh_ops_agent: {
    id: 'rh_ops_agent',
    name: 'RH/Ops Agent',
    role: 'worker',
    model: 'gemini-3-flash-preview',
    temperature: 0.1,
    description: 'Especialista em RH e operacoes: ocupacao de agendas, produtividade, equipe.',
    schema_access: ['professionals', 'professional_procedures', 'collaborators', 'appointments', 'doctors', 'doctor_schedules', 'schedule_overrides', 'profiles'],
    max_iterations: 8,
    timeout_ms: 180_000,
  },
} as const;

// ---------------------------------------------------------------------------
// Safety Constants (from effort.rs + coordinator.rs patterns)
// ---------------------------------------------------------------------------

export const MAX_WORKER_ITERATIONS = 8;
export const MAX_COORDINATOR_ITERATIONS = 3;
export const WORKER_TIMEOUT_MS = 180_000;
export const COORDINATOR_TIMEOUT_MS = 300_000;
export const MAX_OUTPUT_CHARS = 100_000;
export const MAX_TOOL_RESULT_CHARS = 50_000;
export const DEFAULT_MAX_RETRIES = 2;
export const DEFAULT_TASK_TIMEOUT_MS = 180_000;

// Dream System Constants (from auto_dream.rs)
export const DREAM_MIN_HOURS_DEFAULT = 24;
export const DREAM_MIN_SESSIONS_DEFAULT = 5;
export const DREAM_LOCK_STALENESS_MS = 3_600_000; // 1 hour
export const DREAM_SESSION_SCAN_INTERVAL_MS = 600_000; // 10 minutes
export const MEMORY_INDEX_MAX_LINES = 200;
export const MEMORY_INDEX_MAX_BYTES = 25_000;
