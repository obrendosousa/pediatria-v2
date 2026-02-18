import type { Appointment } from '@/types/medical';

type Granularity = 'day' | 'month' | 'custom';

const SAO_PAULO_OFFSET_MINUTES = -180;
const SAO_PAULO_OFFSET_MS = SAO_PAULO_OFFSET_MINUTES * 60 * 1000;
const MINUTES_24H = 24 * 60;

type Trend = { value: number; isPositive: boolean };

type FunnelItem = { name: string; value: number; fill: string };

export type TrendPoint = {
  name: string;
  date: string;
  queueTime: number;
  serviceTime: number;
  responseTime: number;
  conversionRate: number;
  returnRate: number;
  pendingResponses: number;
};

export type CoverageStats = {
  queueEligible: number;
  queueInvalid: number;
  serviceEligible: number;
  serviceInvalid: number;
  responseCycles: number;
  responseDiscardedOver24h: number;
};

export type ResponseDistribution = {
  p50: number;
  p90: number;
  mean: number;
  count: number;
};

export type CRMMetricsPayload = {
  averageQueueTime: number;
  averageServiceTime: number;
  averageResponseTime: number;
  conversionRate: number;
  returnRate: number;
  leadToConsultationRate: number;
  totalChats: number;
  totalAppointments: number;
  totalFinished: number;
  totalWaiting: number;
  totalInService: number;
  pendingResponseCount: number;
  pendingResponseOver24hCount: number;
  queueTimeTrend: Trend;
  serviceTimeTrend: Trend;
  responseTimeTrend: Trend;
  conversionTrend: Trend;
  returnTrend: Trend;
  pendingResponseTrend: Trend;
  funnelData: FunnelItem[];
  trendData: TrendPoint[];
  coverage: CoverageStats;
  responseDistribution: ResponseDistribution;
  period: {
    granularity: Granularity;
    start: string;
    end: string;
    previousStart: string;
    previousEnd: string;
    timezone: 'America/Sao_Paulo';
  };
};

export type ChatRow = {
  id: number;
  created_at: string | null;
};

export type MessageRow = {
  id: number | string;
  chat_id: number | string | null;
  sender: string | null;
  created_at: string | null;
  auto_sent_pause_session?: string | null;
  tool_data?: Record<string, unknown> | null;
};

export type MedicalRecordRow = {
  id: number;
  appointment_id: number | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string | null;
};

type ResolvedRange = {
  granularity: Granularity;
  currentStartUtcMs: number;
  currentEndUtcMs: number;
  previousStartUtcMs: number;
  previousEndUtcMs: number;
};

type AggregateResult = {
  averageQueueTime: number;
  averageServiceTime: number;
  averageResponseTime: number;
  conversionRate: number;
  returnRate: number;
  totalChats: number;
  totalAppointments: number;
  totalFinished: number;
  totalWaiting: number;
  totalInService: number;
  pendingResponseCount: number;
  pendingResponseOver24hCount: number;
  queueTimes: number[];
  serviceTimes: number[];
  responseTimes: number[];
  responseDiscardedOver24h: number;
  funnelData: FunnelItem[];
};

function parseDateParts(dateStr: string): { year: number; month: number; day: number } {
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some((p) => Number.isNaN(p))) {
    throw new Error(`Data invalida: ${dateStr}`);
  }
  return { year: parts[0], month: parts[1], day: parts[2] };
}

function localToUtcMs(year: number, month: number, day: number, hour = 0, minute = 0, second = 0, ms = 0): number {
  return Date.UTC(year, month - 1, day, hour, minute, second, ms) - SAO_PAULO_OFFSET_MS;
}

function utcToLocalDate(utcMs: number): Date {
  return new Date(utcMs + SAO_PAULO_OFFSET_MS);
}

