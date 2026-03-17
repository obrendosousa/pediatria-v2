'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus, Loader2, MoreHorizontal,
  Calendar, Eye, XCircle, FileText, Filter,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/contexts/ToastContext';
import { useInvoices, type InvoiceFilters } from '@/hooks/atendimento/useInvoices';
import type { Invoice, InvoiceStatus } from '@/types/invoice';
import ConfirmModal from '@/components/ui/ConfirmModal';

type StatusFilter = InvoiceStatus | 'all';
type PageSize = 10 | 25 | 50;

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; bg: string; text: string }> = {
  processing: { label: 'PROCESSANDO', bg: 'bg-yellow-100 dark:bg-yellow-900/20', text: 'text-yellow-700 dark:text-yellow-400' },
  issued: { label: 'EMITIDA', bg: 'bg-green-100 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-400' },
  denied: { label: 'NEGADA', bg: 'bg-red-100 dark:bg-red-900/20', text: 'text-red-700 dark:text-red-400' },
  error: { label: 'ERRO', bg: 'bg-red-100 dark:bg-red-900/20', text: 'text-red-600 dark:text-red-400' },
  cancelled: { label: 'CANCELADA', bg: 'bg-slate-100 dark:bg-[#1c1c21]', text: 'text-slate-500 dark:text-[#a1a1aa]' },
  requesting_auth: { label: 'AUTORIZANDO', bg: 'bg-blue-100 dark:bg-blue-900/20', text: 'text-blue-700 dark:text-blue-400' },
};

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'processing', label: 'Processando' },
  { value: 'issued', label: 'Emitidas' },
  { value: 'denied', label: 'Negadas' },
  { value: 'error', label: 'Erros' },
  { value: 'cancelled', label: 'Canceladas' },
  { value: 'requesting_auth', label: 'Autorizando' },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

