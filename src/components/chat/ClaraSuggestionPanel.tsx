'use client';

import { Bot, X, Sparkles, CalendarClock } from 'lucide-react';
import { useState } from 'react';
import AIDraftBanner from './AIDraftBanner';
import AIDraftScheduleBanner from './AIDraftScheduleBanner';

interface ClaraSuggestionPanelProps {
  isOpen: boolean;
  onClose: () => void;

  draftText: string | null;
  draftReason: string | null;
  onApproveDraft: (text: string) => Promise<void>;
  onDiscardDraft: () => Promise<void>;

  scheduleText: string | null;
  scheduleDate: string | null;
  scheduleReason: string | null;
  onApproveSchedule: (text: string) => Promise<void>;
  onEditSchedule: () => void;
  onDiscardSchedule: () => Promise<void>;
}

type TabType = 'draft' | 'schedule';

export default function ClaraSuggestionPanel({
  isOpen,
  onClose,
  draftText,
  draftReason,
  onApproveDraft,
  onDiscardDraft,
  scheduleText,
  scheduleDate,
  scheduleReason,
  onApproveSchedule,
  onEditSchedule,
  onDiscardSchedule,
}: ClaraSuggestionPanelProps) {
  const hasDraft = !!draftText;
  const hasSchedule = !!scheduleText;
  const hasBoth = hasDraft && hasSchedule;

  const [activeTab, setActiveTab] = useState<TabType>(hasDraft ? 'draft' : 'schedule');

  if (!isOpen || (!hasDraft && !hasSchedule)) return null;

  // Se a tab ativa não tem mais conteúdo, troca para a outra
  const effectiveTab = (activeTab === 'draft' && !hasDraft) ? 'schedule'
    : (activeTab === 'schedule' && !hasSchedule) ? 'draft'
    : activeTab;

  return (
    <div className="absolute right-[52px] sm:right-[58px] top-[56px] bottom-[68px] z-[45] w-[360px] max-w-[calc(100vw-120px)]
      flex flex-col bg-white dark:bg-[#1a2328] border-l border-gray-200 dark:border-[#252a3a]
      shadow-2xl animate-in slide-in-from-right-4 fade-in duration-250">

      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-100 dark:border-[#252a3a]/80 shrink-0">
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-sm">
          <Bot size={14} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-[#e8ecf4]">
            Sugestões da Clara
          </h3>
          <p className="text-[10px] text-gray-400 dark:text-[#565d73]">
            {hasBoth ? '2 sugestões pendentes' : '1 sugestão pendente'}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-gray-400 hover:text-gray-600 transition-colors"
          title="Minimizar"
        >
          <X size={16} />
        </button>
      </div>

      {/* Tabs (só se tem ambos) */}
      {hasBoth && (
        <div className="flex border-b border-gray-100 dark:border-[#252a3a]/80 shrink-0">
          <button
            onClick={() => setActiveTab('draft')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-medium transition-colors
              ${effectiveTab === 'draft'
                ? 'text-purple-600 dark:text-purple-400 border-b-2 border-purple-500'
                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
              }`}
          >
            <Sparkles size={11} />
            Resposta
          </button>
          <button
            onClick={() => setActiveTab('schedule')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-medium transition-colors
              ${effectiveTab === 'schedule'
                ? 'text-amber-600 dark:text-amber-400 border-b-2 border-amber-500'
                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
              }`}
          >
            <CalendarClock size={11} />
            Follow-up
          </button>
        </div>
      )}

      {/* Conteúdo */}
      <div className="flex-1 overflow-y-auto p-1">
        {effectiveTab === 'draft' && hasDraft && (
          <AIDraftBanner
            draftText={draftText}
            draftReason={draftReason || ''}
            onApprove={onApproveDraft}
            onDiscard={onDiscardDraft}
          />
        )}
        {effectiveTab === 'schedule' && hasSchedule && (
          <AIDraftScheduleBanner
            scheduleText={scheduleText}
            scheduleDate={scheduleDate || ''}
            scheduleReason={scheduleReason || ''}
            onApprove={onApproveSchedule}
            onEdit={onEditSchedule}
            onDiscard={onDiscardSchedule}
          />
        )}
      </div>
    </div>
  );
}
