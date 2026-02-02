'use client';

import { X, AlertCircle, CheckCircle, Info, Loader2 } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  type?: 'danger' | 'warning' | 'info' | 'success';
  confirmText?: string;
  cancelText?: string;
  isLoading?: boolean;
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  type = 'warning',
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  isLoading = false
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const getTypeStyles = () => {
    switch (type) {
      case 'danger':
        return {
          icon: AlertCircle,
          iconColor: 'text-red-500',
          iconBg: 'bg-red-50 dark:bg-red-900/20',
          confirmButton: 'bg-red-600 hover:bg-red-700 text-white',
        };
      case 'warning':
        return {
          icon: AlertCircle,
          iconColor: 'text-amber-500',
          iconBg: 'bg-amber-50 dark:bg-amber-900/20',
          confirmButton: 'bg-amber-600 hover:bg-amber-700 text-white',
        };
      case 'success':
        return {
          icon: CheckCircle,
          iconColor: 'text-emerald-500',
          iconBg: 'bg-emerald-50 dark:bg-emerald-900/20',
          confirmButton: 'bg-emerald-600 hover:bg-emerald-700 text-white',
        };
      case 'info':
        return {
          icon: Info,
          iconColor: 'text-blue-500',
          iconBg: 'bg-blue-50 dark:bg-blue-900/20',
          confirmButton: 'bg-blue-600 hover:bg-blue-700 text-white',
        };
    }
  };

  const styles = getTypeStyles();
  const Icon = styles.icon;

  return (
    <div 
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-fade-in"
      onClick={isLoading ? undefined : onClose}
    >
      <div 
        className="bg-white dark:bg-[#1e2028] w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-gray-700 overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${styles.iconBg}`}>
              <Icon className={`w-5 h-5 ${styles.iconColor}`} />
            </div>
            <h3 className="font-bold text-lg text-slate-800 dark:text-gray-100">
              {title}
            </h3>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg text-slate-400 dark:text-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          <p className="text-slate-600 dark:text-gray-300 leading-relaxed">
            {message}
          </p>
        </div>

        {/* Actions */}
        <div className="p-5 border-t border-slate-100 dark:border-gray-800 flex gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-[#2a2d36] hover:bg-slate-200 dark:hover:bg-[#333640] text-slate-700 dark:text-gray-300 rounded-lg font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelText}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              if (!isLoading) {
                onConfirm();
              }
            }}
            disabled={isLoading}
            type="button"
            className={`flex-1 px-4 py-2.5 ${styles.confirmButton} rounded-lg font-semibold text-sm transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processando...
              </>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
