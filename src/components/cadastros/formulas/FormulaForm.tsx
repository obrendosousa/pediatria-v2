'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  ArrowLeft, Save, Loader2, FlaskConical, Layers,
  FileText, ChevronDown, Plus, Trash2, Search,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/contexts/ToastContext';
import { useSubstances } from '@/hooks/useSubstances';
import type { Formula } from '@/types/cadastros';

// --- Constantes ---

const ROUTE_OPTIONS = [
  'Oral', 'Sublingual', 'Tópica', 'Transdérmica', 'Inalatória',
  'Retal', 'Vaginal', 'Ocular', 'Nasal', 'Auricular',
  'Intravenosa', 'Intramuscular', 'Subcutânea', 'Outra',
] as const;

const FORM_OPTIONS = [
  'Cápsula', 'Comprimido', 'Creme', 'Drágea', 'Elixir',
  'Emulsão', 'Gel', 'Loção', 'Pomada', 'Pó',
  'Solução', 'Spray', 'Suspensão', 'Xarope', 'Outra',
] as const;

const UNIT_OPTIONS = [
  'mg', 'g', 'kg', 'mcg', 'mL', 'L',
  'UI', 'gotas', 'cápsulas', 'comprimidos', 'unidades',
] as const;

// --- Tipos ---

export interface FormulaFormData {
  name: string;
  route_of_use: string;
  form: string;
  quantity: number;
  unit: string;
  posology: string;
  reference: string;
  notes: string;
  status: string;
}

export interface CompositionRow {
  substance_id: string;
  substance_name: string;
  quantity: number | null;
  unit: string | null;
}

interface FormulaFormProps {
  initialData?: Formula | null;
  initialCompositions?: CompositionRow[];
  onSubmit: (data: FormulaFormData, compositions: CompositionRow[]) => Promise<void>;
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

const EMPTY_FORM: FormulaFormData = {
  name: '', route_of_use: '', form: '',
  quantity: 1, unit: '',
  posology: '', reference: '', notes: '',
  status: 'active',
};

function formulaToForm(f: Formula): FormulaFormData {
  return {
    name: f.name,
    route_of_use: f.route_of_use,
    form: f.form,
    quantity: f.quantity,
    unit: f.unit,
    posology: f.posology,
    reference: f.reference || '',
    notes: f.notes || '',
    status: f.status,
  };
}

// --- Componente ---

export default function FormulaForm({ initialData, initialCompositions, onSubmit, title, subtitle }: FormulaFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { substances, listSubstances } = useSubstances();

  const [form, setForm] = useState<FormulaFormData>(
    initialData ? formulaToForm(initialData) : { ...EMPTY_FORM },
  );
  const [compositions, setCompositions] = useState<CompositionRow[]>(initialCompositions || []);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Substance search
  const [subSearch, setSubSearch] = useState('');
  const [subDropdownOpen, setSubDropdownOpen] = useState(false);
  const [newCompQty, setNewCompQty] = useState<number | ''>('');
  const [newCompUnit, setNewCompUnit] = useState('');
  const [selectedSubstance, setSelectedSubstance] = useState<{ id: string; name: string } | null>(null);
  const subSearchRef = useRef<HTMLDivElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced substance search
  useEffect(() => {
    if (!subSearch.trim() || subSearch.trim().length < 2) {
      setSubDropdownOpen(false);
      return;
    }
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      listSubstances(subSearch, 0, 15);
      setSubDropdownOpen(true);
    }, 300);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [subSearch, listSubstances]);

