'use client';

import { useState } from 'react';
import { Search, Plus, ShoppingBag, ChevronDown, ChevronUp } from 'lucide-react';
import type { Product } from '@/types';

interface CheckoutLojinhaSectionProps {
  search: string;
  onSearchChange: (value: string) => void;
  filteredCatalog: Product[];
  onAddItem: (product: Product, type: 'product' | 'service') => void;
  hasNewSaleItems: boolean;
  paymentMethod: string;
  onPaymentMethodChange: (value: string) => void;
  doctorItems: Array<{
    id: number;
    product_id: number;
    quantity: number;
    products?: Array<{ id: number; name: string; price_sale: number }> | null;
  }>;
}

export default function CheckoutLojinhaSection({
  search,
  onSearchChange,
  filteredCatalog,
  onAddItem,
  hasNewSaleItems,
  paymentMethod,
  onPaymentMethodChange,
  doctorItems
}: CheckoutLojinhaSectionProps) {
  const [expanded, setExpanded] = useState(doctorItems.length > 0);
  const hasDoctorItems = doctorItems.length > 0;

  return (
    <section className="rounded-xl border border-slate-200 dark:border-[#3d3d48] bg-white dark:bg-[#0f0f14] overflow-hidden">
      {/* Header / Toggle */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-[#1a1a22] transition-colors"
      >
        <div className="flex items-center gap-2">
          <ShoppingBag className="w-4 h-4 text-purple-500" />
          <span className="text-sm font-bold text-slate-800 dark:text-[#fafafa]">
            {hasDoctorItems ? 'Produtos indicados' : 'Adicionar venda de produto'}
          </span>
          {hasDoctorItems && (
            <span className="text-[10px] font-medium px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full">
              {doctorItems.length}
            </span>
          )}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {/* Expandable Content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-100 dark:border-[#2d2d36] pt-3">
          {/* Doctor-indicated items */}
          {hasDoctorItems && (
            <div className="space-y-1.5">
              {doctorItems.map((item) => {
                const product = item.products?.[0];
                if (!product) return null;
                return (
                  <div key={item.id} className="flex items-center justify-between p-2.5 bg-purple-50/50 dark:bg-purple-900/10 rounded-lg border border-purple-100 dark:border-purple-800/30">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium text-slate-700 dark:text-gray-200 truncate">{product.name}</span>
                      <span className="text-xs text-slate-400 dark:text-[#71717a]">
                        R$ {Number(product.price_sale).toFixed(2)}
                        {item.quantity > 1 ? ` x ${item.quantity}` : ''}
                      </span>
                    </div>
                    <span className="text-[10px] bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded font-medium shrink-0">
                      Indicado pela Dra.
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Product search */}
          <div>
            <label className="block text-xs font-bold text-slate-400 dark:text-[#71717a] uppercase mb-1.5">
              {hasDoctorItems ? 'Adicionar itens extras' : 'Buscar produto'}
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={e => onSearchChange(e.target.value)}
                placeholder="Buscar produto..."
                className="w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-[#3d3d48] rounded-lg bg-slate-50 dark:bg-[#1a1a22] text-slate-800 dark:text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-colors"
              />
            </div>
            {search && (
              <div className="mt-1.5 max-h-40 overflow-y-auto space-y-1 custom-scrollbar">
                {filteredCatalog.length === 0 ? (
                  <p className="text-xs text-slate-400 dark:text-[#71717a] py-2 text-center">Nenhum produto encontrado</p>
                ) : (
                  filteredCatalog.map(product => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between p-2 rounded-lg border border-slate-200 dark:border-[#3d3d48] hover:border-purple-300 dark:hover:border-purple-700 cursor-pointer bg-white dark:bg-[#1c1c21] transition-colors"
                      onClick={() => onAddItem(product, product.category === 'servico' ? 'service' : 'product')}
                    >
                      <span className="text-sm font-medium text-slate-800 dark:text-gray-200">{product.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 dark:text-[#a1a1aa]">R$ {product.price_sale.toFixed(2)}</span>
                        <span className="p-1 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                          <Plus size={14} />
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Payment method - only when secretary added items */}
          {hasNewSaleItems && (
            <div className="pt-2 border-t border-slate-100 dark:border-[#2d2d36]">
              <label className="block text-xs font-bold text-slate-400 dark:text-[#71717a] uppercase mb-1.5">
                Forma de pagamento (produtos)
              </label>
              <select
                value={paymentMethod}
                onChange={e => onPaymentMethodChange(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 dark:border-[#3d3d48] rounded-lg bg-slate-50 dark:bg-[#1a1a22] text-slate-800 dark:text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-colors"
              >
                <option value="cash">Dinheiro</option>
                <option value="pix">PIX</option>
                <option value="credit_card">Cartao de Credito</option>
                <option value="debit_card">Cartao de Debito</option>
              </select>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
