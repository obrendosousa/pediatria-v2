'use client';

import { Check } from 'lucide-react';
import { type LucideIcon } from 'lucide-react';

export type StepperStep = {
  key: string;
  label: string;
  icon: LucideIcon;
  timestamp?: string | null;
};

interface StatusStepperProps {
  steps: StepperStep[];
  currentStepKey: string;
  accentColor?: string;
}

export default function StatusStepper({ steps, currentStepKey, accentColor = 'teal' }: StatusStepperProps) {
  const currentIndex = steps.findIndex(s => s.key === currentStepKey);

  const colors: Record<string, { bg: string; border: string; text: string; line: string; iconBg: string }> = {
    teal: {
      bg: 'bg-teal-500',
      border: 'border-teal-500',
      text: 'text-teal-600 dark:text-teal-400',
      line: 'bg-teal-500',
      iconBg: 'bg-teal-50 dark:bg-teal-900/20'
    },
    rose: {
      bg: 'bg-rose-500',
      border: 'border-rose-500',
      text: 'text-rose-600 dark:text-rose-400',
      line: 'bg-rose-500',
      iconBg: 'bg-rose-50 dark:bg-rose-900/20'
    }
  };

  const c = colors[accentColor] || colors.teal;

  return (
    <div className="w-full">
      <div className="flex items-start justify-between relative">
        {/* Linha conectora de fundo */}
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-slate-200 dark:bg-[#27272a] mx-10" />
        {/* Linha conectora de progresso */}
        {currentIndex > 0 && (
          <div
            className={`absolute top-5 left-0 h-0.5 ${c.line} mx-10 transition-all duration-500`}
            style={{ width: `${(currentIndex / (steps.length - 1)) * 100}%` }}
          />
        )}

        {steps.map((step, i) => {
          const isCompleted = i < currentIndex;
          const isCurrent = i === currentIndex;
          const isFuture = i > currentIndex;
          const Icon = step.icon;

          return (
            <div key={step.key} className="flex flex-col items-center relative z-10 flex-1">
              {/* Circulo */}
              <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                isCompleted
                  ? 'bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-500/30'
                  : isCurrent
                    ? `${c.bg} ${c.border} text-white shadow-md shadow-${accentColor}-500/30`
                    : 'bg-white dark:bg-[#0a0a0c] border-slate-300 dark:border-gray-600 text-slate-400 dark:text-[#71717a]'
              }`}>
                {isCompleted ? <Check size={18} strokeWidth={3}/> : <Icon size={18}/>}
              </div>

              {/* Label */}
              <span className={`mt-2 text-[11px] font-bold text-center leading-tight ${
                isCompleted ? 'text-emerald-600 dark:text-emerald-400'
                  : isCurrent ? c.text
                    : 'text-slate-400 dark:text-[#71717a]'
              }`}>
                {step.label}
              </span>

              {/* Timestamp */}
              {step.timestamp && (isCompleted || isCurrent) && (
                <span className="mt-0.5 text-[9px] text-slate-400 dark:text-[#71717a] font-medium">
                  {step.timestamp}
                </span>
              )}

              {isFuture && (
                <span className="mt-0.5 text-[9px] text-slate-300 dark:text-gray-600">--</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
