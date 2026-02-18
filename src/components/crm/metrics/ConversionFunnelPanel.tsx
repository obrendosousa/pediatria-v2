import { ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import type { CRMMetricsViewModel } from '@/utils/crmMetricsPresentation';
import InfoHelpButton from '@/components/crm/metrics/InfoHelpButton';

type ConversionFunnelPanelProps = {
  metrics: CRMMetricsViewModel;
};

export default function ConversionFunnelPanel({ metrics }: ConversionFunnelPanelProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-[#1e2028]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-gray-100">Funil de conversão</h3>
          <p className="text-xs text-slate-500 dark:text-gray-400">Mostra onde o atendimento perde volume entre conversa e finalização.</p>
        </div>
        <InfoHelpButton
          title="Funil de conversão"
          description="Cada barra representa uma etapa do processo. A queda entre etapas mostra onde os pacientes estão sendo perdidos."
        />
      </div>
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={metrics.funnelData} layout="vertical" margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#cbd5e1" strokeOpacity={0.3} />
            <XAxis type="number" hide />
            <YAxis dataKey="name" type="category" width={130} tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="value" barSize={28} radius={[0, 8, 8, 0]}>
              {metrics.funnelData.map((item, index) => (
                <Cell key={`${item.name}-${index}`} fill={item.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
