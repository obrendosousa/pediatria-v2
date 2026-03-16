'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Users, CheckCircle2, XCircle, Clock, TrendingUp,
  Activity, ArrowUpRight, ArrowDownRight,
  CalendarCheck, Timer, UserCheck, BarChart3, RefreshCw
} from 'lucide-react';
import {
  PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart
} from 'recharts';
import { fetchDashboardMetrics, DashboardMetrics } from '@/utils/dashboardMetrics';

// Paleta profissional médica
const THEME = {
  teal: { base: '#0891B2', light: '#06B6D4', bg: '#ECFEFF', ring: 'ring-cyan-500/20' },
  emerald: { base: '#059669', light: '#10B981', bg: '#ECFDF5', ring: 'ring-emerald-500/20' },
  amber: { base: '#D97706', light: '#F59E0B', bg: '#FFFBEB', ring: 'ring-amber-500/20' },
  rose: { base: '#E11D48', light: '#FB7185', bg: '#FFF1F2', ring: 'ring-rose-500/20' },
  violet: { base: '#7C3AED', light: '#A78BFA', bg: '#F5F3FF', ring: 'ring-violet-500/20' },
  slate: { base: '#475569', light: '#64748B', bg: '#F8FAFC', ring: 'ring-slate-500/20' },
};

