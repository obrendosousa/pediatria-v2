'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Product, Chat } from '@/types';
import { 
  Search, ShoppingCart, Trash2, User, CreditCard, 
  ArrowLeft, Minus, Plus, ScanBarcode, CheckCircle2, 
  AlertCircle, Stethoscope, ArrowDown 
} from 'lucide-react';

// Tipo local para o item do carrinho
interface CartItem extends Product {
  qty: number;
}

interface Indication {
  id: number;
  product_id: number;
  products: Product;
}

export default function PDVPage() {
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // Estados de Dados
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Chat[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  
  // Estados de Controle
  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<Chat | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  // NOVO: Indicações Médicas
  const [indications, setIndications] = useState<Indication[]>([]);

  useEffect(() => {
    fetchData();
    setTimeout(() => searchInputRef.current?.focus(), 100);
  }, []);

  // Monitora seleção de cliente para buscar indicações
  useEffect(() => {
    if (selectedClient) {
        fetchIndications(selectedClient.id);
    } else {
        setIndications([]);
    }
  }, [selectedClient]);

  // Filtro em tempo real
  useEffect(() => {
    if (!search.trim()) {
      setFilteredProducts(products);
      return;
    }
    const lower = search.toLowerCase();
    const filtered = products.filter(p => p.name.toLowerCase().includes(lower));
    setFilteredProducts(filtered);
  }, [search, products]);

  async function fetchData() {
    setLoading(true);
    // 1. Produtos com estoque > 0
    const { data: prods } = await supabase
        .from('products')
        .select('*')
        .eq('active', true)
        .gt('stock', 0)
        .order('name');
    
    // 2. Clientes (Chats recentes)
    const { data: chats } = await supabase
        .from('chats')
        .select('id, phone, contact_name, updated_at')
        .order('last_interaction_at', { ascending: false })
        .limit(50);

    if (prods) setProducts(prods as Product[]);
    if (prods) setFilteredProducts(prods as Product[]);
    if (chats) setClients(chats as Chat[]);
    setLoading(false);
  }

  // --- NOVA FUNÇÃO: Buscar Indicações ---
  async function fetchIndications(chatId: number) {
      const { data } = await supabase
        .from('product_indications')
        .select(`
            id, product_id,
            products (*)
        `)
        .eq('chat_id', chatId)
        .eq('status', 'pending'); // Só pega o que ainda não foi comprado

      if (data && data.length > 0) {
          // Mapeia corretamente garantindo que 'products' não é array
          const validIndications = data.map((item: any) => ({
              id: item.id,
              product_id: item.product_id,
              products: Array.isArray(item.products) ? item.products[0] : item.products
          })).filter(i => i.products); // Remove nulos caso produto tenha sido deletado
          
          setIndications(validIndications);
      } else {
          setIndications([]);
      }
  }

  // --- LÓGICA DO CARRINHO ---

  function addToCart(product: Product) {
    const existingIndex = cart.findIndex(item => item.id === product.id);
    
    if (existingIndex >= 0) {
        const currentQty = cart[existingIndex].qty;
        if (currentQty + 1 > product.stock) {
            alert(`Estoque insuficiente! Disponível: ${product.stock}`);
            return;
        }
        const newCart = [...cart];
        newCart[existingIndex].qty += 1;
        setCart(newCart);
    } else {
        setCart([...cart, { ...product, qty: 1 }]);
    }
    setSearch('');
    searchInputRef.current?.focus();
  }

  function addIndicationToCart() {
      if (indications.length === 0) return;

      const newCart = [...cart];
      
      indications.forEach(ind => {
          const product = ind.products;
          const existingIndex = newCart.findIndex(item => item.id === product.id);

          if (existingIndex >= 0) {
              // Se já está no carrinho, não duplica (opcional: poderia somar)
          } else {
              if (product.stock > 0) {
                  newCart.push({ ...product, qty: 1 });
              }
          }
      });

      setCart(newCart);
      // Opcional: Limpar indicações da tela para não poluir, 
      // mas mantemos no banco como 'pending' até o pagamento real.
      setIndications([]); 
  }

  function updateQty(id: number, delta: number) {
    const newCart = cart.map(item => {
        if (item.id === id) {
            const newQty = item.qty + delta;
            if (newQty > item.stock) return item;
            return { ...item, qty: Math.max(0, newQty) };
        }
        return item;
    }).filter(item => item.qty > 0);
    
    setCart(newCart);
  }

  // Cálculos Totais
  const totalItems = cart.reduce((acc, item) => acc + item.qty, 0);
  const totalPrice = cart.reduce((acc, item) => acc + (item.price_sale * item.qty), 0);

  // --- FINALIZAR VENDA ---
  async function handleCheckout() {
      if (cart.length === 0) return alert("Carrinho vazio.");
      if (!selectedClient) {
          if(!confirm("Fechar venda sem identificar o paciente?")) return;
      }

      setProcessing(true);
      
      try {
        const payload = {
            chat_id: selectedClient?.id || null,
            items: cart.map(i => ({ id: i.id, qty: i.qty, price: i.price_sale })),
            payment_method: 'DINHEIRO/PIX'
        };

        const response = await fetch('/api/sales', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error(await response.text());

        // SE SUCESSO: Atualizar status das indicações para 'bought'
        if (selectedClient && indications.length > 0) {
            // Marca como comprado todas as indicações deste cliente que estavam no carrinho
            // Simplificação: marca todas pendentes do cliente
            await supabase
                .from('product_indications')
                .update({ status: 'bought' })
                .eq('chat_id', selectedClient.id);
        }

        alert("Venda realizada com sucesso!");
        setCart([]);
        setSelectedClient(null);
        setIndications([]);
        fetchData();
      } catch (err) {
          console.error(err);
          alert("Erro ao processar venda.");
      } finally {
          setProcessing(false);
      }
  }

  return (
    <div className="h-screen flex bg-slate-100 overflow-hidden font-sans">
      
      {/* === COLUNA ESQUERDA: CATÁLOGO === */}
      <div className="flex-1 flex flex-col pr-0">
        
        {/* Header */}
        <div className="h-24 bg-white border-b border-slate-200 px-8 flex items-center gap-6 shadow-sm z-10">
            <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
                <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="flex-1 relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                <input 
                    ref={searchInputRef}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'Enter' && filteredProducts.length > 0) {
                            addToCart(filteredProducts[0]);
                        }
                    }}
                    placeholder="Buscar produto ou escanear código de barras..." 
                    className="w-full pl-12 pr-4 py-4 bg-slate-100 border-2 border-transparent focus:bg-white focus:border-blue-500 rounded-2xl outline-none text-lg font-medium transition-all shadow-inner"
                    autoFocus
                />
            </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            {loading ? (
                <div className="flex items-center justify-center h-full text-slate-400">Carregando catálogo...</div>
            ) : filteredProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-60">
                    <AlertCircle className="w-16 h-16 mb-4 stroke-1" />
                    <p className="text-lg">Produto não encontrado.</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredProducts.map(prod => (
                        <div 
                            key={prod.id} 
                            onClick={() => addToCart(prod)}
                            className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm hover:shadow-xl hover:border-blue-300 hover:-translate-y-1 transition-all cursor-pointer group flex flex-col h-64"
                        >
                            <div className="h-32 bg-slate-50 rounded-xl mb-4 overflow-hidden relative flex items-center justify-center">
                                {prod.image_url ? (
                                    <img src={prod.image_url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"/>
                                ) : (
                                    <CheckCircle2 className="w-10 h-10 text-slate-200" />
                                )}
                                <span className="absolute top-2 right-2 bg-white/90 backdrop-blur text-xs font-bold px-2 py-1 rounded-lg text-slate-600 shadow-sm">
                                    {prod.stock} un
                                </span>
                            </div>
                            <div className="flex-1 flex flex-col">
                                <h3 className="font-bold text-slate-700 line-clamp-2 leading-tight mb-1 group-hover:text-blue-600 transition-colors">
                                    {prod.name}
                                </h3>
                                <div className="mt-3 flex items-end justify-between mt-auto">
                                    <div className="text-xs text-slate-400 font-bold uppercase">Preço</div>
                                    <div className="text-xl font-extrabold text-slate-800">
                                        R$ {prod.price_sale.toFixed(2)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
      </div>

      {/* === COLUNA DIREITA: CARRINHO & CLIENTE === */}
      <div className="w-[450px] bg-white border-l border-slate-200 shadow-2xl flex flex-col z-20">
        
        {/* 1. Seleção de Cliente */}
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <User className="w-4 h-4" /> Cliente / Paciente
            </h2>
            <select 
                value={selectedClient?.id || ''}
                onChange={e => {
                    const client = clients.find(c => c.id === Number(e.target.value));
                    setSelectedClient(client || null);
                }}
                className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:border-blue-500 shadow-sm"
            >
                <option value="">Consumidor Final (Não identificado)</option>
                {clients.map(c => (
                    <option key={c.id} value={c.id}>
                        {c.contact_name || c.phone}
                    </option>
                ))}
            </select>
        </div>

        {/* 1.5 ALERTA DE PRESCRIÇÃO (O Grand Finale) */}
        {indications.length > 0 && (
            <div className="mx-6 mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl animate-fade-in-up relative overflow-hidden">
                <div className="absolute top-0 right-0 p-2 opacity-10"><Stethoscope className="w-16 h-16 text-amber-600"/></div>
                <div className="flex items-start gap-3 relative z-10">
                    <div className="p-2 bg-amber-100 text-amber-600 rounded-lg"><Stethoscope className="w-5 h-5"/></div>
                    <div className="flex-1">
                        <h4 className="font-bold text-amber-800 text-sm">Prescrição Médica Detectada</h4>
                        <p className="text-xs text-amber-700/80 mb-2">A Dra. indicou {indications.length} itens para este paciente.</p>
                        
                        <div className="flex flex-wrap gap-1 mb-3">
                            {indications.map(ind => (
                                <span key={ind.id} className="text-[10px] font-bold bg-white/60 text-amber-800 px-2 py-1 rounded border border-amber-100">
                                    {ind.products.name}
                                </span>
                            ))}
                        </div>

                        <button 
                            onClick={addIndicationToCart}
                            className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold shadow-sm flex items-center justify-center gap-2 transition-all active:scale-95"
                        >
                            <ArrowDown className="w-4 h-4" /> Adicionar Tudo ao Carrinho
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* 2. Lista de Itens */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
            {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-60">
                    <ShoppingCart className="w-16 h-16 mb-4 stroke-1" />
                    <p>Carrinho vazio.</p>
                </div>
            ) : (
                cart.map(item => (
                    <div key={item.id} className="flex items-center gap-4 animate-fade-in-right">
                        <div className="w-12 h-12 bg-slate-50 rounded-lg flex items-center justify-center border border-slate-100 overflow-hidden shrink-0">
                            {item.image_url ? <img src={item.image_url} className="w-full h-full object-cover"/> : <CheckCircle2 className="w-5 h-5 text-slate-300"/>}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-slate-700 text-sm truncate">{item.name}</h4>
                            <p className="text-xs text-slate-400">R$ {item.price_sale.toFixed(2)} x {item.qty}</p>
                        </div>
                        <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-1 border border-slate-100">
                            <button onClick={() => updateQty(item.id, -1)} className="p-1 hover:bg-white hover:text-red-500 rounded-md"><Minus className="w-3 h-3"/></button>
                            <span className="text-sm font-bold text-slate-700 w-4 text-center">{item.qty}</span>
                            <button onClick={() => updateQty(item.id, 1)} className="p-1 hover:bg-white hover:text-green-600 rounded-md"><Plus className="w-3 h-3"/></button>
                        </div>
                        <div className="text-right min-w-[60px]">
                            <p className="font-bold text-slate-800 text-sm">R$ {(item.price_sale * item.qty).toFixed(2)}</p>
                        </div>
                    </div>
                ))
            )}
        </div>

        {/* 3. Totais */}
        <div className="p-8 bg-slate-900 text-white rounded-tl-[3rem] shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
            <div className="flex justify-between text-2xl font-bold text-white mb-6">
                <span>Total</span>
                <span>R$ {totalPrice.toFixed(2)}</span>
            </div>
            <button 
                onClick={handleCheckout}
                disabled={processing || cart.length === 0}
                className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all ${processing || cart.length === 0 ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg'}`}
            >
                {processing ? '...' : <><CreditCard className="w-6 h-6" /> Finalizar Venda</>}
            </button>
        </div>
      </div>
    </div>
  );
}