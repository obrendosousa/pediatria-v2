#!/usr/bin/env tsx
/**
 * Script de migracao: Supabase → Obsidian Vault
 *
 * Exporta dados existentes das tabelas de conhecimento para o vault.
 * Executar: npx tsx scripts/migrate-to-vault.ts
 *
 * Seguro para re-executar (sobrescreve notas existentes).
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

const VAULT_ROOT = path.join(process.cwd(), "clinica-vault");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

async function writeNote(
  relativePath: string,
  content: string,
  frontmatter: Record<string, unknown>
): Promise<void> {
  const absPath = path.join(VAULT_ROOT, relativePath);
  await fs.mkdir(path.dirname(absPath), { recursive: true });
  const output = matter.stringify(content, frontmatter);
  await fs.writeFile(absPath, output, "utf-8");
}

// ─────────────────────────────────────────────────────────────────────────
// 1. clara_memories → memories/{memory_type}/{slug}.md
// ─────────────────────────────────────────────────────────────────────────

async function migrateMemories(): Promise<number> {
  console.log("\n📝 Migrando clara_memories...");
  const { data, error } = await supabase
    .from("clara_memories")
    .select("id, memory_type, content, source_role, updated_at")
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("  Erro:", error.message);
    return 0;
  }

  const memories = data as Array<{
    id: number;
    memory_type: string;
    content: string;
    source_role: string;
    updated_at: string;
  }>;

  let count = 0;
  for (const m of memories) {
    const typeSlug = slugify(m.memory_type || "geral");
    const contentSlug = slugify(m.content.slice(0, 80));
    const relativePath = `memories/${typeSlug}/${contentSlug}.md`;

    await writeNote(relativePath, m.content, {
      type: "memory",
      memory_type: m.memory_type,
      source_role: m.source_role || "system",
      supabase_id: m.id,
      created_at: m.updated_at,
      updated_at: m.updated_at,
      tags: [],
      agent_source: "clara",
    });
    count++;
  }

  console.log(`  ✅ ${count} memorias migradas`);
  return count;
}

// ─────────────────────────────────────────────────────────────────────────
// 2. knowledge_base → knowledge/{categoria}/
// ─────────────────────────────────────────────────────────────────────────

const KB_FOLDER_MAP: Record<string, string> = {
  clinica: "knowledge/clinical",
  clinical: "knowledge/clinical",
  pediatria: "knowledge/clinical",
  operacional: "knowledge/operations",
  operations: "knowledge/operations",
  copiloto_feedback: "knowledge/operations",
  tecnico: "knowledge/technical",
  technical: "knowledge/technical",
};

async function migrateKnowledgeBase(): Promise<number> {
  console.log("\n📚 Migrando knowledge_base...");
  const { data, error } = await supabase
    .from("knowledge_base")
    .select("id, pergunta, resposta_ideal, categoria, tags");

  if (error) {
    console.error("  Erro:", error.message);
    return 0;
  }

  const entries = data as Array<{
    id: number;
    pergunta: string;
    resposta_ideal: string;
    categoria: string;
    tags: string;
  }>;

  let count = 0;
  for (const e of entries) {
    const folder = KB_FOLDER_MAP[(e.categoria || "").toLowerCase()] || "knowledge/operations";
    const slug = slugify(e.pergunta.slice(0, 80));
    const relativePath = `${folder}/${slug}.md`;

    const content = `## Pergunta\n\n${e.pergunta}\n\n## Resposta\n\n${e.resposta_ideal}`;
    const tags = e.tags ? String(e.tags).split(",").map((t) => t.trim()).filter(Boolean) : [];

    await writeNote(relativePath, content, {
      type: "knowledge",
      category: e.categoria,
      subcategory: slug,
      supabase_id: e.id,
      created_at: new Date().toISOString(),
      last_consolidated: new Date().toISOString().slice(0, 10),
      version: 1,
      tags,
    });
    count++;
  }

  console.log(`  ✅ ${count} entradas de knowledge base migradas`);
  return count;
}

// ─────────────────────────────────────────────────────────────────────────
// 3. agent_config → agents/clara/{module}.md
// ─────────────────────────────────────────────────────────────────────────

const CONFIG_FILE_MAP: Record<string, string> = {
  company: "agents/clara/company.md",
  rules: "agents/clara/rules.md",
  voice_rules: "agents/clara/voice-rules.md",
};

async function migrateAgentConfig(): Promise<number> {
  console.log("\n⚙️  Migrando agent_config...");
  const { data, error } = await supabase
    .from("agent_config")
    .select("config_key, content, updated_at")
    .eq("agent_id", "clara");

  if (error) {
    console.error("  Erro:", error.message);
    return 0;
  }

  const configs = data as Array<{
    config_key: string;
    content: string;
    updated_at: string;
  }>;

  let count = 0;
  for (const c of configs) {
    const relativePath = CONFIG_FILE_MAP[c.config_key];
    if (!relativePath) {
      console.warn(`  ⚠️  Config key desconhecida: ${c.config_key}`);
      continue;
    }

    await writeNote(relativePath, c.content, {
      type: "agent_config",
      agent_id: "clara",
      config_key: c.config_key,
      updated_at: c.updated_at,
    });
    count++;
  }

  console.log(`  ✅ ${count} configs migradas`);
  return count;
}

// ─────────────────────────────────────────────────────────────────────────
// 4. clara_reports → reports/YYYY-MM-DD-{slug}.md
// ─────────────────────────────────────────────────────────────────────────

async function migrateReports(): Promise<number> {
  console.log("\n📊 Migrando clara_reports...");
  const { data, error } = await supabase
    .from("clara_reports")
    .select("id, titulo, conteudo_markdown, tipo, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("  Erro:", error.message);
    return 0;
  }

  const reports = data as Array<{
    id: number;
    titulo: string;
    conteudo_markdown: string;
    tipo: string;
    created_at: string;
  }>;

  let count = 0;
  for (const r of reports) {
    const dateSlug = r.created_at
      ? new Date(r.created_at).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    const slug = slugify(r.titulo || `report-${r.id}`);
    const relativePath = `reports/${dateSlug}-${slug}.md`;

    await writeNote(relativePath, r.conteudo_markdown || "", {
      type: "report",
      titulo: r.titulo,
      tipo: r.tipo,
      supabase_id: r.id,
      created_at: r.created_at,
      agents_involved: ["clara"],
      tags: [],
    });
    count++;
  }

  console.log(`  ✅ ${count} relatorios migrados`);
  return count;
}

// ─────────────────────────────────────────────────────────────────────────
// 5. chat_notes → chat-notes/chat-{id}.md
// ─────────────────────────────────────────────────────────────────────────

async function migrateChatNotes(): Promise<number> {
  console.log("\n💬 Migrando chat_notes...");
  const { data, error } = await supabase
    .from("chat_notes")
    .select("chat_id, notes, updated_at");

  if (error) {
    console.error("  Erro:", error.message);
    return 0;
  }

  const notes = data as Array<{
    chat_id: number;
    notes: string;
    updated_at: string;
  }>;

  let count = 0;
  for (const n of notes) {
    const relativePath = `chat-notes/chat-${n.chat_id}.md`;

    await writeNote(relativePath, n.notes || "", {
      type: "chat_note",
      chat_id: n.chat_id,
      last_updated: n.updated_at || new Date().toISOString(),
      supabase_synced: true,
      tags: [],
    });
    count++;
  }

  console.log(`  ✅ ${count} notas de chat migradas`);
  return count;
}

// ─────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🧠 Migracao Supabase → Obsidian Vault");
  console.log(`   Vault root: ${VAULT_ROOT}`);
  console.log("═".repeat(50));

  // Garantir que o vault existe
  await fs.mkdir(VAULT_ROOT, { recursive: true });

  const totals = {
    memories: await migrateMemories(),
    knowledge: await migrateKnowledgeBase(),
    config: await migrateAgentConfig(),
    reports: await migrateReports(),
    chatNotes: await migrateChatNotes(),
  };

  const total = Object.values(totals).reduce((a, b) => a + b, 0);

  console.log("\n" + "═".repeat(50));
  console.log(`🎉 Migracao concluida! ${total} notas criadas no vault.`);
  console.log(`   Memorias: ${totals.memories}`);
  console.log(`   Knowledge Base: ${totals.knowledge}`);
  console.log(`   Configs: ${totals.config}`);
  console.log(`   Relatorios: ${totals.reports}`);
  console.log(`   Chat Notes: ${totals.chatNotes}`);
  console.log(`\n💡 Abra "${VAULT_ROOT}" no Obsidian para visualizar.`);
}

main().catch((err) => {
  console.error("❌ Erro fatal na migracao:", err);
  process.exit(1);
});
