'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  ArrowLeft, Search, X, Plus, Trash2, Save, Loader2,
  Receipt, Stethoscope, ChevronDown, Percent, DollarSign,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createSchemaClient } from '@/lib/supabase/schemaClient';
import { useToast } from '@/contexts/ToastContext';
import { useBudgets } from '@/hooks/atendimento/useBudgets';
import type { BudgetItem, BudgetStatus, DiscountType } from '@/types/budget';

const supabase = createSchemaClient('atendimento');

type PatientOption = { id: number; full_name: string; phone?: string | null };
type DoctorOption = { id: number; name: string };

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export default function CriarOrcamentoPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { createBudget, isSaving } = useBudgets();

  // ── Paciente (select com busca) ──────────────────────────
  const [patientSearch, setPatientSearch] = useState('');
  const [patientResults, setPatientResults] = useState<PatientOption[]>([]);
  const [patientLoading, setPatientLoading] = useState(false);
  const [patientDropdownOpen, setPatientDropdownOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<PatientOption | null>(null);
  const patientRef = useRef<HTMLDivElement>(null);

  // ── Profissional (select simples) ─────────────────────────
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<number | null>(null);

  // ── Itens do orçamento ────────────────────────────────────
  const [items, setItems] = useState<BudgetItem[]>([]);
  const [newProcName, setNewProcName] = useState('');
  const [newSessions, setNewSessions] = useState(1);
  const [newUnitPrice, setNewUnitPrice] = useState(0);

  // ── Totalizador ───────────────────────────────────────────
  const [discountType, setDiscountType] = useState<DiscountType>('%');
  const [discountValue, setDiscountValue] = useState(0);
  const [installments, setInstallments] = useState(1);
  const [notes, setNotes] = useState('');

  // ── Cálculos automáticos ──────────────────────────────────
  const subtotal = useMemo(() => items.reduce((acc, i) => acc + i.subtotal, 0), [items]);

  const discountAmount = useMemo(() => {
    if (discountType === '%') return subtotal * (discountValue / 100);
    return Math.min(discountValue, subtotal);
  }, [subtotal, discountType, discountValue]);

  const total = useMemo(() => Math.max(0, subtotal - discountAmount), [subtotal, discountAmount]);

  const installmentValue = useMemo(
    () => installments > 0 ? total / installments : total,
    [total, installments]
  );

  // ── Carregar profissionais ────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('doctors')
        .select('id, name')
        .eq('active', true)
        .order('name');
      if (data) setDoctors(data);
    })();
  }, []);

  // ── Busca de pacientes (debounce 300ms) ───────────────────
  useEffect(() => {
    const trimmed = patientSearch.trim();
    if (!trimmed || trimmed.length < 2) {
      const t = setTimeout(() => { setPatientResults([]); setPatientLoading(false); }, 0);
      return () => clearTimeout(t);
    }
    const t = setTimeout(async () => {
      setPatientLoading(true);
      const { data } = await supabase
        .from('patients')
        .select('id, full_name, phone')
        .or(`full_name.ilike.%${trimmed}%,phone.ilike.%${trimmed}%`)
        .order('full_name')
        .limit(15);
      setPatientResults(data || []);
      setPatientLoading(false);
      setPatientDropdownOpen(true);
    }, 300);
    return () => clearTimeout(t);
  }, [patientSearch]);

  // Click outside
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (patientRef.current && !patientRef.current.contains(e.target as Node)) setPatientDropdownOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelectPatient = useCallback((p: PatientOption) => {
    setSelectedPatient(p);
    setPatientSearch('');
    setPatientDropdownOpen(false);
  }, []);

  const handleClearPatient = useCallback(() => {
    setSelectedPatient(null);
    setPatientSearch('');
  }, []);

  // ── Itens ─────────────────────────────────────────────────
  const addItem = () => {
    if (!newProcName.trim()) { toast.error('Informe o procedimento.'); return; }
    if (newUnitPrice <= 0) { toast.error('Informe o valor unitário.'); return; }
    const item: BudgetItem = {
      procedure_name: newProcName.trim(),
      sessions: newSessions,
      unit_price: newUnitPrice,
      subtotal: newSessions * newUnitPrice,
    };
    setItems(prev => [...prev, item]);
    setNewProcName('');
    setNewSessions(1);
    setNewUnitPrice(0);
  };

  const removeItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  // ── Submit ────────────────────────────────────────────────
  const handleSubmit = async (status: BudgetStatus) => {
    if (!selectedPatient) { toast.error('Selecione um paciente.'); return; }
    if (!selectedDoctorId) { toast.error('Selecione um profissional.'); return; }
    if (items.length === 0) { toast.error('Adicione ao menos um item.'); return; }

    try {
      await createBudget(
        {
          patient_id: selectedPatient.id,
          doctor_id: selectedDoctorId,
          subtotal,
          discount_type: discountType,
          discount_value: discountValue,
          discount_amount: discountAmount,
          total,
          installments,
          notes: notes || undefined,
          status,
        },
        items
      );
      toast.success(status === 'orcado' ? 'Orçamento liberado!' : 'Orçamento salvo!');
      router.push('/atendimento/orcamentos');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      toast.error('Erro ao salvar: ' + msg);
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-[#15171e]">
      {/* Header */}
      <div className="px-6 py-4 flex items-center gap-4 border-b border-slate-200 dark:border-[#252530] bg-white dark:bg-[#111118]">
        <button
          onClick={() => router.push('/atendimento/orcamentos')}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-500" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-slate-800 dark:text-[#fafafa] flex items-center gap-2">
            <Receipt className="w-5 h-5 text-blue-600" />
            Novo Orçamento
          </h1>
          <p className="text-xs text-slate-400 dark:text-[#71717a]">Preencha os dados do orçamento</p>
        </div>
      </div>

      {/* Conteúdo scrollável */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* ─── Seção: Informações ─── */}
          <section className="bg-white dark:bg-[#111118] rounded-xl border border-slate-200 dark:border-[#252530] p-6 space-y-5">
            <h2 className="text-sm font-bold text-slate-700 dark:text-[#d4d4d8] uppercase tracking-wide flex items-center gap-2">
              <Stethoscope className="w-4 h-4 text-blue-600" />
              Informações do Orçamento
            </h2>

            <div className="grid grid-cols-12 gap-5">
              {/* Paciente */}
              <div className="col-span-12 md:col-span-7" ref={patientRef}>
                <label className="text-xs font-bold text-slate-500 dark:text-[#a1a1aa] mb-1.5 ml-1 block uppercase tracking-wider">
                  Paciente <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 ml-1">Obrigatório</span>
                </label>
                {selectedPatient ? (
                  <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-xl">
                    <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-sm font-bold text-blue-700 dark:text-blue-300">
                      {selectedPatient.full_name.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-700 dark:text-gray-200">{selectedPatient.full_name}</p>
                      {selectedPatient.phone && <p className="text-xs text-slate-500">{selectedPatient.phone}</p>}
                    </div>
                    <button onClick={handleClearPatient} className="p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30">
                      <X className="w-4 h-4 text-slate-400" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={patientSearch}
                      onChange={e => setPatientSearch(e.target.value)}
                      placeholder="Buscar paciente por nome ou telefone..."
                      className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 dark:border-[#252530] rounded-xl bg-white dark:bg-[#1a1a22] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                    {patientLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-600 animate-spin" />}

                    {patientDropdownOpen && patientResults.length > 0 && (
                      <div className="absolute z-50 mt-1 w-full max-h-56 overflow-y-auto bg-white dark:bg-[#1a1a22] border border-slate-200 dark:border-[#252530] rounded-xl shadow-xl">
                        {patientResults.map(p => (
                          <button
                            key={p.id}
                            onClick={() => handleSelectPatient(p)}
                            className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors text-left"
                          >
                            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-xs font-bold text-blue-700 dark:text-blue-300">
                              {p.full_name.charAt(0)}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-700 dark:text-gray-200">{p.full_name}</p>
                              {p.phone && <p className="text-xs text-slate-400">{p.phone}</p>}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Profissional */}
              <div className="col-span-12 md:col-span-5">
                <label className="text-xs font-bold text-slate-500 dark:text-[#a1a1aa] mb-1.5 ml-1 block uppercase tracking-wider">
                  Profissional <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 ml-1">Obrigatório</span>
                </label>
                <div className="relative">
                  <Stethoscope className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <select
                    value={selectedDoctorId ?? ''}
                    onChange={e => setSelectedDoctorId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full pl-10 pr-8 py-2.5 text-sm border border-slate-200 dark:border-[#252530] rounded-xl bg-white dark:bg-[#1a1a22] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 appearance-none cursor-pointer"
                  >
                    <option value="">Selecione o profissional...</option>
                    {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>
          </section>

          {/* ─── Seção: Itens do Orçamento ─── */}
          <section className="bg-white dark:bg-[#111118] rounded-xl border border-slate-200 dark:border-[#252530] p-6 space-y-5">
            <h2 className="text-sm font-bold text-slate-700 dark:text-[#d4d4d8] uppercase tracking-wide flex items-center gap-2">
              <Receipt className="w-4 h-4 text-blue-600" />
              Itens do Orçamento
            </h2>

            {/* Adicionar item */}
            <div className="grid grid-cols-12 gap-3 items-end">
              <div className="col-span-12 md:col-span-5">
                <label className="text-xs font-bold text-slate-500 dark:text-[#a1a1aa] mb-1 ml-1 block uppercase tracking-wider">Procedimento</label>
                <input
                  type="text"
                  value={newProcName}
                  onChange={e => setNewProcName(e.target.value)}
                  placeholder="Nome do procedimento"
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 dark:border-[#252530] rounded-xl bg-white dark:bg-[#1a1a22] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div className="col-span-4 md:col-span-2">
                <label className="text-xs font-bold text-slate-500 dark:text-[#a1a1aa] mb-1 ml-1 block uppercase tracking-wider">Sessões</label>
                <input
                  type="number"
                  min={1}
                  value={newSessions}
                  onChange={e => setNewSessions(Math.max(1, Number(e.target.value)))}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 dark:border-[#252530] rounded-xl bg-white dark:bg-[#1a1a22] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 text-center"
                />
              </div>
              <div className="col-span-4 md:col-span-3">
                <label className="text-xs font-bold text-slate-500 dark:text-[#a1a1aa] mb-1 ml-1 block uppercase tracking-wider">Valor unit. (R$)</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={newUnitPrice || ''}
                  onChange={e => setNewUnitPrice(Number(e.target.value))}
                  placeholder="0,00"
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 dark:border-[#252530] rounded-xl bg-white dark:bg-[#1a1a22] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 text-right"
                />
              </div>
              <div className="col-span-4 md:col-span-2">
                <button
                  onClick={addItem}
                  className="w-full flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2.5 rounded-xl text-xs font-bold shadow-md transition-all active:scale-95"
                >
                  <Plus className="w-4 h-4" /> ADICIONAR
                </button>
              </div>
            </div>

            {/* Tabela de itens */}
            {items.length > 0 ? (
              <div className="bg-slate-50 dark:bg-[#15171e] rounded-xl border border-slate-200 dark:border-[#252530] overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-[#1a1a22] border-b border-slate-200 dark:border-[#252530]">
                      <th className="px-4 py-2.5 text-xs font-extrabold text-slate-500 dark:text-[#a1a1aa] uppercase">Procedimento</th>
                      <th className="px-4 py-2.5 text-xs font-extrabold text-slate-500 dark:text-[#a1a1aa] uppercase text-center">Sessões</th>
                      <th className="px-4 py-2.5 text-xs font-extrabold text-slate-500 dark:text-[#a1a1aa] uppercase text-right">Valor unit.</th>
                      <th className="px-4 py-2.5 text-xs font-extrabold text-slate-500 dark:text-[#a1a1aa] uppercase text-right">Subtotal</th>
                      <th className="px-4 py-2.5 text-xs font-extrabold text-slate-500 dark:text-[#a1a1aa] uppercase text-center w-16">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-gray-800">
                    {items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-white dark:hover:bg-[#1e2028] transition-colors">
                        <td className="px-4 py-3 text-slate-700 dark:text-gray-200">{item.procedure_name}</td>
                        <td className="px-4 py-3 text-center text-slate-600 dark:text-[#d4d4d8]">{item.sessions}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-slate-600 dark:text-[#d4d4d8]">{formatCurrency(item.unit_price)}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs font-bold text-slate-700 dark:text-gray-200">{formatCurrency(item.subtotal)}</td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => removeItem(idx)}
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
              <div className="text-center py-8 bg-slate-50 dark:bg-[#15171e] rounded-xl border border-dashed border-slate-200 dark:border-[#252530]">
                <Receipt className="w-10 h-10 text-slate-300 dark:text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-slate-400 dark:text-[#71717a]">Nenhum item adicionado.</p>
              </div>
            )}
          </section>

          {/* ─── Seção: Totalizador ─── */}
          <section className="bg-white dark:bg-[#111118] rounded-xl border border-slate-200 dark:border-[#252530] p-6 space-y-5">
            <h2 className="text-sm font-bold text-slate-700 dark:text-[#d4d4d8] uppercase tracking-wide flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-blue-600" />
              Totalizador
            </h2>

            <div className="grid grid-cols-12 gap-5">
              {/* Subtotal */}
              <div className="col-span-6 md:col-span-3">
                <label className="text-xs font-bold text-slate-500 dark:text-[#a1a1aa] mb-1 ml-1 block uppercase tracking-wider">Subtotal</label>
                <div className="px-3 py-2.5 text-sm font-bold text-slate-700 dark:text-gray-200 bg-slate-100 dark:bg-[#15171e] border border-slate-200 dark:border-[#252530] rounded-xl text-right font-mono">
                  {formatCurrency(subtotal)}
                </div>
              </div>

              {/* Desconto tipo + valor */}
              <div className="col-span-6 md:col-span-4">
                <label className="text-xs font-bold text-slate-500 dark:text-[#a1a1aa] mb-1 ml-1 block uppercase tracking-wider">Desconto</label>
                <div className="flex gap-0 border border-slate-200 dark:border-[#252530] rounded-xl overflow-hidden">
                  <div className="flex bg-slate-100 dark:bg-[#15171e]">
                    <button
                      onClick={() => setDiscountType('%')}
                      className={`px-3 py-2.5 text-sm font-bold transition-colors ${discountType === '%' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      <Percent className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDiscountType('R$')}
                      className={`px-3 py-2.5 text-sm font-bold transition-colors ${discountType === 'R$' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      R$
                    </button>
                  </div>
                  <input
                    type="number"
                    min={0}
                    step={discountType === '%' ? 1 : 0.01}
                    max={discountType === '%' ? 100 : subtotal}
                    value={discountValue || ''}
                    onChange={e => setDiscountValue(Number(e.target.value))}
                    placeholder="0"
                    className="flex-1 px-3 py-2.5 text-sm bg-white dark:bg-[#1a1a22] text-slate-700 dark:text-gray-200 focus:outline-none text-right"
                  />
                </div>
              </div>

              {/* Parcelas */}
              <div className="col-span-6 md:col-span-2">
                <label className="text-xs font-bold text-slate-500 dark:text-[#a1a1aa] mb-1 ml-1 block uppercase tracking-wider">Parcelas</label>
                <input
                  type="number"
                  min={1}
                  value={installments}
                  onChange={e => setInstallments(Math.max(1, Number(e.target.value)))}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 dark:border-[#252530] rounded-xl bg-white dark:bg-[#1a1a22] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 text-center"
                />
              </div>

              {/* Total */}
              <div className="col-span-6 md:col-span-3">
                <label className="text-xs font-bold text-slate-500 dark:text-[#a1a1aa] mb-1 ml-1 block uppercase tracking-wider">Valor Total</label>
                <div className="px-3 py-2.5 text-sm font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-xl text-right font-mono">
                  {formatCurrency(total)}
                </div>
              </div>

              {/* Valor desconto e parcela (info) */}
              {discountAmount > 0 && (
                <div className="col-span-6 md:col-span-3">
                  <p className="text-xs text-slate-400">Desconto: <span className="font-bold text-red-500">-{formatCurrency(discountAmount)}</span></p>
                </div>
              )}
              {installments > 1 && (
                <div className="col-span-6 md:col-span-3">
                  <p className="text-xs text-slate-400">Valor por parcela: <span className="font-bold text-slate-600 dark:text-[#d4d4d8]">{formatCurrency(installmentValue)}</span></p>
                </div>
              )}
            </div>
          </section>

          {/* ─── Seção: Observações ─── */}
          <section className="bg-white dark:bg-[#111118] rounded-xl border border-slate-200 dark:border-[#252530] p-6">
            <label className="text-xs font-bold text-slate-500 dark:text-[#a1a1aa] mb-1.5 ml-1 block uppercase tracking-wider">
              Observações
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Observações adicionais sobre o orçamento..."
              className="w-full px-3 py-2.5 text-sm border border-slate-200 dark:border-[#252530] rounded-xl bg-white dark:bg-[#1a1a22] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
            />
          </section>
        </div>
      </div>

      {/* Footer fixo */}
      <div className="px-6 py-4 border-t border-slate-200 dark:border-[#252530] bg-white dark:bg-[#111118] flex items-center justify-end gap-3">
        <button
          onClick={() => router.push('/atendimento/orcamentos')}
          className="px-5 py-2.5 text-sm font-semibold text-slate-600 dark:text-[#d4d4d8] hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={() => handleSubmit('pendente')}
          disabled={isSaving}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-xl transition-colors disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          SALVAR E SAIR
        </button>
        <button
          onClick={() => handleSubmit('orcado')}
          disabled={isSaving}
          className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Receipt className="w-4 h-4" />}
          LIBERAR ORÇAMENTO
        </button>
      </div>
    </div>
  );
}
