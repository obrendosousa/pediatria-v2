'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Product } from '@/types';
import { 
  X, CheckCircle2, Calendar, ShoppingBag, 
  Search, Plus, Minus, DollarSign, FileText,
  Clock, Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { saveAppointmentDateTime } from '@/utils/dateUtils';

interface FinishConsultationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  patientId: number;
  appointmentId?: number | null;
  patientName: string;
  onSaveAllData: () => Promise<boolean>; // Função para salvar todos os dados antes de finalizar
}

interface SelectedProduct {
  id: number;
  name: string;
  price: number;
  quantity: number;
}

export default function FinishConsultationModal({
  isOpen,
  onClose,
  onSuccess,
  patientId,
  appointmentId,
  patientName,
  onSaveAllData
}: FinishConsultationModalProps) {
  const [loading, setLoading] = useState(false);
  const [savingData, setSavingData] = useState(false);
  
  // Estados do formulário
  const [notes, setNotes] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [returnObs, setReturnObs] = useState('');
  const [consultationValue, setConsultationValue] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [showProductSearch, setShowProductSearch] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Resetar estados ao abrir
      setNotes('');
      setReturnDate('');
      setReturnObs('');
      setConsultationValue('');
      setSelectedProducts([]);
      setProductSearch('');
      setShowProductSearch(false);
      fetchProducts();
    }
  }, [isOpen]);

  async function fetchProducts() {
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('active', true)
      .order('name');
    
    if (data) setProducts(data as Product[]);
  }

  // Atalhos de data de retorno
  const setReturnInDays = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    setReturnDate(`${yyyy}-${mm}-${dd}`);
  };

  // Gerenciamento de produtos
  const addProduct = (product: Product) => {
    const existing = selectedProducts.find(p => p.id === product.id);
    if (existing) {
      setSelectedProducts(selectedProducts.map(p => 
        p.id === product.id ? { ...p, quantity: p.quantity + 1 } : p
      ));
    } else {
      setSelectedProducts([...selectedProducts, {
        id: product.id,
        name: product.name,
        price: product.price_sale,
        quantity: 1
      }]);
    }
    setProductSearch('');
    setShowProductSearch(false);
  };

  const removeProduct = (id: number) => {
    setSelectedProducts(selectedProducts.filter(p => p.id !== id));
  };

  const updateProductQuantity = (id: number, delta: number) => {
    setSelectedProducts(selectedProducts.map(p => {
      if (p.id === id) {
        const newQty = Math.max(1, p.quantity + delta);
        return { ...p, quantity: newQty };
      }
      return p;
    }));
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(productSearch.toLowerCase())
  ).slice(0, 10);

  // Função para converter valor formatado para número
  const parseCurrency = (value: string): number => {
    if (!value) return 0;
    // Remove pontos (separadores de milhar) e substitui vírgula por ponto
    const cleaned = value.replace(/\./g, '').replace(',', '.');
    return parseFloat(cleaned) || 0;
  };

  // Função para formatar valor em reais
  const formatCurrency = (value: string | number): string => {
    if (!value) return '';
    const numValue = typeof value === 'string' ? parseCurrency(value) : value;
    if (isNaN(numValue) || numValue === 0) return '';
    return numValue.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const productsTotal = selectedProducts.reduce((acc, p) => acc + (p.price * p.quantity), 0);
  const consultationValueNum = parseCurrency(consultationValue);
  const totalAmount = productsTotal + consultationValueNum;

  // Buscar chat_id do paciente
  const getChatId = async () => {
    const { data: patient } = await supabase
      .from('patients')
      .select('chat_id')
      .eq('id', patientId)
      .single();
    
    return patient?.chat_id || null;
  };

  // Função principal de finalização
  const handleFinish = async () => {
    if (savingData || loading) return;

    try {
      setLoading(true);
      setSavingData(true);

      // 1. Salvar todos os dados do prontuário primeiro
      const saved = await onSaveAllData();
      if (!saved) {
        alert('Erro ao salvar dados do prontuário. Tente novamente.');
        return;
      }

      setSavingData(false);

      // 2. Buscar chat_id
      const chatId = await getChatId();

      // 3. Verificar se precisa criar checkout
      const hasProducts = selectedProducts.length > 0;
      const hasConsultationValue = consultationValueNum > 0;
      const hasReturn = !!returnDate;
      const hasNotes = !!notes;

      let checkoutId: number | null = null;

      // 4. Criar medical_checkout se houver produtos ou valor de consulta
      if (hasProducts || hasConsultationValue || hasReturn || hasNotes) {
        // Preparar dados do checkout
        // Primeiro tentar com todos os campos, se falhar, tentar sem os opcionais
        const checkoutData: any = {
          chat_id: chatId,
          return_date: returnDate || null,
          return_obs: returnObs || null,
          secretary_notes: notes || null,
          status: 'pending'
        };

        // Adicionar campos que podem não existir no schema ainda
        // Tentar adicionar consultation_value, patient_id e appointment_id
        // Se der erro, tentaremos novamente sem esses campos
        try {
          if (hasConsultationValue) {
            checkoutData.consultation_value = consultationValueNum;
          }
          if (patientId) {
            checkoutData.patient_id = patientId;
          }
          if (appointmentId) {
            checkoutData.appointment_id = appointmentId;
          }
        } catch (e) {
          // Ignorar erro de preparação
        }

        let { data: checkout, error: checkoutError } = await supabase
          .from('medical_checkouts')
          .insert(checkoutData)
          .select()
          .single();

        // Se falhar por causa de colunas que não existem, tentar sem elas
        if (checkoutError && checkoutError.message?.includes('column') && checkoutError.message?.includes('does not exist')) {
          // Tentar novamente sem os campos opcionais
          const fallbackData: any = {
            chat_id: chatId,
            return_date: returnDate || null,
            return_obs: returnObs || null,
            secretary_notes: notes || null,
            status: 'pending'
          };

          const retry = await supabase
            .from('medical_checkouts')
            .insert(fallbackData)
            .select()
            .single();

          if (retry.error) throw retry.error;
          checkout = retry.data;
          checkoutError = null;
          
          // Avisar que a migration precisa ser executada
          console.warn('⚠️ Migration pendente: Execute o script database/add_consultation_value_to_checkouts.sql no Supabase para adicionar os campos consultation_value, patient_id e appointment_id');
        }

        if (checkoutError) throw checkoutError;
        checkoutId = checkout.id;

        if (checkoutError) throw checkoutError;
        checkoutId = checkout.id;

        // 5. Inserir produtos no checkout
        if (hasProducts && checkoutId) {
          const itemsPayload = selectedProducts.map(p => ({
            checkout_id: checkoutId,
            product_id: p.id,
            quantity: p.quantity,
            type: 'product' as const
          }));

          const { error: itemsError } = await supabase
            .from('checkout_items')
            .insert(itemsPayload);

          if (itemsError) throw itemsError;
        }
      }

      // 6. Criar appointment de retorno se houver data
      if (hasReturn && returnDate) {
        // Buscar informações do appointment atual para usar como base
        if (appointmentId) {
          const { data: currentAppointment } = await supabase
            .from('appointments')
            .select('doctor_id, doctor_name, patient_name, patient_phone')
            .eq('id', appointmentId)
            .single();

          if (currentAppointment) {
            // Criar novo appointment para retorno usando função utilitária
            // returnDate está no formato YYYY-MM-DD
            const start_time = saveAppointmentDateTime(returnDate, '09:00');

            await supabase
              .from('appointments')
              .insert({
                doctor_id: currentAppointment.doctor_id,
                doctor_name: currentAppointment.doctor_name,
                patient_name: currentAppointment.patient_name,
                patient_phone: currentAppointment.patient_phone,
                patient_id: patientId,
                start_time: start_time,
                status: 'scheduled',
                notes: returnObs || `Retorno agendado na consulta de ${format(new Date(), 'dd/MM/yyyy', { locale: ptBR })}`
              });
          }
        }
      }

      // 7. Atualizar appointment atual para 'finished'
      if (appointmentId) {
        console.log('[DEBUG] Finalizando appointment no FinishConsultationModal:', { 
          appointmentId, 
          patientId,
          hasCheckout: !!checkoutId
        });
        
        const { data, error } = await supabase
          .from('appointments')
          .update({ status: 'finished' })
          .eq('id', appointmentId)
          .select();
        
        if (error) {
          console.error('[DEBUG] Erro ao atualizar appointment:', error);
          throw error;
        }
        
        console.log('[DEBUG] Appointment finalizado com sucesso:', { 
          updatedCount: data?.length || 0,
          appointmentId 
        });
      }

      // 8. Atualizar medical_records para 'signed'
      const { data: currentRecord } = await supabase
        .from('medical_records')
        .select('id')
        .eq('patient_id', patientId)
        .eq('status', 'draft')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (currentRecord?.id) {
        await supabase
          .from('medical_records')
          .update({ 
            status: 'signed',
            finished_at: new Date().toISOString()
          })
          .eq('id', currentRecord.id);
      }

      // 9. Se não houver checkout, atualizar chat diretamente
      // (Appointment já foi atualizado no passo 7, não precisa atualizar novamente)
      if (!checkoutId && chatId) {
        await supabase
          .from('chats')
          .update({ 
            reception_status: 'finished',
            last_interaction_at: new Date().toISOString()
          })
          .eq('id', chatId);
      }

      onSuccess();
      onClose();
      
    } catch (error: any) {
      console.error('Erro ao finalizar consulta:', error);
      alert('Erro ao finalizar consulta: ' + (error.message || 'Tente novamente.'));
    } finally {
      setLoading(false);
      setSavingData(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white dark:bg-[#1e2028] w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-fade-in-up">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-rose-50 to-pink-50 dark:from-rose-900/20 dark:to-pink-900/20 px-8 py-6 border-b border-slate-200 dark:border-gray-700 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-gray-100 flex items-center gap-3">
              <CheckCircle2 className="w-7 h-7 text-rose-600 dark:text-rose-400" />
              Finalizar Consulta
            </h2>
            <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
              Paciente: <span className="font-bold text-slate-700 dark:text-gray-300">{patientName}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/50 dark:hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-6">
          
          {/* Anotações */}
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-gray-300 mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Anotações Finais
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-3 bg-white dark:bg-[#2a2d36] border border-slate-200 dark:border-gray-700 rounded-xl text-sm text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 resize-none"
              rows={3}
              placeholder="Observações finais sobre a consulta..."
            />
          </div>

          {/* Agendamento de Retorno */}
          <div className="bg-slate-50 dark:bg-[#2a2d36] p-5 rounded-xl border border-slate-200 dark:border-gray-700">
            <label className="block text-sm font-bold text-slate-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Agendar Retorno
            </label>
            
            {/* Atalhos de Data */}
            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => setReturnInDays(30)}
                className="px-4 py-2 bg-white dark:bg-[#1e2028] border border-slate-200 dark:border-gray-700 rounded-lg text-xs font-bold text-slate-600 dark:text-gray-300 hover:bg-rose-50 dark:hover:bg-rose-900/20 hover:border-rose-300 dark:hover:border-rose-700 hover:text-rose-600 dark:hover:text-rose-400 transition-all"
              >
                30 dias
              </button>
              <button
                type="button"
                onClick={() => setReturnInDays(60)}
                className="px-4 py-2 bg-white dark:bg-[#1e2028] border border-slate-200 dark:border-gray-700 rounded-lg text-xs font-bold text-slate-600 dark:text-gray-300 hover:bg-rose-50 dark:hover:bg-rose-900/20 hover:border-rose-300 dark:hover:border-rose-700 hover:text-rose-600 dark:hover:text-rose-400 transition-all"
              >
                60 dias
              </button>
              <button
                type="button"
                onClick={() => setReturnInDays(90)}
                className="px-4 py-2 bg-white dark:bg-[#1e2028] border border-slate-200 dark:border-gray-700 rounded-lg text-xs font-bold text-slate-600 dark:text-gray-300 hover:bg-rose-50 dark:hover:bg-rose-900/20 hover:border-rose-300 dark:hover:border-rose-700 hover:text-rose-600 dark:hover:text-rose-400 transition-all"
              >
                90 dias
              </button>
            </div>

            {/* Campo de Data */}
            <div className="mb-3">
              <input
                type="date"
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                className="w-full px-4 py-2.5 bg-white dark:bg-[#1e2028] border border-slate-200 dark:border-gray-700 rounded-lg text-sm text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                min={new Date().toISOString().split('T')[0]}
              />
            </div>

            {/* Observações do Retorno */}
            <textarea
              value={returnObs}
              onChange={(e) => setReturnObs(e.target.value)}
              className="w-full px-4 py-2.5 bg-white dark:bg-[#1e2028] border border-slate-200 dark:border-gray-700 rounded-lg text-sm text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 resize-none"
              rows={2}
              placeholder="Observações sobre o retorno..."
            />
          </div>

          {/* Valor da Consulta */}
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-gray-300 mb-2 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Valor da Consulta (R$)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-slate-500 dark:text-gray-400 pointer-events-none">
                R$
              </span>
              <input
                type="text"
                value={consultationValue}
                onChange={(e) => {
                  let value = e.target.value;
                  // Remove tudo exceto números, vírgula e ponto
                  value = value.replace(/[^\d,.]/g, '');
                  
                  // Garante apenas uma vírgula ou ponto
                  const parts = value.split(/[,.]/);
                  if (parts.length > 2) {
                    value = parts[0] + ',' + parts.slice(1).join('');
                  }
                  
                  // Limita a 2 casas decimais
                  if (value.includes(',') || value.includes('.')) {
                    const separator = value.includes(',') ? ',' : '.';
                    const parts = value.split(separator);
                    if (parts[1] && parts[1].length > 2) {
                      value = parts[0] + separator + parts[1].substring(0, 2);
                    }
                  }
                  
                  setConsultationValue(value);
                }}
                onBlur={(e) => {
                  // Formatar ao sair do campo
                  const numValue = parseCurrency(e.target.value);
                  if (numValue > 0) {
                    setConsultationValue(formatCurrency(numValue));
                  } else {
                    setConsultationValue('');
                  }
                }}
                onFocus={(e) => {
                  // Remover formatação ao focar para facilitar edição
                  const numValue = parseCurrency(e.target.value);
                  if (numValue > 0) {
                    setConsultationValue(numValue.toString().replace('.', ','));
                  }
                }}
                className="w-full pl-12 pr-4 py-3 bg-white dark:bg-[#2a2d36] border border-slate-200 dark:border-gray-700 rounded-xl text-lg font-bold text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                placeholder="0,00"
              />
            </div>
          </div>

          {/* Produtos da Lojinha */}
          <div className="bg-slate-50 dark:bg-[#2a2d36] p-5 rounded-xl border border-slate-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-bold text-slate-700 dark:text-gray-300 flex items-center gap-2">
                <ShoppingBag className="w-4 h-4" />
                Produtos da Lojinha
              </label>
              <button
                type="button"
                onClick={() => setShowProductSearch(!showProductSearch)}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                Adicionar
              </button>
            </div>

            {/* Busca de Produtos */}
            {showProductSearch && (
              <div className="mb-4 relative">
                <Search className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#1e2028] border border-slate-200 dark:border-gray-700 rounded-lg text-sm text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  placeholder="Buscar produto..."
                  autoFocus
                />
                {productSearch && filteredProducts.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-[#1e2028] border border-slate-200 dark:border-gray-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {filteredProducts.map(product => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => addProduct(product)}
                        className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-white/5 border-b border-slate-100 dark:border-gray-800 last:border-0 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-slate-700 dark:text-gray-200">{product.name}</span>
                          <span className="text-xs font-bold text-rose-600 dark:text-rose-400">R$ {product.price_sale.toFixed(2)}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Lista de Produtos Selecionados */}
            {selectedProducts.length > 0 && (
              <div className="space-y-2">
                {selectedProducts.map(product => (
                  <div key={product.id} className="bg-white dark:bg-[#1e2028] p-3 rounded-lg border border-slate-200 dark:border-gray-700 flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-bold text-slate-700 dark:text-gray-200">{product.name}</p>
                      <p className="text-xs text-slate-500 dark:text-gray-400">R$ {product.price.toFixed(2)} cada</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 bg-slate-100 dark:bg-[#2a2d36] rounded-lg">
                        <button
                          type="button"
                          onClick={() => updateProductQuantity(product.id, -1)}
                          className="p-1.5 hover:bg-slate-200 dark:hover:bg-white/10 rounded transition-colors"
                        >
                          <Minus className="w-3 h-3 text-slate-600 dark:text-gray-400" />
                        </button>
                        <span className="text-sm font-bold text-slate-700 dark:text-gray-200 w-8 text-center">
                          {product.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateProductQuantity(product.id, 1)}
                          className="p-1.5 hover:bg-slate-200 dark:hover:bg-white/10 rounded transition-colors"
                        >
                          <Plus className="w-3 h-3 text-slate-600 dark:text-gray-400" />
                        </button>
                      </div>
                      <span className="text-sm font-black text-rose-600 dark:text-rose-400 w-20 text-right">
                        R$ {(product.price * product.quantity).toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeProduct(product.id)}
                        className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                      >
                        <X className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="pt-2 border-t border-slate-200 dark:border-gray-700">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-slate-600 dark:text-gray-400">Subtotal Produtos:</span>
                    <span className="text-lg font-black text-slate-800 dark:text-gray-200">R$ {productsTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Resumo Total */}
          {(selectedProducts.length > 0 || consultationValueNum > 0) && (
            <div className="bg-gradient-to-r from-rose-50 to-pink-50 dark:from-rose-900/20 dark:to-pink-900/20 p-5 rounded-xl border-2 border-rose-200 dark:border-rose-900/30">
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold text-slate-700 dark:text-gray-300">Total a Cobrar:</span>
                <span className="text-3xl font-black text-rose-600 dark:text-rose-400">
                  R$ {totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              {consultationValueNum > 0 && (
                <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">
                  Consulta: R$ {consultationValueNum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {selectedProducts.length > 0 ? `+ Produtos: R$ ${productsTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer com Botões */}
        <div className="px-8 py-6 bg-slate-50 dark:bg-[#2a2d36] border-t border-slate-200 dark:border-gray-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-6 py-3 bg-slate-200 dark:bg-[#1e2028] text-slate-700 dark:text-gray-300 rounded-xl font-bold hover:bg-slate-300 dark:hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleFinish}
            disabled={loading || savingData}
            className="px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold shadow-lg shadow-rose-200 dark:shadow-none transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {savingData ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Salvando dados...
              </>
            ) : loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Finalizando...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" />
                Finalizar Consulta
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
