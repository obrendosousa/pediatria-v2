import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireApprovedProfile } from '@/lib/auth/requireApprovedProfile';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    await requireApprovedProfile(supabase);

    const body = await request.json().catch(() => ({}));

    const patientId = Number(body.patient_id);
    if (!Number.isInteger(patientId) || patientId <= 0) {
      return NextResponse.json({ error: 'patient_id inválido.' }, { status: 400 });
    }

    const params = {
      patient_id: patientId,
      appointment_id: body.appointment_id ? Number(body.appointment_id) : null,
      chat_id: body.chat_id ? String(body.chat_id) : null,
      notes: body.notes || null,
      return_date: body.return_date || null,
      return_obs: body.return_obs || null,
      products: body.products || null,
    };

    const { data, error } = await supabase.rpc('finish_consultation', {
      p_params: params,
    });

    if (error) {
      throw new Error(error.message || 'Erro ao finalizar consulta.');
    }

    return NextResponse.json({ success: true, result: data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao finalizar consulta.';
    console.error('[medical-record/finish]', error);
    const status =
      message === 'Usuário não autenticado.'
        ? 401
        : message === 'Acesso negado para perfil não aprovado.'
          ? 403
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
