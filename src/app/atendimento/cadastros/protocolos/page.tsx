'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, ToggleLeft, ToggleRight, Shield } from 'lucide-react';
import DataTable from '@/components/cadastros/DataTable';
import type { SortDirection } from '@/components/cadastros/DataTable';
import { useToast } from '@/contexts/ToastContext';
import { useClinicalProtocols } from '@/hooks/useClinicalProtocols';
import type { ClinicalProtocol } from '@/types/cadastros';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export default function ProtocolosClinicoPage() {
  const router = useRouter();
  const { toast } = useToast();
  const {
    protocols,
    totalCount,
    loading,
    listProtocols,
    updateProtocol,
    deleteProtocol,
  } = useClinicalProtocols();

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [searchTerm, setSearchTerm] = useState('');
  const [sort, setSort] = useState<{ key: string; direction: SortDirection } | undefined>();

  const fetch = useCallback(() => {
    listProtocols(searchTerm, page, pageSize, sort).catch(() => {
      toast.error('Erro ao buscar protocolos clínicos.');
    });
  }, [listProtocols, searchTerm, page, pageSize, sort, toast]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const handleToggleStatus = useCallback(async (row: ClinicalProtocol) => {
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

  const handleDelete = useCallback(async (row: ClinicalProtocol) => {
    if (!confirm(`Deseja excluir "${row.name}"?`)) return;
    try {
      await deleteProtocol(row.id);
      toast.success('Protocolo excluído.');
      fetch();
    } catch {
      toast.error('Erro ao excluir protocolo.');
    }
  }, [deleteProtocol, toast, fetch]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-gray-700 bg-white dark:bg-[#1e2028]">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-teal-600" />
          <h1 className="text-lg font-bold text-slate-800 dark:text-gray-100">Protocolos Clínicos</h1>
        </div>
        <button
          onClick={() => router.push('/atendimento/cadastros/protocolos/criar')}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-bold shadow-md transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          NOVO PROTOCOLO
        </button>
      </div>

      {/* Table */}
      <DataTable<ClinicalProtocol>
        columns={[
          { key: 'name', label: 'Nome', sortable: true },
          {
            key: 'total_value',
            label: 'Valor',
            sortable: true,
            render: (value) => (
              <span className="font-mono text-xs">{formatCurrency(value as number)}</span>
            ),
          },
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
            onClick: (row) => router.push(`/atendimento/cadastros/protocolos/${row.id}`),
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
            onClick: () => handleDelete(row),
            className: 'text-red-500 dark:text-red-400',
          },
        ]}
        emptyMessage="Nenhum protocolo clínico cadastrado."
      />
    </div>
  );
}
