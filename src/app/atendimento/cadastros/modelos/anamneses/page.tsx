'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, ClipboardList } from 'lucide-react';
import DataTable from '@/components/cadastros/DataTable';
import type { SortDirection } from '@/components/cadastros/DataTable';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAnamnesisTemplates } from '@/hooks/useAnamnesisTemplates';
import type { AnamnesisTemplate } from '@/types/cadastros';

export default function AnamnesesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const {
    templates,
    totalCount,
    loading,
    listTemplates,
    deleteTemplate,
  } = useAnamnesisTemplates();

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [sort, setSort] = useState<{ key: string; direction: SortDirection } | undefined>();
  const [onlyMine, setOnlyMine] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AnamnesisTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetch = useCallback(() => {
    listTemplates(
      searchTerm,
      page,
      pageSize,
      sort,
      onlyMine ? user?.id : undefined,
    ).catch(() => {
      toast.error('Erro ao buscar modelos de anamnese.');
    });
  }, [listTemplates, searchTerm, page, pageSize, sort, onlyMine, user?.id, toast]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteTemplate(deleteTarget.id);
      toast.success('Modelo excluído.');
      setDeleteTarget(null);
      fetch();
    } catch {
      toast.error('Erro ao excluir modelo.');
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, deleteTemplate, toast, fetch]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-[#252530] bg-white dark:bg-[#111118]">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-blue-600" />
          <h1 className="text-lg font-bold text-slate-800 dark:text-[#fafafa]">Modelos de Anamnese</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => { setOnlyMine(prev => !prev); setPage(0); }}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
              onlyMine
                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                : 'bg-white dark:bg-[#1a1a22] border-slate-200 dark:border-[#252530] text-slate-600 dark:text-[#a1a1aa] hover:bg-slate-50 dark:hover:bg-white/5'
            }`}
          >
            <span className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              onlyMine ? 'bg-blue-600' : 'bg-slate-300 dark:bg-gray-600'
            }`}>
              <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform shadow-sm ${
                onlyMine ? 'translate-x-[18px]' : 'translate-x-[3px]'
              }`} />
            </span>
            Meus modelos
          </button>

          <button
            onClick={() => router.push('/atendimento/cadastros/modelos/anamneses/criar')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow-md transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            ADICIONAR MODELO
          </button>
        </div>
      </div>

      {/* Table */}
      <DataTable<AnamnesisTemplate & { id: string; status?: string }>
        columns={[
          { key: 'title', label: 'Título', sortable: true },
          {
            key: 'created_at',
            label: 'Data',
            sortable: true,
            render: (value) => {
              if (!value) return '—';
              return new Date(String(value)).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              });
            },
          },
        ]}
        data={templates as (AnamnesisTemplate & { id: string; status?: string })[]}
        loading={loading}
        searchPlaceholder="Buscar modelo de anamnese..."
        onSearch={(term) => { setSearchTerm(term); setPage(0); }}
        onSort={(key, direction) => setSort({ key, direction })}
        pagination={{ page, pageSize, total: totalCount }}
        onPageChange={(p, size) => { setPage(p); setPageSize(size); }}
        actions={[
          { icon: 'eye', label: 'Visualizar', onClick: (row) => router.push(`/atendimento/cadastros/modelos/anamneses/${row.id}`) },
          { icon: 'edit', label: 'Editar', onClick: (row) => router.push(`/atendimento/cadastros/modelos/anamneses/${row.id}`) },
        ]}
        menuActions={(row) => [
          {
            icon: <Trash2 className="w-4 h-4" />,
            label: 'Excluir',
            onClick: () => setDeleteTarget(row as AnamnesisTemplate),
            className: 'text-red-500 dark:text-red-400',
          },
        ]}
        emptyMessage="Nenhum modelo de anamnese cadastrado."
      />

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Excluir modelo"
        message={`Deseja excluir "${deleteTarget?.title}"? Esta ação não pode ser desfeita.`}
        type="danger"
        confirmText="Sim, excluir"
        cancelText="Cancelar"
        isLoading={deleting}
      />
    </div>
  );
}
