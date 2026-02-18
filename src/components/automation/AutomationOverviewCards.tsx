import { AutomationRule } from '@/types';
import { CheckCircle2, CircleOff, Layers, Sparkles } from 'lucide-react';

interface AutomationOverviewCardsProps {
  milestoneAutomations: AutomationRule[];
  appointmentAutomation: AutomationRule | null;
  returnAutomation: AutomationRule | null;
}

export default function AutomationOverviewCards({
  milestoneAutomations,
  appointmentAutomation,
  returnAutomation,
}: AutomationOverviewCardsProps) {
  const totalAutomations =
    milestoneAutomations.length +
    (appointmentAutomation ? 1 : 0) +
    (returnAutomation ? 1 : 0);

  const activeAutomations =
    milestoneAutomations.filter((automation) => automation.active).length +
    (appointmentAutomation?.active ? 1 : 0) +
    (returnAutomation?.active ? 1 : 0);

  const inactiveAutomations = totalAutomations - activeAutomations;

  const cards = [
    {
      id: 'total',
      label: 'Total de automacoes',
      value: totalAutomations,
      icon: Layers,
      tone: 'text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30',
    },
    {
      id: 'active',
      label: 'Ativas',
      value: activeAutomations,
      icon: CheckCircle2,
      tone: 'text-emerald-600 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30',
    },
    {
      id: 'inactive',
      label: 'Inativas',
      value: inactiveAutomations,
      icon: CircleOff,
      tone: 'text-amber-600 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30',
    },
    {
      id: 'coverage',
      label: 'Cobertura de tipos',
      value: `${[milestoneAutomations.length > 0, !!appointmentAutomation, !!returnAutomation].filter(Boolean).length}/3`,
      icon: Sparkles,
      tone: 'text-rose-600 dark:text-rose-300 bg-rose-50 dark:bg-rose-900/30',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={card.id}
          className="rounded-2xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-[#1e2028] p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <div className={`rounded-xl p-2 ${card.tone}`}>
              <card.icon className="w-4 h-4" />
            </div>
            <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-400 dark:text-gray-500">
              Resumo
            </span>
          </div>
          <div className="text-2xl font-black text-slate-800 dark:text-gray-100">{card.value}</div>
          <div className="text-sm text-slate-500 dark:text-gray-400 mt-1">{card.label}</div>
        </div>
      ))}
    </div>
  );
}
