import { ResponsiveContainer, AreaChart, Area, CartesianGrid, Tooltip, XAxis, YAxis, Legend } from 'recharts';
import type { CRMMetricsViewModel } from '@/utils/crmMetricsPresentation';
import InfoHelpButton from '@/components/crm/metrics/InfoHelpButton';

type ServiceEfficiencyPanelProps = {
  metrics: CRMMetricsViewModel;
};

export default function ServiceEfficiencyPanel({ metrics }: ServiceEfficiencyPanelProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-[#1e2028]">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-gray-100">Eficiência operacional</h3>
          <p className="text-xs text-slate-500 dark:text-gray-400">Tempo de fila, atendimento e conversão ao longo do período.</p>
        </div>
        <InfoHelpButton
          title="Eficiência operacional"
          description="Este gráfico compara o tempo de fila, o tempo de atendimento e a conversão ao longo dos dias. Se os tempos sobem e a conversão cai, existe gargalo na operação."
        />
      </div>
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={metrics.trendData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="queueArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="serviceArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" strokeOpacity={0.3} />
            <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
            <YAxis yAxisId="left" tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
            <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Area yAxisId="left" type="monotone" dataKey="queueTime" name="Fila (min)" stroke="#3b82f6" fill="url(#queueArea)" strokeWidth={2.5} />
            <Area yAxisId="left" type="monotone" dataKey="serviceTime" name="Atendimento (min)" stroke="#10b981" fill="url(#serviceArea)" strokeWidth={2.5} />
            <Area yAxisId="right" type="monotone" dataKey="conversionRate" name="Conversão (%)" stroke="#a855f7" fillOpacity={0} strokeWidth={2.5} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
