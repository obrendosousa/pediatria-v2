import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { resolveFinanceRange } from '@/lib/financePeriod';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const supabaseAtendimento = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { db: { schema: 'atendimento' } }
);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const range = resolveFinanceRange({
      preset: searchParams.get('preset'),
      start: searchParams.get('start'),
      end: searchParams.get('end'),
    });

    // 1. Get professional_payments in date range
    const { data: payments, error: payError } = await supabase
      .from('professional_payments')
      .select('id, financial_transaction_id, appointment_id, professional_id, doctor_id, total_commission, status, commission_details, created_at')
      .gte('created_at', range.startISO)
      .lte('created_at', range.endISO)
      .order('created_at', { ascending: false });

    if (payError) {
      console.error('[Commissions API] Error:', payError);
      return NextResponse.json({ error: payError.message }, { status: 500 });
    }

    // 2. Get doctors for name resolution
    const { data: doctors } = await supabase
      .from('doctors')
      .select('id, name, professional_id')
      .eq('active', true);

    const doctorMap = new Map((doctors || []).map(d => [d.id, d]));

    // 3. Get professionals for name resolution
    const { data: professionals } = await supabaseAtendimento
      .from('professionals')
      .select('id, name')
      .eq('status', 'active');

    const profMap = new Map((professionals || []).map(p => [p.id, p]));

    // 4. Get financial transactions for total revenue calculation
    const { data: transactions } = await supabase
      .from('financial_transactions')
      .select('id, amount, origin')
      .gte('occurred_at', range.startISO)
      .lte('occurred_at', range.endISO);

    const totalRevenue = (transactions || []).reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const consultationRevenue = (transactions || []).filter(t => t.origin === 'atendimento').reduce((sum, t) => sum + Number(t.amount || 0), 0);

    // 5. Aggregate by professional
    const profAgg = new Map<string, {
      professional_id: string;
      doctor_id: number | null;
      doctor_name: string;
      total_commission: number;
      pending: number;
      paid: number;
      cancelled: number;
      appointments_count: number;
      procedures: Map<string, { name: string; count: number; total: number; commission: number }>;
    }>();

    for (const pay of (payments || [])) {
      const key = pay.professional_id;
      if (!profAgg.has(key)) {
        const doc = pay.doctor_id ? doctorMap.get(pay.doctor_id) : null;
        const prof = profMap.get(pay.professional_id);
        profAgg.set(key, {
          professional_id: pay.professional_id,
          doctor_id: pay.doctor_id,
          doctor_name: doc?.name || prof?.name || 'Profissional',
          total_commission: 0,
          pending: 0,
          paid: 0,
          cancelled: 0,
          appointments_count: 0,
          procedures: new Map(),
        });
      }

      const agg = profAgg.get(key)!;
      const commission = Number(pay.total_commission || 0);
      agg.total_commission += commission;
      agg.appointments_count += 1;

      if (pay.status === 'pending') agg.pending += commission;
      else if (pay.status === 'paid') agg.paid += commission;
      else if (pay.status === 'cancelled') agg.cancelled += commission;

      // Breakdown by procedure
      const details = pay.commission_details as Array<{ procedure_name: string; doctor_commission: number; clinic_amount: number }> | null;
      if (details && Array.isArray(details)) {
        for (const d of details) {
          const procKey = d.procedure_name;
          if (!agg.procedures.has(procKey)) {
            agg.procedures.set(procKey, { name: d.procedure_name, count: 0, total: 0, commission: 0 });
          }
          const proc = agg.procedures.get(procKey)!;
          proc.count += 1;
          proc.total += Number(d.doctor_commission || 0) + Number(d.clinic_amount || 0);
          proc.commission += Number(d.doctor_commission || 0);
        }
      }
    }

    // 6. Build response
    const totalCommissions = (payments || []).reduce((sum, p) => sum + Number(p.total_commission || 0), 0);
    const pendingCommissions = (payments || []).filter(p => p.status === 'pending').reduce((sum, p) => sum + Number(p.total_commission || 0), 0);
    const paidCommissions = (payments || []).filter(p => p.status === 'paid').reduce((sum, p) => sum + Number(p.total_commission || 0), 0);

    const byProfessional = Array.from(profAgg.values()).map(agg => ({
      professional_id: agg.professional_id,
      doctor_id: agg.doctor_id,
      doctor_name: agg.doctor_name,
      total_revenue: agg.total_commission + Array.from(agg.procedures.values()).reduce((s, p) => s + (p.total - p.commission), 0),
      total_commission: Math.round(agg.total_commission * 100) / 100,
      clinic_amount: Math.round(Array.from(agg.procedures.values()).reduce((s, p) => s + (p.total - p.commission), 0) * 100) / 100,
      pending: Math.round(agg.pending * 100) / 100,
      paid: Math.round(agg.paid * 100) / 100,
      appointments_count: agg.appointments_count,
      procedures: Array.from(agg.procedures.values()).map(p => ({
        name: p.name,
        count: p.count,
        total: Math.round(p.total * 100) / 100,
        commission: Math.round(p.commission * 100) / 100,
      })),
    })).sort((a, b) => b.total_commission - a.total_commission);

    const recentPayments = (payments || []).slice(0, 20).map(p => {
      const doc = p.doctor_id ? doctorMap.get(p.doctor_id) : null;
      const prof = profMap.get(p.professional_id);
      return {
        id: p.id,
        doctor_name: doc?.name || prof?.name || 'Profissional',
        total_commission: Number(p.total_commission),
        status: p.status,
        created_at: p.created_at,
        appointment_id: p.appointment_id,
      };
    });

    return NextResponse.json({
      range: { preset: range.preset, startDate: range.startDate, endDate: range.endDate },
      summary: {
        total_faturamento: Math.round(totalRevenue * 100) / 100,
        consultation_revenue: Math.round(consultationRevenue * 100) / 100,
        total_commissions: Math.round(totalCommissions * 100) / 100,
        total_clinic: Math.round((consultationRevenue - totalCommissions) * 100) / 100,
        pending_commissions: Math.round(pendingCommissions * 100) / 100,
        paid_commissions: Math.round(paidCommissions * 100) / 100,
      },
      by_professional: byProfessional,
      recent_payments: recentPayments,
    });
  } catch (error) {
    console.error('[Commissions API] Unexpected error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// PATCH: Mark commission as paid
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { payment_id, status } = body as { payment_id: number; status: 'paid' | 'cancelled' };

    if (!payment_id || !['paid', 'cancelled'].includes(status)) {
      return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = { status };
    if (status === 'paid') {
      updateData.paid_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('professional_payments')
      .update(updateData)
      .eq('id', payment_id)
      .eq('status', 'pending')
      .select('id, status, paid_at')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, payment: data });
  } catch (error) {
    console.error('[Commissions PATCH] Error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
