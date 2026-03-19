'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Plus, Trash2, Pencil, Loader2, X, ChevronDown,
  Stethoscope, DollarSign, Clock, Percent, ToggleLeft, ToggleRight,
} from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { useProfessionalProcedures } from '@/hooks/useProfessionalProcedures';
import type { ProfessionalProcedure, ProcedureType, SplitType } from '@/types/cadastros';

// --- Constantes ---

const TYPE_LABELS: Record<string, string> = {
  consultation: 'Consultas',
  exam: 'Exames',
  injectable: 'Injetáveis',
  other: 'Outros',
};

const TYPE_OPTIONS: { value: ProcedureType; label: string }[] = [
  { value: 'consultation', label: 'Consultas' },
  { value: 'exam', label: 'Exames' },
  { value: 'injectable', label: 'Injetáveis' },
  { value: 'other', label: 'Outros' },
];

const TYPE_COLORS: Record<string, string> = {
  consultation: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  exam: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  injectable: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  other: 'bg-slate-100 text-slate-600 dark:bg-slate-700/40 dark:text-slate-300',
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function calcSplit(value: number, splitType: SplitType, splitValue: number) {
  const profissionalRecebe = splitType === 'percentage'
    ? Math.round(value * splitValue / 100 * 100) / 100
    : splitValue;
  const clinicaRetem = Math.round((value - profissionalRecebe) * 100) / 100;
  return { profissionalRecebe, clinicaRetem };
}

// --- Estilos ---

const inputClass = 'w-full px-3 py-2.5 text-sm border border-slate-200 dark:border-[#3d3d48] rounded-xl bg-white dark:bg-[#1c1c21] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50';
const selectClass = `${inputClass} appearance-none cursor-pointer`;
const labelClass = 'text-xs font-bold text-slate-500 dark:text-[#a1a1aa] mb-1.5 ml-1 block uppercase tracking-wider';

// --- Formulário padrão ---

interface ProcedureFormState {
  name: string;
  procedure_type: ProcedureType;
  custom_type: string;
  duration_minutes: number;
  value: number;
  split_type: SplitType;
  split_value: number;
}

const EMPTY_FORM: ProcedureFormState = {
  name: '',
  procedure_type: 'consultation',
  custom_type: '',
  duration_minutes: 30,
  value: 0,
  split_type: 'percentage',
  split_value: 0,
};

// --- Componente principal ---

interface Props {
  professionalId: string;
}

export default function ProfessionalProceduresTab({ professionalId }: Props) {
  const { toast } = useToast();
  const {
    procedures,
    loading,
    saving,
    listProcedures,
    createProcedure,
    updateProcedure,
    deleteProcedure,
  } = useProfessionalProcedures();

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProcedureFormState>({ ...EMPTY_FORM });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const fetchData = useCallback(() => {
    listProcedures(professionalId).catch(() => {
      toast.error('Erro ao buscar procedimentos.');
    });
  }, [professionalId, listProcedures, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- Modal ---

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setErrors({});
    setShowModal(true);
  };

  const openEdit = (proc: ProfessionalProcedure) => {
    setEditingId(proc.id);
    setForm({
      name: proc.name,
      procedure_type: proc.procedure_type,
      custom_type: proc.custom_type || '',
      duration_minutes: proc.duration_minutes,
      value: proc.value,
      split_type: proc.split_type,
      split_value: proc.split_value,
    });
    setErrors({});
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Nome é obrigatório.';
    if (form.duration_minutes <= 0) errs.duration_minutes = 'Duração deve ser maior que 0.';
    if (form.value < 0) errs.value = 'Valor não pode ser negativo.';
    if (form.split_type === 'percentage' && (form.split_value < 0 || form.split_value > 100)) {
      errs.split_value = 'Porcentagem deve ser entre 0 e 100.';
    }
    if (form.split_type === 'fixed' && form.split_value < 0) {
      errs.split_value = 'Valor não pode ser negativo.';
    }
    if (form.split_type === 'fixed' && form.split_value > form.value) {
      errs.split_value = 'Repasse não pode ser maior que o valor cobrado.';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    const payload = {
      ...form,
      custom_type: form.procedure_type === 'other' ? (form.custom_type.trim() || null) : null,
      professional_id: professionalId,
      status: 'active' as const,
    };

    try {
      if (editingId) {
        await updateProcedure(editingId, payload);
        toast.success('Procedimento atualizado.');
      } else {
        await createProcedure(payload);
        toast.success('Procedimento cadastrado.');
      }
      closeModal();
      fetchData();
    } catch {
      toast.error('Erro ao salvar procedimento.');
    }
  };

  const handleToggleStatus = async (proc: ProfessionalProcedure) => {
    try {
      await updateProcedure(proc.id, {
        ...proc,
        status: proc.status === 'active' ? 'inactive' : 'active',
      });
      toast.success(`Procedimento ${proc.status === 'active' ? 'inativado' : 'ativado'}.`);
      fetchData();
    } catch {
      toast.error('Erro ao alterar status.');
    }
  };

  const handleDelete = async (proc: ProfessionalProcedure) => {
    if (!confirm(`Deseja excluir "${proc.name}"?`)) return;
    try {
      await deleteProcedure(proc.id);
      toast.success('Procedimento excluído.');
      fetchData();
    } catch {
      toast.error('Erro ao excluir procedimento.');
    }
  };

  // --- Cálculos do preview ---
  const preview = calcSplit(form.value, form.split_type, form.split_value);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-[#252530] bg-white dark:bg-[#111118]">
        <div className="flex items-center gap-2">
          <Stethoscope className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-bold text-slate-800 dark:text-[#fafafa]">Procedimentos do Profissional</h2>
          <span className="text-xs text-slate-400 dark:text-[#71717a] ml-2">
            {procedures.length} cadastrado{procedures.length !== 1 ? 's' : ''}
          </span>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow-md transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          NOVO PROCEDIMENTO
        </button>
      </div>

      {/* Tabela */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
        ) : procedures.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-[#71717a]">
            <Stethoscope className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">Nenhum procedimento cadastrado para este profissional.</p>
            <button
              onClick={openCreate}
              className="mt-4 text-sm text-blue-600 hover:text-blue-700 font-semibold"
            >
              Cadastrar primeiro procedimento
            </button>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 dark:border-[#252530] bg-slate-50 dark:bg-[#0e0e14]">
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-[#a1a1aa] uppercase tracking-wider">Nome</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 dark:text-[#a1a1aa] uppercase tracking-wider">Tipo</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-slate-500 dark:text-[#a1a1aa] uppercase tracking-wider">Duração</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 dark:text-[#a1a1aa] uppercase tracking-wider">Valor</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 dark:text-[#a1a1aa] uppercase tracking-wider">Repasse</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 dark:text-[#a1a1aa] uppercase tracking-wider">Clínica</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-slate-500 dark:text-[#a1a1aa] uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-slate-500 dark:text-[#a1a1aa] uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody>
              {procedures.map(proc => {
                const split = calcSplit(proc.value, proc.split_type, proc.split_value);
                return (
                  <tr
                    key={proc.id}
                    className="border-b border-slate-100 dark:border-[#1e1e28] hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-6 py-3">
                      <span className="text-sm font-medium text-slate-800 dark:text-[#fafafa]">{proc.name}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2.5 py-1 rounded-lg text-[11px] font-bold ${TYPE_COLORS[proc.procedure_type] || TYPE_COLORS.other}`}>
                        {proc.procedure_type === 'other' && proc.custom_type ? proc.custom_type : (TYPE_LABELS[proc.procedure_type] || proc.procedure_type)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm text-slate-600 dark:text-[#d4d4d8] flex items-center justify-center gap-1">
                        <Clock className="w-3.5 h-3.5 opacity-50" />
                        {proc.duration_minutes} min
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-mono text-sm text-slate-800 dark:text-[#fafafa]">{formatCurrency(proc.value)}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="text-right">
                        <span className="font-mono text-sm text-emerald-600 dark:text-emerald-400">{formatCurrency(split.profissionalRecebe)}</span>
                        <span className="block text-[10px] text-slate-400 dark:text-[#71717a]">
                          {proc.split_type === 'percentage' ? `${proc.split_value}%` : 'fixo'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-mono text-sm text-slate-600 dark:text-[#d4d4d8]">{formatCurrency(split.clinicaRetem)}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase ${
                        proc.status === 'active'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                          : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        {proc.status === 'active' ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openEdit(proc)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(proc)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                          title={proc.status === 'active' ? 'Inativar' : 'Ativar'}
                        >
                          {proc.status === 'active'
                            ? <ToggleLeft className="w-4 h-4" />
                            : <ToggleRight className="w-4 h-4" />
                          }
                        </button>
                        <button
                          onClick={() => handleDelete(proc)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal: Criar / Editar Procedimento */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#111118] rounded-xl border border-slate-200 dark:border-[#252530] shadow-2xl w-full max-w-lg mx-4 animate-in fade-in-0 zoom-in-95">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-[#252530]">
              <h3 className="text-base font-bold text-slate-800 dark:text-[#fafafa] flex items-center gap-2">
                <Stethoscope className="w-5 h-5 text-blue-500" />
                {editingId ? 'Editar Procedimento' : 'Novo Procedimento'}
              </h3>
              <button
                onClick={closeModal}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Nome */}
              <div>
                <label className={labelClass}>Nome do procedimento</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => { setForm(prev => ({ ...prev, name: e.target.value })); setErrors(prev => { const n = { ...prev }; delete n.name; return n; }); }}
                  placeholder="Ex: Consulta, Ultrassom, Vacina..."
                  autoFocus
                  className={`${inputClass} ${errors.name ? 'border-red-300 dark:border-red-700' : ''}`}
                />
                {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
              </div>

              {/* Tipo + Duração */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Tipo</label>
                  <div className="relative">
                    <select
                      value={form.procedure_type}
                      onChange={e => setForm(prev => ({ ...prev, procedure_type: e.target.value as ProcedureType, custom_type: '' }))}
                      className={selectClass}
                    >
                      {TYPE_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Duração (minutos)</label>
                  <input
                    type="number"
                    min={1}
                    value={form.duration_minutes}
                    onChange={e => { setForm(prev => ({ ...prev, duration_minutes: parseInt(e.target.value) || 0 })); setErrors(prev => { const n = { ...prev }; delete n.duration_minutes; return n; }); }}
                    className={`${inputClass} ${errors.duration_minutes ? 'border-red-300 dark:border-red-700' : ''}`}
                  />
                  {errors.duration_minutes && <p className="mt-1 text-xs text-red-500">{errors.duration_minutes}</p>}
                </div>
              </div>

              {/* Tipo personalizado (quando "Outros" selecionado) */}
              {form.procedure_type === 'other' && (
                <div>
                  <label className={labelClass}>Especifique o tipo</label>
                  <input
                    type="text"
                    value={form.custom_type}
                    onChange={e => setForm(prev => ({ ...prev, custom_type: e.target.value }))}
                    placeholder="Ex: Laser, Peeling, Drenagem..."
                    className={inputClass}
                  />
                </div>
              )}

              {/* Valor cobrado */}
              <div>
                <label className={labelClass}>Valor cobrado do paciente (R$)</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.value || ''}
                  onChange={e => { setForm(prev => ({ ...prev, value: parseFloat(e.target.value) || 0 })); setErrors(prev => { const n = { ...prev }; delete n.value; return n; }); }}
                  placeholder="0,00"
                  className={`${inputClass} ${errors.value ? 'border-red-300 dark:border-red-700' : ''}`}
                />
                {errors.value && <p className="mt-1 text-xs text-red-500">{errors.value}</p>}
              </div>

              {/* Tipo de divisão */}
              <div>
                <label className={labelClass}>Tipo de repasse</label>
                <div className="flex gap-3 mt-1">
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, split_type: 'percentage', split_value: 0 }))}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
                      form.split_type === 'percentage'
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700'
                        : 'bg-white dark:bg-[#1a1a22] text-slate-500 dark:text-[#a1a1aa] border-slate-200 dark:border-[#3d3d48] hover:border-blue-300'
                    }`}
                  >
                    <Percent className="w-4 h-4" />
                    Porcentagem
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, split_type: 'fixed', split_value: 0 }))}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
                      form.split_type === 'fixed'
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700'
                        : 'bg-white dark:bg-[#1a1a22] text-slate-500 dark:text-[#a1a1aa] border-slate-200 dark:border-[#3d3d48] hover:border-blue-300'
                    }`}
                  >
                    <DollarSign className="w-4 h-4" />
                    Valor Fixo
                  </button>
                </div>
              </div>

              {/* Valor da divisão */}
              <div>
                <label className={labelClass}>
                  {form.split_type === 'percentage' ? 'Porcentagem do profissional (%)' : 'Valor fixo do profissional (R$)'}
                </label>
                <input
                  type="number"
                  min={0}
                  max={form.split_type === 'percentage' ? 100 : undefined}
                  step={form.split_type === 'percentage' ? '1' : '0.01'}
                  value={form.split_value || ''}
                  onChange={e => { setForm(prev => ({ ...prev, split_value: parseFloat(e.target.value) || 0 })); setErrors(prev => { const n = { ...prev }; delete n.split_value; return n; }); }}
                  placeholder={form.split_type === 'percentage' ? 'Ex: 50' : 'Ex: 200,00'}
                  className={`${inputClass} ${errors.split_value ? 'border-red-300 dark:border-red-700' : ''}`}
                />
                {errors.split_value && <p className="mt-1 text-xs text-red-500">{errors.split_value}</p>}
              </div>

              {/* Preview da divisão */}
              {form.value > 0 && (
                <div className="bg-slate-50 dark:bg-[#0e0e14] rounded-xl border border-slate-200 dark:border-[#252530] p-4">
                  <p className="text-xs font-bold text-slate-500 dark:text-[#a1a1aa] uppercase tracking-wider mb-3">Resumo da divisão</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center">
                      <p className="text-[10px] text-slate-400 dark:text-[#71717a] uppercase mb-1">Paciente paga</p>
                      <p className="text-sm font-bold text-slate-800 dark:text-[#fafafa]">{formatCurrency(form.value)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-slate-400 dark:text-[#71717a] uppercase mb-1">Profissional</p>
                      <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(preview.profissionalRecebe)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-slate-400 dark:text-[#71717a] uppercase mb-1">Clínica</p>
                      <p className="text-sm font-bold text-blue-600 dark:text-blue-400">{formatCurrency(preview.clinicaRetem)}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-200 dark:border-[#252530] flex items-center justify-end gap-3">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-[#d4d4d8] hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {editingId ? 'SALVAR' : 'CADASTRAR'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
