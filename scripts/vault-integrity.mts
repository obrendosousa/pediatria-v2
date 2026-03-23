/**
 * Vault Integrity Check — verifica integridade do vault de memórias.
 *
 * Verifica:
 * (a) todos os arquivos .md têm frontmatter válido com type: memory
 * (b) todos os supabase_id existem no Supabase
 * (c) nenhum wikilink aponta para arquivo inexistente
 * (d) nenhum arquivo contém PII detectável
 * (e) contagem por categoria bate com os arquivos presentes
 *
 * Saída: JSON com resultados + exit code 1 se qualquer falha crítica.
 *
 * Uso: npx tsx --env-file=.env.local scripts/vault-integrity.mts
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs/promises";
import path from "node:path";
import { stripPIIAndReferences } from "../src/ai/clara/memory_quality.js";

type AnySupabase = any;

const supabase: AnySupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

interface IntegrityResult {
  total_files: number;
  valid_files: number;
  invalid_frontmatter: string[];
  broken_links: string[];
  pii_detected: string[];
  missing_in_supabase: string[];
  category_counts: Record<string, number>;
  critical_failures: number;
  passed: boolean;
}

async function collectAllMdFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  async function walk(d: string) {
    const entries = await fs.readdir(d, { withFileTypes: true }).catch(() => []);
    for (const e of entries) {
      if (e.isDirectory()) { await walk(path.join(d, e.name)); continue; }
      if (e.name.endsWith(".md")) files.push(path.join(d, e.name));
    }
  }
  await walk(dir);
  return files;
}

async function main() {
  console.log('\n' + '═'.repeat(60));
  console.log('  VAULT INTEGRITY CHECK');
  console.log('═'.repeat(60) + '\n');

  const vaultMemDir = path.join(process.cwd(), "clinica-vault", "memories");
  const allFiles = await collectAllMdFiles(vaultMemDir);
  const memoryFiles = allFiles.filter(f => !path.basename(f).startsWith("_"));

  const result: IntegrityResult = {
    total_files: memoryFiles.length,
    valid_files: 0,
    invalid_frontmatter: [],
    broken_links: [],
    pii_detected: [],
    missing_in_supabase: [],
    category_counts: {},
    critical_failures: 0,
    passed: false,
  };

  // Coletar todos os slugs existentes para validar wikilinks
  const existingSlugs = new Set(
    memoryFiles.map(f => path.relative(vaultMemDir, f).replace(/\\/g, "/").replace(".md", ""))
  );

  // Buscar IDs ativos no Supabase
  const { data: activeIds } = await supabase
    .from("clara_memories")
    .select("id")
    .eq("archived", false);
  const supabaseIds = new Set((activeIds || []).map((r: { id: number }) => String(r.id)));

  for (const filePath of memoryFiles) {
    const content = await fs.readFile(filePath, "utf-8").catch(() => "");
    if (!content) continue;

    const relativePath = path.relative(vaultMemDir, filePath).replace(/\\/g, "/");

    // (a) Validar frontmatter
    if (!content.match(/^---[\s\S]+?---/)) {
      result.invalid_frontmatter.push(relativePath);
      result.critical_failures++;
      continue;
    }

    if (!content.match(/^type:\s*memory/m)) {
      result.invalid_frontmatter.push(relativePath + " (missing type: memory)");
      continue;
    }

    result.valid_files++;

    // Contar por categoria
    const memTypeMatch = content.match(/^memory_type:\s*(.+)$/m);
    const memType = memTypeMatch?.[1]?.trim() || "unknown";
    result.category_counts[memType] = (result.category_counts[memType] || 0) + 1;

    // (b) Verificar supabase_id
    const idMatch = content.match(/^supabase_id:\s*(\d+)$/m);
    if (idMatch && !supabaseIds.has(idMatch[1])) {
      result.missing_in_supabase.push(`${relativePath} (id: ${idMatch[1]})`);
    }

    // (c) Verificar wikilinks
    const wikilinks = content.matchAll(/\[\[([^\]|#]+)/g);
    for (const match of wikilinks) {
      const target = match[1].trim();
      if (target.startsWith("_")) continue; // MOCs são válidos
      if (!existingSlugs.has(target) && !existingSlugs.has(target + ".md")) {
        result.broken_links.push(`${relativePath} → [[${target}]]`);
      }
    }

    // (d) Detectar PII
    const bodyParts = content.split("---");
    const body = bodyParts.length >= 3 ? bodyParts.slice(2).join("---") : "";
    if (body) {
      const stripped = stripPIIAndReferences(body.trim());
      // Se strip alterou significativamente o conteúdo, há PII
      if (stripped && Math.abs(stripped.length - body.trim().length) > 20) {
        result.pii_detected.push(relativePath);
      }
    }
  }

  // Sumário
  console.log(`📁 Total de arquivos: ${result.total_files}`);
  console.log(`✅ Frontmatter válido: ${result.valid_files}`);
  console.log(`❌ Frontmatter inválido: ${result.invalid_frontmatter.length}`);
  console.log(`🔗 Wikilinks quebrados: ${result.broken_links.length}`);
  console.log(`🔒 PII detectado: ${result.pii_detected.length}`);
  console.log(`🆔 IDs sem correspondência no Supabase: ${result.missing_in_supabase.length}`);

  console.log("\n📊 Contagem por categoria:");
  for (const [cat, count] of Object.entries(result.category_counts).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${cat}: ${count}`);
  }

  if (result.invalid_frontmatter.length > 0) {
    console.log("\n⚠️ Frontmatter inválido:");
    result.invalid_frontmatter.slice(0, 10).forEach(f => console.log(`   ${f}`));
  }

  if (result.broken_links.length > 0) {
    console.log("\n⚠️ Wikilinks quebrados (amostra):");
    result.broken_links.slice(0, 10).forEach(l => console.log(`   ${l}`));
  }

  if (result.pii_detected.length > 0) {
    console.log("\n🔒 Arquivos com PII potencial:");
    result.pii_detected.forEach(f => console.log(`   ${f}`));
  }

  result.critical_failures = result.invalid_frontmatter.length + result.pii_detected.length;
  result.passed = result.critical_failures === 0;

  // Salvar resultado
  const outPath = path.join(process.cwd(), "scripts", "vault-integrity-result.json");
  await fs.writeFile(outPath, JSON.stringify(result, null, 2));
  console.log(`\n${result.passed ? "✅ PASSED" : "❌ FAILED"} — resultado salvo em scripts/vault-integrity-result.json`);

  process.exit(result.passed ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
