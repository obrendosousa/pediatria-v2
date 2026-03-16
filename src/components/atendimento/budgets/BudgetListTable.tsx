'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, Plus, Loader2, MoreHorizontal,
  Calendar, Eye, CheckCircle, XCircle,
  Receipt, Filter,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/contexts/ToastContext';
import { useBudgets, type BudgetFilters } from '@/hooks/atendimento/useBudgets';
import type { Budget, BudgetStatus } from '@/types/budget';
import ConfirmModal from '@/components/ui/ConfirmModal';

type StatusFilter = BudgetStatus | 'all';
type PageSize = 10 | 25 | 50;

const STATUS_CONFIG: Record<BudgetStatus, { label: string; bg: string; text: string }> = {
  pendente: { label: 'PENDENTE', bg: 'bg-yellow-100 dark:bg-yellow-900/20', text: 'text-yellow-700 dark:text-yellow-400' },
  orcado: { label: 'ORÇADO', bg: 'bg-blue-100 dark:bg-blue-900/20', text: 'text-blue-700 dark:text-blue-400' },
  aprovado: { label: 'APROVADO', bg: 'bg-green-100 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-400' },
  rejeitado: { label: 'REJEITADO', bg: 'bg-red-100 dark:bg-red-900/20', text: 'text-red-600 dark:text-red-400' },
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

export default function BudgetListTable() {
  const { toast } = useToast();
  const router = useRouter();
  const { budgets, totalCount, isLoading, fetchBudgets, updateBudgetStatus } = useBudgets();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<PageSize>(25);
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ budget: Budget; action: 'aprovar' | 'rejeitar' } | null>(null);

  const menuRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Fetch
  const doFetch = useCallback(() => {
    const filters: BudgetFilters = {
      search: searchTerm,
      status: statusFilter,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      page,
      pageSize,
    };
    fetchBudgets(filters).catch(() => toast.error('Erro ao carregar orçamentos.'));
  }, [searchTerm, statusFilter, dateFrom, dateTo, page, pageSize, fetchBudgets, toast]);

  useEffect(() => { doFetch(); }, [doFetch]);

  const handleSearchChange = (val: string) => { setSearchTerm(val); setPage(0); };
  const handleStatusChange = (val: StatusFilter) => { setStatusFilter(val); setPage(0); };
  const handlePageSizeChange = (val: PageSize) => { setPageSize(val); setPage(0); };

  // Menu dropdown
  const toggleMenu = (id: number) => {
    if (menuOpenId === id) { setMenuOpenId(null); return; }
    const el = menuRefs.current[id];
    if (el) {
      const rect = el.getBoundingClientRect();
      setMenuPosition({ top: rect.bottom + 4, left: rect.right - 180 });
    }
    setMenuOpenId(id);
  };

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setMenuOpenId(null);
    }
    if (menuOpenId !== null) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [menuOpenId]);

  // Ações de status
  const handleStatusAction = async () => {
    if (!confirmAction) return;
    const { budget, action } = confirmAction;
    const newStatus: BudgetStatus = action === 'aprovar' ? 'aprovado' : 'rejeitado';
    try {
      await updateBudgetStatus(budget.id, newStatus);
      toast.success(`Orçamento ${action === 'aprovar' ? 'aprovado' : 'rejeitado'}.`);
      doFetch();
    } catch {
      toast.error('Erro ao atualizar status.');
    }
    setConfirmAction(null);
  };

  // Paginação
  const totalPages = Math.ceil(totalCount / pageSize);
  const showingFrom = totalCount === 0 ? 0 : page * pageSize + 1;
  const showingTo = Math.min((page + 1) * pageSize, totalCount);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 flex items-center justify-between border-b border-slate-200 dark:border-[#2e2e33]">
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-[#fafafa]">Orçamentos</h2>
          <p className="text-xs text-slate-400 dark:text-[#71717a] mt-0.5">{totalCount} orçamento{totalCount !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => router.push('/atendimento/orcamentos/criar')}
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" /> CRIAR ORÇAMENTO
        </button>
      </div>

      {/* Filtros */}
      <div className="px-6 py-3 flex flex-wrap items-center gap-3 border-b border-slate-100 dark:border-[#27272a]">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => handleSearchChange(e.target.value)}
            placeholder="Buscar por paciente ou registro..."
            className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 dark:border-[#2e2e33] rounded-lg bg-white dark:bg-[#18181b] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-400"
          />
        </div>

        <div className="flex items-center gap-1">
          <Filter className="w-4 h-4 text-slate-400 mr-1" />
          {(['all', 'pendente', 'orcado', 'aprovado', 'rejeitado'] as StatusFilter[]).map(f => (
            <button
              key={f}
              onClick={() => handleStatusChange(f)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                statusFilter === f
                  ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300'
                  : 'text-slate-500 dark:text-[#a1a1aa] hover:bg-slate-100 dark:hover:bg-white/5'
              }`}
            >
              {f === 'all' ? 'Todos' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateFrom}
            onChange={e => { setDateFrom(e.target.value); setPage(0); }}
            className="px-2 py-1.5 text-xs border border-slate-200 dark:border-[#2e2e33] rounded-lg bg-white dark:bg-[#18181b] text-slate-600 dark:text-[#d4d4d8] focus:outline-none focus:ring-2 focus:ring-teal-400"
          />
          <span className="text-xs text-slate-400">até</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => { setDateTo(e.target.value); setPage(0); }}
            className="px-2 py-1.5 text-xs border border-slate-200 dark:border-[#2e2e33] rounded-lg bg-white dark:bg-[#18181b] text-slate-600 dark:text-[#d4d4d8] focus:outline-none focus:ring-2 focus:ring-teal-400"
          />
        </div>

        <select
          value={pageSize}
          onChange={e => handlePageSizeChange(Number(e.target.value) as PageSize)}
          className="px-2 py-1.5 text-xs border border-slate-200 dark:border-[#2e2e33] rounded-lg bg-white dark:bg-[#18181b] text-slate-600 dark:text-[#d4d4d8] focus:outline-none focus:ring-2 focus:ring-teal-400"
        >
          <option value={10}>10 / página</option>
          <option value={25}>25 / página</option>
          <option value={50}>50 / página</option>
        </select>
      </div>

      {/* Tabela */}
      <div className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Carregando orçamentos...</span>
          </div>
        ) : budgets.length === 0 ? (
          <div className="text-center py-16">
            <Receipt className="w-12 h-12 text-slate-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-slate-400 dark:text-[#71717a]">
              {searchTerm ? `Nenhum orçamento encontrado para "${searchTerm}".` : 'Nenhum orçamento cadastrado.'}
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-[#0a0a0c] rounded-xl border border-slate-200 dark:border-[#2e2e33] overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-[#18181b] border-b border-slate-200 dark:border-[#2e2e33]">
                  <th className="px-4 py-3 text-xs font-extrabold text-slate-500 dark:text-[#a1a1aa] uppercase w-16">Reg.</th>
                  <th className="px-4 py-3 text-xs font-extrabold text-slate-500 dark:text-[#a1a1aa] uppercase">Paciente</th>
                  <th className="px-4 py-3 text-xs font-extrabold text-slate-500 dark:text-[#a1a1aa] uppercase">Profissional</th>
                  <th className="px-4 py-3 text-xs font-extrabold text-slate-500 dark:text-[#a1a1aa] uppercase text-right">Valor</th>
                  <th className="px-4 py-3 text-xs font-extrabold text-slate-500 dark:text-[#a1a1aa] uppercase text-right">Desconto</th>
                  <th className="px-4 py-3 text-xs font-extrabold text-slate-500 dark:text-[#a1a1aa] uppercase text-right">Total</th>
                  <th className="px-4 py-3 text-xs font-extrabold text-slate-500 dark:text-[#a1a1aa] uppercase">Data</th>
                  <th className="px-4 py-3 text-xs font-extrabold text-slate-500 dark:text-[#a1a1aa] uppercase">Status</th>
                  <th className="px-4 py-3 text-xs font-extrabold text-slate-500 dark:text-[#a1a1aa] uppercase text-right">Opções</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                {budgets.map(b => {
                  const cfg = STATUS_CONFIG[b.status];
                  return (
                    <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 text-xs text-slate-400 dark:text-[#71717a] font-mono">#{b.id}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-700 dark:text-gray-200">{b.patient_name || '—'}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-[#d4d4d8]">{b.doctor_name || '—'}</td>
                      <td className="px-4 py-3 text-right text-slate-600 dark:text-[#d4d4d8] font-mono text-xs">{formatCurrency(b.subtotal)}</td>
                      <td className="px-4 py-3 text-right text-slate-600 dark:text-[#d4d4d8] font-mono text-xs">
                        {b.discount_amount > 0 ? formatCurrency(b.discount_amount) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-700 dark:text-gray-200 font-mono text-xs">{formatCurrency(b.total)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-slate-600 dark:text-[#d4d4d8] text-xs">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {formatDate(b.created_at)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 text-xs font-bold rounded ${cfg.bg} ${cfg.text}`}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => router.push(`/atendimento/orcamentos/${b.id}`)}
                            title="Ver detalhes"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <div ref={(el) => { menuRefs.current[b.id] = el; }}>
                            <button
                              onClick={() => toggleMenu(b.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="px-6 py-3 border-t border-slate-200 dark:border-[#2e2e33] flex items-center justify-between text-xs text-slate-500 dark:text-[#a1a1aa]">
          <span>Mostrando {showingFrom} até {showingTo} de {totalCount}</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#2e2e33] disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
            >
              Anterior
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const start = Math.max(0, Math.min(page - 2, totalPages - 5));
              const pageNum = start + i;
              if (pageNum >= totalPages) return null;
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`px-3 py-1.5 rounded-lg border transition-colors ${
                    page === pageNum
                      ? 'bg-teal-600 text-white border-teal-600'
                      : 'border-slate-200 dark:border-[#2e2e33] hover:bg-slate-50 dark:hover:bg-white/5'
                  }`}
                >
                  {pageNum + 1}
                </button>
              );
            })}
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#2e2e33] disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
            >
              Próximo
            </button>
          </div>
        </div>
      )}

      {/* Dropdown menu */}
      {menuOpenId !== null && menuPosition && (
        <div
          ref={dropdownRef}
          className="fixed z-50 w-44 bg-white dark:bg-[#18181b] rounded-xl shadow-xl border border-slate-200 dark:border-[#2e2e33] py-1 animate-in fade-in-0 zoom-in-95"
          style={{ top: menuPosition.top, left: menuPosition.left }}
        >
          {(() => {
            const budget = budgets.find(b => b.id === menuOpenId);
            if (!budget) return null;
            return (
              <>
                <button
                  onClick={() => { router.push(`/atendimento/orcamentos/${budget.id}`); setMenuOpenId(null); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" /> Ver detalhes
                </button>
                {(budget.status === 'pendente' || budget.status === 'orcado') && (
                  <button
                    onClick={() => { setConfirmAction({ budget, action: 'aprovar' }); setMenuOpenId(null); }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/10 transition-colors"
                  >
                    <CheckCircle className="w-3.5 h-3.5" /> Aprovar
                  </button>
                )}
                {(budget.status === 'pendente' || budget.status === 'orcado') && (
                  <button
                    onClick={() => { setConfirmAction({ budget, action: 'rejeitar' }); setMenuOpenId(null); }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Rejeitar
                  </button>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* Confirm modal */}
      <ConfirmModal
        isOpen={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleStatusAction}
        title={confirmAction?.action === 'aprovar' ? 'Aprovar Orçamento' : 'Rejeitar Orçamento'}
        message={`Tem certeza que deseja ${confirmAction?.action} o orçamento #${confirmAction?.budget.id}?`}
        confirmText={confirmAction?.action === 'aprovar' ? 'Aprovar' : 'Rejeitar'}
        type={confirmAction?.action === 'aprovar' ? 'success' : 'danger'}
      />
    </div>
  );
}
