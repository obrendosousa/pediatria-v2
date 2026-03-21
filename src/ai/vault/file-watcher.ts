#!/usr/bin/env node
/**
 * Bidirectional Obsidian Sync — File Watcher.
 * Monitora mudancas no vault e sincroniza de volta ao Supabase quando:
 * - Uma nota com `supabase_id` no frontmatter e editada (vault → Supabase)
 * - Uma nota de config e editada (vault → agent_config)
 *
 * Uso:
 *   npx tsx src/ai/vault/file-watcher.ts
 *
 * Debounce de 5s para evitar spam.
 */

import { watch } from "chokidar";
import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { createClient } from "@supabase/supabase-js";
import { VAULT_ROOT, VAULT_LIMITS, CONFIG_KEY_TO_FILE } from "./config";

// ═══════════════════════════════════════════════════════════════════════════
// SETUP
// ═══════════════════════════════════════════════════════════════════════════

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("[Vault Watcher] NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sao obrigatorios.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

// Mapa invertido: path do vault → config_key
const FILE_TO_CONFIG_KEY: Record<string, string> = {};
for (const [key, filePath] of Object.entries(CONFIG_KEY_TO_FILE)) {
  FILE_TO_CONFIG_KEY[filePath] = key;
}

// Debounce: evitar processamento duplicado de edits rapidos
const pendingChanges = new Map<string, NodeJS.Timeout>();
const DEBOUNCE_MS = VAULT_LIMITS.SYNC_DEBOUNCE_MS;

// ═══════════════════════════════════════════════════════════════════════════
// SYNC HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

/** Sync de config editada no Obsidian de volta ao Supabase */
async function syncConfigToSupabase(relativePath: string, content: string): Promise<void> {
  const configKey = FILE_TO_CONFIG_KEY[relativePath];
  if (!configKey) return;

  const { error } = await supabase
    .from("agent_config")
    .upsert(
      {
        agent_id: "clara",
        config_key: configKey,
        content,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "agent_id,config_key" }
    );

  if (error) {
    console.error(`[Vault Watcher] Erro ao sync config '${configKey}':`, error.message);
  } else {
    console.log(`[Vault Watcher] Config '${configKey}' sincronizada para Supabase.`);
  }
}

/** Sync de memoria editada no Obsidian de volta ao Supabase */
async function syncMemoryToSupabase(
  supabaseId: number,
  content: string,
  frontmatter: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase
    .from("clara_memories")
    .update({
      content,
      memory_type: (frontmatter.memory_type as string) || "observacao",
      updated_at: new Date().toISOString(),
    })
    .eq("id", supabaseId);

  if (error) {
    console.error(`[Vault Watcher] Erro ao sync memoria #${supabaseId}:`, error.message);
  } else {
    console.log(`[Vault Watcher] Memoria #${supabaseId} sincronizada para Supabase.`);
  }
}

/** Sync de knowledge editado no Obsidian de volta ao Supabase */
async function syncKnowledgeToSupabase(
  content: string,
  frontmatter: Record<string, unknown>
): Promise<void> {
  // Extrair pergunta/resposta do formato padrao
  const perguntaMatch = content.match(/## Pergunta\s*\n\s*([\s\S]*?)(?=\n## Resposta)/);
  const respostaMatch = content.match(/## Resposta\s*\n\s*([\s\S]*?)$/);

  if (!perguntaMatch || !respostaMatch) return;

  const pergunta = perguntaMatch[1].trim();
  const resposta = respostaMatch[1].trim();
  const categoria = (frontmatter.category as string) || "operations";

  // Busca existente por pergunta similar para atualizar
  const { data: existing } = await supabase
    .from("knowledge_base")
    .select("id")
    .ilike("pergunta", `%${pergunta.slice(0, 50).replace(/[%_\\]/g, '\\$&')}%`)
    .limit(1);

  if (existing && existing.length > 0) {
    const { error } = await supabase
      .from("knowledge_base")
      .update({ resposta_ideal: resposta, categoria })
      .eq("id", existing[0].id);
    if (error) {
      console.error("[Vault Watcher] Erro ao atualizar knowledge:", error.message);
    } else {
      console.log(`[Vault Watcher] Knowledge #${existing[0].id} atualizado.`);
    }
  } else {
    console.log("[Vault Watcher] Knowledge novo detectado no vault (sem match no Supabase — ignorando sync reverso).");
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CHANGE HANDLER (com debounce)
// ═══════════════════════════════════════════════════════════════════════════

async function handleChange(absPath: string): Promise<void> {
  if (!absPath.endsWith(".md")) return;

  const relativePath = path.relative(VAULT_ROOT, absPath);

  // Ignorar notas transitórias e auto-geradas
  if (relativePath.startsWith("inbox/")) return;
  if (relativePath.startsWith("daily/")) return;
  if (relativePath.startsWith("graphs/")) return;

  try {
    const raw = await fs.readFile(absPath, "utf-8");
    const { data: frontmatter, content } = matter(raw);

    // 1. Config files: sync direto para agent_config
    if (FILE_TO_CONFIG_KEY[relativePath]) {
      await syncConfigToSupabase(relativePath, content.trim());
      return;
    }

    // 2. Memorias com supabase_id: sync de volta
    if (frontmatter.supabase_id && typeof frontmatter.supabase_id === "number") {
      if (relativePath.startsWith("memories/")) {
        await syncMemoryToSupabase(frontmatter.supabase_id, content.trim(), frontmatter);
        return;
      }
    }

    // 3. Knowledge base: sync de volta
    if (relativePath.startsWith("knowledge/") && frontmatter.type === "knowledge") {
      await syncKnowledgeToSupabase(content.trim(), frontmatter);
      return;
    }

    // Outros tipos de nota: log apenas
    // (chat-notes, reports, decisions — nao fazemos sync reverso por seguranca)
  } catch (err) {
    console.error(`[Vault Watcher] Erro ao processar ${relativePath}:`, (err as Error).message);
  }
}

function debouncedChange(absPath: string): void {
  const existing = pendingChanges.get(absPath);
  if (existing) clearTimeout(existing);

  const timeout = setTimeout(() => {
    pendingChanges.delete(absPath);
    handleChange(absPath).catch((err) => {
      console.error(`[Vault Watcher] Erro nao tratado:`, err);
    });
  }, DEBOUNCE_MS);

  pendingChanges.set(absPath, timeout);
}

// ═══════════════════════════════════════════════════════════════════════════
// STARTUP
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  // Verificar se o vault existe
  try {
    await fs.access(VAULT_ROOT);
  } catch {
    console.error(`[Vault Watcher] Vault nao encontrado em: ${VAULT_ROOT}`);
    process.exit(1);
  }

  console.log(`[Vault Watcher] Monitorando: ${VAULT_ROOT}`);
  console.log(`[Vault Watcher] Debounce: ${DEBOUNCE_MS}ms`);
  console.log(`[Vault Watcher] Sync bidirecional ativo para: configs, memorias, knowledge`);

  const watcher = watch(VAULT_ROOT, {
    ignored: [
      /(^|[/\\])\./,  // Ignorar dotfiles/dotfolders (.obsidian, .git)
      /node_modules/,
    ],
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 1000,
      pollInterval: 200,
    },
  });

  watcher.on("change", (absPath) => {
    debouncedChange(absPath as string);
  });

  watcher.on("error", (err) => {
    console.error("[Vault Watcher] Erro no watcher:", err);
  });

  // Graceful shutdown
  process.on("SIGINT", () => {
    console.log("\n[Vault Watcher] Encerrando...");
    watcher.close().then(() => process.exit(0));
  });

  process.on("SIGTERM", () => {
    watcher.close().then(() => process.exit(0));
  });
}

main();
