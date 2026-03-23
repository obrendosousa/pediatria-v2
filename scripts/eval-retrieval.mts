/**
 * Eval de Retrieval — mede precision@5 do sistema de busca semântica.
 *
 * Uso: npx tsx --env-file=.env.local scripts/eval-retrieval.mts
 * Pré-requisito: scripts/eval-golden-set.json (criado por Brendo)
 *
 * Formato do golden set:
 * [{ "query": "qual o valor da consulta?", "expected_contains": ["500", "R$"] }]
 *
 * Testa thresholds: 0.65, 0.70, 0.75, 0.80
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";
import fs from "node:fs/promises";
import path from "node:path";

type AnySupabase = any;

const supabase: AnySupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY! });

async function embedQuery(text: string): Promise<number[]> {
  const response = await ai.models.embedContent({
    model: 'gemini-embedding-001',
    contents: text,
    config: { outputDimensionality: 768 },
  });
  return response.embeddings?.[0]?.values ?? [];
}

interface GoldenEntry {
  query: string;
  expected_contains: string[]; // substrings que devem aparecer nos resultados
}

interface ThresholdResult {
  threshold: number;
  precision_at_5: number; // % de queries com ao menos 1 resultado esperado no top-5
  avg_results: number;    // média de resultados por query
  no_results: number;     // queries sem resultado algum
}

async function evalThreshold(golden: GoldenEntry[], threshold: number): Promise<ThresholdResult> {
  let hits = 0;
  let totalResults = 0;
  let noResults = 0;

  for (const entry of golden) {
    const embedding = await embedQuery(entry.query);
    const { data } = await supabase.rpc('match_memories', {
      query_embedding: embedding,
      match_threshold: threshold,
      match_count: 5,
    });

    const results = (data || []) as Array<{ content: string }>;
    totalResults += results.length;
    if (results.length === 0) { noResults++; continue; }

    // Verifica se ao menos um resultado contém um dos expected_contains
    const hit = results.some(r =>
      entry.expected_contains.some(exp =>
        r.content.toLowerCase().includes(exp.toLowerCase())
      )
    );
    if (hit) hits++;
  }

  return {
    threshold,
    precision_at_5: golden.length > 0 ? (hits / golden.length) * 100 : 0,
    avg_results: golden.length > 0 ? totalResults / golden.length : 0,
    no_results: noResults,
  };
}

async function main() {
  const goldenPath = path.join(process.cwd(), 'scripts', 'eval-golden-set.json');

  let golden: GoldenEntry[];
  try {
    golden = JSON.parse(await fs.readFile(goldenPath, 'utf-8'));
  } catch {
    console.error(`❌ Golden set não encontrado: ${goldenPath}`);
    console.error('   Crie scripts/eval-golden-set.json com 50 queries manualmente.');
    console.error('   Formato: [{ "query": "...", "expected_contains": ["..."] }]');
    process.exit(1);
  }

  console.log('\n' + '═'.repeat(60));
  console.log(`  EVAL DE RETRIEVAL — ${golden.length} queries`);
  console.log('═'.repeat(60) + '\n');

  const thresholds = [0.65, 0.70, 0.75, 0.80];
  const results: ThresholdResult[] = [];

  for (const t of thresholds) {
    process.stdout.write(`Testando threshold ${t}... `);
    const result = await evalThreshold(golden, t);
    results.push(result);
    console.log(`precision@5=${result.precision_at_5.toFixed(1)}% avg_results=${result.avg_results.toFixed(1)} no_results=${result.no_results}`);
  }

  // Melhor threshold por F1 aproximado
  const best = results.reduce((best, r) => {
    // F1 proxy: penaliza no_results (recall baixo) e favorece precision
    const score = r.precision_at_5 - (r.no_results / golden.length * 30);
    const bestScore = best.precision_at_5 - (best.no_results / golden.length * 30);
    return score > bestScore ? r : best;
  });

  console.log(`\n🏆 Threshold recomendado: ${best.threshold} (precision@5=${best.precision_at_5.toFixed(1)}%)`);

  const outPath = path.join(process.cwd(), 'scripts', 'eval-result.json');
  await fs.writeFile(outPath, JSON.stringify({ results, recommended: best.threshold, golden_size: golden.length }, null, 2));
  console.log(`✅ Resultado salvo em: scripts/eval-result.json`);
  console.log(`\n📝 Próximo passo: atualizar THRESHOLD_RETRIEVAL_AUTO em src/ai/clara/constants.ts com o valor recomendado.`);
}

main().catch(e => { console.error(e); process.exit(1); });
