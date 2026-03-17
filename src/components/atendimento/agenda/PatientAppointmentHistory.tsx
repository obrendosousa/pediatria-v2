'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createSchemaClient } from '@/lib/supabase/schemaClient';
import { useToast } from '@/contexts/ToastContext';
import {
  Search, Filter, Download, Eye, Edit2, ChevronLeft, ChevronRight,
  ChevronDown, ChevronUp, Calendar, Loader2, X
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
  in_service: 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
  waiting_payment: 'bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300',
  finished: 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300',
  late: 'bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300',
  no_show: 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300',
  cancelled: 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300',
  unmarked: 'bg-slate-100 dark:bg-slate-900/20 text-slate-700 dark:text-slate-300',
  not_attended: 'bg-rose-100 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300',
  rescheduled: 'bg-indigo-100 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300',
  blocked: 'bg-gray-100 dark:bg-[#111118]/20 text-gray-700 dark:text-[#d4d4d8]'
};

const STATUS_OPTIONS = [
  'scheduled', 'confirmed', 'waiting', 'in_service', 'finished',
  'late', 'no_show', 'cancelled', 'unmarked', 'not_attended', 'rescheduled'
];

const PAGE_SIZES = [10, 25, 50];

type SortField = 'date' | 'status' | 'doctor_name';
type SortDir = 'asc' | 'desc';

type HistoryRow = {
  id: number;
  date: string;
  time: string | null;
  end_time: string | null;
  doctor_id: number | null;
  status: string;
  type: string | null;
  description: string | null;
  appointment_subtype: string | null;
  procedures: string[] | null;
  doctor_name: string | null;
};

interface PatientAppointmentHistoryProps {
  patientId: number;
  patientName?: string;
  /** Modo compacto para uso em modal/drawer (oculta padding externo) */
  compact?: boolean;
}

