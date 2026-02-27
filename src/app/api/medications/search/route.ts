import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();
  const limit = Math.min(parseInt(searchParams.get('limit') || '12'), 30);

  if (!q || q.length < 2) {
    return NextResponse.json([]);
  }

  try {
    const { data, error } = await supabase
      .from('medications_catalog')
      .select('id, name, active_ingredient, dosage, form')
      .or(`name.ilike.%${q}%,active_ingredient.ilike.%${q}%`)
      .order('name', { ascending: true })
      .limit(limit);

    if (error) throw error;

    return NextResponse.json(data ?? []);
  } catch (err: any) {
    console.error('[medications search]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
