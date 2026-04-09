'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Users, CheckCircle2, XCircle, Clock, TrendingUp,
  Activity, ArrowUpRight, ArrowDownRight,
  CalendarCheck, Timer, UserCheck, BarChart3,
  Target, ShieldCheck
} from 'lucide-react';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Area, AreaChart, BarChart, Bar
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchDashboardMetrics, DashboardMetrics } from '@/utils/dashboardMetrics';
import { DonutChart, DonutChartSegment } from '@/components/ui/donut-chart';
import { AnimatedRadialChart } from '@/components/ui/animated-radial-chart';
import { cn } from '@/lib/utils';

// ─── Design Tokens ───
const COLORS = {
  chart: {
    indigo: '#6366F1',
    violet: '#8B5CF6',
    cyan: '#06B6D4',
    emerald: '#10B981',
    amber: '#F59E0B',
    rose: '#F43F5E',
    teal: '#14B8A6',
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
  }),
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as const } },
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

  // ─── Dados dos gráficos ───
  const genderData = useMemo<DonutChartSegment[]>(() => metrics ? [
    { name: 'Masculino', value: metrics.demographics.male.count, color: COLORS.chart.indigo, label: 'Masculino' },
    { name: 'Feminino', value: metrics.demographics.female.count, color: COLORS.chart.violet, label: 'Feminino' },
  ] : [], [metrics]);

  const newRecurringData = useMemo<DonutChartSegment[]>(() => metrics ? [
    { name: 'Novos', value: metrics.demographics.new.count, color: COLORS.chart.cyan, label: 'Novos' },
    { name: 'Recorrentes', value: metrics.demographics.recurring.count, color: COLORS.chart.teal, label: 'Recorrentes' },
  ] : [], [metrics]);

  const proceduresData = useMemo<DonutChartSegment[]>(() => metrics ? [
    { name: 'Consulta', value: metrics.procedures.consultations.count, color: COLORS.chart.emerald, label: 'Consulta' },
    { name: 'Retorno', value: metrics.procedures.returns.count, color: COLORS.chart.amber, label: 'Retorno' },
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

  // ─── Loading ───
  if (isLoading) {
    return (
      <div className="flex flex-col h-screen bg-[#FAFBFC] dark:bg-[#0A0B0F] overflow-hidden">
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-[1480px] mx-auto px-6 py-8 space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-3">
                <div className="h-9 w-80 bg-gray-100 dark:bg-white/5 rounded-2xl animate-pulse" />
                <div className="h-4 w-52 bg-gray-100 dark:bg-white/5 rounded-xl animate-pulse" />
              </div>
              <div className="h-11 w-44 bg-gray-100 dark:bg-white/5 rounded-2xl animate-pulse" />
            </div>
            <div className="grid grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-[130px] bg-white dark:bg-white/[0.03] rounded-2xl border border-gray-100 dark:border-white/[0.06] animate-pulse" />
              ))}
            </div>
            <div className="grid grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-[340px] bg-white dark:bg-white/[0.03] rounded-2xl border border-gray-100 dark:border-white/[0.06] animate-pulse" />
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#FAFBFC] dark:bg-[#0A0B0F] min-h-screen">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center p-10 bg-white dark:bg-white/[0.03] rounded-3xl shadow-sm border border-gray-100 dark:border-white/[0.06] max-w-sm"
        >
          <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center mx-auto mb-5">
            <Activity className="w-7 h-7 text-red-500" />
          </div>
          <p className="text-gray-900 dark:text-white font-semibold text-lg mb-2">Erro ao carregar</p>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">Nao foi possivel conectar ao banco de dados.</p>
          <button
            onClick={fetchMetrics}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-all cursor-pointer hover:shadow-lg hover:shadow-indigo-500/25"
          >
            Tentar novamente
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#FAFBFC] dark:bg-[#0A0B0F] overflow-hidden">
      <main className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-[1480px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">

          {/* ═══ Header ═══ */}
          <motion.header
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col sm:flex-row sm:items-end justify-between gap-4"
          >
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="relative">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
                    <BarChart3 className="w-5 h-5 text-white" />
                  </div>
                  {isRefreshing && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full animate-ping" />
                  )}
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                    Dashboard
                  </h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Visao geral das operacoes da clinica
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex bg-white dark:bg-white/[0.05] rounded-xl border border-gray-200 dark:border-white/[0.08] p-1 shadow-sm">
                {[
                  { value: 7, label: '7 dias' },
                  { value: 30, label: '30 dias' },
                  { value: 90, label: '90 dias' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setPeriod(opt.value)}
                    className={cn(
                      'px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer',
                      period === opt.value
                        ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/25'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/[0.05]'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </motion.header>

          {/* ═══ KPI Grid - Visao Geral ═══ */}
          <section>
            <SectionLabel label="Visao Geral" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard index={0} icon={<Users className="w-[18px] h-[18px]" />} label="Total de Pacientes" value={metrics.totalPatients} color="indigo" />
              <MetricCard index={1} icon={<CalendarCheck className="w-[18px] h-[18px]" />} label="Consultas Realizadas" value={metrics.totalConsultations} color="emerald" />
              <MetricCard index={2} icon={<UserCheck className="w-[18px] h-[18px]" />} label="Taxa de Comparecimento" value={`${metrics.attendanceRate}%`} color="cyan" trend={metrics.attendanceRate >= 70 ? 'up' : 'down'} trendLabel={metrics.attendanceRate >= 70 ? 'Saudavel' : 'Atencao'} />
              <MetricCard index={3} icon={<Timer className="w-[18px] h-[18px]" />} label="Tempo Medio Atendimento" value={`${metrics.averageServiceTime}min`} color="violet" />
            </div>
          </section>

          {/* ═══ KPI Grid - Performance ═══ */}
          <section>
            <SectionLabel label="Performance Operacional" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard index={4} icon={<TrendingUp className="w-[18px] h-[18px]" />} label="Taxa de Conversao" value={`${metrics.conversionRate}%`} color="emerald" trend={metrics.conversionRate >= 10 ? 'up' : 'down'} trendLabel={metrics.conversionRate >= 10 ? 'Bom' : 'Baixa'} />
              <MetricCard index={5} icon={<Clock className="w-[18px] h-[18px]" />} label="Tempo Medio na Fila" value={`${metrics.averageQueueTime}min`} color="amber" />
              <MetricCard index={6} icon={<XCircle className="w-[18px] h-[18px]" />} label="Taxa de Cancelamento" value={`${metrics.cancellationRate}%`} color="rose" trend={metrics.cancellationRate <= 10 ? 'up' : 'down'} trendLabel={metrics.cancellationRate <= 10 ? 'Otimo' : 'Alta'} />
              <MetricCard index={7} icon={<CheckCircle2 className="w-[18px] h-[18px]" />} label="Eficiencia Agendamento" value={`${metrics.schedulingEfficiency}%`} color="indigo" trend={metrics.schedulingEfficiency >= 50 ? 'up' : 'down'} trendLabel={metrics.schedulingEfficiency >= 50 ? 'Bom' : 'Baixa'} />
            </div>
          </section>

          {/* ═══ Charts - Demografia com DonutChart do 21st.dev ═══ */}
          <section>
            <SectionLabel label="Demografia & Procedimentos" />
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

              {/* Genero - DonutChart 21st.dev */}
              <motion.div variants={fadeUp} initial="hidden" animate="visible" className="lg:col-span-4">
                <GlassCard className="h-full">
                  <CardHeader title="Distribuicao por Genero" badge={`${metrics.demographics.total} pacientes`} />
                  <DonutChartSection
                    data={genderData}
                    centerValue={metrics.demographics.total}
                    centerLabel="total"
                    legends={[
                      { color: COLORS.chart.indigo, label: 'Masculino', value: metrics.demographics.male.count, pct: metrics.demographics.male.percentage },
                      { color: COLORS.chart.violet, label: 'Feminino', value: metrics.demographics.female.count, pct: metrics.demographics.female.percentage },
                    ]}
                  />
                </GlassCard>
              </motion.div>

              {/* Novos vs Recorrentes - DonutChart 21st.dev */}
              <motion.div variants={fadeUp} initial="hidden" animate="visible" className="lg:col-span-4">
                <GlassCard className="h-full">
                  <CardHeader title="Novos vs Recorrentes" badge="Retencao" />
                  <DonutChartSection
                    data={newRecurringData}
                    centerValue={`${metrics.demographics.new.percentage}%`}
                    centerLabel="novos"
                    legends={[
                      { color: COLORS.chart.cyan, label: 'Novos', value: metrics.demographics.new.count, pct: metrics.demographics.new.percentage },
                      { color: COLORS.chart.teal, label: 'Recorrentes', value: metrics.demographics.recurring.count, pct: metrics.demographics.recurring.percentage },
                    ]}
                  />
                </GlassCard>
              </motion.div>

              {/* Procedimentos - DonutChart 21st.dev */}
              <motion.div variants={fadeUp} initial="hidden" animate="visible" className="lg:col-span-4">
                <GlassCard className="h-full">
                  <CardHeader title="Procedimentos" badge={`${metrics.procedures.total} total`} />
                  <DonutChartSection
                    data={proceduresData}
                    centerValue={metrics.procedures.total}
                    centerLabel="total"
                    legends={[
                      { color: COLORS.chart.emerald, label: 'Consulta', value: metrics.procedures.consultations.count, pct: metrics.procedures.consultations.percentage },
                      { color: COLORS.chart.amber, label: 'Retorno', value: metrics.procedures.returns.count, pct: metrics.procedures.returns.percentage },
                    ]}
                  />
                </GlassCard>
              </motion.div>
            </div>
          </section>

          {/* ═══ Eficiencia Gauge (21st.dev AnimatedRadialChart) + Distribuicao Etaria ═══ */}
          <section>
            <SectionLabel label="Analise Detalhada" />
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

              {/* AnimatedRadialChart do 21st.dev */}
              <motion.div variants={fadeUp} initial="hidden" animate="visible" className="lg:col-span-4">
                <GlassCard className="h-full flex flex-col">
                  <CardHeader title="Eficiencia Geral" badge="Score" />
                  <div className="flex-1 flex flex-col items-center justify-center pt-2">
                    <AnimatedRadialChart
                      value={metrics.schedulingEfficiency}
                      size={220}
                      duration={1.5}
                      color="#6366F1"
                      showLabels
                    />
                    <div className="grid grid-cols-2 gap-3 w-full mt-2">
                      <MiniStat label="Conversao" value={`${metrics.conversionRate}%`} icon={<Target className="w-3.5 h-3.5" />} />
                      <MiniStat label="Comparecimento" value={`${metrics.attendanceRate}%`} icon={<ShieldCheck className="w-3.5 h-3.5" />} />
                    </div>
                  </div>
                </GlassCard>
              </motion.div>

              {/* Distribuicao Etaria - Bar Chart */}
              <motion.div variants={fadeUp} initial="hidden" animate="visible" className="lg:col-span-8">
                <GlassCard>
                  <CardHeader title="Distribuicao Etaria" badge="Idade dos pacientes" />
                  <div className="mt-4">
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={ageData} barSize={24}>
                        <defs>
                          <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={COLORS.chart.indigo} stopOpacity={0.9} />
                            <stop offset="100%" stopColor={COLORS.chart.violet} stopOpacity={0.6} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-gray-100 dark:text-white/[0.06]" vertical={false} />
                        <XAxis dataKey="age" stroke="currentColor" className="text-gray-400" tick={{ fontSize: 11, fontWeight: 500 }} axisLine={false} tickLine={false} label={{ value: 'Idade (anos)', position: 'insideBottom', offset: -5, style: { fill: '#9CA3AF', fontSize: 11 } }} />
                        <YAxis stroke="currentColor" className="text-gray-400" tick={{ fontSize: 11, fontWeight: 500 }} axisLine={false} tickLine={false} />
                        <Tooltip content={<DashTooltip />} />
                        <Bar dataKey="count" fill="url(#barGrad)" radius={[6, 6, 0, 0]} animationDuration={1000} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </GlassCard>
              </motion.div>
            </div>
          </section>

          {/* ═══ Tendencias ═══ */}
          <section>
            <SectionLabel label="Tendencias" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <motion.div variants={fadeUp} initial="hidden" animate="visible">
                <GlassCard>
                  <CardHeader title="Atendimentos ao Longo do Tempo" badge={`${period} dias`} />
                  <div className="mt-4">
                    <ResponsiveContainer width="100%" height={280}>
                      <AreaChart data={timelineData}>
                        <defs>
                          <linearGradient id="timelineGradNew" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={COLORS.chart.indigo} stopOpacity={0.2} />
                            <stop offset="100%" stopColor={COLORS.chart.indigo} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-gray-100 dark:text-white/[0.06]" vertical={false} />
                        <XAxis dataKey="date" stroke="currentColor" className="text-gray-400" tick={{ fontSize: 10, fontWeight: 500 }} axisLine={false} tickLine={false} tickFormatter={(v: string) => { const [d, m] = v.split('/'); return `${d}/${m}`; }} />
                        <YAxis stroke="currentColor" className="text-gray-400" tick={{ fontSize: 10, fontWeight: 500 }} axisLine={false} tickLine={false} />
                        <Tooltip content={<DashTooltip />} />
                        <Area type="monotone" dataKey="count" stroke={COLORS.chart.indigo} strokeWidth={2.5} fill="url(#timelineGradNew)" dot={false} activeDot={{ r: 5, fill: COLORS.chart.indigo, stroke: '#fff', strokeWidth: 2 }} animationDuration={1200} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </GlassCard>
              </motion.div>

              <motion.div variants={fadeUp} initial="hidden" animate="visible">
                <GlassCard>
                  <CardHeader title="Taxa de Comparecimento" badge="Evolucao" />
                  <div className="mt-4">
                    <ResponsiveContainer width="100%" height={280}>
                      <AreaChart data={attendanceTimelineData}>
                        <defs>
                          <linearGradient id="attendGradNew" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={COLORS.chart.emerald} stopOpacity={0.2} />
                            <stop offset="100%" stopColor={COLORS.chart.emerald} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-gray-100 dark:text-white/[0.06]" vertical={false} />
                        <XAxis dataKey="date" stroke="currentColor" className="text-gray-400" tick={{ fontSize: 10, fontWeight: 500 }} axisLine={false} tickLine={false} tickFormatter={(v: string) => { const [d, m] = v.split('/'); return `${d}/${m}`; }} />
                        <YAxis stroke="currentColor" className="text-gray-400" tick={{ fontSize: 10, fontWeight: 500 }} axisLine={false} tickLine={false} domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} />
                        <Tooltip content={<DashTooltip suffix="%" />} />
                        <Area type="monotone" dataKey="rate" stroke={COLORS.chart.emerald} strokeWidth={2.5} fill="url(#attendGradNew)" dot={false} activeDot={{ r: 5, fill: COLORS.chart.emerald, stroke: '#fff', strokeWidth: 2 }} animationDuration={1200} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </GlassCard>
              </motion.div>
            </div>
          </section>

          <div className="h-4" />
        </div>
      </main>
    </div>
  );
}


/* ════════════════════════════════════════════
   Componentes Auxiliares
   ════════════════════════════════════════════ */

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="w-1 h-4 rounded-full bg-gradient-to-b from-indigo-500 to-violet-500" />
      <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{label}</h2>
    </div>
  );
}

