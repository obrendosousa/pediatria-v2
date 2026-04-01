'use client';

import { Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CheckoutReturnSectionProps {
  returnDate: string;
  returnObs?: string | null;
  doctorName: string;
  onScheduleReturn?: () => void;
}

export default function CheckoutReturnSection({
  returnDate,
  returnObs,
  doctorName,
  onScheduleReturn
}: CheckoutReturnSectionProps) {
  return (
    <section className="rounded-xl border-l-4 border-l-amber-500 border border-slate-200 dark:border-[#3d3d48] bg-white dark:bg-[#0f0f14] p-4">
      <h4 className="text-sm font-bold text-slate-800 dark:text-[#fafafa] flex items-center gap-2 mb-2">
        <Calendar className="w-4 h-4 text-amber-500" />
        Proximos passos
      </h4>
      <p className="text-sm text-slate-600 dark:text-[#d4d4d8] mb-3">
        {doctorName} sugeriu retorno para{' '}
        <strong className="text-amber-600 dark:text-amber-400">
          {format(new Date(returnDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
        </strong>
        {returnObs ? ` — ${returnObs}` : ''}
      </p>
      {onScheduleReturn && (
        <button
          type="button"
          onClick={onScheduleReturn}
          className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-bold transition-colors"
        >
          <Calendar size={16} />
          Agendar agora
        </button>
      )}
    </section>
  );
}
