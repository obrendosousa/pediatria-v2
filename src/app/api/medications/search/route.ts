import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { db: { schema: 'atendimento' } }
);

interface MedicationRow {
  id: string;
  description: string;
  active_ingredient: string;
  presentation: string;
  type: string;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();
  const limit = Math.min(parseInt(searchParams.get('limit') || '12'), 30);

  if (!q || q.length < 2) {
    return NextResponse.json([]);
  }

  try {
    const { data, error } = await supabase
      .from('medications')
      .select('id, description, active_ingredient, presentation, type')
      .or(`description.ilike.%${q.replace(/[%_\\]/g, '\\$&')}%,active_ingredient.ilike.%${q.replace(/[%_\\]/g, '\\$&')}%`)
      .order('description', { ascending: true })
      .limit(limit);

    if (error) throw error;

    const mapped = (data ?? []).map((m: MedicationRow) => ({
      id: m.id,
      name: m.description,
      active_ingredient: m.active_ingredient,
      dosage: m.presentation,
      form: m.type,
    }));

    return NextResponse.json(mapped);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[medications search]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
