'use client';

import { Stethoscope, Wallet, Minus, Plus, X } from 'lucide-react';
import type { SelectedItem } from '@/hooks/useCheckoutPanel';
import type { Product } from '@/types';

interface CheckoutChargeSummaryProps {
  selectedItems: SelectedItem[];
  total: number;
  onAddItem: (product: Product, type: 'product' | 'service') => void;
  onRemoveItem: (item: SelectedItem) => void;
}

export default function CheckoutChargeSummary({
  selectedItems,
  total,
  onAddItem,
  onRemoveItem
}: CheckoutChargeSummaryProps) {
  if (selectedItems.length === 0) return null;

  return (
    <section className="rounded-xl border-l-4 border-l-purple-500 border border-slate-200 dark:border-[#3d3d48] bg-white dark:bg-[#0f0f14] p-4">
      <h4 className="text-xs font-bold text-slate-500 dark:text-[#a1a1aa] uppercase tracking-wider mb-3">
        Resumo da cobranca
      </h4>
      <div className="space-y-2">
        {selectedItems.map(item => (
          <div
            key={String(item.id) + item.type}
            className={`flex items-center justify-between p-3 rounded-lg ${
              item.type === 'debt'
                ? 'bg-amber-50/80 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800'
                : item.type === 'medical_item'
                ? 'bg-blue-50/80 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800'
                : 'bg-slate-50/80 dark:bg-[#1a1a22] border border-slate-200 dark:border-[#3d3d48]'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              {item.type === 'medical_item' && <Stethoscope className="w-4 h-4 text-blue-500 shrink-0" />}
              {item.type === 'debt' && <Wallet className="w-4 h-4 text-amber-500 shrink-0" />}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800 dark:text-gray-200 truncate">{item.name}</p>
                <p className="text-xs text-slate-400 dark:text-[#71717a]">
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
                  <button type="button" onClick={() => onRemoveItem(item)} className="p-1.5 rounded bg-slate-100 dark:bg-[#2d2d36] hover:bg-slate-200 dark:hover:bg-gray-600 transition-colors">
                    <Minus size={12} />
                  </button>
                  <span className="text-xs w-5 text-center font-medium">{item.qty}</span>
                  <button type="button" onClick={() => item.product && onAddItem(item.product, item.type as 'product' | 'service')} className="p-1.5 rounded bg-slate-100 dark:bg-[#2d2d36] hover:bg-slate-200 dark:hover:bg-gray-600 transition-colors">
                    <Plus size={12} />
                  </button>
                </div>
              )}
              {item.type === 'debt' && (
                <button type="button" onClick={() => onRemoveItem(item)} className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 transition-colors">
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {total > 0 && (
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-200 dark:border-[#3d3d48]">
          <span className="text-xs font-bold text-slate-500 dark:text-[#a1a1aa] uppercase">Total</span>
          <span className="text-lg font-black text-slate-800 dark:text-[#fafafa]">R$ {total.toFixed(2)}</span>
        </div>
      )}
    </section>
  );
}
