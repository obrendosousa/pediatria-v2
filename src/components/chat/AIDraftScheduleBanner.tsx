'use client';

import { CalendarClock, Check, Pencil, X } from 'lucide-react';
import { useState } from 'react';

interface AIDraftScheduleBannerProps {
  scheduleText: string;
  scheduleDate: string;   // ISO string
  scheduleReason: string;
  onApprove: () => Promise<void>;
  onEdit: () => void;
  onDiscard: () => Promise<void>;
}

function formatScheduleDate(isoStr: string): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(isoStr));
  } catch {
    return isoStr;
  }
}

export default function AIDraftScheduleBanner({
  scheduleText,
  scheduleDate,
  scheduleReason,
  onApprove,
  onEdit,
  onDiscard,
}: AIDraftScheduleBannerProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleApprove = async () => {
    setIsProcessing(true);
    await onApprove();
    setIsProcessing(false);
  };

  const handleDiscard = async () => {
    setIsProcessing(true);
    await onDiscard();
    setIsProcessing(false);
  };

  if (!scheduleText) return null;

  return (
    <div
      className="absolute bottom-full right-2 mb-2 z-50 w-80 max-w-[calc(100vw-4rem)]
        bg-white dark:bg-[#233138] rounded-2xl shadow-2xl
        border border-amber-200 dark:border-amber-700/50
        animate-in fade-in slide-in-from-bottom-2 duration-200"
    >
      {/* Cabeçalho */}
      <div className="flex items-center gap-2 px-3.5 pt-3 pb-1.5">
        <CalendarClock size={14} className="text-amber-500 dark:text-amber-400 shrink-0" />
        <span className="text-xs font-semibold text-amber-600 dark:text-amber-300 tracking-wide uppercase">
          Follow-up sugerido
        </span>
        <button
          onClick={handleDiscard}
          disabled={isProcessing}
          title="Descartar sugestão"
          className="ml-auto p-0.5 rounded hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-40"
        >
          <X size={14} />
        </button>
      </div>

      {/* Data/hora + motivo */}
      <div className="px-3.5 pb-1">
        <p className="text-[11.5px] font-semibold text-amber-700 dark:text-amber-300 capitalize">
          {formatScheduleDate(scheduleDate)}
        </p>
        {scheduleReason && (
          <p className="text-[11px] text-gray-400 dark:text-gray-500 italic mt-0.5 leading-snug">
            {scheduleReason}
          </p>
        )}
      </div>

      {/* Preview da mensagem */}
      <div className="mx-3.5 mb-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-2.5 border border-amber-100 dark:border-amber-800/40">
        <p className="text-[12.5px] text-gray-700 dark:text-gray-200 leading-relaxed whitespace-pre-wrap break-words max-h-32 overflow-y-auto scrollbar-thin scrollbar-thumb-amber-200 dark:scrollbar-thumb-amber-700">
          {scheduleText}
        </p>
      </div>

      {/* Botões de ação */}
      <div className="flex border-t border-gray-100 dark:border-white/10 rounded-b-2xl overflow-hidden">
        <button
          onClick={onEdit}
          disabled={isProcessing}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[12.5px] font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors disabled:opacity-40"
        >
          <Pencil size={12} />
          Editar
        </button>
        <div className="w-px bg-gray-100 dark:bg-white/10" />
        <button
          onClick={handleApprove}
          disabled={isProcessing}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[12.5px] font-semibold text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors disabled:opacity-40"
        >
          <Check size={13} />
          Aprovar agora
        </button>
      </div>

      {/* Seta apontando para baixo (âncora no input) */}
      <div className="absolute -bottom-[7px] right-6 w-3.5 h-3.5 bg-white dark:bg-[#233138] border-r border-b border-amber-200 dark:border-amber-700/50 rotate-45" />
    </div>
  );
}
