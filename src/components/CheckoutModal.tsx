'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
const supabase = createClient();
import { Product } from '@/types';
import { X, ShoppingBag, Calendar, Check, Trash, Search, CreditCard, Banknote, QrCode, Clock, Loader2, FileText } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { submitCheckout } from '@/lib/checkoutClient';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  task: any;
  onSuccess: () => void;
}

export default function CheckoutModal({ isOpen, onClose, task, onSuccess }: CheckoutModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  // Dados do Banco
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');

  // Estado do Checkout (Editável)
  const [cart, setCart] = useState<{product: Product, qty: number}[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('credit_card');
  
  // Estado do Agendamento
  const [returnDate, setReturnDate] = useState('');
  const [returnTime, setReturnTime] = useState('09:00');
  const [needsReturn, setNeedsReturn] = useState(false);

  // Carrega dados ao abrir
  useEffect(() => {
    if (isOpen && task) {
        fetchProducts();
        parseDoctorRequest();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, task]);

  async function fetchProducts() {
    const { data } = await supabase.from('products').select('*').eq('active', true).order('name');
    if (data) setAllProducts(data);
  }

  // Lê o pacote que a doutora enviou e preenche a tela da secretária
  function parseDoctorRequest() {
      const payload = task.metadata?.checkout_payload;
      if (!payload) return;

      // 1. Preenche Carrinho Sugerido
      if (payload.suggested_products && payload.suggested_products.length > 0) {
          // Precisamos mapear os IDs sugeridos para os objetos de produto reais
          // (Isso será feito quando allProducts carregar, mas por simplificação, 
          // vamos assumir que o payload tem dados suficientes ou faremos o match visual)
          // *Nota:* Para simplificar aqui, vou montar o carrinho baseado no payload direto,
          // mas o ideal é bater com 'allProducts'.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const mappedCart = payload.suggested_products.map((p: any) => ({
              product: { id: p.id, name: p.name, price_sale: p.price }, // Mock parcial
              qty: p.qty
          }));
          setCart(mappedCart);
      } else {
          setCart([]);
      }

      // 2. Preenche Sugestão de Retorno
      if (payload.return_suggestion && payload.return_suggestion.type !== 'none') {
          setNeedsReturn(true);
          // Se a doutora mandou data específica, usa ela. Senão, calcula.
          if (payload.return_suggestion.specific_date) {
              setReturnDate(payload.return_suggestion.specific_date);
          } else {
              const daysToAdd = payload.return_suggestion.type === '15days' ? 15 : 
                                payload.return_suggestion.type === '1month' ? 30 : 180;
              const d = new Date();
              d.setDate(d.getDate() + daysToAdd);
              setReturnDate(d.toISOString().split('T')[0]);
          }
      } else {
          setNeedsReturn(false);
      }
  }

  // --- Lógica do Carrinho ---
  const addToCart = (product: Product) => {
    const existing = cart.find(i => i.product.id === product.id);
    if (existing) setCart(cart.map(i => i.product.id === product.id ? { ...i, qty: i.qty + 1 } : i));
    else setCart([...cart, { product, qty: 1 }]);
  };

  const removeFromCart = (id: number) => setCart(cart.filter(i => i.product.id !== id));
  const productsTotal = cart.reduce((acc, item) => acc + (item.product.price_sale * item.qty), 0);
  const consultationValue = task?.raw_data?.consultation_value || 0;
  const total = productsTotal + consultationValue;

  // --- ACAO FINAL: CONCLUIR TUDO ---
  async function handleFinish() {
    setLoading(true);
    try {
        const patientName = task.chats?.contact_name || task.title.replace('CHECKOUT: ', '');
        const consultationValue = task.raw_data?.consultation_value || 0;

        if (cart.length > 0 || consultationValue > 0) {
            // Montar itens para API server-side
            const items = [
              ...cart.map(item => ({
                product_id: item.product.id,
                qty: item.qty,
                type: 'product' as const,
                name: item.product.name,
                price: item.product.price_sale
              })),
              ...(consultationValue > 0 ? [{
                product_id: null,
                qty: 1,
                type: 'debt' as const,
                name: 'Valor da Consulta',
                price: consultationValue
              }] : [])
            ];

            // Checkout atomico via API server-side
            await submitCheckout({
              appointment_id: task.raw_data?.appointment_id ?? null,
              medical_checkout_id: task.origin_table === 'medical_checkouts' ? task.id : null,
              patient_id: task.patient_id ?? task.raw_data?.patient_id ?? null,
              chat_id: task.chat_id ?? null,
              items,
              payment_method: paymentMethod,
              client_total: total
            });
        }

        // Processar Agendamento de retorno (operacao secundaria)
        if (needsReturn && returnDate) {
            await supabase.from('tasks').insert({
                title: `Retorno: ${patientName}`,
                description: `Agendado via Checkout.\nReferente ao atendimento do dia ${new Date().toLocaleDateString('pt-BR')}.`,
                type: 'general',
                status: 'pending',
                chat_id: task.chat_id,
                due_date: returnDate,
                due_time: returnTime,
                metadata: { is_return: true }
            });
        }

        // Finalizar task (se nao for medical_checkout, que ja foi finalizado pelo RPC)
        if (task.origin_table !== 'medical_checkouts') {
            await supabase.from('tasks').update({ status: 'done' }).eq('id', task.id);
        }

        // Atualizar chat (operacao secundaria)
        if (task.chat_id) {
            await supabase.from('chats').update({
                reception_status: 'finished',
                last_interaction_at: new Date().toISOString()
            }).eq('id', task.chat_id);
        }

        onSuccess();
        onClose();

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Erro ao processar checkout.';
        toast.error(message);
    } finally {
        setLoading(false);
    }
  }

  if (!isOpen || !task) return null;

  const payload = task.metadata?.checkout_payload;

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl h-[80vh] rounded-[32px] shadow-2xl flex overflow-hidden animate-fade-in-up">
        
        {/* COLUNA ESQUERDA: RESUMO MÉDICO (Contexto) */}
        <div className="w-1/3 bg-slate-50 border-r border-slate-200 p-6 flex flex-col overflow-y-auto">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <FileText className="w-4 h-4"/> Resumo da Doutora
            </h3>
            
            <div className="space-y-6">
                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                    <p className="text-xs font-bold text-slate-500 mb-1">Paciente</p>
                    <p className="font-bold text-slate-800 text-lg leading-tight">{task.chats?.contact_name || task.title}</p>
                </div>

                {payload?.medical_notes && (
                    <div>
                        <p className="text-xs font-bold text-slate-500 mb-2">Exames / Notas</p>
                        <div className="bg-purple-50 p-4 rounded-2xl border border-purple-100 text-sm text-purple-900 italic leading-relaxed">
                            &ldquo;{payload.medical_notes}&rdquo;
                        </div>
                    </div>
                )}

                {payload?.return_suggestion && payload.return_suggestion.type !== 'none' && (
                    <div>
                        <p className="text-xs font-bold text-slate-500 mb-2">Sugestão de Retorno</p>
                        <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 flex items-center gap-2 text-blue-800 font-bold text-sm">
                            <Clock className="w-4 h-4"/> {payload.return_suggestion.label}
                        </div>
                    </div>
                )}
            </div>
        </div>

        {/* COLUNA DIREITA: AÇÃO DA SECRETÁRIA */}
        <div className="flex-1 flex flex-col bg-white">
            
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-800">Checkout e Fechamento</h2>
                <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-full text-slate-400"><X className="w-6 h-6"/></button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                
                {/* 1. CARRINHO (Editável) */}
                <section>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-slate-700 flex items-center gap-2"><ShoppingBag className="w-5 h-5 text-rose-500"/> Lojinha / Vacinas</h3>
                        <div className="relative">
                            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Adicionar item..." className="pl-8 p-1.5 bg-slate-100 rounded-lg text-xs outline-none focus:ring-1 ring-rose-300 w-48 transition-all"/>
                            <Search className="w-3 h-3 text-slate-400 absolute left-3 top-2"/>
                            {/* Dropdown de busca simples */}
                            {search.length > 2 && (
                                <div className="absolute top-full right-0 w-64 bg-white shadow-xl rounded-xl border border-slate-100 mt-2 p-2 z-10 max-h-48 overflow-y-auto">
                                    {allProducts.filter(p => p.name.toLowerCase().includes(search.toLowerCase())).map(p => (
                                        <button key={p.id} onClick={() => { addToCart(p); setSearch(''); }} className="w-full text-left p-2 hover:bg-slate-50 rounded-lg text-xs font-bold text-slate-700 flex justify-between">
                                            <span>{p.name}</span><span>R$ {p.price_sale}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
                        {cart.length === 0 ? (
                            <div className="p-8 text-center text-slate-400 text-sm">Nenhum produto selecionado.</div>
                        ) : (
                            <div>
                                {cart.map(item => (
                                    <div key={item.product.id} className="flex items-center justify-between p-4 border-b border-slate-100 last:border-0 hover:bg-white transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-white rounded-lg border border-slate-200 flex items-center justify-center font-bold text-xs">{item.qty}x</div>
                                            <div><p className="font-bold text-sm text-slate-800">{item.product.name}</p></div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="font-bold text-slate-600">R$ {(item.product.price_sale * item.qty).toFixed(2)}</span>
                                            <button onClick={() => removeFromCart(item.product.id)} className="text-slate-300 hover:text-red-500"><Trash className="w-4 h-4"/></button>
                                        </div>
                                    </div>
                                ))}
                                {consultationValue > 0 && (
                                    <div className="p-4 border-b border-slate-100 bg-blue-50/50">
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <p className="text-xs font-bold text-blue-600">Valor da Consulta</p>
                                                <p className="text-xs text-blue-500">Cobrado pela doutora</p>
                                            </div>
                                            <span className="text-lg font-black text-blue-700">R$ {consultationValue.toFixed(2)}</span>
                                        </div>
                                    </div>
                                )}
                                <div className="bg-slate-100 p-4 flex justify-between items-center">
                                    <span className="text-xs font-bold uppercase text-slate-500">Total a Pagar</span>
                                    <span className="text-xl font-black text-slate-800">R$ {total.toFixed(2)}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {cart.length > 0 && (
                        <div className="mt-4 flex gap-2">
                            {['credit_card', 'debit_card', 'pix', 'cash'].map(m => (
                                <button key={m} onClick={() => setPaymentMethod(m)} className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all flex justify-center items-center gap-2 ${paymentMethod === m ? 'bg-slate-800 text-white border-slate-800' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                                    {m === 'pix' && <QrCode className="w-3 h-3"/>}
                                    {m === 'cash' && <Banknote className="w-3 h-3"/>}
                                    {(m === 'credit_card' || m === 'debit_card') && <CreditCard className="w-3 h-3"/>}
                                    {m === 'credit_card' ? 'Crédito' : m === 'debit_card' ? 'Débito' : m === 'pix' ? 'Pix' : 'Dinheiro'}
                                </button>
                            ))}
                        </div>
                    )}
                </section>

                <hr className="border-slate-100"/>

                {/* 2. AGENDAMENTO DE RETORNO */}
                <section>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-slate-700 flex items-center gap-2"><Calendar className="w-5 h-5 text-blue-500"/> Agendar Retorno</h3>
                        <label className="flex items-center gap-2 cursor-pointer bg-slate-100 px-3 py-1.5 rounded-lg">
                            <input type="checkbox" checked={needsReturn} onChange={e => setNeedsReturn(e.target.checked)} className="accent-blue-600 w-4 h-4" />
                            <span className="text-xs font-bold text-slate-600">Agendar Agora</span>
                        </label>
                    </div>

                    {needsReturn && (
                        <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 flex gap-4 animate-fade-in-up">
                            <div className="flex-1">
                                <label className="block text-[10px] font-bold text-blue-400 uppercase mb-1">Data</label>
                                <input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)} className="w-full p-3 bg-white border border-blue-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 ring-blue-200"/>
                            </div>
                            <div className="w-1/3">
                                <label className="block text-[10px] font-bold text-blue-400 uppercase mb-1">Horário</label>
                                <input type="time" value={returnTime} onChange={e => setReturnTime(e.target.value)} className="w-full p-3 bg-white border border-blue-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 ring-blue-200"/>
                            </div>
                        </div>
                    )}
                </section>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-100 flex justify-end">
                <button onClick={handleFinish} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3.5 rounded-xl font-bold shadow-lg shadow-emerald-200 flex items-center gap-3 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100">
                    {loading ? <Loader2 className="w-5 h-5 animate-spin"/> : <><Check className="w-5 h-5"/> Confirmar e Liberar</>}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
}