const colorMap: Record<string, { gradient: string; bg: string; text: string }> = {
  indigo: { gradient: 'from-indigo-500 to-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-500/10', text: 'text-indigo-600 dark:text-indigo-400' },
  emerald: { gradient: 'from-emerald-500 to-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400' },
  cyan: { gradient: 'from-cyan-500 to-cyan-600', bg: 'bg-cyan-50 dark:bg-cyan-500/10', text: 'text-cyan-600 dark:text-cyan-400' },
  violet: { gradient: 'from-violet-500 to-violet-600', bg: 'bg-violet-50 dark:bg-violet-500/10', text: 'text-violet-600 dark:text-violet-400' },
  amber: { gradient: 'from-amber-500 to-amber-600', bg: 'bg-amber-50 dark:bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400' },
  rose: { gradient: 'from-rose-500 to-rose-600', bg: 'bg-rose-50 dark:bg-rose-500/10', text: 'text-rose-600 dark:text-rose-400' },
};

function MetricCard({ icon, label, value, color, trend, trendLabel, index = 0 }: {
  icon: React.ReactNode; label: string; value: number | string; color: string;
  trend?: 'up' | 'down'; trendLabel?: string; index?: number;
}) {
  const c = colorMap[color] || colorMap.indigo;
  return (
    <motion.div
      custom={index}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
      className="group relative bg-white dark:bg-white/[0.03] rounded-2xl border border-gray-100 dark:border-white/[0.06] p-5 hover:shadow-xl hover:shadow-gray-200/40 dark:hover:shadow-black/20 transition-shadow duration-300 cursor-default overflow-hidden"
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${c.gradient} opacity-0 group-hover:opacity-[0.03] transition-opacity duration-300 rounded-2xl`} />
      <div className="relative flex items-start justify-between mb-3">
        <div className={`p-2 rounded-xl ${c.bg}`}>
          <div className={c.text}>{icon}</div>
        </div>
        {trend && (
          <div className={cn(
            'flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold',
            trend === 'up' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-500/10 text-rose-500 dark:text-rose-400'
          )}>
            {trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {trendLabel}
          </div>
        )}
      </div>
      <p className="relative text-2xl font-bold text-gray-900 dark:text-white tabular-nums tracking-tight mb-0.5">{value}</p>
      <p className="relative text-xs text-gray-500 dark:text-gray-400 font-medium">{label}</p>
    </motion.div>
  );
}

function GlassCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('bg-white dark:bg-white/[0.03] rounded-2xl border border-gray-100 dark:border-white/[0.06] p-5 sm:p-6 hover:shadow-xl hover:shadow-gray-200/40 dark:hover:shadow-black/20 transition-shadow duration-300', className)}>
      {children}
    </div>
  );
}

function CardHeader({ title, badge }: { title: string; badge?: string }) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">{title}</h3>
      {badge && (
        <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-white/[0.05] px-2.5 py-1 rounded-lg">{badge}</span>
      )}
    </div>
  );
}

/** Seção reutilizável com DonutChart do 21st.dev + legend */
function DonutChartSection({ data, centerValue, centerLabel, legends }: {
  data: DonutChartSegment[];
  centerValue: number | string;
  centerLabel: string;
  legends: Array<{ color: string; label: string; value: number; pct: number }>;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const activeItem = legends.find(l => l.label === hovered);
  const displayValue = activeItem?.value ?? centerValue;
  const displayLabel = activeItem?.label ?? centerLabel;

  return (
    <div className="flex flex-col items-center mt-3">
      <DonutChart
        data={data}
        size={180}
        strokeWidth={24}
        animationDuration={1}
        animationDelayPerSegment={0.08}
        highlightOnHover
        onSegmentHover={(seg) => setHovered(seg?.label ?? null)}
        centerContent={
          <AnimatePresence mode="wait">
            <motion.div
              key={displayLabel}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col items-center justify-center text-center"
            >
              <span className="text-2xl font-bold text-gray-900 dark:text-white">{displayValue}</span>
              <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">{displayLabel}</span>
            </motion.div>
          </AnimatePresence>
        }
      />
      <div className="w-full space-y-2 mt-3">
        {legends.map((leg) => (
          <motion.div
            key={leg.label}
            className={cn(
              'flex items-center justify-between px-3 py-2.5 rounded-xl bg-gray-50/80 dark:bg-white/[0.03] border border-transparent transition-colors cursor-pointer',
              hovered === leg.label && 'border-gray-200 dark:border-white/[0.08] bg-gray-100/80 dark:bg-white/[0.06]'
            )}
            onMouseEnter={() => setHovered(leg.label)}
            onMouseLeave={() => setHovered(null)}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: leg.color }} />
              <span className="text-sm text-gray-600 dark:text-gray-300 font-medium">{leg.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 tabular-nums">{leg.value}</span>
              <span className="text-sm font-bold text-gray-900 dark:text-white tabular-nums">{leg.pct}%</span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function MiniStat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-gray-50/80 dark:bg-white/[0.03] border border-gray-100 dark:border-white/[0.06]">
      <div className="text-indigo-500 dark:text-indigo-400">{icon}</div>
      <span className="text-sm font-bold text-gray-900 dark:text-white tabular-nums">{value}</span>
      <span className="text-[10px] text-gray-400 font-medium">{label}</span>
    </div>
  );
}

function DashTooltip({ active, payload, label, suffix }: {
  active?: boolean; payload?: Array<{ value: number }>; label?: string; suffix?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-[#1a1a2e] border border-gray-200 dark:border-white/[0.1] rounded-xl px-4 py-3 shadow-2xl shadow-gray-300/30 dark:shadow-black/40 backdrop-blur-xl">
      <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <p className="text-base font-bold text-gray-900 dark:text-white tabular-nums">{payload[0]?.value}{suffix || ''}</p>
    </div>
  );
}
