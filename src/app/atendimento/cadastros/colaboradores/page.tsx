'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, ToggleLeft, ToggleRight, Users } from 'lucide-react';
import DataTable from '@/components/cadastros/DataTable';
import type { SortDirection } from '@/components/cadastros/DataTable';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { useToast } from '@/contexts/ToastContext';
import { useCollaborators } from '@/hooks/useCollaborators';
import type { Collaborator } from '@/types/cadastros';

export default function ColaboradoresPage() {
  const router = useRouter();
  const { toast } = useToast();
  const {
    collaborators,
    totalCount,
    loading,
    listCollaborators,
    updateCollaborator,
    deleteCollaborator,
  } = useCollaborators();

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [searchTerm, setSearchTerm] = useState('');
  const [sort, setSort] = useState<{ key: string; direction: SortDirection } | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<Collaborator | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetch = useCallback(() => {
    listCollaborators(searchTerm, page, pageSize, sort).catch(() => {
      toast.error('Erro ao buscar colaboradores.');
    });
  }, [listCollaborators, searchTerm, page, pageSize, sort, toast]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const handleToggleStatus = useCallback(async (row: Collaborator) => {
    try {
      await updateCollaborator(row.id, {
        status: row.status === 'active' ? 'inactive' : 'active',
      });
      toast.success(`Colaborador ${row.status === 'active' ? 'inativado' : 'ativado'}.`);
      fetch();
    } catch {
      toast.error('Erro ao alterar status.');
    }
  }, [updateCollaborator, toast, fetch]);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteCollaborator(deleteTarget.id);
      toast.success('Colaborador excluído.');
      setDeleteTarget(null);
      fetch();
    } catch {
      toast.error('Erro ao excluir colaborador.');
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, deleteCollaborator, toast, fetch]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-[#252530] bg-white dark:bg-[#111118]">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-600" />
          <h1 className="text-lg font-bold text-slate-800 dark:text-[#fafafa]">Colaboradores</h1>
        </div>
        <button
          onClick={() => router.push('/atendimento/cadastros/colaboradores/criar')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow-md transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          NOVO COLABORADOR
        </button>
      </div>

      {/* Table */}
      <DataTable<Collaborator>
        columns={[
          { key: 'name', label: 'Nome', sortable: true },
          { key: 'status', label: 'Status' },
        ]}
        data={collaborators}
        loading={loading}
        searchPlaceholder="Buscar por nome, CPF ou e-mail..."
        onSearch={(term) => { setSearchTerm(term); setPage(0); }}
        onSort={(key, direction) => setSort({ key, direction })}
        pagination={{ page, pageSize, total: totalCount }}
        onPageChange={(p, size) => { setPage(p); setPageSize(size); }}
        actions={[
          { icon: 'edit', label: 'Editar', onClick: (row) => router.push(`/atendimento/cadastros/colaboradores/${row.id}`) },
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
        emptyMessage="Nenhum colaborador cadastrado."
      />

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Excluir colaborador"
        message={`Deseja excluir "${deleteTarget?.name}"? Esta ação não pode ser desfeita.`}
        type="danger"
        confirmText="Sim, excluir"
        cancelText="Cancelar"
        isLoading={deleting}
      />
    </div>
  );
}
