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
  Pencil,
  Tag
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
  discount_amount?: number;
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
    totalDiscounts?: number;
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
      const totalDescontos = closure.totals.totalDiscounts ?? 0;
      const dateLabel = closure.startDate === closure.endDate
        ? new Date(closure.startDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
        : `${closure.startDate} a ${closure.endDate}`;

      const pctOf = (v: number) => totalGeral > 0 ? ((v / totalGeral) * 100).toFixed(0) : '0';

      const html = `<!DOCTYPE html><html><head><style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #000; background: transparent; }
        .page { width: 210mm; padding: 38mm 22mm 20mm; }

        .content-wrap { padding: 24px 22px 18px; }

        h1 { font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 3px; color: #000; text-align: center; margin-bottom: 2px; }
        .date { text-align: center; font-size: 10px; color: #555; margin-bottom: 18px; }

        .total-row { display: flex; align-items: baseline; justify-content: space-between; padding-bottom: 12px; border-bottom: 2px solid #000; margin-bottom: 16px; }
        .total-value { font-size: 30px; font-weight: 900; color: #000; }
        .total-meta { text-align: right; }
        .total-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #666; }
        .total-discount { font-size: 8px; color: #c2410c; font-weight: 600; margin-top: 2px; }

        .cards-row { display: flex; gap: 8px; margin-bottom: 18px; }
        .card { flex: 1; border-left: 4px solid var(--c); border-radius: 4px; padding: 10px 12px; background: rgba(255,255,255,0.7); }
        .card .lbl { font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #333; margin-bottom: 3px; text-align: center; }
        .card .val { font-size: 16px; font-weight: 900; color: #000; text-align: center; }
        .card .pct { float: right; font-size: 8px; font-weight: 800; color: var(--c); }

        .section-title { font-size: 8px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #888; margin-bottom: 6px; }

        .detail-row { display: flex; gap: 8px; margin-bottom: 18px; }
        .detail-card { flex: 1; background: rgba(255,255,255,0.7); border-radius: 4px; padding: 8px 12px; text-align: center; }
        .detail-card .lbl { font-size: 8px; font-weight: 700; text-transform: uppercase; color: #444; letter-spacing: 0.5px; }
        .detail-card .val { font-size: 14px; font-weight: 800; color: #000; margin-top: 1px; }

        table { width: 100%; border-collapse: collapse; font-size: 9px; margin-bottom: 0; }
        thead th { text-align: left; padding: 10px 8px; font-size: 7.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; color: #333; border-bottom: 2px solid #000; vertical-align: middle; }
        tbody td { padding: 10px 8px; border-bottom: 1px solid #ddd; color: #111; font-weight: 500; background: rgba(255,255,255,0.5); vertical-align: middle; }
        tbody tr:nth-child(even) td { background: rgba(245,245,245,0.6); }
        .text-right { text-align: right; }
        .patient-name { font-weight: 700; color: #000; }
        .sub-item { font-size: 7px; color: #777; display: block; margin-top: 1px; }
        .discount-tag { display: inline-block; font-size: 6.5px; background: #fff7ed; color: #c2410c; border: 1px solid #fed7aa; border-radius: 3px; padding: 1px 3px; margin-left: 2px; font-weight: 700; }
        .val-cell { font-weight: 800; color: #000; font-size: 9.5px; }
        .table-total { display: flex; justify-content: flex-end; padding: 8px; border-top: 2px solid #000; }
        .table-total span { font-size: 10px; font-weight: 900; color: #000; letter-spacing: 0.5px; }

        .footer { margin-top: 16px; text-align: center; font-size: 7.5px; color: #aaa; letter-spacing: 0.3px; }
      </style></head><body><div class="page"><div class="content-wrap">

        <h1>Fechamento de Caixa</h1>
        <p class="date">${dateLabel}</p>

        <div class="total-row">
          <span class="total-value">R$ ${totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          <div class="total-meta">
            <div class="total-label">Total Recebido</div>
            ${totalDescontos > 0 ? `<div class="total-discount">Descontos: -R$ ${totalDescontos.toFixed(2)}</div>` : ''}
          </div>
        </div>

        <div class="cards-row">
          ${(['pix', 'cash', 'credit_card', 'debit_card'] as const).map((m, i) => {
            const colors = ['#10b981', '#0ea5e9', '#8b5cf6', '#f59e0b'];
            const v = closure.totals.totalsByMethod[m];
            return `<div class="card" style="--c:${colors[i]}">
              <div class="lbl">${methodLabel[m]}${v > 0 ? `<span class="pct">${pctOf(v)}%</span>` : ''}</div>
              <div class="val">R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            </div>`;
          }).join('')}
        </div>

        <p class="section-title">Detalhamento</p>
        <div class="detail-row">
          <div class="detail-card"><div class="lbl">Consultas</div><div class="val">R$ ${closure.totals.totalsByOrigin.atendimento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div></div>
          <div class="detail-card"><div class="lbl">Loja</div><div class="val">R$ ${closure.totals.totalsByOrigin.loja.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div></div>
        </div>

        <p class="section-title">Lançamentos (${closure.logs.length})</p>
        <table>
          <thead><tr>
            <th>Hora</th><th>Paciente</th><th>Tipo</th><th>Origem</th><th>Forma(s)</th><th class="text-right">Valor</th>
          </tr></thead>
          <tbody>
            ${closure.logs.length === 0 ? '<tr><td colspan="6" style="text-align:center;padding:20px;color:#999;">Nenhum lançamento no período.</td></tr>' : ''}
            ${closure.logs.map(log => `<tr>
              <td>${new Date(log.occurred_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td>
              <td><span class="patient-name">${log.patient_name}</span>${(log.items && log.items.length > 0) ? log.items.map(it => `<span class="sub-item">${it.qty}x ${it.name} (R$${it.unit_price.toFixed(2)})</span>`).join('') : ''}</td>
              <td>${financialTypeLabel(log.attendance_type)}</td>
              <td>${financialOriginLabel(log.origin)}</td>
              <td>${(log.payment_methods || []).map(p => `${methodLabel[p.payment_method] || p.payment_method} R$${Number(p.amount).toFixed(2)}`).join(' + ')}</td>
              <td class="text-right val-cell">R$ ${log.amount.toFixed(2)}${(log.discount_amount && log.discount_amount > 0) ? `<span class="discount-tag">-R$${log.discount_amount.toFixed(2)}</span>` : ''}</td>
            </tr>`).join('')}
          </tbody>
        </table>
        <div class="table-total">
          <span>Total: R$ ${totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
        </div>

        <div class="footer">
          Gerado em ${new Date().toLocaleString('pt-BR')} &mdash; Centro Médico Aliança &mdash; Pediatria Integrada
        </div>

      </div></div></body></html>`;

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
        const usableHeight = pageHeight - marginTop;

        const pdf = new jsPDF('p', 'mm', 'a4');
        pdf.addImage(letterheadDataUrl, 'PNG', 0, 0, imgWidth, pageHeight);
        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);

        if (imgHeight > pageHeight) {
          let yOffset = usableHeight;
          while (yOffset < imgHeight) {
            pdf.addPage();
            pdf.addImage(letterheadDataUrl, 'PNG', 0, 0, imgWidth, pageHeight);
            pdf.addImage(imgData, 'PNG', 0, marginTop - yOffset, imgWidth, imgHeight);
            yOffset += usableHeight;
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

  const totalDescontos = closure?.totals?.totalDiscounts ?? 0;

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
          <div className="space-y-5">
            {/* Header + PDF button */}
            <div className="flex items-end justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-gray-100">Fechamento de caixa</h3>
                <p className="text-xs text-slate-500 dark:text-[#71717a] mt-0.5">
                  Período: {closure.startDate} até {closure.endDate}
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownloadReport}
                disabled={closingCashier || closure.logs.length === 0}
                className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white text-xs font-semibold disabled:opacity-50 flex items-center gap-2 transition-colors duration-200 cursor-pointer shadow-sm"
              >
                <Download className="w-4 h-4" />
                {closingCashier ? 'Gerando PDF...' : 'Baixar Relatório PDF'}
              </button>
            </div>

            {/* Resumo financeiro — layout unificado */}
            <div className="bg-white dark:bg-[#18181b] rounded-2xl border border-slate-100 dark:border-[#27272a] p-5">
              <div className="flex items-baseline justify-between mb-5">
                <div className="flex items-baseline gap-3">
                  <p className="text-2xl font-bold text-slate-900 dark:text-[#fafafa] tabular-nums">
                    R$ {closure.totals.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                  <span className="text-xs font-medium text-slate-400 dark:text-[#71717a]">total recebido</span>
                </div>
                {totalDescontos > 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-orange-500 dark:text-orange-400">
                    <Tag className="w-3 h-3" /> -R$ {totalDescontos.toFixed(2)} desc.
                  </span>
                )}
              </div>
              <div className="grid grid-cols-4 gap-3">
                {([
                  { key: 'pix' as const, label: 'Pix', accentCls: 'border-l-emerald-500', dotCls: 'bg-emerald-500', textCls: 'text-emerald-600 dark:text-emerald-400' },
                  { key: 'cash' as const, label: 'Dinheiro', accentCls: 'border-l-sky-500', dotCls: 'bg-sky-500', textCls: 'text-sky-600 dark:text-sky-400' },
                  { key: 'credit_card' as const, label: 'Crédito', accentCls: 'border-l-violet-500', dotCls: 'bg-violet-500', textCls: 'text-violet-600 dark:text-violet-400' },
                  { key: 'debit_card' as const, label: 'Débito', accentCls: 'border-l-amber-500', dotCls: 'bg-amber-500', textCls: 'text-amber-600 dark:text-amber-400' },
                ] as const).map(({ key, label, accentCls, dotCls, textCls }) => {
                  const val = closure.totals.totalsByMethod[key];
                  const pct = closure.totals.totalAmount > 0 ? (val / closure.totals.totalAmount) * 100 : 0;
                  return (
                    <div key={key} className={`rounded-xl border border-slate-100 dark:border-[#27272a] border-l-[3px] ${accentCls} bg-slate-50/50 dark:bg-[#141416] p-3.5`}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className={`h-2 w-2 rounded-full ${dotCls}`} />
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-[#a1a1aa]">{label}</p>
                        </div>
                        {pct > 0 && <p className={`text-[11px] font-bold ${textCls}`}>{pct.toFixed(0)}%</p>}
                      </div>
                      <p className="text-lg font-bold text-slate-800 dark:text-[#fafafa] tabular-nums">
                        R$ {val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tabela de lançamentos */}
            <div className="bg-white dark:bg-[#18181b] rounded-2xl border border-slate-100 dark:border-[#27272a] overflow-hidden shadow-sm">
              <div className="px-5 py-3.5 border-b border-slate-100 dark:border-[#27272a]">
                <p className="text-xs font-semibold text-slate-500 dark:text-[#a1a1aa] uppercase tracking-wide">
                  Lançamentos ({closure.logs.length})
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50/80 dark:bg-[#0f0f12]">
                      <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-[#71717a]">Data/Hora</th>
                      <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-[#71717a]">Paciente</th>
                      <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-[#71717a]">Tipo</th>
                      <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-[#71717a]">Origem</th>
                      <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-[#71717a]">Forma(s)</th>
                      <th className="text-right px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-[#71717a]">Valor</th>
                      {profile?.role === 'admin' && (
                        <th className="text-center px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-[#71717a]">Ação</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-[#1f1f23]">
                    {closure.logs.length === 0 && (
                      <tr>
                        <td className="px-5 py-10 text-center text-sm text-slate-400 dark:text-[#71717a]" colSpan={profile?.role === 'admin' ? 7 : 6}>
                          Nenhuma entrada no período selecionado.
                        </td>
                      </tr>
                    )}
                    {closure.logs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors duration-150">
                        <td className="px-5 py-3.5 text-slate-600 dark:text-[#d4d4d8] tabular-nums">{new Date(log.occurred_at).toLocaleString('pt-BR')}</td>
                        <td className="px-5 py-3.5">
                          <div className="font-medium text-slate-800 dark:text-[#fafafa]">{log.patient_name}</div>
                          {log.items && log.items.length > 0 && (
                            <div className="mt-1 space-y-0.5">
                              {log.items.map((item, i) => (
                                <span key={i} className="block text-[10px] text-slate-400 dark:text-[#71717a]">
                                  {item.qty}x {item.name} (R$ {item.unit_price.toFixed(2)})
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-slate-600 dark:text-[#d4d4d8]">{financialTypeLabel(log.attendance_type)}</td>
                        <td className="px-5 py-3.5 text-slate-600 dark:text-[#d4d4d8]">{financialOriginLabel(log.origin)}</td>
                        <td className="px-5 py-3.5 text-slate-600 dark:text-[#d4d4d8]">
                          {(log.payment_methods || [])
                            .map((method) => `${paymentMethodLabel(method.payment_method)} (R$ ${Number(method.amount).toFixed(2)})`)
                            .join(' + ')}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <span className="font-semibold text-slate-800 dark:text-[#fafafa] tabular-nums">R$ {log.amount.toFixed(2)}</span>
                          {(log.discount_amount ?? 0) > 0 && (
                            <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800/40 rounded-full px-1.5 py-0.5">
                              <Tag className="w-2.5 h-2.5" />
                              -R$ {log.discount_amount!.toFixed(2)}
                            </span>
                          )}
                        </td>
                        {profile?.role === 'admin' && (
                          <td className="px-5 py-3.5 text-center">
                            <button
                              type="button"
                              onClick={() => openEditModal(log)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-[#3d3d48] px-2.5 py-1.5 text-xs font-semibold text-slate-500 dark:text-[#a1a1aa] hover:bg-slate-100 dark:hover:bg-white/5 transition-colors duration-200 cursor-pointer"
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

