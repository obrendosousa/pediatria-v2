'use client';

import { useState } from 'react';
import { Megaphone, X, Loader2 } from 'lucide-react';
import type { ServicePoint } from '@/types/queue';
import { useTVCall } from '@/hooks/useTVCall';

interface TVManualCallPanelProps {
  isOpen: boolean;
  onClose: () => void;
  /** Pontos de atendimento ativos (ex: guichês, consultórios) — opcional */
  servicePoints?: ServicePoint[];
}

export default function TVManualCallPanel({ isOpen, onClose, servicePoints = [] }: TVManualCallPanelProps) {
  const { manualCallOnTV, isCalling } = useTVCall();
  const [text, setText] = useState('');
  const [selectedServicePoint, setSelectedServicePoint] = useState<ServicePoint | null>(null);

  const handleCall = async () => {
    const trimmed = text.trim();
    if (!trimmed || isCalling) return;
    await manualCallOnTV(trimmed, selectedServicePoint);
    setText('');
    setSelectedServicePoint(null);
    onClose();
  };

  const handleClose = () => {
    setText('');
    setSelectedServicePoint(null);
    onClose();
  };

  if (!isOpen) return null;

  const activePoints = servicePoints.filter(sp => sp.status === 'active');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#1a1a22] rounded-2xl shadow-2xl border border-slate-200 dark:border-[#2d2d36] w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-[#252530]">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
              <Megaphone className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-gray-100">Chamada Manual na TV</h3>
              <p className="text-xs text-slate-500 dark:text-gray-400">Digite o texto que será falado e exibido</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ex: Maria Silva, por favor dirija-se ao atendimento"
            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-[#252530] bg-slate-50 dark:bg-[#0e0e14] text-sm text-slate-800 dark:text-gray-200 placeholder:text-slate-400 dark:placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-400 resize-none"
            rows={2}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleCall();
              }
            }}
          />

          {/* Seletor de ponto de atendimento (se houver) */}
          {activePoints.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-gray-400 mb-2">Destino (opcional)</p>
              <div className="flex flex-wrap gap-2">
                {activePoints.map(sp => (
                  <button
                    key={sp.id}
                    type="button"
                    onClick={() => setSelectedServicePoint(prev => prev?.id === sp.id ? null : sp)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      selectedServicePoint?.id === sp.id
                        ? 'bg-amber-500 border-amber-500 text-white'
                        : 'border-slate-200 dark:border-[#2d2d36] text-slate-600 dark:text-gray-400 hover:border-amber-400 hover:text-amber-600 dark:hover:text-amber-400'
                    }`}
                  >
                    {sp.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Ações */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleCall}
              disabled={!text.trim() || isCalling}
              className="flex items-center gap-2 px-5 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl shadow-lg shadow-amber-200 dark:shadow-none transition-all"
            >
              {isCalling ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Megaphone className="w-4 h-4" />
              )}
              {isCalling ? 'Enviando...' : 'Chamar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
