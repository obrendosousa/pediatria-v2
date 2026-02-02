'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { MedicalCheckout, Product } from '@/types';
import { 
  Bell, X, CheckCircle2, Calendar, DollarSign, 
  ShoppingBag, Activity, ChevronRight, CreditCard, Clock 
} from 'lucide-react';

export default function SecretaryCheckoutDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [checkouts, setCheckouts] = useState<MedicalCheckout[]>([]);
  const [selectedCheckout, setSelectedCheckout] = useState<MedicalCheckout | null>(null);
  const [loading, setLoading] = useState(false);

  // --- MONITORAMENTO DESATIVADO (Botão removido) ---
  /* useEffect(() => {
    fetchCheckouts();

    const channel = supabase
      .channel('secretary_checkout_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'medical_checkouts' }, () => {
        fetchCheckouts();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);
  */

  async function fetchCheckouts() {
    // Busca Checkouts Pendentes com todos os detalhes aninhados
    const { data } = await supabase
      .from('medical_checkouts')
      .select(`
        *,
        chats ( contact_name, phone ),
        checkout_items (
          quantity, type,
          products ( name, price_sale, category )
        )
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (data) setCheckouts(data as any); 
  }

  // --- AÇÃO: COBRAR E FINALIZAR ---
  async function handleProcessPayment() {
    if (!selectedCheckout) return;
    setLoading(true);

    try {
      // 1. Calcular Total
      const items = selectedCheckout.items || [];
      const total = items.reduce((acc: number, item: any) => acc + (item.products.price_sale * item.quantity), 0);

      // 2. Registrar Venda (Financeiro)
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert({
          chat_id: selectedCheckout.chat_id,
          total: total,
          status: 'paid', // Assumimos recebimento imediato no balcão
          payment_method: 'BALCÃO/MISTO' 
        })
        .select()
        .single();

      if (saleError) throw saleError;

      // 3. Registrar Itens da Venda e Baixar Estoque (Se for produto)
      for (const item of items) {
        // A. Salva histórico do item
        await supabase.from('sale_items').insert({
          sale_id: sale.id,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: (item as any).products.price_sale
        });

        // B. Baixa estoque (Logica FEFO simplificada aqui para não travar, mas idealmente usa a API)
        if (item.type === 'product') {
             const { data: batches } = await supabase
                .from('product_batches')
                .select('*')
                .eq('product_id', item.product_id)
                .gt('quantity', 0)
                .order('expiration_date', { ascending: true });
            
            if (batches) {
                let qtyNeed = item.quantity;
                for (const batch of batches) {
                    if (qtyNeed <= 0) break;
                    const take = Math.min(batch.quantity, qtyNeed);
                    await supabase.from('product_batches').update({ quantity: batch.quantity - take }).eq('id', batch.id);
                    qtyNeed -= take;
                }
            }
        }
      }

      // 4. Se tiver retorno, criar Lembrete/Tarefa para a Secretária
      if (selectedCheckout.return_date) {
        await supabase.from('tasks').insert({
            chat_id: selectedCheckout.chat_id,
            type: 'scheduling',
            title: 'Agendar Retorno (Pós-Consulta)',
            description: `Dra. solicitou retorno para dia ${new Date(selectedCheckout.return_date).toLocaleDateString('pt-BR')}. Obs: ${selectedCheckout.return_obs || 'Sem obs.'}`,
            due_date: selectedCheckout.return_date,
            status: 'pending'
        });
      }

      // 5. Finalizar Checkout (Remove da lista)
      await supabase
        .from('medical_checkouts')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', selectedCheckout.id);

      // Limpeza
      alert("Recebimento registrado com sucesso! Estoque atualizado.");
      setSelectedCheckout(null);
      // fetchCheckouts(); // Desativado
    } catch (error) {
      console.error(error);
      alert("Erro ao processar pagamento.");
    } finally {
      setLoading(false);
    }
  }

  // Cálculos de UI
  const currentTotal = selectedCheckout?.items?.reduce((acc, item: any) => acc + (item.products.price_sale * item.quantity), 0) || 0;

  return (
    <>
      {/* BOTÃO "CAIXA" REMOVIDO DAQUI
         O componente agora renderiza apenas o Drawer (oculto), 
         que não abrirá pois não há botão para setar isOpen(true).
      */}

      {/* 2. O Drawer Lateral */}
      <div className={`fixed inset-y-0 right-0 w-[450px] bg-white shadow-2xl z-50 transform transition-transform duration-300 flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        
        {/* Header */}
        <div className="h-20 bg-slate-50 border-b border-slate-200 flex items-center justify-between px-6">
            <div>
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-emerald-600"/> Checkout Recepção
                </h2>
                <p className="text-xs text-slate-500">Pacientes liberados pela médica</p>
            </div>
            <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white rounded-full transition-all"><X className="w-5 h-5 text-slate-400"/></button>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-hidden flex flex-col">
            
            {/* MODO LISTA (Se nenhum selecionado) */}
            {!selectedCheckout && (
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {checkouts.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60">
                            <CheckCircle2 className="w-16 h-16 mb-4 stroke-1"/>
                            <p>Tudo limpo! Nenhuma pendência.</p>
                        </div>
                    ) : (
                        checkouts.map(checkout => (
                            <div 
                                key={checkout.id} 
                                onClick={() => setSelectedCheckout(checkout)}
                                className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-blue-300 hover:shadow-md cursor-pointer transition-all group"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <p className="font-bold text-slate-800 text-lg">{(checkout.chats as any)?.contact_name || 'Paciente'}</p>
                                        <p className="text-xs text-slate-400 flex items-center gap-1">
                                            <Clock className="w-3 h-3"/> Liberado há {Math.floor((new Date().getTime() - new Date(checkout.created_at).getTime()) / 60000)} min
                                        </p>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500"/>
                                </div>
                                <div className="flex gap-2 mt-3">
                                    {(checkout.items?.length || 0) > 0 && (
                                        <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-1 rounded border border-blue-100 flex items-center gap-1">
                                            <ShoppingBag className="w-3 h-3"/> {checkout.items?.length} Itens
                                        </span>
                                    )}
                                    {checkout.return_date && (
                                        <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-1 rounded border border-emerald-100 flex items-center gap-1">
                                            <Calendar className="w-3 h-3"/> Retorno
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* MODO DETALHE (Se selecionado) */}
            {selectedCheckout && (
                <div className="flex-1 flex flex-col animate-fade-in-right">
                    {/* Botão Voltar */}
                    <button onClick={() => setSelectedCheckout(null)} className="px-6 py-3 text-xs font-bold text-slate-500 hover:text-blue-600 flex items-center gap-1 border-b border-slate-100 bg-slate-50/50">
                        <ChevronRight className="w-3 h-3 rotate-180"/> Voltar para lista
                    </button>

                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        
                        {/* 1. Recados da Médica */}
                        {(selectedCheckout.secretary_notes || selectedCheckout.return_date) && (
                            <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 text-sm">
                                <h4 className="font-bold text-amber-800 mb-2 flex items-center gap-2"><Bell className="w-4 h-4"/> Atenção Recepção</h4>
                                {selectedCheckout.secretary_notes && <p className="text-amber-700 mb-2">"{selectedCheckout.secretary_notes}"</p>}
                                {selectedCheckout.return_date && (
                                    <div className="bg-white/60 p-2 rounded-lg flex items-center gap-2 text-amber-800 font-bold border border-amber-200">
                                        <Calendar className="w-4 h-4"/>
                                        Agendar retorno para: {new Date(selectedCheckout.return_date).toLocaleDateString('pt-BR')}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 2. Resumo da Conta */}
                        <div>
                            <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><CreditCard className="w-4 h-4"/> Resumo da Conta</h4>
                            <div className="border border-slate-200 rounded-xl overflow-hidden">
                                {selectedCheckout.items?.map((item: any, i) => (
                                    <div key={i} className="flex justify-between items-center p-3 border-b border-slate-100 last:border-0 bg-white">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-1.5 rounded-lg ${item.type === 'product' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>
                                                {item.type === 'product' ? <ShoppingBag className="w-3 h-3"/> : <Activity className="w-3 h-3"/>}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-slate-700">{item.products.name}</p>
                                                <p className="text-[10px] text-slate-400">{item.quantity}x R$ {item.products.price_sale.toFixed(2)}</p>
                                            </div>
                                        </div>
                                        <p className="font-bold text-slate-700">R$ {(item.products.price_sale * item.quantity).toFixed(2)}</p>
                                    </div>
                                ))}
                                <div className="bg-slate-50 p-4 flex justify-between items-center">
                                    <span className="text-sm font-bold text-slate-500 uppercase">Total a Pagar</span>
                                    <span className="text-2xl font-extrabold text-slate-800">R$ {currentTotal.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* Footer de Ação */}
                    <div className="p-6 border-t border-slate-100 bg-slate-50">
                        <button 
                            onClick={handleProcessPayment}
                            disabled={loading}
                            className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-lg shadow-lg shadow-emerald-200 flex items-center justify-center gap-2 transition-all active:scale-95"
                        >
                            {loading ? 'Processando...' : <><CheckCircle2 className="w-6 h-6"/> Confirmar & Finalizar</>}
                        </button>
                    </div>
                </div>
            )}

        </div>
      </div>
    </>
  );
}