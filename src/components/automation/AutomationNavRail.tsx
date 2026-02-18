import { LucideIcon } from 'lucide-react';

export type AutomationSection = 'milestones' | 'appointment' | 'return';

interface NavItem {
  id: AutomationSection;
  label: string;
  description: string;
  icon: LucideIcon;
  badge: string;
  activeCount?: number;
}

interface AutomationNavRailProps {
  items: NavItem[];
  activeSection: AutomationSection;
  onSectionChange: (section: AutomationSection) => void;
}

export default function AutomationNavRail({
  items,
  activeSection,
  onSectionChange,
}: AutomationNavRailProps) {
  return (
    <aside className="w-full xl:w-80 shrink-0">
      <div className="rounded-2xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-[#1e2028] p-3">
        <p className="px-2 mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-gray-500">
          Tipos de automacao
        </p>

        <div className="space-y-2">
          {items.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSectionChange(item.id)}
                className={`w-full text-left rounded-xl border p-3 transition-all ${
                  isActive
                    ? 'border-rose-300 dark:border-rose-700 bg-rose-50/70 dark:bg-rose-900/20'
                    : 'border-slate-200 dark:border-gray-700 bg-slate-50/60 dark:bg-[#252833] hover:border-slate-300 dark:hover:border-gray-500'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`rounded-lg p-2 ${
                      isActive
                        ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-300'
                        : 'bg-white dark:bg-[#1e2028] text-slate-500 dark:text-gray-400'
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-1 mb-1 sm:flex-row sm:items-center sm:justify-between">
                      <p
                        className={`text-sm font-bold leading-tight ${
                          isActive
                            ? 'text-rose-700 dark:text-rose-300'
                            : 'text-slate-800 dark:text-gray-100'
                        }`}
                      >
                        {item.label}
                      </p>
                      <span
                        title={item.badge}
                        className="inline-flex w-fit max-w-full sm:max-w-[11rem] truncate text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-[#2d3342] text-slate-600 dark:text-gray-300"
                      >
                        {item.badge}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-gray-400 leading-relaxed">
                      {item.description}
                    </p>
                    {typeof item.activeCount === 'number' && (
                      <p className="text-xs text-slate-500 dark:text-gray-400 mt-2">
                        {item.activeCount} ativa{item.activeCount === 1 ? '' : 's'}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
