'use client';

import Link from 'next/link';
import { Clock } from 'lucide-react';

export default function AguardandoAprovacaoPage() {
  return (
    <div className="rounded-2xl border border-pink-100 dark:border-gray-700 bg-white dark:bg-[#262832] p-8 shadow-xl text-center">
      <div className="flex justify-center mb-6">
        <div className="w-14 h-14 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
          <Clock className="w-7 h-7 text-amber-600 dark:text-amber-400" />
        </div>
      </div>
      <h1 className="text-xl font-bold text-slate-800 dark:text-gray-100 mb-2">
        Conta em análise
      </h1>
      <p className="text-sm text-slate-500 dark:text-gray-400 mb-6">
        Sua conta foi criada e está aguardando aprovação pela administração. Você receberá acesso ao painel assim que for aprovada.
      </p>
      <p className="text-xs text-slate-400 dark:text-gray-500 mb-6">
        Em caso de dúvidas, entre em contato com a clínica.
      </p>
      <div className="flex justify-center gap-2">
        <Link
          href="/login"
          className="rounded-xl border border-pink-200 dark:border-gray-600 text-pink-600 dark:text-pink-400 font-medium py-2.5 px-4 hover:bg-pink-50 dark:hover:bg-pink-900/10 transition"
        >
          Voltar ao login
        </Link>
      </div>
    </div>
  );
}
