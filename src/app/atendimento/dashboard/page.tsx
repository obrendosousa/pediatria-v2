'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  CalendarDays, UserCheck, UserX, CheckCircle2,
  Search, ChevronDown, ChevronUp, AlertCircle,
  Clock, BarChart3, PieChartIcon, Cake, ClipboardList,
} from 'lucide-react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { createSchemaClient } from '@/lib/supabase/schemaClient';

const supabase = createSchemaClient('atendimento');

// ── Tipos ──────────────────────────────────────────────────
type Period = 'today' | 'week' | 'month' | 'quarter' | 'year';
type DoctorOption = { id: number; name: string };
type Appointment = {
  id: number;
  patient_id: number;
  doctor_id: number | null;
  date: string;
  time: string | null;
  type: string;
  status: string;
  procedures: string[] | null;
  patient_name?: string;
  insurance?: string | null;
};
type BirthdayPatient = { id: number; full_name: string; birth_date: string };

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 'today', label: 'Hoje' },
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mês' },
  { value: 'quarter', label: 'Trimestre' },
  { value: 'year', label: 'Ano' },
];

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Agendado', confirmed: 'Confirmado', waiting: 'Sala de Espera',
  called: 'Chamado', in_service: 'Em Atendimento', waiting_payment: 'Aguardando Pgto',
  finished: 'Atendido', late: 'Atrasado', no_show: 'Faltou', cancelled: 'Cancelado',
};

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  confirmed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300',
  waiting: 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300',
  called: 'bg-sky-100 text-sky-700 dark:bg-sky-900/20 dark:text-sky-300',
  in_service: 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300',
  waiting_payment: 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300',
  finished: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300',
  late: 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300',
  no_show: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300',
  cancelled: 'bg-gray-100 text-gray-500 dark:bg-[#1c1c21] dark:text-[#a1a1aa]',
};

const PIE_COLORS = ['#0891B2', '#7C3AED', '#059669', '#D97706', '#E11D48', '#6366F1', '#14B8A6', '#F59E0B', '#EC4899'];

// Status que indicam que o paciente confirmou presença (confirmado ou já avançou no fluxo)
const CONFIRMED_STATUSES = new Set(['confirmed', 'waiting', 'called', 'in_service', 'waiting_payment', 'finished']);

// ── Helpers ────────────────────────────────────────────────
function getDateRange(period: Period): { from: string; to: string } {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = now.getMonth();
  const dd = now.getDate();
  const fmt = (d: Date) => d.toISOString().split('T')[0];

  switch (period) {
    case 'today': {
      const d = fmt(now);
      return { from: d, to: d };
    }
    case 'week': {
      const day = now.getDay();
      const start = new Date(yyyy, mm, dd - day);
      const end = new Date(yyyy, mm, dd + (6 - day));
      return { from: fmt(start), to: fmt(end) };
    }
    case 'month':
      return { from: `${yyyy}-${String(mm + 1).padStart(2, '0')}-01`, to: fmt(new Date(yyyy, mm + 1, 0)) };
    case 'quarter': {
      const qStart = Math.floor(mm / 3) * 3;
      return { from: fmt(new Date(yyyy, qStart, 1)), to: fmt(new Date(yyyy, qStart + 3, 0)) };
    }
    case 'year':
      return { from: `${yyyy}-01-01`, to: `${yyyy}-12-31` };
  }
}

function getTodayStr() {
  return new Date().toISOString().split('T')[0];
}

