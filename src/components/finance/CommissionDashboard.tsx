'use client';

import { useState, useMemo } from 'react';
import {
  DollarSign, TrendingUp, Clock, CheckCircle2, ChevronDown,
  ChevronRight, Stethoscope, Loader2, AlertCircle, Filter, X,
  Users, Activity, Banknote,
} from 'lucide-react';

// --- Types ---

interface ProcedureBreakdown {
  name: string;
  count: number;
  total: number;
  commission: number;
}

interface ProfessionalCommission {
  professional_id: string;
  doctor_id: number | null;
  doctor_name: string;
  total_revenue: number;
  total_commission: number;
  clinic_amount: number;
  pending: number;
  paid: number;
  appointments_count: number;
  procedures: ProcedureBreakdown[];
}

interface RecentPayment {
  id: number;
  doctor_name: string;
  total_commission: number;
  status: 'pending' | 'paid' | 'cancelled';
  created_at: string;
  appointment_id: number | null;
}

interface CommissionSummary {
  total_faturamento: number;
  consultation_revenue: number;
  total_commissions: number;
  total_clinic: number;
  pending_commissions: number;
  paid_commissions: number;
}

interface CommissionData {
  summary: CommissionSummary;
  by_professional: ProfessionalCommission[];
  recent_payments: RecentPayment[];
}

interface Props {
  data: CommissionData | null;
  loading: boolean;
  onMarkAsPaid: (paymentId: number) => Promise<void>;
}

// --- Helpers ---

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// --- Component ---

