'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  ArrowLeft, Save, Loader2, Stethoscope, DollarSign,
  ChevronDown, Plus, Trash2, Search,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/contexts/ToastContext';
import { useProcedures } from '@/hooks/useProcedures';
import type { Procedure } from '@/types/cadastros';

// --- Constantes ---

const PROCEDURE_TYPES = [
  { value: 'consultation', label: 'Consultas' },
  { value: 'exam', label: 'Exames' },
  { value: 'injectable', label: 'Injetáveis' },
  { value: 'other', label: 'Outros' },
] as const;

// --- Tipos ---

export interface ProcedureFormData {
  name: string;
  procedure_type: string;
  duration_minutes: number;
  composition_enabled: boolean;
  fee_value: number;
}

export interface CompositionItem {
  sub_procedure_id: string;
  sub_procedure_name: string;
  quantity: number;
}

interface ProcedureFormProps {
  initialData?: Procedure | null;
  initialCompositions?: CompositionItem[];
  onSubmit: (data: ProcedureFormData, compositions: CompositionItem[]) => Promise<void>;
  title: string;
  subtitle: string;
}

// --- Helpers ---

const inputClass = 'w-full px-3 py-2.5 text-sm border border-slate-200 dark:border-gray-700 rounded-xl bg-white dark:bg-[#2a2d36] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-400 disabled:opacity-50';
const selectClass = `${inputClass} appearance-none cursor-pointer`;
const labelClass = 'text-xs font-bold text-slate-500 dark:text-gray-400 mb-1.5 ml-1 block uppercase tracking-wider';

