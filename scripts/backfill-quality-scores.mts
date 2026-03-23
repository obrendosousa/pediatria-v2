/**
 * Backfill de quality_score para todas as memórias existentes.
 * Roda uma vez após a migration B.1.
 *
 * Uso: npx tsx --env-file=.env.local scripts/backfill-quality-scores.mts
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { calculateQualityScore } from "../src/ai/clara/memory_quality.js";

type AnySupabase = any;

const supabase: AnySupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

async function main() {
  console.log('\n' + '═'.repeat(60));
  console.log('  BACKFILL DE QUALITY SCORES');
  console.log('═'.repeat(60) + '\n');

  const { data, error } = await supabase
    .from('clara_memories')
    .select('id, content')
    .is('quality_score', null);

  if (error || !data) { console.error('Erro:', error?.message); process.exit(1); }

  console.log(`${data.length} memórias sem quality_score.`);

  let updated = 0;
  for (const mem of data as Array<{ id: number; content: string }>) {
    const score = calculateQualityScore(mem.content);
    const { error: upErr } = await supabase
      .from('clara_memories')
      .update({ quality_score: score })
      .eq('id', mem.id);
    if (!upErr) updated++;
    if (updated % 50 === 0) console.log(`  Atualizado: ${updated}/${data.length}`);
  }

  console.log(`\n✅ ${updated}/${data.length} memórias atualizadas.`);
}

main().catch(e => { console.error(e); process.exit(1); });
