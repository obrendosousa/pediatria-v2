'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createSchemaClient } from '@/lib/supabase/schemaClient';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import ConfirmModal from '@/components/ui/ConfirmModal';
import {
  ArrowLeft, Search, Filter, Download, Eye, Edit2, MoreVertical,
  Copy, XCircle, ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Calendar, Loader2, X
} from 'lucide-react';

const supabase = createSchemaClient('atendimento');

// ── Constantes ─────────────────────────────────────────────
const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Agendado', confirmed: 'Confirmado', waiting: 'Sala de Espera',
  called: 'Chamado', in_service: 'Em Atendimento', waiting_payment: 'Aguardando Pagamento',
  finished: 'Atendido', late: 'Atrasado', no_show: 'Faltou', cancelled: 'Cancelado',
  unmarked: 'Desmarcado', not_attended: 'Não Atendido', rescheduled: 'Reagendado', blocked: 'Bloqueio'
};

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
  confirmed: 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300',
  waiting: 'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300',
  called: 'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300',
  in_service: 'bg-teal-100 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300',
  waiting_payment: 'bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300',
  finished: 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300',
  late: 'bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300',
  no_show: 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300',
  cancelled: 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300',
  unmarked: 'bg-slate-100 dark:bg-slate-900/20 text-slate-700 dark:text-slate-300',
  not_attended: 'bg-rose-100 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300',
  rescheduled: 'bg-indigo-100 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300',
  blocked: 'bg-gray-100 dark:bg-[#0d0f15]/20 text-gray-700 dark:text-[#a0a8be]'
};

const STATUS_OPTIONS = [
  'scheduled', 'confirmed', 'waiting', 'in_service', 'finished',
  'late', 'no_show', 'cancelled', 'unmarked', 'not_attended', 'rescheduled'
];

const PAGE_SIZES = [10, 25, 50];

type SortField = 'date' | 'patient_name' | 'doctor_name' | 'status';
type SortDir = 'asc' | 'desc';

type AppointmentRow = {
  id: number;
  date: string;
  time: string | null;
  end_time: string | null;
  patient_id: number | null;
  doctor_id: number | null;
  status: string;
  type: string | null;
  description: string | null;
  appointment_subtype: string | null;
  procedures: string[] | null;
  is_teleconsultation: boolean | null;
  patient_name: string | null;
  patient_phone: string | null;
  doctor_name: string | null;
};

