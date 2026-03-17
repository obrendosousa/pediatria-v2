'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2, Pill, ChevronDown } from 'lucide-react';
import DataTable from '@/components/cadastros/DataTable';
import ModalForm from '@/components/cadastros/shared/ModalForm';
import { useToast } from '@/contexts/ToastContext';
import { useMedications } from '@/hooks/useMedications';
import type { Medication } from '@/types/cadastros';

// --- Constantes ---

const MEDICATION_TYPES = [
  'Genérico', 'Similar', 'Referência', 'Biológico', 'Específico', 'Fitoterápico', 'Outros',
] as const;

const LABEL_OPTIONS = [
  'Sem tarja', 'Tarja vermelha', 'Tarja preta', 'Tarja amarela',
] as const;

const THERAPEUTIC_CLASSES = [
  'Analgésico', 'Anestésico', 'Ansiolítico', 'Antialérgico', 'Antibiótico',
  'Anticoagulante', 'Anticonvulsivante', 'Antidepressivo', 'Antidiabético',
  'Antiemético', 'Antifúngico', 'Anti-hipertensivo', 'Anti-inflamatório',
  'Antipsicótico', 'Antitérmico', 'Antiviral', 'Broncodilatador',
  'Corticosteroide', 'Diurético', 'Hormônio', 'Imunossupressor',
  'Laxante', 'Miorrelaxante', 'Protetor gástrico', 'Sedativo',
  'Suplemento', 'Vasodilatador', 'Vitamina', 'Outros',
] as const;

// --- Helpers ---

const inputClass = 'w-full px-3 py-2.5 text-sm border border-slate-200 dark:border-[#3d3d48] rounded-xl bg-white dark:bg-[#1c1c21] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400';
const selectClass = `${inputClass} appearance-none cursor-pointer`;
const labelClass = 'text-xs font-bold text-slate-500 dark:text-[#a1a1aa] mb-1.5 ml-1 block uppercase tracking-wider';

function RequiredBadge() {
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 ml-1">
      Obrigatório
    </span>
  );
}

// --- Tipos ---

interface MedicationFormState {
  description: string;
  presentation: string;
  active_ingredient: string;
  barcode: string;
  type: string;
  label: string;
  therapeutic_class: string;
}

const EMPTY_FORM: MedicationFormState = {
  description: '',
  presentation: '',
  active_ingredient: '',
  barcode: '',
  type: '',
  label: '',
  therapeutic_class: '',
};

// --- Componente ---

