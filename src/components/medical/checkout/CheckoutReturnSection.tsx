'use client';

import { Calendar, CalendarCheck, Pencil, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CheckoutReturnSectionProps {
  returnDate: string;
  returnObs?: string | null;
  returnScheduledDate?: string | null;
  doctorName: string;
  onScheduleReturn?: () => void;
  onEditReturn?: () => void;
  onViewReturn?: () => void;
}

export default function CheckoutReturnSection({
  returnDate,
  returnObs,
  returnScheduledDate,
  doctorName,
  onScheduleReturn,
  onEditReturn,
  onViewReturn
}: CheckoutReturnSectionProps) {
  const isScheduled = !!returnScheduledDate;

  if (isScheduled) {
    return (
      <section className="rounded-xl border-l-4 border-l-emerald-500 border border-slate-200 dark:border-[#3d3d48] bg-white dark:bg-[#0f0f14] p-4">
        <h4 className="text-sm font-bold text-slate-800 dark:text-[#fafafa] flex items-center gap-2 mb-2">
          <CalendarCheck className="w-4 h-4 text-emerald-500" />
          Retorno agendado
        </h4>
        <p className="text-sm text-slate-600 dark:text-[#d4d4d8] mb-3">
          Retorno agendado para{' '}
          <strong className="text-emerald-600 dark:text-emerald-400">
            {format(new Date(returnScheduledDate + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </strong>
        </p>
        <div className="flex items-center gap-2">
          {onViewReturn && (
            <button
              type="button"
              onClick={onViewReturn}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800 rounded-lg transition-colors"
            >
              <ExternalLink size={13} />
              Ver na agenda
            </button>
          )}
          {onEditReturn && (
            <button
              type="button"
              onClick={onEditReturn}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/30 hover:bg-slate-100 dark:hover:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors"
            >
              <Pencil size={13} />
              Editar
            </button>
          )}
        </div>
      </section>
    );
  }

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
