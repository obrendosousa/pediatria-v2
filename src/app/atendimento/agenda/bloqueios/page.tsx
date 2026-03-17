'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createSchemaClient } from '@/lib/supabase/schemaClient';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import ConfirmModal from '@/components/ui/ConfirmModal';
import {
  ArrowLeft, Plus, Filter, Trash2, Loader2,
  ChevronLeft, ChevronRight, X, Save, Clock, Ban
} from 'lucide-react';

const supabase = createSchemaClient('atendimento');

type ScheduleBlock = {
  id: number;
  doctor_id: number | null;
  title: string;
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  all_day: boolean;
  recurrence: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  doctor_name?: string;
};

const RECURRENCE_LABELS: Record<string, string> = {
  none: 'Sem recorrência',
  daily: 'Diário',
  weekly: 'Semanal',
  monthly: 'Mensal'
};

const PAGE_SIZES = [10, 25, 50];

export default function BloqueiosPage() {
  const router = useRouter();
  const { profile, loading: authLoading } = useAuth();
  const { toast } = useToast();

  // Filtros
  const [doctorFilter, setDoctorFilter] = useState<number | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Dados
  const [doctors, setDoctors] = useState<Array<{ id: number; name: string }>>([]);
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Paginação
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  // Seleção múltipla
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // Modal adicionar
  const [modalOpen, setModalOpen] = useState(false);

  // Modal confirmar exclusão
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  // Cancelamento em lote
  const [confirmBatchDelete, setConfirmBatchDelete] = useState(false);

  // Carregar médicos
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('doctors').select('id, name').eq('active', true).order('name');
      if (data) setDoctors(data);
    })();
  }, []);

  const fetchBlocks = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('schedule_blocks')
        .select('*', { count: 'exact' })
        .order('start_date', { ascending: false })
        .order('start_time', { ascending: true });

      if (doctorFilter) query = query.eq('doctor_id', doctorFilter);
      if (dateFrom) query = query.gte('start_date', dateFrom);
      if (dateTo) query = query.lte('end_date', dateTo);

      const from = page * pageSize;
      query = query.range(from, from + pageSize - 1);

      const { data, count, error } = await query;
      if (error) throw error;

      // Buscar nomes dos médicos
      const doctorIds = [...new Set((data || []).map(b => b.doctor_id).filter(Boolean))] as number[];
      let doctorMap: Record<number, string> = {};
      if (doctorIds.length > 0) {
        const { data: docData } = await supabase.from('doctors').select('id, name').in('id', doctorIds);
        if (docData) doctorMap = Object.fromEntries(docData.map(d => [d.id, d.name]));
      }

      const rows: ScheduleBlock[] = (data || []).map(b => ({
        ...b,
        doctor_name: b.doctor_id ? doctorMap[b.doctor_id] || null : null
      }));

      setBlocks(rows);
      setTotalCount(count ?? 0);
      setSelected(new Set());
    } catch (err: unknown) {
      toast.error('Erro ao buscar bloqueios: ' + (err instanceof Error ? err.message : ''));
    } finally {
      setLoading(false);
    }
  }, [doctorFilter, dateFrom, dateTo, page, pageSize, toast]);

  useEffect(() => {
    fetchBlocks();
  }, [fetchBlocks]);

  const handleDeleteSingle = async () => {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase.from('schedule_blocks').delete().eq('id', deleteTarget);
      if (error) throw error;
      toast.success('Bloqueio removido.');
      setConfirmDeleteOpen(false);
      setDeleteTarget(null);
      fetchBlocks();
    } catch (err: unknown) {
      toast.error('Erro ao remover: ' + (err instanceof Error ? err.message : ''));
    }
  };

  const handleDeleteBatch = async () => {
    if (selected.size === 0) return;
    try {
      const { error } = await supabase.from('schedule_blocks').delete().in('id', [...selected]);
      if (error) throw error;
      toast.success(`${selected.size} bloqueio(s) removido(s).`);
      setConfirmBatchDelete(false);
      setSelected(new Set());
      fetchBlocks();
    } catch (err: unknown) {
      toast.error('Erro ao remover: ' + (err instanceof Error ? err.message : ''));
    }
  };

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === blocks.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(blocks.map(b => b.id)));
    }
  };

  const formatDate = (d: string) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—';

  const totalPages = Math.ceil(totalCount / pageSize);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-[#16171c]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#16171c] transition-colors">
      {/* Header */}
      <div className="h-16 px-6 flex items-center justify-between bg-white dark:bg-[#08080b] border-b border-slate-100 dark:border-[#2d2d36] shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/atendimento/agenda')} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg text-slate-400 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="p-2 bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 rounded-lg">
            <Ban className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-800 dark:text-[#fafafa] leading-none">Bloqueios de Agenda</h1>
            <p className="text-xs text-slate-500 dark:text-[#a1a1aa] mt-0.5">Atendimento Geral</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setConfirmBatchDelete(true)}
            disabled={selected.size === 0}
            className="flex items-center gap-2 bg-slate-100 dark:bg-[#1c1c21] hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 dark:text-[#a1a1aa] px-3 py-2 rounded-lg text-xs font-bold transition-colors disabled:opacity-40"
          >
            <Trash2 className="w-3.5 h-3.5" /> Cancelar Bloqueios ({selected.size})
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" /> Adicionar
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="px-6 py-4">
        <div className="bg-white dark:bg-[#08080b] rounded-xl border border-slate-200 dark:border-[#2d2d36] p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-bold text-slate-700 dark:text-gray-200">Filtros</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-[#a1a1aa] mb-1">Profissional</label>
              <select
                value={doctorFilter ?? ''}
                onChange={e => { setDoctorFilter(e.target.value ? Number(e.target.value) : null); setPage(0); }}
                className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-[#3d3d48] rounded-lg bg-white dark:bg-[#1c1c21] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                <option value="">Todos</option>
                {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-[#a1a1aa] mb-1">De</label>
              <input
                type="date"
                value={dateFrom}
                onChange={e => { setDateFrom(e.target.value); setPage(0); }}
                className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-[#3d3d48] rounded-lg bg-white dark:bg-[#1c1c21] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-[#a1a1aa] mb-1">Até</label>
              <input
                type="date"
                value={dateTo}
                onChange={e => { setDateTo(e.target.value); setPage(0); }}
                className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-[#3d3d48] rounded-lg bg-white dark:bg-[#1c1c21] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
          </div>
          {(doctorFilter || dateFrom || dateTo) && (
            <button
              onClick={() => { setDoctorFilter(null); setDateFrom(''); setDateTo(''); setPage(0); }}
              className="mt-3 text-xs text-slate-500 dark:text-[#a1a1aa] hover:text-slate-700 dark:hover:text-gray-200 font-medium flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" /> Limpar filtros
            </button>
          )}
        </div>
      </div>

      {/* Tabela */}
      <div className="px-6 pb-6">
        <div className="bg-white dark:bg-[#08080b] rounded-xl border border-slate-200 dark:border-[#2d2d36] shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              <span className="ml-2 text-sm text-slate-500 dark:text-[#a1a1aa]">Buscando bloqueios...</span>
            </div>
          ) : blocks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-[#71717a]">
              <Ban className="w-10 h-10 mb-3 opacity-40" />
              <p className="text-sm font-medium">Nenhum bloqueio cadastrado</p>
              <p className="text-xs mt-1">Clique em &quot;Adicionar&quot; para criar um bloqueio</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-[#2d2d36] bg-slate-50 dark:bg-[#16171c]">
                      <th className="px-4 py-3 w-[40px]">
                        <input
                          type="checkbox"
                          checked={selected.size === blocks.length && blocks.length > 0}
                          onChange={toggleSelectAll}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-400"
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 dark:text-[#a1a1aa] uppercase tracking-wider w-[60px]">ID</th>
                      <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 dark:text-[#a1a1aa] uppercase tracking-wider">Profissional</th>
                      <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 dark:text-[#a1a1aa] uppercase tracking-wider">Título</th>
                      <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 dark:text-[#a1a1aa] uppercase tracking-wider">Data Inicial</th>
                      <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 dark:text-[#a1a1aa] uppercase tracking-wider">Data Final</th>
                      <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 dark:text-[#a1a1aa] uppercase tracking-wider">Horário</th>
                      <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 dark:text-[#a1a1aa] uppercase tracking-wider">Recorrência</th>
                      <th className="px-4 py-3 text-center text-[11px] font-bold text-slate-500 dark:text-[#a1a1aa] uppercase tracking-wider w-[80px]">Opções</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                    {blocks.map(block => (
                      <tr key={block.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selected.has(block.id)}
                            onChange={() => toggleSelect(block.id)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-400"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-mono text-slate-400 dark:text-[#71717a]">#{block.id}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-700 dark:text-[#d4d4d8]">{block.doctor_name || 'Todos'}</td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-slate-800 dark:text-gray-200 truncate max-w-[200px]">{block.title}</p>
                          {block.notes && <p className="text-[11px] text-slate-400 dark:text-[#71717a] truncate max-w-[200px]">{block.notes}</p>}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-700 dark:text-[#d4d4d8]">{formatDate(block.start_date)}</td>
                        <td className="px-4 py-3 text-xs text-slate-700 dark:text-[#d4d4d8]">{formatDate(block.end_date)}</td>
                        <td className="px-4 py-3">
                          {block.all_day ? (
                            <span className="text-xs text-slate-500 dark:text-[#a1a1aa] italic">Dia inteiro</span>
                          ) : (
                            <span className="text-xs text-slate-700 dark:text-[#d4d4d8]">
                              {block.start_time?.slice(0, 5) || '—'} — {block.end_time?.slice(0, 5) || '—'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${block.recurrence === 'none' ? 'bg-slate-100 dark:bg-slate-900/20 text-slate-600 dark:text-slate-400' : 'bg-indigo-100 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300'}`}>
                            {RECURRENCE_LABELS[block.recurrence] || block.recurrence}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => { setDeleteTarget(block.id); setConfirmDeleteOpen(true); }}
                            className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-md text-slate-400 hover:text-red-500 transition-colors"
                            title="Remover bloqueio"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Rodapé: total + paginação */}
              <div className="px-4 py-3 border-t border-slate-100 dark:border-[#2d2d36] flex flex-col sm:flex-row items-center justify-between gap-3">
                <span className="text-xs text-slate-500 dark:text-[#a1a1aa]">
                  Total de <strong className="text-slate-700 dark:text-gray-200">{totalCount}</strong> bloqueio(s).
                </span>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-500 dark:text-[#a1a1aa]">Por página:</span>
                    {PAGE_SIZES.map(s => (
                      <button
                        key={s}
                        onClick={() => { setPageSize(s); setPage(0); }}
                        className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${pageSize === s ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' : 'text-slate-400 hover:text-slate-600 dark:hover:text-gray-300'}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-md text-slate-400 disabled:opacity-30 transition-colors">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs text-slate-600 dark:text-[#d4d4d8] font-medium min-w-[80px] text-center">{page + 1} de {totalPages || 1}</span>
                    <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-md text-slate-400 disabled:opacity-30 transition-colors">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal Adicionar Bloqueio */}
      {modalOpen && (
        <AddBlockModal
          doctors={doctors}
          profile={profile}
          onClose={() => setModalOpen(false)}
          onSuccess={() => { setModalOpen(false); fetchBlocks(); }}
        />
      )}

      {/* Confirmar exclusão individual */}
      <ConfirmModal
        isOpen={confirmDeleteOpen}
        onClose={() => { setConfirmDeleteOpen(false); setDeleteTarget(null); }}
        onConfirm={handleDeleteSingle}
        title="Remover bloqueio"
        message="Deseja remover este bloqueio de agenda?"
        type="danger"
        confirmText="Sim, remover"
      />

      {/* Confirmar exclusão em lote */}
      <ConfirmModal
        isOpen={confirmBatchDelete}
        onClose={() => setConfirmBatchDelete(false)}
        onConfirm={handleDeleteBatch}
        title="Remover bloqueios selecionados"
        message={`Deseja remover ${selected.size} bloqueio(s) selecionado(s)?`}
        type="danger"
        confirmText="Sim, remover todos"
      />
    </div>
  );
}

// ── Modal Adicionar Bloqueio ────────────────────────────────
function AddBlockModal({ doctors, profile, onClose, onSuccess }: {
  doctors: Array<{ id: number; name: string }>;
  profile: { full_name?: string | null; doctor_id?: number | null } | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [blockType, setBlockType] = useState<'simple' | 'recurring'>('simple');
  const [form, setForm] = useState({
    doctor_id: '' as string,
    title: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    start_time: '07:00',
    end_time: '07:30',
    all_day: false,
    recurrence: 'none',
    notes: ''
  });

  const handleSubmit = async () => {
    if (!form.title.trim()) { toast.error('Preencha a descrição.'); return; }
    if (!form.start_date || !form.end_date) { toast.error('Preencha as datas.'); return; }
    if (!form.all_day && (!form.start_time || !form.end_time)) { toast.error('Preencha os horários.'); return; }
    if (form.end_date < form.start_date) { toast.error('Data final deve ser igual ou posterior a data inicial.'); return; }
    if (!form.all_day && form.start_time >= form.end_time) { toast.error('Horario final deve ser posterior ao inicial.'); return; }

    setSaving(true);
    try {
      const insertData: Record<string, unknown> = {
        doctor_id: form.doctor_id ? Number(form.doctor_id) : null,
        title: form.title.trim(),
        start_date: form.start_date,
        end_date: form.end_date,
        start_time: form.all_day ? null : form.start_time,
        end_time: form.all_day ? null : form.end_time,
        all_day: form.all_day,
        recurrence: blockType === 'recurring' ? form.recurrence : 'none',
        notes: form.notes.trim() || null,
        created_by: profile?.full_name || 'Sistema'
      };

      const { error } = await supabase.from('schedule_blocks').insert(insertData);
      if (error) throw error;
      toast.success('Bloqueio adicionado!');
      onSuccess();
    } catch (err: unknown) {
      toast.error('Erro ao salvar: ' + (err instanceof Error ? err.message : ''));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-white dark:bg-[#08080b] rounded-2xl border border-slate-200 dark:border-[#2d2d36] shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-[#2d2d36] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 rounded-lg">
              <Ban className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold text-slate-800 dark:text-[#fafafa]">Adicionar Bloqueio</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg text-slate-400 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tipo */}
        <div className="px-6 pt-4">
          <div className="flex bg-slate-100 dark:bg-[#1c1c21] p-1 rounded-lg">
            <button
              onClick={() => setBlockType('simple')}
              className={`flex-1 py-2 rounded-md text-xs font-bold transition-all ${blockType === 'simple' ? 'bg-white dark:bg-gray-600 shadow text-slate-800 dark:text-white' : 'text-slate-400 dark:text-[#71717a]'}`}
            >
              Simples
            </button>
            <button
              onClick={() => setBlockType('recurring')}
              className={`flex-1 py-2 rounded-md text-xs font-bold transition-all ${blockType === 'recurring' ? 'bg-white dark:bg-gray-600 shadow text-slate-800 dark:text-white' : 'text-slate-400 dark:text-[#71717a]'}`}
            >
              Recorrente
            </button>
          </div>
        </div>

        {/* Campos */}
        <div className="px-6 py-4 space-y-4">
          {/* Profissional */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-[#a1a1aa] mb-1">Profissional *</label>
            <select
              value={form.doctor_id}
              onChange={e => setForm(prev => ({ ...prev, doctor_id: e.target.value }))}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 dark:border-[#3d3d48] rounded-lg bg-white dark:bg-[#1c1c21] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400/20 focus:border-blue-400"
            >
              <option value="">Todos os profissionais</option>
              {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-[#a1a1aa] mb-1">Descrição *</label>
            <input
              type="text"
              value={form.title}
              onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Ex: Feriado, Reunião, Férias..."
              className="w-full px-3 py-2.5 text-sm border border-slate-200 dark:border-[#3d3d48] rounded-lg bg-white dark:bg-[#1c1c21] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400/20 focus:border-blue-400 placeholder:text-slate-400"
            />
          </div>

          {/* Datas */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-[#a1a1aa] mb-1">Início *</label>
              <input
                type="date"
                value={form.start_date}
                onChange={e => setForm(prev => ({ ...prev, start_date: e.target.value }))}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 dark:border-[#3d3d48] rounded-lg bg-white dark:bg-[#1c1c21] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400/20 focus:border-blue-400"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-[#a1a1aa] mb-1">Término *</label>
              <input
                type="date"
                value={form.end_date}
                onChange={e => setForm(prev => ({ ...prev, end_date: e.target.value }))}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 dark:border-[#3d3d48] rounded-lg bg-white dark:bg-[#1c1c21] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400/20 focus:border-blue-400"
              />
            </div>
          </div>

          {/* Dia inteiro */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.all_day}
              onChange={e => setForm(prev => ({ ...prev, all_day: e.target.checked }))}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-400"
            />
            <span className="text-xs font-medium text-slate-700 dark:text-gray-200">Dia inteiro</span>
          </label>

          {/* Horários */}
          {!form.all_day && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-[#a1a1aa] mb-1">Horário Inicial *</label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="time"
                    value={form.start_time}
                    onChange={e => setForm(prev => ({ ...prev, start_time: e.target.value }))}
                    className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 dark:border-[#3d3d48] rounded-lg bg-white dark:bg-[#1c1c21] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400/20 focus:border-blue-400"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-[#a1a1aa] mb-1">Horário Final *</label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="time"
                    value={form.end_time}
                    onChange={e => setForm(prev => ({ ...prev, end_time: e.target.value }))}
                    className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 dark:border-[#3d3d48] rounded-lg bg-white dark:bg-[#1c1c21] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400/20 focus:border-blue-400"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Recorrência (só no modo recorrente) */}
          {blockType === 'recurring' && (
            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-[#a1a1aa] mb-1">Recorrência</label>
              <select
                value={form.recurrence}
                onChange={e => setForm(prev => ({ ...prev, recurrence: e.target.value }))}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 dark:border-[#3d3d48] rounded-lg bg-white dark:bg-[#1c1c21] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400/20 focus:border-blue-400"
              >
                <option value="daily">Diário</option>
                <option value="weekly">Semanal</option>
                <option value="monthly">Mensal</option>
              </select>
            </div>
          )}

          {/* Observações */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-[#a1a1aa] mb-1">Observações</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
              rows={3}
              placeholder="Notas adicionais..."
              className="w-full px-3 py-2.5 text-sm border border-slate-200 dark:border-[#3d3d48] rounded-lg bg-white dark:bg-[#1c1c21] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400/20 focus:border-blue-400 placeholder:text-slate-400 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-[#2d2d36] flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-gray-500 dark:text-[#a1a1aa] hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg text-sm font-bold transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-bold shadow-md active:scale-95 transition-all disabled:opacity-50"
          >
            {saving ? <><Loader2 size={16} className="animate-spin" /> Salvando...</> : <><Save size={16} /> Salvar</>}
          </button>
        </div>
      </div>
    </div>
  );
}
