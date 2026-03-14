'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Plus, Trash2, FlaskConical } from 'lucide-react';
import DataTable from '@/components/cadastros/DataTable';
import ModalForm from '@/components/cadastros/shared/ModalForm';
import { useToast } from '@/contexts/ToastContext';
import { useSubstances } from '@/hooks/useSubstances';
import type { Substance } from '@/types/cadastros';

const inputClass = 'w-full px-3 py-2.5 text-sm border border-slate-200 dark:border-gray-700 rounded-xl bg-white dark:bg-[#2a2d36] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-400';

export default function SubstanciasPage() {
  const { toast } = useToast();
  const {
    substances,
    totalCount,
    loading,
    saving,
    listSubstances,
    createSubstance,
    updateSubstance,
    deleteSubstance,
  } = useSubstances();

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [searchTerm, setSearchTerm] = useState('');
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Substance | null>(null);
  const [formName, setFormName] = useState('');
  const [formError, setFormError] = useState('');

  const fetch = useCallback(() => {
    listSubstances(searchTerm, page, pageSize).catch(() => {
      toast.error('Erro ao buscar substâncias.');
    });
  }, [listSubstances, searchTerm, page, pageSize, toast]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  // Debounced search para 5000+ itens
  const handleSearch = useCallback((term: string) => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setSearchTerm(term);
      setPage(0);
    }, 300);
  }, []);

  const openCreate = useCallback(() => {
    setEditingItem(null);
    setFormName('');
    setFormError('');
    setModalOpen(true);
  }, []);

  const openEdit = useCallback((row: Substance) => {
    setEditingItem(row);
    setFormName(row.name);
    setFormError('');
    setModalOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    if (!saving) setModalOpen(false);
  }, [saving]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError('Nome é obrigatório.');
      return;
    }

    try {
      if (editingItem) {
        await updateSubstance(editingItem.id, { name: formName.trim() });
        toast.success('Substância atualizada.');
      } else {
        await createSubstance({ name: formName.trim() });
        toast.success('Substância cadastrada.');
      }
      setModalOpen(false);
      fetch();
    } catch {
      toast.error('Erro ao salvar substância.');
    }
  }, [formName, editingItem, createSubstance, updateSubstance, toast, fetch]);

  const handleDelete = useCallback(async (row: Substance) => {
    if (!confirm(`Deseja excluir "${row.name}"?`)) return;
    try {
      await deleteSubstance(row.id);
      toast.success('Substância excluída.');
      fetch();
    } catch {
      toast.error('Erro ao excluir substância.');
    }
  }, [deleteSubstance, toast, fetch]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-gray-700 bg-white dark:bg-[#1e2028]">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-5 h-5 text-teal-600" />
          <h1 className="text-lg font-bold text-slate-800 dark:text-gray-100">Substâncias</h1>
          <span className="text-xs text-slate-400 dark:text-gray-500 ml-1">({totalCount})</span>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-bold shadow-md transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          NOVA SUBSTÂNCIA
        </button>
      </div>

      {/* Table */}
      <DataTable<Substance & { status?: string }>
        columns={[
          { key: 'name', label: 'Nome', sortable: true },
        ]}
        data={substances as (Substance & { status?: string })[]}
        loading={loading}
        searchPlaceholder="Buscar substância..."
        onSearch={handleSearch}
        pagination={{ page, pageSize, total: totalCount }}
        onPageChange={(p, size) => { setPage(p); setPageSize(size); }}
        actions={[
          { icon: 'edit', label: 'Editar', onClick: (row) => openEdit(row as Substance) },
        ]}
        menuActions={(row) => [
          {
            icon: <Trash2 className="w-4 h-4" />,
            label: 'Excluir',
            onClick: () => handleDelete(row as Substance),
            className: 'text-red-500 dark:text-red-400',
          },
        ]}
        emptyMessage="Nenhuma substância cadastrada."
      />

      {/* Modal */}
      <ModalForm
        isOpen={modalOpen}
        onClose={handleClose}
        title={editingItem ? 'Editar Substância' : 'Nova Substância'}
        onSubmit={handleSubmit}
        loading={saving}
      >
        <div>
          <label className="text-xs font-bold text-slate-500 dark:text-gray-400 mb-1.5 ml-1 block uppercase tracking-wider">
            Nome <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 ml-1">Obrigatório</span>
          </label>
          <input
            type="text"
            value={formName}
            onChange={e => { setFormName(e.target.value); setFormError(''); }}
            placeholder="Nome da substância"
            autoFocus
            className={`${inputClass} ${formError ? 'border-red-300 dark:border-red-700' : ''}`}
          />
          {formError && <p className="mt-1 text-xs text-red-500">{formError}</p>}
        </div>
      </ModalForm>
    </div>
  );
}
