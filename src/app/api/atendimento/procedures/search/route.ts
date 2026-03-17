import { NextRequest, NextResponse } from 'next/server';
import { createSchemaClient } from '@/lib/supabase/schemaClient';

// GET /api/atendimento/procedures/search?q=<query>&limit=<limit>
// Busca procedimentos cadastrados pela clínica (atendimento.procedures)
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') || '';
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit')) || 15, 30);

  if (q.length < 2) {
    return NextResponse.json([]);
  }

  const supabase = createSchemaClient('atendimento');

  const { data, error } = await supabase
    .from('procedures')
    .select('id, name, procedure_type, duration_minutes, fee_value, total_value')
    .eq('status', 'active')
    .ilike('name', `%${q}%`)
    .order('name')
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}
