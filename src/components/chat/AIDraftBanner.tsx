import { Sparkles, Check, X } from 'lucide-react';
import { useState } from 'react';

interface AIDraftBannerProps {
  draftText: string;
  draftReason: string;
  onApprove: (text: string) => Promise<void>;
  onDiscard: () => Promise<void>;
}

// Strip compacto e discreto — fica acima do campo de texto sem poluir o chat.
export default function AIDraftBanner({ draftText, draftReason, onApprove, onDiscard }: AIDraftBannerProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleApprove = async () => {
    setIsProcessing(true);
    await onApprove(draftText);
    setIsProcessing(false);
  };

  const handleDiscard = async () => {
    setIsProcessing(true);
    await onDiscard();
    setIsProcessing(false);
  };

  if (!draftText) return null;

  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 dark:bg-purple-900/20 border-t border-purple-200/70 dark:border-purple-700/40 animate-in fade-in slide-in-from-bottom-1 duration-200"
      title={draftReason || undefined}
    >
      <Sparkles size={13} className="text-purple-500 dark:text-purple-400 shrink-0" />

      <p className="flex-1 truncate text-[12.5px] text-gray-600 dark:text-gray-300 leading-snug">
        {draftText}
      </p>

      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={handleApprove}
          disabled={isProcessing}
          title="Usar sugestão"
          className="p-1 rounded hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600 dark:text-green-400 transition-colors disabled:opacity-40"
        >
          <Check size={14} />
        </button>
        <button
          onClick={handleDiscard}
          disabled={isProcessing}
          title="Descartar"
          className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-400 dark:text-red-500 transition-colors disabled:opacity-40"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
