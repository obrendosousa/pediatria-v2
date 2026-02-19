'use client';

import { useState } from 'react';
import {
  FileText,
  Printer,
  Search,
  Plus,
  Minus,
  X,
  Loader2,
  CheckCircle2,
  Wallet,
  Stethoscope,
  Calendar,
  ShoppingBag,
  User
} from 'lucide-react';
import { useCheckoutPanel } from '@/hooks/useCheckoutPanel';
import { useToast } from '@/contexts/ToastContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CheckoutDetailPanelProps {
  appointmentId: number | null;
  onSuccess?: () => void;
  onScheduleReturn?: (suggestedDate: string) => void;
}

export default function CheckoutDetailPanel({
  appointmentId,
  onSuccess,
  onScheduleReturn
}: CheckoutDetailPanelProps) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const {
    loading,
    appointment,
    medicalCheckout,
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
  } = useCheckoutPanel(appointmentId);

  const handleFinalize = async () => {
    setSubmitting(true);
    try {
      await handleSubmit(onSuccess);
      setSubmitting(false);
    } catch (err: unknown) {
      setSubmitting(false);
      const message = err instanceof Error ? err.message : 'Tente novamente.';
      toast.toast.error('Erro ao processar checkout: ' + message);
    }
  };

  if (!appointmentId) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-slate-50/50 dark:bg-[#111b21]/50 rounded-xl border-2 border-dashed border-slate-200 dark:border-gray-700 p-8">
        <User className="w-16 h-16 text-slate-300 dark:text-gray-600 mb-4" />
        <p className="text-slate-500 dark:text-gray-400 font-medium text-center">
          Selecione um paciente na lista ao lado para ver o painel de fechamento.
        </p>
      </div>
    );
  }

  if (loading && !appointment) {
    return (
      <div className="h-full flex items-center justify-center bg-white dark:bg-[#1e2028] rounded-xl border border-slate-200 dark:border-gray-700">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-slate-50/50 dark:bg-[#111b21]/50 rounded-xl border border-slate-200 dark:border-gray-700 p-8">
        <p className="text-slate-500 dark:text-gray-400 text-center">Paciente não encontrado.</p>
      </div>
    );
  }

  const doctorName = appointment.doctor_name || 'Médica';
  const returnDate = medicalCheckout?.return_date;
  const returnObs = medicalCheckout?.return_obs;
  const isFullyPaid = total <= 0 && (Number(appointment.amount_paid || 0) >= Number(appointment.total_amount || 0));

  return (
    <div className="h-full flex flex-col bg-white dark:bg-[#1e2028] rounded-xl border border-slate-200 dark:border-gray-700 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
        {/* Bloco A – Entregáveis Médicos */}
        <section className="bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-200 dark:border-blue-800 p-4">
          <h4 className="text-sm font-bold text-blue-800 dark:text-blue-300 flex items-center gap-2 mb-3">
            <FileText className="w-4 h-4" />
            Documentos para entregar
          </h4>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handlePrintDocuments}
              disabled={!appointment.patient_id}
              className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-[#2a2d36] text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors font-bold text-xs shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Printer size={16} />
              Imprimir receitas e atestados
            </button>
            <span className="text-xs text-blue-600 dark:text-blue-400">
              Exames solicitados conforme anotações da consulta.
            </span>
          </div>
          <p className="text-xs text-blue-600/80 dark:text-blue-400/80 mt-2">
            Baixar pacote completo (PDF) e envio por WhatsApp em breve.
          </p>
        </section>

        {/* Bloco B – Oportunidades e Lojinha */}
        <section className="rounded-xl border border-slate-200 dark:border-gray-700 p-4 bg-slate-50/50 dark:bg-[#111b21]/50">
          <h4 className="text-sm font-bold text-slate-800 dark:text-gray-100 flex items-center gap-2 mb-3">
            <ShoppingBag className="w-4 h-4 text-purple-500" />
            Indicações da {doctorName}
          </h4>
          {(medicalCheckout?.checkout_items?.length ?? 0) > 0 ? (
            <div className="flex flex-wrap gap-2 mb-4">
              {medicalCheckout!.checkout_items!.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-[#2a2d36] rounded-lg border border-slate-200 dark:border-gray-700"
                >
                  <span className="text-sm font-medium text-slate-800 dark:text-gray-200">
                    {item.products?.[0]?.name ?? 'Item'}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-gray-400">
                    R$ {item.products?.[0]?.price_sale != null ? Number(item.products[0].price_sale).toFixed(2) : '0,00'}
                    {item.quantity > 1 ? ` x ${item.quantity}` : ''}
                  </span>
                  <span className="text-[10px] bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded">
                    Na conta
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 dark:text-gray-400 mb-3">Nenhum produto indicado pela médica.</p>
          )}
          <label className="block text-xs font-bold text-slate-500 dark:text-gray-400 uppercase mb-2">
            Adicionar itens extras (lojinha)
          </label>
          <div className="relative mb-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar produto..."
              className="w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-[#2a2d36] text-slate-800 dark:text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
            />
          </div>
          {search && (
            <div className="max-h-40 overflow-y-auto space-y-1 custom-scrollbar">
              {filteredCatalog.map(product => (
                <div
                  key={product.id}
                  className="flex items-center justify-between p-2 rounded-lg border border-slate-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700 cursor-pointer bg-white dark:bg-[#2a2d36]"
                  onClick={() => addItem(product, product.category === 'servico' ? 'service' : 'product')}
                >
                  <span className="text-sm font-medium text-slate-800 dark:text-gray-200">{product.name}</span>
                  <span className="text-xs text-slate-500 dark:text-gray-400 mr-2">
                    R$ {product.price_sale.toFixed(2)}
                  </span>
                  <span className="p-1.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                    <Plus size={14} />
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Bloco C – Próximos Passos (retorno) */}
        {returnDate && (
          <section className="rounded-xl border border-amber-200 dark:border-amber-800 p-4 bg-amber-50/50 dark:bg-amber-900/10">
            <h4 className="text-sm font-bold text-amber-800 dark:text-amber-300 flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4" />
              Próximos passos
            </h4>
            <p className="text-sm text-amber-700 dark:text-amber-200 mb-2">
              {doctorName} sugeriu retorno para{' '}
              <strong>{format(new Date(returnDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</strong>
              {returnObs ? ` — ${returnObs}` : ''}
            </p>
            {onScheduleReturn && (
              <button
                type="button"
                onClick={() => onScheduleReturn(returnDate)}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-bold transition-colors"
              >
                <Calendar size={16} />
                Agendar agora
              </button>
            )}
          </section>
        )}

        {/* Lista de itens na conta (resumo da cobrança) */}
        {selectedItems.length > 0 && (
          <section>
            <h4 className="text-xs font-bold text-slate-500 dark:text-gray-400 uppercase mb-2">
              Resumo da cobrança
            </h4>
            <div className="space-y-2">
              {selectedItems.map(item => (
                <div
                  key={String(item.id) + item.type}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    item.type === 'debt'
                      ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800'
                      : item.type === 'medical_item'
                      ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800'
                      : 'bg-white dark:bg-[#2a2d36] border-slate-200 dark:border-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {item.type === 'medical_item' && <Stethoscope className="w-4 h-4 text-blue-500 shrink-0" />}
                    {item.type === 'debt' && <Wallet className="w-4 h-4 text-amber-500 shrink-0" />}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 dark:text-gray-200 truncate">{item.name}</p>
                      <p className="text-xs text-slate-500 dark:text-gray-400">
                        R$ {item.price.toFixed(2)} {item.qty > 1 ? `x ${item.qty}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-bold text-slate-800 dark:text-gray-200">
                      R$ {(item.price * item.qty).toFixed(2)}
                    </span>
                    {item.type !== 'debt' && (
                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => removeItem(item)}
                          className="p-1.5 rounded bg-slate-100 dark:bg-gray-700 hover:bg-slate-200 dark:hover:bg-gray-600"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="text-xs w-5 text-center">{item.qty}</span>
                        <button
                          type="button"
                          onClick={() => item.product && addItem(item.product, item.type as 'product' | 'service')}
                          className="p-1.5 rounded bg-slate-100 dark:bg-gray-700 hover:bg-slate-200 dark:hover:bg-gray-600"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    )}
                    {item.type === 'debt' && (
                      <button
                        type="button"
                        onClick={() => removeItem(item)}
                        className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Bloco D – Resumo financeiro (barra fixa no final do scroll) */}
        <section className="mt-auto pt-4 border-t border-slate-200 dark:border-gray-700">
          <div className="flex flex-wrap items-center gap-4 mb-4">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-bold text-slate-500 dark:text-gray-400 uppercase mb-1">
                Forma de pagamento
              </label>
              <select
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-[#2a2d36] text-slate-800 dark:text-gray-200 text-sm"
              >
                <option value="cash">Dinheiro</option>
                <option value="pix">PIX</option>
                <option value="credit_card">Cartão de Crédito</option>
                <option value="debit_card">Cartão de Débito</option>
              </select>
            </div>
            <div className="flex items-center gap-4">
              {isFullyPaid ? (
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-bold">Atendimento pago</span>
                </div>
              ) : total > 0 ? (
                <div className="text-right">
                  <p className="text-xs text-slate-500 dark:text-gray-400 uppercase">Total a pagar</p>
                  <p className="text-2xl font-bold text-slate-800 dark:text-gray-100">R$ {total.toFixed(2)}</p>
                </div>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={handleFinalize}
            disabled={submitting}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors disabled:cursor-not-allowed"
          >
            {submitting ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <CheckCircle2 size={20} />
            )}
            {submitting ? 'Finalizando...' : 'Finalizar atendimento'}
          </button>
        </section>
      </div>
    </div>
  );
}
