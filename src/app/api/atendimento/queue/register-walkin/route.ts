import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { db: { schema: 'atendimento' } }
);

interface RegisterWalkinBody {
  ticket_id: number;
  patient: {
    id?: number | null;
    full_name: string;
    sex?: 'M' | 'F' | null;
    birth_date?: string | null;
    zone?: string | null;
    address_type?: string | null;
    address_street?: string | null;
    address_number?: string | null;
    address_neighborhood?: string | null;
    phone?: string | null;
    email?: string | null;
    cpf?: string | null;
    active?: boolean;
    notes?: string | null;
  };
  doctor_id?: number | null;
  procedures?: string[];
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RegisterWalkinBody;
    const { ticket_id, patient, doctor_id, procedures } = body;

    if (!ticket_id) {
      return NextResponse.json({ error: 'ticket_id é obrigatório' }, { status: 400 });
    }
    if (!patient?.full_name) {
      return NextResponse.json({ error: 'Nome do paciente é obrigatório' }, { status: 400 });
    }

    // 1. Verificar que o ticket existe e é avulso
    const { data: existingTicket, error: ticketCheckErr } = await supabase
      .from('queue_tickets')
      .select('id, appointment_id, status')
      .eq('id', ticket_id)
      .single();

    if (ticketCheckErr || !existingTicket) {
      return NextResponse.json({ error: 'Ticket não encontrado' }, { status: 404 });
    }

    if (existingTicket.appointment_id) {
      return NextResponse.json({ error: 'Este ticket já está vinculado a um agendamento' }, { status: 400 });
    }

    // 2. Criar ou atualizar paciente
    let patientId = patient.id;

    const address = (patient.address_street || patient.address_number || patient.address_neighborhood)
      ? {
          street: patient.address_street || '',
          number: patient.address_number || '',
          neighborhood: patient.address_neighborhood || '',
        }
      : null;

    const patientPayload = {
      full_name: patient.full_name,
      sex: patient.sex || null,
      birth_date: patient.birth_date || null,
      zone: patient.zone || null,
      address_type: patient.address_type || null,
      address,
      phone: patient.phone || null,
      email: patient.email || null,
      cpf: patient.cpf || null,
      active: patient.active ?? true,
      notes: patient.notes || null,
    };

    if (patientId) {
      const { error } = await supabase
        .from('patients')
        .update(patientPayload)
        .eq('id', patientId);
      if (error) throw error;
    } else {
      const { data: inserted, error } = await supabase
        .from('patients')
        .insert(patientPayload)
        .select('id')
        .single();
      if (error) throw error;
      patientId = inserted.id;
    }

    // 3. Criar appointment vinculado
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toTimeString().slice(0, 5);

    const appointmentPayload = {
      patient_id: patientId,
      doctor_id: doctor_id || null,
      date: today,
      time: now,
      status: 'waiting',
      procedures: procedures && procedures.length > 0 ? procedures : null,
      patient_name: patient.full_name,
      patient_phone: patient.phone || null,
      patient_sex: patient.sex || null,
      appointment_subtype: 'simples',
    };

    const { data: apt, error: aptError } = await supabase
      .from('appointments')
      .insert(appointmentPayload)
      .select('id')
      .single();
    if (aptError) throw aptError;

    // 4. Vincular ticket ao appointment e paciente
    const { error: updateError } = await supabase
      .from('queue_tickets')
      .update({
        appointment_id: apt.id,
        patient_id: patientId,
        patient_name: patient.full_name,
      })
      .eq('id', ticket_id);
    if (updateError) throw updateError;

    return NextResponse.json({
      patient_id: patientId,
      appointment_id: apt.id,
      ticket_id,
    });
  } catch (error) {
    console.error('[Register Walkin API] Erro:', error);
    const pgCode = (error as { code?: string })?.code;
    if (pgCode === '23505') {
      return NextResponse.json({ error: 'CPF já cadastrado para outro paciente.' }, { status: 409 });
    }
    return NextResponse.json(
      { error: 'Erro interno: ' + (error instanceof Error ? error.message : 'Tente novamente.') },
      { status: 500 }
    );
  }
}
