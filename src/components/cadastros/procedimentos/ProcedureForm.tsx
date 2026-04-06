'use client';

import { useState, useCallback } from 'react';
import { ArrowLeft, Save, Loader2, Stethoscope } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/contexts/ToastContext';
import type { Procedure } from '@/types/cadastros';
import {
  EMPTY_FORM,
  procedureToFormData,
  type ProcedureFormData,
  type ProductCompositionItem,
} from './types';
import ProcedureBasicData from './ProcedureBasicData';
import ProcedureComposition from './ProcedureComposition';
import ProcedurePreparation from './ProcedurePreparation';
import ProcedurePricing from './ProcedurePricing';

interface ProcedureFormProps {
  initialData?: Procedure | null;
  initialCompositions?: ProductCompositionItem[];
  onSubmit: (data: ProcedureFormData, compositions: ProductCompositionItem[]) => Promise<void>;
  title: string;
  subtitle: string;
}

export default function ProcedureForm({
  initialData,
  initialCompositions,
  onSubmit,
  title,
  subtitle,
}: ProcedureFormProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [form, setForm] = useState<ProcedureFormData>(
    initialData ? procedureToFormData(initialData) : { ...EMPTY_FORM },
  );
  const [compositions, setCompositions] = useState<ProductCompositionItem[]>(initialCompositions || []);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const update = useCallback(<K extends keyof ProcedureFormData>(key: K, value: ProcedureFormData[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => {
      if (prev[key]) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return prev;
    });
  }, []);

  const handleCompositionValueChange = useCallback((saleValue: number, costValue: number) => {
    setForm(prev => ({
      ...prev,
      composition_value: saleValue,
      treatment_composition: costValue,
    }));
  }, []);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Nome é obrigatório.';
    if (!form.procedure_type) errs.procedure_type = 'Tipo é obrigatório.';
    if (!form.duration_minutes || form.duration_minutes <= 0) errs.duration_minutes = 'Duração é obrigatória.';
    if (form.procedure_type === 'injectable' && !form.way_id) errs.way_id = 'Via de aplicação é obrigatória.';
    if (form.honorarium_value < 0) errs.honorarium_value = 'Valor de honorários inválido.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      toast.error('Preencha todos os campos obrigatórios.');
      return;
    }

    // Calcular total
    const totalValue = form.composition_enabled
      ? form.composition_value + form.honorarium_value
      : form.honorarium_value;

    const finalForm = { ...form, total_value: totalValue };

    setSaving(true);
    try {
      await onSubmit(finalForm, form.composition_enabled ? compositions : []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      toast.error('Erro ao salvar: ' + msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-[#15171e]">
      {/* Header */}
      <div className="px-6 py-4 flex items-center gap-4 border-b border-slate-200 dark:border-[#3d3d48] bg-white dark:bg-[#08080b]">
        <button
          onClick={() => router.push('/atendimento/cadastros/procedimentos')}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-500" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-slate-800 dark:text-[#fafafa] flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-teal-600" />
            {title}
          </h1>
          <p className="text-xs text-slate-400 dark:text-[#71717a]">{subtitle}</p>
        </div>
      </div>

      {/* Conteudo scrollavel */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-5xl mx-auto space-y-6">

          {/* Secao: Informacoes Basicas */}
          <section className="bg-white dark:bg-[#08080b] rounded-xl border border-slate-200 dark:border-[#3d3d48] p-6 space-y-5">
            <h2 className="text-sm font-bold text-slate-700 dark:text-[#d4d4d8] uppercase tracking-wide flex items-center gap-2">
              <Stethoscope className="w-4 h-4 text-teal-500" />
              Informações do Procedimento
            </h2>
            <ProcedureBasicData form={form} errors={errors} onUpdate={update} />
          </section>

          {/* Secao: Composicao */}
          <ProcedureComposition
            compositionEnabled={form.composition_enabled}
            compositions={compositions}
            onToggle={(enabled) => update('composition_enabled', enabled)}
            onCompositionsChange={setCompositions}
            onCompositionValueChange={handleCompositionValueChange}
          />

          {/* Secao: Preparacao (somente com composicao) */}
          {form.composition_enabled && (
            <section className="bg-white dark:bg-[#08080b] rounded-xl border border-slate-200 dark:border-[#3d3d48] p-6 space-y-5">
              <h2 className="text-sm font-bold text-slate-700 dark:text-[#d4d4d8] uppercase tracking-wide">
                Preparação
              </h2>
              <ProcedurePreparation
                note={form.note}
                onChange={(v) => update('note', v)}
              />
            </section>
          )}

          {/* Secao: Precificacao */}
          <ProcedurePricing form={form} onUpdate={update} errors={errors} />
        </div>
      </div>

      {/* Footer fixo */}
      <div className="px-6 py-4 border-t border-slate-200 dark:border-[#3d3d48] bg-white dark:bg-[#08080b] flex items-center justify-end gap-3">
        <button
          onClick={() => router.push('/atendimento/cadastros/procedimentos')}
          className="px-5 py-2.5 text-sm font-semibold text-slate-600 dark:text-[#d4d4d8] hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-lg shadow-teal-500/20 transition-all active:scale-95 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          SALVAR INFORMAÇÕES
        </button>
      </div>
    </div>
  );
}
