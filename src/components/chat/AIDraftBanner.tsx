import { Sparkles, Check, X, Info } from 'lucide-react';
import { useState } from 'react';

interface AIDraftBannerProps {
  draftText: string;
  draftReason: string;
  onApprove: (text: string) => Promise<void>;
  onDiscard: () => Promise<void>;
}

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
    <div className="m-4 p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg shadow-sm animate-in fade-in slide-in-from-top-2">
      <div className="flex items-center gap-2 mb-2 text-purple-700 dark:text-purple-400 font-semibold">
        <Sparkles size={18} />
        <span>Sugestão do Agente Autônomo</span>
      </div>

      {draftReason && (
        <div className="flex items-start gap-2 mb-3 text-sm text-purple-600 dark:text-purple-300 bg-purple-100/50 dark:bg-purple-900/40 p-2 rounded-md">
          <Info size={16} className="mt-0.5 shrink-0" />
          <p>{draftReason}</p>
        </div>
      )}

      <div className="mb-4 text-[#111b21] dark:text-gray-200 bg-white dark:bg-[#1e2028] p-3 rounded-md border border-gray-200 dark:border-gray-700 text-[15px] whitespace-pre-wrap shadow-inner">
        {draftText}
      </div>

      <div className="flex justify-end gap-3">
        <button
          onClick={handleDiscard}
          disabled={isProcessing}
          className="px-4 py-2 flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-md transition-colors disabled:opacity-50"
        >
          <X size={16} />
          Descartar
        </button>
        <button
          onClick={handleApprove}
          disabled={isProcessing}
          className="px-4 py-2 flex items-center gap-2 text-sm font-medium bg-purple-600 text-white hover:bg-purple-700 rounded-md transition-colors disabled:opacity-50 shadow-sm"
        >
          <Check size={16} />
          {isProcessing ? 'Enviando...' : 'Aprovar e Enviar'}
        </button>
      </div>
    </div>
  );
}