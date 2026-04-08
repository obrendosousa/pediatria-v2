'use client';

import { AlertCircle, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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

function ShimmerBlock({ className }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-slate-200/70 dark:bg-[#1c1c21] ${className || ''}`}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/30 dark:via-white/5 to-transparent" />
    </div>
  );
}

function MetricsSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-4"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, idx) => (
          <ShimmerBlock key={idx} className="h-28" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ShimmerBlock className="h-80" />
        <ShimmerBlock className="h-80" />
      </div>
      <ShimmerBlock className="h-72" />
    </motion.div>
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
      <div className="mb-5 rounded-2xl border border-white/20 bg-white/80 p-4 shadow-sm backdrop-blur-sm dark:border-white/[0.06] dark:bg-[#08080b]/80">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-slate-800 dark:text-[#fafafa]">Gestão & Métricas de Atendimento</h2>
            <p className="text-xs text-slate-500 dark:text-[#a1a1aa]">Painel priorizado para leitura rápida, diagnóstico e conclusão.</p>
          </div>
          <motion.button
            type="button"
            onClick={onRefresh}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97, rotate: 180 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-[#3d3d48] dark:text-[#d4d4d8] dark:hover:bg-white/5"
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </motion.button>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-[#a1a1aa]">Período</label>
            <select
              value={granularity}
              onChange={(e) => onGranularityChange(e.target.value as Granularity)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-[#3d3d48] dark:bg-[#111b21] dark:text-gray-200"
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

      <AnimatePresence mode="wait">
        {loading ? (
          <MetricsSkeleton key="skeleton" />
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-5"
          >
            <KPIHeroGrid metrics={view} />
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              <ServiceEfficiencyPanel metrics={view} />
              <ConversionFunnelPanel metrics={view} />
            </div>
            <OperationalCapacityPanel metrics={view} />
            <DataCoveragePanel metrics={view} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
