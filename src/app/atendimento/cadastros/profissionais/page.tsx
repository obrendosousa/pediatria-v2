'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, ToggleLeft, ToggleRight, UserCog } from 'lucide-react';
import DataTable from '@/components/cadastros/DataTable';
import type { SortDirection } from '@/components/cadastros/DataTable';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { useToast } from '@/contexts/ToastContext';
import { useProfessionals } from '@/hooks/useProfessionals';
import type { Professional } from '@/types/cadastros';

export default function ProfissionaisPage() {
  const router = useRouter();
  const { toast } = useToast();
  const {
    professionals,
    totalCount,
    loading,
    listProfessionals,
    updateProfessional,
    deleteProfessional,
  } = useProfessionals();

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [searchTerm, setSearchTerm] = useState('');
  const [sort, setSort] = useState<{ key: string; direction: SortDirection } | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<Professional | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetch = useCallback(() => {
    listProfessionals(searchTerm, page, pageSize, sort).catch(() => {
      toast.error('Erro ao buscar profissionais.');
    });
  }, [listProfessionals, searchTerm, page, pageSize, sort, toast]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const handleToggleStatus = useCallback(async (row: Professional) => {
    try {
      await updateProfessional(row.id, {
        status: row.status === 'active' ? 'inactive' : 'active',
      });
      toast.success(`Profissional ${row.status === 'active' ? 'inativado' : 'ativado'}.`);
      fetch();
    } catch {
      toast.error('Erro ao alterar status.');
    }
  }, [updateProfessional, toast, fetch]);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteProfessional(deleteTarget.id);
      toast.success('Profissional excluído.');
      setDeleteTarget(null);
      fetch();
    } catch {
      toast.error('Erro ao excluir profissional.');
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, deleteProfessional, toast, fetch]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-[#252530] bg-white dark:bg-[#111118]">
        <div className="flex items-center gap-2">
          <UserCog className="w-5 h-5 text-blue-600" />
          <h1 className="text-lg font-bold text-slate-800 dark:text-[#fafafa]">Profissionais</h1>
        </div>
        <button
          onClick={() => router.push('/atendimento/cadastros/profissionais/criar')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow-md transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          NOVO PROFISSIONAL
        </button>
      </div>

      {/* Table */}
      <DataTable<Professional>
        columns={[
          { key: 'name', label: 'Nome', sortable: true },
          { key: 'status', label: 'Status' },
        ]}
        data={professionals}
        loading={loading}
        searchPlaceholder="Buscar por nome, CPF ou e-mail..."
        onSearch={(term) => { setSearchTerm(term); setPage(0); }}
        onSort={(key, direction) => setSort({ key, direction })}
        pagination={{ page, pageSize, total: totalCount }}
        onPageChange={(p, size) => { setPage(p); setPageSize(size); }}
        actions={[
          { icon: 'edit', label: 'Editar', onClick: (row) => router.push(`/atendimento/cadastros/profissionais/${row.id}`) },
        ]}
        menuActions={(row) => [
          {
            icon: row.status === 'active'
              ? <ToggleLeft className="w-4 h-4" />
              : <ToggleRight className="w-4 h-4" />,
            label: row.status === 'active' ? 'Inativar' : 'Ativar',
            onClick: () => handleToggleStatus(row),
          },
          {
            icon: <Trash2 className="w-4 h-4" />,
            label: 'Excluir',
            onClick: () => setDeleteTarget(row),
            className: 'text-red-500 dark:text-red-400',
          },
        ]}
        emptyMessage="Nenhum profissional cadastrado."
      />

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Excluir profissional"
        message={`Deseja excluir "${deleteTarget?.name}"? Esta ação não pode ser desfeita.`}
        type="danger"
        confirmText="Sim, excluir"
        cancelText="Cancelar"
        isLoading={deleting}
      />
    </div>
  );
}