  // Click outside substance dropdown
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (subSearchRef.current && !subSearchRef.current.contains(e.target as Node)) {
        setSubDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const update = useCallback(<K extends keyof FormulaFormData>(key: K, value: FormulaFormData[K]) => {
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

  const handleSelectSubstance = useCallback((sub: { id: string; name: string }) => {
    setSelectedSubstance(sub);
    setSubSearch(sub.name);
    setSubDropdownOpen(false);
  }, []);

  const addComposition = useCallback(() => {
    if (!selectedSubstance) {
      toast.error('Selecione uma substância.');
      return;
    }
    if (compositions.some(c => c.substance_id === selectedSubstance.id)) {
      toast.error('Substância já adicionada.');
      return;
    }
    setCompositions(prev => [...prev, {
      substance_id: selectedSubstance.id,
      substance_name: selectedSubstance.name,
      quantity: newCompQty === '' ? null : newCompQty,
      unit: newCompUnit || null,
    }]);
    setSelectedSubstance(null);
    setSubSearch('');
    setNewCompQty('');
    setNewCompUnit('');
  }, [selectedSubstance, newCompQty, newCompUnit, compositions, toast]);

  const removeComposition = useCallback((index: number) => {
    setCompositions(prev => prev.filter((_, i) => i !== index));
  }, []);

  const validate = useCallback((): boolean => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Nome é obrigatório.';
    if (!form.route_of_use) errs.route_of_use = 'Via de uso é obrigatória.';
    if (!form.form) errs.form = 'Forma é obrigatória.';
    if (!form.quantity || form.quantity <= 0) errs.quantity = 'Quantidade é obrigatória.';
    if (!form.unit) errs.unit = 'Unidade é obrigatória.';
    if (!form.posology.trim()) errs.posology = 'Posologia é obrigatória.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [form]);

  const handleSubmit = useCallback(async () => {
    if (!validate()) {
      toast.error('Preencha todos os campos obrigatórios.');
      return;
    }
    setSaving(true);
    try {
      await onSubmit(form, compositions);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      toast.error('Erro ao salvar: ' + msg);
    } finally {
      setSaving(false);
    }
  }, [validate, form, compositions, onSubmit, toast]);

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-[#15171e]">
      {/* Header */}
      <div className="px-6 py-4 flex items-center gap-4 border-b border-slate-200 dark:border-gray-700 bg-white dark:bg-[#1e2028]">
        <button
          onClick={() => router.push('/atendimento/cadastros/receituario/formulas')}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-500" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-slate-800 dark:text-gray-100 flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-teal-600" />
            {title}
          </h1>
          <p className="text-xs text-slate-400 dark:text-gray-500">{subtitle}</p>
        </div>
      </div>

      {/* Conteúdo scrollável */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* ─── Seção 1: Informações do Composto ─── */}
          <section className="bg-white dark:bg-[#1e2028] rounded-xl border border-slate-200 dark:border-gray-700 p-6 space-y-5">
            <h2 className="text-sm font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wide flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-teal-500" />
              Informações do Composto
            </h2>

            <div className="grid grid-cols-12 gap-5">
              {/* Nome */}
              <div className="col-span-12 md:col-span-6">
                <label className={labelClass}>Nome da fórmula <RequiredBadge /></label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => update('name', e.target.value)}
                  placeholder="Nome da fórmula"
                  className={`${inputClass} ${errors.name ? 'border-red-300 dark:border-red-700' : ''}`}
                />
                {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
              </div>

              {/* Via de uso */}
              <div className="col-span-6 md:col-span-3">
                <label className={labelClass}>Via de uso <RequiredBadge /></label>
                <div className="relative">
                  <select
                    value={form.route_of_use}
                    onChange={e => update('route_of_use', e.target.value)}
                    className={`${selectClass} ${errors.route_of_use ? 'border-red-300 dark:border-red-700' : ''}`}
                  >
                    <option value="">Selecione</option>
                    {ROUTE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
                {errors.route_of_use && <p className="mt-1 text-xs text-red-500">{errors.route_of_use}</p>}
              </div>

              {/* Forma */}
              <div className="col-span-6 md:col-span-3">
                <label className={labelClass}>Forma <RequiredBadge /></label>
                <div className="relative">
                  <select
                    value={form.form}
                    onChange={e => update('form', e.target.value)}
                    className={`${selectClass} ${errors.form ? 'border-red-300 dark:border-red-700' : ''}`}
                  >
                    <option value="">Selecione</option>
                    {FORM_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
                {errors.form && <p className="mt-1 text-xs text-red-500">{errors.form}</p>}
              </div>

              {/* Quantidade */}
              <div className="col-span-6 md:col-span-3">
                <label className={labelClass}>Quantidade <RequiredBadge /></label>
                <input
                  type="number"
                  min={1}
                  value={form.quantity}
                  onChange={e => update('quantity', Math.max(1, Number(e.target.value)))}
                  className={`${inputClass} text-center ${errors.quantity ? 'border-red-300 dark:border-red-700' : ''}`}
                />
                {errors.quantity && <p className="mt-1 text-xs text-red-500">{errors.quantity}</p>}
              </div>

              {/* Unidade */}
              <div className="col-span-6 md:col-span-3">
                <label className={labelClass}>Unidade <RequiredBadge /></label>
                <div className="relative">
                  <select
                    value={form.unit}
                    onChange={e => update('unit', e.target.value)}
                    className={`${selectClass} ${errors.unit ? 'border-red-300 dark:border-red-700' : ''}`}
                  >
                    <option value="">Selecione</option>
                    {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
                {errors.unit && <p className="mt-1 text-xs text-red-500">{errors.unit}</p>}
              </div>
            </div>
          </section>

          {/* ─── Seção 2: Composição ─── */}
          <section className="bg-white dark:bg-[#1e2028] rounded-xl border border-slate-200 dark:border-gray-700 p-6 space-y-5">
            <h2 className="text-sm font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wide flex items-center gap-2">
              <Layers className="w-4 h-4 text-teal-500" />
              Composição
            </h2>

            {/* Adicionar substância */}
            <div className="grid grid-cols-12 gap-3 items-end">
              {/* Busca de substância */}
              <div className="col-span-12 md:col-span-5" ref={subSearchRef}>
                <label className={labelClass}>Substância</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={subSearch}
                    onChange={e => { setSubSearch(e.target.value); setSelectedSubstance(null); }}
                    placeholder="Buscar substância..."
                    className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 dark:border-gray-700 rounded-xl bg-white dark:bg-[#2a2d36] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-400"
                  />

                  {subDropdownOpen && substances.length > 0 && (
                    <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto bg-white dark:bg-[#2a2d36] border border-slate-200 dark:border-gray-700 rounded-xl shadow-xl">
                      {substances.map(s => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => handleSelectSubstance(s)}
                          className="w-full px-4 py-2.5 text-sm text-left text-slate-700 dark:text-gray-200 hover:bg-teal-50 dark:hover:bg-teal-900/10 transition-colors"
                        >
                          {s.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Quantidade */}
              <div className="col-span-4 md:col-span-2">
                <label className={labelClass}>Quantidade</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={newCompQty}
                  onChange={e => setNewCompQty(e.target.value ? Number(e.target.value) : '')}
                  placeholder="Qtd"
                  className={`${inputClass} text-center`}
                />
              </div>

              {/* Unidade */}
              <div className="col-span-4 md:col-span-3">
                <label className={labelClass}>Unidade</label>
                <div className="relative">
                  <select
                    value={newCompUnit}
                    onChange={e => setNewCompUnit(e.target.value)}
                    className={selectClass}
                  >
                    <option value="">Selecione</option>
                    {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Botão adicionar */}
              <div className="col-span-4 md:col-span-2">
                <button
                  type="button"
                  onClick={addComposition}
                  className="w-full flex items-center justify-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white px-3 py-2.5 rounded-xl text-xs font-bold shadow-md transition-all active:scale-95"
                >
                  <Plus className="w-4 h-4" /> ADICIONAR
                </button>
              </div>
            </div>

            {/* Tabela de composição */}
            {compositions.length > 0 ? (
              <div className="bg-slate-50 dark:bg-[#15171e] rounded-xl border border-slate-200 dark:border-gray-700 overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-[#2a2d36] border-b border-slate-200 dark:border-gray-700">
                      <th className="px-4 py-2.5 text-xs font-extrabold text-slate-500 dark:text-gray-400 uppercase">Item</th>
                      <th className="px-4 py-2.5 text-xs font-extrabold text-slate-500 dark:text-gray-400 uppercase text-center">Quantidade</th>
                      <th className="px-4 py-2.5 text-xs font-extrabold text-slate-500 dark:text-gray-400 uppercase text-center">Unidade</th>
                      <th className="px-4 py-2.5 text-xs font-extrabold text-slate-500 dark:text-gray-400 uppercase text-center w-16">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-gray-800">
                    {compositions.map((item, idx) => (
                      <tr key={item.substance_id} className="hover:bg-white dark:hover:bg-[#1e2028] transition-colors">
                        <td className="px-4 py-3 text-slate-700 dark:text-gray-200">{item.substance_name}</td>
                        <td className="px-4 py-3 text-center text-slate-600 dark:text-gray-300">
                          {item.quantity ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-center text-slate-600 dark:text-gray-300">
                          {item.unit ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            type="button"
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
                <Layers className="w-8 h-8 text-slate-300 dark:text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-slate-400 dark:text-gray-500">Nenhuma substância adicionada.</p>
              </div>
            )}
          </section>

          {/* ─── Seção 3: Dados Complementares ─── */}
          <section className="bg-white dark:bg-[#1e2028] rounded-xl border border-slate-200 dark:border-gray-700 p-6 space-y-5">
            <h2 className="text-sm font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wide flex items-center gap-2">
              <FileText className="w-4 h-4 text-teal-500" />
              Dados Complementares
            </h2>

            <div className="grid grid-cols-12 gap-5">
              {/* Posologia */}
              <div className="col-span-12 md:col-span-6">
                <label className={labelClass}>Posologia <RequiredBadge /></label>
                <input
                  type="text"
                  value={form.posology}
                  onChange={e => update('posology', e.target.value)}
                  placeholder="Ex: 1 comprimido a cada 8h"
                  className={`${inputClass} ${errors.posology ? 'border-red-300 dark:border-red-700' : ''}`}
                />
                {errors.posology && <p className="mt-1 text-xs text-red-500">{errors.posology}</p>}
              </div>

              {/* Referência */}
              <div className="col-span-12 md:col-span-6">
                <label className={labelClass}>Referência</label>
                <input
                  type="text"
                  value={form.reference}
                  onChange={e => update('reference', e.target.value)}
                  placeholder="Referência bibliográfica"
                  className={inputClass}
                />
              </div>

              {/* Observações */}
              <div className="col-span-12">
                <label className={labelClass}>Observações</label>
                <textarea
                  value={form.notes}
                  onChange={e => update('notes', e.target.value)}
                  rows={3}
                  placeholder="Observações adicionais..."
                  className={`${inputClass} resize-none`}
                />
              </div>

              {/* Status */}
              <div className="col-span-6 md:col-span-3">
                <label className={labelClass}>Status</label>
                <div className="relative">
                  <select
                    value={form.status}
                    onChange={e => update('status', e.target.value)}
                    className={selectClass}
                  >
                    <option value="active">Ativo</option>
                    <option value="inactive">Inativo</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Footer fixo */}
      <div className="px-6 py-4 border-t border-slate-200 dark:border-gray-700 bg-white dark:bg-[#1e2028] flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => router.push('/atendimento/cadastros/receituario/formulas')}
          className="px-5 py-2.5 text-sm font-semibold text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors"
        >
          Cancelar
        </button>
        <button
          type="button"
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
