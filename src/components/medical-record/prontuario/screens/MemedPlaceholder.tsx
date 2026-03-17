'use client';

import { ExternalLink, Pill } from 'lucide-react';
import { ProntuarioScreenProps } from '@/types/prontuario';

export function MemedPlaceholder({ patientData }: ProntuarioScreenProps) {
  return (
    <div className="flex items-center justify-center h-full p-8">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mx-auto mb-4">
          <Pill className="w-8 h-8 text-blue-500" />
        </div>
        <h3 className="text-lg font-bold text-slate-800 dark:text-[#fafafa] mb-2">Memed</h3>
        <p className="text-sm text-slate-500 dark:text-[#a1a1aa] mb-6">
          Plataforma de prescrição digital integrada. Permite criar receitas com controle especial e enviar diretamente para farmácias parceiras.
        </p>
        <p className="text-xs text-slate-400 dark:text-[#71717a] mb-4">
          Paciente: {patientData?.name || patientData?.full_name || '—'}
        </p>
        <a
          href="https://memed.com.br"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-lg transition-all"
        >
          <ExternalLink className="w-4 h-4" />
          Acessar Memed
        </a>
      </div>
    </div>
  );
}
