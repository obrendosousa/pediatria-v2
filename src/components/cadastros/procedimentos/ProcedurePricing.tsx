'use client';

import { DollarSign } from 'lucide-react';
import { inputClass, labelClass, formatCurrency, type ProcedureFormData } from './types';

interface Props {
  form: ProcedureFormData;
  onUpdate: <K extends keyof ProcedureFormData>(key: K, value: ProcedureFormData[K]) => void;
  errors: Record<string, string>;
}

export default function ProcedurePricing({ form, onUpdate, errors }: Props) {
  return (
    <section className="bg-white dark:bg-[#08080b] rounded-xl border border-slate-200 dark:border-[#3d3d48] p-6 space-y-5">
      <h2 className="text-sm font-bold text-slate-700 dark:text-[#d4d4d8] uppercase tracking-wide flex items-center gap-2">
        <DollarSign className="w-4 h-4 text-teal-500" />
        Precificação do Procedimento
      </h2>

      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-6 md:col-span-6">
          <label className={labelClass}>Valor do procedimento</label>
          <input
            type="number"
            min={0}
            step={0.01}
            value={form.honorarium_value || ''}
            onChange={e => onUpdate('honorarium_value', Number(e.target.value))}
            placeholder="0,00"
            className={`${inputClass} text-right font-mono ${errors.honorarium_value ? 'border-red-300 dark:border-red-700' : ''}`}
          />
          {errors.honorarium_value && <p className="mt-1 text-xs text-red-500">{errors.honorarium_value}</p>}
        </div>

        <div className="col-span-6 md:col-span-6">
          <label className={labelClass}>Valor Total</label>
          <div className="px-3 py-2.5 text-sm font-bold font-mono text-right text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-900/10 border border-teal-200 dark:border-teal-800 rounded-xl">
            {formatCurrency(form.honorarium_value)}
          </div>
        </div>
      </div>
    </section>
  );
}
