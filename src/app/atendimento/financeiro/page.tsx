'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  DollarSign, TrendingUp, ShoppingBag, Receipt, PieChart,
  Calendar, Loader2, BarChart3, Users, Stethoscope,
} from 'lucide-react';
import CommissionDashboard from '@/components/finance/CommissionDashboard';

// --- Types ---

type PeriodPreset = 'today' | '7d' | '30d' | 'custom';
type TabKey = 'overview' | 'commissions' | 'closure';

interface OverviewData {
  kpis: {
    totalRevenue: number;
    consultationRevenue: number;
    storeRevenue: number;
    storeCost: number;
    grossProfit: number;
  };
  charts: {
    revenueByDay: Array<{ date: string; revenue: number }>;
    revenueByOrigin: Array<{ name: string; value: number }>;
    revenueByPaymentMethod: Array<{ name: string; value: number }>;
  };
  bestClients: Array<{ name: string; total: number; visits: number }>;
}

interface ClosureData {
  totals: {
    totalsByMethod: Record<string, number>;
    totalsByOrigin: Record<string, number>;
    totalAmount: number;
  };
  logs: Array<{
    id: number;
    occurred_at: string;
    origin: string;
    attendance_type: string;
    patient_name: string;
    amount: number;
    payment_methods: Array<{ method: string; amount: number }>;
  }>;
}

interface CommissionsData {
  summary: {
    total_faturamento: number;
    consultation_revenue: number;
    total_commissions: number;
    total_clinic: number;
    pending_commissions: number;
    paid_commissions: number;
  };
  by_professional: Array<{
    professional_id: string;
    doctor_id: number | null;
    doctor_name: string;
    total_revenue: number;
    total_commission: number;
    clinic_amount: number;
    pending: number;
    paid: number;
    appointments_count: number;
    procedures: Array<{ name: string; count: number; total: number; commission: number }>;
  }>;
  recent_payments: Array<{
    id: number;
    doctor_name: string;
    total_commission: number;
    status: 'pending' | 'paid' | 'cancelled';
    created_at: string;
    appointment_id: number | null;
  }>;
}

// --- Helpers ---

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDateBR(iso: string) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

const METHOD_LABELS: Record<string, string> = { pix: 'PIX', cash: 'Dinheiro', credit_card: 'Crédito', debit_card: 'Débito' };
const METHOD_COLORS: Record<string, string> = { pix: 'bg-teal-500', cash: 'bg-emerald-500', credit_card: 'bg-blue-500', debit_card: 'bg-purple-500' };
const ORIGIN_LABELS: Record<string, string> = { atendimento: 'Consultas', loja: 'Loja' };

const PERIOD_OPTIONS: { key: PeriodPreset; label: string }[] = [
  { key: 'today', label: 'Hoje' },
  { key: '7d', label: '7 dias' },
  { key: '30d', label: '30 dias' },
  { key: 'custom', label: 'Personalizado' },
];

const TABS: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'overview', label: 'Visão Geral', icon: BarChart3 },
  { key: 'commissions', label: 'Repasse Médico', icon: Stethoscope },
  { key: 'closure', label: 'Fechamento de Caixa', icon: Receipt },
];

// --- Page ---