function getDefaultDateFrom() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export default function NfeListTable() {
  const { toast } = useToast();
  const router = useRouter();
  const { invoices, totalCount, isLoading, fetchInvoices, cancelInvoice } = useInvoices();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dateFrom, setDateFrom] = useState(getDefaultDateFrom);
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<PageSize>(25);
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<Invoice | null>(null);

  const menuRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Fetch
  const doFetch = useCallback(() => {
    const filters: InvoiceFilters = {
      status: statusFilter,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      page,
      pageSize,
    };
    fetchInvoices(filters).catch(() => toast.error('Erro ao carregar notas fiscais.'));
  }, [statusFilter, dateFrom, dateTo, page, pageSize, fetchInvoices, toast]);

  useEffect(() => { doFetch(); }, [doFetch]);

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

  // Cancelar NF-e
  const handleCancel = async () => {
    if (!confirmCancel) return;
    try {
      await cancelInvoice(confirmCancel.id);
      toast.success('NF-e cancelada com sucesso.');
      doFetch();
    } catch {
      toast.error('Erro ao cancelar NF-e.');
    }
    setConfirmCancel(null);
  };

  // Paginação
  const totalPages = Math.ceil(totalCount / pageSize);
  const showingFrom = totalCount === 0 ? 0 : page * pageSize + 1;
  const showingTo = Math.min((page + 1) * pageSize, totalCount);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 flex items-center justify-between border-b border-slate-200 dark:border-[#3d3d48]">
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-[#fafafa]">Notas Fiscais Eletrônicas</h2>
          <p className="text-xs text-slate-400 dark:text-[#71717a] mt-0.5">{totalCount} nota{totalCount !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => router.push('/atendimento/financeiro/nfe/gerar')}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" /> GERAR NF-E
        </button>
      </div>

      {/* Filtros */}
      <div className="px-6 py-3 flex flex-wrap items-center gap-3 border-b border-slate-100 dark:border-[#2d2d36]">
        <div className="flex items-center gap-1">
          <Filter className="w-4 h-4 text-slate-400 mr-1" />
          {STATUS_OPTIONS.map(f => (
            <button
              key={f.value}
              onClick={() => handleStatusChange(f.value)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                statusFilter === f.value
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  : 'text-slate-500 dark:text-[#a1a1aa] hover:bg-slate-100 dark:hover:bg-white/5'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateFrom}
            onChange={e => { setDateFrom(e.target.value); setPage(0); }}
            className="px-2 py-1.5 text-xs border border-slate-200 dark:border-[#3d3d48] rounded-lg bg-white dark:bg-[#1c1c21] text-slate-600 dark:text-[#d4d4d8] focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <span className="text-xs text-slate-400">até</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => { setDateTo(e.target.value); setPage(0); }}
            className="px-2 py-1.5 text-xs border border-slate-200 dark:border-[#3d3d48] rounded-lg bg-white dark:bg-[#1c1c21] text-slate-600 dark:text-[#d4d4d8] focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        <select
          value={pageSize}
          onChange={e => handlePageSizeChange(Number(e.target.value) as PageSize)}
          className="px-2 py-1.5 text-xs border border-slate-200 dark:border-[#3d3d48] rounded-lg bg-white dark:bg-[#1c1c21] text-slate-600 dark:text-[#d4d4d8] focus:outline-none focus:ring-2 focus:ring-blue-400"
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
            <span className="text-sm">Carregando notas fiscais...</span>
          </div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="w-12 h-12 text-slate-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-slate-400 dark:text-[#71717a]">Nenhuma nota fiscal encontrada.</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-[#08080b] rounded-xl border border-slate-200 dark:border-[#3d3d48] overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-[#1c1c21] border-b border-slate-200 dark:border-[#3d3d48]">
                  <th className="px-4 py-3 text-xs font-extrabold text-slate-500 dark:text-[#a1a1aa] uppercase w-16">Reg.</th>
                  <th className="px-4 py-3 text-xs font-extrabold text-slate-500 dark:text-[#a1a1aa] uppercase">Paciente</th>
                  <th className="px-4 py-3 text-xs font-extrabold text-slate-500 dark:text-[#a1a1aa] uppercase text-right">Valor</th>
                  <th className="px-4 py-3 text-xs font-extrabold text-slate-500 dark:text-[#a1a1aa] uppercase">Status</th>
                  <th className="px-4 py-3 text-xs font-extrabold text-slate-500 dark:text-[#a1a1aa] uppercase">NF-e</th>
                  <th className="px-4 py-3 text-xs font-extrabold text-slate-500 dark:text-[#a1a1aa] uppercase">Data</th>
                  <th className="px-4 py-3 text-xs font-extrabold text-slate-500 dark:text-[#a1a1aa] uppercase text-right">Opções</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                {invoices.map(inv => {
                  const cfg = STATUS_CONFIG[inv.status];
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 text-xs text-slate-400 dark:text-[#71717a] font-mono">#{inv.id}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-700 dark:text-gray-200">{inv.patient_name || '—'}</p>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600 dark:text-[#d4d4d8] font-mono text-xs font-bold">
                        {formatCurrency(inv.amount)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 text-xs font-bold rounded ${cfg.bg} ${cfg.text}`}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 dark:text-[#d4d4d8] font-mono">
                        {inv.nfe_number || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-slate-600 dark:text-[#d4d4d8] text-xs">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {formatDate(inv.created_at)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => toggleMenu(inv.id)}
                            title="Opções"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                          >
                            <div ref={(el) => { menuRefs.current[inv.id] = el as HTMLDivElement; }}>
                              <MoreHorizontal className="w-4 h-4" />
                            </div>
                          </button>
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
        <div className="px-6 py-3 border-t border-slate-200 dark:border-[#3d3d48] flex items-center justify-between text-xs text-slate-500 dark:text-[#a1a1aa]">
          <span>Mostrando {showingFrom} até {showingTo} de {totalCount}</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#3d3d48] disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
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
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-slate-200 dark:border-[#3d3d48] hover:bg-slate-50 dark:hover:bg-white/5'
                  }`}
                >
                  {pageNum + 1}
                </button>
              );
            })}
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#3d3d48] disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
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
          className="fixed z-50 w-44 bg-white dark:bg-[#1c1c21] rounded-xl shadow-xl border border-slate-200 dark:border-[#3d3d48] py-1 animate-in fade-in-0 zoom-in-95"
          style={{ top: menuPosition.top, left: menuPosition.left }}
        >
          {(() => {
            const inv = invoices.find(i => i.id === menuOpenId);
            if (!inv) return null;
            return (
              <>
                <button
                  onClick={() => { setMenuOpenId(null); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" /> Ver detalhes
                </button>
                {inv.status !== 'cancelled' && (
                  <button
                    onClick={() => { setConfirmCancel(inv); setMenuOpenId(null); }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Cancelar NF-e
                  </button>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* Confirm modal */}
      <ConfirmModal
        isOpen={confirmCancel !== null}
        onClose={() => setConfirmCancel(null)}
        onConfirm={handleCancel}
        title="Cancelar NF-e"
        message={`Tem certeza que deseja cancelar a NF-e #${confirmCancel?.id}?`}
        confirmText="Cancelar NF-e"
        type="danger"
      />
    </div>
  );
}
