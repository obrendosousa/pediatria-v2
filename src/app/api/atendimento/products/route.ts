import { NextRequest, NextResponse } from 'next/server';
import { createSchemaAdminClient } from '@/lib/supabase/schemaServer';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const page = Math.max(0, Number(searchParams.get('page') || 0));
    const pageSize = Math.min(50, Math.max(1, Number(searchParams.get('pageSize') || 20)));

    const supabase = createSchemaAdminClient('public');

    const from = page * pageSize;
    let query = supabase
      .from('medications_catalog')
      .select('id, name, active_ingredient, dosage, form', { count: 'exact' })
      .order('name', { ascending: true });

    if (search.trim()) {
      query = query.ilike('name', `%${search.trim()}%`);
    }

    const { data, count, error } = await query.range(from, from + pageSize - 1);

    if (error) {
      console.error('[atendimento/products] Query error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const mapped = (data || []).map((m) => ({
      id: String(m.id),
      name: `${m.name} ${m.dosage} - ${m.form}`,
      active_ingredient: m.active_ingredient,
      dosage: m.dosage,
      form: m.form,
    }));

    return NextResponse.json({ data: mapped, total: count || 0 });
  } catch (err) {
    console.error('[atendimento/products] Unexpected error:', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
