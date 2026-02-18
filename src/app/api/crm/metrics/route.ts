import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/automation/adapters/supabaseAdmin';
import { buildCRMMetricsPayload, resolveRange } from '@/lib/crm/metrics';
import type { Appointment } from '@/types/medical';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const range = resolveRange({
      granularity: searchParams.get('granularity'),
      date: searchParams.get('date'),
      startDate: searchParams.get('startDate'),
      endDate: searchParams.get('endDate'),
    });

    const supabase = getSupabaseAdminClient();
    const currentEndIso = new Date(range.currentEndUtcMs).toISOString();
    const previousStartIso = new Date(range.previousStartUtcMs).toISOString();
    const messagesEndIso = new Date(range.currentEndUtcMs + 24 * 60 * 60 * 1000).toISOString();

    const [chatsResult, appointmentsByStartResult, appointmentsByCreatedResult, historicalFinishedResult, medicalRecordsResult, messagesResult] = await Promise.all([
      supabase
        .from('chats')
        .select('id, created_at')
        .gte('created_at', previousStartIso)
        .lt('created_at', currentEndIso),
      supabase
        .from('appointments')
        .select(
          'id, start_time, created_at, status, patient_id, chat_id, queue_entered_at, in_service_at, finished_at'
        )
        .gte('start_time', previousStartIso)
        .lt('start_time', currentEndIso),
      supabase
        .from('appointments')
        .select(
          'id, start_time, created_at, status, patient_id, chat_id, queue_entered_at, in_service_at, finished_at'
        )
        .gte('created_at', previousStartIso)
        .lt('created_at', currentEndIso),
      supabase
        .from('appointments')
        .select('id, patient_id, status, start_time, created_at, finished_at')
        .eq('status', 'finished')
        .lt('start_time', currentEndIso),
      supabase
        .from('medical_records')
        .select('id, appointment_id, started_at, finished_at, created_at')
        .gte('finished_at', previousStartIso)
        .lt('finished_at', currentEndIso),
      supabase
        .from('chat_messages')
        .select('id, chat_id, sender, created_at, auto_sent_pause_session, tool_data')
        .gte('created_at', previousStartIso)
        .lt('created_at', messagesEndIso)
        .order('created_at', { ascending: true }),
    ]);

    if (chatsResult.error) throw chatsResult.error;
    if (appointmentsByStartResult.error) throw appointmentsByStartResult.error;
    if (appointmentsByCreatedResult.error) throw appointmentsByCreatedResult.error;
    if (historicalFinishedResult.error) throw historicalFinishedResult.error;
    if (medicalRecordsResult.error) throw medicalRecordsResult.error;
    if (messagesResult.error) throw messagesResult.error;

    const appointmentsMap = new Map<number, Appointment>();
    for (const apt of appointmentsByStartResult.data || []) {
      appointmentsMap.set(apt.id, apt as Appointment);
    }
    for (const apt of appointmentsByCreatedResult.data || []) {
      appointmentsMap.set(apt.id, apt as Appointment);
    }

    const payload = buildCRMMetricsPayload({
      range,
      chats: chatsResult.data || [],
      appointments: Array.from(appointmentsMap.values()),
      historicalFinishedAppointments: (historicalFinishedResult.data || []) as Appointment[],
      medicalRecords: medicalRecordsResult.data || [],
      messages: messagesResult.data || [],
    });

    return NextResponse.json(payload);
  } catch (error: unknown) {
    console.error('[crm/metrics] erro ao calcular métricas:', error);
    const message = error instanceof Error ? error.message : 'Erro ao calcular métricas CRM';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

