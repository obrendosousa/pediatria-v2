'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
const supabase = createClient();
import { Task, Sale, SaleItem } from '@/types';
// ADICIONADO: AlertCircle na importação abaixo
import { X, DollarSign, CreditCard, Wallet, Banknote, ShoppingBag, CheckCircle2, AlertCircle } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import { normalizePaymentSplits, resolveSalePaymentMethodFromSplits } from '@/lib/finance';
import { createFinancialTransaction } from '@/lib/financialTransactions';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
  onSuccess: () => void;
}

export default function PaymentModal({ isOpen, onClose, task, onSuccess }: PaymentModalProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [sale, setSale] = useState<Sale | null>(null);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'credit_card' | 'debit_card' | 'cash'>('pix');

  useEffect(() => {
    if (isOpen && task) {
      fetchSaleDetails();
    }
  }, [isOpen, task]);

  async function fetchSaleDetails() {
    setLoading(true);
    // Busca a última venda PENDENTE deste cliente
    const { data: saleData } = await supabase
      .from('sales' as any)
      .select('*')
      .eq('chat_id', task?.chat_id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (saleData) {
      setSale(saleData);
      // Busca os itens dessa venda com Join em produtos para pegar o nome
      const { data: itemsData } = await supabase
        .from('sale_items' as any)
        .select('*, products(name)')
        .eq('sale_id', saleData.id);
      
      if (itemsData) setItems(itemsData);
    }
    setLoading(false);
  }

  // Calcula o total na hora
  const total = items.reduce((acc, item) => acc + (item.unit_price * item.quantity), 0);

  async function handleConfirmPayment() {
    if (!sale || !task) return;
    setLoading(true);

    try {
        // 1. Atualiza a Venda para PAGO
        const paymentSplits = normalizePaymentSplits(total, paymentMethod);
        const salePaymentMethod = resolveSalePaymentMethodFromSplits(paymentSplits);
        await supabase.from('sales' as any).update({
            status: 'completed',
            total: total,
            payment_method: salePaymentMethod,
            created_by: user?.id ?? null
        }).eq('id', sale.id);

        await createFinancialTransaction(supabase, {
          amount: total,
          origin: 'loja',
          createdBy: user?.id ?? null,
          saleId: sale.id,
          payments: paymentSplits
        });

        // 2. Baixa o Estoque (Opcional)
        for (const item of items) {
             const { data: prod } = await supabase.from('products').select('stock').eq('id', item.product_id).single();
             if (prod) {
                 await supabase.from('products').update({ stock: prod.stock - item.quantity }).eq('id', item.product_id);
             }
        }

        // 3. Marca a Tarefa como FEITA
        await supabase.from('tasks' as any).update({ status: 'done' }).eq('id', task.id);

        onSuccess();
        onClose();
    } catch (error) {
        console.error(error);
        toast.toast.error('Erro ao processar pagamento.');
    } finally {
        setLoading(false);
    }
  }

  if (!isOpen || !task) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[60] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-fade-in-up">
        
        {/* Header */}
        <div className="bg-slate-50 p-6 border-b border-slate-100 flex justify-between items-center">
            <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <DollarSign className="w-6 h-6 text-green-600" /> Confirmar Pagamento
                </h2>
                <p className="text-sm text-slate-500">Cliente: <span className="font-bold text-slate-700">{task.chats?.phone}</span></p>
            </div>
            <button onClick={onClose} className="p-2 bg-white rounded-full text-slate-400 hover:text-slate-600 hover:shadow-md transition-all"><X className="w-5 h-5" /></button>
        </div>

        {loading && !sale ? (
            <div className="p-8 text-center text-slate-400">Carregando detalhes da venda...</div>
        ) : !sale ? (
            <div className="p-8 text-center text-slate-400">
                <AlertCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Nenhuma venda pendente encontrada para este cliente.</p>
                <button onClick={() => { onSuccess(); onClose(); }} className="mt-4 text-sm text-red-500 underline">Concluir tarefa mesmo assim</button>
            </div>
        ) : (
            <>
                {/* Lista de Itens */}
                <div className="p-6 bg-slate-50/50 max-h-48 overflow-y-auto custom-scrollbar">
                    <h3 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2"><ShoppingBag className="w-4 h-4" /> Resumo do Pedido</h3>
                    <div className="space-y-2">
                        {items.map(item => (
                            <div key={item.id} className="flex justify-between items-center text-sm">
                                <span className="text-slate-700 font-medium">
                                    {item.quantity}x {(item.products as any)?.name || 'Produto'}
                                </span>
                                <span className="text-slate-500">R$ {(item.unit_price * item.quantity).toFixed(2)}</span>
                            </div>
                        ))}
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-200 flex justify-between items-center">
                        <span className="font-bold text-slate-800">TOTAL</span>
                        <span className="font-bold text-xl text-green-600">R$ {total.toFixed(2)}</span>
                    </div>
                </div>

                {/* Forma de Pagamento */}
                <div className="p-6">
                    <h3 className="text-xs font-bold text-slate-400 uppercase mb-3">Forma de Pagamento</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => setPaymentMethod('pix')} className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${paymentMethod === 'pix' ? 'bg-green-50 border-green-500 text-green-700' : 'bg-white border-slate-200 text-slate-500 hover:border-green-300'}`}>
                            <div className="w-1 h-1 bg-current rounded-full shadow-[0_0_8px_currentColor]"></div> <span className="text-sm font-bold">PIX</span>
                        </button>
                        <button onClick={() => setPaymentMethod('credit_card')} className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${paymentMethod === 'credit_card' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white border-slate-200 text-slate-500 hover:border-blue-300'}`}>
                            <CreditCard className="w-5 h-5" /> <span className="text-sm font-bold">Crédito</span>
                        </button>
                        <button onClick={() => setPaymentMethod('debit_card')} className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${paymentMethod === 'debit_card' ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-300'}`}>
                            <Wallet className="w-5 h-5" /> <span className="text-sm font-bold">Débito</span>
                        </button>
                        <button onClick={() => setPaymentMethod('cash')} className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${paymentMethod === 'cash' ? 'bg-orange-50 border-orange-500 text-orange-700' : 'bg-white border-slate-200 text-slate-500 hover:border-orange-300'}`}>
                            <Banknote className="w-5 h-5" /> <span className="text-sm font-bold">Dinheiro</span>
                        </button>
                    </div>

                    <button 
                        onClick={handleConfirmPayment}
                        disabled={loading}
                        className="w-full mt-6 py-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold shadow-lg shadow-green-200 transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                        {loading ? 'Processando...' : <><CheckCircle2 className="w-5 h-5" /> Confirmar Recebimento</>}
                    </button>
                </div>
            </>
        )}
      </div>
    </div>
  );
}