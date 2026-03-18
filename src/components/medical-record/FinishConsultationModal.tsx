'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
const supabase = createClient();
import { Product } from '@/types';
import {
  X, CheckCircle2, Calendar, ShoppingBag,
  Search, Plus, Minus, FileText,
  Loader2, Package
} from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';

interface FinishConsultationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  patientId: number;
  appointmentId?: number | null;
  patientName: string;
  onSaveAllData: () => Promise<boolean>;
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
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [savingData, setSavingData] = useState(false);

  // Form states
  const [notes, setNotes] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [returnObs, setReturnObs] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);

  // Product picker states
  const [products, setProducts] = useState<Product[]>([]);
  const [recentProducts, setRecentProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [showProductPicker, setShowProductPicker] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setNotes('');
      setReturnDate('');
      setReturnObs('');
      setSelectedProducts([]);
      setProductSearch('');
      setShowProductPicker(false);
      fetchProducts();
    }
  }, [isOpen]);

  async function fetchProducts() {
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('active', true)
      .order('name');

    if (data) {
      setProducts(data as Product[]);
      // Show first 8 products as quick picks
      setRecentProducts((data as Product[]).slice(0, 8));
    }
  }

  // Return date shortcuts
  const setReturnInDays = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    setReturnDate(`${yyyy}-${mm}-${dd}`);
  };

  // Product management
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

  const filteredProducts = productSearch.length >= 1
    ? products.filter(p =>
        p.name.toLowerCase().includes(productSearch.toLowerCase())
      ).slice(0, 10)
    : [];

  const productsTotal = selectedProducts.reduce((acc, p) => acc + (p.price * p.quantity), 0);

  // Get patient's chat_id
  const getChatId = async () => {
    const { data: patient } = await supabase
      .from('patients')
      .select('chat_id')
      .eq('id', patientId)
      .single();

    return patient?.chat_id || null;
  };

  // Helper to extract error message from any error type
  const extractErrorMsg = (err: unknown): string => {
    if (!err) return 'Erro desconhecido';
    if (typeof err === 'string') return err;
    if (err instanceof Error) return err.message;
    if (typeof err === 'object') {
      const e = err as Record<string, unknown>;
      const val = e.message ?? e.error_description ?? e.msg ?? e.details ?? e.hint;
      if (typeof val === 'string') return val;
      const json = JSON.stringify(err);
      return json !== '{}' ? json : 'Erro desconhecido';
    }
    return String(err);
  };

  // Main finish handler
  const handleFinish = async () => {
    if (savingData || loading) return;

    try {
      setLoading(true);
      setSavingData(true);

      // 1. Save all medical record data first
      const saved = await onSaveAllData();
      if (!saved) {
        toast.error('Erro ao salvar dados do prontuario. Tente novamente.');
        return;
      }

      setSavingData(false);

      // 2. Get chat_id (non-critical)
      let chatId: string | null = null;
      try {
        chatId = await getChatId();
      } catch { /* ignore */ }

      // 3. Finalizar consulta atomicamente via API
      const res = await fetch('/api/medical-record/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: patientId,
          appointment_id: appointmentId || null,
          chat_id: chatId,
          notes: notes || null,
          return_date: returnDate || null,
          return_obs: returnObs || null,
          products: selectedProducts.length > 0
            ? selectedProducts.map(p => ({ product_id: p.id, quantity: p.quantity }))
            : null,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Erro ao finalizar consulta.' }));
        throw new Error(errorData.error || 'Erro ao finalizar consulta.');
      }

      onSuccess();
      onClose();

    } catch (error: unknown) {
      console.error('[Finalizar] Erro completo:', error);
      const message = error instanceof Error ? error.message : extractErrorMsg(error);
      toast.error(message);
    } finally {
      setLoading(false);
      setSavingData(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white dark:bg-[#08080b] w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-fade-in-up">

        {/* Header */}
        <div className="bg-gradient-to-r from-rose-50 to-pink-50 dark:from-rose-900/20 dark:to-pink-900/20 px-8 py-6 border-b border-slate-200 dark:border-[#3d3d48] flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-[#fafafa] flex items-center gap-3">
              <CheckCircle2 className="w-7 h-7 text-rose-600 dark:text-rose-400" />
              Finalizar Consulta
            </h2>
            <p className="text-sm text-slate-500 dark:text-[#a1a1aa] mt-1">
              Paciente: <span className="font-bold text-slate-700 dark:text-[#d4d4d8]">{patientName}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/50 dark:hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500 dark:text-[#a1a1aa]" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-6">

          {/* Notes */}
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-[#d4d4d8] mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Anotacoes Finais para Recepcao
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-3 bg-white dark:bg-[#1c1c21] border border-slate-200 dark:border-[#3d3d48] rounded-xl text-sm text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 resize-none"
              rows={3}
              placeholder="Observacoes para a secretaria (ex: cobrar vacina X, agendar retorno com urgencia...)"
            />
          </div>

          {/* Return scheduling */}
          <div className="bg-slate-50 dark:bg-[#1c1c21] p-5 rounded-xl border border-slate-200 dark:border-[#3d3d48]">
            <label className="block text-sm font-bold text-slate-700 dark:text-[#d4d4d8] mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Agendar Retorno
            </label>

            <div className="flex gap-2 mb-4">
              {[30, 60, 90].map(days => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setReturnInDays(days)}
                  className="px-4 py-2 bg-white dark:bg-[#08080b] border border-slate-200 dark:border-[#3d3d48] rounded-lg text-xs font-bold text-slate-600 dark:text-[#d4d4d8] hover:bg-rose-50 dark:hover:bg-rose-900/20 hover:border-rose-300 dark:hover:border-rose-700 hover:text-rose-600 dark:hover:text-rose-400 transition-all"
                >
                  {days} dias
                </button>
              ))}
            </div>

            <div className="mb-3">
              <input
                type="date"
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                className="w-full px-4 py-2.5 bg-white dark:bg-[#08080b] border border-slate-200 dark:border-[#3d3d48] rounded-lg text-sm text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                min={new Date().toISOString().split('T')[0]}
              />
            </div>

            <textarea
              value={returnObs}
              onChange={(e) => setReturnObs(e.target.value)}
              className="w-full px-4 py-2.5 bg-white dark:bg-[#08080b] border border-slate-200 dark:border-[#3d3d48] rounded-lg text-sm text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 resize-none"
              rows={2}
              placeholder="Observacoes sobre o retorno..."
            />
          </div>

          {/* Products / Vaccines */}
          <div className="bg-slate-50 dark:bg-[#1c1c21] p-5 rounded-xl border border-slate-200 dark:border-[#3d3d48]">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-bold text-slate-700 dark:text-[#d4d4d8] flex items-center gap-2">
                <ShoppingBag className="w-4 h-4" />
                Produtos / Vacinas
              </label>
              <button
                type="button"
                onClick={() => setShowProductPicker(!showProductPicker)}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                Adicionar
              </button>
            </div>

            {/* Product Picker Sub-popup */}
            {showProductPicker && (
              <div className="mb-4 bg-white dark:bg-[#08080b] border border-slate-200 dark:border-[#3d3d48] rounded-xl shadow-lg overflow-hidden">
                {/* Search */}
                <div className="p-3 border-b border-slate-200 dark:border-[#3d3d48]">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-[#1c1c21] border border-slate-200 dark:border-[#3d3d48] rounded-lg text-sm text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-rose-500"
                      placeholder="Buscar produto ou vacina..."
                      autoFocus
                    />
                  </div>
                </div>

                {/* Search results */}
                {productSearch.length >= 1 && filteredProducts.length > 0 && (
                  <div className="max-h-48 overflow-y-auto border-b border-slate-200 dark:border-[#3d3d48]">
                    {filteredProducts.map(product => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => addProduct(product)}
                        className="w-full text-left px-4 py-2.5 hover:bg-rose-50 dark:hover:bg-rose-900/10 border-b border-slate-100 dark:border-[#2d2d36] last:border-0 transition-colors flex items-center justify-between"
                      >
                        <span className="text-sm font-medium text-slate-700 dark:text-gray-200">{product.name}</span>
                        <span className="text-xs font-bold text-rose-600 dark:text-rose-400">R$ {product.price_sale.toFixed(2)}</span>
                      </button>
                    ))}
                  </div>
                )}

                {productSearch.length >= 1 && filteredProducts.length === 0 && (
                  <div className="px-4 py-3 text-sm text-slate-500 dark:text-[#a1a1aa] text-center border-b border-slate-200 dark:border-[#3d3d48]">
                    Nenhum produto encontrado
                  </div>
                )}

                {/* Recent products */}
                {productSearch.length < 1 && recentProducts.length > 0 && (
                  <div>
                    <div className="px-4 py-2 bg-slate-50 dark:bg-[#1c1c21] border-b border-slate-200 dark:border-[#3d3d48]">
                      <span className="text-xs font-bold text-slate-500 dark:text-[#a1a1aa] uppercase flex items-center gap-1.5">
                        <Package className="w-3 h-3" />
                        Produtos Recentes
                      </span>
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      {recentProducts.map(product => (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => addProduct(product)}
                          className="w-full text-left px-4 py-2.5 hover:bg-rose-50 dark:hover:bg-rose-900/10 border-b border-slate-100 dark:border-[#2d2d36] last:border-0 transition-colors flex items-center justify-between"
                        >
                          <span className="text-sm font-medium text-slate-700 dark:text-gray-200">{product.name}</span>
                          <span className="text-xs font-bold text-rose-600 dark:text-rose-400">R$ {product.price_sale.toFixed(2)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Close */}
                <div className="p-2 bg-slate-50 dark:bg-[#1c1c21]">
                  <button
                    type="button"
                    onClick={() => { setShowProductPicker(false); setProductSearch(''); }}
                    className="w-full py-1.5 text-xs font-medium text-slate-500 dark:text-[#a1a1aa] hover:text-slate-700 dark:hover:text-gray-200 transition-colors"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            )}

            {/* Selected Products List */}
            {selectedProducts.length > 0 && (
              <div className="space-y-2">
                {selectedProducts.map(product => (
                  <div key={product.id} className="bg-white dark:bg-[#08080b] p-3 rounded-lg border border-slate-200 dark:border-[#3d3d48] flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-bold text-slate-700 dark:text-gray-200">{product.name}</p>
                      <p className="text-xs text-slate-500 dark:text-[#a1a1aa]">R$ {product.price.toFixed(2)} cada</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 bg-slate-100 dark:bg-[#1c1c21] rounded-lg">
                        <button
                          type="button"
                          onClick={() => updateProductQuantity(product.id, -1)}
                          className="p-1.5 hover:bg-slate-200 dark:hover:bg-white/10 rounded transition-colors"
                        >
                          <Minus className="w-3 h-3 text-slate-600 dark:text-[#a1a1aa]" />
                        </button>
                        <span className="text-sm font-bold text-slate-700 dark:text-gray-200 w-8 text-center">
                          {product.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateProductQuantity(product.id, 1)}
                          className="p-1.5 hover:bg-slate-200 dark:hover:bg-white/10 rounded transition-colors"
                        >
                          <Plus className="w-3 h-3 text-slate-600 dark:text-[#a1a1aa]" />
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
                <div className="pt-2 border-t border-slate-200 dark:border-[#3d3d48]">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-slate-600 dark:text-[#a1a1aa]">Subtotal Produtos:</span>
                    <span className="text-lg font-black text-slate-800 dark:text-gray-200">R$ {productsTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-6 bg-slate-50 dark:bg-[#1c1c21] border-t border-slate-200 dark:border-[#3d3d48] flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-6 py-3 bg-slate-200 dark:bg-[#08080b] text-slate-700 dark:text-[#d4d4d8] rounded-xl font-bold hover:bg-slate-300 dark:hover:bg-white/10 transition-colors disabled:opacity-50"
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
                Enviando para Recepcao...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" />
                Finalizar e Enviar para Checkout
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
