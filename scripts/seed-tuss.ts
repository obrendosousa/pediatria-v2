/**
 * Script de seed: importa a tabela TUSS completa da ANS para o Supabase.
 *
 * Fonte oficial: http://ftp.dadosabertos.ans.gov.br/FTP/PDA/terminologia_unificada_saude_suplementar_TUSS/TUSS.zip
 * Repositório alternativo: https://github.com/charlesfgarcia/tabelas-ans
 *
 * Uso:
 *   npx tsx scripts/seed-tuss.ts
 *
 * Variáveis de ambiente necessárias (.env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   (ou NEXT_PUBLIC_SUPABASE_ANON_KEY)
 */

import { createClient } from '@supabase/supabase-js';
import * as https from 'https';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';

// ─── Config ───────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// URL alternativa via GitHub (CSV pré-processado com código + nome)
const GITHUB_CSV_URL =
  'https://raw.githubusercontent.com/charlesfgarcia/tabelas-ans/master/procedimentos.csv';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fetchText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchText(res.headers.location!).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });
}

interface TussRow { code: string; name: string; category?: string }

function parseCsv(csv: string): TussRow[] {
  const lines = csv.split('\n').slice(1); // pula cabeçalho
  const rows: TussRow[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    // Tenta separadores comuns: ; ou ,
    const sep = line.includes(';') ? ';' : ',';
    const parts = line.split(sep).map((p) => p.replace(/^"|"$/g, '').trim());

    const code = parts[0];
    const name = parts[1] || parts[0];
    const category = parts[2] || undefined;

    if (!code || !name) continue;
    rows.push({ code, name, category });
  }

  return rows;
}

async function seedBatch(rows: TussRow[]) {
  const BATCH = 500;
  let inserted = 0;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH).map((r) => ({
      code: r.code,
      name: r.name,
      category: r.category ?? null,
    }));

    const { error } = await supabase
      .from('tuss_procedures')
      .upsert(batch, { onConflict: 'code' });

    if (error) {
      console.error(`Erro no lote ${i}–${i + BATCH}:`, error.message);
    } else {
      inserted += batch.length;
      console.log(`  ✓ ${inserted}/${rows.length} procedimentos inseridos...`);
    }
  }

  return inserted;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🔄 Importando tabela TUSS para o Supabase...\n');

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Variáveis NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY não configuradas.');
    process.exit(1);
  }

  let rows: TussRow[] = [];

  // Tenta buscar CSV do GitHub
  try {
    console.log(`📥 Baixando de: ${GITHUB_CSV_URL}`);
    const csv = await fetchText(GITHUB_CSV_URL);
    rows = parseCsv(csv);
    console.log(`   → ${rows.length} procedimentos encontrados no CSV\n`);
  } catch (err: any) {
    console.warn(`⚠️  Falha ao buscar CSV do GitHub: ${err.message}`);
    console.log('   Usando apenas os dados já inseridos pela migration inicial.\n');
  }

  if (rows.length === 0) {
    console.log('ℹ️  Nenhum dado novo para importar.');
    console.log('   Os ~130 procedimentos básicos já foram inseridos pela migration SQL.\n');
    return;
  }

  console.log('💾 Inserindo no banco de dados...');
  const total = await seedBatch(rows);

  console.log(`\n✅ Concluído! ${total} procedimentos TUSS disponíveis.\n`);
}

main().catch((err) => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
