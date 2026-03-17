'use client';

import { ExternalLink, FlaskConical } from 'lucide-react';
import { ProntuarioScreenProps } from '@/types/prontuario';

export function SupportLabPlaceholder({ patientData }: ProntuarioScreenProps) {
  return (
    <div className="flex items-center justify-center h-full p-8">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mx-auto mb-4">
          <FlaskConical className="w-8 h-8 text-emerald-500" />
        </div>
        <h3 className="text-lg font-bold text-slate-800 dark:text-[#fafafa] mb-2">Support Lab</h3>
        <p className="text-sm text-slate-500 dark:text-[#a1a1aa] mb-6">
          Plataforma para solicitação de exames laboratoriais com preços especiais para clínicas parceiras.
        </p>
        <p className="text-xs text-slate-400 dark:text-[#71717a] mb-4">
          Paciente: {patientData?.name || patientData?.full_name || '—'}
        </p>
        <a
          href="https://app.supportlab.com.br"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-lg transition-all"
        >
          <ExternalLink className="w-4 h-4" />
          Acessar Support Lab
        </a>
      </div>
    </div>
  );
}
