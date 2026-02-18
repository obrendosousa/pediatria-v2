import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Line, ComposedChart } from 'recharts';
import type { CRMMetricsViewModel } from '@/utils/crmMetricsPresentation';
import InfoHelpButton from '@/components/crm/metrics/InfoHelpButton';

type OperationalCapacityPanelProps = {
  metrics: CRMMetricsViewModel;
};

export default function OperationalCapacityPanel({ metrics }: OperationalCapacityPanelProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-[#1e2028]">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-gray-100">Capacidade e respostas em aberto</h3>
          <p className="text-xs text-slate-500 dark:text-gray-400">Vazão diária estimada, conversas sem resposta e pressão operacional.</p>
        </div>
        <InfoHelpButton
          title="Capacidade e respostas em aberto"
          description="As barras mostram conversas sem resposta por dia e a linha mostra a conversão. Use em conjunto para avaliar se a operação está conseguindo dar vazão."
        />
      </div>
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-[#111b21]">
          <p className="text-xs text-slate-500 dark:text-gray-400">Vazão média</p>
          <p className="text-lg font-bold text-slate-800 dark:text-gray-100">{metrics.throughputDaily} / dia</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-[#111b21]">
          <p className="text-xs text-slate-500 dark:text-gray-400">Conversas sem resposta</p>
          <p className="text-lg font-bold text-slate-800 dark:text-gray-100">{metrics.pendingResponseCount}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-[#111b21]">
          <p className="text-xs text-slate-500 dark:text-gray-400">Sem resposta &gt;24h</p>
          <p className="text-lg font-bold text-slate-800 dark:text-gray-100">{metrics.pendingResponseOver24hCount}</p>
        </div>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={metrics.trendData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" strokeOpacity={0.3} />
            <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="pendingResponses" name="Conversas sem resposta" fill="#f97316" radius={[6, 6, 0, 0]} />
            <Line dataKey="conversionRate" name="Conversão (%)" stroke="#a855f7" strokeWidth={2.5} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
