'use client';

import { Bot, Check, Eye, X, CalendarClock, Sparkles } from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';

const TOAST_DURATION = 20_000;

export type SuggestionPhase = 'toast' | 'minimized' | 'expanded' | null;

interface ToastCardProps {
  type: 'draft' | 'schedule';
  text: string;
  reason: string | null;
  scheduleDate?: string | null;
  onApprove: (text: string) => Promise<void>;
  onExpand: () => void;
  onDismiss: () => void;
}

function formatScheduleDateShort(isoStr: string): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(isoStr));
  } catch {
    return isoStr;
  }
}

function ToastCard({ type, text, reason, scheduleDate, onApprove, onExpand, onDismiss }: ToastCardProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const isDraft = type === 'draft';

  const handleApprove = async () => {
    setIsProcessing(true);
    await onApprove(text);
    setIsProcessing(false);
  };

  return (
    <div
      className={`rounded-xl bg-white dark:bg-[#233138] border shadow-lg overflow-hidden
        ${isDraft
          ? 'border-purple-200/80 dark:border-purple-700/40'
          : 'border-amber-200/80 dark:border-amber-700/40'
        }`}
      style={{
        animation: 'toastSlideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* Header */}
      <div className={`flex items-center gap-2 px-3 py-1.5
        ${isDraft
          ? 'bg-purple-50/80 dark:bg-purple-900/20'
          : 'bg-amber-50/80 dark:bg-amber-900/20'
        }`}>
        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0">
          <Bot size={10} className="text-white" />
        </div>
        {isDraft ? (
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <Sparkles size={11} className="text-purple-500 shrink-0" />
            <span className="text-[10px] font-semibold text-purple-600 dark:text-purple-300 uppercase tracking-wide">
              Sugestão da IA
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <CalendarClock size={11} className="text-amber-500 shrink-0" />
            <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-300 uppercase tracking-wide">
              Follow-up
            </span>
            {scheduleDate && (
              <span className="text-[9px] text-amber-500 dark:text-amber-400 capitalize ml-auto whitespace-nowrap">
                {formatScheduleDateShort(scheduleDate)}
              </span>
            )}
          </div>
        )}
        <button
          onClick={onDismiss}
          disabled={isProcessing}
          className="p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-40 shrink-0"
        >
          <X size={12} />
        </button>
      </div>

      {/* Texto completo com scroll para mensagens longas */}
      <div className="px-3 py-2.5 max-h-[200px] overflow-y-auto">
        <p className="text-[12px] text-gray-700 dark:text-gray-200 leading-[1.6] whitespace-pre-wrap">
          {text}
        </p>
        {reason && (
          <p className="text-[10px] text-gray-400 dark:text-[#71717a] italic mt-1.5 leading-relaxed">
            {reason}
          </p>
        )}
      </div>

      {/* Ações */}
      <div className="flex items-center gap-1 px-2.5 pb-2 pt-0.5 border-t border-gray-100 dark:border-[#2e2e33]/50">
        <button
          onClick={onExpand}
          disabled={isProcessing}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10.5px] font-medium
            text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-700
            transition-all duration-150 disabled:opacity-40"
        >
          <Eye size={11} />
          Ver
        </button>
        <div className="flex-1" />
        <button
          onClick={handleApprove}
          disabled={isProcessing}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10.5px] font-semibold
            text-white bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-500
            transition-all duration-150 disabled:opacity-60 shadow-sm
            active:scale-95"
        >
          <Check size={11} />
          {isDraft ? 'Usar' : 'Aprovar'}
        </button>
      </div>
    </div>
  );
}

interface ClaraSuggestionToastProps {
  draftText: string | null;
  draftReason: string | null;
  draftPhase: SuggestionPhase;
  onExpandDraft: () => void;
  onDismissDraft: () => void;
  onApproveDraft: (text: string) => Promise<void>;
  onAutoMinimizeDraft: () => void;

  scheduleText: string | null;
  scheduleDate: string | null;
  scheduleReason: string | null;
  schedulePhase: SuggestionPhase;
  onExpandSchedule: () => void;
  onDismissSchedule: () => void;
  onApproveSchedule: (text: string) => Promise<void>;
  onAutoMinimizeSchedule: () => void;
}

