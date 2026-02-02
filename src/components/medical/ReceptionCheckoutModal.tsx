'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Appointment } from '@/types/medical';
import { Product } from '@/types';
import { X, DollarSign, ShoppingBag, Search, Plus, Minus, Loader2, Save, User, Phone, Calendar, Clock } from 'lucide-react';

interface ReceptionCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointmentId: number;
  onSuccess?: () => void;
}

interface SelectedItem {
  id: number;
  qty: number;
  type: 'product' | 'service';
  product: Product;
}

export default function ReceptionCheckoutModal({
  isOpen,
  onClose,
  appointmentId,
  onSuccess
}: ReceptionCheckoutModalProps) {
  const [loading, setLoading] = useState(false);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<string>('BALCÃO');

  useEffect(() => {
    if (isOpen && appointmentId) {
      fetchAppointment();
      fetchCatalog();
      setSelectedItems([]);
      setSearch('');
      setPaymentMethod('BALCÃO');
    }
  }, [isOpen, appointmentId]);

  async function fetchAppointment() {
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('id', appointmentId)
        .single();

      if (error) throw error;
      setAppointment(data as Appointment);
    } catch (err) {
      console.error('Erro ao buscar agendamento:', err);
      alert('Erro ao carregar dados do agendamento.');
    }
  }

  async function fetchCatalog() {
    try {
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('active', true)
        .order('name');
      
      if (data) setCatalog(data as Product[]);
    } catch (err) {
      console.error('Erro ao buscar catálogo:', err);
    }
  }

  function addItem(product: Product, type: 'product' | 'service') {
    const existing = selectedItems.find(i => i.id === product.id);
    if (existing) {
      setSelectedItems(selectedItems.map(i => 
        i.id === product.id ? { ...i, qty: i.qty + 1 } : i
      ));
    } else {
      setSelectedItems([...selectedItems, { id: product.id, qty: 1, type, product }]);
    }
  }

  function removeItem(id: number) {
    const existing = selectedItems.find(i => i.id === id);
    if (existing && existing.qty > 1) {
      setSelectedItems(selectedItems.map(i => 
        i.id === id ? { ...i, qty: i.qty - 1 } : i
      ));
    } else {
      setSelectedItems(selectedItems.filter(i => i.id !== id));
    }
  }

  const filteredCatalog = catalog.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const total = selectedItems.reduce((acc, item) => 
    acc + (item.product.price_sale * item.qty), 0
  );

  async function handleSubmit() {
    if (!appointment || selectedItems.length === 0) {
      alert('Adicione pelo menos um item ao checkout.');
      return;
    }

    setLoading(true);

    try {
      // 1. Buscar ou criar chat do paciente
      let chatId: number | null = null;
      if (appointment.patient_phone) {
        const cleanPhone = appointment.patient_phone.replace(/\D/g, '');
        const { data: existingChat } = await supabase
          .from('chats')
          .select('id')
          .eq('phone', cleanPhone)
          .maybeSingle();

        if (existingChat) {
          chatId = existingChat.id;
        } else {
          const { data: newChat } = await supabase
            .from('chats')
            .insert({
              phone: cleanPhone,
              contact_name: appointment.patient_name || cleanPhone,
              status: 'ACTIVE',
              created_at: new Date().toISOString(),
              last_interaction_at: new Date().toISOString()
            })
            .select()
            .single();
          
          if (newChat) chatId = newChat.id;
        }
      }

      if (!chatId) {
        throw new Error('Não foi possível criar/encontrar chat do paciente.');
      }

      // 2. Registrar venda
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert({
          chat_id: chatId,
          total: total,
          status: 'paid',
          payment_method: paymentMethod
        })
        .select()
        .single();

      if (saleError) throw saleError;

      // 3. Registrar itens da venda
      for (const item of selectedItems) {
        await supabase.from('sale_items').insert({
          sale_id: sale.id,
          product_id: item.product.id,
          quantity: item.qty,
          unit_price: item.product.price_sale
        });

        // Baixar estoque se for produto
        if (item.type === 'product') {
          const { data: batches } = await supabase
            .from('product_batches')
            .select('*')
            .eq('product_id', item.product.id)
            .gt('quantity', 0)
            .order('expiration_date', { ascending: true });

          if (batches) {
            let qtyNeed = item.qty;
            for (const batch of batches) {
              if (qtyNeed <= 0) break;
              const take = Math.min(batch.quantity, qtyNeed);
              await supabase
                .from('product_batches')
                .update({ quantity: batch.quantity - take })
                .eq('id', batch.id);
              qtyNeed -= take;
            }
          }
        }
      }

      alert('Checkout realizado com sucesso!');
      if (onSuccess) onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Erro ao processar checkout:', error);
      alert('Erro ao processar checkout: ' + (error.message || 'Tente novamente.'));
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white dark:bg-[#1e2028] rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#2a2d36] flex justify-between items-center">
          <h3 className="font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <DollarSign className="text-green-600 dark:text-green-400" size={20}/>
            Checkout - {appointment?.patient_name || 'Paciente'}
          </h3>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition-colors"
          >
            <X size={20} className="text-gray-400 dark:text-gray-500"/>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          
          {/* Informações do Agendamento */}
          {appointment && (
            <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-[#111b21] rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Paciente</p>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                    {appointment.patient_name || 'Não informado'}
                  </p>
                </div>
              </div>
              {appointment.patient_phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Telefone</p>
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                      {appointment.patient_phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')}
                    </p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Horário</p>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                    {appointment.start_time ? new Date(appointment.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Data</p>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                    {appointment.start_time ? new Date(appointment.start_time).toLocaleDateString('pt-BR') : 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Busca de Produtos */}
          <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">
              Adicionar Produtos/Serviços
            </label>
            <div className="relative mb-3">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar produtos..."
                className="w-full pl-9 pr-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-[#2a2d36] text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all"
              />
            </div>
            <div className="max-h-48 overflow-y-auto space-y-2 custom-scrollbar">
              {filteredCatalog.map(product => (
                <div
                  key={product.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#111b21] rounded-lg border border-gray-200 dark:border-gray-700 hover:border-green-300 dark:hover:border-green-700 transition-all"
                >
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                      {product.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      R$ {product.price_sale.toFixed(2)}
                    </p>
                  </div>
                  <button
                    onClick={() => addItem(product, product.category === 'servico' ? 'service' : 'product')}
                    className="p-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Itens Selecionados */}
          {selectedItems.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">
                Itens Selecionados
              </label>
              <div className="space-y-2">
                {selectedItems.map(item => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 bg-white dark:bg-[#2a2d36] rounded-lg border border-gray-200 dark:border-gray-700"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                        {item.product.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        R$ {item.product.price_sale.toFixed(2)} x {item.qty}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
                        R$ {(item.product.price_sale * item.qty).toFixed(2)}
                      </p>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => removeItem(item.id)}
                          className="p-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 w-8 text-center">
                          {item.qty}
                        </span>
                        <button
                          onClick={() => addItem(item.product, item.type)}
                          className="p-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Método de Pagamento */}
          <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">
              Método de Pagamento
            </label>
            <select
              value={paymentMethod}
              onChange={e => setPaymentMethod(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-[#2a2d36] text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all"
            >
              <option value="BALCÃO">Balcão</option>
              <option value="PIX">PIX</option>
              <option value="CARTÃO">Cartão</option>
              <option value="DINHEIRO">Dinheiro</option>
            </select>
          </div>

          {/* Total */}
          <div className="p-4 bg-green-50 dark:bg-green-900/10 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase">Total</span>
              <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                R$ {total.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#2a2d36] flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg text-sm font-bold transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || selectedItems.length === 0}
            className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-bold shadow-lg flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin"/>
                Processando...
              </>
            ) : (
              <>
                <Save size={16}/>
                Finalizar Pagamento
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
