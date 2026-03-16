'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, Plus, Loader2, MoreHorizontal, Phone,
  Calendar, Eye, Pencil, History, UserX, UserCheck,
  Users, Filter,
} from 'lucide-react';
import { createSchemaClient } from '@/lib/supabase/schemaClient';
import { useToast } from '@/contexts/ToastContext';
import { useRouter } from 'next/navigation';
import type { AtendimentoPatient } from '@/types/atendimento-patient';
import ConfirmModal from '@/components/ui/ConfirmModal';

const supabase = createSchemaClient('atendimento');

type StatusFilter = 'all' | 'active' | 'inactive';
type PageSize = 10 | 25 | 50;

interface PatientListTableProps {
  onNewPatient: () => void;
  onEditPatient: (patient: AtendimentoPatient) => void;
}

export default function PatientListTable({ onNewPatient, onEditPatient }: PatientListTableProps) {
  const { toast } = useToast();
  const router = useRouter();

  const [patients, setPatients] = useState<AtendimentoPatient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<PageSize>(25);
  const [totalCount, setTotalCount] = useState(0);
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AtendimentoPatient | null>(null);

  const menuRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // ── Fetch pacientes ─────────────────────────────────────────────────────
  const fetchPatients = useCallback(async () => {
    setIsLoading(true);
    try {
      const from = page * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('patients')
        .select('*', { count: 'exact' });

      if (statusFilter === 'active') query = query.eq('active', true);
      else if (statusFilter === 'inactive') query = query.eq('active', false);

      if (searchTerm.trim()) {
        const term = `%${searchTerm.trim()}%`;
        query = query.or(`full_name.ilike.${term},phone.ilike.${term},cpf.ilike.${term}`);
      }

      const { data, count, error } = await query
        .order('full_name')
        .range(from, to);

      if (error) throw error;
      setPatients((data || []) as AtendimentoPatient[]);
      setTotalCount(count || 0);
    } catch (err) {
      console.error('[PatientListTable] fetch error:', err);
      toast.error('Erro ao carregar pacientes.');
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, statusFilter, searchTerm, toast]);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  // Reseta página ao mudar filtro/busca
  const handleSearchChange = (val: string) => {
    setSearchTerm(val);
    setPage(0);
  };
  const handleStatusChange = (val: StatusFilter) => {
    setStatusFilter(val);
    setPage(0);
  };
  const handlePageSizeChange = (val: PageSize) => {
    setPageSize(val);
    setPage(0);
  };

  // ── Menu de opções ──────────────────────────────────────────────────────
  const toggleMenu = (id: number) => {
    if (menuOpenId === id) {
      setMenuOpenId(null);
      return;
    }
    const el = menuRefs.current[id];
    if (el) {
      const rect = el.getBoundingClientRect();
      setMenuPosition({ top: rect.bottom + 4, left: rect.right - 180 });
    }
    setMenuOpenId(id);
  };

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
    }
    if (menuOpenId !== null) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [menuOpenId]);

  // ── Ações ───────────────────────────────────────────────────────────────
  const handleToggleActive = async (patient: AtendimentoPatient) => {
    const newActive = !patient.active;
    const { error } = await supabase
      .from('patients')
      .update({ active: newActive })
      .eq('id', patient.id);
    if (error) {
      toast.error('Erro ao atualizar status.');
      return;
    }
    toast.success(newActive ? 'Paciente ativado.' : 'Paciente inativado.');
    fetchPatients();
    setMenuOpenId(null);
  };

  const handleDelete = async (patient: AtendimentoPatient) => {
    const { error } = await supabase.from('patients').delete().eq('id', patient.id);
    if (error) {
      toast.error('Erro ao excluir paciente: ' + error.message);
    } else {
      toast.success('Paciente excluído.');
      fetchPatients();
    }
    setConfirmDelete(null);
  };

  // ── Paginação ───────────────────────────────────────────────────────────
  const totalPages = Math.ceil(totalCount / pageSize);
  const showingFrom = totalCount === 0 ? 0 : page * pageSize + 1;
  const showingTo = Math.min((page + 1) * pageSize, totalCount);

  function formatDate(dateStr?: string | null) {
    if (!dateStr) return '—';
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR');
  }

  function getInitials(name: string) {
    return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  }

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* Cabeçalho */}
      <div className="px-6 pt-5 pb-4 flex items-center justify-between border-b border-slate-200 dark:border-[#2e2e33]">
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-[#fafafa]">Pacientes</h2>
          <p className="text-xs text-slate-400 dark:text-[#71717a] mt-0.5">{totalCount} paciente{totalCount !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={onNewPatient}
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" /> ADICIONAR PACIENTE
        </button>
      </div>

      {/* Barra de busca e filtros */}
      <div className="px-6 py-3 flex flex-wrap items-center gap-3 border-b border-slate-100 dark:border-[#27272a]">
        {/* Busca */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => handleSearchChange(e.target.value)}
            placeholder="Buscar por nome, telefone ou CPF..."
            className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 dark:border-[#2e2e33] rounded-lg bg-white dark:bg-[#18181b] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-400"
          />
        </div>

        {/* Filtro status */}
        <div className="flex items-center gap-1">
          <Filter className="w-4 h-4 text-slate-400 mr-1" />
          {(['all', 'active', 'inactive'] as StatusFilter[]).map(f => (
            <button
              key={f}
              onClick={() => handleStatusChange(f)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                statusFilter === f
                  ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300'
                  : 'text-slate-500 dark:text-[#a1a1aa] hover:bg-slate-100 dark:hover:bg-white/5'
              }`}
            >
              {f === 'all' ? 'Todos' : f === 'active' ? 'Ativos' : 'Inativos'}
            </button>
          ))}
        </div>

        {/* Items por página */}
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
            <span className="text-sm">Carregando pacientes...</span>
          </div>
        ) : patients.length === 0 ? (
          <div className="text-center py-16">
            <Users className="w-12 h-12 text-slate-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-slate-400 dark:text-[#71717a]">
              {searchTerm ? `Nenhum paciente encontrado para "${searchTerm}".` : 'Nenhum paciente cadastrado.'}
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-[#0a0a0c] rounded-xl border border-slate-200 dark:border-[#2e2e33] overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-[#18181b] border-b border-slate-200 dark:border-[#2e2e33]">
                  <th className="px-4 py-3 text-xs font-extrabold text-slate-500 dark:text-[#a1a1aa] uppercase w-16">Reg.</th>
                  <th className="px-4 py-3 text-xs font-extrabold text-slate-500 dark:text-[#a1a1aa] uppercase">Nome</th>
                  <th className="px-4 py-3 text-xs font-extrabold text-slate-500 dark:text-[#a1a1aa] uppercase">Telefone</th>
                  <th className="px-4 py-3 text-xs font-extrabold text-slate-500 dark:text-[#a1a1aa] uppercase">Convênio</th>
                  <th className="px-4 py-3 text-xs font-extrabold text-slate-500 dark:text-[#a1a1aa] uppercase">Data nasc.</th>
                  <th className="px-4 py-3 text-xs font-extrabold text-slate-500 dark:text-[#a1a1aa] uppercase">Status</th>
                  <th className="px-4 py-3 text-xs font-extrabold text-slate-500 dark:text-[#a1a1aa] uppercase text-right">Opções</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                {patients.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 text-xs text-slate-400 dark:text-[#71717a] font-mono">#{p.id}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center text-xs font-bold text-teal-700 dark:text-teal-300 flex-shrink-0">
                          {getInitials(p.full_name)}
                        </div>
                        <div>
                          <p className="font-medium text-slate-700 dark:text-gray-200">{p.full_name}</p>
                          {p.cpf && <p className="text-xs text-slate-400 dark:text-[#71717a]">{p.cpf}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {p.phone ? (
                        <div className="flex items-center gap-1.5 text-slate-600 dark:text-[#d4d4d8]">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          {p.phone}
                        </div>
                      ) : (
                        <span className="text-slate-300 dark:text-gray-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-[#d4d4d8]">{p.insurance || '—'}</td>
                    <td className="px-4 py-3">
                      {p.birth_date ? (
                        <div className="flex items-center gap-1.5 text-slate-600 dark:text-[#d4d4d8]">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {formatDate(p.birth_date)}
                        </div>
                      ) : (
                        <span className="text-slate-300 dark:text-gray-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 text-xs font-bold rounded ${
                        p.active !== false
                          ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                          : 'bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                      }`}>
                        {p.active !== false ? 'ATIVO' : 'INATIVO'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => router.push(`/atendimento/agenda/historico/${p.id}`)}
                          title="Histórico"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <div ref={(el) => { menuRefs.current[p.id] = el; }}>
                          <button
                            onClick={() => toggleMenu(p.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
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

      {/* Dropdown de opções */}
      {menuOpenId !== null && menuPosition && (
        <div
          ref={dropdownRef}
          className="fixed z-50 w-44 bg-white dark:bg-[#18181b] rounded-xl shadow-xl border border-slate-200 dark:border-[#2e2e33] py-1 animate-in fade-in-0 zoom-in-95"
          style={{ top: menuPosition.top, left: menuPosition.left }}
        >
          {(() => {
            const patient = patients.find(p => p.id === menuOpenId);
            if (!patient) return null;
            return (
              <>
                <button
                  onClick={() => { onEditPatient(patient); setMenuOpenId(null); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" /> Editar
                </button>
                <button
                  onClick={() => { router.push(`/atendimento/agenda/historico/${patient.id}`); setMenuOpenId(null); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                >
                  <History className="w-3.5 h-3.5" /> Histórico agendamentos
                </button>
                <button
                  onClick={() => { handleToggleActive(patient); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                >
                  {patient.active !== false ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                  {patient.active !== false ? 'Inativar' : 'Ativar'}
                </button>
              </>
            );
          })()}
        </div>
      )}

      {/* Confirm delete */}
      <ConfirmModal
        isOpen={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => { if (confirmDelete) handleDelete(confirmDelete); }}
        title="Excluir paciente"
        message={`Tem certeza que deseja excluir "${confirmDelete?.full_name}"? Esta ação não pode ser desfeita.`}
        confirmText="Excluir"
        type="danger"
      />
    </div>
  );
}
