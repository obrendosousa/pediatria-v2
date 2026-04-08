'use client';

import { motion } from 'framer-motion';
import type { CRMMetricsViewModel } from '@/utils/crmMetricsPresentation';
import InfoHelpButton from '@/components/crm/metrics/InfoHelpButton';
import { AnimatedNumber } from '@/components/ui/motion-primitives';

type DataCoveragePanelProps = {
  metrics: CRMMetricsViewModel;
};

function CoverageItem({
  title,
  valid,
  invalid,
}: {
  title: string;
  valid: number;
  invalid: number;
}) {
  const total = valid + invalid;
  const quality = total > 0 ? (valid / total) * 100 : 0;
  return (
    <div className="rounded-xl border border-slate-200 p-3 dark:border-[#2d2d36]">
      <p className="text-xs font-semibold text-slate-600 dark:text-[#d4d4d8]">{title}</p>
      <p className="mt-1 text-sm text-slate-500 dark:text-[#a1a1aa]">
        {valid} elegíveis / {invalid} inválidos
      </p>
      <div className="mt-2 text-lg font-black text-slate-800 dark:text-[#fafafa]">
        <AnimatedNumber value={parseFloat(quality.toFixed(1))} suffix="%" />
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-[#1c1c21]">
        <motion.div
          className="h-full rounded-full bg-emerald-500"
          initial={{ width: 0 }}
          animate={{ width: `${quality}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
        />
      </div>
    </div>
  );
}

export default function DataCoveragePanel({ metrics }: DataCoveragePanelProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.25 }}
      className="rounded-2xl border border-white/20 bg-white/80 p-5 shadow-sm backdrop-blur-sm dark:border-white/[0.06] dark:bg-[#08080b]/80"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-[#fafafa]">Confiabilidade dos dados</h3>
          <p className="text-xs text-slate-500 dark:text-[#a1a1aa]">Ajuda a interpretar os indicadores com segurança.</p>
        </div>
        <InfoHelpButton
          title="Confiabilidade dos dados"
          description="Mostra quanto dos dados foi realmente válido para cálculo. Se a cobertura for baixa, os KPIs podem ficar distorcidos."
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <CoverageItem title="Cobertura da fila" valid={metrics.coverage.queueEligible} invalid={metrics.coverage.queueInvalid} />
        <CoverageItem title="Cobertura do atendimento" valid={metrics.coverage.serviceEligible} invalid={metrics.coverage.serviceInvalid} />
        <CoverageItem
          title="Ciclos de resposta"
          valid={metrics.coverage.responseCycles}
          invalid={metrics.coverage.responseDiscardedOver24h}
        />
      </div>
    </motion.section>
  );
}
