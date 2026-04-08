'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, ToggleLeft, ToggleRight, ClipboardList } from 'lucide-react';
import DataTable from '@/components/cadastros/DataTable';
import type { SortDirection } from '@/components/cadastros/DataTable';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { useToast } from '@/contexts/ToastContext';
import { usePrescriptionProtocols } from '@/hooks/usePrescriptionProtocols';
import type { PrescriptionProtocol } from '@/types/cadastros';

export default function ProtocolosReceituarioPage() {
  const router = useRouter();
  const { toast } = useToast();
  const {
    protocols,
    totalCount,
    loading,
    listProtocols,
    updateProtocol,
    deleteProtocol,
  } = usePrescriptionProtocols();

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [searchTerm, setSearchTerm] = useState('');
  const [sort, setSort] = useState<{ key: string; direction: SortDirection } | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<PrescriptionProtocol | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetch = useCallback(() => {
    listProtocols(searchTerm, page, pageSize, sort).catch(() => {
      toast.error('Erro ao buscar protocolos.');
    });
  }, [listProtocols, searchTerm, page, pageSize, sort, toast]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const handleToggleStatus = useCallback(async (row: PrescriptionProtocol) => {
    try {
      await updateProtocol(row.id, {
        status: row.status === 'active' ? 'inactive' : 'active',
      });
      toast.success(`Protocolo ${row.status === 'active' ? 'inativado' : 'ativado'}.`);
      fetch();
    } catch {
      toast.error('Erro ao alterar status.');
    }
  }, [updateProtocol, toast, fetch]);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteProtocol(deleteTarget.id);
      toast.success('Protocolo excluído.');
      setDeleteTarget(null);
      fetch();
    } catch {
      toast.error('Erro ao excluir protocolo.');
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, deleteProtocol, toast, fetch]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-[#252530] bg-white dark:bg-[#111118]">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-blue-600" />
          <h1 className="text-lg font-bold text-slate-800 dark:text-[#fafafa]">
            Protocolos de Receituário
          </h1>
        </div>
        <button
          onClick={() => router.push('/atendimento/cadastros/receituario/protocolos/criar')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow-md transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          NOVO PROTOCOLO
        </button>
      </div>

      {/* Table */}
      <DataTable<PrescriptionProtocol>
        columns={[
          { key: 'name', label: 'Nome', sortable: true },
          { key: 'status', label: 'Status' },
        ]}
        data={protocols}
        loading={loading}
        searchPlaceholder="Buscar protocolo..."
        onSearch={(term) => { setSearchTerm(term); setPage(0); }}
        onSort={(key, direction) => setSort({ key, direction })}
        pagination={{ page, pageSize, total: totalCount }}
        onPageChange={(p, size) => { setPage(p); setPageSize(size); }}
        actions={[
          {
            icon: 'edit',
            label: 'Editar',
            onClick: (row) => router.push(`/atendimento/cadastros/receituario/protocolos/${row.id}`),
          },
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
        emptyMessage="Nenhum protocolo cadastrado."
      />

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Excluir protocolo"
        message={`Deseja excluir "${deleteTarget?.name}"? Esta ação não pode ser desfeita.`}
        type="danger"
        confirmText="Sim, excluir"
        cancelText="Cancelar"
        isLoading={deleting}
      />
    </div>
  );
}