export default function PatientAppointmentHistory({ patientId, patientName, compact = false }: PatientAppointmentHistoryProps) {
  const router = useRouter();
  const { toast } = useToast();

  // Filtros
  const [doctorId, setDoctorId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Dados
  const [doctors, setDoctors] = useState<Array<{ id: number; name: string }>>([]);
  const [appointments, setAppointments] = useState<HistoryRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Paginação e ordenação
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Status multi-select dropdown
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement>(null);

  // Carregar médicos
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('doctors').select('id, name').eq('active', true).order('name');
      if (data) setDoctors(data);
    })();
  }, []);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) setStatusDropdownOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('appointments')
        .select('id, date, time, end_time, doctor_id, status, type, description, appointment_subtype, procedures', { count: 'exact' })
        .eq('patient_id', patientId);

      if (doctorId) query = query.eq('doctor_id', doctorId);
      if (statusFilter.length > 0) query = query.in('status', statusFilter);
      if (dateFrom) query = query.gte('date', dateFrom);
      if (dateTo) query = query.lte('date', dateTo);

      // Ordenação
      if (sortField === 'date') {
        query = query.order('date', { ascending: sortDir === 'asc' }).order('time', { ascending: sortDir === 'asc' });
      } else if (sortField === 'status') {
        query = query.order('status', { ascending: sortDir === 'asc' });
      } else {
        query = query.order('date', { ascending: false });
      }

      const from = page * pageSize;
      query = query.range(from, from + pageSize - 1);

      const { data, count, error } = await query;
      if (error) throw error;

      // Buscar nomes dos médicos
      const doctorIds = [...new Set((data || []).map(a => a.doctor_id).filter(Boolean))] as number[];
      let doctorMap: Record<number, string> = {};
      if (doctorIds.length > 0) {
        const { data: docData } = await supabase.from('doctors').select('id, name').in('id', doctorIds);
        if (docData) doctorMap = Object.fromEntries(docData.map(d => [d.id, d.name]));
      }

      const rows: HistoryRow[] = (data || []).map((a) => ({
        id: a.id as number,
        date: a.date as string,
        time: a.time as string | null,
        end_time: a.end_time as string | null,
        doctor_id: a.doctor_id as number | null,
        status: a.status as string,
        type: a.type as string | null,
        description: a.description as string | null,
        appointment_subtype: a.appointment_subtype as string | null,
        procedures: a.procedures as string[] | null,
        doctor_name: (a.doctor_id && doctorMap[a.doctor_id as number]) ? doctorMap[a.doctor_id as number] : null
      }));

      setAppointments(rows);
      setTotalCount(count ?? 0);
    } catch (err: unknown) {
      toast.error('Erro ao buscar histórico: ' + (err instanceof Error ? err.message : 'Tente novamente.'));
    } finally {
      setLoading(false);
    }
  }, [patientId, doctorId, statusFilter, dateFrom, dateTo, page, pageSize, sortField, sortDir, toast]);

  // Buscar ao montar e quando filtros/paginação mudam
  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleSearch = () => {
    setPage(0);
    fetchHistory();
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const handleExportPdf = async () => {
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const margin = 14;
    let y = 20;

    doc.setFontSize(16);
    doc.text(`Histórico de Agendamentos${patientName ? ` — ${patientName}` : ''}`, margin, y);
    y += 10;

    doc.setFontSize(8);
    const filters: string[] = [];
    if (doctorId) {
      const d = doctors.find(doc2 => doc2.id === doctorId);
      if (d) filters.push(`Profissional: ${d.name}`);
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

    const cols = [
      { label: 'ID', w: 15 },
      { label: 'Agendamento', w: 80 },
      { label: 'Status', w: 35 },
      { label: 'Profissional', w: 55 },
      { label: 'Data/Hora', w: 40 }
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
        `#${appt.id}`,
        appt.description || appt.procedures?.join(', ') || appt.type || '—',
        STATUS_LABELS[appt.status] || appt.status,
        appt.doctor_name || '—',
        `${appt.date ? new Date(appt.date + 'T12:00:00').toLocaleDateString('pt-BR') : '—'} ${appt.time?.slice(0, 5) || ''}`
      ];
      cols.forEach((col, i) => {
        const text = (rowData[i] || '').substring(0, Math.floor(col.w / 1.8));
        doc.text(text, xPos + 2, y);
        xPos += col.w;
      });
      y += 5;
    }

    doc.save(`historico-agendamentos${patientName ? `-${patientName.replace(/\s+/g, '-').toLowerCase()}` : ''}.pdf`);
    toast.success('PDF exportado!');
  };

  const toggleStatusFilter = (s: string) => {
    setStatusFilter(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  const formatDate = (d: string) => {
    if (!d) return '—';
    return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR');
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className={compact ? '' : 'space-y-4'}>
      {/* Filtros */}
      <div className={`bg-white dark:bg-[#111118] rounded-xl border border-slate-200 dark:border-[#1e1e28] p-4 shadow-sm ${compact ? 'mx-0' : ''}`}>
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-bold text-slate-700 dark:text-gray-200">Filtros</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Profissional */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-[#a1a1aa] mb-1">Profissional</label>
            <select
              value={doctorId ?? ''}
              onChange={e => setDoctorId(e.target.value ? Number(e.target.value) : null)}
              className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-[#252530] rounded-lg bg-white dark:bg-[#1a1a22] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              <option value="">Todos</option>
              {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          {/* Status Multi-Select */}
          <div ref={statusDropdownRef} className="relative">
            <label className="block text-[11px] font-bold text-slate-500 dark:text-[#a1a1aa] mb-1">Status</label>
            <button
              type="button"
              onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
              className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-[#252530] rounded-lg bg-white dark:bg-[#1a1a22] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-400 text-left flex items-center justify-between"
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
              <div className="absolute z-50 mt-1 w-full bg-white dark:bg-[#111118] border border-slate-200 dark:border-[#252530] rounded-lg shadow-lg max-h-56 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => setStatusFilter([])}
                  className="w-full px-3 py-1.5 text-xs text-left hover:bg-slate-50 dark:hover:bg-white/5 text-blue-600 dark:text-blue-400 font-bold border-b border-slate-100 dark:border-[#1e1e28]"
                >
                  Limpar seleção
                </button>
                {STATUS_OPTIONS.map(s => (
                  <label key={s} className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={statusFilter.includes(s)}
                      onChange={() => toggleStatusFilter(s)}
                      className="rounded border-slate-300 text-blue-500 focus:ring-blue-400"
                    />
                    <span className="text-xs text-slate-700 dark:text-gray-200">{STATUS_LABELS[s] || s}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* De */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-[#a1a1aa] mb-1">De</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-[#252530] rounded-lg bg-white dark:bg-[#1a1a22] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>

          {/* Até */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-[#a1a1aa] mb-1">Até</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-[#252530] rounded-lg bg-white dark:bg-[#1a1a22] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
        </div>

        <div className="flex items-center justify-between mt-4">
          <button
            onClick={() => { setDoctorId(null); setStatusFilter([]); setDateFrom(''); setDateTo(''); }}
            className="text-xs text-slate-500 dark:text-[#a1a1aa] hover:text-slate-700 dark:hover:text-gray-200 font-medium flex items-center gap-1"
          >
            <X className="w-3.5 h-3.5" /> Limpar filtros
          </button>
          <button
            onClick={handleSearch}
            className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-5 py-2 rounded-lg text-xs font-bold shadow-md active:scale-95 transition-all"
          >
            <Search className="w-4 h-4" /> Pesquisar
          </button>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white dark:bg-[#111118] rounded-xl border border-slate-200 dark:border-[#1e1e28] shadow-sm overflow-hidden">
        {/* Header da tabela com export */}
        <div className="px-4 py-3 border-b border-slate-100 dark:border-[#1e1e28] flex items-center justify-between">
          <span className="text-xs text-slate-500 dark:text-[#a1a1aa]">
            {loading ? 'Buscando...' : `${totalCount} agendamento${totalCount !== 1 ? 's' : ''} encontrado${totalCount !== 1 ? 's' : ''}`}
          </span>
          <button
            onClick={handleExportPdf}
            disabled={appointments.length === 0}
            className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-[#a1a1aa] hover:text-blue-600 dark:hover:text-blue-400 font-medium disabled:opacity-40 transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> PDF
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            <span className="ml-2 text-sm text-slate-500 dark:text-[#a1a1aa]">Carregando histórico...</span>
          </div>
        ) : appointments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-[#71717a]">
            <Calendar className="w-10 h-10 mb-3 opacity-40" />
            <p className="text-sm font-medium">Nenhum agendamento encontrado</p>
            <p className="text-xs mt-1">Este paciente ainda não possui agendamentos{statusFilter.length > 0 || dateFrom || dateTo ? ' com os filtros aplicados' : ''}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-[#1e1e28] bg-slate-50 dark:bg-[#050507]">
                    <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 dark:text-[#a1a1aa] uppercase tracking-wider w-[60px]">ID</th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 dark:text-[#a1a1aa] uppercase tracking-wider">Agendamento</th>
                    <SortableHeader label="Status" field="status" current={sortField} dir={sortDir} onSort={handleSort} />
                    <SortableHeader label="Profissional" field="doctor_name" current={sortField} dir={sortDir} onSort={handleSort} />
                    <SortableHeader label="Data/Hora" field="date" current={sortField} dir={sortDir} onSort={handleSort} />
                    <th className="px-4 py-3 text-center text-[11px] font-bold text-slate-500 dark:text-[#a1a1aa] uppercase tracking-wider w-[80px]">Opções</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                  {appointments.map(appt => (
                    <tr key={appt.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3">
                        <span className="text-xs font-mono text-slate-400 dark:text-[#71717a]">#{appt.id}</span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-slate-800 dark:text-gray-200 truncate max-w-[250px]">
                          {appt.description || appt.procedures?.join(', ') || appt.type || '—'}
                        </p>
                        {appt.appointment_subtype && (
                          <p className="text-[11px] text-slate-400 dark:text-[#71717a]">{appt.appointment_subtype}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${STATUS_COLORS[appt.status] || 'bg-slate-100 text-slate-600'}`}>
                          {STATUS_LABELS[appt.status] || appt.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-700 dark:text-[#d4d4d8]">{appt.doctor_name || '—'}</td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-medium text-slate-700 dark:text-[#d4d4d8]">{formatDate(appt.date)}</p>
                        {appt.time && (
                          <p className="text-[11px] text-slate-400 dark:text-[#71717a]">
                            {appt.time.slice(0, 5)}{appt.end_time ? ` — ${appt.end_time.slice(0, 5)}` : ''}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => router.push(`/atendimento/agenda/${appt.id}`)}
                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-md text-slate-400 hover:text-blue-600 transition-colors"
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
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Rodapé: total + paginação */}
            <div className="px-4 py-3 border-t border-slate-100 dark:border-[#1e1e28] flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-xs text-slate-500 dark:text-[#a1a1aa]">
                Foram encontrados um total de <strong className="text-slate-700 dark:text-gray-200">{totalCount}</strong> registros.
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
                  <button
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-md text-slate-400 disabled:opacity-30 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs text-slate-600 dark:text-[#d4d4d8] font-medium min-w-[80px] text-center">
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
      className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 dark:text-[#a1a1aa] uppercase tracking-wider cursor-pointer hover:text-slate-700 dark:hover:text-gray-200 select-none"
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active ? (dir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : <ChevronDown className="w-3 h-3 opacity-30" />}
      </span>
    </th>
  );
}
