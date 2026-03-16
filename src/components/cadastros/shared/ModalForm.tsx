'use client';

import { useEffect, useRef } from 'react';
import { X, Loader2 } from 'lucide-react';

// --- Tipos ---

export interface ModalFormProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  onSubmit: (e: React.FormEvent) => void;
  loading?: boolean;
  submitText?: string;
  cancelText?: string;
  maxWidth?: string;
}

// --- Componente ---

export default function ModalForm({
  isOpen,
  onClose,
  title,
  children,
  onSubmit,
  loading = false,
  submitText = 'SALVAR INFORMAÇÕES',
  cancelText = 'Cancelar',
  maxWidth = 'max-w-lg',
}: ModalFormProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  // Fechar com Escape
  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !loading) onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, loading, onClose]);

  // Bloquear scroll do body
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-fade-in"
      onClick={loading ? undefined : onClose}
    >
      <div
        ref={contentRef}
        className={`bg-white dark:bg-[#0a0a0c] w-full ${maxWidth} rounded-2xl shadow-2xl border border-slate-200 dark:border-[#2e2e33] overflow-hidden animate-scale-in flex flex-col max-h-[90vh]`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-[#27272a] flex items-center justify-between shrink-0">
          <h3 className="font-bold text-lg text-slate-800 dark:text-[#fafafa]">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg text-slate-400 dark:text-[#71717a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={onSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="px-6 py-5 overflow-y-auto flex-1 custom-scrollbar space-y-4">
            {children}
          </div>

          {/* Ações */}
          <div className="px-6 py-4 border-t border-slate-100 dark:border-[#27272a] flex gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-[#18181b] hover:bg-slate-200 dark:hover:bg-[#333640] text-slate-700 dark:text-[#d4d4d8] rounded-lg font-semibold text-sm transition-colors disabled:opacity-50"
            >
              {cancelText}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold text-sm transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                submitText
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
