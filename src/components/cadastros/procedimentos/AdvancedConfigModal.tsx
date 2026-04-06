'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { inputClass, labelClass, type ProcedureFormData } from './types';

interface Props {
  form: ProcedureFormData;
  compositionCostValue: number;
  onUpdate: <K extends keyof ProcedureFormData>(key: K, value: ProcedureFormData[K]) => void;
  onClose: () => void;
}

type NumericField = Extract<keyof ProcedureFormData,
  'treatment_composition' | 'other_costs' | 'card_tax' | 'commission' | 'discount' |
  'inss' | 'irrf' | 'irpj' | 'csll' | 'pis' | 'cofins' | 'cpp' | 'iss' | 'other_tax' |
  'contribution_margin'
>;

const TAX_FIELDS: { key: NumericField; label: string; tooltip: string }[] = [
  { key: 'inss', label: 'INSS (%)', tooltip: 'Instituto Nacional do Seguro Social' },
  { key: 'irrf', label: 'IRRF (%)', tooltip: 'Imposto de Renda Retido na Fonte' },
  { key: 'irpj', label: 'IRPJ (%)', tooltip: 'Imposto sobre a renda das pessoas jurídicas' },
  { key: 'csll', label: 'CSLL (%)', tooltip: 'Contribuição Social sobre o Lucro Líquido' },
  { key: 'pis', label: 'PIS/PASEP (%)', tooltip: 'Programa de Integração Social' },
  { key: 'cofins', label: 'COFINS (%)', tooltip: 'Contribuição para o Financiamento da Seguridade Social' },
  { key: 'cpp', label: 'CPP (%)', tooltip: 'Contribuição Patronal Previdenciária' },
  { key: 'iss', label: 'ISS (ISSQN) (%)', tooltip: 'Imposto sobre Serviços de Qualquer Natureza' },
  { key: 'other_tax', label: 'Outros impostos (%)', tooltip: '' },
];

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-bold text-slate-600 dark:text-[#d4d4d8] uppercase tracking-wider border-b border-slate-200 dark:border-[#3d3d48] pb-2 mb-4">
      {children}
    </h3>
  );
}

function SectionDescription({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs text-slate-400 dark:text-[#71717a] mb-4 -mt-2">{children}</p>
  );
}

export default function AdvancedConfigModal({ form, onUpdate, onClose }: Props) {
  const [local, setLocal] = useState({
    treatment_composition: form.treatment_composition,
    other_costs: form.other_costs,
    card_tax: form.card_tax,
    commission: form.commission,
    discount: form.discount,
    inss: form.inss,
    irrf: form.irrf,
    irpj: form.irpj,
    csll: form.csll,
    pis: form.pis,
    cofins: form.cofins,
    cpp: form.cpp,
    iss: form.iss,
    other_tax: form.other_tax,
    contribution_margin: form.contribution_margin,
    contribution_margin_type: form.contribution_margin_type,
  });

  const updateLocal = (key: string, value: number | string) => {
    setLocal(prev => ({ ...prev, [key]: value }));
  };

  const handleApply = () => {
    (Object.keys(local) as (keyof typeof local)[]).forEach(key => {
      onUpdate(key as keyof ProcedureFormData, local[key] as never);
    });
    onClose();
  };

  const numInput = (key: NumericField, placeholder = '0,00') => (
    <input
      type="number"
      min={0}
      step={0.01}
      value={local[key] || ''}
      onChange={e => updateLocal(key, Number(e.target.value))}
      placeholder={placeholder}
      className={`${inputClass} text-right font-mono`}
    />
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#08080b] rounded-2xl border border-slate-200 dark:border-[#3d3d48] shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-[#3d3d48]">
          <h2 className="text-base font-bold text-slate-800 dark:text-[#fafafa]">Configuração Avançada</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Custos Variaveis */}
          <div>
            <SectionTitle>Custos Variáveis</SectionTitle>
            <SectionDescription>Despesas que aumentam ou diminuem conforme o número de procedimentos realizados.</SectionDescription>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Custo do procedimento (R$)</label>
                {numInput('treatment_composition')}
              </div>
              <div>
                <label className={labelClass}>Outros custos (R$)</label>
                {numInput('other_costs')}
              </div>
            </div>
          </div>

          {/* Despesas Variaveis */}
          <div>
            <SectionTitle>Despesas Variáveis</SectionTitle>
            <SectionDescription>Gastos que aumentam ou diminuem proporcionalmente ao valor do procedimento.</SectionDescription>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Taxa de cartão (%)</label>
                {numInput('card_tax', '0')}
              </div>
              <div>
                <label className={labelClass}>Comissão (%)</label>
                {numInput('commission', '0')}
              </div>
              <div>
                <label className={labelClass}>Desconto (%)</label>
                {numInput('discount', '0')}
              </div>
            </div>
          </div>

          {/* Impostos */}
          <div>
            <SectionTitle>Impostos</SectionTitle>
            <SectionDescription>Despesas obrigatórias pagas ao governo, calculadas com base na receita, lucro ou atividades econômicas.</SectionDescription>
            <div className="grid grid-cols-3 gap-4">
              {TAX_FIELDS.map(({ key, label, tooltip }) => (
                <div key={key}>
                  <label className={labelClass} title={tooltip}>
                    {label}
                  </label>
                  {numInput(key, '0')}
                </div>
              ))}
            </div>
          </div>

          {/* Margem de Contribuicao */}
          <div>
            <SectionTitle>Margem de Contribuição</SectionTitle>
            <SectionDescription>Diferença entre a receita de vendas e os custos/despesas variáveis, indicando o quanto sobra para cobrir custos fixos e gerar lucro.</SectionDescription>
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <div className="flex gap-4 mb-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="margin_type"
                      checked={local.contribution_margin_type === 'percentage'}
                      onChange={() => updateLocal('contribution_margin_type', 'percentage')}
                      className="accent-teal-600"
                    />
                    <span className="text-sm text-slate-600 dark:text-[#d4d4d8]">Percentual (%)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="margin_type"
                      checked={local.contribution_margin_type === 'fixed'}
                      onChange={() => updateLocal('contribution_margin_type', 'fixed')}
                      className="accent-teal-600"
                    />
                    <span className="text-sm text-slate-600 dark:text-[#d4d4d8]">Valor (R$)</span>
                  </label>
                </div>
                <label className={labelClass}>
                  Margem de contribuição {local.contribution_margin_type === 'percentage' ? '(%)' : '(R$)'}
                </label>
                {numInput('contribution_margin', '0')}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-[#3d3d48]">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-semibold text-slate-600 dark:text-[#d4d4d8] hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors"
          >
            Fechar
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="px-6 py-2.5 text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-lg shadow-teal-500/20 transition-all active:scale-95"
          >
            Aplicar Total
          </button>
        </div>
      </div>
    </div>
  );
}
