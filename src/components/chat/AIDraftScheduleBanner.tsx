'use client';

import { CalendarClock, Check, Pencil, X, Eye, Clock } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

interface AIDraftScheduleBannerProps {
  scheduleText: string;
  scheduleDate: string;   // ISO string
  scheduleReason: string;
  onApprove: (text: string) => Promise<void>;
  onEdit: () => void;      // Abre modal completo para reagendar data/hora
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
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(scheduleText);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setEditedText(scheduleText);
  }, [scheduleText]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      const el = textareaRef.current;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 160) + 'px';
    }
  }, [isEditing]);

  const handleApprove = async () => {
    setIsProcessing(true);
    await onApprove(editedText);
    setIsProcessing(false);
  };

  const handleDiscard = async () => {
    setIsProcessing(true);
    await onDiscard();
    setIsProcessing(false);
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditedText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px';
  };

  if (!scheduleText) return null;

  const isModified = editedText !== scheduleText;

  return (
    <div className="mx-2 mt-1 rounded-xl bg-white dark:bg-[#233138] border border-amber-200/80 dark:border-amber-700/40 shadow-md overflow-hidden
      animate-in slide-in-from-bottom-3 fade-in duration-300">
      {/* Cabeçalho compacto com data */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50/80 dark:bg-amber-900/20 border-b border-amber-100/80 dark:border-amber-800/30">
        <CalendarClock size={13} className="text-amber-500 dark:text-amber-400 shrink-0" />
        <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-300 tracking-wide uppercase">
          Follow-up sugerido
        </span>
        <span className="text-[10.5px] font-medium text-amber-500 dark:text-amber-400 capitalize ml-auto mr-1 hidden sm:inline">
          {formatScheduleDate(scheduleDate)}
        </span>
        <button
          onClick={handleDiscard}
          disabled={isProcessing}
          title="Descartar sugestão"
          className="p-1 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-40"
        >
          <X size={14} />
        </button>
      </div>

      {/* Data no mobile (visível quando escondida do header) */}
      <div className="px-3 pt-1.5 sm:hidden">
        <p className="text-[10.5px] font-medium text-amber-600 dark:text-amber-400 capitalize flex items-center gap-1">
          <Clock size={10} />
          {formatScheduleDate(scheduleDate)}
        </p>
      </div>

      {/* Motivo */}
      {scheduleReason && (
        <div className="px-3 pt-1.5">
          <p className="text-[11px] text-gray-400 dark:text-gray-500 italic leading-snug line-clamp-2">
            {scheduleReason}
          </p>
        </div>
      )}

      {/* Conteúdo: visualização ou edição */}
      <div className="px-3 py-2">
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={editedText}
            onChange={handleTextareaChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleApprove();
              }
            }}
            className="w-full text-[13px] text-gray-700 dark:text-gray-200 leading-relaxed
              bg-amber-50/50 dark:bg-amber-900/10 rounded-lg p-2.5
              border border-amber-200/60 dark:border-amber-700/30
              focus:border-amber-400 dark:focus:border-amber-500
              outline-none resize-none scrollbar-thin
              scrollbar-thumb-amber-200 dark:scrollbar-thumb-amber-700
              transition-colors"
            style={{ minHeight: '48px', maxHeight: '160px' }}
          />
        ) : (
          <div className="bg-amber-50/60 dark:bg-amber-900/10 rounded-lg p-2.5 border border-amber-100/60 dark:border-amber-800/30">
            <p className="text-[13px] text-gray-700 dark:text-gray-200 leading-relaxed whitespace-pre-wrap break-words max-h-28 overflow-y-auto scrollbar-thin scrollbar-thumb-amber-200 dark:scrollbar-thumb-amber-700">
              {editedText}
            </p>
          </div>
        )}
      </div>

      {/* Barra de ações */}
      <div className="flex items-center gap-1.5 px-3 pb-2">
        <button
          onClick={handleDiscard}
          disabled={isProcessing}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11.5px] font-medium
            text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500
            transition-colors disabled:opacity-40"
        >
          <X size={12} />
          Descartar
        </button>

        <button
          onClick={() => setIsEditing(!isEditing)}
          disabled={isProcessing}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11.5px] font-medium transition-colors disabled:opacity-40
            ${isEditing
              ? 'text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300'
              : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-amber-500'
            }`}
        >
          {isEditing ? <Eye size={11} /> : <Pencil size={11} />}
          {isEditing ? 'Visualizar' : 'Editar'}
        </button>

        <button
          onClick={onEdit}
          disabled={isProcessing}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11.5px] font-medium
            text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-amber-500
            transition-colors disabled:opacity-40"
          title="Alterar data e hora"
        >
          <Clock size={11} />
          Reagendar
        </button>

        <div className="flex-1" />

        <button
          onClick={handleApprove}
          disabled={isProcessing || !editedText.trim()}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[11.5px] font-semibold
            text-white bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-500
            transition-colors disabled:opacity-40 shadow-sm"
        >
          <Check size={12} />
          {isModified ? 'Aprovar editada' : 'Aprovar agora'}
        </button>
      </div>
    </div>
  );
}
