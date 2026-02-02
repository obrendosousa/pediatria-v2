'use client';

import React, { useEffect, useState } from 'react';
import { 
  Calendar, CheckCircle2, UserCheck, XCircle, 
  Clock, TrendingUp, Activity, Users, Stethoscope
} from 'lucide-react';
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { fetchDashboardMetrics, DashboardMetrics } from '@/utils/dashboardMetrics';

// Interface movida para dashboardMetrics.ts

const COLORS = {
  primary: '#3b82f6',
  secondary: '#8b5cf6',
  success: '#10b981',
  danger: '#ef4444',
  warning: '#f59e0b',
  blue: ['#3b82f6', '#60a5fa'],
  orange: ['#f97316', '#fb923c'],
  purple: ['#8b5cf6', '#a78bfa'],
};

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState(30);

  useEffect(() => {
    fetchMetrics();
    // Auto-refresh a cada 5 minutos
    const interval = setInterval(fetchMetrics, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [period]);

  async function fetchMetrics() {
    setIsLoading(true);
    try {
      const calculatedMetrics = await fetchDashboardMetrics(period);
      setMetrics(calculatedMetrics);
    } catch (error) {
      console.error('Erro ao buscar métricas:', error);
    } finally {
      setIsLoading(false);
    }
  }

  // Preparar dados para gráficos
  const genderData = metrics ? [
    { name: 'Homens', value: metrics.demographics.male.count, fill: COLORS.blue[0] },
    { name: 'Mulheres', value: metrics.demographics.female.count, fill: COLORS.purple[0] },
  ] : [];

  const proceduresData = metrics ? [
    { name: 'Consulta', value: metrics.procedures.consultations.count, fill: COLORS.orange[1] },
    { name: 'Retorno', value: metrics.procedures.returns.count, fill: COLORS.orange[0] },
  ] : [];

  const timelineData = metrics ? Object.entries(metrics.timeline.appointmentsByDate)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => {
      const [dayA, monthA] = a.date.split('/');
      const [dayB, monthB] = b.date.split('/');
      return new Date(2024, parseInt(monthA) - 1, parseInt(dayA)).getTime() - 
             new Date(2024, parseInt(monthB) - 1, parseInt(dayB)).getTime();
    })
    .slice(-30) : [];

  const attendanceTimelineData = metrics ? Object.entries(metrics.timeline.attendanceRateByDate)
    .map(([date, rate]) => ({ date, rate }))
    .sort((a, b) => {
      const [dayA, monthA] = a.date.split('/');
      const [dayB, monthB] = b.date.split('/');
      return new Date(2024, parseInt(monthA) - 1, parseInt(dayA)).getTime() - 
             new Date(2024, parseInt(monthB) - 1, parseInt(dayB)).getTime();
    })
    .slice(-30) : [];

  const ageData = metrics ? Object.entries(metrics.demographics.ageDistribution)
    .map(([age, count]) => ({ age: `${age}`, count }))
    .sort((a, b) => parseInt(a.age) - parseInt(b.age)) : [];

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-[#0b141a] dark:to-[#11161d] min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 dark:border-blue-900 border-t-blue-600 dark:border-t-blue-400"></div>
          <p className="text-slate-500 dark:text-gray-400 font-medium">Carregando métricas...</p>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-[#0b141a] dark:to-[#11161d] min-h-screen">
        <div className="text-center p-8 bg-white dark:bg-[#1e2028] rounded-2xl shadow-lg border border-slate-200 dark:border-gray-800">
          <Activity className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-600 dark:text-gray-400 font-medium">Erro ao carregar métricas</p>
          <button 
            onClick={fetchMetrics}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-slate-50 via-slate-50 to-blue-50/30 dark:from-[#0b141a] dark:via-[#0b141a] dark:to-[#11161d] overflow-hidden">
      
      {/* Main Content */}
      <main className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
          
          {/* Header com Filtros */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-gray-50 mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Dashboard de Inteligência
              </h1>
              <p className="text-sm sm:text-base text-slate-600 dark:text-gray-400">Visão geral das operações da clínica</p>
            </div>
            <div className="flex gap-2 sm:gap-3">
              <select 
                value={period}
                onChange={(e) => setPeriod(parseInt(e.target.value))}
                className="px-3 sm:px-4 py-2 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-[#1e2028] text-slate-700 dark:text-gray-200 text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
              >
                <option value={7}>Últimos 7 dias</option>
                <option value={30}>Últimos 30 dias</option>
                <option value={90}>Últimos 90 dias</option>
              </select>
            </div>
          </div>

          {/* 1. VISÃO GERAL - Cards Principais */}
          <div className="mb-6">
            <h2 className="text-lg font-bold text-slate-700 dark:text-gray-300 mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600" />
              Visão Geral
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                icon={<Users className="w-5 h-5 sm:w-6 sm:h-6" />}
                label="Total de Pacientes"
                value={metrics.totalPatients}
                color={COLORS.primary}
                delay={0}
              />
              <MetricCard
                icon={<CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" />}
                label="Consultas Realizadas"
                value={metrics.totalConsultations}
                color={COLORS.success}
                delay={100}
              />
              <MetricCard
                icon={<TrendingUp className="w-5 h-5 sm:w-6 sm:h-6" />}
                label="Taxa de Comparecimento"
                value={`${metrics.attendanceRate}%`}
                color={COLORS.success}
                delay={200}
              />
              <MetricCard
                icon={<Clock className="w-5 h-5 sm:w-6 sm:h-6" />}
                label="Tempo Médio de Atendimento"
                value={`${metrics.averageServiceTime}min`}
                color={COLORS.primary}
                delay={300}
              />
            </div>
          </div>

          {/* 2. OPERACIONAL - Métricas Secundárias */}
          <div className="mb-6">
            <h2 className="text-lg font-bold text-slate-700 dark:text-gray-300 mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-purple-600" />
              Performance Operacional
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                icon={<TrendingUp className="w-5 h-5 sm:w-6 sm:h-6" />}
                label="Taxa de Conversão"
                value={`${metrics.conversionRate}%`}
                color={COLORS.secondary}
                delay={400}
              />
              <MetricCard
                icon={<Clock className="w-5 h-5 sm:w-6 sm:h-6" />}
                label="Tempo Médio na Fila"
                value={`${metrics.averageQueueTime}min`}
                color={COLORS.warning}
                delay={500}
              />
              <MetricCard
                icon={<XCircle className="w-5 h-5 sm:w-6 sm:h-6" />}
                label="Taxa de Cancelamento"
                value={`${metrics.cancellationRate}%`}
                color={COLORS.danger}
                delay={600}
              />
              <MetricCard
                icon={<CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" />}
                label="Eficiência de Agendamento"
                value={`${metrics.schedulingEfficiency}%`}
                color={COLORS.success}
                delay={700}
              />
            </div>
          </div>

          {/* 3. DEMOGRAFIA */}
          <div className="mb-6">
            <h2 className="text-lg font-bold text-slate-700 dark:text-gray-300 mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-600" />
              Demografia
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Distribuição de Gênero */}
              <ChartCard title="Distribuição por Gênero" icon={<Users className="w-5 h-5" />} delay={800}>
                <div className="flex flex-col sm:flex-row gap-6 items-center">
                  <div className="w-full sm:w-1/2 flex justify-center">
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie
                          data={genderData}
                          cx="50%"
                          cy="50%"
                          innerRadius={35}
                          outerRadius={70}
                          dataKey="value"
                        >
                          {genderData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-4 w-full">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-[#2a2d36]">
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded-full bg-blue-600"></div>
                        <span className="text-sm font-medium text-slate-700 dark:text-gray-300">Homens</span>
                      </div>
                      <span className="text-lg font-bold text-slate-900 dark:text-gray-100">
                        {metrics.demographics.male.percentage}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-[#2a2d36]">
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded-full bg-purple-600"></div>
                        <span className="text-sm font-medium text-slate-700 dark:text-gray-300">Mulheres</span>
                      </div>
                      <span className="text-lg font-bold text-slate-900 dark:text-gray-100">
                        {metrics.demographics.female.percentage}%
                      </span>
                    </div>
                    <div className="pt-3 border-t border-slate-200 dark:border-gray-700">
                      <p className="text-center text-sm font-bold text-slate-500 dark:text-gray-400">Total: {metrics.demographics.total}</p>
                    </div>
                  </div>
                </div>
              </ChartCard>

              {/* Novos vs Recorrentes */}
              <ChartCard title="Novos vs Recorrentes" icon={<Users className="w-5 h-5" />} delay={900}>
                <div className="flex flex-col sm:flex-row gap-6 items-center">
                  <div className="w-full sm:w-1/2 flex justify-center">
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie
                          data={[{ name: 'Novos', value: metrics.demographics.new.count }, { name: 'Recorrentes', value: metrics.demographics.recurring.count }]}
                          cx="50%"
                          cy="50%"
                          innerRadius={35}
                          outerRadius={70}
                          dataKey="value"
                        >
                          <Cell fill={COLORS.blue[1]} />
                          <Cell fill={COLORS.blue[0]} />
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-4 w-full">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-[#2a2d36]">
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded-full bg-blue-400"></div>
                        <span className="text-sm font-medium text-slate-700 dark:text-gray-300">Novos</span>
                      </div>
                      <span className="text-lg font-bold text-slate-900 dark:text-gray-100">
                        {metrics.demographics.new.percentage}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-[#2a2d36]">
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded-full bg-blue-600"></div>
                        <span className="text-sm font-medium text-slate-700 dark:text-gray-300">Recorrentes</span>
                      </div>
                      <span className="text-lg font-bold text-slate-900 dark:text-gray-100">
                        {metrics.demographics.recurring.percentage}%
                      </span>
                    </div>
                  </div>
                </div>
              </ChartCard>

              {/* Distribuição Etária */}
              <ChartCard title="Distribuição Etária" icon={<Users className="w-5 h-5" />} delay={1000}>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={ageData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
                    <XAxis 
                      dataKey="age" 
                      stroke="#94a3b8" 
                      style={{ fontSize: '11px', fontWeight: 500 }}
                      label={{ value: 'Idade (anos)', position: 'insideBottom', offset: -5, style: { fill: '#94a3b8', fontSize: '11px' } }}
                    />
                    <YAxis 
                      stroke="#94a3b8" 
                      style={{ fontSize: '11px', fontWeight: 500 }}
                      label={{ value: 'Pacientes', angle: -90, position: 'insideLeft', style: { fill: '#94a3b8', fontSize: '11px' } }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#1e2028', 
                        border: '1px solid #334155', 
                        borderRadius: '12px',
                        padding: '12px'
                      }}
                      labelStyle={{ color: '#e2e8f0', fontWeight: 600 }}
                      itemStyle={{ color: '#94a3b8' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="count" 
                      stroke={COLORS.secondary} 
                      strokeWidth={3}
                      dot={{ fill: COLORS.secondary, r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* Procedimentos */}
              <ChartCard title="Procedimentos Realizados" icon={<Stethoscope className="w-5 h-5" />} delay={1100}>
                <div className="text-center">
                  <p className="text-4xl font-black text-slate-900 dark:text-gray-100 mb-6 bg-gradient-to-r from-orange-500 to-orange-600 bg-clip-text text-transparent">
                    {metrics.procedures.total}
                  </p>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={proceduresData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={80}
                        dataKey="value"
                      >
                        {proceduresData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex gap-6 justify-center mt-6">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-orange-400"></div>
                      <span className="text-xs font-medium text-slate-600 dark:text-gray-400">Consulta {metrics.procedures.consultations.percentage}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-orange-600"></div>
                      <span className="text-xs font-medium text-slate-600 dark:text-gray-400">Retorno {metrics.procedures.returns.percentage}%</span>
                    </div>
                  </div>
                </div>
              </ChartCard>
            </div>
          </div>

          {/* 4. TENDÊNCIAS */}
          <div className="mb-6">
            <h2 className="text-lg font-bold text-slate-700 dark:text-gray-300 mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              Tendências
            </h2>
            <div className="space-y-4">
              {/* Gráfico de Atendimentos */}
              <ChartCard title="Atendimentos ao Longo do Tempo" icon={<TrendingUp className="w-5 h-5" />} delay={1200}>
                <ResponsiveContainer width="100%" height={320}>
                  <AreaChart data={timelineData}>
                    <defs>
                      <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
                    <XAxis 
                      dataKey="date" 
                      stroke="#94a3b8"
                      style={{ fontSize: '11px', fontWeight: 500 }}
                      tickFormatter={(value) => {
                        const [day, month] = value.split('/');
                        return `${day}/${month}`;
                      }}
                    />
                    <YAxis stroke="#94a3b8" style={{ fontSize: '11px', fontWeight: 500 }} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#1e2028', 
                        border: '1px solid #334155', 
                        borderRadius: '12px',
                        padding: '12px'
                      }}
                      labelStyle={{ color: '#e2e8f0', fontWeight: 600 }}
                      itemStyle={{ color: '#94a3b8' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="count" 
                      stroke={COLORS.primary} 
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#colorCount)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* Gráfico de Taxa de Comparecimento */}
              <ChartCard title="Taxa de Comparecimento ao Longo do Tempo" icon={<TrendingUp className="w-5 h-5" />} delay={1300}>
                <ResponsiveContainer width="100%" height={320}>
                  <AreaChart data={attendanceTimelineData}>
                    <defs>
                      <linearGradient id="colorAttendance" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.success} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={COLORS.success} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
                    <XAxis 
                      dataKey="date" 
                      stroke="#94a3b8"
                      style={{ fontSize: '11px', fontWeight: 500 }}
                      tickFormatter={(value) => {
                        const [day, month] = value.split('/');
                        return `${day}/${month}`;
                      }}
                    />
                    <YAxis 
                      stroke="#94a3b8" 
                      style={{ fontSize: '11px', fontWeight: 500 }}
                      domain={[0, 100]}
                      label={{ value: 'Taxa (%)', angle: -90, position: 'insideLeft', style: { fill: '#94a3b8', fontSize: '11px' } }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#1e2028', 
                        border: '1px solid #334155', 
                        borderRadius: '12px',
                        padding: '12px'
                      }}
                      labelStyle={{ color: '#e2e8f0', fontWeight: 600 }}
                      itemStyle={{ color: '#94a3b8' }}
                      formatter={(value: any) => `${value}%`}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="rate" 
                      stroke={COLORS.success} 
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#colorAttendance)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

// Componentes auxiliares
function MetricCard({ 
  icon, 
  label, 
  value, 
  color, 
  delay = 0 
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: number | string; 
  color: string;
  delay?: number;
}) {
  return (
    <div 
      className="group relative bg-white dark:bg-[#1e2028] rounded-2xl border border-slate-200/60 dark:border-gray-800/60 p-5 sm:p-6 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 animate-in fade-in slide-in-from-bottom-4"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white to-slate-50 dark:from-[#1e2028] dark:to-[#252830] rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity -z-10"></div>
      <div className="flex items-center justify-between mb-4">
        <div 
          className="p-3 rounded-xl transition-transform group-hover:scale-110"
          style={{ backgroundColor: `${color}15`, color }}
        >
          {icon}
        </div>
      </div>
      <p className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-gray-50 mb-2">{value}</p>
      <p className="text-sm font-medium text-slate-600 dark:text-gray-400">{label}</p>
    </div>
  );
}

function ChartCard({ 
  title, 
  children, 
  icon,
  delay = 0 
}: { 
  title: string; 
  children: React.ReactNode;
  icon?: React.ReactNode;
  delay?: number;
}) {
  return (
    <div 
      className="bg-white dark:bg-[#1e2028] rounded-2xl border border-slate-200/60 dark:border-gray-800/60 p-5 sm:p-6 shadow-sm hover:shadow-lg transition-all duration-300 animate-in fade-in slide-in-from-bottom-4"
      style={{ animationDelay: `${delay}ms` }}
    >
      <h3 className="text-lg font-black text-slate-900 dark:text-gray-100 mb-6 flex items-center gap-2">
        {icon && <span className="text-blue-600">{icon}</span>}
        {title}
      </h3>
      {children}
    </div>
  );
}
