import { Sparkles, Check, X } from 'lucide-react';
import { useState } from 'react';

interface AIDraftBannerProps {
  draftText: string;
  draftReason: string;
  onApprove: (text: string) => Promise<void>;
  onDiscard: () => Promise<void>;
}

// Balão flutuante no canto inferior esquerdo — exibe o texto completo da sugestão.
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
      className="absolute bottom-full left-2 mb-2 z-50 w-80 max-w-[calc(100vw-4rem)]
        bg-white dark:bg-[#233138] rounded-2xl shadow-2xl
        border border-purple-200 dark:border-purple-700/50
        animate-in fade-in slide-in-from-bottom-2 duration-200"
      title={draftReason || undefined}
    >
      {/* Cabeçalho */}
      <div className="flex items-center gap-2 px-3.5 pt-3 pb-1.5">
        <Sparkles size={14} className="text-purple-500 dark:text-purple-400 shrink-0" />
        <span className="text-xs font-semibold text-purple-600 dark:text-purple-300 tracking-wide uppercase">
          Sugestão da IA
        </span>
        <button
          onClick={handleDiscard}
          disabled={isProcessing}
          title="Descartar"
          className="ml-auto p-0.5 rounded hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-40"
        >
          <X size={14} />
        </button>
      </div>

      {/* Texto completo da sugestão */}
      <div className="px-3.5 pb-3">
        <p className="text-[13.5px] text-gray-700 dark:text-gray-200 leading-relaxed whitespace-pre-wrap break-words max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700">
          {draftText}
        </p>
      </div>

      {/* Botões de ação */}
      <div className="flex border-t border-gray-100 dark:border-white/10 rounded-b-2xl overflow-hidden">
        <button
          onClick={handleDiscard}
          disabled={isProcessing}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[12.5px] font-medium text-gray-500 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 transition-colors disabled:opacity-40"
        >
          <X size={13} />
          Descartar
        </button>
        <div className="w-px bg-gray-100 dark:bg-white/10" />
        <button
          onClick={handleApprove}
          disabled={isProcessing}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[12.5px] font-semibold text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors disabled:opacity-40"
        >
          <Check size={13} />
          Usar sugestão
        </button>
      </div>

      {/* Seta apontando para baixo (âncora no input) */}
      <div className="absolute -bottom-[7px] left-6 w-3.5 h-3.5 bg-white dark:bg-[#233138] border-r border-b border-purple-200 dark:border-purple-700/50 rotate-45" />
    </div>
  );
}
