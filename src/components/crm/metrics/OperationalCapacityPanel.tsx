'use client';

import { ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Line, ComposedChart, Bar } from 'recharts';
import { motion } from 'framer-motion';
import type { CRMMetricsViewModel } from '@/utils/crmMetricsPresentation';
import InfoHelpButton from '@/components/crm/metrics/InfoHelpButton';
import { AnimatedNumber } from '@/components/ui/motion-primitives';

type OperationalCapacityPanelProps = {
  metrics: CRMMetricsViewModel;
};

export default function OperationalCapacityPanel({ metrics }: OperationalCapacityPanelProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="rounded-2xl border border-white/20 bg-white/80 p-5 shadow-sm backdrop-blur-sm dark:border-white/[0.06] dark:bg-[#08080b]/80"
    >
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-[#fafafa]">Capacidade e respostas em aberto</h3>
          <p className="text-xs text-slate-500 dark:text-[#a1a1aa]">Vazão diária estimada, conversas sem resposta e pressão operacional.</p>
        </div>
        <InfoHelpButton
          title="Capacidade e respostas em aberto"
          description="As barras mostram conversas sem resposta por dia e a linha mostra a conversão. Use em conjunto para avaliar se a operação está conseguindo dar vazão."
        />
      </div>
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-[#111b21]">
          <p className="text-xs text-slate-500 dark:text-[#a1a1aa]">Vazão média</p>
          <p className="text-lg font-bold text-slate-800 dark:text-[#fafafa]"><AnimatedNumber value={metrics.throughputDaily} suffix=" / dia" /></p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-[#111b21]">
          <p className="text-xs text-slate-500 dark:text-[#a1a1aa]">Conversas sem resposta</p>
          <p className="text-lg font-bold text-slate-800 dark:text-[#fafafa]"><AnimatedNumber value={metrics.pendingResponseCount} /></p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-[#111b21]">
          <p className="text-xs text-slate-500 dark:text-[#a1a1aa]">Sem resposta &gt;24h</p>
          <p className="text-lg font-bold text-slate-800 dark:text-[#fafafa]"><AnimatedNumber value={metrics.pendingResponseOver24hCount} /></p>
        </div>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={metrics.trendData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" strokeOpacity={0.3} />
            <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="pendingResponses" name="Conversas sem resposta" fill="#f97316" radius={[6, 6, 0, 0]} animationDuration={800} animationEasing="ease-out" />
            <Line dataKey="conversionRate" name="Conversão (%)" stroke="#a855f7" strokeWidth={2.5} dot={false} animationDuration={1000} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </motion.section>
  );
}
