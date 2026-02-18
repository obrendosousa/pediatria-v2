'use client';

import { useState } from 'react';
import {
  X, DollarSign, Search, Plus, Minus,
  Loader2, Save, User, Phone, Clock, Wallet, Stethoscope, Printer, FileText
} from 'lucide-react';
import { useCheckoutPanel } from '@/hooks/useCheckoutPanel';
import { useToast } from '@/contexts/ToastContext';

interface ReceptionCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointmentId: number;
  onSuccess?: () => void;
}

export default function ReceptionCheckoutModal({
  isOpen,
  onClose,
  appointmentId,
  onSuccess
}: ReceptionCheckoutModalProps) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const effectiveId = isOpen ? appointmentId : 0;
  const {
    loading,
    appointment,
    search,
    setSearch,
    selectedItems,
    addItem,
    removeItem,
    total,
    paymentMethod,
    setPaymentMethod,
    filteredCatalog,
    handlePrintDocuments,
    handleSubmit
  } = useCheckoutPanel(effectiveId || null);

  async function onModalSubmit() {
    setSubmitting(true);
    try {
      await handleSubmit(() => {
        toast.success('Checkout realizado e atendimento encerrado com sucesso!');
        onSuccess?.();
        onClose();
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Tente novamente.';
      toast.error('Erro ao processar checkout: ' + message);
    } finally {
      setSubmitting(false);
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
            Checkout Final - {appointment?.patient_name || 'Paciente'}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition-colors">
            <X size={20} className="text-gray-400 dark:text-gray-500"/>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          
          {/* Informações do Paciente */}
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
              
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Histórico Agendamento</p>
                  <div className="text-sm font-semibold flex gap-2">
                     <span className="text-gray-600 dark:text-gray-400">Total: R$ {Number(appointment.total_amount || 0).toFixed(2)}</span>
                     <span className="text-green-600 dark:text-green-400">Pago: R$ {Number(appointment.amount_paid || 0).toFixed(2)}</span>
                  </div>
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
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Data</p>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                    {appointment.start_time ? new Date(appointment.start_time).toLocaleDateString('pt-BR') : ''}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* --- Bloco de Documentos Médicos --- */}
          {appointment && (
            <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-lg border border-blue-200 dark:border-blue-800 flex items-center justify-between mb-6">
              <div>
                <h4 className="text-sm font-bold text-blue-800 dark:text-blue-300 flex items-center gap-2">
                  <FileText className="w-4 h-4"/>
                  Documentos Médicos
                </h4>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                  Imprima receitas, atestados e exames gerados na consulta.
                </p>
              </div>
              <button
                type="button"
                onClick={handlePrintDocuments}
                disabled={!appointment.patient_id}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#2a2d36] text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors font-bold text-xs shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Printer size={16} />
                Imprimir Tudo
              </button>
            </div>
          )}

          {/* Busca de Produtos Extras (Venda de Balcão) */}
          <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">
              Adicionar Itens Extras (Balcão)
            </label>
            <div className="relative mb-3">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar produtos para adicionar agora..."
                className="w-full pl-9 pr-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-[#2a2d36] text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all"
              />
            </div>
            {search && (
              <div className="max-h-48 overflow-y-auto space-y-2 custom-scrollbar mb-4">
                {filteredCatalog.map(product => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#111b21] rounded-lg border border-gray-200 dark:border-gray-700 hover:border-green-300 dark:hover:border-green-700 transition-all cursor-pointer"
                    onClick={() => addItem(product, product.category === 'servico' ? 'service' : 'product')}
                  >
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{product.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">R$ {product.price_sale.toFixed(2)}</p>
                    </div>
                    <div className="bg-green-100 dark:bg-green-900/30 p-1.5 rounded text-green-700 dark:text-green-400">
                      <Plus size={16} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Lista de Itens a Cobrar */}
          {selectedItems.length > 0 ? (
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">
                Resumo da Cobrança
              </label>
              <div className="space-y-2">
                {selectedItems.map(item => (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      item.type === 'debt' 
                        ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800' 
                        : item.type === 'medical_item'
                        ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800'
                        : 'bg-white dark:bg-[#2a2d36] border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <div className="flex-1 flex items-center gap-2">
                      {/* CORREÇÃO AQUI: Trocado a prop title direto no ícone por uma div envolvendo */}
                      {item.type === 'medical_item' && (
                        <div title="Adicionado pela Médica" className="cursor-help">
                          <Stethoscope className="w-4 h-4 text-blue-500" />
                        </div>
                      )}
                      {item.type === 'debt' && (
                        <div title="Saldo Devedor" className="cursor-help">
                          <Wallet className="w-4 h-4 text-amber-500" />
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                          {item.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          R$ {item.price.toFixed(2)} {item.qty > 1 && `x ${item.qty}`}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
                        R$ {(item.price * item.qty).toFixed(2)}
                      </p>
                      
                      {/* Controles para itens normais ou médicos */}
                      {(item.type !== 'debt') && (
                        <div className="flex items-center gap-1">
                          <button onClick={() => removeItem(item)} className="p-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 rounded"><Minus size={14} /></button>
                          <span className="text-sm w-6 text-center">{item.qty}</span>
                          <button
                            onClick={() => item.product && addItem(item.product, item.type === 'service' ? 'service' : 'product')}
                            className="p-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 rounded"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      )}

                      {/* Botão remover para Dívida (Permitir remover caso seja erro) */}
                      {(item.type === 'debt') && (
                        <button onClick={() => removeItem(item)} className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 rounded transition-colors" title="Remover item">
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400 text-sm bg-gray-50 dark:bg-white/5 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
              Nenhum valor pendente.
            </div>
          )}

          {/* Pagamento e Total */}
          {total > 0 && (
            <>
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">
                  Forma de Pagamento
                </label>
                <select
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-[#2a2d36] text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all"
                >
                  <option value="cash">Dinheiro</option>
                  <option value="pix">PIX</option>
                  <option value="credit_card">Cartão de Crédito</option>
                  <option value="debit_card">Cartão de Débito</option>
                </select>
              </div>

              <div className="p-4 bg-green-50 dark:bg-green-900/10 rounded-lg border border-green-200 dark:border-green-800 flex justify-between items-center">
                <span className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase">Total a Pagar</span>
                <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                  R$ {total.toFixed(2)}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#2a2d36] flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg text-sm font-bold transition-colors">
            Cancelar
          </button>
          <button
            onClick={onModalSubmit}
            disabled={loading || submitting}
            className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-bold shadow-lg flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            {(loading || submitting) ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>}
            {total > 0 ? 'Receber e Finalizar' : 'Finalizar Sem Cobrança'}
          </button>
        </div>
      </div>
    </div>
  );
}