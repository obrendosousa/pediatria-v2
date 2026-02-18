import type { CRMMetricsPayload } from '@/lib/crm/metrics';

type Trend = { value: number; isPositive: boolean };

export type CRMMetricsViewModel = {
  averageQueueTime: number;
  averageServiceTime: number;
  averageResponseTime: number;
  leadToConsultationRate: number;
  returnRate: number;
  pendingResponseCount: number;
  pendingResponseOver24hCount: number;
  totalChats: number;
  totalAppointments: number;
  totalFinished: number;
  totalWaiting: number;
  totalInService: number;
  queueTimeTrend: Trend;
  serviceTimeTrend: Trend;
  responseTimeTrend: Trend;
  conversionTrend: Trend;
  returnTrend: Trend;
  pendingResponseTrend: Trend;
  trendData: CRMMetricsPayload['trendData'];
  funnelData: CRMMetricsPayload['funnelData'];
  coverage: CRMMetricsPayload['coverage'];
  responseDistribution: CRMMetricsPayload['responseDistribution'];
  abandonmentRate: number;
  criticalPendingRate: number;
  operationalLoad: number;
  throughputDaily: number;
};

const EMPTY_TREND: Trend = { value: 0, isPositive: true };

const EMPTY_PAYLOAD: CRMMetricsViewModel = {
  averageQueueTime: 0,
  averageServiceTime: 0,
  averageResponseTime: 0,
  leadToConsultationRate: 0,
  returnRate: 0,
  pendingResponseCount: 0,
  pendingResponseOver24hCount: 0,
  totalChats: 0,
  totalAppointments: 0,
  totalFinished: 0,
  totalWaiting: 0,
  totalInService: 0,
  queueTimeTrend: EMPTY_TREND,
  serviceTimeTrend: EMPTY_TREND,
  responseTimeTrend: EMPTY_TREND,
  conversionTrend: EMPTY_TREND,
  returnTrend: EMPTY_TREND,
  pendingResponseTrend: EMPTY_TREND,
  funnelData: [
    { name: 'Conversas', value: 0, fill: '#3b82f6' },
    { name: 'Agendamentos', value: 0, fill: '#8b5cf6' },
    { name: 'Finalizadas', value: 0, fill: '#10b981' },
  ],
  trendData: [],
  responseDistribution: { p50: 0, p90: 0, mean: 0, count: 0 },
  coverage: {
    queueEligible: 0,
    queueInvalid: 0,
    serviceEligible: 0,
    serviceInvalid: 0,
    responseCycles: 0,
    responseDiscardedOver24h: 0,
  },
  abandonmentRate: 0,
  criticalPendingRate: 0,
  operationalLoad: 0,
  throughputDaily: 0,
};

const toPercent = (value: number) => Number.isFinite(value) ? Math.max(0, value) : 0;

export function buildCRMMetricsViewModel(metrics: CRMMetricsPayload | null): CRMMetricsViewModel {
  if (!metrics) return EMPTY_PAYLOAD;

  const abandonmentRate = metrics.totalChats > 0
    ? ((metrics.totalChats - metrics.totalAppointments) / metrics.totalChats) * 100
    : 0;

  const criticalPendingRate = metrics.pendingResponseCount > 0
    ? (metrics.pendingResponseOver24hCount / metrics.pendingResponseCount) * 100
    : 0;

  const operationalLoad = metrics.totalWaiting + metrics.totalInService;
  const throughputDaily = metrics.trendData.length > 0
    ? metrics.totalFinished / metrics.trendData.length
    : metrics.totalFinished;

  return {
    averageQueueTime: metrics.averageQueueTime,
    averageServiceTime: metrics.averageServiceTime,
    averageResponseTime: metrics.averageResponseTime,
    leadToConsultationRate: metrics.leadToConsultationRate,
    returnRate: metrics.returnRate,
    pendingResponseCount: metrics.pendingResponseCount,
    pendingResponseOver24hCount: metrics.pendingResponseOver24hCount,
    totalChats: metrics.totalChats,
    totalAppointments: metrics.totalAppointments,
    totalFinished: metrics.totalFinished,
    totalWaiting: metrics.totalWaiting,
    totalInService: metrics.totalInService,
    queueTimeTrend: metrics.queueTimeTrend,
    serviceTimeTrend: metrics.serviceTimeTrend,
    responseTimeTrend: metrics.responseTimeTrend,
    conversionTrend: metrics.conversionTrend,
    returnTrend: metrics.returnTrend,
    pendingResponseTrend: metrics.pendingResponseTrend,
    trendData: metrics.trendData,
    funnelData: metrics.funnelData,
    coverage: metrics.coverage,
    responseDistribution: metrics.responseDistribution,
    abandonmentRate: toPercent(abandonmentRate),
    criticalPendingRate: toPercent(criticalPendingRate),
    operationalLoad,
    throughputDaily: Number(throughputDaily.toFixed(1)),
  };
}