export default function FinanceiroPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [preset, setPreset] = useState<PeriodPreset>('today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [loading, setLoading] = useState(true);

  const [overviewData, setOverviewData] = useState<OverviewData | null>(null);
  const [closureData, setClosureData] = useState<ClosureData | null>(null);
  const [commissionsData, setCommissionsData] = useState<CommissionsData | null>(null);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set('preset', preset);
    if (preset === 'custom' && customStart && customEnd) {
      params.set('start', customStart);
      params.set('end', customEnd);
    }
    return params.toString();
  }, [preset, customStart, customEnd]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [ovRes, clRes, cmRes] = await Promise.all([
        fetch(`/api/finance/overview?${queryString}`),
        fetch(`/api/finance/closures?${queryString}`),
        fetch(`/api/finance/commissions?${queryString}`),
      ]);
      if (ovRes.ok) setOverviewData(await ovRes.json());
      if (clRes.ok) setClosureData(await clRes.json());
      if (cmRes.ok) setCommissionsData(await cmRes.json());
    } catch (err) {
      console.error('Erro ao carregar dados financeiros:', err);
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleMarkAsPaid = async (paymentId: number) => {
    const res = await fetch('/api/finance/commissions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_id: paymentId, status: 'paid' }),
    });
    if (res.ok) fetchData();
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-[#08080b]">
      {/* Header */}
      <div className="px-6 py-4 bg-white dark:bg-[#111118] border-b border-slate-200 dark:border-[#252530]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-teal-50 dark:bg-teal-900/20">
              <DollarSign className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800 dark:text-[#fafafa]">Financeiro</h1>
              <p className="text-xs text-slate-400 dark:text-[#71717a]">Clínica Geral — Faturamento e Repasse</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {PERIOD_OPTIONS.map(opt => (
              <button
                key={opt.key}
                onClick={() => setPreset(opt.key)}
                className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${
                  preset === opt.key
                    ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                    : 'bg-white dark:bg-[#1a1a22] text-slate-600 dark:text-[#d4d4d8] border-slate-200 dark:border-[#252530] hover:border-teal-400'
                }`}
              >
                {opt.label}
              </button>
            ))}
            {preset === 'custom' && (
              <div className="flex items-center gap-2 ml-2">
                <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
                  className="px-2 py-1.5 text-xs border border-slate-200 dark:border-[#252530] rounded-lg bg-white dark:bg-[#1a1a22] text-slate-700 dark:text-gray-200" />
                <span className="text-xs text-slate-400">até</span>
                <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                  className="px-2 py-1.5 text-xs border border-slate-200 dark:border-[#252530] rounded-lg bg-white dark:bg-[#1a1a22] text-slate-700 dark:text-gray-200" />
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mt-4 border-b border-slate-100 dark:border-[#1e1e28]">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-all border-b-2 -mb-px ${
                activeTab === tab.key
                  ? 'text-teal-600 dark:text-teal-400 border-teal-600 dark:border-teal-400'
                  : 'text-slate-500 dark:text-[#71717a] border-transparent hover:text-slate-700 dark:hover:text-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading && !overviewData ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
          </div>
        ) : (
          <>
            {activeTab === 'overview' && overviewData && <OverviewTab data={overviewData} />}
            {activeTab === 'commissions' && (
              <CommissionDashboard data={commissionsData} loading={loading && !commissionsData} onMarkAsPaid={handleMarkAsPaid} />
            )}
            {activeTab === 'closure' && closureData && <ClosureTab data={closureData} commissions={commissionsData} />}
          </>
        )}
      </div>
    </div>
  );
}

// ======================================================================
// Overview Tab
// ======================================================================

function OverviewTab({ data }: { data: OverviewData }) {
  const { kpis, charts, bestClients } = data;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KPICard title="Faturamento Total" value={formatCurrency(kpis.totalRevenue)} icon={DollarSign} color="teal" />
        <KPICard title="Consultas" value={formatCurrency(kpis.consultationRevenue)} icon={Stethoscope} color="blue" />
        <KPICard title="Loja" value={formatCurrency(kpis.storeRevenue)} icon={ShoppingBag} color="purple" />
        <KPICard title="Custo" value={formatCurrency(kpis.storeCost)} icon={Receipt} color="red" />
        <KPICard title="Lucro" value={formatCurrency(kpis.grossProfit)} icon={TrendingUp} color="emerald" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by Day */}
        <div className="bg-white dark:bg-[#111118] rounded-2xl border border-slate-200 dark:border-[#252530] p-5">
          <h3 className="text-sm font-bold text-slate-700 dark:text-[#fafafa] mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-teal-500" /> Faturamento por Dia
          </h3>
          {charts.revenueByDay.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-8">Sem dados no período</p>
          ) : (
            <div className="space-y-2">
              {charts.revenueByDay.map(day => {
                const max = Math.max(...charts.revenueByDay.map(d => d.revenue), 1);
                const pct = (day.revenue / max) * 100;
                return (
                  <div key={day.date} className="flex items-center gap-3">
                    <span className="text-[10px] text-slate-400 w-16 shrink-0">{formatDateBR(day.date)}</span>
                    <div className="flex-1 h-6 bg-slate-100 dark:bg-[#1a1a22] rounded-lg overflow-hidden">
                      <div className="h-full bg-teal-500 dark:bg-teal-600 rounded-lg transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-mono text-slate-700 dark:text-gray-300 w-24 text-right">{formatCurrency(day.revenue)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-6">
          {/* By Origin */}
          <div className="bg-white dark:bg-[#111118] rounded-2xl border border-slate-200 dark:border-[#252530] p-5">
            <h3 className="text-sm font-bold text-slate-700 dark:text-[#fafafa] mb-4 flex items-center gap-2">
              <PieChart className="w-4 h-4 text-teal-500" /> Origem da Receita
            </h3>
            <div className="space-y-3">
              {charts.revenueByOrigin.map(item => {
                const total = charts.revenueByOrigin.reduce((s, i) => s + i.value, 0) || 1;
                const pct = Math.round((item.value / total) * 100);
                return (
                  <div key={item.name} className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full shrink-0 ${item.name === 'atendimento' ? 'bg-teal-500' : 'bg-purple-500'}`} />
                    <span className="text-xs text-slate-600 dark:text-[#d4d4d8] flex-1">{ORIGIN_LABELS[item.name] || item.name}</span>
                    <span className="text-xs font-mono text-slate-700 dark:text-gray-300">{formatCurrency(item.value)}</span>
                    <span className="text-[10px] text-slate-400 w-10 text-right">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* By Payment Method */}
          <div className="bg-white dark:bg-[#111118] rounded-2xl border border-slate-200 dark:border-[#252530] p-5">
            <h3 className="text-sm font-bold text-slate-700 dark:text-[#fafafa] mb-4 flex items-center gap-2">
              <PieChart className="w-4 h-4 text-teal-500" /> Formas de Pagamento
            </h3>
            <div className="space-y-3">
              {charts.revenueByPaymentMethod.map(item => {
                const total = charts.revenueByPaymentMethod.reduce((s, i) => s + i.value, 0) || 1;
                const pct = Math.round((item.value / total) * 100);
                return (
                  <div key={item.name} className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full shrink-0 ${METHOD_COLORS[item.name] || 'bg-slate-400'}`} />
                    <span className="text-xs text-slate-600 dark:text-[#d4d4d8] flex-1">{METHOD_LABELS[item.name] || item.name}</span>
                    <span className="text-xs font-mono text-slate-700 dark:text-gray-300">{formatCurrency(item.value)}</span>
                    <span className="text-[10px] text-slate-400 w-10 text-right">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {bestClients.length > 0 && (
        <div className="bg-white dark:bg-[#111118] rounded-2xl border border-slate-200 dark:border-[#252530] p-5">
          <h3 className="text-sm font-bold text-slate-700 dark:text-[#fafafa] mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-teal-500" /> Top Pacientes
          </h3>
          <div className="space-y-2">
            {bestClients.slice(0, 5).map((client, i) => (
              <div key={client.name} className="flex items-center gap-3 py-2 border-b border-slate-50 dark:border-[#1e1e28] last:border-0">
                <span className="w-6 h-6 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center text-[10px] font-bold text-teal-700 dark:text-teal-300">{i + 1}</span>
                <span className="text-sm text-slate-700 dark:text-gray-200 flex-1 truncate">{client.name}</span>
                <span className="text-xs text-slate-400">{client.visits} visita{client.visits !== 1 ? 's' : ''}</span>
                <span className="text-sm font-mono font-semibold text-teal-600 dark:text-teal-400">{formatCurrency(client.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ======================================================================
// Closure Tab
// ======================================================================

function ClosureTab({ data, commissions }: { data: ClosureData; commissions: CommissionsData | null }) {
  const { totals, logs } = data;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(totals.totalsByMethod).map(([method, amount]) => (
          <div key={method} className="bg-white dark:bg-[#111118] rounded-2xl border border-slate-200 dark:border-[#252530] p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-3 h-3 rounded-full ${METHOD_COLORS[method] || 'bg-slate-400'}`} />
              <span className="text-xs font-bold text-slate-500 dark:text-[#a1a1aa] uppercase">{METHOD_LABELS[method] || method}</span>
            </div>
            <p className="text-xl font-bold text-slate-800 dark:text-[#fafafa]">{formatCurrency(amount)}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-[#111118] rounded-2xl border border-slate-200 dark:border-[#252530] p-5">
          <span className="text-xs font-bold text-slate-500 dark:text-[#a1a1aa] uppercase">Total do Dia</span>
          <p className="text-2xl font-bold text-teal-600 dark:text-teal-400 mt-1">{formatCurrency(totals.totalAmount)}</p>
        </div>
        {Object.entries(totals.totalsByOrigin).map(([origin, amount]) => (
          <div key={origin} className="bg-white dark:bg-[#111118] rounded-2xl border border-slate-200 dark:border-[#252530] p-5">
            <span className="text-xs font-bold text-slate-500 dark:text-[#a1a1aa] uppercase">{ORIGIN_LABELS[origin] || origin}</span>
            <p className="text-xl font-bold text-slate-800 dark:text-[#fafafa] mt-1">{formatCurrency(amount)}</p>
          </div>
        ))}
      </div>

      {commissions && commissions.summary.total_commissions > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-amber-800 dark:text-amber-300 mb-3 flex items-center gap-2">
            <Stethoscope className="w-4 h-4" /> Comissões do Período
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-[10px] text-amber-600 dark:text-amber-400 uppercase font-bold">Total Comissões</p>
              <p className="text-lg font-bold text-amber-700 dark:text-amber-300">{formatCurrency(commissions.summary.total_commissions)}</p>
            </div>
            <div>
              <p className="text-[10px] text-amber-600 dark:text-amber-400 uppercase font-bold">Pendente</p>
              <p className="text-lg font-bold text-amber-700 dark:text-amber-300">{formatCurrency(commissions.summary.pending_commissions)}</p>
            </div>
            <div>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-bold">Receita Líq. Clínica</p>
              <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{formatCurrency(commissions.summary.total_clinic)}</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-[#111118] rounded-2xl border border-slate-200 dark:border-[#252530] overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-[#1e1e28]">
          <h3 className="text-sm font-bold text-slate-800 dark:text-[#fafafa] uppercase tracking-wider flex items-center gap-2">
            <Receipt className="w-4 h-4 text-teal-500" /> Transações ({logs.length})
          </h3>
        </div>
        {logs.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">Nenhuma transação no período.</div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-[#1e1e28]">
            {logs.map(log => (
              <div key={log.id} className="flex items-center justify-between px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800 dark:text-[#fafafa] truncate">{log.patient_name || 'Sem nome'}</p>
                  <p className="text-[10px] text-slate-400">
                    {new Date(log.occurred_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    {' · '}{ORIGIN_LABELS[log.origin] || log.origin}
                    {log.attendance_type ? ` · ${log.attendance_type}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex gap-1">
                    {log.payment_methods.map((pm, i) => (
                      <span key={i} className={`px-2 py-0.5 rounded text-[9px] font-bold text-white ${METHOD_COLORS[pm.method] || 'bg-slate-400'}`}>
                        {METHOD_LABELS[pm.method] || pm.method}
                      </span>
                    ))}
                  </div>
                  <span className="text-sm font-mono font-semibold text-slate-800 dark:text-[#fafafa] w-24 text-right">
                    {formatCurrency(log.amount)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ======================================================================
// KPI Card
// ======================================================================

function KPICard({ title, value, icon: Icon, color }: {
  title: string; value: string; icon: React.ComponentType<{ className?: string }>; color: string;
}) {
  const colorMap: Record<string, { bg: string; border: string; icon: string; text: string }> = {
    teal: { bg: 'bg-teal-50 dark:bg-teal-900/10', border: 'border-teal-200 dark:border-teal-800/30', icon: 'text-teal-600', text: 'text-teal-700 dark:text-teal-300' },
    blue: { bg: 'bg-blue-50 dark:bg-blue-900/10', border: 'border-blue-200 dark:border-blue-800/30', icon: 'text-blue-600', text: 'text-blue-700 dark:text-blue-300' },
    purple: { bg: 'bg-purple-50 dark:bg-purple-900/10', border: 'border-purple-200 dark:border-purple-800/30', icon: 'text-purple-600', text: 'text-purple-700 dark:text-purple-300' },
    red: { bg: 'bg-red-50 dark:bg-red-900/10', border: 'border-red-200 dark:border-red-800/30', icon: 'text-red-600', text: 'text-red-700 dark:text-red-300' },
    emerald: { bg: 'bg-emerald-50 dark:bg-emerald-900/10', border: 'border-emerald-200 dark:border-emerald-800/30', icon: 'text-emerald-600', text: 'text-emerald-700 dark:text-emerald-300' },
  };
  const c = colorMap[color] || colorMap.teal;

  return (
    <div className={`${c.bg} border ${c.border} rounded-2xl p-4`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold text-slate-500 dark:text-[#a1a1aa] uppercase tracking-wider">{title}</span>
        <Icon className={`w-4 h-4 ${c.icon}`} />
      </div>
      <p className={`text-xl font-bold ${c.text}`}>{value}</p>
    </div>
  );
}
