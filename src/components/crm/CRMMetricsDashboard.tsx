'use client';

import { AlertCircle, RefreshCw } from 'lucide-react';
import type { CRMMetricsPayload } from '@/lib/crm/metrics';
import { buildCRMMetricsViewModel } from '@/utils/crmMetricsPresentation';
import KPIHeroGrid from '@/components/crm/metrics/KPIHeroGrid';
import ServiceEfficiencyPanel from '@/components/crm/metrics/ServiceEfficiencyPanel';
import ConversionFunnelPanel from '@/components/crm/metrics/ConversionFunnelPanel';
import OperationalCapacityPanel from '@/components/crm/metrics/OperationalCapacityPanel';
import DataCoveragePanel from '@/components/crm/metrics/DataCoveragePanel';
import CalendarDatePopover from '@/components/ui/CalendarDatePopover';

type Granularity = 'day' | 'month' | 'custom';

type CRMMetricsDashboardProps = {
  metrics: CRMMetricsPayload | null;
  loading: boolean;
  error: string | null;
  granularity: Granularity;
  date: string;
  startDate: string;
  endDate: string;
  onGranularityChange: (value: Granularity) => void;
  onDateChange: (value: string) => void;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onRefresh: () => void;
};

function MetricsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, idx) => (
          <div key={idx} className="h-28 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-gray-800" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="h-80 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-gray-800" />
        <div className="h-80 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-gray-800" />
      </div>
      <div className="h-72 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-gray-800" />
    </div>
  );
}

export default function CRMMetricsDashboard(props: CRMMetricsDashboardProps) {
  const {
    metrics,
    loading,
    error,
    granularity,
    date,
    startDate,
    endDate,
    onGranularityChange,
    onDateChange,
    onStartDateChange,
    onEndDateChange,
    onRefresh,
  } = props;
  const view = buildCRMMetricsViewModel(metrics);

  return (
    <div className="h-full overflow-y-auto p-6 custom-scrollbar lg:p-8">
      <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-[#1e2028]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-slate-800 dark:text-gray-100">Gestão & Métricas de Atendimento</h2>
            <p className="text-xs text-slate-500 dark:text-gray-400">Painel priorizado para leitura rápida, diagnóstico e conclusão.</p>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </button>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-gray-400">Período</label>
            <select
              value={granularity}
              onChange={(e) => onGranularityChange(e.target.value as Granularity)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-gray-700 dark:bg-[#111b21] dark:text-gray-200"
            >
              <option value="day">Dia</option>
              <option value="month">Mês</option>
              <option value="custom">Personalizado</option>
            </select>
          </div>
          {granularity !== 'custom' ? (
            <CalendarDatePopover
              value={date}
              onChange={onDateChange}
              label={granularity === 'day' ? 'Data' : 'Mês de referência'}
            />
          ) : (
            <>
              <CalendarDatePopover value={startDate} onChange={onStartDateChange} label="Início" />
              <CalendarDatePopover value={endDate} onChange={onEndDateChange} label="Fim" />
            </>
          )}
        </div>
      </div>

      {error ? (
        <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900/30 dark:bg-rose-900/10">
          <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300">
            <AlertCircle className="h-4 w-4" />
            <p className="text-sm font-semibold">Falha ao carregar métricas: {error}</p>
          </div>
        </div>
      ) : null}

      {loading ? (
        <MetricsSkeleton />
      ) : (
        <div className="space-y-5">
          <KPIHeroGrid metrics={view} />
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <ServiceEfficiencyPanel metrics={view} />
            <ConversionFunnelPanel metrics={view} />
          </div>
          <OperationalCapacityPanel metrics={view} />
          <DataCoveragePanel metrics={view} />
        </div>
      )}
    </div>
  );
}
