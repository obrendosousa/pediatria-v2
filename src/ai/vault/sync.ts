import { getVaultService, isVaultAvailable } from "./service";
import { CONFIG_KEY_TO_FILE, KB_CATEGORY_TO_FOLDER } from "./config";

// ═══════════════════════════════════════════════════════════════════════════
// VAULT SYNC — Sincronizacao Supabase → Vault (dual-write)
// Cada funcao e chamada APOS o write no Supabase ter sucesso.
// Falha no vault NAO bloqueia a operacao principal (try/catch).
// ═══════════════════════════════════════════════════════════════════════════

/** Slugifica texto para nomes de arquivo */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

/**
 * Sync de memoria (clara_memories) para o vault.
 * Cria/atualiza nota em memories/{memory_type}/{slug}.md
 */
export async function syncMemoryToVault(
  supabaseId: number,
  memoryType: string,
  content: string,
  sourceRole: string = "system"
): Promise<void> {
  if (!(await isVaultAvailable())) return;

  try {
    const vault = getVaultService();
    const slug = slugify(content.slice(0, 80));
    const typeFolder = slugify(memoryType);
    const relativePath = `memories/${typeFolder}/${slug}.md`;
    const now = new Date().toISOString();

    await vault.writeNote(relativePath, content, {
      type: "memory",
      memory_type: memoryType,
      source_role: sourceRole,
      supabase_id: supabaseId,
      created_at: now,
      updated_at: now,
      tags: [],
      agent_source: "clara",
    });
  } catch (err) {
    console.warn("[Vault Sync] Falha ao sincronizar memoria:", (err as Error).message);
  }
}

/**
 * Sync de config (agent_config) para o vault.
 * Escreve em agents/clara/{module}.md
 */
export async function syncConfigToVault(
  module: string,
  content: string
): Promise<void> {
  if (!(await isVaultAvailable())) return;

  try {
    const vault = getVaultService();
    const relativePath = CONFIG_KEY_TO_FILE[module];
    if (!relativePath) {
      console.warn(`[Vault Sync] Modulo desconhecido: ${module}`);
      return;
    }

    await vault.writeNote(relativePath, content, {
      type: "agent_config",
      agent_id: "clara",
      config_key: module,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("[Vault Sync] Falha ao sincronizar config:", (err as Error).message);
  }
}

/**
 * Sync de relatorio (clara_reports) para o vault.
 * Escreve em reports/YYYY-MM-DD-{titulo-slug}.md
 */
export async function syncReportToVault(
  supabaseId: number,
  titulo: string,
  markdownContent: string,
  tipo: string
): Promise<void> {
  if (!(await isVaultAvailable())) return;

  try {
    const vault = getVaultService();
    const dateSlug = new Date().toISOString().slice(0, 10);
    const slug = slugify(titulo);
    const relativePath = `reports/${dateSlug}-${slug}.md`;

    await vault.writeNote(relativePath, markdownContent, {
      type: "report",
      titulo,
      tipo,
      supabase_id: supabaseId,
      created_at: new Date().toISOString(),
      agents_involved: ["clara"],
      tags: [],
    });
  } catch (err) {
    console.warn("[Vault Sync] Falha ao sincronizar relatorio:", (err as Error).message);
  }
}

/**
 * Sync de chat notes para o vault.
 * Escreve em chat-notes/chat-{id}.md
 */
export async function syncChatNoteToVault(
  chatId: number,
  notes: string,
  contactName?: string,
  phone?: string
): Promise<void> {
  if (!(await isVaultAvailable())) return;

  try {
    const vault = getVaultService();
    const relativePath = `chat-notes/chat-${chatId}.md`;

    await vault.writeNote(relativePath, notes, {
      type: "chat_note",
      chat_id: chatId,
      contact_name: contactName || "",
      phone: phone || "",
      last_updated: new Date().toISOString(),
      supabase_synced: true,
      tags: [],
    });
  } catch (err) {
    console.warn("[Vault Sync] Falha ao sincronizar chat note:", (err as Error).message);
  }
}

/**
 * Sync de knowledge base para o vault.
 * Escreve em knowledge/{categoria-folder}/{slug}.md
 */
export async function syncKnowledgeToVault(
  pergunta: string,
  resposta: string,
  categoria: string,
  tags?: string[]
): Promise<void> {
  if (!(await isVaultAvailable())) return;

  try {
    const vault = getVaultService();
    const folder = KB_CATEGORY_TO_FOLDER[categoria.toLowerCase()] || "knowledge/operations";
    const slug = slugify(pergunta.slice(0, 80));
    const relativePath = `${folder}/${slug}.md`;

    const content = `## Pergunta\n\n${pergunta}\n\n## Resposta\n\n${resposta}`;

    await vault.writeNote(relativePath, content, {
      type: "knowledge",
      category: categoria,
      subcategory: slug,
      created_at: new Date().toISOString(),
      last_consolidated: new Date().toISOString().slice(0, 10),
      version: 1,
      tags: tags || [],
    });
  } catch (err) {
    console.warn("[Vault Sync] Falha ao sincronizar knowledge:", (err as Error).message);
  }
}

/**
 * Sync de scheduled task para o vault.
 * Escreve em inbox/task-{id}-{slug}.md
 */
export async function syncScheduledTaskToVault(
  taskId: number,
  title: string,
  taskType: string,
  instruction: string,
  runAt: string,
  status: string,
  result?: string
): Promise<void> {
  if (!(await isVaultAvailable())) return;

  try {
    const vault = getVaultService();
    const slug = slugify(title);
    const relativePath = `inbox/task-${taskId}-${slug}.md`;

    const content = result
      ? `## Instrucao\n\n${instruction}\n\n## Resultado\n\n${result}`
      : `## Instrucao\n\n${instruction}`;

    await vault.writeNote(relativePath, content, {
      type: "scheduled_task",
      task_id: taskId,
      task_type: taskType,
      status,
      run_at: runAt,
      created_at: new Date().toISOString(),
      tags: [],
    });
  } catch (err) {
    console.warn("[Vault Sync] Falha ao sincronizar scheduled task:", (err as Error).message);
  }
}

/**
 * Escreve uma entrada no inbox do vault (captura bruta).
 * Usado por qualquer agente para registrar observacoes.
 */
export async function writeToInbox(
  source: string,
  content: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  if (!(await isVaultAvailable())) return;

  try {
    const vault = getVaultService();
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const relativePath = `inbox/${timestamp}-${slugify(source)}.md`;

    await vault.writeNote(relativePath, content, {
      type: "inbox",
      source,
      created_at: now.toISOString(),
      processed: false,
      ...metadata,
    });
  } catch (err) {
    console.warn("[Vault Sync] Falha ao escrever no inbox:", (err as Error).message);
  }
}
