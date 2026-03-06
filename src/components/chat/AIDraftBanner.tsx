'use client';

import { Sparkles, Check, X, Pencil, Eye } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

interface AIDraftBannerProps {
  draftText: string;
  draftReason: string;
  onApprove: (text: string) => Promise<void>;
  onDiscard: () => Promise<void>;
}

export default function AIDraftBanner({ draftText, draftReason, onApprove, onDiscard }: AIDraftBannerProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(draftText);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setEditedText(draftText);
  }, [draftText]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      const el = textareaRef.current;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
      // Auto-resize ao abrir
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
    // Auto-resize
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px';
  };

  if (!draftText) return null;

  const isModified = editedText !== draftText;

  return (
    <div className="mx-2 mt-1 rounded-xl bg-white dark:bg-[#233138] border border-purple-200/80 dark:border-purple-700/40 shadow-md overflow-hidden
      animate-in slide-in-from-bottom-3 fade-in duration-300">
      {/* Cabeçalho compacto */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50/80 dark:bg-purple-900/20 border-b border-purple-100/80 dark:border-purple-800/30">
        <Sparkles size={13} className="text-purple-500 dark:text-purple-400 shrink-0" />
        <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-300 tracking-wide uppercase">
          Sugestão da IA
        </span>
        {draftReason && (
          <span className="text-[10px] text-purple-400 dark:text-purple-500 truncate ml-0.5 hidden sm:inline" title={draftReason}>
            — {draftReason}
          </span>
        )}
        <button
          onClick={handleDiscard}
          disabled={isProcessing}
          title="Descartar"
          className="ml-auto p-1 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-40"
        >
          <X size={14} />
        </button>
      </div>

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
              bg-purple-50/50 dark:bg-purple-900/10 rounded-lg p-2.5
              border border-purple-200/60 dark:border-purple-700/30
              focus:border-purple-400 dark:focus:border-purple-500
              outline-none resize-none scrollbar-thin
              scrollbar-thumb-purple-200 dark:scrollbar-thumb-purple-700
              transition-colors"
            style={{ minHeight: '48px', maxHeight: '160px' }}
          />
        ) : (
          <p className="text-[13px] text-gray-700 dark:text-gray-200 leading-relaxed whitespace-pre-wrap break-words max-h-28 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700">
            {editedText}
          </p>
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
              ? 'text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-300'
              : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-purple-500'
            }`}
        >
          {isEditing ? <Eye size={11} /> : <Pencil size={11} />}
          {isEditing ? 'Visualizar' : 'Editar'}
        </button>

        <div className="flex-1" />

        {isEditing && (
          <span className="text-[10px] text-gray-400 dark:text-gray-500 mr-1 hidden sm:inline">
            ⌘+Enter para enviar
          </span>
        )}

        <button
          onClick={handleApprove}
          disabled={isProcessing || !editedText.trim()}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[11.5px] font-semibold
            text-white bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-500
            transition-colors disabled:opacity-40 shadow-sm"
        >
          <Check size={12} />
          {isModified ? 'Enviar editada' : 'Usar sugestão'}
        </button>
      </div>
    </div>
  );
}
