import path from "node:path";

// ═══════════════════════════════════════════════════════════════════════════
// VAULT CONFIG — Configuracao central do Obsidian Vault
// ═══════════════════════════════════════════════════════════════════════════

/** Caminho raiz do vault no disco */
export const VAULT_ROOT = path.join(process.cwd(), "clinica-vault");

/** Feature flag para desabilitar vault sem quebrar nada */
export const VAULT_ENABLED = process.env.VAULT_ENABLED !== "false";

/** Folders do vault */
export const VAULT_FOLDERS = {
  META: "_meta",
  INBOX: "inbox",
  DAILY: "daily",
  AGENTS: "agents",
  KNOWLEDGE: "knowledge",
  MEMORIES: "memories",
  REPORTS: "reports",
  DECISIONS: "decisions",
  CHAT_NOTES: "chat-notes",
  GRAPHS: "graphs",
} as const;

/** Sub-folders de agents */
export const AGENT_FOLDERS = {
  CLARA: "agents/clara",
  ANALYST: "agents/analyst",
  COPILOT: "agents/copilot",
} as const;

/** Mapeamento agent_config key -> arquivo no vault */
export const CONFIG_KEY_TO_FILE: Record<string, string> = {
  company: "agents/clara/company.md",
  rules: "agents/clara/rules.md",
  voice_rules: "agents/clara/voice-rules.md",
};

/** Mapeamento de categoria do knowledge_base -> folder no vault */
export const KB_CATEGORY_TO_FOLDER: Record<string, string> = {
  clinica: "knowledge/clinical",
  clinical: "knowledge/clinical",
  pediatria: "knowledge/clinical",
  operacional: "knowledge/operations",
  operations: "knowledge/operations",
  copiloto_feedback: "knowledge/operations",
  tecnico: "knowledge/technical",
  technical: "knowledge/technical",
};

/** Limites */
export const VAULT_LIMITS = {
  /** Max notas retornadas em busca full-text */
  MAX_SEARCH_RESULTS: 20,
  /** Max notas listadas por folder */
  MAX_LIST_RESULTS: 50,
  /** Debounce em ms para sync bidirecional */
  SYNC_DEBOUNCE_MS: 5000,
} as const;