const CHART_COLORS = {
  male: '#0891B2',
  female: '#A78BFA',
  newPatient: '#06B6D4',
  recurring: '#0E7490',
  consultation: '#059669',
  returnVisit: '#10B981',
};

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState(30);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchMetrics = useCallback(async () => {
    setIsLoading((prev) => {
      if (!prev) setIsRefreshing(true);
      return prev;
    });
    try {
      const data = await fetchDashboardMetrics(period);
      setMetrics(data);
    } catch (error) {
      console.error('Erro ao buscar métricas:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [period]);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  // Dados dos gráficos (memoizados)
  const genderData = useMemo(() => metrics ? [
    { name: 'Masculino', value: metrics.demographics.male.count, fill: CHART_COLORS.male },
    { name: 'Feminino', value: metrics.demographics.female.count, fill: CHART_COLORS.female },
  ] : [], [metrics]);

  const newRecurringData = useMemo(() => metrics ? [
    { name: 'Novos', value: metrics.demographics.new.count, fill: CHART_COLORS.newPatient },
    { name: 'Recorrentes', value: metrics.demographics.recurring.count, fill: CHART_COLORS.recurring },
  ] : [], [metrics]);

  const proceduresData = useMemo(() => metrics ? [
    { name: 'Consulta', value: metrics.procedures.consultations.count, fill: CHART_COLORS.consultation },
    { name: 'Retorno', value: metrics.procedures.returns.count, fill: CHART_COLORS.returnVisit },
  ] : [], [metrics]);

  const timelineData = useMemo(() => metrics ? Object.entries(metrics.timeline.appointmentsByDate)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => {
      const [dayA, monthA] = a.date.split('/');
      const [dayB, monthB] = b.date.split('/');
      return new Date(2024, parseInt(monthA) - 1, parseInt(dayA)).getTime() -
        new Date(2024, parseInt(monthB) - 1, parseInt(dayB)).getTime();
    })
    .slice(-30) : [], [metrics]);

  const attendanceTimelineData = useMemo(() => metrics ? Object.entries(metrics.timeline.attendanceRateByDate)
    .map(([date, rate]) => ({ date, rate }))
    .sort((a, b) => {
      const [dayA, monthA] = a.date.split('/');
      const [dayB, monthB] = b.date.split('/');
      return new Date(2024, parseInt(monthA) - 1, parseInt(dayA)).getTime() -
        new Date(2024, parseInt(monthB) - 1, parseInt(dayB)).getTime();
    })
    .slice(-30) : [], [metrics]);

  const ageData = useMemo(() => metrics ? Object.entries(metrics.demographics.ageDistribution)
    .map(([age, count]) => ({ age: `${age}`, count }))
    .sort((a, b) => parseInt(a.age) - parseInt(b.age)) : [], [metrics]);

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="flex flex-col h-screen bg-gray-50 dark:bg-[#0C1117] overflow-hidden">
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-[1440px] mx-auto px-6 py-8 space-y-8">
            {/* Header skeleton */}
            <div className="flex items-center justify-between">
              <div className="space-y-3">
                <div className="h-8 w-72 bg-gray-200 dark:bg-[#18181b] rounded-lg animate-pulse" />
                <div className="h-4 w-48 bg-gray-100 dark:bg-[#18181b]/60 rounded animate-pulse" />
              </div>
              <div className="h-10 w-40 bg-gray-200 dark:bg-[#18181b] rounded-lg animate-pulse" />
            </div>
            {/* Cards skeleton */}
            <div className="grid grid-cols-4 gap-5">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-[140px] bg-white dark:bg-[#161B22] rounded-2xl border border-gray-100 dark:border-[#27272a]/50 animate-pulse" />
              ))}
            </div>
            <div className="grid grid-cols-4 gap-5">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-[140px] bg-white dark:bg-[#161B22] rounded-2xl border border-gray-100 dark:border-[#27272a]/50 animate-pulse" />
              ))}
            </div>
            {/* Charts skeleton */}
            <div className="grid grid-cols-2 gap-5">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="h-[320px] bg-white dark:bg-[#161B22] rounded-2xl border border-gray-100 dark:border-[#27272a]/50 animate-pulse" />
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-[#0C1117] min-h-screen">
        <div className="text-center p-10 bg-white dark:bg-[#161B22] rounded-2xl shadow-sm border border-gray-100 dark:border-[#27272a]/50 max-w-sm">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center mx-auto mb-5">
            <Activity className="w-7 h-7 text-rose-500" />
          </div>
          <p className="text-gray-900 dark:text-[#fafafa] font-semibold text-lg mb-2">Erro ao carregar</p>
          <p className="text-gray-500 dark:text-[#a1a1aa] text-sm mb-6">Nao foi possivel conectar ao banco de dados.</p>
          <button
            onClick={fetchMetrics}
            className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-sm font-medium transition-colors cursor-pointer"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-[#0C1117] overflow-hidden">
      <main className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8">

          {/* ─── Header ─── */}
          <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-1.5 h-8 rounded-full bg-gradient-to-b from-cyan-500 to-teal-600" />
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-50">
                  Dashboard
                </h1>
                {isRefreshing && (
                  <RefreshCw className="w-4 h-4 text-cyan-500 animate-spin" />
                )}
              </div>
              <p className="text-sm text-gray-500 dark:text-[#a1a1aa] ml-[18px]">
                Visao geral das operacoes da clinica
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex bg-white dark:bg-[#161B22] rounded-xl border border-gray-200 dark:border-[#2e2e33]/50 p-1 shadow-sm">
                {[
                  { value: 7, label: '7d' },
                  { value: 30, label: '30d' },
                  { value: 90, label: '90d' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setPeriod(opt.value)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                      period === opt.value
                        ? 'bg-cyan-600 text-white shadow-sm'
                        : 'text-gray-500 dark:text-[#a1a1aa] hover:text-gray-700 dark:hover:text-gray-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </header>

          {/* ─── Visao Geral ─── */}
          <section>
            <SectionHeader icon={<BarChart3 className="w-4 h-4" />} title="Visao Geral" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
              <KPICard
                icon={<Users className="w-5 h-5" />}
                label="Total de Pacientes"
                value={metrics.totalPatients}
                theme={THEME.teal}
              />
              <KPICard
                icon={<CalendarCheck className="w-5 h-5" />}
                label="Consultas Realizadas"
                value={metrics.totalConsultations}
                theme={THEME.emerald}
              />
              <KPICard
                icon={<UserCheck className="w-5 h-5" />}
                label="Taxa de Comparecimento"
                value={`${metrics.attendanceRate}%`}
                theme={THEME.teal}
                trend={metrics.attendanceRate >= 70 ? 'up' : 'down'}
              />
              <KPICard
                icon={<Timer className="w-5 h-5" />}
                label="Tempo Medio de Atendimento"
                value={`${metrics.averageServiceTime}min`}
                theme={THEME.violet}
              />
            </div>
          </section>

          {/* ─── Performance Operacional ─── */}
          <section>
            <SectionHeader icon={<Activity className="w-4 h-4" />} title="Performance Operacional" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
              <KPICard
                icon={<TrendingUp className="w-5 h-5" />}
                label="Taxa de Conversao"
                value={`${metrics.conversionRate}%`}
                theme={THEME.emerald}
                trend={metrics.conversionRate >= 10 ? 'up' : 'down'}
              />
              <KPICard
                icon={<Clock className="w-5 h-5" />}
                label="Tempo Medio na Fila"
                value={`${metrics.averageQueueTime}min`}
                theme={THEME.amber}
              />
              <KPICard
                icon={<XCircle className="w-5 h-5" />}
                label="Taxa de Cancelamento"
                value={`${metrics.cancellationRate}%`}
                theme={THEME.rose}
                trend={metrics.cancellationRate <= 10 ? 'up' : 'down'}
              />
              <KPICard
                icon={<CheckCircle2 className="w-5 h-5" />}
                label="Eficiencia de Agendamento"
                value={`${metrics.schedulingEfficiency}%`}
                theme={THEME.emerald}
                trend={metrics.schedulingEfficiency >= 50 ? 'up' : 'down'}
              />
            </div>
          </section>

          {/* ─── Demografia ─── */}
          <section>
            <SectionHeader icon={<Users className="w-4 h-4" />} title="Demografia" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">

              {/* Genero */}
              <ChartCard title="Distribuicao por Genero">
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  <div className="w-full sm:w-2/5">
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie
                          data={genderData}
                          cx="50%"
                          cy="50%"
                          innerRadius={48}
                          outerRadius={78}
                          paddingAngle={3}
                          dataKey="value"
                          strokeWidth={0}
                        >
                          {genderData.map((entry, i) => (
                            <Cell key={i} fill={entry.fill} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 w-full space-y-3">
                    <LegendRow color={CHART_COLORS.male} label="Masculino" value={metrics.demographics.male.count} pct={metrics.demographics.male.percentage} />
                    <LegendRow color={CHART_COLORS.female} label="Feminino" value={metrics.demographics.female.count} pct={metrics.demographics.female.percentage} />
                    <div className="pt-3 border-t border-gray-100 dark:border-[#2e2e33]/50">
                      <p className="text-xs text-gray-400 dark:text-[#71717a] text-center font-medium">
                        Total: {metrics.demographics.total} pacientes
                      </p>
                    </div>
                  </div>
                </div>
              </ChartCard>

              {/* Novos vs Recorrentes */}
              <ChartCard title="Novos vs Recorrentes">
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  <div className="w-full sm:w-2/5">
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie
                          data={newRecurringData}
                          cx="50%"
                          cy="50%"
                          innerRadius={48}
                          outerRadius={78}
                          paddingAngle={3}
                          dataKey="value"
                          strokeWidth={0}
                        >
                          {newRecurringData.map((entry, i) => (
                            <Cell key={i} fill={entry.fill} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 w-full space-y-3">
                    <LegendRow color={CHART_COLORS.newPatient} label="Novos" value={metrics.demographics.new.count} pct={metrics.demographics.new.percentage} />
                    <LegendRow color={CHART_COLORS.recurring} label="Recorrentes" value={metrics.demographics.recurring.count} pct={metrics.demographics.recurring.percentage} />
                  </div>
                </div>
              </ChartCard>

              {/* Distribuicao Etaria */}
              <ChartCard title="Distribuicao Etaria">
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={ageData}>
                    <defs>
                      <linearGradient id="ageGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={THEME.violet.base} stopOpacity={0.2} />
                        <stop offset="100%" stopColor={THEME.violet.base} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" strokeOpacity={0.4} vertical={false} />
                    <XAxis
                      dataKey="age"
                      stroke="#94A3B8"
                      tick={{ fontSize: 11, fontWeight: 500 }}
                      axisLine={false}
                      tickLine={false}
                      label={{ value: 'Idade', position: 'insideBottom', offset: -5, style: { fill: '#94A3B8', fontSize: 11 } }}
                    />
                    <YAxis
                      stroke="#94A3B8"
                      tick={{ fontSize: 11, fontWeight: 500 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke={THEME.violet.base}
                      strokeWidth={2.5}
                      fill="url(#ageGrad)"
                      dot={{ fill: THEME.violet.base, r: 3, strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: THEME.violet.base, stroke: '#fff', strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* Procedimentos */}
              <ChartCard title="Procedimentos Realizados">
                <div className="flex flex-col items-center">
                  <div className="relative">
                    <ResponsiveContainer width={200} height={200}>
                      <PieChart>
                        <Pie
                          data={proceduresData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={3}
                          dataKey="value"
                          strokeWidth={0}
                        >
                          {proceduresData.map((entry, i) => (
                            <Cell key={i} fill={entry.fill} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    {/* Numero central */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-3xl font-bold text-gray-900 dark:text-gray-50">{metrics.procedures.total}</span>
                      <span className="text-xs text-gray-400 dark:text-[#71717a] font-medium">total</span>
                    </div>
                  </div>
                  <div className="flex gap-8 mt-4">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS.consultation }} />
                      <span className="text-sm text-gray-600 dark:text-[#a1a1aa]">Consulta <span className="font-semibold text-gray-900 dark:text-gray-200">{metrics.procedures.consultations.percentage}%</span></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS.returnVisit }} />
                      <span className="text-sm text-gray-600 dark:text-[#a1a1aa]">Retorno <span className="font-semibold text-gray-900 dark:text-gray-200">{metrics.procedures.returns.percentage}%</span></span>
                    </div>
                  </div>
                </div>
              </ChartCard>
            </div>
          </section>

          {/* ─── Tendencias ─── */}
          <section>
            <SectionHeader icon={<TrendingUp className="w-4 h-4" />} title="Tendencias" />
            <div className="space-y-5">
              {/* Atendimentos ao longo do tempo */}
              <ChartCard title="Atendimentos ao Longo do Tempo">
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={timelineData}>
                    <defs>
                      <linearGradient id="timelineGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={THEME.teal.base} stopOpacity={0.15} />
                        <stop offset="100%" stopColor={THEME.teal.base} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" strokeOpacity={0.4} vertical={false} />
                    <XAxis
                      dataKey="date"
                      stroke="#94A3B8"
                      tick={{ fontSize: 11, fontWeight: 500 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => { const [d, m] = v.split('/'); return `${d}/${m}`; }}
                    />
                    <YAxis
                      stroke="#94A3B8"
                      tick={{ fontSize: 11, fontWeight: 500 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke={THEME.teal.base}
                      strokeWidth={2.5}
                      fill="url(#timelineGrad)"
                      dot={false}
                      activeDot={{ r: 5, fill: THEME.teal.base, stroke: '#fff', strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* Taxa de Comparecimento ao longo do tempo */}
              <ChartCard title="Taxa de Comparecimento ao Longo do Tempo">
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={attendanceTimelineData}>
                    <defs>
                      <linearGradient id="attendGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={THEME.emerald.base} stopOpacity={0.15} />
                        <stop offset="100%" stopColor={THEME.emerald.base} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" strokeOpacity={0.4} vertical={false} />
                    <XAxis
                      dataKey="date"
                      stroke="#94A3B8"
                      tick={{ fontSize: 11, fontWeight: 500 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => { const [d, m] = v.split('/'); return `${d}/${m}`; }}
                    />
                    <YAxis
                      stroke="#94A3B8"
                      tick={{ fontSize: 11, fontWeight: 500 }}
                      axisLine={false}
                      tickLine={false}
                      domain={[0, 100]}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip content={<CustomTooltip suffix="%" />} />
                    <Area
                      type="monotone"
                      dataKey="rate"
                      stroke={THEME.emerald.base}
                      strokeWidth={2.5}
                      fill="url(#attendGrad)"
                      dot={false}
                      activeDot={{ r: 5, fill: THEME.emerald.base, stroke: '#fff', strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
          </section>

          {/* Spacer inferior */}
          <div className="h-4" />
        </div>
      </main>
    </div>
  );
}


/* ════════════════════════════════════════════
   Componentes Auxiliares
   ════════════════════════════════════════════ */

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <div className="text-cyan-600 dark:text-cyan-400">{icon}</div>
      <h2 className="text-sm font-semibold text-gray-500 dark:text-[#a1a1aa] uppercase tracking-wider">{title}</h2>
    </div>
  );
}

function KPICard({
  icon, label, value, theme, trend,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  theme: { base: string; light: string; bg: string; ring: string };
  trend?: 'up' | 'down';
}) {
  return (
    <div className="group relative bg-white dark:bg-[#161B22] rounded-2xl border border-gray-100 dark:border-[#27272a]/50 p-5 sm:p-6 hover:shadow-lg hover:shadow-gray-200/50 dark:hover:shadow-black/20 transition-all duration-200 cursor-default">
      {/* Barra lateral de acento */}
      <div
        className="absolute left-0 top-4 bottom-4 w-1 rounded-r-full transition-all duration-200 group-hover:top-3 group-hover:bottom-3"
        style={{ backgroundColor: theme.base }}
      />

      <div className="flex items-start justify-between mb-4">
        <div
          className="p-2.5 rounded-xl"
          style={{ backgroundColor: `${theme.base}10`, color: theme.base }}
        >
          {icon}
        </div>
        {trend && (
          <div className={`flex items-center gap-0.5 text-xs font-semibold ${
            trend === 'up' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'
          }`}>
            {trend === 'up' ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
          </div>
        )}
      </div>

      <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-50 mb-1 tabular-nums tracking-tight">
        {value}
      </p>
      <p className="text-xs sm:text-sm text-gray-500 dark:text-[#a1a1aa] font-medium">{label}</p>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-[#161B22] rounded-2xl border border-gray-100 dark:border-[#27272a]/50 p-5 sm:p-6 hover:shadow-lg hover:shadow-gray-200/50 dark:hover:shadow-black/20 transition-all duration-200">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-[#d4d4d8] mb-5">{title}</h3>
      {children}
    </div>
  );
}

function LegendRow({ color, label, value, pct }: { color: string; label: string; value: number; pct: number }) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-[#1C2128]">
      <div className="flex items-center gap-2.5">
        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-sm text-gray-600 dark:text-[#d4d4d8] font-medium">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400 dark:text-[#71717a] font-medium">{value}</span>
        <span className="text-sm font-bold text-gray-900 dark:text-[#fafafa]">{pct}%</span>
      </div>
    </div>
  );
}

function CustomTooltip({ active, payload, label, suffix }: { active?: boolean; payload?: Array<{ value: number; color?: string }>; label?: string; suffix?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-[#1C2128] border border-gray-200 dark:border-[#2e2e33]/50 rounded-xl px-3.5 py-2.5 shadow-xl shadow-gray-200/30 dark:shadow-black/30">
      <p className="text-xs font-semibold text-gray-900 dark:text-[#fafafa] mb-0.5">{label}</p>
      <p className="text-sm font-bold" style={{ color: payload[0]?.color || THEME.teal.base }}>
        {payload[0]?.value}{suffix || ''}
      </p>
    </div>
  );
}
