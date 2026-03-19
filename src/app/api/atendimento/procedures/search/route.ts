import { NextRequest, NextResponse } from 'next/server';
import { createSchemaClient } from '@/lib/supabase/schemaClient';

// GET /api/atendimento/procedures/search?q=<query>&limit=<limit>&professional_id=<uuid>
// Quando professional_id é informado, busca em professional_procedures do profissional.
// Caso contrário, busca no catálogo global (fallback para compatibilidade).
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') || '';
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit')) || 15, 30);
  const professionalId = req.nextUrl.searchParams.get('professional_id');

  if (q.length < 2) {
    return NextResponse.json([]);
  }

  const supabase = createSchemaClient('atendimento');

  if (professionalId) {
    const { data, error } = await supabase
      .from('professional_procedures')
      .select('id, name, procedure_type, duration_minutes, value')
      .eq('professional_id', professionalId)
      .eq('status', 'active')
      .ilike('name', `%${q}%`)
      .order('name')
      .limit(limit);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Mapear para formato compatível com ProcedureOption do modal
    const mapped = (data || []).map(p => ({
      id: p.id,
      name: p.name,
      procedure_type: p.procedure_type,
      duration_minutes: p.duration_minutes,
      fee_value: p.value,
      total_value: p.value,
    }));

    return NextResponse.json(mapped);
  }

  // Fallback: catálogo global
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
