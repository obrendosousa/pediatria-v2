/**
 * Seed do Supabase a partir dos arquivos do vault (reset estratégico).
 *
 * Uso: npx tsx --env-file=.env.local scripts/seed-from-vault.mts
 * Flags: --dry-run (não insere, só conta)
 *        --archive-existing (arquiva memórias ativas antes de inserir)
 *
 * Lê todos os arquivos .md em clinica-vault/memories/ com type: memory,
 * calcula quality_score e insere em clara_memories com source_role='vault_seed'.
 * Pula MOCs, temas e index (apenas type: memory).
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";
import fs from "node:fs/promises";
import path from "node:path";
import { calculateQualityScore } from "../src/ai/clara/memory_quality.js";
import { mapLegacyType } from "../src/ai/clara/memory_types.js";

type AnySupabase = any;

const DRY_RUN = process.argv.includes('--dry-run');
const ARCHIVE_EXISTING = process.argv.includes('--archive-existing');

const supabase: AnySupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY! });

async function embedText(text: string): Promise<number[] | null> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await ai.models.embedContent({
        model: 'gemini-embedding-001',
        contents: text,
        config: { outputDimensionality: 768 },
      });
      return response.embeddings?.[0]?.values ?? null;
    } catch {
      if (attempt === 3) return null;
      await new Promise(r => setTimeout(r, 1000 * Math.pow(3, attempt - 1)));
    }
  }
  return null;
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

interface VaultMemory {
  path: string;
  content: string;
  memory_type: string;
  supabase_id?: number;
}

async function collectVaultMemories(dir: string): Promise<VaultMemory[]> {
  const memories: VaultMemory[] = [];

  async function walk(d: string) {
    const entries = await fs.readdir(d, { withFileTypes: true }).catch(() => []);
    for (const e of entries) {
      if (e.isDirectory()) { await walk(path.join(d, e.name)); continue; }
      if (!e.name.endsWith('.md') || e.name.startsWith('_')) continue; // pula MOCs e index

      const fullPath = path.join(d, e.name);
      const raw = await fs.readFile(fullPath, 'utf-8');

      // Só arquivos com type: memory
      if (!raw.match(/^type:\s*memory/m)) continue;

      // Extrair frontmatter
      const memTypeMatch = raw.match(/^memory_type:\s*(.+)$/m);
      const idMatch = raw.match(/^supabase_id:\s*(\d+)$/m);

      // Extrair conteúdo (depois do segundo ---)
      const parts = raw.split('---');
      const bodyContent = parts.length >= 3 ? parts.slice(2).join('---').trim() : '';

      // Remover seções ## Contexto e ## Relacionados
      const cleanContent = bodyContent
        .replace(/^##\s+(Contexto|Relacionados|Outras Categorias)[\s\S]*?(?=^##|\Z)/gm, '')
        .trim();

      if (!cleanContent || cleanContent.length < 10) continue;

      memories.push({
        path: fullPath,
        content: cleanContent,
        memory_type: memTypeMatch ? memTypeMatch[1].trim() : 'padrao_comportamental',
        supabase_id: idMatch ? parseInt(idMatch[1]) : undefined,
      });
    }
  }

  await walk(dir);
  return memories;
}

async function main() {
  console.log('\n' + '═'.repeat(60));
  console.log(`  SEED FROM VAULT ${DRY_RUN ? '(DRY RUN)' : ''}`);
  console.log('═'.repeat(60) + '\n');

  const vaultMemDir = path.join(process.cwd(), 'clinica-vault', 'memories');
  const memories = await collectVaultMemories(vaultMemDir);
  console.log(`[1/4] ${memories.length} memórias encontradas no vault`);

  if (ARCHIVE_EXISTING && !DRY_RUN) {
    console.log('[2/4] Arquivando memórias ativas existentes...');
    const { error } = await supabase
      .from('clara_memories')
      .update({ archived: true, archived_at: new Date().toISOString(), archive_reason: 'pre_v4_reset' })
      .eq('archived', false);
    if (error) { console.error('Erro ao arquivar:', error.message); process.exit(1); }
    console.log('    ✅ Memórias ativas arquivadas.');
  } else {
    console.log('[2/4] Pulando arquivamento (use --archive-existing para ativar)');
  }

  if (DRY_RUN) {
    console.log(`[3/4] DRY RUN: inseriria ${memories.length} memórias com embeddings`);
    console.log('[4/4] DRY RUN concluído.');
    return;
  }

  console.log(`[3/4] Inserindo ${memories.length} memórias com embeddings...`);
  let inserted = 0, failed = 0;

  for (const mem of memories) {
    const canonical_type = mapLegacyType(mem.memory_type);
    const score = calculateQualityScore(mem.content);
    const embedding = await embedText(mem.content);

    const { error } = await supabase.from('clara_memories').insert({
      memory_type: canonical_type,
      content: mem.content,
      embedding,
      quality_score: score,
      embedding_status: embedding ? 'ok' : 'failed',
      source_role: 'vault_seed',
      updated_at: new Date().toISOString(),
    });

    if (error) { failed++; console.warn(`  ⚠️ Falha: ${mem.path.slice(-50)} — ${error.message}`); }
    else { inserted++; }

    if ((inserted + failed) % 25 === 0) {
      console.log(`  Progresso: ${inserted + failed}/${memories.length} (${inserted} ok, ${failed} falhas)`);
    }

    await sleep(150); // rate limit
  }

  console.log(`\n[4/4] Concluído: ${inserted} inseridas, ${failed} falhas`);
}

main().catch(e => { console.error(e); process.exit(1); });
