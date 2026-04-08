import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { db: { schema: 'atendimento' } }
);

interface ProcedureDetail {
  procedure_id: string | null;
  professional_procedure_id: string | null;
  source_type: 'global' | 'professional';
  procedure_name: string;
  procedure_type: string | null;
  duration_minutes: number | null;
  unit_value: number;
  split_type: 'percentage' | 'fixed' | null;
  split_value: number | null;
}

interface SchedulingBody {
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
  appointment: {
    doctor_id: number | null;
    date: string;
    time: string;
    end_time?: string | null;
    procedures?: string[];
    appointment_subtype?: 'orcamento' | 'simples';
    is_squeeze?: boolean;
    is_teleconsultation?: boolean;
    auto_confirm?: boolean;
    description?: string | null;
  };
  procedure_details?: ProcedureDetail[];
  generate_ticket?: boolean;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as SchedulingBody;
    const { patient, appointment, procedure_details, generate_ticket } = body;

    if (!patient?.full_name) {
      return NextResponse.json({ error: 'Nome do paciente é obrigatório' }, { status: 400 });
    }
    if (!appointment?.date) {
      return NextResponse.json({ error: 'Data do agendamento é obrigatória' }, { status: 400 });
    }

    // 1. Upsert paciente
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

    // 2. Criar agendamento
    const status = appointment.auto_confirm ? 'confirmed' : 'scheduled';
    const appointmentPayload = {
      patient_id: patientId,
      doctor_id: appointment.doctor_id || null,
      date: appointment.date,
      time: appointment.time || null,
      end_time: appointment.end_time || null,
      status,
      appointment_subtype: appointment.appointment_subtype || 'simples',
      procedures: appointment.procedures && appointment.procedures.length > 0 ? appointment.procedures : null,
      is_squeeze: appointment.is_squeeze || false,
      is_teleconsultation: appointment.is_teleconsultation || false,
      auto_confirm: appointment.auto_confirm || false,
      description: appointment.description || null,
      notes: appointment.description || null,
    };

    const { data: apt, error: aptError } = await supabase
      .from('appointments')
      .insert(appointmentPayload)
      .select('id')
      .single();
    if (aptError) throw aptError;

    // 2b. Inserir procedimentos na bridge table
    if (procedure_details && procedure_details.length > 0) {
      const rows = procedure_details.map(p => {
        const unitValue = p.unit_value || 0;
        const lineTotal = unitValue; // quantity = 1

        let doctorCommission: number | null = null;
        let clinicAmount: number | null = null;
        if (p.split_type && p.split_value != null) {
          doctorCommission = p.split_type === 'percentage'
            ? Math.round(lineTotal * p.split_value / 100 * 100) / 100
            : Math.min(p.split_value, lineTotal);
          clinicAmount = Math.round((lineTotal - doctorCommission) * 100) / 100;
        }

        return {
          appointment_id: apt.id,
          source_type: p.source_type,
          procedure_id: p.procedure_id,
          professional_procedure_id: p.professional_procedure_id,
          procedure_name: p.procedure_name,
          procedure_type: p.procedure_type,
          duration_minutes: p.duration_minutes,
          unit_value: unitValue,
          quantity: 1,
          line_total: lineTotal,
          split_type: p.split_type,
          split_value: p.split_value,
          doctor_commission: doctorCommission,
          clinic_amount: clinicAmount,
        };
      });

      const { error: procError } = await supabase
        .from('appointment_procedures')
        .insert(rows);

      if (procError) {
        console.error('[Scheduling API] Error inserting appointment_procedures:', procError);
      }

      // Auto-calcular total_amount
      const totalAmount = rows.reduce((sum, r) => sum + r.line_total, 0);
      if (totalAmount > 0) {
        await supabase
          .from('appointments')
          .update({ total_amount: totalAmount })
          .eq('id', apt.id);
      }
    }

    // 3. Gerar ticket vinculado (opcional)
    let ticketId: number | null = null;
    if (generate_ticket && apt) {
      const { data: ticketNumber } = await supabase
        .rpc('next_ticket_number', { p_prefix: 'N' });

      if (ticketNumber) {
        const { data: ticket } = await supabase
          .from('queue_tickets')
          .insert({
            appointment_id: apt.id,
            patient_id: patientId,
            patient_name: patient.full_name,
            ticket_number: ticketNumber as string,
            ticket_type: 'guiche',
            queue_stage: 'reception',
            is_priority: false,
            status: 'waiting',
            source_schema: 'atendimento',
          })
          .select('id')
          .single();
        ticketId = ticket?.id || null;
      }
    }

    return NextResponse.json({
      patient_id: patientId,
      appointment_id: apt.id,
      ticket_id: ticketId,
    });
  } catch (error) {
    console.error('[Scheduling API] Erro:', error);
    const pgCode = (error as { code?: string })?.code;
    if (pgCode === '23505') {
      return NextResponse.json({ error: 'CPF já cadastrado para outro paciente.' }, { status: 409 });
    }
    return NextResponse.json(
      { error: 'Erro interno ao criar agendamento: ' + (error instanceof Error ? error.message : 'Tente novamente.') },
      { status: 500 }
    );
  }
}
