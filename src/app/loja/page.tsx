'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  LayoutGrid, ShoppingCart, Package, 
  TrendingUp, AlertTriangle, Calendar, 
  Search, Plus, Filter, Smartphone, 
  Trash2, CreditCard, Banknote, QrCode,
  ArrowUpRight, ArrowDownRight, MoreHorizontal,
  History, Barcode, Scan, RefreshCw, X, CheckCircle2
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer 
} from 'recharts';
import ProductModal from '@/components/ProductModal';

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

export default function StorePage() {
  const [activeTab, setActiveTab] = useState<'dash' | 'pos' | 'catalog'>('dash');
  
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
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | null>(null);
  const [cashAmount, setCashAmount] = useState('');
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

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
      .select('id, name')
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
        throw new Error(errorData.error || `Erro ${response.status}: ${response.statusText || 'Erro ao buscar métricas'}`);
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

  const cartTotal = cart.reduce((acc, item) => acc + (item.price_sale * item.quantity), 0);

  // --- FUNÇÃO DE FINALIZAR VENDA ---
  const handleCheckout = async (method: string, cashReceived?: number) => {
      if (cart.length === 0) return alert('Carrinho vazio!');
      
      if (method === 'money' && (!cashReceived || cashReceived < cartTotal)) {
        return alert('Valor recebido deve ser maior ou igual ao total da venda!');
      }

      try {
        const items = cart.map(item => ({
          id: item.id,
          qty: item.quantity,
          price: item.price_sale,
          name: item.name
        }));

        const response = await fetch('/api/sales', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: selectedPatient || null,
            items,
            payment_method: method
          })
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Erro ao finalizar venda');
        }

        const result = await response.json();
        
        // Mostrar modal de sucesso
        setShowPaymentModal(false);
        setSelectedPaymentMethod(null);
        setCashAmount('');
        
        // Mostrar alerta de sucesso
        const change = method === 'money' && cashReceived ? (cashReceived - cartTotal).toFixed(2) : '0.00';
        alert(`Venda realizada com sucesso!\n${method === 'money' ? `Troco: R$ ${change}` : ''}`);
        
        setCart([]);
        setSelectedPatient(null);
        fetchData();
        if (activeTab === 'dash') fetchMetrics();
      } catch (error: any) {
        console.error('Erro ao finalizar venda:', error);
        alert(error.message || 'Erro ao finalizar venda. Verifique o console.');
      }
  };

  const openPaymentModal = (method: string) => {
    setSelectedPaymentMethod(method);
    setShowPaymentModal(true);
    if (method === 'money') {
      setCashAmount(cartTotal.toFixed(2));
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
               { id: 'pos', label: 'Vendas (PDV)', icon: ShoppingCart },
               { id: 'catalog', label: 'Catálogo', icon: Package },
            ].map(tab => (
               <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
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
                     <button className="mt-4 w-full py-2 text-xs font-bold text-slate-400 dark:text-gray-500 hover:text-rose-500 dark:hover:text-rose-400 transition-colors">Ver relatório completo</button>
                  </div>
               </div>
            </div>
         )}

         {/* === 2. ABA VENDAS (PDV) === */}
         {activeTab === 'pos' && (
            <div className="h-full flex">
               {/* Esquerda: Catálogo Visual */}
               <div className="flex-1 flex flex-col p-6 pr-3 border-r border-slate-200 dark:border-gray-800">
                  <div className="mb-6">
                     <div className="relative">
                        <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400 dark:text-gray-500" />
                        <input 
                           className="w-full pl-10 pr-4 py-3 bg-white dark:bg-[#1e2028] border border-slate-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 dark:focus:ring-rose-900 transition-all shadow-sm text-slate-700 dark:text-gray-200 placeholder:text-slate-400 dark:placeholder:text-gray-600"
                           placeholder="Buscar produto (Nome, SKU)..."
                           value={searchTerm}
                           onChange={e => setSearchTerm(e.target.value)}
                        />
                     </div>
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
                     
                     {/* Cálculo de Troco (se método for dinheiro) */}
                     {selectedPaymentMethod === 'money' && showPaymentModal && (
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
                     
                     <div className="grid grid-cols-2 gap-3 mb-3">
                        <button onClick={() => openPaymentModal('money')} className="py-3 bg-white dark:bg-[#2a2d36] border border-slate-200 dark:border-gray-700 rounded-xl font-bold text-slate-600 dark:text-gray-300 text-sm hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:border-emerald-200 dark:hover:border-emerald-800 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all flex items-center justify-center gap-2"><Banknote className="w-4 h-4"/> Dinheiro</button>
                        <button onClick={() => openPaymentModal('pix')} className="py-3 bg-white dark:bg-[#2a2d36] border border-slate-200 dark:border-gray-700 rounded-xl font-bold text-slate-600 dark:text-gray-300 text-sm hover:bg-teal-50 dark:hover:bg-teal-900/20 hover:border-teal-200 dark:hover:border-teal-800 hover:text-teal-600 dark:hover:text-teal-400 transition-all flex items-center justify-center gap-2"><QrCode className="w-4 h-4"/> Pix</button>
                     </div>
                     <button onClick={() => openPaymentModal('card')} className="w-full py-4 bg-slate-800 dark:bg-slate-700 text-white rounded-xl font-bold text-lg hover:bg-slate-900 dark:hover:bg-slate-600 shadow-lg shadow-slate-200 dark:shadow-none transition-all flex items-center justify-center gap-2"><CreditCard className="w-5 h-5"/> Cartão de Crédito</button>
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
                           setEditingProduct(null);
                           setShowProductModal(true);
                        }}
                        className="bg-rose-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-rose-200 dark:shadow-none hover:bg-rose-700 flex items-center gap-2 transition-all"
                     >
                        <Plus className="w-4 h-4" /> Novo Produto
                     </button>
                  </div>
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
                        {products.map(product => (
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
                                          alert('Funcionalidade de impressão em desenvolvimento');
                                       }}
                                       className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-300" 
                                       title="Imprimir Etiqueta"
                                    >
                                       <Barcode className="w-4 h-4"/>
                                    </button>
                                    <button 
                                       onClick={() => {
                                          // TODO: Implementar histórico de movimentações
                                          alert('Funcionalidade de histórico em desenvolvimento');
                                       }}
                                       className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-300" 
                                       title="Histórico"
                                    >
                                       <History className="w-4 h-4"/>
                                    </button>
                                    <button 
                                       onClick={() => {
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

         {/* MODAL DE PAGAMENTO */}
         {showPaymentModal && selectedPaymentMethod && (
            <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in zoom-in duration-200" onClick={() => {
               setShowPaymentModal(false);
               setSelectedPaymentMethod(null);
               setCashAmount('');
            }}>
               <div className="bg-white dark:bg-[#1e2028] p-8 rounded-3xl shadow-2xl max-w-md w-full" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-between mb-6">
                     <h3 className="text-2xl font-black text-slate-800 dark:text-gray-100">
                        Finalizar Venda
                     </h3>
                     <button 
                        onClick={() => {
                           setShowPaymentModal(false);
                           setSelectedPaymentMethod(null);
                           setCashAmount('');
                        }}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg text-slate-400 dark:text-gray-500"
                     >
                        <X className="w-5 h-5" />
                     </button>
                  </div>

                  <div className="mb-6">
                     <div className="bg-slate-50 dark:bg-[#2a2d36] p-4 rounded-xl mb-4">
                        <div className="flex justify-between items-center mb-2">
                           <span className="text-sm font-bold text-slate-500 dark:text-gray-400">Total</span>
                           <span className="text-3xl font-black text-rose-600 dark:text-rose-400">R$ {cartTotal.toFixed(2)}</span>
                        </div>
                        <div className="text-xs text-slate-400 dark:text-gray-500">
                           {cart.length} {cart.length === 1 ? 'item' : 'itens'}
                        </div>
                     </div>

                     {selectedPaymentMethod === 'money' && (
                        <div className="mb-4">
                           <label className="block text-sm font-bold text-slate-700 dark:text-gray-300 mb-2">Valor Recebido</label>
                           <input
                              type="number"
                              step="0.01"
                              min={cartTotal}
                              value={cashAmount}
                              onChange={(e) => setCashAmount(e.target.value)}
                              className="w-full px-4 py-3 bg-white dark:bg-[#1e2028] border-2 border-slate-200 dark:border-gray-700 rounded-xl text-xl font-bold text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                              placeholder="0.00"
                              autoFocus
                           />
                           {parseFloat(cashAmount || '0') >= cartTotal && (
                              <div className="mt-3 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-900/30">
                                 <div className="flex justify-between items-center">
                                    <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">Troco</span>
                                    <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                                       R$ {(parseFloat(cashAmount || '0') - cartTotal).toFixed(2)}
                                    </span>
                                 </div>
                              </div>
                           )}
                           {parseFloat(cashAmount || '0') < cartTotal && parseFloat(cashAmount || '0') > 0 && (
                              <div className="mt-2 text-xs text-red-600 dark:text-red-400 font-bold">
                                 Faltam R$ {(cartTotal - parseFloat(cashAmount || '0')).toFixed(2)}
                              </div>
                           )}
                        </div>
                     )}

                     {selectedPaymentMethod !== 'money' && (
                        <div className="mb-4 p-4 bg-slate-50 dark:bg-[#2a2d36] rounded-xl">
                           <div className="flex items-center gap-3">
                              {selectedPaymentMethod === 'pix' && <QrCode className="w-6 h-6 text-teal-500" />}
                              {selectedPaymentMethod === 'card' && <CreditCard className="w-6 h-6 text-slate-600 dark:text-gray-400" />}
                              <span className="font-bold text-slate-700 dark:text-gray-200">
                                 {selectedPaymentMethod === 'pix' ? 'Pix' : 'Cartão de Crédito'}
                              </span>
                           </div>
                        </div>
                     )}
                  </div>

                  <div className="flex gap-3">
                     <button
                        onClick={() => {
                           setShowPaymentModal(false);
                           setSelectedPaymentMethod(null);
                           setCashAmount('');
                        }}
                        className="flex-1 py-3 bg-slate-100 dark:bg-[#2a2d36] text-slate-700 dark:text-gray-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                     >
                        Cancelar
                     </button>
                     <button
                        onClick={() => {
                           if (selectedPaymentMethod === 'money') {
                              const received = parseFloat(cashAmount || '0');
                              if (received < cartTotal) {
                                 alert('Valor recebido deve ser maior ou igual ao total!');
                                 return;
                              }
                              handleCheckout(selectedPaymentMethod, received);
                           } else {
                              handleCheckout(selectedPaymentMethod);
                           }
                        }}
                        className="flex-1 py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 shadow-lg shadow-rose-200 dark:shadow-none transition-all flex items-center justify-center gap-2"
                     >
                        <CheckCircle2 className="w-5 h-5" />
                        Confirmar
                     </button>
                  </div>
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
            product={editingProduct}
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