function formatDateBR(d: string) {
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

function formatTime(t: string | null) {
  if (!t) return '--:--';
  return t.substring(0, 5);
}

// ── KPI Card ───────────────────────────────────────────────
function KPICard({ icon, label, value, gradient }: {
  icon: React.ReactNode; label: string; value: number; gradient: string;
}) {
  return (
    <div className={`rounded-2xl p-5 text-white shadow-lg ${gradient}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">{icon}</div>
        <span className="text-3xl font-extrabold">{value}</span>
      </div>
      <p className="text-sm font-medium opacity-90">{label}</p>
    </div>
  );
}

// ── Collapsible Widget ─────────────────────────────────────
function CollapsibleWidget({ title, icon, children, defaultOpen = true }: {
  title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="bg-white dark:bg-[#131316] rounded-xl border border-slate-200 dark:border-[#3d3d48] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-[#2d2d36]">
        <div className="flex items-center gap-2">
          <span className="text-blue-600 dark:text-blue-400">{icon}</span>
          <h3 className="text-sm font-bold text-slate-700 dark:text-gray-200 uppercase tracking-wide">{title}</h3>
        </div>
        <button
          onClick={() => setIsOpen(prev => !prev)}
          className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors text-slate-400"
        >
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>
      {isOpen && <div className="p-5">{children}</div>}
    </div>
  );
}

// ── Custom Tooltip ─────────────────────────────────────────
function CustomBarTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-[#1c1c21] border border-slate-200 dark:border-[#3d3d48] rounded-lg px-3 py-2 shadow-lg">
      <p className="text-xs font-bold text-slate-700 dark:text-gray-200">{label}</p>
      <p className="text-xs text-blue-600 dark:text-blue-400">{payload[0].value} atendimento{payload[0].value !== 1 ? 's' : ''}</p>
    </div>
  );
}

// ── Página Principal ───────────────────────────────────────
export default function AtendimentoDashboardPage() {
  const [period, setPeriod] = useState<Period>('month');
  const [doctorId, setDoctorId] = useState<number | null>(null);
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [todayAppointments, setTodayAppointments] = useState<Appointment[]>([]);
  const [birthdays, setBirthdays] = useState<BirthdayPatient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Carregar profissionais
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('doctors').select('id, name').eq('active', true).order('name');
      if (data) setDoctors(data);
    })();
  }, []);

  // Fetch principal
  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const { from, to } = getDateRange(period);
      const today = getTodayStr();

      // Query 1: Appointments no período (limit alto para evitar truncamento silencioso)
      let apptQuery = supabase
        .from('appointments')
        .select('id, patient_id, doctor_id, date, time, type, status, procedures')
        .gte('date', from)
        .lte('date', to)
        .neq('status', 'cancelled')
        .limit(10000);

      if (doctorId) apptQuery = apptQuery.eq('doctor_id', doctorId);

      // Query 2: Appointments de hoje
      let todayQuery = supabase
        .from('appointments')
        .select('id, patient_id, doctor_id, date, time, type, status, procedures')
        .eq('date', today)
        .neq('status', 'cancelled')
        .order('time')
        .limit(500);

      if (doctorId) todayQuery = todayQuery.eq('doctor_id', doctorId);

      // Query 3: Todos pacientes (para aniversariantes e insurance join)
      const patientsQuery = supabase
        .from('patients')
        .select('id, full_name, birth_date, insurance')
        .limit(50000);

      const [apptRes, todayRes, patientsRes] = await Promise.all([
        apptQuery,
        todayQuery,
        patientsQuery,
      ]);

      // Verificar erros nas queries
      if (apptRes.error || todayRes.error || patientsRes.error) {
        const msg = apptRes.error?.message || todayRes.error?.message || patientsRes.error?.message || 'Erro desconhecido';
        throw new Error(msg);
      }

      const allPatients = (patientsRes.data || []) as { id: number; full_name: string; birth_date: string | null; insurance: string | null }[];
      const patientMap = new Map(allPatients.map(p => [p.id, p]));

      // Enriquecer appointments com nome e insurance
      const enriched = ((apptRes.data || []) as Appointment[]).map(a => {
        const p = patientMap.get(a.patient_id);
        return { ...a, patient_name: p?.full_name || '', insurance: p?.insurance || null };
      });

      const todayEnriched = ((todayRes.data || []) as Appointment[]).map(a => {
        const p = patientMap.get(a.patient_id);
        return { ...a, patient_name: p?.full_name || '' };
      });

      // Aniversariantes no período (verifica ano atual e próximo para ranges cross-year)
      const fromDate = new Date(from);
      const toDate = new Date(to);
      const fromYear = fromDate.getFullYear();
      const toYear = toDate.getFullYear();
      const yearsToCheck = fromYear === toYear ? [fromYear] : [fromYear, toYear];

      const bdays = allPatients.filter(p => {
        if (!p.birth_date) return false;
        const [, bm, bd] = p.birth_date.split('-').map(Number);
        return yearsToCheck.some(y => {
          const bdayDate = new Date(y, bm - 1, bd);
          return bdayDate >= fromDate && bdayDate <= toDate;
        });
      }).map(p => ({ id: p.id, full_name: p.full_name, birth_date: p.birth_date! }));

      setAppointments(enriched);
      setTodayAppointments(todayEnriched);
      setBirthdays(bdays.sort((a, b) => {
        const [, am, ad] = a.birth_date.split('-').map(Number);
        const [, bm2, bd2] = b.birth_date.split('-').map(Number);
        return am * 100 + ad - (bm2 * 100 + bd2);
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar dados do dashboard';
      console.error('[Dashboard] loadDashboard error:', err);
      setLoadError(message);
    } finally {
      setIsLoading(false);
    }
  }, [period, doctorId]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // ── KPIs ─────────────────────────────────────────────────
  const kpis = useMemo(() => ({
    total: appointments.length,
    confirmed: appointments.filter(a => CONFIRMED_STATUSES.has(a.status)).length,
    noShow: appointments.filter(a => a.status === 'no_show').length,
    finished: appointments.filter(a => a.status === 'finished').length,
  }), [appointments]);

  // ── Dados gráfico de barras ──────────────────────────────
  const barData = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of appointments) {
      map.set(a.date, (map.get(a.date) || 0) + 1);
    }
    return Array.from(map.entries())
      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
      .map(([isoDate, count]) => ({ date: formatDateBR(isoDate), count }));
  }, [appointments]);

  // ── Dados pizza convênio ─────────────────────────────────
  const pieData = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of appointments) {
      const ins = a.insurance || 'Particular';
      map.set(ins, (map.get(ins) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [appointments]);

  // ── Procedimentos realizados ─────────────────────────────
  const proceduresData = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of appointments) {
      // Usar procedures array se existir, senão usar type
      if (a.procedures && a.procedures.length > 0) {
        for (const proc of a.procedures) {
          map.set(proc, (map.get(proc) || 0) + 1);
        }
      } else {
        const t = a.type || 'consulta';
        map.set(t, (map.get(t) || 0) + 1);
      }
    }
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [appointments]);

  // ── Loading ──────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="h-full overflow-y-auto bg-slate-50 dark:bg-[#08080b]">
        <div className="max-w-[1440px] mx-auto px-6 py-8 space-y-6">
          <div className="h-8 w-72 bg-slate-200 dark:bg-[#1c1c21] rounded-lg animate-pulse" />
          <div className="h-12 w-full bg-slate-200 dark:bg-[#1c1c21] rounded-lg animate-pulse" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-28 bg-slate-200 dark:bg-[#1c1c21] rounded-2xl animate-pulse" />
            ))}
          </div>
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-8 space-y-4">
              <div className="h-72 bg-slate-200 dark:bg-[#1c1c21] rounded-xl animate-pulse" />
              <div className="h-56 bg-slate-200 dark:bg-[#1c1c21] rounded-xl animate-pulse" />
            </div>
            <div className="col-span-4">
              <div className="h-96 bg-slate-200 dark:bg-[#1c1c21] rounded-xl animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-50 dark:bg-[#08080b] custom-scrollbar">
      <div className="max-w-[1440px] mx-auto px-6 py-6 space-y-6">

        {/* ─── Header ─── */}
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-8 rounded-full bg-gradient-to-b from-blue-600 to-indigo-500" />
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-[#fafafa]">Dashboard</h1>
            <p className="text-xs text-slate-400 dark:text-[#71717a]">Visão geral do Atendimento</p>
          </div>
        </div>

        {/* ─── Filtros ─── */}
        <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-[#131316] rounded-xl border border-slate-200 dark:border-[#3d3d48] px-5 py-3">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Período</label>
            <select
              value={period}
              onChange={e => setPeriod(e.target.value as Period)}
              className="px-3 py-2 text-sm border border-slate-200 dark:border-[#3d3d48] rounded-lg bg-white dark:bg-[#1c1c21] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
            >
              {PERIOD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Profissional</label>
            <select
              value={doctorId ?? ''}
              onChange={e => setDoctorId(e.target.value ? Number(e.target.value) : null)}
              className="px-3 py-2 text-sm border border-slate-200 dark:border-[#3d3d48] rounded-lg bg-white dark:bg-[#1c1c21] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer min-w-[180px]"
            >
              <option value="">Todos</option>
              {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          <div className="pt-4">
            <button
              onClick={loadDashboard}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-bold transition-all active:scale-95"
            >
              <Search className="w-4 h-4" /> PESQUISAR
            </button>
          </div>
        </div>

        {/* ─── Banner de Erro ─── */}
        {loadError && (
          <div className="flex items-center gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-xl px-5 py-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-300 flex-1">
              Erro ao carregar dados: {loadError}
            </p>
            <button
              onClick={loadDashboard}
              className="text-xs font-bold text-red-600 dark:text-red-400 hover:underline flex-shrink-0"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {/* ─── KPI Cards ─── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            icon={<CalendarDays className="w-5 h-5" />}
            label="Agendamentos"
            value={kpis.total}
            gradient="bg-gradient-to-br from-violet-600 to-indigo-500"
          />
          <KPICard
            icon={<CheckCircle2 className="w-5 h-5" />}
            label="Pacientes Confirmados"
            value={kpis.confirmed}
            gradient="bg-gradient-to-br from-indigo-500 to-blue-500"
          />
          <KPICard
            icon={<UserX className="w-5 h-5" />}
            label="Pacientes que Faltaram"
            value={kpis.noShow}
            gradient="bg-gradient-to-br from-rose-500 to-red-500"
          />
          <KPICard
            icon={<UserCheck className="w-5 h-5" />}
            label="Pacientes Atendidos"
            value={kpis.finished}
            gradient="bg-gradient-to-br from-emerald-500 to-green-500"
          />
        </div>

        {/* ─── Conteúdo: Main + Sidebar ─── */}
        <div className="grid grid-cols-12 gap-6">

          {/* ─── Coluna Principal ─── */}
          <div className="col-span-12 lg:col-span-8 space-y-6">

            {/* Widget: Atendimentos por período */}
            <CollapsibleWidget title="Atendimentos por período" icon={<BarChart3 className="w-4 h-4" />}>
              {barData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={barData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
                    <Tooltip content={<CustomBarTooltip />} />
                    <Bar dataKey="count" fill="#0d9488" radius={[6, 6, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-slate-400 text-center py-8">Nenhum atendimento no período.</p>
              )}
            </CollapsibleWidget>

            {/* Widget: Atendimentos por convênio */}
            <CollapsibleWidget title="Atendimentos por convênio" icon={<PieChartIcon className="w-4 h-4" />}>
              {pieData.length > 0 ? (
                <div className="flex items-center gap-6">
                  <ResponsiveContainer width="50%" height={220}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value" paddingAngle={2}>
                        {pieData.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-2">
                    {pieData.map((item, i) => (
                      <div key={item.name} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="text-xs text-slate-600 dark:text-[#d4d4d8] flex-1">{item.name}</span>
                        <span className="text-xs font-bold text-slate-700 dark:text-gray-200">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-400 text-center py-8">Nenhum dado de convênio.</p>
              )}
            </CollapsibleWidget>

            {/* Widget: Procedimentos realizados */}
            <CollapsibleWidget title="Procedimentos realizados" icon={<ClipboardList className="w-4 h-4" />}>
              {proceduresData.length > 0 ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-[#2d2d36]">
                      <th className="text-left py-2 text-xs font-extrabold text-slate-500 dark:text-[#a1a1aa] uppercase">Procedimento</th>
                      <th className="text-right py-2 text-xs font-extrabold text-slate-500 dark:text-[#a1a1aa] uppercase">Qtd</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-gray-800">
                    {proceduresData.map(p => (
                      <tr key={p.name} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                        <td className="py-2 text-slate-700 dark:text-gray-200 capitalize">{p.name}</td>
                        <td className="py-2 text-right font-bold text-slate-700 dark:text-gray-200">{p.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-slate-400 text-center py-8">Nenhum procedimento registrado.</p>
              )}
            </CollapsibleWidget>

            {/* Widget: Aniversariantes */}
            <CollapsibleWidget title="Aniversariantes" icon={<Cake className="w-4 h-4" />} defaultOpen={false}>
              {birthdays.length > 0 ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-[#2d2d36]">
                      <th className="text-left py-2 text-xs font-extrabold text-slate-500 dark:text-[#a1a1aa] uppercase">Paciente</th>
                      <th className="text-right py-2 text-xs font-extrabold text-slate-500 dark:text-[#a1a1aa] uppercase">Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-gray-800">
                    {birthdays.map(p => {
                      const [, m, d] = p.birth_date.split('-');
                      return (
                        <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                          <td className="py-2 text-slate-700 dark:text-gray-200 flex items-center gap-2">
                            <Cake className="w-3.5 h-3.5 text-pink-400" />
                            {p.full_name}
                          </td>
                          <td className="py-2 text-right text-slate-500 dark:text-[#a1a1aa]">{d}/{m}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-slate-400 text-center py-8">Nenhum aniversariante no período.</p>
              )}
            </CollapsibleWidget>
          </div>

          {/* ─── Coluna Lateral: Pacientes do dia ─── */}
          <div className="col-span-12 lg:col-span-4">
            <div className="bg-white dark:bg-[#131316] rounded-xl border border-slate-200 dark:border-[#3d3d48] sticky top-6">
              <div className="px-5 py-3 border-b border-slate-100 dark:border-[#2d2d36] flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h3 className="text-sm font-bold text-slate-700 dark:text-gray-200 uppercase tracking-wide">Pacientes do dia</h3>
                <span className="ml-auto text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-full">
                  {todayAppointments.length}
                </span>
              </div>
              <div className="p-4 max-h-[600px] overflow-y-auto custom-scrollbar">
                {todayAppointments.length > 0 ? (
                  <div className="space-y-2">
                    {todayAppointments.map(a => (
                      <div
                        key={a.id}
                        className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-[#1c1c21] hover:bg-slate-100 dark:hover:bg-white/[0.08] transition-colors"
                      >
                        <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-sm font-bold text-blue-700 dark:text-blue-300 flex-shrink-0">
                          {(a.patient_name || '?').charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-700 dark:text-gray-200 truncate">
                            {a.patient_name || 'Paciente'}
                          </p>
                          <p className="text-xs text-slate-400 dark:text-[#71717a] flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTime(a.time)}
                          </p>
                        </div>
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full flex-shrink-0 ${STATUS_COLORS[a.status] || STATUS_COLORS.scheduled}`}>
                          {STATUS_LABELS[a.status] || a.status}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <CalendarDays className="w-10 h-10 text-slate-300 dark:text-gray-600 mx-auto mb-3" />
                    <p className="text-sm text-slate-400 dark:text-[#71717a]">Não há agendamentos no dia!</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