export default function GerenciarAgendamentosPage() {
  const router = useRouter();
  const { profile, loading: authLoading } = useAuth();
  const { toast } = useToast();

  // Filtros
  const [patientSearch, setPatientSearch] = useState('');
  const [doctorId, setDoctorId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [procedureFilter, setProcedureFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Dados
  const [doctors, setDoctors] = useState<Array<{ id: number; name: string }>>([]);
  const [procedures, setProcedures] = useState<Array<{ code: string; name: string }>>([]);
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Paginação e ordenação
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Dropdown de ações
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Cancelamento
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<AppointmentRow | null>(null);

  // Status multi-select dropdown
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement>(null);

  // Carregar médicos e procedimentos
  useEffect(() => {
    (async () => {
      const { data: docs } = await supabase.from('doctors').select('id, name').eq('active', true).order('name');
      if (docs) setDoctors(docs);
    })();
    (async () => {
      const res = await fetch('/api/tuss/search?q=&limit=30');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setProcedures(data.map((p: { code: string; name: string }) => ({ code: p.code, name: p.name })));
      }
    })();
  }, []);

  // Fechar menus ao clicar fora
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenuId(null);
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) setStatusDropdownOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    setHasSearched(true);
    try {
      let query = supabase
        .from('appointments')
        .select('id, date, time, end_time, patient_id, doctor_id, status, type, description, appointment_subtype, procedures, is_teleconsultation, patients:patient_id(full_name, phone)', { count: 'exact' });

      // Filtros
      if (patientSearch.trim()) {
        query = query.ilike('patients.full_name', `%${patientSearch.trim()}%`);
      }
      if (doctorId) {
        query = query.eq('doctor_id', doctorId);
      }
      if (statusFilter.length > 0) {
        query = query.in('status', statusFilter);
      }
      if (dateFrom) {
        query = query.gte('date', dateFrom);
      }
      if (dateTo) {
        query = query.lte('date', dateTo);
      }
      if (procedureFilter) {
        query = query.contains('procedures', [procedureFilter]);
      }

      // Ordenação
      if (sortField === 'date') {
        query = query.order('date', { ascending: sortDir === 'asc' }).order('time', { ascending: sortDir === 'asc' });
      } else if (sortField === 'status') {
        query = query.order('status', { ascending: sortDir === 'asc' });
      } else {
        query = query.order('date', { ascending: false });
      }

      // Paginação
      const from = page * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;
      if (error) throw error;

      // Buscar nomes dos médicos
      const doctorIds = [...new Set((data || []).map(a => a.doctor_id).filter(Boolean))] as number[];
      let doctorMap: Record<number, string> = {};
      if (doctorIds.length > 0) {
        const { data: docData } = await supabase.from('doctors').select('id, name').in('id', doctorIds);
        if (docData) doctorMap = Object.fromEntries(docData.map(d => [d.id, d.name]));
      }

      const rows: AppointmentRow[] = (data || []).map((a: Record<string, unknown>) => {
        const patient = a.patients as Record<string, unknown> | null;
        return {
          id: a.id as number,
          date: a.date as string,
          time: a.time as string | null,
          end_time: a.end_time as string | null,
          patient_id: a.patient_id as number | null,
          doctor_id: a.doctor_id as number | null,
          status: a.status as string,
          type: a.type as string | null,
          description: a.description as string | null,
          appointment_subtype: a.appointment_subtype as string | null,
          procedures: a.procedures as string[] | null,
          is_teleconsultation: a.is_teleconsultation as boolean | null,
          patient_name: patient?.full_name as string | null ?? null,
          patient_phone: patient?.phone as string | null ?? null,
          doctor_name: (a.doctor_id && doctorMap[a.doctor_id as number]) ? doctorMap[a.doctor_id as number] : null
        };
      });

      // Filtro local de paciente (para join ilike que pode não funcionar via PostgREST)
      const filtered = patientSearch.trim()
        ? rows.filter(r => r.patient_name?.toLowerCase().includes(patientSearch.trim().toLowerCase()))
        : rows;

      setAppointments(filtered);
      setTotalCount(count ?? 0);
    } catch (err: unknown) {
      toast.error('Erro ao buscar agendamentos: ' + (err instanceof Error ? err.message : 'Tente novamente.'));
    } finally {
      setLoading(false);
    }
  }, [patientSearch, doctorId, statusFilter, dateFrom, dateTo, procedureFilter, page, pageSize, sortField, sortDir, toast]);

  const handleSearch = () => {
    setPage(0);
    fetchAppointments();
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  // Re-fetch quando muda paginação/ordenação (apenas se já pesquisou)
  useEffect(() => {
    if (hasSearched) fetchAppointments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, sortField, sortDir]);

  const handleCancelAppointment = async () => {
    if (!cancelTarget) return;
    try {
      const { error } = await supabase.from('appointments').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('id', cancelTarget.id);
      if (error) throw error;

      await supabase.from('appointment_status_log').insert({
        appointment_id: cancelTarget.id,
        old_status: cancelTarget.status,
        new_status: 'cancelled',
        changed_by: profile?.full_name || 'Sistema',
        notes: 'Cancelamento via gerenciamento'
      });

      toast.success('Agendamento cancelado.');
      setConfirmCancel(false);
      setCancelTarget(null);
      fetchAppointments();
    } catch (err: unknown) {
      toast.error('Erro ao cancelar: ' + (err instanceof Error ? err.message : ''));
    }
  };

  const handleClone = async (appt: AppointmentRow) => {
    try {
      const cloneData: Record<string, unknown> = {
        patient_id: appt.patient_id, doctor_id: appt.doctor_id, date: appt.date,
        time: appt.time, end_time: appt.end_time, type: appt.type, status: 'scheduled',
        description: appt.description, appointment_subtype: appt.appointment_subtype,
        procedures: appt.procedures, is_teleconsultation: appt.is_teleconsultation,
        scheduled_by: profile?.full_name || 'Sistema'
      };
      const { data, error } = await supabase.from('appointments').insert(cloneData).select('id').single();
      if (error) throw error;
      toast.success('Agendamento clonado!');
      if (data) router.push(`/atendimento/agenda/${data.id}`);
    } catch (err: unknown) {
      toast.error('Erro ao clonar: ' + (err instanceof Error ? err.message : ''));
    }
  };

  const handleExportPdf = async () => {
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const margin = 14;
    let y = 20;

    doc.setFontSize(16);
    doc.text('Agendamentos — Atendimento Geral', margin, y);
    y += 10;

    doc.setFontSize(8);
    const filters: string[] = [];
    if (patientSearch) filters.push(`Paciente: ${patientSearch}`);
    if (doctorId) {
      const doc2 = doctors.find(d => d.id === doctorId);
      if (doc2) filters.push(`Profissional: ${doc2.name}`);
    }
    if (statusFilter.length > 0) filters.push(`Status: ${statusFilter.map(s => STATUS_LABELS[s] || s).join(', ')}`);
    if (dateFrom) filters.push(`De: ${dateFrom}`);
    if (dateTo) filters.push(`Até: ${dateTo}`);
    if (filters.length > 0) {
      doc.text(`Filtros: ${filters.join(' | ')}`, margin, y);
      y += 6;
    }
    doc.text(`Total: ${totalCount} registros`, margin, y);
    y += 8;

    // Cabeçalho da tabela
    const cols = [
      { label: 'Paciente', w: 60 },
      { label: 'Descrição', w: 70 },
      { label: 'Profissional', w: 50 },
      { label: 'Status', w: 30 },
      { label: 'Data', w: 35 },
      { label: 'Hora', w: 25 }
    ];

    doc.setFillColor(240, 240, 240);
    doc.rect(margin, y - 4, cols.reduce((a, c) => a + c.w, 0), 7, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    let xPos = margin;
    cols.forEach(col => {
      doc.text(col.label, xPos + 2, y);
      xPos += col.w;
    });
    y += 7;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);

    for (const appt of appointments) {
      if (y > 190) {
        doc.addPage();
        y = 20;
      }
      xPos = margin;
      const rowData = [
        appt.patient_name || '—',
        appt.description || appt.procedures?.join(', ') || '—',
        appt.doctor_name || '—',
        STATUS_LABELS[appt.status] || appt.status,
        appt.date ? new Date(appt.date + 'T12:00:00').toLocaleDateString('pt-BR') : '—',
        appt.time?.slice(0, 5) || '—'
      ];
      cols.forEach((col, i) => {
        const text = (rowData[i] || '').substring(0, Math.floor(col.w / 2));
        doc.text(text, xPos + 2, y);
        xPos += col.w;
      });
      y += 5;
    }

    doc.save('agendamentos.pdf');
    toast.success('PDF exportado!');
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  const formatDate = (d: string) => {
    if (!d) return '—';
    return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR');
  };

  const toggleStatusFilter = (s: string) => {
    setStatusFilter(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-[#16171c]">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#16171c] transition-colors">
      {/* Header */}
      <div className="h-16 px-6 flex items-center justify-between bg-white dark:bg-[#0d0f15] border-b border-slate-100 dark:border-[#1e2334] shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/atendimento/agenda')} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg text-slate-400 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="p-2 bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-300 rounded-lg">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-800 dark:text-[#e8ecf4] leading-none">Gerenciar Agendamentos</h1>
            <p className="text-xs text-slate-500 dark:text-[#828ca5] mt-0.5">Atendimento Geral</p>
          </div>
        </div>
        <button
          onClick={handleExportPdf}
          disabled={appointments.length === 0}
          className="flex items-center gap-2 bg-slate-100 dark:bg-[#141722] hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-gray-200 px-4 py-2 rounded-lg text-xs font-bold transition-colors disabled:opacity-40"
        >
          <Download className="w-4 h-4" /> Exportar PDF
        </button>
      </div>

      {/* Filtros */}
      <div className="px-6 py-4">
        <div className="bg-white dark:bg-[#0d0f15] rounded-xl border border-slate-200 dark:border-[#1e2334] p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-teal-500" />
            <span className="text-sm font-bold text-slate-700 dark:text-gray-200">Filtros</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            {/* Paciente */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-[#828ca5] mb-1">Paciente</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={patientSearch}
                  onChange={e => setPatientSearch(e.target.value)}
                  placeholder="Buscar por nome..."
                  className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 dark:border-[#252a3a] rounded-lg bg-white dark:bg-[#141722] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-teal-400 placeholder:text-slate-400"
                />
              </div>
            </div>

            {/* Profissional */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-[#828ca5] mb-1">Profissional</label>
              <select
                value={doctorId ?? ''}
                onChange={e => setDoctorId(e.target.value ? Number(e.target.value) : null)}
                className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-[#252a3a] rounded-lg bg-white dark:bg-[#141722] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-teal-400"
              >
                <option value="">Todos</option>
                {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>

            {/* Status Multi-Select */}
            <div ref={statusDropdownRef} className="relative">
              <label className="block text-[11px] font-bold text-slate-500 dark:text-[#828ca5] mb-1">Status</label>
              <button
                type="button"
                onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
                className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-[#252a3a] rounded-lg bg-white dark:bg-[#141722] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-teal-400 text-left flex items-center justify-between"
              >
                <span className="truncate">
                  {statusFilter.length === 0
                    ? 'Todos'
                    : statusFilter.length === 1
                      ? STATUS_LABELS[statusFilter[0]] || statusFilter[0]
                      : `${statusFilter.length} selecionados`
                  }
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </button>
              {statusDropdownOpen && (
                <div className="absolute z-50 mt-1 w-full bg-white dark:bg-[#0d0f15] border border-slate-200 dark:border-[#252a3a] rounded-lg shadow-lg max-h-56 overflow-y-auto">
                  <button
                    type="button"
                    onClick={() => setStatusFilter([])}
                    className="w-full px-3 py-1.5 text-xs text-left hover:bg-slate-50 dark:hover:bg-white/5 text-teal-600 dark:text-teal-400 font-bold border-b border-slate-100 dark:border-[#1e2334]"
                  >
                    Limpar seleção
                  </button>
                  {STATUS_OPTIONS.map(s => (
                    <label key={s} className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={statusFilter.includes(s)}
                        onChange={() => toggleStatusFilter(s)}
                        className="rounded border-slate-300 text-teal-500 focus:ring-teal-400"
                      />
                      <span className="text-xs text-slate-700 dark:text-gray-200">{STATUS_LABELS[s] || s}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Procedimento */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-[#828ca5] mb-1">Procedimento</label>
              <select
                value={procedureFilter}
                onChange={e => setProcedureFilter(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-[#252a3a] rounded-lg bg-white dark:bg-[#141722] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-teal-400"
              >
                <option value="">Todos</option>
                {procedures.map(p => <option key={p.code} value={p.code}>{p.code} — {p.name}</option>)}
              </select>
            </div>

            {/* De */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-[#828ca5] mb-1">De</label>
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-[#252a3a] rounded-lg bg-white dark:bg-[#141722] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-teal-400"
              />
            </div>

            {/* Até */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-[#828ca5] mb-1">Até</label>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-[#252a3a] rounded-lg bg-white dark:bg-[#141722] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-teal-400"
              />
            </div>
          </div>

          <div className="flex items-center justify-between mt-4">
            <button
              onClick={() => { setPatientSearch(''); setDoctorId(null); setStatusFilter([]); setProcedureFilter(''); setDateFrom(''); setDateTo(''); }}
              className="text-xs text-slate-500 dark:text-[#828ca5] hover:text-slate-700 dark:hover:text-gray-200 font-medium flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" /> Limpar filtros
            </button>
            <button
              onClick={handleSearch}
              className="flex items-center gap-2 bg-teal-500 hover:bg-teal-600 text-white px-5 py-2 rounded-lg text-xs font-bold shadow-md active:scale-95 transition-all"
            >
              <Search className="w-4 h-4" /> Pesquisar
            </button>
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="px-6 pb-6">
        <div className="bg-white dark:bg-[#0d0f15] rounded-xl border border-slate-200 dark:border-[#1e2334] shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-teal-500" />
              <span className="ml-2 text-sm text-slate-500 dark:text-[#828ca5]">Buscando agendamentos...</span>
            </div>
          ) : !hasSearched ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-[#565d73]">
              <Search className="w-10 h-10 mb-3 opacity-40" />
              <p className="text-sm font-medium">Utilize os filtros acima e clique em Pesquisar</p>
            </div>
          ) : appointments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-[#565d73]">
              <Calendar className="w-10 h-10 mb-3 opacity-40" />
              <p className="text-sm font-medium">Nenhum agendamento encontrado</p>
              <p className="text-xs mt-1">Tente ajustar os filtros</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-[#1e2334] bg-slate-50 dark:bg-[#16171c]">
                      <SortableHeader label="Paciente" field="patient_name" current={sortField} dir={sortDir} onSort={handleSort} />
                      <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 dark:text-[#828ca5] uppercase tracking-wider">Descrição</th>
                      <SortableHeader label="Profissional" field="doctor_name" current={sortField} dir={sortDir} onSort={handleSort} />
                      <SortableHeader label="Status" field="status" current={sortField} dir={sortDir} onSort={handleSort} />
                      <SortableHeader label="Data" field="date" current={sortField} dir={sortDir} onSort={handleSort} />
                      <th className="px-4 py-3 text-center text-[11px] font-bold text-slate-500 dark:text-[#828ca5] uppercase tracking-wider">Opções</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                    {appointments.map(appt => (
                      <tr key={appt.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-slate-800 dark:text-gray-200 truncate max-w-[200px]">{appt.patient_name || '—'}</p>
                          {appt.patient_phone && (
                            <p className="text-[11px] text-slate-400 dark:text-[#565d73]">{appt.patient_phone}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-xs text-slate-600 dark:text-[#a0a8be] truncate max-w-[220px]">
                            {appt.description || appt.procedures?.join(', ') || appt.type || '—'}
                          </p>
                          {appt.appointment_subtype && (
                            <p className="text-[11px] text-slate-400 dark:text-[#565d73]">{appt.appointment_subtype}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-700 dark:text-[#a0a8be]">{appt.doctor_name || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${STATUS_COLORS[appt.status] || 'bg-slate-100 text-slate-600'}`}>
                            {STATUS_LABELS[appt.status] || appt.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-xs font-medium text-slate-700 dark:text-[#a0a8be]">{formatDate(appt.date)}</p>
                          {appt.time && (
                            <p className="text-[11px] text-slate-400 dark:text-[#565d73]">
                              {appt.time.slice(0, 5)}{appt.end_time ? ` — ${appt.end_time.slice(0, 5)}` : ''}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1 relative" ref={openMenuId === appt.id ? menuRef : undefined}>
                            <button
                              onClick={() => router.push(`/atendimento/agenda/${appt.id}`)}
                              className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-md text-slate-400 hover:text-teal-600 transition-colors"
                              title="Visualizar"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => router.push(`/atendimento/agenda/${appt.id}?edit=true`)}
                              className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-md text-slate-400 hover:text-blue-600 transition-colors"
                              title="Editar"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setOpenMenuId(openMenuId === appt.id ? null : appt.id)}
                              className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-md text-slate-400 transition-colors"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {openMenuId === appt.id && (
                              <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-[#0d0f15] border border-slate-200 dark:border-[#252a3a] rounded-lg shadow-lg z-50 py-1">
                                <button
                                  onClick={() => { setOpenMenuId(null); handleClone(appt); }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-white/5"
                                >
                                  <Copy className="w-3.5 h-3.5" /> Clonar
                                </button>
                                {appt.status !== 'cancelled' && (
                                  <button
                                    onClick={() => { setOpenMenuId(null); setCancelTarget(appt); setConfirmCancel(true); }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10"
                                  >
                                    <XCircle className="w-3.5 h-3.5" /> Cancelar
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Rodapé: total + paginação */}
              <div className="px-4 py-3 border-t border-slate-100 dark:border-[#1e2334] flex flex-col sm:flex-row items-center justify-between gap-3">
                <span className="text-xs text-slate-500 dark:text-[#828ca5]">
                  Foram encontrados um total de <strong className="text-slate-700 dark:text-gray-200">{totalCount}</strong> registros.
                </span>

                <div className="flex items-center gap-4">
                  {/* Itens por página */}
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-500 dark:text-[#828ca5]">Por página:</span>
                    {PAGE_SIZES.map(s => (
                      <button
                        key={s}
                        onClick={() => { setPageSize(s); setPage(0); }}
                        className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${pageSize === s ? 'bg-teal-100 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300' : 'text-slate-400 hover:text-slate-600 dark:hover:text-gray-300'}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>

                  {/* Navegação */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage(p => Math.max(0, p - 1))}
                      disabled={page === 0}
                      className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-md text-slate-400 disabled:opacity-30 transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs text-slate-600 dark:text-[#a0a8be] font-medium min-w-[80px] text-center">
                      {page + 1} de {totalPages || 1}
                    </span>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                      disabled={page >= totalPages - 1}
                      className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-md text-slate-400 disabled:opacity-30 transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal de confirmação de cancelamento */}
      <ConfirmModal
        isOpen={confirmCancel}
        onClose={() => { setConfirmCancel(false); setCancelTarget(null); }}
        onConfirm={handleCancelAppointment}
        title="Cancelar agendamento"
        message={cancelTarget ? `Cancelar agendamento de ${cancelTarget.patient_name || 'este paciente'}?` : ''}
        type="danger"
        confirmText="Sim, cancelar"
      />
    </div>
  );
}

// ── Componente auxiliar: cabeçalho ordenável ─────────────────
function SortableHeader({ label, field, current, dir, onSort }: {
  label: string; field: SortField; current: SortField; dir: SortDir; onSort: (f: SortField) => void;
}) {
  const active = current === field;
  return (
    <th
      onClick={() => onSort(field)}
      className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 dark:text-[#828ca5] uppercase tracking-wider cursor-pointer hover:text-slate-700 dark:hover:text-gray-200 select-none"
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active ? (dir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : <ChevronDown className="w-3 h-3 opacity-30" />}
      </span>
    </th>
  );
}