export default function ClaraSuggestionToast({
  draftText,
  draftReason,
  draftPhase,
  onExpandDraft,
  onDismissDraft,
  onApproveDraft,
  onAutoMinimizeDraft,
  scheduleText,
  scheduleDate,
  scheduleReason,
  schedulePhase,
  onExpandSchedule,
  onDismissSchedule,
  onApproveSchedule,
  onAutoMinimizeSchedule,
}: ClaraSuggestionToastProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  // Refs estáveis para callbacks (evita stale closures nos timers)
  const onAutoMinimizeDraftRef = useRef(onAutoMinimizeDraft);
  const onAutoMinimizeScheduleRef = useRef(onAutoMinimizeSchedule);
  useEffect(() => {
    onAutoMinimizeDraftRef.current = onAutoMinimizeDraft;
    onAutoMinimizeScheduleRef.current = onAutoMinimizeSchedule;
  }, [onAutoMinimizeDraft, onAutoMinimizeSchedule]);

  // Timers internos com pause-on-hover
  const draftTimerRef = useRef<NodeJS.Timeout | null>(null);
  const scheduleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const draftRemainingRef = useRef(TOAST_DURATION);
  const scheduleRemainingRef = useRef(TOAST_DURATION);
  const draftStartRef = useRef(0);
  const scheduleStartRef = useRef(0);

  const showDraft = draftPhase === 'toast' && !!draftText;
  const showSchedule = schedulePhase === 'toast' && !!scheduleText;

  // Funções para iniciar/pausar/retomar timers
  const startDraftTimer = useCallback(() => {
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftStartRef.current = Date.now();
    draftTimerRef.current = setTimeout(() => {
      onAutoMinimizeDraftRef.current();
    }, draftRemainingRef.current);
  }, []);

  const pauseDraftTimer = useCallback(() => {
    if (draftTimerRef.current) {
      clearTimeout(draftTimerRef.current);
      draftTimerRef.current = null;
      const elapsed = Date.now() - draftStartRef.current;
      draftRemainingRef.current = Math.max(0, draftRemainingRef.current - elapsed);
    }
  }, []);

  const startScheduleTimer = useCallback(() => {
    if (scheduleTimerRef.current) clearTimeout(scheduleTimerRef.current);
    scheduleStartRef.current = Date.now();
    scheduleTimerRef.current = setTimeout(() => {
      onAutoMinimizeScheduleRef.current();
    }, scheduleRemainingRef.current);
  }, []);

  const pauseScheduleTimer = useCallback(() => {
    if (scheduleTimerRef.current) {
      clearTimeout(scheduleTimerRef.current);
      scheduleTimerRef.current = null;
      const elapsed = Date.now() - scheduleStartRef.current;
      scheduleRemainingRef.current = Math.max(0, scheduleRemainingRef.current - elapsed);
    }
  }, []);

  // Inicia timers quando toast aparece
  useEffect(() => {
    if (showDraft) {
      draftRemainingRef.current = TOAST_DURATION;
      if (!isHovered) startDraftTimer();
    }
    return () => { if (draftTimerRef.current) clearTimeout(draftTimerRef.current); };
  }, [showDraft]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (showSchedule) {
      scheduleRemainingRef.current = TOAST_DURATION;
      if (!isHovered) startScheduleTimer();
    }
    return () => { if (scheduleTimerRef.current) clearTimeout(scheduleTimerRef.current); };
  }, [showSchedule]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pause/resume no hover
  useEffect(() => {
    if (isHovered) {
      if (showDraft) pauseDraftTimer();
      if (showSchedule) pauseScheduleTimer();
      // Pausa a barra CSS
      if (barRef.current) {
        const computedWidth = barRef.current.getBoundingClientRect().width;
        const parentWidth = barRef.current.parentElement?.getBoundingClientRect().width || 1;
        const pct = (computedWidth / parentWidth) * 100;
        barRef.current.style.transition = 'none';
        barRef.current.style.width = `${pct}%`;
      }
    } else {
      if (showDraft) startDraftTimer();
      if (showSchedule) startScheduleTimer();
      // Retoma a barra CSS com tempo restante
      if (barRef.current) {
        const remaining = Math.max(
          showDraft ? draftRemainingRef.current : 0,
          showSchedule ? scheduleRemainingRef.current : 0
        );
        requestAnimationFrame(() => {
          if (barRef.current) {
            barRef.current.style.transition = `width ${remaining}ms linear`;
            barRef.current.style.width = '0%';
          }
        });
      }
    }
  }, [isHovered]); // eslint-disable-line react-hooks/exhaustive-deps

  // Animação da barra de countdown (inicializa)
  useEffect(() => {
    if (!barRef.current) return;
    if (showDraft || showSchedule) {
      barRef.current.style.transition = 'none';
      barRef.current.style.width = '100%';
      requestAnimationFrame(() => {
        if (barRef.current) {
          barRef.current.style.transition = `width ${TOAST_DURATION}ms linear`;
          barRef.current.style.width = '0%';
        }
      });
    }
  }, [showDraft, showSchedule]);

  if (!showDraft && !showSchedule) return null;

  return (
    <>
      {/* Animação CSS inline */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes toastSlideIn {
          0% { opacity: 0; transform: translateX(24px) scale(0.96); }
          100% { opacity: 1; transform: translateX(0) scale(1); }
        }
      `}} />

      <div
        className="absolute bottom-[76px] right-3 z-50 w-[360px] max-w-[calc(100vw-120px)]
          flex flex-col gap-2.5"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Toast de sugestão de resposta */}
        {showDraft && (
          <ToastCard
            type="draft"
            text={draftText}
            reason={draftReason}
            onApprove={onApproveDraft}
            onExpand={onExpandDraft}
            onDismiss={onDismissDraft}

          />
        )}

        {/* Toast de follow-up */}
        {showSchedule && (
          <ToastCard
            type="schedule"
            text={scheduleText}
            reason={scheduleReason}
            scheduleDate={scheduleDate}
            onApprove={onApproveSchedule}
            onExpand={onExpandSchedule}
            onDismiss={onDismissSchedule}

          />
        )}

        {/* Barra de countdown */}
        <div className="h-[3px] bg-gray-200/60 dark:bg-[#27272a]/60 rounded-full overflow-hidden mx-1">
          <div
            ref={barRef}
            className={`h-full rounded-full ${
              isHovered
                ? 'bg-gradient-to-r from-indigo-400 to-purple-400'
                : 'bg-gradient-to-r from-indigo-500 to-purple-500'
            }`}
            style={{ width: '100%' }}
          />
        </div>

        {/* Indicador de pausa */}
        {isHovered && (
          <div className="text-center">
            <span className="text-[9px] text-gray-400 dark:text-[#71717a]">
              Pausado enquanto o mouse estiver aqui
            </span>
          </div>
        )}
      </div>
    </>
  );
}
