import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();
  const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 30);

  if (!q || q.length < 2) {
    return NextResponse.json([]);
  }

  try {
    // Busca por código exato primeiro, depois por nome parcial (ilike)
    const { data, error } = await supabase
      .from('tuss_procedures')
      .select('id, code, name, category')
      .or(`code.ilike.${q}%,name.ilike.%${q}%`)
      .order('code', { ascending: true })
      .limit(limit);

    if (error) throw error;

    return NextResponse.json(data ?? []);
  } catch (err: any) {
    console.error('[TUSS search]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
