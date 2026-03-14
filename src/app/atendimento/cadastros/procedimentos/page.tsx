'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus, Trash2, ToggleLeft, ToggleRight, Stethoscope,
  DollarSign, Loader2, X, ChevronDown,
} from 'lucide-react';
import DataTable from '@/components/cadastros/DataTable';
import type { SortDirection } from '@/components/cadastros/DataTable';
import { useToast } from '@/contexts/ToastContext';
import { useProcedures } from '@/hooks/useProcedures';
import type { Procedure } from '@/types/cadastros';

const TYPE_LABELS: Record<string, string> = {
  consultation: 'Consultas',
  exam: 'Exames',
  injectable: 'Injetáveis',
  other: 'Outros',
};

const TYPE_FILTERS = [
  { value: 'consultation', label: 'Consultas' },
  { value: 'exam', label: 'Exames' },
  { value: 'injectable', label: 'Injetáveis' },
  { value: 'other', label: 'Outros' },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export default function ProcedimentosPage() {
  const router = useRouter();
  const { toast } = useToast();
  const {
    procedures,
    totalCount,
    loading,
    saving,
    listProcedures,
    updateProcedure,
    deleteProcedure,
    adjustPrices,
  } = useProcedures();

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [searchTerm, setSearchTerm] = useState('');
  const [sort, setSort] = useState<{ key: string; direction: SortDirection } | undefined>();
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustPercentage, setAdjustPercentage] = useState('');

  const fetch = useCallback(() => {
    listProcedures({
      search: searchTerm,
      types: selectedTypes.length > 0 ? selectedTypes : undefined,
      status: statusFilter || undefined,
      page,
      pageSize,
      sort,
    }).catch(() => {
      toast.error('Erro ao buscar procedimentos.');
    });
  }, [listProcedures, searchTerm, selectedTypes, statusFilter, page, pageSize, sort, toast]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const handleToggleType = useCallback((type: string) => {
    setSelectedTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
    setPage(0);
  }, []);

  const handleToggleStatus = useCallback(async (row: Procedure) => {
    try {
      await updateProcedure(row.id, {
        status: row.status === 'active' ? 'inactive' : 'active',
      });
      toast.success(`Procedimento ${row.status === 'active' ? 'inativado' : 'ativado'}.`);
      fetch();
    } catch {
      toast.error('Erro ao alterar status.');
    }
  }, [updateProcedure, toast, fetch]);

  const handleDelete = useCallback(async (row: Procedure) => {
    if (!confirm(`Deseja excluir "${row.name}"?`)) return;
    try {
      await deleteProcedure(row.id);
      toast.success('Procedimento excluído.');
      fetch();
    } catch {
      toast.error('Erro ao excluir procedimento.');
    }
  }, [deleteProcedure, toast, fetch]);

  const handleAdjustPrices = useCallback(async () => {
    const pct = parseFloat(adjustPercentage);
    if (isNaN(pct) || pct === 0) {
      toast.error('Informe um percentual válido.');
      return;
    }
    try {
      const count = await adjustPrices(pct);
      toast.success(`Preços reajustados em ${pct > 0 ? '+' : ''}${pct}% para ${count} procedimento(s).`);
      setShowAdjustModal(false);
      setAdjustPercentage('');
      fetch();
    } catch {
      toast.error('Erro ao reajustar preços.');
    }
  }, [adjustPercentage, adjustPrices, toast, fetch]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-gray-700 bg-white dark:bg-[#1e2028]">
        <div className="flex items-center gap-2">
          <Stethoscope className="w-5 h-5 text-teal-600" />
          <h1 className="text-lg font-bold text-slate-800 dark:text-gray-100">Procedimentos</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAdjustModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded-lg text-sm font-bold transition-colors"
          >
            <DollarSign className="w-4 h-4" />
            REAJUSTAR PREÇOS
          </button>
          <button
            onClick={() => router.push('/atendimento/cadastros/procedimentos/criar')}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-bold shadow-md transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            NOVO PROCEDIMENTO
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="px-6 py-3 flex flex-wrap items-center gap-3 border-b border-slate-100 dark:border-gray-800 bg-white dark:bg-[#1e2028]">
        {/* Tipo multi-select */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 dark:text-gray-400 uppercase">Tipo:</span>
          {TYPE_FILTERS.map(tf => (
            <button
              key={tf.value}
              onClick={() => handleToggleType(tf.value)}
              className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-colors ${
                selectedTypes.includes(tf.value)
                  ? 'bg-teal-600 text-white border-teal-600'
                  : 'bg-white dark:bg-[#2a2d36] text-slate-600 dark:text-gray-300 border-slate-200 dark:border-gray-700 hover:border-teal-400'
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>

        {/* Status */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 dark:text-gray-400 uppercase">Status:</span>
          <div className="relative">
            <select
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setPage(0); }}
              className="px-3 py-1 text-xs border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-[#2a2d36] text-slate-600 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-400 appearance-none pr-7 cursor-pointer"
            >
              <option value="">Todos</option>
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {(selectedTypes.length > 0 || statusFilter) && (
          <button
            onClick={() => { setSelectedTypes([]); setStatusFilter(''); setPage(0); }}
            className="px-2 py-1 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-gray-300 transition-colors"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {/* Table */}
      <DataTable<Procedure>
        columns={[
          { key: 'name', label: 'Nome', sortable: true },
          {
            key: 'procedure_type',
            label: 'Tipo',
            sortable: true,
            render: (value) => TYPE_LABELS[value as string] || String(value),
          },
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
        data={procedures}
        loading={loading}
        searchPlaceholder="Buscar por nome..."
        onSearch={(term) => { setSearchTerm(term); setPage(0); }}
        onSort={(key, direction) => setSort({ key, direction })}
        pagination={{ page, pageSize, total: totalCount }}
        onPageChange={(p, size) => { setPage(p); setPageSize(size); }}
        actions={[
          { icon: 'edit', label: 'Editar', onClick: (row) => router.push(`/atendimento/cadastros/procedimentos/${row.id}`) },
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
        emptyMessage="Nenhum procedimento cadastrado."
      />

      {/* Modal: Reajustar Preços */}
      {showAdjustModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#1e2028] rounded-xl border border-slate-200 dark:border-gray-700 shadow-2xl w-full max-w-md mx-4 animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-gray-700">
              <h3 className="text-base font-bold text-slate-800 dark:text-gray-100 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-amber-500" />
                Reajustar Preços
              </h3>
              <button
                onClick={() => { setShowAdjustModal(false); setAdjustPercentage(''); }}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-slate-600 dark:text-gray-300">
                Informe o percentual de reajuste. Valores positivos aumentam, negativos diminuem.
                O ajuste será aplicado a todos os procedimentos <strong>ativos</strong>.
              </p>
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-gray-400 mb-1.5 ml-1 block uppercase tracking-wider">
                  Percentual (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={adjustPercentage}
                  onChange={e => setAdjustPercentage(e.target.value)}
                  placeholder="Ex: 10 ou -5"
                  autoFocus
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 dark:border-gray-700 rounded-xl bg-white dark:bg-[#2a2d36] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 dark:border-gray-700 flex items-center justify-end gap-3">
              <button
                onClick={() => { setShowAdjustModal(false); setAdjustPercentage(''); }}
                className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleAdjustPrices}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-lg shadow-amber-500/20 transition-all active:scale-95 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}
                APLICAR REAJUSTE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
