import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAtendimento = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { db: { schema: 'atendimento' } }
);

const supabasePublic = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ appointmentId: string }> }
) {
  try {
    const { appointmentId } = await params;
    const aptId = parseInt(appointmentId, 10);
    if (isNaN(aptId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // 1. Get appointment to find doctor_id
    const { data: apt, error: aptError } = await supabaseAtendimento
      .from('appointments')
      .select('id, doctor_id')
      .eq('id', aptId)
      .single();

    if (aptError || !apt) {
      return NextResponse.json({ commission: null });
    }

    // 2. Get procedures with commission data
    const { data: procs, error: procError } = await supabaseAtendimento
      .from('appointment_procedures')
      .select('procedure_name, doctor_commission, clinic_amount, split_type, split_value, line_total')
      .eq('appointment_id', aptId);

    if (procError || !procs || procs.length === 0) {
      return NextResponse.json({ commission: null });
    }

    // Filter only rows with commission
    const withCommission = procs.filter(p => p.doctor_commission != null && p.doctor_commission > 0);
    if (withCommission.length === 0) {
      return NextResponse.json({ commission: null });
    }

    // 3. Resolve professional_id from doctor_id
    let professionalId: string | null = null;
    if (apt.doctor_id) {
      const { data: doctor } = await supabasePublic
        .from('doctors')
        .select('professional_id')
        .eq('id', apt.doctor_id)
        .single();
      professionalId = doctor?.professional_id || null;
    }

    if (!professionalId) {
      return NextResponse.json({ commission: null });
    }

    // 4. Aggregate
    const totalCommission = withCommission.reduce((sum, p) => sum + Number(p.doctor_commission), 0);
    const details = withCommission.map(p => ({
      procedure_name: p.procedure_name,
      doctor_commission: Number(p.doctor_commission),
      clinic_amount: Number(p.clinic_amount),
      split_type: p.split_type,
      split_value: Number(p.split_value),
    }));

    return NextResponse.json({
      commission: {
        professional_id: professionalId,
        doctor_id: apt.doctor_id,
        total_commission: Math.round(totalCommission * 100) / 100,
        details,
      },
    });
  } catch (error) {
    console.error('[Commission API] Error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
