'use client';

import { CheckCircle2, Loader2 } from 'lucide-react';

interface CheckoutFinalizeFooterProps {
  total: number;
  isFullyPaid: boolean;
  hasItems: boolean;
  submitting: boolean;
  onFinalize: () => void;
}

export default function CheckoutFinalizeFooter({
  total,
  isFullyPaid,
  hasItems,
  submitting,
  onFinalize
}: CheckoutFinalizeFooterProps) {
  const showTotal = hasItems && total > 0;

  return (
    <div className="sticky bottom-0 bg-white dark:bg-[#08080b] border-t border-slate-200 dark:border-[#3d3d48] p-4 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] dark:shadow-[0_-4px_12px_rgba(0,0,0,0.3)]">
      <div className="flex items-center gap-4">
        {/* Status / Total */}
        <div className="flex-1">
          {isFullyPaid && !hasItems ? (
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
              <span className="text-sm font-bold">Atendimento pago</span>
            </div>
          ) : showTotal ? (
            <div>
              <p className="text-xs text-slate-400 dark:text-[#71717a] uppercase font-bold">Total a cobrar</p>
              <p className="text-xl font-black text-slate-800 dark:text-[#fafafa]">R$ {total.toFixed(2)}</p>
            </div>
          ) : (
            <p className="text-xs text-slate-400 dark:text-[#71717a]">Sem cobranças pendentes</p>
          )}
        </div>

        {/* Finalize button */}
        <button
          type="button"
          onClick={onFinalize}
          disabled={submitting}
          className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white rounded-xl font-bold text-sm transition-colors disabled:cursor-not-allowed shadow-lg shadow-emerald-600/20"
        >
          {submitting ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <CheckCircle2 size={18} />
          )}
          {submitting
            ? 'Finalizando...'
            : showTotal
            ? `Finalizar e cobrar`
            : 'Finalizar atendimento'
          }
        </button>
      </div>
    </div>
  );
}
