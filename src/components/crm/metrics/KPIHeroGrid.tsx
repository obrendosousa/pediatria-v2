import { Activity, AlertTriangle, Clock, MessageCircle, Timer, TrendingUp, Undo2, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { CRMMetricsViewModel } from '@/utils/crmMetricsPresentation';
import InfoHelpButton from '@/components/crm/metrics/InfoHelpButton';

type KPIHeroGridProps = {
  metrics: CRMMetricsViewModel;
};

type Tone = 'blue' | 'emerald' | 'rose' | 'purple' | 'amber';

const toneClassMap: Record<Tone, { icon: string; chip: string }> = {
  blue: { icon: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-300', chip: 'text-blue-600 dark:text-blue-300' },
  emerald: { icon: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-300', chip: 'text-emerald-600 dark:text-emerald-300' },
  rose: { icon: 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-300', chip: 'text-rose-600 dark:text-rose-300' },
  purple: { icon: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-300', chip: 'text-purple-600 dark:text-purple-300' },
  amber: { icon: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-300', chip: 'text-amber-600 dark:text-amber-300' },
};

function KpiCard({
  title,
  value,
  hint,
  helpText,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string;
  hint: string;
  helpText: string;
  icon: LucideIcon;
  tone: Tone;
}) {
  const palette = toneClassMap[tone];
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-[#1e2028]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400">{title}</p>
            <InfoHelpButton title={title} description={helpText} />
          </div>
          <p className="mt-1 text-2xl font-black text-slate-800 dark:text-gray-100">{value}</p>
        </div>
        <div className={`rounded-xl p-2 ${palette.icon}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className={`text-xs font-medium ${palette.chip}`}>{hint}</p>
    </article>
  );
}

const pct = (value: number) => `${value.toFixed(1)}%`;

export default function KPIHeroGrid({ metrics }: KPIHeroGridProps) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-bold text-slate-800 dark:text-gray-100">Indicadores críticos</h2>
        <span className="text-xs text-slate-500 dark:text-gray-400">Leitura rápida para decisão</span>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Tempo de resposta"
          value={`${metrics.averageResponseTime} min`}
          hint="Bom quando menor"
          helpText="Tempo médio entre uma mensagem do paciente e a resposta humana. Quanto menor, melhor a experiência e menor o risco de perda."
          icon={MessageCircle}
          tone="rose"
        />
        <KpiCard
          title="Conversas sem resposta >24h"
          value={`${metrics.pendingResponseOver24hCount}`}
          hint={`Criticidade ${pct(metrics.criticalPendingRate)}`}
          helpText="Quantidade de conversas aguardando resposta humana há mais de 24 horas. Este é um alerta de risco operacional."
          icon={AlertTriangle}
          tone="amber"
        />
        <KpiCard
          title="Carga operacional"
          value={`${metrics.operationalLoad}`}
          hint={`${metrics.totalWaiting} na fila / ${metrics.totalInService} em atendimento`}
          helpText="Soma de pacientes aguardando e em atendimento no momento. Mostra pressão atual sobre a operação."
          icon={Users}
          tone="blue"
        />
        <KpiCard
          title="Conversão chat -> consulta"
          value={pct(metrics.leadToConsultationRate)}
          hint="Principal indicador de resultado"
          helpText="Percentual de conversas que avançaram até consulta. Mede eficiência comercial e clínica do atendimento."
          icon={TrendingUp}
          tone="purple"
        />
        <KpiCard
          title="Tempo na fila"
          value={`${metrics.averageQueueTime} min`}
          hint="Gargalo de entrada"
          helpText="Tempo médio de espera antes do início do atendimento. Ajuda a identificar gargalos na recepção."
          icon={Timer}
          tone="blue"
        />
        <KpiCard
          title="Tempo de atendimento"
          value={`${metrics.averageServiceTime} min`}
          hint="Eficiência do serviço"
          helpText="Duração média do atendimento em si. Útil para balancear produtividade e qualidade."
          icon={Clock}
          tone="emerald"
        />
        <KpiCard
          title="Taxa de retorno"
          value={pct(metrics.returnRate)}
          hint="Relacionamento e fidelização"
          helpText="Percentual de pacientes que retornam para novas consultas. Indica continuidade e vínculo."
          icon={Undo2}
          tone="emerald"
        />
        <KpiCard
          title="Abandono de conversa"
          value={pct(metrics.abandonmentRate)}
          hint={`${metrics.totalChats - metrics.totalAppointments} sem agendamento`}
          helpText="Percentual de conversas que não viraram agendamento. Mostra perdas no funil de atendimento."
          icon={Activity}
          tone="rose"
        />
      </div>
    </section>
  );
}