export default function MedicamentosPage() {
  const { toast } = useToast();
  const {
    medications,
    totalCount,
    loading,
    saving,
    listMedications,
    createMedication,
    updateMedication,
    deleteMedication,
  } = useMedications();

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Medication | null>(null);
  const [form, setForm] = useState<MedicationFormState>({ ...EMPTY_FORM });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const fetch = useCallback(() => {
    listMedications(searchTerm, page, pageSize).catch(() => {
      toast.error('Erro ao buscar medicamentos.');
    });
  }, [listMedications, searchTerm, page, pageSize, toast]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const update = useCallback(<K extends keyof MedicationFormState>(key: K, value: MedicationFormState[K]) => {
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

  const openCreate = useCallback(() => {
    setEditingItem(null);
    setForm({ ...EMPTY_FORM });
    setErrors({});
    setModalOpen(true);
  }, []);

  const openEdit = useCallback((row: Medication) => {
    setEditingItem(row);
    setForm({
      description: row.description,
      presentation: row.presentation,
      active_ingredient: row.active_ingredient,
      barcode: row.barcode,
      type: row.type,
      label: row.label,
      therapeutic_class: row.therapeutic_class,
    });
    setErrors({});
    setModalOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    if (!saving) setModalOpen(false);
  }, [saving]);

  const validate = useCallback((): boolean => {
    const errs: Record<string, string> = {};
    if (!form.description.trim()) errs.description = 'Descrição é obrigatória.';
    if (!form.presentation.trim()) errs.presentation = 'Apresentação é obrigatória.';
    if (!form.active_ingredient.trim()) errs.active_ingredient = 'Princípio ativo é obrigatório.';
    if (!form.barcode.trim()) errs.barcode = 'Código de barras é obrigatório.';
    if (!form.type) errs.type = 'Tipo é obrigatório.';
    if (!form.label) errs.label = 'Tarja é obrigatória.';
    if (!form.therapeutic_class) errs.therapeutic_class = 'Classe terapêutica é obrigatória.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [form]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      toast.error('Preencha todos os campos obrigatórios.');
      return;
    }

    try {
      if (editingItem) {
        await updateMedication(editingItem.id, { ...form });
        toast.success('Medicamento atualizado.');
      } else {
        await createMedication({ ...form });
        toast.success('Medicamento cadastrado.');
      }
      setModalOpen(false);
      fetch();
    } catch {
      toast.error('Erro ao salvar medicamento.');
    }
  }, [validate, form, editingItem, createMedication, updateMedication, toast, fetch]);

  const handleDelete = useCallback(async (row: Medication) => {
    if (!confirm(`Deseja excluir "${row.description}"?`)) return;
    try {
      await deleteMedication(row.id);
      toast.success('Medicamento excluído.');
      fetch();
    } catch {
      toast.error('Erro ao excluir medicamento.');
    }
  }, [deleteMedication, toast, fetch]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-[#3d3d48] bg-white dark:bg-[#08080b]">
        <div className="flex items-center gap-2">
          <Pill className="w-5 h-5 text-blue-600" />
          <h1 className="text-lg font-bold text-slate-800 dark:text-[#fafafa]">Medicamentos</h1>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow-md transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          NOVO MEDICAMENTO
        </button>
      </div>

      {/* Table */}
      <DataTable<Medication & { status?: string }>
        columns={[
          { key: 'description', label: 'Nome', sortable: true },
          { key: 'presentation', label: 'Apresentação' },
        ]}
        data={medications as (Medication & { status?: string })[]}
        loading={loading}
        searchPlaceholder="Buscar por nome, apresentação ou princípio ativo..."
        onSearch={(term) => { setSearchTerm(term); setPage(0); }}
        pagination={{ page, pageSize, total: totalCount }}
        onPageChange={(p, size) => { setPage(p); setPageSize(size); }}
        actions={[
          { icon: 'edit', label: 'Editar', onClick: (row) => openEdit(row as Medication) },
        ]}
        menuActions={(row) => [
          {
            icon: <Trash2 className="w-4 h-4" />,
            label: 'Excluir',
            onClick: () => handleDelete(row as Medication),
            className: 'text-red-500 dark:text-red-400',
          },
        ]}
        emptyMessage="Nenhum medicamento cadastrado."
      />

      {/* Modal */}
      <ModalForm
        isOpen={modalOpen}
        onClose={handleClose}
        title={editingItem ? 'Editar Medicamento' : 'Novo Medicamento'}
        onSubmit={handleSubmit}
        loading={saving}
        maxWidth="max-w-2xl"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Descrição */}
          <div className="sm:col-span-2">
            <label className={labelClass}>Descrição <RequiredBadge /></label>
            <input
              type="text"
              value={form.description}
              onChange={e => update('description', e.target.value)}
              placeholder="Nome do medicamento"
              autoFocus
              className={`${inputClass} ${errors.description ? 'border-red-300 dark:border-red-700' : ''}`}
            />
            {errors.description && <p className="mt-1 text-xs text-red-500">{errors.description}</p>}
          </div>

          {/* Apresentação */}
          <div className="sm:col-span-2">
            <label className={labelClass}>Apresentação <RequiredBadge /></label>
            <input
              type="text"
              value={form.presentation}
              onChange={e => update('presentation', e.target.value)}
              placeholder="Ex: Comprimido 500mg"
              className={`${inputClass} ${errors.presentation ? 'border-red-300 dark:border-red-700' : ''}`}
            />
            {errors.presentation && <p className="mt-1 text-xs text-red-500">{errors.presentation}</p>}
          </div>

          {/* Princípio ativo */}
          <div>
            <label className={labelClass}>Princípio ativo <RequiredBadge /></label>
            <input
              type="text"
              value={form.active_ingredient}
              onChange={e => update('active_ingredient', e.target.value)}
              placeholder="Princípio ativo"
              className={`${inputClass} ${errors.active_ingredient ? 'border-red-300 dark:border-red-700' : ''}`}
            />
            {errors.active_ingredient && <p className="mt-1 text-xs text-red-500">{errors.active_ingredient}</p>}
          </div>

          {/* Código de barras */}
          <div>
            <label className={labelClass}>Código de barras <RequiredBadge /></label>
            <input
              type="text"
              value={form.barcode}
              onChange={e => update('barcode', e.target.value)}
              placeholder="Código de barras"
              className={`${inputClass} ${errors.barcode ? 'border-red-300 dark:border-red-700' : ''}`}
            />
            {errors.barcode && <p className="mt-1 text-xs text-red-500">{errors.barcode}</p>}
          </div>

          {/* Tipo */}
          <div>
            <label className={labelClass}>Tipo <RequiredBadge /></label>
            <div className="relative">
              <select
                value={form.type}
                onChange={e => update('type', e.target.value)}
                className={`${selectClass} ${errors.type ? 'border-red-300 dark:border-red-700' : ''}`}
              >
                <option value="">Selecione</option>
                {MEDICATION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
            {errors.type && <p className="mt-1 text-xs text-red-500">{errors.type}</p>}
          </div>

          {/* Tarja */}
          <div>
            <label className={labelClass}>Tarja <RequiredBadge /></label>
            <div className="relative">
              <select
                value={form.label}
                onChange={e => update('label', e.target.value)}
                className={`${selectClass} ${errors.label ? 'border-red-300 dark:border-red-700' : ''}`}
              >
                <option value="">Selecione</option>
                {LABEL_OPTIONS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
            {errors.label && <p className="mt-1 text-xs text-red-500">{errors.label}</p>}
          </div>

          {/* Classe terapêutica */}
          <div className="sm:col-span-2">
            <label className={labelClass}>Classe terapêutica <RequiredBadge /></label>
            <div className="relative">
              <select
                value={form.therapeutic_class}
                onChange={e => update('therapeutic_class', e.target.value)}
                className={`${selectClass} ${errors.therapeutic_class ? 'border-red-300 dark:border-red-700' : ''}`}
              >
                <option value="">Selecione</option>
                {THERAPEUTIC_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
            {errors.therapeutic_class && <p className="mt-1 text-xs text-red-500">{errors.therapeutic_class}</p>}
          </div>
        </div>
      </ModalForm>
    </div>
  );
}