export default function CommissionDashboard({ data, loading, onMarkAsPaid }: Props) {
  const [selectedDoctor, setSelectedDoctor] = useState<string>('all');
  const [selectedProcedure, setSelectedProcedure] = useState<string>('all');
  const [expandedProfessional, setExpandedProfessional] = useState<string | null>(null);
  const [markingPaid, setMarkingPaid] = useState<number | null>(null);

  // Derive available procedures from all professionals
  const allProcedures = useMemo(() => {
    if (!data) return [];
    const set = new Map<string, { name: string; total: number; count: number }>();
    for (const prof of data.by_professional) {
      for (const proc of prof.procedures) {
        const existing = set.get(proc.name);
        if (existing) {
          existing.total += proc.total;
          existing.count += proc.count;
        } else {
          set.set(proc.name, { name: proc.name, total: proc.total, count: proc.count });
        }
      }
    }
    return Array.from(set.values()).sort((a, b) => b.total - a.total);
  }, [data]);

  // Filter data based on selections
  const filtered = useMemo(() => {
    if (!data) return { professionals: [], summary: data?.summary, recentPayments: [] };

    let professionals = data.by_professional;

    // Filter by doctor
    if (selectedDoctor !== 'all') {
      professionals = professionals.filter(p => p.professional_id === selectedDoctor);
    }

    // Filter by procedure
    if (selectedProcedure !== 'all') {
      professionals = professionals
        .map(p => ({
          ...p,
          procedures: p.procedures.filter(proc => proc.name === selectedProcedure),
        }))
        .filter(p => p.procedures.length > 0)
        .map(p => ({
          ...p,
          total_commission: p.procedures.reduce((s, proc) => s + proc.commission, 0),
          total_revenue: p.procedures.reduce((s, proc) => s + proc.total, 0),
          clinic_amount: p.procedures.reduce((s, proc) => s + (proc.total - proc.commission), 0),
          appointments_count: p.procedures.reduce((s, proc) => s + proc.count, 0),
        }));
    }

    // Recalculate summary
    const totalCommissions = professionals.reduce((s, p) => s + p.total_commission, 0);
    const totalRevenue = professionals.reduce((s, p) => s + p.total_revenue, 0);
    const pending = professionals.reduce((s, p) => s + p.pending, 0);
    const paid = professionals.reduce((s, p) => s + p.paid, 0);

    // Filter recent payments
    let recentPayments = data.recent_payments;
    if (selectedDoctor !== 'all') {
      const doc = professionals[0];
      if (doc) recentPayments = recentPayments.filter(p => p.doctor_name === doc.doctor_name);
    }

    return {
      professionals,
      summary: {
        ...data.summary,
        total_commissions: totalCommissions,
        total_clinic: totalRevenue - totalCommissions,
        pending_commissions: selectedProcedure !== 'all' ? totalCommissions : pending,
        paid_commissions: selectedProcedure !== 'all' ? 0 : paid,
        consultation_revenue: totalRevenue,
      },
      recentPayments,
    };
  }, [data, selectedDoctor, selectedProcedure]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-[#71717a]">
        <AlertCircle className="w-10 h-10 mb-3 opacity-40" />
        <p className="text-sm">Nenhum dado disponível para o período selecionado.</p>
      </div>
    );
  }

  const hasFilters = selectedDoctor !== 'all' || selectedProcedure !== 'all';

  const handleMarkPaid = async (id: number) => {
    setMarkingPaid(id);
    try { await onMarkAsPaid(id); } finally { setMarkingPaid(null); }
  };

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <div className="bg-white dark:bg-[#111118] rounded-2xl border border-slate-200 dark:border-[#252530] p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-[#a1a1aa] uppercase">
            <Filter className="w-3.5 h-3.5" /> Filtros
          </div>

          {/* Doctor Filter */}
          <div className="relative">
            <select
              value={selectedDoctor}
              onChange={e => { setSelectedDoctor(e.target.value); setExpandedProfessional(null); }}
              className="appearance-none pl-9 pr-8 py-2 text-sm border border-slate-200 dark:border-[#252530] rounded-xl bg-white dark:bg-[#1a1a22] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-400 cursor-pointer min-w-[200px]"
            >
              <option value="all">Todos os Médicos</option>
              {data.by_professional.map(p => (
                <option key={p.professional_id} value={p.professional_id}>{p.doctor_name}</option>
              ))}
            </select>
            <Stethoscope className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>

          {/* Procedure Filter */}
          <div className="relative">
            <select
              value={selectedProcedure}
              onChange={e => setSelectedProcedure(e.target.value)}
              className="appearance-none pl-9 pr-8 py-2 text-sm border border-slate-200 dark:border-[#252530] rounded-xl bg-white dark:bg-[#1a1a22] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-400 cursor-pointer min-w-[220px]"
            >
              <option value="all">Todos os Procedimentos</option>
              {allProcedures.map(p => (
                <option key={p.name} value={p.name}>{p.name} ({p.count})</option>
              ))}
            </select>
            <Activity className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>

          {hasFilters && (
            <button
              onClick={() => { setSelectedDoctor('all'); setSelectedProcedure('all'); }}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors"
            >
              <X className="w-3 h-3" /> Limpar filtros
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-teal-50 to-emerald-50 dark:from-teal-900/20 dark:to-emerald-900/10 border border-teal-200/60 dark:border-teal-800/30 rounded-2xl p-5 relative overflow-hidden">
          <span className="pointer-events-none absolute -right-4 -top-4 inline-flex h-14 w-14 rounded-full bg-teal-500/10" />
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-teal-700/70 dark:text-teal-400/70 uppercase tracking-wider">Faturamento</span>
            <DollarSign className="w-4 h-4 text-teal-600/60 dark:text-teal-400/60" />
          </div>
          <p className="text-2xl font-bold text-teal-700 dark:text-teal-300">{formatCurrency(filtered.summary?.consultation_revenue || 0)}</p>
          <p className="text-[10px] text-teal-600/60 dark:text-teal-400/50 mt-1">{filtered.professionals.reduce((s, p) => s + p.appointments_count, 0)} atendimentos</p>
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/10 border border-amber-200/60 dark:border-amber-800/30 rounded-2xl p-5 relative overflow-hidden">
          <span className="pointer-events-none absolute -right-4 -top-4 inline-flex h-14 w-14 rounded-full bg-amber-500/10" />
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-amber-700/70 dark:text-amber-400/70 uppercase tracking-wider">Pendente</span>
            <Clock className="w-4 h-4 text-amber-600/60 dark:text-amber-400/60" />
          </div>
          <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{formatCurrency(filtered.summary?.pending_commissions || 0)}</p>
          <p className="text-[10px] text-amber-600/60 dark:text-amber-400/50 mt-1">Aguardando pagamento</p>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/10 border border-emerald-200/60 dark:border-emerald-800/30 rounded-2xl p-5 relative overflow-hidden">
          <span className="pointer-events-none absolute -right-4 -top-4 inline-flex h-14 w-14 rounded-full bg-emerald-500/10" />
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-emerald-700/70 dark:text-emerald-400/70 uppercase tracking-wider">Comissões Pagas</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600/60 dark:text-emerald-400/60" />
          </div>
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{formatCurrency(filtered.summary?.paid_commissions || 0)}</p>
          <p className="text-[10px] text-emerald-600/60 dark:text-emerald-400/50 mt-1">No período</p>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/10 border border-blue-200/60 dark:border-blue-800/30 rounded-2xl p-5 relative overflow-hidden">
          <span className="pointer-events-none absolute -right-4 -top-4 inline-flex h-14 w-14 rounded-full bg-blue-500/10" />
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-blue-700/70 dark:text-blue-400/70 uppercase tracking-wider">Receita Líquida</span>
            <TrendingUp className="w-4 h-4 text-blue-600/60 dark:text-blue-400/60" />
          </div>
          <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{formatCurrency(filtered.summary?.total_clinic || 0)}</p>
          <p className="text-[10px] text-blue-600/60 dark:text-blue-400/50 mt-1">Receita da clínica</p>
        </div>
      </div>

      {/* Distribution Bar Chart (visual) */}
      {filtered.professionals.length > 1 && (
        <div className="bg-white dark:bg-[#111118] rounded-2xl border border-slate-200 dark:border-[#252530] p-5">
          <h3 className="text-sm font-bold text-slate-700 dark:text-[#fafafa] mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-teal-500" /> Distribuição por Profissional
          </h3>
          <div className="space-y-3">
            {filtered.professionals.map(prof => {
              const maxRevenue = Math.max(...filtered.professionals.map(p => p.total_revenue), 1);
              const revenueWidth = (prof.total_revenue / maxRevenue) * 100;
              const commissionWidth = (prof.total_commission / maxRevenue) * 100;
              return (
                <div key={prof.professional_id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-slate-700 dark:text-gray-300">{prof.doctor_name}</span>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="font-mono text-slate-600 dark:text-[#d4d4d8]">{formatCurrency(prof.total_revenue)}</span>
                      <span className="font-mono text-emerald-600 dark:text-emerald-400">{formatCurrency(prof.total_commission)}</span>
                    </div>
                  </div>
                  <div className="relative h-5 bg-slate-100 dark:bg-[#1a1a22] rounded-lg overflow-hidden">
                    <div className="absolute inset-y-0 left-0 bg-teal-200 dark:bg-teal-800/50 rounded-lg transition-all" style={{ width: `${revenueWidth}%` }} />
                    <div className="absolute inset-y-0 left-0 bg-emerald-500 dark:bg-emerald-600 rounded-lg transition-all" style={{ width: `${commissionWidth}%` }} />
                  </div>
                </div>
              );
            })}
            <div className="flex items-center gap-4 mt-2 text-[10px] text-slate-400">
              <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-teal-200 dark:bg-teal-800/50" /> Faturamento</span>
              <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-emerald-500 dark:bg-emerald-600" /> Comissão</span>
            </div>
          </div>
        </div>
      )}

      {/* Professionals Table */}
      <div className="bg-white dark:bg-[#111118] rounded-2xl border border-slate-200 dark:border-[#252530] overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-[#1e1e28] flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800 dark:text-[#fafafa] uppercase tracking-wider flex items-center gap-2">
            <Banknote className="w-4 h-4 text-teal-500" /> Detalhamento
          </h3>
          <span className="text-xs text-slate-400">{filtered.professionals.length} profissional(is)</span>
        </div>

        {filtered.professionals.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400 dark:text-[#71717a]">
            Nenhuma comissão registrada para os filtros selecionados.
          </div>
        ) : (
          <div>
            {/* Header */}
            <div className="grid grid-cols-7 gap-2 px-5 py-3 bg-slate-50 dark:bg-[#0e0e14] text-[10px] font-bold text-slate-500 dark:text-[#a1a1aa] uppercase tracking-wider">
              <div className="col-span-2">Profissional</div>
              <div className="text-center">Atendimentos</div>
              <div className="text-right">Faturamento</div>
              <div className="text-right">Repasse</div>
              <div className="text-right">Clínica</div>
              <div className="text-center">Status</div>
            </div>

            {filtered.professionals.map((prof) => {
              const isExpanded = expandedProfessional === prof.professional_id;
              return (
                <div key={prof.professional_id}>
                  <button
                    type="button"
                    onClick={() => setExpandedProfessional(isExpanded ? null : prof.professional_id)}
                    className="w-full grid grid-cols-7 gap-2 px-5 py-3.5 items-center border-b border-slate-100 dark:border-[#1e1e28] hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors text-left"
                  >
                    <div className="col-span-2 flex items-center gap-2.5">
                      {isExpanded ? <ChevronDown className="w-4 h-4 text-teal-500 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm">
                        {prof.doctor_name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <span className="text-sm font-semibold text-slate-800 dark:text-[#fafafa] truncate block">{prof.doctor_name}</span>
                        <span className="text-[10px] text-slate-400">{prof.procedures.length} procedimento{prof.procedures.length !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                    <div className="text-center text-sm text-slate-600 dark:text-[#d4d4d8] font-medium">{prof.appointments_count}</div>
                    <div className="text-right text-sm font-mono text-slate-800 dark:text-[#fafafa]">{formatCurrency(prof.total_revenue)}</div>
                    <div className="text-right text-sm font-mono font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(prof.total_commission)}</div>
                    <div className="text-right text-sm font-mono text-blue-600 dark:text-blue-400">{formatCurrency(prof.clinic_amount)}</div>
                    <div className="text-center">
                      {prof.pending > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                          <Clock className="w-3 h-3" /> Pendente
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                          <CheckCircle2 className="w-3 h-3" /> Pago
                        </span>
                      )}
                    </div>
                  </button>

                  {isExpanded && prof.procedures.length > 0 && (
                    <div className="bg-slate-50/80 dark:bg-[#0a0a10] border-b border-slate-100 dark:border-[#1e1e28]">
                      <div className="px-8 py-3">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-slate-400 dark:text-[#71717a]">
                              <th className="text-left py-1.5 font-semibold">Procedimento</th>
                              <th className="text-center py-1.5 font-semibold w-16">Qtd</th>
                              <th className="text-right py-1.5 font-semibold w-28">Faturado</th>
                              <th className="text-right py-1.5 font-semibold w-28">Comissão</th>
                              <th className="text-right py-1.5 font-semibold w-28">Clínica</th>
                            </tr>
                          </thead>
                          <tbody>
                            {prof.procedures.map((proc) => (
                              <tr key={proc.name} className="border-t border-slate-100 dark:border-[#1e1e28]">
                                <td className="py-2 text-slate-700 dark:text-gray-300 font-medium">{proc.name}</td>
                                <td className="py-2 text-center text-slate-500">{proc.count}</td>
                                <td className="py-2 text-right font-mono text-slate-700 dark:text-gray-300">{formatCurrency(proc.total)}</td>
                                <td className="py-2 text-right font-mono text-emerald-600 dark:text-emerald-400 font-semibold">{formatCurrency(proc.commission)}</td>
                                <td className="py-2 text-right font-mono text-blue-600 dark:text-blue-400">{formatCurrency(proc.total - proc.commission)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Payments */}
      {filtered.recentPayments.length > 0 && (
        <div className="bg-white dark:bg-[#111118] rounded-2xl border border-slate-200 dark:border-[#252530] overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-[#1e1e28] flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-teal-500" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-[#fafafa] uppercase tracking-wider">Pagamentos Recentes</h3>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-[#1e1e28]">
            {filtered.recentPayments.map((pay) => (
              <div key={pay.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 dark:from-[#252530] dark:to-[#1c1c21] flex items-center justify-center text-xs font-bold text-slate-600 dark:text-[#d4d4d8] shrink-0">
                    {pay.doctor_name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-[#fafafa] truncate">{pay.doctor_name}</p>
                    <p className="text-[10px] text-slate-400 dark:text-[#71717a]">{formatDate(pay.created_at)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(pay.total_commission)}
                  </span>

                  {pay.status === 'pending' ? (
                    <button
                      type="button"
                      onClick={() => handleMarkPaid(pay.id)}
                      disabled={markingPaid === pay.id}
                      className="px-3.5 py-1.5 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-all shadow-sm shadow-emerald-500/20 disabled:opacity-50 flex items-center gap-1.5 active:scale-95"
                    >
                      {markingPaid === pay.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                      Pagar
                    </button>
                  ) : pay.status === 'paid' ? (
                    <span className="px-3 py-1.5 text-[11px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 rounded-lg">
                      Pago
                    </span>
                  ) : (
                    <span className="px-3 py-1.5 text-[11px] font-bold bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded-lg">
                      Cancelado
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
