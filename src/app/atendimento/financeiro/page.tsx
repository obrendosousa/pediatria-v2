'use client';

import { PieChart } from 'lucide-react';

export default function AtendimentoFinanceiroPage() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-400 flex items-center justify-center shadow-lg">
          <PieChart className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-xl font-bold text-slate-700 dark:text-gray-100">Financeiro — Clínica Geral</h2>
        <span className="text-xs text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-3 py-1 rounded-full font-medium">Em construção</span>
      </div>
    </div>
  );
}
