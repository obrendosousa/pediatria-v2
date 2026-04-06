'use client';

import { useState } from 'react';
import { DollarSign, Settings2, HelpCircle } from 'lucide-react';
import { inputClass, labelClass, formatCurrency, type ProcedureFormData } from './types';
import AdvancedConfigModal from './AdvancedConfigModal';

interface Props {
  form: ProcedureFormData;
  onUpdate: <K extends keyof ProcedureFormData>(key: K, value: ProcedureFormData[K]) => void;
  errors: Record<string, string>;
}

export default function ProcedurePricing({ form, onUpdate, errors }: Props) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showHonorTip, setShowHonorTip] = useState(false);

  const totalValue = form.composition_enabled
    ? form.composition_value + form.honorarium_value
    : form.honorarium_value;

  return (
    <>
      <section className="bg-white dark:bg-[#08080b] rounded-xl border border-slate-200 dark:border-[#3d3d48] p-6 space-y-5">
        <h2 className="text-sm font-bold text-slate-700 dark:text-[#d4d4d8] uppercase tracking-wide flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-teal-500" />
          Precificação do Procedimento
        </h2>

        <div className="grid grid-cols-12 gap-5">
          {/* Valor dos produtos (somente com composicao) */}
          {form.composition_enabled && (
            <div className="col-span-6 md:col-span-3">
              <label className={labelClass}>
                Valor dos produtos
                <span className="ml-1 text-slate-400 cursor-help" title="Considera o valor de venda dos produtos na composição">
                  <HelpCircle className="w-3 h-3 inline" />
                </span>
              </label>
              <div className="px-3 py-2.5 text-sm font-mono text-right text-slate-600 dark:text-[#d4d4d8] bg-slate-100 dark:bg-[#15171e] border border-slate-200 dark:border-[#3d3d48] rounded-xl">
                {formatCurrency(form.composition_value)}
              </div>
            </div>
          )}

          {/* Valor de honorarios */}
          <div className={`col-span-6 ${form.composition_enabled ? 'md:col-span-3' : 'md:col-span-4'}`}>
            <label className={labelClass}>
              Valor de honorários
              <button
                type="button"
                onClick={() => setShowHonorTip(!showHonorTip)}
                className="ml-1 text-slate-400 hover:text-teal-500 transition-colors"
              >
                <HelpCircle className="w-3 h-3 inline" />
              </button>
            </label>
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
            {showHonorTip && (
              <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg text-xs text-blue-700 dark:text-blue-300">
                <p className="font-semibold mb-1">Considere ao definir o valor:</p>
                <ul className="list-disc ml-3 space-y-0.5">
                  <li>Quem realiza o procedimento (médico vs enfermagem)</li>
                  <li>Tempo necessário para realização</li>
                  <li>Nível de invasividade</li>
                  <li>Tempo de preparação do ambiente</li>
                  <li>Risco de intercorrências</li>
                </ul>
              </div>
            )}
          </div>

          {/* Valor total */}
          <div className={`col-span-6 ${form.composition_enabled ? 'md:col-span-3' : 'md:col-span-4'}`}>
            <label className={labelClass}>Valor Total</label>
            <div className="px-3 py-2.5 text-sm font-bold font-mono text-right text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-900/10 border border-teal-200 dark:border-teal-800 rounded-xl">
              {formatCurrency(totalValue)}
            </div>
          </div>

          {/* Formula + botao config avancada (somente com composicao) */}
          {form.composition_enabled && (
            <div className="col-span-6 md:col-span-3">
              <label className={labelClass}>Fórmula de precificação</label>
              <div className="flex gap-2">
                <select
                  value={form.formula_id}
                  onChange={e => onUpdate('formula_id', e.target.value)}
                  className={`${inputClass} appearance-none cursor-pointer flex-1`}
                >
                  <option value="default">Configuração atual</option>
                </select>
                <button
                  type="button"
                  onClick={() => setShowAdvanced(true)}
                  className="px-3 py-2.5 border border-slate-200 dark:border-[#3d3d48] rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                  title="Configuração avançada"
                >
                  <Settings2 className="w-4 h-4 text-slate-500" />
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Modal config avancada */}
      {showAdvanced && (
        <AdvancedConfigModal
          form={form}
          compositionCostValue={0}
          onUpdate={onUpdate}
          onClose={() => setShowAdvanced(false)}
        />
      )}
    </>
  );
}