function RequiredBadge() {
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 ml-1">
      Obrigatório
    </span>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

const EMPTY_FORM: ProcedureFormData = {
  name: '',
  procedure_type: '',
  duration_minutes: 30,
  composition_enabled: false,
  fee_value: 0,
};

function procedureToForm(p: Procedure): ProcedureFormData {
  return {
    name: p.name,
    procedure_type: p.procedure_type,
    duration_minutes: p.duration_minutes,
    composition_enabled: p.composition_enabled,
    fee_value: p.fee_value,
  };
}

// --- Componente ---

export default function ProcedureForm({ initialData, initialCompositions, onSubmit, title, subtitle }: ProcedureFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { procedures: allProcedures, listProcedures } = useProcedures();

  const [form, setForm] = useState<ProcedureFormData>(
    initialData ? procedureToForm(initialData) : { ...EMPTY_FORM },
  );
  const [compositions, setCompositions] = useState<CompositionItem[]>(initialCompositions || []);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [compSearch, setCompSearch] = useState('');

  // Carregar procedimentos disponíveis para composição
  useEffect(() => {
    listProcedures({ pageSize: 500 });
  }, [listProcedures]);

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

  // Calcular valor total: fee_value + soma dos sub-procedimentos
  const compositionTotal = useMemo(() => {
    return compositions.reduce((acc, item) => {
      const proc = allProcedures.find(p => p.id === item.sub_procedure_id);
      return acc + (proc ? proc.total_value * item.quantity : 0);
    }, 0);
  }, [compositions, allProcedures]);

  const totalValue = form.fee_value + (form.composition_enabled ? compositionTotal : 0);

  // Procedimentos disponíveis para composição (excluindo o atual e já adicionados)
  const availableProcedures = useMemo(() => {
    const addedIds = new Set(compositions.map(c => c.sub_procedure_id));
    return allProcedures.filter(p => {
      if (initialData && p.id === initialData.id) return false;
      if (addedIds.has(p.id)) return false;
      if (compSearch.trim()) {
        return p.name.toLowerCase().includes(compSearch.trim().toLowerCase());
      }
      return true;
    });
  }, [allProcedures, compositions, initialData, compSearch]);

  const addComposition = useCallback((proc: Procedure) => {
    setCompositions(prev => [...prev, {
      sub_procedure_id: proc.id,
      sub_procedure_name: proc.name,
      quantity: 1,
    }]);
    setCompSearch('');
  }, []);

  const removeComposition = useCallback((index: number) => {
    setCompositions(prev => prev.filter((_, i) => i !== index));
  }, []);

  const updateCompositionQty = useCallback((index: number, qty: number) => {
    setCompositions(prev => prev.map((c, i) => i === index ? { ...c, quantity: Math.max(1, qty) } : c));
  }, []);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Nome é obrigatório.';
    if (!form.procedure_type) errs.procedure_type = 'Tipo é obrigatório.';
    if (!form.duration_minutes || form.duration_minutes <= 0) errs.duration_minutes = 'Duração é obrigatória.';
    if (form.fee_value < 0) errs.fee_value = 'Valor de honorários inválido.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      toast.error('Preencha todos os campos obrigatórios.');
      return;
    }
    setSaving(true);
    try {
      await onSubmit(form, form.composition_enabled ? compositions : []);
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
      <div className="px-6 py-4 flex items-center gap-4 border-b border-slate-200 dark:border-gray-700 bg-white dark:bg-[#1e2028]">
        <button
          onClick={() => router.push('/atendimento/cadastros/procedimentos')}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-500" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-slate-800 dark:text-gray-100 flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-teal-600" />
            {title}
          </h1>
          <p className="text-xs text-slate-400 dark:text-gray-500">{subtitle}</p>
        </div>
      </div>

      {/* Conteúdo scrollável */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* ─── Seção: Informações do Procedimento ─── */}
          <section className="bg-white dark:bg-[#1e2028] rounded-xl border border-slate-200 dark:border-gray-700 p-6 space-y-5">
            <h2 className="text-sm font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wide flex items-center gap-2">
              <Stethoscope className="w-4 h-4 text-teal-500" />
              Informações do Procedimento
            </h2>

            <div className="grid grid-cols-12 gap-5">
              {/* Nome */}
              <div className="col-span-12 md:col-span-6">
                <label className={labelClass}>Nome <RequiredBadge /></label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => update('name', e.target.value)}
                  placeholder="Nome do procedimento"
                  className={`${inputClass} ${errors.name ? 'border-red-300 dark:border-red-700' : ''}`}
                />
                {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
              </div>

              {/* Tipo */}
              <div className="col-span-6 md:col-span-3">
                <label className={labelClass}>Tipo <RequiredBadge /></label>
                <div className="relative">
                  <select
                    value={form.procedure_type}
                    onChange={e => update('procedure_type', e.target.value)}
                    className={`${selectClass} ${errors.procedure_type ? 'border-red-300 dark:border-red-700' : ''}`}
                  >
                    <option value="">Selecione</option>
                    {PROCEDURE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
                {errors.procedure_type && <p className="mt-1 text-xs text-red-500">{errors.procedure_type}</p>}
              </div>

              {/* Duração */}
              <div className="col-span-6 md:col-span-3">
                <label className={labelClass}>Duração (min) <RequiredBadge /></label>
                <input
                  type="number"
                  min={1}
                  value={form.duration_minutes}
                  onChange={e => update('duration_minutes', Math.max(1, Number(e.target.value)))}
                  className={`${inputClass} text-center ${errors.duration_minutes ? 'border-red-300 dark:border-red-700' : ''}`}
                />
                {errors.duration_minutes && <p className="mt-1 text-xs text-red-500">{errors.duration_minutes}</p>}
              </div>
            </div>
          </section>

          {/* ─── Seção: Composição do Procedimento ─── */}
          <section className="bg-white dark:bg-[#1e2028] rounded-xl border border-slate-200 dark:border-gray-700 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wide">
                Composição do Procedimento
              </h2>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-sm text-slate-600 dark:text-gray-300">Habilitar composição</span>
                <button
                  type="button"
                  onClick={() => update('composition_enabled', !form.composition_enabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    form.composition_enabled ? 'bg-teal-600' : 'bg-slate-300 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      form.composition_enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </label>
            </div>

            {form.composition_enabled && (
              <>
                {/* Busca de sub-procedimentos */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={compSearch}
                    onChange={e => setCompSearch(e.target.value)}
                    placeholder="Buscar procedimento para adicionar..."
                    className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 dark:border-gray-700 rounded-xl bg-white dark:bg-[#2a2d36] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-400"
                  />
                </div>

                {/* Lista de disponíveis (mostra quando tem busca) */}
                {compSearch.trim() && availableProcedures.length > 0 && (
                  <div className="max-h-40 overflow-y-auto bg-slate-50 dark:bg-[#15171e] rounded-xl border border-slate-200 dark:border-gray-700">
                    {availableProcedures.slice(0, 10).map(proc => (
                      <button
                        key={proc.id}
                        onClick={() => addComposition(proc)}
                        className="flex items-center justify-between w-full px-4 py-2.5 hover:bg-teal-50 dark:hover:bg-teal-900/10 transition-colors text-left"
                      >
                        <span className="text-sm text-slate-700 dark:text-gray-200">{proc.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-slate-400">{formatCurrency(proc.total_value)}</span>
                          <Plus className="w-4 h-4 text-teal-500" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {compSearch.trim() && availableProcedures.length === 0 && (
                  <p className="text-xs text-slate-400 dark:text-gray-500 px-1">Nenhum procedimento encontrado.</p>
                )}

                {/* Itens adicionados */}
                {compositions.length > 0 ? (
                  <div className="bg-slate-50 dark:bg-[#15171e] rounded-xl border border-slate-200 dark:border-gray-700 overflow-hidden">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="bg-slate-100 dark:bg-[#2a2d36] border-b border-slate-200 dark:border-gray-700">
                          <th className="px-4 py-2.5 text-xs font-extrabold text-slate-500 dark:text-gray-400 uppercase">Procedimento</th>
                          <th className="px-4 py-2.5 text-xs font-extrabold text-slate-500 dark:text-gray-400 uppercase text-center w-24">Qtd</th>
                          <th className="px-4 py-2.5 text-xs font-extrabold text-slate-500 dark:text-gray-400 uppercase text-center w-16">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-gray-800">
                        {compositions.map((item, idx) => (
                          <tr key={item.sub_procedure_id} className="hover:bg-white dark:hover:bg-[#1e2028] transition-colors">
                            <td className="px-4 py-3 text-slate-700 dark:text-gray-200">{item.sub_procedure_name}</td>
                            <td className="px-4 py-3 text-center">
                              <input
                                type="number"
                                min={1}
                                value={item.quantity}
                                onChange={e => updateCompositionQty(idx, Number(e.target.value))}
                                className="w-16 px-2 py-1 text-sm text-center border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-[#2a2d36] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-400"
                              />
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => removeComposition(idx)}
                                className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/10 text-red-400 hover:text-red-600 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-6 bg-slate-50 dark:bg-[#15171e] rounded-xl border border-dashed border-slate-200 dark:border-gray-700">
                    <p className="text-sm text-slate-400 dark:text-gray-500">Nenhum sub-procedimento adicionado.</p>
                  </div>
                )}
              </>
            )}
          </section>

          {/* ─── Seção: Precificação ─── */}
          <section className="bg-white dark:bg-[#1e2028] rounded-xl border border-slate-200 dark:border-gray-700 p-6 space-y-5">
            <h2 className="text-sm font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wide flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-teal-500" />
              Precificação do Procedimento
            </h2>

            <div className="grid grid-cols-12 gap-5">
              {/* Valor de honorários */}
              <div className="col-span-6 md:col-span-4">
                <label className={labelClass}>Valor de honorários (R$) <RequiredBadge /></label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.fee_value || ''}
                  onChange={e => update('fee_value', Number(e.target.value))}
                  placeholder="0,00"
                  className={`${inputClass} text-right font-mono ${errors.fee_value ? 'border-red-300 dark:border-red-700' : ''}`}
                />
                {errors.fee_value && <p className="mt-1 text-xs text-red-500">{errors.fee_value}</p>}
              </div>

              {/* Composição total (se habilitada) */}
              {form.composition_enabled && compositions.length > 0 && (
                <div className="col-span-6 md:col-span-4">
                  <label className={labelClass}>Composição</label>
                  <div className="px-3 py-2.5 text-sm font-mono text-right text-slate-600 dark:text-gray-300 bg-slate-100 dark:bg-[#15171e] border border-slate-200 dark:border-gray-700 rounded-xl">
                    {formatCurrency(compositionTotal)}
                  </div>
                </div>
              )}

              {/* Valor total */}
              <div className="col-span-6 md:col-span-4">
                <label className={labelClass}>Valor total</label>
                <div className="px-3 py-2.5 text-sm font-bold font-mono text-right text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-900/10 border border-teal-200 dark:border-teal-800 rounded-xl">
                  {formatCurrency(totalValue)}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Footer fixo */}
      <div className="px-6 py-4 border-t border-slate-200 dark:border-gray-700 bg-white dark:bg-[#1e2028] flex items-center justify-end gap-3">
        <button
          onClick={() => router.push('/atendimento/cadastros/procedimentos')}
          className="px-5 py-2.5 text-sm font-semibold text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors"
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
