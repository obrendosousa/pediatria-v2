'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
const supabase = createClient();
import { 
  LayoutGrid, ShoppingCart, Package, 
  TrendingUp, AlertTriangle, Calendar, 
  Search, Plus, Filter, Smartphone, 
  Trash2, CreditCard, Banknote, QrCode,
  ArrowUpRight, ArrowDownRight, MoreHorizontal,
  History, Barcode, Scan, RefreshCw, X, CheckCircle2, Wallet, ShieldCheck, FileText
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { format } from 'date-fns';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer 
} from 'recharts';
import ProductModal from '@/components/ProductModal';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';

// --- TIPOS ---
type Product = {
  id: number;
  name: string;
  price_sale: number;
  price_cost: number;
  stock: number;
  category: string;
  barcode?: string;
  image_url?: string;
};

type CartItem = Product & { quantity: number };
type StoreCashData = {
  date: string;
  isClosed: boolean;
  totals: {
    totalsByMethod: {
      pix: number;
      cash: number;
      credit_card: number;
      debit_card: number;
    };
    totalAmount: number;
  };
  transactions: Array<{
    id: number;
    amount: number;
    occurred_at: string;
    notes: string | null;
  }>;
};

export default function StorePage() {
  const { toast } = useToast();
  const { profile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<'dash' | 'pos' | 'catalog' | 'cash'>('dash');
  
  // --- CONFIGURAÇÃO DO SCANNER ---
  const sessionId = useMemo(() => `pos-${Math.random().toString(36).substring(7)}`, []);
  
  const scannerUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/loja/scanner/${sessionId}` 
    : '';

  // Estados
  const [cart, setCart] = useState<CartItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [patients, setPatients] = useState<any[]>([]);
  const [patientSearchTerm, setPatientSearchTerm] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'cash' | 'pix' | 'credit_card' | 'debit_card' | 'mixed'>('cash');
  const [cashAmount, setCashAmount] = useState('');
  const [mixedAmounts, setMixedAmounts] = useState({
    pix: '',
    cash: '',
    credit_card: '',
    debit_card: ''
  });
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [catalogSearchTerm, setCatalogSearchTerm] = useState('');
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState<string>('all');
  const [catalogStockFilter, setCatalogStockFilter] = useState<'all' | 'low' | 'critical'>('all');
  const [storeCashData, setStoreCashData] = useState<StoreCashData | null>(null);
  const [loadingStoreCash, setLoadingStoreCash] = useState(false);
  const [closingStoreCash, setClosingStoreCash] = useState(false);

  // Estados do Dashboard
  const [metrics, setMetrics] = useState({
     revenueToday: 0,
     ticketAverage: 0,
     lowStockItems: 0,
     expiringItems: 0,
     revenueChange: '+0%',
     ticketChange: '+0%',
     salesByDay: [] as { name: string; val: number }[],
     expiringList: [] as any[]
  });
  const [loadingMetrics, setLoadingMetrics] = useState(true);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'dash' || tab === 'pos' || tab === 'catalog' || tab === 'cash') {
      setActiveTab(tab);
    }
  }, [searchParams]);

  // 1. Carrega Produtos, Pacientes e Métricas
  useEffect(() => {
    fetchData();
    fetchMetrics();
  }, [activeTab]);

  // Recarrega métricas quando volta para dashboard
  useEffect(() => {
    if (activeTab === 'dash') {
      fetchMetrics();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'cash') {
      fetchStoreCash();
    }
  }, [activeTab]);


  // 2. ESCUTA O CELULAR (Realtime)
  useEffect(() => {
    const channel = supabase.channel(`pos-session-${sessionId}`)
      .on('broadcast', { event: 'add-item' }, (payload) => {
           console.log("Produto recebido do scanner:", payload);
           const { product } = payload.payload;
           addToCart(product);
           
           try {
             const audio = new Audio('https://codeskulptor-demos.commondatastorage.googleapis.com/pang/pop.mp3');
             audio.volume = 0.5;
             audio.play().catch(() => {}); 
           } catch (e) {}
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sessionId]);

  async function fetchData() {
    const { data: prods } = await supabase.from('products').select('*').eq('active', true);
    
    // Buscar todos os pacientes
    const { data: allPats } = await supabase
      .from('patients')
      .select('id, name, chat_id')
      .limit(100);
    
    if (prods) setProducts(prods as any);
    
    // Buscar prontuários e agendamentos para destacar pacientes
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const { data: records } = await supabase
      .from('medical_records')
      .select('patient_id')
      .not('patient_id', 'is', null);
    
    // Buscar agendamentos do dia (pode ter patient_id ou não)
    const { data: appointments } = await supabase
      .from('appointments')
      .select('patient_id, status, start_time')
      .gte('start_time', today.toISOString())
      .lt('start_time', tomorrow.toISOString())
      .in('status', ['confirmed', 'scheduled', 'in_progress']);
    
    const patientsWithRecords = new Set(records?.map(r => r.patient_id).filter(Boolean) || []);
    const patientsWithAppointments = new Set(
      appointments?.map(a => a.patient_id).filter(Boolean) || []
    );
    
    // Processar pacientes para destacar os que têm prontuário/atendimento
    const processedPatients = (allPats || []).map((p: any) => ({
      ...p,
      hasRecords: patientsWithRecords.has(p.id),
      hasActiveAppointment: patientsWithAppointments.has(p.id)
    }));
    
    setPatients(processedPatients);
  }

  async function fetchMetrics() {
    try {
      setLoadingMetrics(true);
      const response = await fetch('/api/store/metrics?days=7', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }).catch((fetchError) => {
        // Se o fetch falhar (rede, CORS, etc), lança um erro mais descritivo
        console.error('[fetchMetrics] Erro na requisição fetch:', fetchError);
        throw new Error(`Erro de conexão: ${fetchError.message || 'Não foi possível conectar ao servidor'}`);
      });

      if (!response) {
        throw new Error('Resposta vazia do servidor');
      }

      if (!response.ok) {
        let errorData = {};
        try {
          errorData = await response.json();
        } catch {
          // Se não conseguir parsear JSON, usa a mensagem de status
          throw new Error(`Erro ${response.status}: ${response.statusText || 'Erro ao buscar métricas'}`);
        }
        throw new Error((errorData as { error?: string }).error || `Erro ${response.status}: ${response.statusText || 'Erro ao buscar métricas'}`);
      }

      const data = await response.json();
      setMetrics(data);
    } catch (error: any) {
      console.error('[fetchMetrics] Erro ao carregar métricas:', error);
      // Define valores padrão em caso de erro
      setMetrics({
        revenueToday: 0,
        ticketAverage: 0,
        lowStockItems: 0,
        expiringItems: 0,
        revenueChange: '+0%',
        ticketChange: '+0%',
        salesByDay: [],
        expiringList: []
      });
    } finally {
      setLoadingMetrics(false);
    }
  }

  async function exportOperationalReport() {
    try {
      const response = await fetch('/api/store/reports/operational?days=7');
      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: 'Falha ao gerar relatório.' }));
        throw new Error(payload.error || 'Falha ao gerar relatório.');
      }
      const data = (await response.json()) as {
        generated_at: string;
        period: { days: number; start: string; end: string };
        summary: {
          sales_count: number;
          total_revenue: number;
          average_ticket: number;
          stock_entries: number;
          stock_exits: number;
        };
        sales: Array<{
          id: number;
          created_at: string;
          total: number;
          status: string;
          payment_method: string | null;
          origin: string | null;
          patient_id: number | null;
        }>;
        stock_movements: Array<{
          id: number;
          created_at: string;
          movement_type: string;
          quantity_change: number;
          reason: string;
          product_id: number;
          created_by: string | null;
          reference_type: string | null;
          reference_id: string | null;
        }>;
        audit_events: Array<{
          id: number;
          created_at: string;
          action: string;
          entity_type: string;
          entity_id: string | null;
          user_id: string | null;
          details: unknown;
        }>;
      };

      const escapeCsv = (value: unknown) => {
        const text = String(value ?? '');
        if (text.includes(';') || text.includes('"') || text.includes('\n')) {
          return `"${text.replace(/"/g, '""')}"`;
        }
        return text;
      };

      const lines: string[] = [];
      const pushRow = (columns: unknown[]) => lines.push(columns.map(escapeCsv).join(';'));

      lines.push('RELATORIO OPERACIONAL DA LOJA');
      pushRow(['gerado_em', data.generated_at]);
      pushRow(['periodo_inicio', data.period.start]);
      pushRow(['periodo_fim', data.period.end]);
      pushRow(['periodo_dias', data.period.days]);
      lines.push('');

      lines.push('RESUMO');
      pushRow(['vendas', data.summary.sales_count]);
      pushRow(['faturamento_total', data.summary.total_revenue]);
      pushRow(['ticket_medio', data.summary.average_ticket]);
      pushRow(['entradas_estoque', data.summary.stock_entries]);
      pushRow(['saidas_estoque', data.summary.stock_exits]);
      lines.push('');

      lines.push('VENDAS');
      pushRow(['id', 'data_hora', 'total', 'status', 'pagamento', 'origem', 'patient_id']);
      data.sales.forEach((sale) => {
        pushRow([
          sale.id,
          sale.created_at,
          sale.total,
          sale.status,
          sale.payment_method,
          sale.origin,
          sale.patient_id
        ]);
      });
      lines.push('');

      lines.push('MOVIMENTACOES_ESTOQUE');
      pushRow([
        'id',
        'data_hora',
        'tipo',
        'quantidade',
        'motivo',
        'product_id',
        'created_by',
        'reference_type',
        'reference_id'
      ]);
      data.stock_movements.forEach((movement) => {
        pushRow([
          movement.id,
          movement.created_at,
          movement.movement_type,
          movement.quantity_change,
          movement.reason,
          movement.product_id,
          movement.created_by,
          movement.reference_type,
          movement.reference_id
        ]);
      });
      lines.push('');

      lines.push('AUDITORIA');
      pushRow(['id', 'data_hora', 'acao', 'entidade', 'entity_id', 'user_id', 'details']);
      data.audit_events.forEach((event) => {
        pushRow([
          event.id,
          event.created_at,
          event.action,
          event.entity_type,
          event.entity_id,
          event.user_id,
          JSON.stringify(event.details ?? {})
        ]);
      });

      // BOM para compatibilidade com Excel em UTF-8
      const csvContent = `\uFEFF${lines.join('\n')}`;
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `relatorio-operacional-loja-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      toast.error('Nao foi possivel exportar o relatório operacional.');
    }
  }

  async function fetchStoreCash() {
    try {
      setLoadingStoreCash(true);
      const response = await fetch('/api/store/cash');
      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: 'Erro ao carregar caixa da lojinha.' }));
        throw new Error(payload.error || 'Erro ao carregar caixa da lojinha.');
      }
      setStoreCashData(await response.json());
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao carregar caixa da lojinha.';
      toast.error(message);
    } finally {
      setLoadingStoreCash(false);
    }
  }

  async function closeStoreCash() {
    if (!storeCashData) return;
    try {
      setClosingStoreCash(true);
      const response = await fetch('/api/store/cash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: storeCashData.date })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: 'Falha ao fechar caixa da lojinha.' }));
        throw new Error(payload.error || 'Falha ao fechar caixa da lojinha.');
      }
      toast.success('Caixa da lojinha fechado com sucesso.');
      await fetchStoreCash();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao fechar caixa da lojinha.';
      toast.error(message);
    } finally {
      setClosingStoreCash(false);
    }
  }

  // --- LÓGICA DO CARRINHO ---
  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(p => p.id === product.id);
      if (existing) {
        return prev.map(p => p.id === product.id ? { ...p, quantity: p.quantity + 1 } : p);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (id: number) => setCart(prev => prev.filter(p => p.id !== id));
  
  const updateQty = (id: number, delta: number) => {
      setCart(prev => prev.map(item => {
          if (item.id === id) return { ...item, quantity: Math.max(1, item.quantity + delta) };
          return item;
      }));
  };

  const handleTabChange = (tab: 'dash' | 'pos' | 'catalog' | 'cash') => {
    setActiveTab(tab);
    router.replace(`/loja?tab=${tab}`, { scroll: false });
  };

  const catalogCategories = useMemo(() => {
    const categories = Array.from(new Set(products.map((product) => product.category || 'Geral')));
    return ['all', ...categories];
  }, [products]);

  const filteredCatalogProducts = useMemo(() => {
    return products.filter((product) => {
      const bySearch =
        catalogSearchTerm.trim().length === 0 ||
        product.name.toLowerCase().includes(catalogSearchTerm.toLowerCase()) ||
        (product.barcode || '').toLowerCase().includes(catalogSearchTerm.toLowerCase());
      const byCategory = catalogCategoryFilter === 'all' || (product.category || 'Geral') === catalogCategoryFilter;
      const byStock =
        catalogStockFilter === 'all' ||
        (catalogStockFilter === 'low' && (product.stock || 0) < 10) ||
        (catalogStockFilter === 'critical' && (product.stock || 0) < 5);
      return bySearch && byCategory && byStock;
    });
  }, [products, catalogSearchTerm, catalogCategoryFilter, catalogStockFilter]);

  const cartTotal = cart.reduce((acc, item) => acc + (item.price_sale * item.quantity), 0);

  useEffect(() => {
    if (selectedPaymentMethod === 'cash') {
      setCashAmount(cartTotal.toFixed(2));
    }
  }, [selectedPaymentMethod, cartTotal]);

  // --- FUNÇÃO DE FINALIZAR VENDA ---
  const handleCheckout = async (method: string, cashReceived?: number) => {
      if (cart.length === 0) {
        toast.error('Carrinho vazio!');
        return;
      }
      if (method === 'cash' && (!cashReceived || cashReceived < cartTotal)) {
        toast.error('Valor recebido deve ser maior ou igual ao total da venda!');
        return;
      }

      try {
        const items = cart.map(item => ({
          id: item.id,
          qty: item.quantity,
          price: item.price_sale,
          name: item.name
        }));

        const selectedPatientData = patients.find((patient) => patient.id === selectedPatient) as { id: number; chat_id?: number | null } | undefined;
        const chatId = selectedPatientData?.chat_id ?? null;
        let payloadPayments: Array<{ method: string; amount: number }> | undefined;

        if (method === 'mixed') {
          const pixAmount = Number(mixedAmounts.pix || 0);
          const cashSplitAmount = Number(mixedAmounts.cash || 0);
          const creditAmount = Number(mixedAmounts.credit_card || 0);
          const debitAmount = Number(mixedAmounts.debit_card || 0);
          payloadPayments = [
            { method: 'pix', amount: pixAmount },
            { method: 'cash', amount: cashSplitAmount },
            { method: 'credit_card', amount: creditAmount },
            { method: 'debit_card', amount: debitAmount }
          ].filter((payment) => payment.amount > 0);

          const paymentsTotal = payloadPayments.reduce((acc, payment) => acc + payment.amount, 0);
          if (payloadPayments.length === 0 || Number(paymentsTotal.toFixed(2)) !== Number(cartTotal.toFixed(2))) {
            toast.error('No pagamento misto, a soma das formas deve ser igual ao total.');
            return;
          }
        }

        const response = await fetch('/api/sales', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            patient_id: selectedPatient || null,
            items,
            payment_method: method !== 'mixed' ? method : undefined,
            payments: payloadPayments,
            origin: 'loja'
          })
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Erro ao finalizar venda');
        }

        await response.json();
        
        // Fluxo inline: mantém método selecionado e limpa inputs
        setCashAmount(cartTotal.toFixed(2));
        setMixedAmounts({ pix: '', cash: '', credit_card: '', debit_card: '' });
        
        const change = method === 'cash' && cashReceived ? (cashReceived - cartTotal).toFixed(2) : '0.00';
        toast.success(method === 'cash' ? `Venda realizada com sucesso! Troco: R$ ${change}` : 'Venda realizada com sucesso!');
        
        setCart([]);
        setSelectedPatient(null);
        fetchData();
        if (activeTab === 'dash') fetchMetrics();
      } catch (error: any) {
        console.error('Erro ao finalizar venda:', error);
        toast.error(error.message || 'Erro ao finalizar venda. Verifique o console.');
      }
  };

  return (
    <div className="flex flex-col h-screen bg-[#f8fafc] dark:bg-[#0b141a] overflow-hidden transition-colors duration-300">
      
      {/* HEADER DA LOJA */}
      <div className="bg-white dark:bg-[#1e2028] px-8 py-5 border-b border-slate-200 dark:border-gray-800 flex justify-between items-center shrink-0 transition-colors">
         <div>
            <h1 className="text-2xl font-black text-slate-800 dark:text-gray-100 flex items-center gap-2">
               <Package className="w-6 h-6 text-rose-500" /> Loja & Estoque
            </h1>
            <p className="text-sm text-slate-400 dark:text-gray-500 font-medium mt-1">Gestão de produtos, vendas e validade.</p>
         </div>

         {/* NAVEGAÇÃO ENTRE ABAS */}
         <div className="flex bg-slate-100 dark:bg-[#2a2d36] p-1 rounded-xl transition-colors">
            {[
               { id: 'dash', label: 'Dashboard', icon: LayoutGrid },
               { id: 'pos', label: 'Checkout', icon: ShoppingCart },
               { id: 'catalog', label: 'Catálogo', icon: Package },
               { id: 'cash', label: 'Caixa da Lojinha', icon: Wallet },
            ].map(tab => (
               <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id as 'dash' | 'pos' | 'catalog' | 'cash')}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
                     activeTab === tab.id 
                     ? 'bg-white dark:bg-[#1e2028] text-rose-600 dark:text-rose-400 shadow-sm' 
                     : 'text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-200 hover:bg-slate-200/50 dark:hover:bg-white/5'
                  }`}
               >
                  <tab.icon className="w-4 h-4" /> {tab.label}
               </button>
            ))}
         </div>
      </div>

      {/* ÁREA DE CONTEÚDO */}
      <div className="flex-1 overflow-hidden relative">
         
         {/* === 1. ABA DASHBOARD === */}
         {activeTab === 'dash' && (
            <div className="h-full overflow-y-auto p-8 custom-scrollbar">
               {/* KPIs */}
               {loadingMetrics ? (
                  <div className="grid grid-cols-4 gap-6 mb-8">
                     {[1, 2, 3, 4].map(i => (
                        <div key={i} className="bg-white dark:bg-[#1e2028] p-5 rounded-2xl border border-slate-100 dark:border-gray-800 shadow-sm animate-pulse">
                           <div className="h-20 bg-slate-200 dark:bg-slate-700 rounded"></div>
                        </div>
                     ))}
                  </div>
               ) : (
                  <div className="grid grid-cols-4 gap-6 mb-8">
                     <MetricCard title="Vendas Hoje" value={`R$ ${metrics.revenueToday.toFixed(2)}`} icon={TrendingUp} color="emerald" trend={metrics.revenueChange} />
                     <MetricCard title="Ticket Médio" value={`R$ ${metrics.ticketAverage.toFixed(2)}`} icon={ShoppingCart} color="blue" trend={metrics.ticketChange} />
                     <MetricCard title="Estoque Baixo" value={metrics.lowStockItems} icon={AlertTriangle} color="amber" subtext="Itens críticos" />
                     <MetricCard title="Vencendo (30d)" value={metrics.expiringItems} icon={Calendar} color="rose" subtext="Atenção Urgente" />
                  </div>
               )}

               <div className="bg-white dark:bg-[#1e2028] p-4 rounded-2xl border border-slate-100 dark:border-gray-800 shadow-sm mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    <h3 className="text-sm font-bold text-slate-700 dark:text-gray-200">Operações e Segurança</h3>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                    <button onClick={() => handleTabChange('pos')} className="px-3 py-2 rounded-lg border border-slate-200 dark:border-gray-700 text-xs font-bold text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-white/5">Abrir checkout</button>
                    <button onClick={() => setShowScanner(true)} className="px-3 py-2 rounded-lg border border-slate-200 dark:border-gray-700 text-xs font-bold text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-white/5">Scanner mobile</button>
                    <button onClick={() => handleTabChange('cash')} className="px-3 py-2 rounded-lg border border-slate-200 dark:border-gray-700 text-xs font-bold text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-white/5">Fechar caixa loja</button>
                    <button onClick={exportOperationalReport} className="px-3 py-2 rounded-lg border border-slate-200 dark:border-gray-700 text-xs font-bold text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-white/5">Exportar logs</button>
                    <button onClick={() => handleTabChange('catalog')} className="px-3 py-2 rounded-lg border border-slate-200 dark:border-gray-700 text-xs font-bold text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-white/5">Auditoria catálogo</button>
                  </div>
               </div>

               <div className="grid grid-cols-3 gap-6">
                  {/* Gráfico de Vendas */}
                  <div className="col-span-2 bg-white dark:bg-[#1e2028] p-6 rounded-3xl border border-slate-100 dark:border-gray-800 shadow-sm h-[400px] flex flex-col transition-colors">
                     <h3 className="font-bold text-slate-800 dark:text-gray-100 mb-6">Desempenho de Vendas (7 dias)</h3>
                     <div className="flex-1">
                        {loadingMetrics ? (
                           <div className="h-full flex items-center justify-center">
                              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-500"></div>
                           </div>
                        ) : (
                           <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={metrics.salesByDay.length > 0 ? metrics.salesByDay : [
                                 { name: 'Seg', val: 0 }, { name: 'Ter', val: 0 }, { name: 'Qua', val: 0 },
                                 { name: 'Qui', val: 0 }, { name: 'Sex', val: 0 }, { name: 'Sáb', val: 0 }
                              ]}>
                                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                                 <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                                 <RechartsTooltip 
                                   cursor={{fill: '#f8fafc', opacity: 0.1}} 
                                   contentStyle={{borderRadius: '12px', border: 'none', backgroundColor: '#1e293b', color: '#fff', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.3)'}}
                                   formatter={(value: any) => `R$ ${Number(value).toFixed(2)}`}
                                 />
                                 <Bar dataKey="val" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={40} />
                              </BarChart>
                           </ResponsiveContainer>
                        )}
                     </div>
                  </div>

                  {/* Lista de Vencimento (FEFO) - Mockup */}
                  <div className="bg-white dark:bg-[#1e2028] p-6 rounded-3xl border border-slate-100 dark:border-gray-800 shadow-sm flex flex-col transition-colors">
                     <h3 className="font-bold text-rose-600 dark:text-rose-400 mb-4 flex items-center gap-2"><AlertTriangle className="w-5 h-5"/> Vencendo em Breve</h3>
                     <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3">
                        {loadingMetrics ? (
                           <div className="flex items-center justify-center h-full">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500"></div>
                           </div>
                        ) : metrics.expiringList.length > 0 ? (
                           metrics.expiringList.map((item: any, i: number) => (
                              <div key={i} className="flex justify-between items-center p-3 bg-rose-50 dark:bg-rose-900/10 rounded-xl border border-rose-100 dark:border-rose-900/20">
                                 <div>
                                    <p className="font-bold text-sm text-slate-700 dark:text-gray-200">{item.name}</p>
                                    <p className="text-xs text-rose-500 dark:text-rose-400 font-bold">Vence: {format(new Date(item.expiration_date), 'dd/MM/yyyy')}</p>
                                 </div>
                                 <div className="bg-white dark:bg-[#1e2028] px-3 py-1 rounded-lg text-xs font-bold text-slate-600 dark:text-gray-300 shadow-sm">
                                    {item.quantity} un
                                 </div>
                              </div>
                           ))
                        ) : (
                           <div className="text-center text-slate-400 dark:text-gray-500 text-sm py-8">
                              Nenhum produto vencendo nos próximos 30 dias
                           </div>
                        )}
                     </div>
                     <div className="mt-4 grid grid-cols-2 gap-2">
                        <button
                           type="button"
                           onClick={() => router.push('/financeiro')}
                           className="w-full py-2 text-xs font-bold text-slate-500 dark:text-gray-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors border border-slate-200 dark:border-gray-700 rounded-lg"
                        >
                           Visão financeira
                        </button>
                        <button
                           type="button"
                           onClick={exportOperationalReport}
                           className="w-full py-2 text-xs font-bold text-slate-500 dark:text-gray-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors border border-slate-200 dark:border-gray-700 rounded-lg"
                        >
                           Exportar logs
                        </button>
                     </div>
                  </div>
               </div>
            </div>
         )}

         {/* === 2. ABA VENDAS (PDV) === */}
         {activeTab === 'pos' && (
            <div className="h-full flex">
               {/* Esquerda: Catálogo Visual */}
               <div className="flex-1 flex flex-col p-6 pr-3 border-r border-slate-200 dark:border-gray-800">
                  <div className="mb-6 flex gap-3">
                     <div className="relative flex-1">
                        <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400 dark:text-gray-500" />
                        <input 
                           className="w-full pl-10 pr-4 py-3 bg-white dark:bg-[#1e2028] border border-slate-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 dark:focus:ring-rose-900 transition-all shadow-sm text-slate-700 dark:text-gray-200 placeholder:text-slate-400 dark:placeholder:text-gray-600"
                           placeholder="Buscar produto (Nome, SKU)..."
                           value={searchTerm}
                           onChange={e => setSearchTerm(e.target.value)}
                        />
                     </div>
                     <button
                        type="button"
                        onClick={() => setShowScanner(true)}
                        className="px-4 py-3 bg-white dark:bg-[#1e2028] border border-slate-200 dark:border-gray-700 rounded-xl font-bold text-sm text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-all flex items-center gap-2"
                     >
                        <Smartphone className="w-4 h-4 text-rose-500" />
                        Scanner Mobile
                     </button>
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar">
                     <div className="grid grid-cols-3 xl:grid-cols-4 gap-4">
                        {products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())).map(product => (
                           <div key={product.id} onClick={() => addToCart(product)} className="bg-white dark:bg-[#1e2028] p-4 rounded-2xl border border-slate-100 dark:border-gray-700 shadow-sm hover:border-rose-300 dark:hover:border-rose-700 hover:shadow-md cursor-pointer transition-all group relative overflow-hidden flex flex-col h-[200px]">
                              <div className="flex-1 bg-slate-50 dark:bg-[#2a2d36] rounded-xl mb-3 flex items-center justify-center relative overflow-hidden">
                                 {product.image_url ? (
                                    <img src={product.image_url} className="w-full h-full object-cover" />
                                 ) : (
                                    <div className="flex flex-col items-center">
                                       <Package className="w-8 h-8 text-slate-300 dark:text-gray-600 mb-1" />
                                       <span className="text-[10px] text-slate-400 dark:text-gray-500 font-mono">{product.barcode || 'S/ BARCODE'}</span>
                                    </div>
                                 )}
                                 <div className="absolute inset-0 bg-rose-500/10 dark:bg-rose-500/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <Plus className="w-8 h-8 text-rose-600 dark:text-rose-400 bg-white dark:bg-[#1e2028] rounded-full p-1 shadow-sm" />
                                 </div>
                              </div>
                              <div>
                                 <h3 className="font-bold text-slate-700 dark:text-gray-200 text-sm line-clamp-1 leading-tight mb-1">{product.name}</h3>
                                 <div className="flex justify-between items-end">
                                    <span className="font-black text-rose-600 dark:text-rose-400">R$ {product.price_sale.toFixed(2)}</span>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                                       (product.stock || 0) < 5 
                                          ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' 
                                          : (product.stock || 0) < 10
                                          ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
                                          : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
                                    }`}>
                                       {product.stock || 0} un
                                    </span>
                                 </div>
                              </div>
                           </div>
                        ))}
                     </div>
                  </div>
               </div>

               {/* Direita: Carrinho */}
               <div className="w-[420px] bg-white dark:bg-[#1e2028] flex flex-col z-10 shadow-xl border-l border-slate-100 dark:border-gray-800 transition-colors">
                  {/* Cliente */}
                  <div className="p-6 border-b border-slate-100 dark:border-gray-800">
                     <label className="block text-xs font-bold text-slate-400 dark:text-gray-500 uppercase mb-2">Vincular Paciente (Opcional)</label>
                     <div className="relative">
                        <Search className="absolute left-3 top-3.5 w-4 h-4 text-slate-400 dark:text-gray-500" />
                        <input
                           type="text"
                           className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-[#2a2d36] border border-slate-200 dark:border-gray-700 rounded-xl text-sm font-bold text-slate-700 dark:text-gray-200 focus:outline-none focus:border-rose-400 dark:focus:border-rose-700"
                           placeholder="Buscar paciente por nome..."
                           value={patientSearchTerm}
                           onChange={(e) => setPatientSearchTerm(e.target.value)}
                        />
                     </div>
                     {patientSearchTerm && (
                        <div className="mt-2 max-h-48 overflow-y-auto custom-scrollbar border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-[#1e2028]">
                           {patients
                              .filter(p => p.name.toLowerCase().includes(patientSearchTerm.toLowerCase()))
                              .slice(0, 10)
                              .map(p => (
                                 <button
                                    key={p.id}
                                    onClick={() => {
                                       setSelectedPatient(p.id);
                                       setPatientSearchTerm(p.name);
                                    }}
                                    className={`w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors border-b border-slate-100 dark:border-gray-800 last:border-0 ${
                                       (p as any).hasActiveAppointment 
                                          ? 'bg-rose-50 dark:bg-rose-900/20 border-l-4 border-l-rose-500' 
                                          : (p as any).hasRecords
                                          ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-500'
                                          : ''
                                    }`}
                                 >
                                    <div className="flex items-center justify-between">
                                       <span className="font-bold text-sm text-slate-700 dark:text-gray-200">{p.name}</span>
                                       {(p as any).hasActiveAppointment && (
                                          <span className="text-xs bg-rose-500 text-white px-2 py-0.5 rounded font-bold">Em Atendimento</span>
                                       )}
                                       {(p as any).hasRecords && !(p as any).hasActiveAppointment && (
                                          <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded font-bold">Prontuário</span>
                                       )}
                                    </div>
                                 </button>
                              ))}
                        </div>
                     )}
                     {selectedPatient && (
                        <div className="mt-3 p-3 bg-rose-50 dark:bg-rose-900/20 rounded-lg border border-rose-200 dark:border-rose-900/30">
                           <div className="flex items-center justify-between">
                              <span className="text-sm font-bold text-slate-700 dark:text-gray-200">
                                 {patients.find(p => p.id === selectedPatient)?.name}
                              </span>
                              <button
                                 onClick={() => {
                                    setSelectedPatient(null);
                                    setPatientSearchTerm('');
                                 }}
                                 className="text-rose-500 hover:text-rose-700"
                              >
                                 <X className="w-4 h-4" />
                              </button>
                           </div>
                        </div>
                     )}
                  </div>

                  {/* Lista Itens */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                     {cart.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-300 dark:text-gray-600">
                           <ShoppingCart className="w-16 h-16 mb-4 opacity-50" />
                           <p className="font-bold">Carrinho vazio</p>
                           <p className="text-xs mt-1">Bipe um produto ou clique no catálogo</p>
                        </div>
                     ) : cart.map(item => (
                        <div key={item.id} className="flex gap-3 bg-white dark:bg-[#2a2d36] p-3 rounded-xl border border-slate-100 dark:border-gray-700 shadow-sm items-center">
                           <div className="w-10 h-10 bg-slate-50 dark:bg-[#111b21] rounded-lg flex items-center justify-center text-xs font-bold text-slate-400 dark:text-gray-500 shrink-0">
                              {item.quantity}x
                           </div>
                           <div className="flex-1 min-w-0">
                              <p className="font-bold text-sm text-slate-700 dark:text-gray-200 truncate">{item.name}</p>
                              <p className="text-xs text-rose-600 dark:text-rose-400 font-bold">R$ {(item.price_sale * item.quantity).toFixed(2)}</p>
                           </div>
                           <div className="flex items-center gap-1">
                              <button onClick={() => updateQty(item.id, -1)} className="p-1 hover:bg-slate-100 dark:hover:bg-white/10 rounded text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-300">-</button>
                              <button onClick={() => updateQty(item.id, 1)} className="p-1 hover:bg-slate-100 dark:hover:bg-white/10 rounded text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-300">+</button>
                              <button onClick={() => removeFromCart(item.id)} className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded text-slate-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 ml-1"><Trash2 className="w-4 h-4"/></button>
                           </div>
                        </div>
                     ))}
                  </div>

                  {/* Totais e Ações */}
                  <div className="p-6 bg-slate-50 dark:bg-[#111b21] border-t border-slate-200 dark:border-gray-800 transition-colors">
                     <div className="flex justify-between items-center mb-6">
                        <span className="text-slate-500 dark:text-gray-400 font-bold">Total a Pagar</span>
                        <span className="text-3xl font-black text-rose-600 dark:text-rose-400">R$ {cartTotal.toFixed(2)}</span>
                     </div>
                     
                    {/* Pagamento inline */}
                    <div className="mb-3">
                      <p className="text-xs font-bold text-slate-500 dark:text-gray-400 uppercase mb-2">Forma de pagamento</p>
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <button onClick={() => setSelectedPaymentMethod('cash')} className={`py-2 rounded-lg font-bold text-xs border ${selectedPaymentMethod === 'cash' ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400' : 'bg-white dark:bg-[#2a2d36] border-slate-200 dark:border-gray-700 text-slate-600 dark:text-gray-300'}`}>Dinheiro</button>
                        <button onClick={() => setSelectedPaymentMethod('pix')} className={`py-2 rounded-lg font-bold text-xs border ${selectedPaymentMethod === 'pix' ? 'bg-teal-50 dark:bg-teal-900/20 border-teal-300 dark:border-teal-800 text-teal-700 dark:text-teal-400' : 'bg-white dark:bg-[#2a2d36] border-slate-200 dark:border-gray-700 text-slate-600 dark:text-gray-300'}`}>Pix</button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <button onClick={() => setSelectedPaymentMethod('credit_card')} className={`py-2 rounded-lg font-bold text-xs border ${selectedPaymentMethod === 'credit_card' ? 'bg-slate-100 dark:bg-slate-700 border-slate-400 dark:border-slate-500 text-slate-800 dark:text-white' : 'bg-white dark:bg-[#2a2d36] border-slate-200 dark:border-gray-700 text-slate-600 dark:text-gray-300'}`}>Crédito</button>
                        <button onClick={() => setSelectedPaymentMethod('debit_card')} className={`py-2 rounded-lg font-bold text-xs border ${selectedPaymentMethod === 'debit_card' ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-300 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300' : 'bg-white dark:bg-[#2a2d36] border-slate-200 dark:border-gray-700 text-slate-600 dark:text-gray-300'}`}>Débito</button>
                        <button onClick={() => setSelectedPaymentMethod('mixed')} className={`py-2 rounded-lg font-bold text-xs border ${selectedPaymentMethod === 'mixed' ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-400' : 'bg-white dark:bg-[#2a2d36] border-slate-200 dark:border-gray-700 text-slate-600 dark:text-gray-300'}`}>Misto</button>
                      </div>
                    </div>

                    {selectedPaymentMethod === 'cash' && (
                        <div className="mb-4 p-4 bg-white dark:bg-[#2a2d36] rounded-xl border border-slate-200 dark:border-gray-700">
                           <label className="block text-xs font-bold text-slate-500 dark:text-gray-400 mb-2">Valor Recebido</label>
                           <input
                              type="number"
                              step="0.01"
                              min={cartTotal}
                              value={cashAmount}
                              onChange={(e) => setCashAmount(e.target.value)}
                              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#1e2028] border border-slate-200 dark:border-gray-700 rounded-lg text-lg font-bold text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-rose-500"
                              placeholder="0.00"
                           />
                           {parseFloat(cashAmount || '0') >= cartTotal && (
                              <div className="mt-3 pt-3 border-t border-slate-200 dark:border-gray-700">
                                 <div className="flex justify-between items-center">
                                    <span className="text-sm font-bold text-slate-600 dark:text-gray-400">Troco</span>
                                    <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                                       R$ {(parseFloat(cashAmount || '0') - cartTotal).toFixed(2)}
                                    </span>
                                 </div>
                              </div>
                           )}
                        </div>
                    )}

                    {selectedPaymentMethod === 'mixed' && (
                      <div className="mb-3 p-3 bg-white dark:bg-[#2a2d36] rounded-xl border border-slate-200 dark:border-gray-700">
                        <div className="grid grid-cols-2 gap-2">
                          <input type="number" step="0.01" min="0" value={mixedAmounts.pix} onChange={(e) => setMixedAmounts((prev) => ({ ...prev, pix: e.target.value }))} className="px-2 py-2 bg-slate-50 dark:bg-[#1e2028] border border-slate-200 dark:border-gray-700 rounded text-xs font-bold" placeholder="Pix" />
                          <input type="number" step="0.01" min="0" value={mixedAmounts.cash} onChange={(e) => setMixedAmounts((prev) => ({ ...prev, cash: e.target.value }))} className="px-2 py-2 bg-slate-50 dark:bg-[#1e2028] border border-slate-200 dark:border-gray-700 rounded text-xs font-bold" placeholder="Dinheiro" />
                          <input type="number" step="0.01" min="0" value={mixedAmounts.credit_card} onChange={(e) => setMixedAmounts((prev) => ({ ...prev, credit_card: e.target.value }))} className="px-2 py-2 bg-slate-50 dark:bg-[#1e2028] border border-slate-200 dark:border-gray-700 rounded text-xs font-bold" placeholder="Crédito" />
                          <input type="number" step="0.01" min="0" value={mixedAmounts.debit_card} onChange={(e) => setMixedAmounts((prev) => ({ ...prev, debit_card: e.target.value }))} className="px-2 py-2 bg-slate-50 dark:bg-[#1e2028] border border-slate-200 dark:border-gray-700 rounded text-xs font-bold" placeholder="Débito" />
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => {
                          setSelectedPatient(null);
                          setPatientSearchTerm('');
                        }}
                        className="py-3 bg-white dark:bg-[#2a2d36] border border-slate-200 dark:border-gray-700 rounded-xl font-bold text-slate-600 dark:text-gray-300 text-sm hover:bg-slate-50 dark:hover:bg-white/5 transition-all"
                      >
                        Consumidor final
                      </button>
                      <button
                        onClick={() => {
                          if (selectedPaymentMethod === 'cash') {
                            const received = parseFloat(cashAmount || '0');
                            handleCheckout('cash', received);
                            return;
                          }
                          handleCheckout(selectedPaymentMethod);
                        }}
                        className="py-3 bg-rose-600 text-white rounded-xl font-bold text-sm hover:bg-rose-700 transition-all flex items-center justify-center gap-2"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Finalizar venda
                      </button>
                    </div>
                  </div>
               </div>
            </div>
         )}

         {/* === 3. ABA CATÁLOGO === */}
         {activeTab === 'catalog' && (
            <div className="h-full p-8 overflow-y-auto custom-scrollbar">
               <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-slate-800 dark:text-gray-100">Gerenciar Produtos</h2>
                  <div className="flex gap-3">
                     <button 
                        onClick={fetchData}
                        className="bg-slate-100 dark:bg-[#2a2d36] text-slate-700 dark:text-gray-300 px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-200 dark:hover:bg-white/10 flex items-center gap-2 transition-all"
                        title="Atualizar lista"
                     >
                        <RefreshCw className="w-4 h-4" /> Atualizar
                     </button>
                     <button 
                        onClick={() => {
                           if (profile?.role !== 'admin') {
                              toast.error('Somente administradores podem cadastrar produtos.');
                              return;
                           }
                           setEditingProduct(null);
                           setShowProductModal(true);
                        }}
                        className="bg-rose-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-rose-200 dark:shadow-none hover:bg-rose-700 flex items-center gap-2 transition-all"
                     >
                        <Plus className="w-4 h-4" /> Novo Produto
                     </button>
                  </div>
               </div>

               <div className="bg-white dark:bg-[#1e2028] rounded-2xl border border-slate-200 dark:border-gray-800 p-4 mb-4 grid grid-cols-4 gap-3">
                  <input
                     value={catalogSearchTerm}
                     onChange={(e) => setCatalogSearchTerm(e.target.value)}
                     placeholder="Buscar por nome ou código"
                     className="col-span-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#2a2d36] border border-slate-200 dark:border-gray-700 text-sm font-semibold text-slate-700 dark:text-gray-200"
                  />
                  <select
                    value={catalogCategoryFilter}
                    onChange={(e) => setCatalogCategoryFilter(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#2a2d36] border border-slate-200 dark:border-gray-700 text-sm font-semibold text-slate-700 dark:text-gray-200"
                  >
                    {catalogCategories.map((category) => (
                      <option key={category} value={category}>
                        {category === 'all' ? 'Todas categorias' : category}
                      </option>
                    ))}
                  </select>
                  <select
                    value={catalogStockFilter}
                    onChange={(e) => setCatalogStockFilter(e.target.value as 'all' | 'low' | 'critical')}
                    className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#2a2d36] border border-slate-200 dark:border-gray-700 text-sm font-semibold text-slate-700 dark:text-gray-200"
                  >
                    <option value="all">Todos estoques</option>
                    <option value="low">Estoque baixo (&lt;10)</option>
                    <option value="critical">Estoque crítico (&lt;5)</option>
                  </select>
               </div>
               
               <div className="bg-white dark:bg-[#1e2028] rounded-3xl border border-slate-200 dark:border-gray-800 shadow-sm overflow-hidden transition-colors">
                  <table className="w-full text-left">
                     <thead className="bg-slate-50 dark:bg-[#2a2d36] border-b border-slate-100 dark:border-gray-700">
                        <tr>
                           <th className="p-4 text-xs font-bold text-slate-500 dark:text-gray-400 uppercase">Produto</th>
                           <th className="p-4 text-xs font-bold text-slate-500 dark:text-gray-400 uppercase">Categoria</th>
                           <th className="p-4 text-xs font-bold text-slate-500 dark:text-gray-400 uppercase text-right">Custo</th>
                           <th className="p-4 text-xs font-bold text-slate-500 dark:text-gray-400 uppercase text-right">Venda</th>
                           <th className="p-4 text-xs font-bold text-slate-500 dark:text-gray-400 uppercase text-center">Estoque</th>
                           <th className="p-4 text-xs font-bold text-slate-500 dark:text-gray-400 uppercase text-center">Ações</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-50 dark:divide-gray-800">
                        {filteredCatalogProducts.map(product => (
                           <tr key={product.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors group">
                              <td className="p-4">
                                 <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-slate-100 dark:bg-[#111b21] rounded-lg flex items-center justify-center text-slate-400 dark:text-gray-500">
                                       <Package className="w-5 h-5" />
                                    </div>
                                    <div>
                                       <p className="font-bold text-sm text-slate-700 dark:text-gray-200">{product.name}</p>
                                       <p className="text-[10px] text-slate-400 dark:text-gray-500 font-mono">{product.barcode || 'Sem EAN'}</p>
                                    </div>
                                 </div>
                              </td>
                              <td className="p-4">
                                 <span className="bg-slate-100 dark:bg-[#111b21] text-slate-600 dark:text-gray-400 px-2 py-1 rounded text-xs font-bold capitalize">{product.category || 'Geral'}</span>
                              </td>
                              <td className="p-4 text-right text-sm text-slate-500 dark:text-gray-400 font-medium">R$ {product.price_cost?.toFixed(2)}</td>
                              <td className="p-4 text-right text-sm font-bold text-slate-700 dark:text-gray-200">R$ {product.price_sale.toFixed(2)}</td>
                              <td className="p-4 text-center">
                                 <span className={`px-2 py-1 rounded text-xs font-bold ${
                                    (product.stock || 0) < 5 
                                       ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' 
                                       : (product.stock || 0) < 10
                                       ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
                                       : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
                                 }`}>
                                    {product.stock || 0} un
                                 </span>
                              </td>
                              <td className="p-4 text-center">
                                 <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                       onClick={() => {
                                          // TODO: Implementar impressão de etiqueta
                                          toast.info('Funcionalidade de impressão em desenvolvimento');
                                       }}
                                       className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-300" 
                                       title="Imprimir Etiqueta"
                                    >
                                       <Barcode className="w-4 h-4"/>
                                    </button>
                                    <button 
                                       onClick={() => {
                                          // TODO: Implementar histórico de movimentações
                                          toast.info('Funcionalidade de histórico em desenvolvimento');
                                       }}
                                       className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-300" 
                                       title="Histórico"
                                    >
                                       <History className="w-4 h-4"/>
                                    </button>
                                    <button
                                      onClick={() => {
                                        addToCart(product);
                                        handleTabChange('pos');
                                        toast.success('Produto enviado para o checkout.');
                                      }}
                                      className="p-2 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg text-slate-400 dark:text-gray-500 hover:text-emerald-600 dark:hover:text-emerald-400"
                                      title="Enviar ao checkout"
                                    >
                                      <ShoppingCart className="w-4 h-4" />
                                    </button>
                                    <button 
                                       onClick={() => {
                                          if (profile?.role !== 'admin') {
                                             toast.error('Somente administradores podem editar produtos.');
                                             return;
                                          }
                                          setEditingProduct(product);
                                          setShowProductModal(true);
                                       }}
                                       className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-300" 
                                       title="Editar"
                                    >
                                       <MoreHorizontal className="w-4 h-4"/>
                                    </button>
                                 </div>
                              </td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            </div>
         )}

         {/* === 4. ABA CAIXA DA LOJINHA === */}
         {activeTab === 'cash' && (
            <div className="h-full p-8 overflow-y-auto custom-scrollbar">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-800 dark:text-gray-100">Caixa da Lojinha</h2>
                  <p className="text-sm text-slate-500 dark:text-gray-400">Fechamento dedicado da operação da loja com reconciliação por método.</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={fetchStoreCash} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-gray-700 text-sm font-bold text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-white/5">
                    Atualizar
                  </button>
                  <button
                    onClick={closeStoreCash}
                    disabled={closingStoreCash || loadingStoreCash || storeCashData?.isClosed || profile?.role !== 'admin'}
                    className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {storeCashData?.isClosed ? 'Fechado' : closingStoreCash ? 'Fechando...' : 'Fechar caixa'}
                  </button>
                </div>
              </div>

              {loadingStoreCash ? (
                <div className="bg-white dark:bg-[#1e2028] rounded-2xl border border-slate-100 dark:border-gray-800 p-8 text-center text-slate-500 dark:text-gray-400">
                  Carregando dados do caixa...
                </div>
              ) : storeCashData ? (
                <>
                  <div className="grid grid-cols-5 gap-4 mb-6">
                    <MetricCard title="Data" value={storeCashData.date} icon={Calendar} color="blue" />
                    <MetricCard title="Total Loja" value={`R$ ${storeCashData.totals.totalAmount.toFixed(2)}`} icon={Wallet} color="emerald" />
                    <MetricCard title="Pix" value={`R$ ${storeCashData.totals.totalsByMethod.pix.toFixed(2)}`} icon={QrCode} color="blue" />
                    <MetricCard title="Dinheiro" value={`R$ ${storeCashData.totals.totalsByMethod.cash.toFixed(2)}`} icon={Banknote} color="amber" />
                    <MetricCard title="Status" value={storeCashData.isClosed ? 'Fechado' : 'Em aberto'} icon={CheckCircle2} color={storeCashData.isClosed ? 'emerald' : 'rose'} />
                  </div>

                  <div className="bg-white dark:bg-[#1e2028] rounded-2xl border border-slate-100 dark:border-gray-800 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100 dark:border-gray-800 flex items-center justify-between">
                      <h3 className="font-bold text-slate-700 dark:text-gray-200">Logs da sessão da loja</h3>
                      <span className="text-xs font-bold text-slate-500 dark:text-gray-400">{storeCashData.transactions.length} lançamentos</span>
                    </div>
                    <div className="max-h-[420px] overflow-y-auto custom-scrollbar">
                      {storeCashData.transactions.length === 0 ? (
                        <div className="p-8 text-center text-slate-500 dark:text-gray-400">Sem transações da loja para a data selecionada.</div>
                      ) : (
                        <table className="w-full text-sm">
                          <thead className="bg-slate-50 dark:bg-[#2a2d36] sticky top-0">
                            <tr>
                              <th className="text-left px-4 py-3 text-xs uppercase text-slate-500">Horário</th>
                              <th className="text-left px-4 py-3 text-xs uppercase text-slate-500">Valor</th>
                              <th className="text-left px-4 py-3 text-xs uppercase text-slate-500">Observação</th>
                              <th className="text-left px-4 py-3 text-xs uppercase text-slate-500">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {storeCashData.transactions.map((transaction) => (
                              <tr key={transaction.id} className="border-t border-slate-100 dark:border-gray-800">
                                <td className="px-4 py-3 text-slate-700 dark:text-gray-300">{new Date(transaction.occurred_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td>
                                <td className="px-4 py-3 font-bold text-slate-800 dark:text-gray-100">R$ {Number(transaction.amount || 0).toFixed(2)}</td>
                                <td className="px-4 py-3 text-slate-600 dark:text-gray-400">{transaction.notes || '-'}</td>
                                <td className="px-4 py-3">
                                  <span className={`text-xs font-bold px-2 py-1 rounded ${transaction.notes ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                                    {storeCashData.isClosed ? 'Conciliado' : 'Em aberto'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-white dark:bg-[#1e2028] rounded-2xl border border-slate-100 dark:border-gray-800 p-8 text-center text-slate-500 dark:text-gray-400">
                  Não foi possível carregar o caixa da lojinha.
                </div>
              )}
            </div>
         )}

        {/* MODAL QR SCANNER */}
        {showScanner && (
           <div
              className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setShowScanner(false)}
           >
              <div
                 className="bg-white dark:bg-[#1e2028] rounded-3xl shadow-2xl max-w-md w-full p-6"
                 onClick={(e) => e.stopPropagation()}
              >
                 <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-black text-slate-800 dark:text-gray-100">Scanner no celular</h3>
                    <button
                       type="button"
                       onClick={() => setShowScanner(false)}
                       className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg text-slate-400 dark:text-gray-500"
                    >
                       <X className="w-4 h-4" />
                    </button>
                 </div>
                 <p className="text-sm text-slate-500 dark:text-gray-400 mb-4">
                    Escaneie para abrir o scanner no celular e enviar produtos em tempo real para o carrinho.
                 </p>
                 <div className="bg-slate-50 dark:bg-[#2a2d36] border border-slate-200 dark:border-gray-700 rounded-2xl p-4 flex items-center justify-center mb-3">
                    <QRCodeSVG value={scannerUrl} size={220} includeMargin />
                 </div>
                 <a
                    href={scannerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full inline-flex items-center justify-center py-2.5 text-sm font-bold bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-colors"
                 >
                    Abrir scanner
                 </a>
              </div>
           </div>
        )}

         {/* MODAL DE PRODUTO */}
         <ProductModal
            isOpen={showProductModal}
            onClose={() => {
               setShowProductModal(false);
               setEditingProduct(null);
            }}
            onSuccess={() => {
               fetchData();
               setShowProductModal(false);
               setEditingProduct(null);
            }}
            product={editingProduct ? { ...editingProduct, active: true, description: undefined } as import('@/types').Product : null}
         />
      </div>
    </div>
  );
}

// --- SUBCOMPONENTES ---
function MetricCard({ title, value, icon: Icon, color, trend, subtext }: any) {
   const colors: any = {
      emerald: "text-emerald-500 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20",
      blue: "text-blue-500 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20",
      amber: "text-amber-500 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20",
      rose: "text-rose-500 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20",
   };
   return (
      <div className="bg-white dark:bg-[#1e2028] p-5 rounded-2xl border border-slate-100 dark:border-gray-800 shadow-sm flex flex-col transition-colors">
         <div className="flex justify-between items-start mb-2">
            <div className={`p-2 rounded-xl ${colors[color]}`}><Icon className="w-5 h-5"/></div>
            {trend && <span className={`text-xs font-bold px-2 py-0.5 rounded ${trend.includes('+') ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'}`}>{trend}</span>}
         </div>
         <p className="text-slate-400 dark:text-gray-500 text-xs font-bold uppercase tracking-wider">{title}</p>
         <p className="text-2xl font-black text-slate-800 dark:text-gray-100 mt-1">{value}</p>
         {subtext && <p className="text-xs text-slate-400 dark:text-gray-500 mt-1 font-medium">{subtext}</p>}
      </div>
   )
}