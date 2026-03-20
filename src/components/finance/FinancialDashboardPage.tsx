'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentType } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  PieChart as PieChartIcon,
  DollarSign,
  Activity,
  Wallet,
  Stethoscope,
  ShoppingBag,
  RefreshCw,
  CalendarRange,
  Download,
  Pencil
} from 'lucide-react';
import {
  ResponsiveContainer,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { financialOriginLabel, financialTypeLabel, paymentMethodLabel } from '@/lib/finance';
import { useAuth } from '@/contexts/AuthContext';
import { getLetterheadDataUrl } from '@/lib/letterhead';

const supabase = createClient();

type PeriodPreset = 'today' | '7d' | '30d' | 'custom';
type FinancialTab = 'overview' | 'closure';

type OverviewResponse = {
  range: { preset: PeriodPreset; startDate: string; endDate: string };
  kpis: {
    totalRevenue: number;
    consultationRevenue: number;
    storeRevenue: number;
    storeCost: number;
    grossProfit: number;
    ltv: number;
  };
  charts: {
    revenueByDay: Array<{ date: string; revenue: number }>;
    revenueByOrigin: Array<{ name: string; value: number }>;
    revenueByPaymentMethod: Array<{ name: string; value: number }>;
  };
  reconciliation?: {
    hasDivergence: boolean;
    divergence: {
      totalRevenue: number;
      consultationRevenue: number;
      storeRevenue: number;
    };
    tx: {
      totalRevenue: number;
      consultationRevenue: number;
      storeRevenue: number;
    };
    sales: {
      totalRevenue: number;
      consultationRevenue: number;
      storeRevenue: number;
    };
  };
  bestClients: Array<{ name: string; total: number; visits: number }>;
};

type ClosureLogItem = {
  name: string;
  qty: number;
  unit_price: number;
};

type ClosureLog = {
  id: number;
  occurred_at: string;
  origin: 'atendimento' | 'loja';
  attendance_type: 'consulta' | 'retorno' | 'loja';
  patient_name: string;
  amount: number;
  payment_methods: Array<{ payment_method: 'pix' | 'cash' | 'credit_card' | 'debit_card'; amount: number }>;
  notes: string | null;
  items?: ClosureLogItem[];
};

type ClosureResponse = {
  date: string;
  startDate: string;
  endDate: string;
  isClosed: boolean;
  totals: {
    totalsByMethod: { pix: number; cash: number; credit_card: number; debit_card: number };
    totalsByOrigin: { atendimento: number; loja: number };
    totalsByType?: { consulta: number; retorno: number; loja: number };
    totalAmount: number;
  };
  logs: ClosureLog[];
};

const colors = ['#10b981', '#0ea5e9', '#f43f5e', '#f59e0b'];

export default function FinancialDashboardPage() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [closingCashier, setClosingCashier] = useState(false);
  const [activeTab, setActiveTab] = useState<FinancialTab>('overview');
  const [preset, setPreset] = useState<PeriodPreset>('today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [closure, setClosure] = useState<ClosureResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editingLog, setEditingLog] = useState<ClosureLog | null>(null);
  const [editForm, setEditForm] = useState({
    occurredAt: '',
    amount: '',
    origin: 'atendimento' as 'atendimento' | 'loja',
    notes: '',
    pix: '',
    cash: '',
    credit_card: '',
    debit_card: '',
    password: ''
  });

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set('preset', preset);
    if (preset === 'custom' && customStart && customEnd) {
      params.set('start', customStart);
      params.set('end', customEnd);
    }
    return params.toString();
  }, [preset, customStart, customEnd]);

  const fetchFinancials = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [overviewResponse, closureResponse] = await Promise.all([
        fetch(`/api/finance/overview?${queryString}`),
        fetch(`/api/finance/closures?${queryString}`)
      ]);

      if (!overviewResponse.ok) {
        const body = await overviewResponse.json().catch(() => ({ error: 'Erro ao carregar métricas.' }));
        throw new Error(body.error || 'Erro ao carregar métricas.');
      }

      setOverview((await overviewResponse.json()) as OverviewResponse);
      if (closureResponse.ok) {
        setClosure((await closureResponse.json()) as ClosureResponse);
      } else {
        setClosure(null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar financeiro.');
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    fetchFinancials();
  }, [fetchFinancials]);

  // Debounce para realtime: múltiplos eventos em sequência rápida disparam apenas um fetch
  const realtimeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const debouncedFetch = () => {
      if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current);
      realtimeDebounceRef.current = setTimeout(() => {
        fetchFinancials();
        realtimeDebounceRef.current = null;
      }, 2000);
    };

    const channel = supabase
      .channel('finance_realtime_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'financial_transactions' }, debouncedFetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'financial_transaction_payments' }, debouncedFetch)
      .subscribe();

    const interval = setInterval(() => {
      fetchFinancials();
    }, 60000);

    return () => {
      clearInterval(interval);
      if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [fetchFinancials]);

  async function handleDownloadReport() {
    if (!closure) return;
    setClosingCashier(true);
    try {
      const [html2canvasMod, jsPDFMod] = await Promise.all([
        import('html2canvas'),
        import('jspdf')
      ]);
      const html2canvas = html2canvasMod.default;
      const jsPDF = jsPDFMod.default;
      const letterheadDataUrl = await getLetterheadDataUrl();

      const methodLabel: Record<string, string> = { pix: 'Pix', cash: 'Dinheiro', credit_card: 'Crédito', debit_card: 'Débito' };
      const totalGeral = closure.totals.totalAmount;
      const dateLabel = closure.startDate === closure.endDate
        ? new Date(closure.startDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
        : `${closure.startDate} a ${closure.endDate}`;

      const html = `<!DOCTYPE html><html><head><style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; color: #1e293b; background: transparent; }
        .page { width: 210mm; min-height: 297mm; padding: 34mm 18mm 28mm; }
        h1 { font-size: 16px; text-align: center; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; color: #0f172a; }
        .subtitle { text-align: center; font-size: 11px; color: #64748b; margin-bottom: 18px; }
        .section-title { font-size: 11px; font-weight: bold; text-transform: uppercase; color: #475569; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px; margin: 16px 0 8px; }
        .summary-grid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 8px; margin-bottom: 6px; }
        .summary-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; text-align: center; }
        .summary-card .label { font-size: 9px; text-transform: uppercase; color: #64748b; font-weight: bold; }
        .summary-card .value { font-size: 16px; font-weight: 900; color: #0f172a; margin-top: 2px; }
        .total-bar { background: #f0fdf4; border: 2px solid #86efac; border-radius: 8px; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; margin: 10px 0 16px; }
        .total-bar .label { font-size: 12px; font-weight: bold; color: #166534; }
        .total-bar .value { font-size: 20px; font-weight: 900; color: #166534; }
        .origin-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px; }
        .origin-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; }
        .origin-card .label { font-size: 9px; text-transform: uppercase; color: #64748b; font-weight: bold; }
        .origin-card .value { font-size: 14px; font-weight: 900; color: #0f172a; }
        table { width: 100%; border-collapse: collapse; font-size: 9px; }
        thead th { background: #f1f5f9; text-align: left; padding: 6px 8px; font-size: 8px; text-transform: uppercase; color: #64748b; border-bottom: 2px solid #e2e8f0; }
        tbody td { padding: 5px 8px; border-bottom: 1px solid #f1f5f9; }
        tbody tr:nth-child(even) { background: #f8fafc; }
        .text-right { text-align: right; }
        .font-bold { font-weight: bold; }
        .footer-note { margin-top: 20px; text-align: center; font-size: 9px; color: #94a3b8; }
      </style></head><body><div class="page">
        <h1>Relatório de Fechamento de Caixa</h1>
        <p class="subtitle">${dateLabel}</p>

        <p class="section-title">Resumo por Forma de Pagamento</p>
        <div class="summary-grid">
          ${(['pix', 'cash', 'credit_card', 'debit_card'] as const).map(m =>
            `<div class="summary-card"><div class="label">${methodLabel[m]}</div><div class="value">R$ ${closure.totals.totalsByMethod[m].toFixed(2)}</div></div>`
          ).join('')}
        </div>

        <div class="total-bar">
          <span class="label">TOTAL GERAL</span>
          <span class="value">R$ ${totalGeral.toFixed(2)}</span>
        </div>

        <p class="section-title">Resumo por Origem</p>
        <div class="origin-grid">
          <div class="origin-card"><div class="label">Atendimento</div><div class="value">R$ ${closure.totals.totalsByOrigin.atendimento.toFixed(2)}</div></div>
          <div class="origin-card"><div class="label">Loja</div><div class="value">R$ ${closure.totals.totalsByOrigin.loja.toFixed(2)}</div></div>
        </div>

        ${closure.totals.totalsByType ? `
        <p class="section-title">Detalhamento por Tipo</p>
        <div class="summary-grid" style="grid-template-columns:1fr 1fr 1fr">
          <div class="summary-card"><div class="label">Consulta</div><div class="value">R$ ${closure.totals.totalsByType.consulta.toFixed(2)}</div></div>
          <div class="summary-card"><div class="label">Retorno</div><div class="value">R$ ${closure.totals.totalsByType.retorno.toFixed(2)}</div></div>
          <div class="summary-card"><div class="label">Loja</div><div class="value">R$ ${closure.totals.totalsByType.loja.toFixed(2)}</div></div>
        </div>` : ''}

        <p class="section-title">Lançamentos (${closure.logs.length})</p>
        <table>
          <thead><tr>
            <th>Hora</th><th>Paciente</th><th>Tipo</th><th>Origem</th><th>Forma(s)</th><th class="text-right">Valor</th>
          </tr></thead>
          <tbody>
            ${closure.logs.length === 0 ? '<tr><td colspan="6" style="text-align:center;padding:16px;color:#94a3b8;">Nenhum lançamento no período.</td></tr>' : ''}
            ${closure.logs.map(log => `<tr>
              <td>${new Date(log.occurred_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td>
              <td>${log.patient_name}${(log.items && log.items.length > 0) ? '<br/>' + log.items.map(it => `<span style="font-size:7px;color:#64748b;">${it.qty}x ${it.name} (R$${it.unit_price.toFixed(2)})</span>`).join('<br/>') : ''}</td>
              <td>${financialTypeLabel(log.attendance_type)}</td>
              <td>${financialOriginLabel(log.origin)}</td>
              <td>${(log.payment_methods || []).map(p => `${methodLabel[p.payment_method] || p.payment_method} R$${Number(p.amount).toFixed(2)}`).join(' + ')}</td>
              <td class="text-right font-bold">R$ ${log.amount.toFixed(2)}</td>
            </tr>`).join('')}
          </tbody>
        </table>

        <div class="footer-note">
          Gerado em ${new Date().toLocaleString('pt-BR')} — Centro Médico Aliança — Pediatria Integrada
        </div>
      </div></body></html>`;

      const container = document.createElement('div');
      container.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;background:white;';
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'width:794px;min-height:1123px;border:none;';
      container.appendChild(iframe);
      document.body.appendChild(container);

      await new Promise<void>((resolve) => {
        iframe.onload = () => resolve();
        const doc = iframe.contentWindow?.document;
        if (doc) { doc.open(); doc.write(html); doc.close(); }
        setTimeout(resolve, 1000);
      });
      await new Promise((r) => setTimeout(r, 500));

      try {
        const body = iframe.contentWindow?.document.body;
        if (!body) throw new Error('Erro ao renderizar relatório');
        iframe.style.height = body.scrollHeight + 'px';

        const canvas = await html2canvas(body, {
          scale: 2, useCORS: true, logging: false,
          width: 794, height: body.scrollHeight, windowWidth: 794,
          backgroundColor: null
        });

        const imgData = canvas.toDataURL('image/png');
        const imgWidth = 210;
        const pageHeight = 297;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        const marginTop = 32;
        const marginBottom = 30;
        const usableHeight = pageHeight - marginTop - marginBottom;

        const pdf = new jsPDF('p', 'mm', 'a4');
        pdf.addImage(letterheadDataUrl, 'PNG', 0, 0, imgWidth, pageHeight);
        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);

        if (imgHeight > pageHeight) {
          let contentOffset = pageHeight;
          while (contentOffset < imgHeight) {
            pdf.addPage();
            pdf.addImage(letterheadDataUrl, 'PNG', 0, 0, imgWidth, pageHeight);
            pdf.addImage(imgData, 'PNG', 0, marginTop - contentOffset, imgWidth, imgHeight);
            contentOffset += usableHeight;
          }
        }

        const filename = `fechamento-caixa-${closure.startDate}.pdf`;
        pdf.save(filename);
      } finally {
        document.body.removeChild(container);
      }
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
      setError(err instanceof Error ? err.message : 'Erro ao gerar relatório PDF.');
    } finally {
      setClosingCashier(false);
    }
  }

  function toLocalDateTimeInput(isoDate: string): string {
    const date = new Date(isoDate);
    const offsetMs = date.getTimezoneOffset() * 60 * 1000;
    return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
  }

  function openEditModal(log: ClosureLog) {
    const values = {
      pix: 0,
      cash: 0,
      credit_card: 0,
      debit_card: 0
    };
    for (const method of log.payment_methods || []) {
      values[method.payment_method] += Number(method.amount || 0);
    }

    setEditingLog(log);
    setEditForm({
      occurredAt: toLocalDateTimeInput(log.occurred_at),
      amount: log.amount.toFixed(2),
      origin: log.origin,
      notes: log.notes ?? '',
      pix: values.pix > 0 ? values.pix.toFixed(2) : '',
      cash: values.cash > 0 ? values.cash.toFixed(2) : '',
      credit_card: values.credit_card > 0 ? values.credit_card.toFixed(2) : '',
      debit_card: values.debit_card > 0 ? values.debit_card.toFixed(2) : '',
      password: ''
    });
  }

  async function handleSaveEdit() {
    if (!editingLog) return;

    const amount = Number(editForm.amount || 0);
    const payments = [
      { method: 'pix', amount: Number(editForm.pix || 0) },
      { method: 'cash', amount: Number(editForm.cash || 0) },
      { method: 'credit_card', amount: Number(editForm.credit_card || 0) },
      { method: 'debit_card', amount: Number(editForm.debit_card || 0) }
    ].filter((item) => item.amount > 0);
    const paymentsTotal = Number(
      payments.reduce((acc, item) => acc + item.amount, 0).toFixed(2)
    );

    if (amount <= 0) {
      setError('O valor do lançamento deve ser maior que zero.');
      return;
    }
    if (!editForm.password) {
      setError('Informe sua senha para confirmar a edição.');
      return;
    }
    if (payments.length === 0) {
      setError('Informe ao menos uma forma de pagamento.');
      return;
    }
    if (paymentsTotal !== Number(amount.toFixed(2))) {
      setError('A soma das formas de pagamento deve ser igual ao valor do lançamento.');
      return;
    }

    setSavingEdit(true);
    setError(null);
    try {
      const response = await fetch(`/api/finance/transactions/${editingLog.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          origin: editForm.origin,
          occurred_at: new Date(editForm.occurredAt).toISOString(),
          notes: editForm.notes || null,
          payments,
          password: editForm.password
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Não foi possível editar o lançamento.');
      }
      setEditingLog(null);
      await fetchFinancials();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao editar lançamento.');
    } finally {
      setSavingEdit(false);
    }
  }

  return (
    <div className="h-full flex flex-col bg-[#f8fafc] dark:bg-black relative overflow-hidden transition-colors duration-300">
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-rose-100/40 dark:bg-rose-900/5 rounded-full blur-[100px] pointer-events-none -translate-y-1/2 translate-x-1/3 transition-colors"></div>

      <div className="h-16 px-6 flex items-center justify-between bg-white dark:bg-[#0a0a0f] border-b border-slate-100 dark:border-[#1a1a24] shadow-sm z-20 transition-colors">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-lg">
            <PieChartIcon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-800 dark:text-[#fafafa] leading-none">Gestão Financeira</h1>
            <p className="text-xs text-slate-500 dark:text-[#a1a1aa] mt-0.5">Pediatria: faturamento, lucro e fechamento</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => fetchFinancials()}
          className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#3d3d48] text-xs font-bold text-slate-700 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-white/5 flex items-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Atualizar
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-8 z-10">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2 bg-white dark:bg-[#141419] rounded-xl border border-slate-100 dark:border-[#2d2d36] p-1">
            {([
              { key: 'overview', label: 'Visão geral' },
              { key: 'closure', label: 'Fechamento de caixa' }
            ] as const).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-2 rounded-lg text-xs font-bold ${activeTab === tab.key ? 'bg-rose-500 text-white' : 'text-slate-600 dark:text-[#d4d4d8] hover:bg-slate-100 dark:hover:bg-white/10'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {([
              { key: 'today', label: 'Hoje' },
              { key: '7d', label: '7D' },
              { key: '30d', label: '30D' },
              { key: 'custom', label: 'Personalizado' }
            ] as const).map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setPreset(option.key)}
                className={`px-3 py-2 rounded-lg text-xs font-bold border ${preset === option.key ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white dark:bg-[#141419] text-slate-700 dark:text-gray-200 border-slate-200 dark:border-[#3d3d48]'}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {preset === 'custom' && (
          <div className="mb-6 bg-white dark:bg-[#141419] rounded-xl border border-slate-100 dark:border-[#2d2d36] p-4 flex items-center gap-3">
            <CalendarRange className="w-4 h-4 text-slate-500" />
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-200 dark:border-[#3d3d48] bg-white dark:bg-[#1c1c21] text-sm"
            />
            <span className="text-sm text-slate-500">até</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-200 dark:border-[#3d3d48] bg-white dark:bg-[#1c1c21] text-sm"
            />
          </div>
        )}

        {loading && <div className="mb-4 text-sm font-semibold text-slate-500">Carregando dados financeiros...</div>}
        {error && <div className="mb-4 text-sm font-semibold text-rose-600">{error}</div>}

        {activeTab === 'overview' && overview && (
          <>
            {overview.reconciliation?.hasDivergence && (
              <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                Divergência de conciliação detectada entre lançamentos financeiros e vendas no período.
                Diferenças: total R$ {overview.reconciliation.divergence.totalRevenue.toFixed(2)}, atendimento R$ {overview.reconciliation.divergence.consultationRevenue.toFixed(2)}, loja R$ {overview.reconciliation.divergence.storeRevenue.toFixed(2)}.
              </div>
            )}
            <div className="grid grid-cols-5 gap-4 mb-6">
              <KpiCard icon={Wallet} label="Faturamento Total" value={overview.kpis.totalRevenue} />
              <KpiCard icon={Stethoscope} label="Faturamento Consultas" value={overview.kpis.consultationRevenue} />
              <KpiCard icon={ShoppingBag} label="Faturamento Loja" value={overview.kpis.storeRevenue} />
              <KpiCard icon={Activity} label="Custo Loja" value={overview.kpis.storeCost} />
              <KpiCard icon={DollarSign} label="Lucro Consolidado" value={overview.kpis.grossProfit} />
            </div>

            <div className="grid grid-cols-3 gap-6 mb-6">
              <div className="col-span-2 bg-white dark:bg-[#141419] rounded-2xl border border-slate-100 dark:border-[#2d2d36] p-4 h-[320px]">
                <h3 className="text-sm font-bold text-slate-700 dark:text-gray-200 mb-3">Faturamento por período</h3>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={overview.charts.revenueByDay}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip formatter={(value) => `R$ ${Number(value).toFixed(2)}`} />
                    <Line type="monotone" dataKey="revenue" stroke="#f43f5e" strokeWidth={3} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-white dark:bg-[#141419] rounded-2xl border border-slate-100 dark:border-[#2d2d36] p-4 h-[320px]">
                <h3 className="text-sm font-bold text-slate-700 dark:text-gray-200 mb-3">Origem da receita</h3>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={overview.charts.revenueByOrigin}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip formatter={(value) => `R$ ${Number(value).toFixed(2)}`} />
                    <Bar dataKey="value" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 mb-6">
              <div className="bg-white dark:bg-[#141419] rounded-2xl border border-slate-100 dark:border-[#2d2d36] p-4 h-[320px]">
                <h3 className="text-sm font-bold text-slate-700 dark:text-gray-200 mb-3">Formas de pagamento</h3>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={overview.charts.revenueByPaymentMethod} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={95} label>
                      {overview.charts.revenueByPaymentMethod.map((entry, index) => (
                        <Cell key={`${entry.name}-${index}`} fill={colors[index % colors.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `R$ ${Number(value).toFixed(2)}`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-white dark:bg-[#141419] rounded-2xl border border-slate-100 dark:border-[#2d2d36] p-4">
                <h3 className="text-sm font-bold text-slate-700 dark:text-gray-200 mb-3">Top pacientes (curva A)</h3>
                <div className="space-y-2">
                  {overview.bestClients.length === 0 && (
                    <p className="text-sm text-slate-500">Sem dados no período selecionado.</p>
                  )}
                  {overview.bestClients.map((client, index) => (
                    <div key={`${client.name}-${index}`} className="flex items-center justify-between rounded-lg border border-slate-100 dark:border-[#3d3d48] px-3 py-2">
                      <div className="text-sm font-semibold text-slate-700 dark:text-gray-200">{client.name}</div>
                      <div className="text-sm font-bold text-emerald-600">R$ {client.total.toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'closure' && closure && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-[#141419] rounded-2xl border border-slate-100 dark:border-[#2d2d36] p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-700 dark:text-gray-200">Fechamento de caixa</h3>
                  <p className="text-xs text-slate-500 dark:text-[#a1a1aa]">
                    Período: {closure.startDate} até {closure.endDate}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadReport}
                  disabled={closingCashier || closure.logs.length === 0}
                  className="px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Download className="w-4 h-4" />
                  {closingCashier ? 'Gerando PDF...' : 'Baixar Relatório PDF'}
                </button>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <SummaryValue label="Pix" value={closure.totals.totalsByMethod.pix} />
                <SummaryValue label="Dinheiro" value={closure.totals.totalsByMethod.cash} />
                <SummaryValue label="Crédito" value={closure.totals.totalsByMethod.credit_card} />
                <SummaryValue label="Débito" value={closure.totals.totalsByMethod.debit_card} />
              </div>
            </div>

            <div className="bg-white dark:bg-[#141419] rounded-2xl border border-slate-100 dark:border-[#2d2d36] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-[#1c1c21]">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs uppercase text-slate-500">Data/Hora</th>
                      <th className="text-left px-4 py-3 text-xs uppercase text-slate-500">Paciente</th>
                      <th className="text-left px-4 py-3 text-xs uppercase text-slate-500">Tipo</th>
                      <th className="text-left px-4 py-3 text-xs uppercase text-slate-500">Origem</th>
                      <th className="text-left px-4 py-3 text-xs uppercase text-slate-500">Forma(s)</th>
                      <th className="text-right px-4 py-3 text-xs uppercase text-slate-500">Valor</th>
                      {profile?.role === 'admin' && (
                        <th className="text-center px-4 py-3 text-xs uppercase text-slate-500">Ação</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {closure.logs.length === 0 && (
                      <tr>
                        <td className="px-4 py-8 text-center text-slate-500" colSpan={profile?.role === 'admin' ? 7 : 6}>
                          Nenhuma entrada no período selecionado.
                        </td>
                      </tr>
                    )}
                    {closure.logs.map((log) => (
                      <tr key={log.id} className="border-t border-slate-100 dark:border-[#2d2d36]">
                        <td className="px-4 py-3">{new Date(log.occurred_at).toLocaleString('pt-BR')}</td>
                        <td className="px-4 py-3">
                          <div>{log.patient_name}</div>
                          {log.items && log.items.length > 0 && (
                            <div className="mt-1 space-y-0.5">
                              {log.items.map((item, i) => (
                                <span key={i} className="block text-[10px] text-slate-500 dark:text-[#a1a1aa]">
                                  {item.qty}x {item.name} (R$ {item.unit_price.toFixed(2)})
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">{financialTypeLabel(log.attendance_type)}</td>
                        <td className="px-4 py-3">{financialOriginLabel(log.origin)}</td>
                        <td className="px-4 py-3">
                          {(log.payment_methods || [])
                            .map((method) => `${paymentMethodLabel(method.payment_method)} (R$ ${Number(method.amount).toFixed(2)})`)
                            .join(' + ')}
                        </td>
                        <td className="px-4 py-3 text-right font-bold">R$ {log.amount.toFixed(2)}</td>
                        {profile?.role === 'admin' && (
                          <td className="px-4 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => openEditModal(log)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:border-[#3d3d48] dark:text-[#d4d4d8] dark:hover:bg-white/10"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Editar
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
      {editingLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-[#3d3d48] dark:bg-[#141419]">
            <h3 className="mb-4 text-sm font-bold text-slate-700 dark:text-gray-200">Editar lançamento financeiro</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase text-slate-500">Data/Hora</label>
                <input
                  type="datetime-local"
                  value={editForm.occurredAt}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, occurredAt: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-[#3d3d48] dark:bg-[#1c1c21]"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase text-slate-500">Valor</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={editForm.amount}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, amount: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-[#3d3d48] dark:bg-[#1c1c21]"
                />
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-[11px] font-semibold uppercase text-slate-500">Origem</label>
                <select
                  value={editForm.origin}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      origin: e.target.value as 'atendimento' | 'loja'
                    }))
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-[#3d3d48] dark:bg-[#1c1c21]"
                >
                  <option value="atendimento">Atendimento</option>
                  <option value="loja">Loja</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase text-slate-500">Pix</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editForm.pix}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, pix: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-[#3d3d48] dark:bg-[#1c1c21]"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase text-slate-500">Dinheiro</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editForm.cash}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, cash: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-[#3d3d48] dark:bg-[#1c1c21]"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase text-slate-500">Crédito</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editForm.credit_card}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, credit_card: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-[#3d3d48] dark:bg-[#1c1c21]"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase text-slate-500">Débito</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editForm.debit_card}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, debit_card: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-[#3d3d48] dark:bg-[#1c1c21]"
                />
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-[11px] font-semibold uppercase text-slate-500">Observação</label>
                <input
                  type="text"
                  value={editForm.notes}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, notes: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-[#3d3d48] dark:bg-[#1c1c21]"
                />
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-[11px] font-semibold uppercase text-slate-500">Senha de confirmação (admin)</label>
                <input
                  type="password"
                  value={editForm.password}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, password: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-[#3d3d48] dark:bg-[#1c1c21]"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingLog(null)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 dark:border-[#3d3d48] dark:text-[#d4d4d8]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className="rounded-lg bg-rose-500 px-3 py-2 text-xs font-bold text-white hover:bg-rose-600 disabled:opacity-50"
              >
                {savingEdit ? 'Salvando...' : 'Salvar alterações'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <div className="bg-white dark:bg-[#141419] rounded-2xl border border-slate-100 dark:border-[#2d2d36] p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="p-2 rounded-lg text-rose-600 bg-rose-50 dark:bg-rose-900/20">
          <Icon className="w-4 h-4" />
        </span>
      </div>
      <p className="text-[11px] uppercase font-bold text-slate-500 dark:text-[#a1a1aa]">{label}</p>
      <p className="text-xl font-black text-slate-800 dark:text-[#fafafa]">R$ {value.toFixed(2)}</p>
    </div>
  );
}

function SummaryValue({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-100 dark:border-[#2a2a35] bg-slate-50 dark:bg-[#1c1c21] p-3">
      <p className="text-[11px] uppercase font-bold text-slate-500 dark:text-[#a1a1aa]">{label}</p>
      <p className="text-lg font-black text-slate-800 dark:text-[#fafafa]">R$ {value.toFixed(2)}</p>
    </div>
  );
}
