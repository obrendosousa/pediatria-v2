/**
 * Backfill: gera embeddings (768d) para todas as memórias sem vetor.
 * Modelo: gemini-embedding-001 com outputDimensionality=768 (compatível com vector(768) do banco).
 * Uso: npx tsx scripts/backfill-memory-embeddings.mts
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY! });

const EMBEDDING_MODEL = 'gemini-embedding-001';
const OUTPUT_DIMS = 768; // compatível com vector(768) do banco
const BATCH_SIZE = 5;

async function embedText(text: string): Promise<number[]> {
  const response = await ai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: text,
    config: { outputDimensionality: OUTPUT_DIMS },
  });
  return response.embeddings?.[0]?.values ?? [];
}

async function main() {
  console.log('🔌 Testando API...');
  const test = await embedText('conexão ok');
  console.log(`✅ modelo: ${EMBEDDING_MODEL} | dimensões: ${test.length}`);

  console.log('\n🔍 Buscando memórias sem embedding...');
  const { data: memories, error } = await supabase
    .from('clara_memories')
    .select('id, content, memory_type')
    .is('embedding', null)
    .order('created_at', { ascending: true });

  if (error) { console.error('❌', error.message); process.exit(1); }
  if (!memories?.length) { console.log('✅ Nenhuma memória pendente.'); return; }

  console.log(`📦 ${memories.length} memórias para processar...\n`);

  let ok = 0, fail = 0;

  for (let i = 0; i < memories.length; i += BATCH_SIZE) {
    const batch = memories.slice(i, i + BATCH_SIZE);
    const pct = Math.round(((i + batch.length) / memories.length) * 100);
    process.stdout.write(`\r⚙️  ${i + batch.length}/${memories.length} [${pct}%] ✅${ok} ❌${fail}  `);

    for (const mem of batch) {
      try {
        const embedding = await embedText(mem.content);
        const { error: upErr } = await supabase
          .from('clara_memories').update({ embedding }).eq('id', mem.id);
        if (upErr) throw new Error(upErr.message);
        ok++;
      } catch (e: any) {
        fail++;
        if (e.message?.includes('429') || e.message?.includes('quota')) {
          process.stdout.write('\n  ⏳ Rate limit — aguardando 5s...');
          await new Promise(r => setTimeout(r, 5000));
        }
      }
      await new Promise(r => setTimeout(r, 150));
    }
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`\n\n══════════════════════════════════`);
  console.log(`✅ Concluído: ${ok}/${memories.length} embeddings gerados`);
  if (fail > 0) console.log(`❌ Falhas: ${fail} — execute novamente para retry`);
  else console.log('🎉 Busca semântica da Clara está 100% ativa!');
  console.log('══════════════════════════════════');
}

main().catch(e => { console.error('\nErro fatal:', e.message); process.exit(1); });
