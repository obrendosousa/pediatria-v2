'use client';

import { Activity, AlertTriangle, Clock, MessageCircle, Timer, TrendingUp, Undo2, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { CRMMetricsViewModel } from '@/utils/crmMetricsPresentation';
import InfoHelpButton from '@/components/crm/metrics/InfoHelpButton';
import { motion } from 'framer-motion';
import { AnimatedNumber, StaggerContainer, StaggerItem } from '@/components/ui/motion-primitives';

type KPIHeroGridProps = {
  metrics: CRMMetricsViewModel;
};

type Tone = 'blue' | 'emerald' | 'rose' | 'purple' | 'amber';

const toneClassMap: Record<Tone, { icon: string; chip: string; bar: string }> = {
  blue: { icon: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-300', chip: 'text-blue-600 dark:text-blue-300', bar: 'bg-blue-500' },
  emerald: { icon: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-300', chip: 'text-emerald-600 dark:text-emerald-300', bar: 'bg-emerald-500' },
  rose: { icon: 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-300', chip: 'text-rose-600 dark:text-rose-300', bar: 'bg-rose-500' },
  purple: { icon: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-300', chip: 'text-purple-600 dark:text-purple-300', bar: 'bg-purple-500' },
  amber: { icon: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-300', chip: 'text-amber-600 dark:text-amber-300', bar: 'bg-amber-500' },
};

function KpiCard({
  title,
  numericValue,
  suffix,
  hint,
  helpText,
  icon: Icon,
  tone,
  format,
}: {
  title: string;
  numericValue: number;
  suffix?: string;
  hint: string;
  helpText: string;
  icon: LucideIcon;
  tone: Tone;
  format?: Parameters<typeof AnimatedNumber>[0]['format'];
}) {
  const palette = toneClassMap[tone];
  return (
    <motion.article
      className="relative overflow-hidden rounded-2xl border border-white/20 bg-white/80 p-4 shadow-sm backdrop-blur-sm dark:border-white/[0.06] dark:bg-[#08080b]/80"
      whileHover={{ y: -2, boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
    >
      <motion.div
        className={`absolute left-0 right-0 top-0 h-[2px] ${palette.bar}`}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        style={{ transformOrigin: 'left' }}
      />
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-[#a1a1aa]">{title}</p>
            <InfoHelpButton title={title} description={helpText} />
          </div>
          <div className="mt-1 text-2xl font-black text-slate-800 dark:text-[#fafafa]">
            <AnimatedNumber value={numericValue} suffix={suffix} format={format} />
          </div>
        </div>
        <div className={`rounded-xl p-2 ${palette.icon}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className={`text-xs font-medium ${palette.chip}`}>{hint}</p>
    </motion.article>
  );
}

const pct = (value: number) => `${value.toFixed(1)}%`;

export default function KPIHeroGrid({ metrics }: KPIHeroGridProps) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-bold text-slate-800 dark:text-[#fafafa]">Indicadores críticos</h2>
        <span className="text-xs text-slate-500 dark:text-[#a1a1aa]">Leitura rápida para decisão</span>
      </div>
      <StaggerContainer className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StaggerItem>
          <KpiCard
            title="Tempo de resposta"
            numericValue={metrics.averageResponseTime}
            suffix=" min"
            hint="Bom quando menor"
            helpText="Tempo médio entre uma mensagem do paciente e a resposta humana. Quanto menor, melhor a experiência e menor o risco de perda."
            icon={MessageCircle}
            tone="rose"
          />
        </StaggerItem>
        <StaggerItem>
          <KpiCard
            title="Conversas sem resposta >24h"
            numericValue={metrics.pendingResponseOver24hCount}
            hint={`Criticidade ${pct(metrics.criticalPendingRate)}`}
            helpText="Quantidade de conversas aguardando resposta humana há mais de 24 horas. Este é um alerta de risco operacional."
            icon={AlertTriangle}
            tone="amber"
          />
        </StaggerItem>
        <StaggerItem>
          <KpiCard
            title="Carga operacional"
            numericValue={metrics.operationalLoad}
            hint={`${metrics.totalWaiting} na fila / ${metrics.totalInService} em atendimento`}
            helpText="Soma de pacientes aguardando e em atendimento no momento. Mostra pressão atual sobre a operação."
            icon={Users}
            tone="blue"
          />
        </StaggerItem>
        <StaggerItem>
          <KpiCard
            title="Conversão chat -> consulta"
            numericValue={metrics.leadToConsultationRate}
            suffix="%"
            format={{ maximumFractionDigits: 1 }}
            hint="Principal indicador de resultado"
            helpText="Percentual de conversas que avançaram até consulta. Mede eficiência comercial e clínica do atendimento."
            icon={TrendingUp}
            tone="purple"
          />
        </StaggerItem>
        <StaggerItem>
          <KpiCard
            title="Tempo na fila"
            numericValue={metrics.averageQueueTime}
            suffix=" min"
            hint="Gargalo de entrada"
            helpText="Tempo médio de espera antes do início do atendimento. Ajuda a identificar gargalos na recepção."
            icon={Timer}
            tone="blue"
          />
        </StaggerItem>
        <StaggerItem>
          <KpiCard
            title="Tempo de atendimento"
            numericValue={metrics.averageServiceTime}
            suffix=" min"
            hint="Eficiência do serviço"
            helpText="Duração média do atendimento em si. Útil para balancear produtividade e qualidade."
            icon={Clock}
            tone="emerald"
          />
        </StaggerItem>
        <StaggerItem>
          <KpiCard
            title="Taxa de retorno"
            numericValue={metrics.returnRate}
            suffix="%"
            format={{ maximumFractionDigits: 1 }}
            hint="Relacionamento e fidelização"
            helpText="Percentual de pacientes que retornam para novas consultas. Indica continuidade e vínculo."
            icon={Undo2}
            tone="emerald"
          />
        </StaggerItem>
        <StaggerItem>
          <KpiCard
            title="Abandono de conversa"
            numericValue={metrics.abandonmentRate}
            suffix="%"
            format={{ maximumFractionDigits: 1 }}
            hint={`${metrics.totalChats - metrics.totalAppointments} sem agendamento`}
            helpText="Percentual de conversas que não viraram agendamento. Mostra perdas no funil de atendimento."
            icon={Activity}
            tone="rose"
          />
        </StaggerItem>
      </StaggerContainer>
    </section>
  );
}