function formatLocalDate(utcMs: number): string {
  const local = utcToLocalDate(utcMs);
  const y = local.getUTCFullYear();
  const m = String(local.getUTCMonth() + 1).padStart(2, '0');
  const d = String(local.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getWeekdayShort(utcMs: number): string {
  const labels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
  const local = utcToLocalDate(utcMs);
  return labels[local.getUTCDay()] || 'N/A';
}

function startOfDayUtcMs(dateStr: string): number {
  const { year, month, day } = parseDateParts(dateStr);
  return localToUtcMs(year, month, day, 0, 0, 0, 0);
}

function endExclusiveOfDayUtcMs(dateStr: string): number {
  const { year, month, day } = parseDateParts(dateStr);
  const localMidnightMs = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
  const nextLocalMidnight = localMidnightMs + 24 * 60 * 60 * 1000;
  const nextLocal = new Date(nextLocalMidnight);
  return localToUtcMs(
    nextLocal.getUTCFullYear(),
    nextLocal.getUTCMonth() + 1,
    nextLocal.getUTCDate(),
    0,
    0,
    0,
    0
  );
}

export function resolveRange(params: {
  granularity?: string | null;
  date?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}): ResolvedRange {
  const granularity = (params.granularity || 'day') as Granularity;
  const referenceDate = params.date || formatLocalDate(Date.now());

  if (granularity === 'custom') {
    if (!params.startDate || !params.endDate) {
      throw new Error('Para granularity=custom, startDate e endDate sao obrigatorios.');
    }
    const start = startOfDayUtcMs(params.startDate);
    const endExclusive = endExclusiveOfDayUtcMs(params.endDate);
    if (endExclusive <= start) {
      throw new Error('Intervalo custom invalido.');
    }
    const duration = endExclusive - start;
    return {
      granularity,
      currentStartUtcMs: start,
      currentEndUtcMs: endExclusive,
      previousStartUtcMs: start - duration,
      previousEndUtcMs: start,
    };
  }

  if (granularity === 'month') {
    const { year, month } = parseDateParts(referenceDate);
    const currentStart = localToUtcMs(year, month, 1);
    const nextMonth = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
    const currentEnd = localToUtcMs(nextMonth.y, nextMonth.m, 1);
    const prevMonth = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
    const previousStart = localToUtcMs(prevMonth.y, prevMonth.m, 1);
    return {
      granularity,
      currentStartUtcMs: currentStart,
      currentEndUtcMs: currentEnd,
      previousStartUtcMs: previousStart,
      previousEndUtcMs: currentStart,
    };
  }

  const currentStart = startOfDayUtcMs(referenceDate);
  const currentEnd = endExclusiveOfDayUtcMs(referenceDate);
  const duration = currentEnd - currentStart;
  return {
    granularity: 'day',
    currentStartUtcMs: currentStart,
    currentEndUtcMs: currentEnd,
    previousStartUtcMs: currentStart - duration,
    previousEndUtcMs: currentStart,
  };
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((acc, value) => acc + value, 0) / values.length);
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return Math.round(sorted[idx]);
}

function computeTrend(current: number, previous: number, lowerIsBetter: boolean): Trend {
  const delta = current - previous;
  return {
    value: Math.abs(Number(delta.toFixed(1))),
    isPositive: lowerIsBetter ? delta < 0 : delta > 0,
  };
}

function toTimestampMs(input: string | null | undefined): number | null {
  if (!input) return null;
  const value = new Date(input).getTime();
  return Number.isFinite(value) ? value : null;
}

function isWithinRange(ts: number | null, startInclusive: number, endExclusive: number): boolean {
  return ts !== null && ts >= startInclusive && ts < endExclusive;
}

function isIncomingMessage(msg: MessageRow): boolean {
  const sender = (msg.sender || '').toUpperCase();
  return sender !== 'HUMAN_AGENT' && sender !== 'AI_AGENT' && sender !== 'ME';
}

function hasAutomationMarker(toolData: Record<string, unknown> | null | undefined): boolean {
  if (!toolData || typeof toolData !== 'object') return false;
  const source = String(toolData.source || toolData.origin || toolData.automation_source || '').toLowerCase();
  if (source.includes('automation') || source.includes('macro') || source.includes('funnel') || source.includes('pause')) {
    return true;
  }
  if (typeof toolData.is_automation === 'boolean') return Boolean(toolData.is_automation);
  return false;
}

function isManualOutgoingMessage(msg: MessageRow): boolean {
  const sender = (msg.sender || '').toUpperCase();
  if (sender !== 'HUMAN_AGENT') return false;
  if (msg.auto_sent_pause_session) return false;
  if (hasAutomationMarker(msg.tool_data)) return false;
  return true;
}

function businessMinutesBetween(startUtcMs: number, endUtcMs: number): number {
  if (endUtcMs <= startUtcMs) return 0;

  const startLocalMs = startUtcMs + SAO_PAULO_OFFSET_MS;
  const endLocalMs = endUtcMs + SAO_PAULO_OFFSET_MS;
  let totalMs = 0;

  const startLocalDate = new Date(startLocalMs);
  const cursorLocalMidnight = Date.UTC(
    startLocalDate.getUTCFullYear(),
    startLocalDate.getUTCMonth(),
    startLocalDate.getUTCDate(),
    0,
    0,
    0,
    0
  );
  const endLocalDate = new Date(endLocalMs);
  const endLocalMidnight = Date.UTC(
    endLocalDate.getUTCFullYear(),
    endLocalDate.getUTCMonth(),
    endLocalDate.getUTCDate(),
    0,
    0,
    0,
    0
  );

  for (let dayMs = cursorLocalMidnight; dayMs <= endLocalMidnight; dayMs += 24 * 60 * 60 * 1000) {
    const day = new Date(dayMs);
    const weekday = day.getUTCDay();
    if (weekday === 0 || weekday === 6) {
      continue;
    }

    const y = day.getUTCFullYear();
    const m = day.getUTCMonth();
    const d = day.getUTCDate();
    const windowStart = Date.UTC(y, m, d, 8, 0, 0, 0);
    const windowEnd = Date.UTC(y, m, d, 18, 0, 0, 0);
    const overlapStart = Math.max(startLocalMs, windowStart);
    const overlapEnd = Math.min(endLocalMs, windowEnd);
    if (overlapEnd > overlapStart) {
      totalMs += overlapEnd - overlapStart;
    }
  }

  return Math.round(totalMs / (1000 * 60));
}

function getAppointmentReferenceMs(apt: Appointment): number | null {
  return toTimestampMs(apt.start_time) ?? toTimestampMs(apt.created_at);
}

function aggregateMetrics(params: {
  rangeStartUtcMs: number;
  rangeEndUtcMs: number;
  chats: ChatRow[];
  appointments: Appointment[];
  historicalFinishedAppointments: Appointment[];
  medicalRecords: MedicalRecordRow[];
  messages: MessageRow[];
}): AggregateResult {
  const { rangeStartUtcMs, rangeEndUtcMs, chats, appointments, historicalFinishedAppointments, medicalRecords, messages } = params;

  const initiatedChats = chats.filter((chat) =>
    isWithinRange(toTimestampMs(chat.created_at), rangeStartUtcMs, rangeEndUtcMs)
  );
  const initiatedChatIds = new Set(initiatedChats.map((chat) => chat.id));

  const appointmentsInRange = appointments.filter((apt) => {
    const ref = getAppointmentReferenceMs(apt);
    return isWithinRange(ref, rangeStartUtcMs, rangeEndUtcMs);
  });

  const originatedAppointments = appointmentsInRange.filter((apt) => {
    const chatId = apt.chat_id;
    return typeof chatId === 'number' && initiatedChatIds.has(chatId);
  });

  const queueTimes: number[] = [];
  for (const apt of appointmentsInRange) {
    const queueEnteredAt = toTimestampMs(apt.queue_entered_at || null);
    const inServiceAt = toTimestampMs(apt.in_service_at || null);
    const finishedAt = toTimestampMs(apt.finished_at || null);
    if (!isWithinRange(finishedAt, rangeStartUtcMs, rangeEndUtcMs)) continue;
    if (queueEnteredAt === null || inServiceAt === null || inServiceAt <= queueEnteredAt) {
      continue;
    }
    queueTimes.push(Math.round((inServiceAt - queueEnteredAt) / (1000 * 60)));
  }

  const serviceTimes: number[] = [];
  for (const record of medicalRecords) {
    if (!record.appointment_id) {
      continue;
    }
    const startedAt = toTimestampMs(record.started_at);
    const finishedAt = toTimestampMs(record.finished_at);
    if (!isWithinRange(finishedAt, rangeStartUtcMs, rangeEndUtcMs)) continue;
    if (startedAt === null || finishedAt === null || finishedAt <= startedAt) {
      continue;
    }
    serviceTimes.push(Math.round((finishedAt - startedAt) / (1000 * 60)));
  }

  const messagesByChat = new Map<number, MessageRow[]>();
  for (const msg of messages) {
    const chatId = typeof msg.chat_id === 'string' ? Number(msg.chat_id) : msg.chat_id;
    if (!chatId || Number.isNaN(chatId)) continue;
    const list = messagesByChat.get(chatId) || [];
    list.push(msg);
    messagesByChat.set(chatId, list);
  }

  const responseTimes: number[] = [];
  let responseDiscardedOver24h = 0;
  let pendingResponseCount = 0;
  let pendingResponseOver24hCount = 0;
  for (const [chatId, chatMessages] of messagesByChat.entries()) {
    if (!initiatedChatIds.has(chatId)) continue;
    chatMessages.sort((a, b) => {
      const t1 = toTimestampMs(a.created_at) ?? 0;
      const t2 = toTimestampMs(b.created_at) ?? 0;
      return t1 - t2;
    });
    let pendingIncomingAt: number | null = null;

    for (const msg of chatMessages) {
      const ts = toTimestampMs(msg.created_at);
      if (ts === null) continue;
      if (isIncomingMessage(msg)) {
        if (isWithinRange(ts, rangeStartUtcMs, rangeEndUtcMs)) {
          pendingIncomingAt = ts;
        }
        continue;
      }

      if (pendingIncomingAt === null) continue;
      if (!isManualOutgoingMessage(msg)) continue;

      const diffMinutes = Math.round((ts - pendingIncomingAt) / (1000 * 60));
      if (diffMinutes < 0) {
        pendingIncomingAt = null;
        continue;
      }
      if (diffMinutes > MINUTES_24H) {
        responseDiscardedOver24h += 1;
        pendingIncomingAt = null;
        continue;
      }

      const businessMinutes = businessMinutesBetween(pendingIncomingAt, ts);
      responseTimes.push(businessMinutes);
      pendingIncomingAt = null;
    }

    if (pendingIncomingAt !== null) {
      pendingResponseCount += 1;
      const diffOpenMinutes = Math.round((rangeEndUtcMs - pendingIncomingAt) / (1000 * 60));
      if (diffOpenMinutes > MINUTES_24H) {
        pendingResponseOver24hCount += 1;
      }
    }
  }

  const previousFinishedByPatient = new Map<number, number[]>();
  for (const apt of historicalFinishedAppointments) {
    if (!apt.patient_id) continue;
    const finishedRef = toTimestampMs(apt.finished_at || apt.start_time || apt.created_at || null);
    if (finishedRef === null) continue;
    const list = previousFinishedByPatient.get(apt.patient_id) || [];
    list.push(finishedRef);
    previousFinishedByPatient.set(apt.patient_id, list);
  }
  for (const list of previousFinishedByPatient.values()) {
    list.sort((a, b) => a - b);
  }

  let returningAppointments = 0;
  for (const apt of originatedAppointments) {
    if (!apt.patient_id) continue;
    const aptRef = getAppointmentReferenceMs(apt);
    if (aptRef === null) continue;
    const history = previousFinishedByPatient.get(apt.patient_id);
    if (!history || history.length === 0) continue;
    if (history.some((finishedAt) => finishedAt < aptRef)) {
      returningAppointments += 1;
    }
  }

  const conversionRate =
    initiatedChats.length > 0 ? (originatedAppointments.length / initiatedChats.length) * 100 : 0;
  const returnRate =
    originatedAppointments.length > 0 ? (returningAppointments / originatedAppointments.length) * 100 : 0;

  const totalFinished = appointmentsInRange.filter((apt) => apt.status === 'finished').length;
  const totalWaiting = appointmentsInRange.filter((apt) => apt.status === 'waiting').length;
  const totalInService = appointmentsInRange.filter((apt) => apt.status === 'in_service').length;

  return {
    averageQueueTime: average(queueTimes),
    averageServiceTime: average(serviceTimes),
    averageResponseTime: average(responseTimes),
    conversionRate: Number(conversionRate.toFixed(1)),
    returnRate: Number(returnRate.toFixed(1)),
    totalChats: initiatedChats.length,
    totalAppointments: originatedAppointments.length,
    totalFinished,
    totalWaiting,
    totalInService,
    pendingResponseCount,
    pendingResponseOver24hCount,
    queueTimes,
    serviceTimes,
    responseTimes,
    responseDiscardedOver24h,
    funnelData: [
      { name: 'Conversas iniciadas', value: initiatedChats.length, fill: '#3b82f6' },
      { name: 'Agendamentos', value: originatedAppointments.length, fill: '#a855f7' },
      { name: 'Consultas finalizadas', value: totalFinished, fill: '#10b981' },
    ],
  };
}

export function buildCRMMetricsPayload(params: {
  range: ResolvedRange;
  chats: ChatRow[];
  appointments: Appointment[];
  historicalFinishedAppointments: Appointment[];
  medicalRecords: MedicalRecordRow[];
  messages: MessageRow[];
}): CRMMetricsPayload {
  const current = aggregateMetrics({
    rangeStartUtcMs: params.range.currentStartUtcMs,
    rangeEndUtcMs: params.range.currentEndUtcMs,
    chats: params.chats,
    appointments: params.appointments,
    historicalFinishedAppointments: params.historicalFinishedAppointments,
    medicalRecords: params.medicalRecords,
    messages: params.messages,
  });

  const previous = aggregateMetrics({
    rangeStartUtcMs: params.range.previousStartUtcMs,
    rangeEndUtcMs: params.range.previousEndUtcMs,
    chats: params.chats,
    appointments: params.appointments,
    historicalFinishedAppointments: params.historicalFinishedAppointments,
    medicalRecords: params.medicalRecords,
    messages: params.messages,
  });

  const trendData: TrendPoint[] = [];
  const totalDays = Math.min(
    14,
    Math.max(7, Math.ceil((params.range.currentEndUtcMs - params.range.currentStartUtcMs) / (24 * 60 * 60 * 1000)))
  );
  for (let i = totalDays - 1; i >= 0; i -= 1) {
    const dayStart = params.range.currentEndUtcMs - (i + 1) * 24 * 60 * 60 * 1000;
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;
    const day = aggregateMetrics({
      rangeStartUtcMs: dayStart,
      rangeEndUtcMs: dayEnd,
      chats: params.chats,
      appointments: params.appointments,
      historicalFinishedAppointments: params.historicalFinishedAppointments,
      medicalRecords: params.medicalRecords,
      messages: params.messages,
    });
    trendData.push({
      name: getWeekdayShort(dayStart),
      date: formatLocalDate(dayStart),
      queueTime: day.averageQueueTime,
      serviceTime: day.averageServiceTime,
      responseTime: day.averageResponseTime,
      conversionRate: day.conversionRate,
      returnRate: day.returnRate,
      pendingResponses: day.pendingResponseCount,
    });
  }

  return {
    averageQueueTime: current.averageQueueTime,
    averageServiceTime: current.averageServiceTime,
    averageResponseTime: current.averageResponseTime,
    conversionRate: current.conversionRate,
    returnRate: current.returnRate,
    leadToConsultationRate: current.conversionRate,
    totalChats: current.totalChats,
    totalAppointments: current.totalAppointments,
    totalFinished: current.totalFinished,
    totalWaiting: current.totalWaiting,
    totalInService: current.totalInService,
    pendingResponseCount: current.pendingResponseCount,
    pendingResponseOver24hCount: current.pendingResponseOver24hCount,
    queueTimeTrend: computeTrend(current.averageQueueTime, previous.averageQueueTime, true),
    serviceTimeTrend: computeTrend(current.averageServiceTime, previous.averageServiceTime, true),
    responseTimeTrend: computeTrend(current.averageResponseTime, previous.averageResponseTime, true),
    conversionTrend: computeTrend(current.conversionRate, previous.conversionRate, false),
    returnTrend: computeTrend(current.returnRate, previous.returnRate, false),
    pendingResponseTrend: computeTrend(current.pendingResponseCount, previous.pendingResponseCount, true),
    funnelData: current.funnelData,
    trendData,
    coverage: {
      queueEligible: current.queueTimes.length,
      queueInvalid: Math.max(0, current.totalFinished - current.queueTimes.length),
      serviceEligible: current.serviceTimes.length,
      serviceInvalid: Math.max(0, current.totalFinished - current.serviceTimes.length),
      responseCycles: current.responseTimes.length,
      responseDiscardedOver24h: current.responseDiscardedOver24h,
    },
    responseDistribution: {
      p50: percentile(current.responseTimes, 50),
      p90: percentile(current.responseTimes, 90),
      mean: average(current.responseTimes),
      count: current.responseTimes.length,
    },
    period: {
      granularity: params.range.granularity,
      start: formatLocalDate(params.range.currentStartUtcMs),
      end: formatLocalDate(params.range.currentEndUtcMs - 1),
      previousStart: formatLocalDate(params.range.previousStartUtcMs),
      previousEnd: formatLocalDate(params.range.previousEndUtcMs - 1),
      timezone: 'America/Sao_Paulo',
    },
  };
}

