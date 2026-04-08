'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, FileSignature, Star } from 'lucide-react';
import DataTable from '@/components/cadastros/DataTable';
import type { SortDirection } from '@/components/cadastros/DataTable';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { useToast } from '@/contexts/ToastContext';
import { useDocumentTemplates } from '@/hooks/useDocumentTemplates';
import type { DocumentTemplate } from '@/types/cadastros';

export default function DocumentosPage() {
  const router = useRouter();
  const { toast } = useToast();
  const {
    templates,
    totalCount,
    loading,
    listTemplates,
    deleteTemplate,
  } = useDocumentTemplates();

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [sort, setSort] = useState<{ key: string; direction: SortDirection } | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<DocumentTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetch = useCallback(() => {
    listTemplates(searchTerm, page, pageSize, sort).catch(() => {
      toast.error('Erro ao buscar documentos.');
    });
  }, [listTemplates, searchTerm, page, pageSize, sort, toast]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteTemplate(deleteTarget.id);
      toast.success('Documento excluído.');
      setDeleteTarget(null);
      fetch();
    } catch {
      toast.error('Erro ao excluir documento.');
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, deleteTemplate, toast, fetch]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-[#252530] bg-white dark:bg-[#111118]">
        <div className="flex items-center gap-2">
          <FileSignature className="w-5 h-5 text-blue-600" />
          <h1 className="text-lg font-bold text-slate-800 dark:text-[#fafafa]">Modelos de Documentos</h1>
        </div>
        <button
          onClick={() => router.push('/atendimento/cadastros/documentos/criar')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow-md transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          ADICIONAR DOCUMENTO
        </button>
      </div>

      {/* Table */}
      <DataTable<DocumentTemplate & { id: string; status?: string }>
        columns={[
          {
            key: 'title',
            label: 'Título',
            sortable: true,
            render: (value, row) => (
              <div className="flex items-center gap-2">
                <span>{String(value)}</span>
                {row.is_default && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                    <Star className="w-3 h-3" />
                    PADRÃO
                  </span>
                )}
              </div>
            ),
          },
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
        data={templates as (DocumentTemplate & { id: string; status?: string })[]}
        loading={loading}
        searchPlaceholder="Buscar documento..."
        onSearch={(term) => { setSearchTerm(term); setPage(0); }}
        onSort={(key, direction) => setSort({ key, direction })}
        pagination={{ page, pageSize, total: totalCount }}
        onPageChange={(p, size) => { setPage(p); setPageSize(size); }}
        actions={[
          { icon: 'eye', label: 'Visualizar', onClick: (row) => router.push(`/atendimento/cadastros/documentos/${row.id}`) },
          { icon: 'edit', label: 'Editar', onClick: (row) => router.push(`/atendimento/cadastros/documentos/${row.id}`) },
        ]}
        menuActions={(row) => [
          {
            icon: <Trash2 className="w-4 h-4" />,
            label: 'Excluir',
            onClick: () => setDeleteTarget(row as DocumentTemplate),
            className: 'text-red-500 dark:text-red-400',
          },
        ]}
        emptyMessage="Nenhum documento cadastrado."
      />

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Excluir documento"
        message={`Deseja excluir "${deleteTarget?.title}"? Esta ação não pode ser desfeita.`}
        type="danger"
        confirmText="Sim, excluir"
        cancelText="Cancelar"
        isLoading={deleting}
      />
    </div>
  );
}
