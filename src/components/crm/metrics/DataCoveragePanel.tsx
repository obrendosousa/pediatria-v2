import type { CRMMetricsViewModel } from '@/utils/crmMetricsPresentation';
import InfoHelpButton from '@/components/crm/metrics/InfoHelpButton';

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
    <div className="rounded-xl border border-slate-200 p-3 dark:border-[#1e2334]">
      <p className="text-xs font-semibold text-slate-600 dark:text-[#a0a8be]">{title}</p>
      <p className="mt-1 text-sm text-slate-500 dark:text-[#828ca5]">
        {valid} elegíveis / {invalid} inválidos
      </p>
      <p className="mt-2 text-lg font-black text-slate-800 dark:text-[#e8ecf4]">{quality.toFixed(1)}%</p>
    </div>
  );
}

export default function DataCoveragePanel({ metrics }: DataCoveragePanelProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#1e2334] dark:bg-[#0d0f15]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-[#e8ecf4]">Confiabilidade dos dados</h3>
          <p className="text-xs text-slate-500 dark:text-[#828ca5]">Ajuda a interpretar os indicadores com segurança.</p>
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
    </section>
  );
}
