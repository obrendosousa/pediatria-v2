import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCRMMetricsPayload, resolveRange } from '@/lib/crm/metrics';
import type { Appointment } from '@/types/medical';

function iso(input: string): string {
  return new Date(input).toISOString();
}

test('resolveRange custom calcula janela anterior equivalente', () => {
  const range = resolveRange({
    granularity: 'custom',
    startDate: '2026-02-10',
    endDate: '2026-02-12',
  });

  assert.equal(range.granularity, 'custom');
  const currentDuration = range.currentEndUtcMs - range.currentStartUtcMs;
  const previousDuration = range.previousEndUtcMs - range.previousStartUtcMs;
  assert.equal(currentDuration, previousDuration);
  assert.ok(range.previousEndUtcMs === range.currentStartUtcMs);
});

test('buildCRMMetricsPayload calcula resposta comercial e descarte >24h', () => {
  const range = resolveRange({
    granularity: 'day',
    date: '2026-02-13',
  });

  const chats = [{ id: 1, created_at: iso('2026-02-13T12:00:00.000Z') }];
  const appointments: Appointment[] = [
    {
      id: 11,
      start_time: iso('2026-02-13T13:00:00.000Z'),
      created_at: iso('2026-02-13T12:30:00.000Z'),
      status: 'finished',
      patient_id: 22,
      chat_id: 1,
      queue_entered_at: iso('2026-02-13T12:50:00.000Z'),
      in_service_at: iso('2026-02-13T13:00:00.000Z'),
      finished_at: iso('2026-02-13T13:45:00.000Z'),
      patient_name: 'Paciente',
      patient_phone: null,
      doctor_name: 'Dra',
      doctor_id: 1,
    },
  ];

  const historicalFinished: Appointment[] = [
    {
      id: 1,
      start_time: iso('2026-01-10T12:00:00.000Z'),
      created_at: iso('2026-01-10T12:00:00.000Z'),
      status: 'finished',
      patient_id: 22,
      finished_at: iso('2026-01-10T12:40:00.000Z'),
      patient_name: 'Paciente',
      patient_phone: null,
      doctor_name: 'Dra',
      doctor_id: 1,
    },
  ];

  const medicalRecords = [
    {
      id: 100,
      appointment_id: 11,
      started_at: iso('2026-02-13T13:00:00.000Z'),
      finished_at: iso('2026-02-13T13:30:00.000Z'),
      created_at: iso('2026-02-13T13:00:00.000Z'),
    },
  ];

  const messages = [
    // ciclo 1: 15 min
    { id: 1, chat_id: 1, sender: 'CUSTOMER', created_at: iso('2026-02-13T12:05:00.000Z') },
    { id: 2, chat_id: 1, sender: 'HUMAN_AGENT', created_at: iso('2026-02-13T12:20:00.000Z'), tool_data: { source: 'manual_chat' } },
    // ciclo 2: 10 min uteis (17:50 -> 18:10)
    { id: 3, chat_id: 1, sender: 'CUSTOMER', created_at: iso('2026-02-13T20:50:00.000Z') },
    { id: 4, chat_id: 1, sender: 'HUMAN_AGENT', created_at: iso('2026-02-13T21:10:00.000Z'), tool_data: { source: 'manual_chat' } },
    // ciclo 3: 30 min uteis (07:30 -> 08:30 local)
    { id: 5, chat_id: 1, sender: 'CUSTOMER', created_at: iso('2026-02-13T10:30:00.000Z') },
    { id: 6, chat_id: 1, sender: 'HUMAN_AGENT', created_at: iso('2026-02-13T11:30:00.000Z'), tool_data: { source: 'manual_chat' } },
    // ciclo 4: descartado >24h
    { id: 7, chat_id: 1, sender: 'CUSTOMER', created_at: iso('2026-02-13T23:00:00.000Z') },
    { id: 8, chat_id: 1, sender: 'HUMAN_AGENT', created_at: iso('2026-02-15T13:00:00.000Z'), tool_data: { source: 'manual_chat' } },
    // automacao deve ser ignorada
    { id: 9, chat_id: 1, sender: 'HUMAN_AGENT', created_at: iso('2026-02-13T12:25:00.000Z'), auto_sent_pause_session: 'abc' },
  ];

  const payload = buildCRMMetricsPayload({
    range,
    chats,
    appointments,
    historicalFinishedAppointments: historicalFinished,
    medicalRecords,
    messages,
  });

  assert.equal(payload.averageQueueTime, 10);
  assert.equal(payload.averageServiceTime, 30);
  assert.equal(payload.averageResponseTime, 18);
  assert.equal(payload.conversionRate, 100);
  assert.equal(payload.returnRate, 100);
  assert.equal(payload.coverage.responseCycles, 3);
  assert.equal(payload.coverage.responseDiscardedOver24h, 1);
});

