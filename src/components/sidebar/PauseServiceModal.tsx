'use client';

import { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { createPortal } from 'react-dom';
const supabase = createClient();
import { useToast } from '@/contexts/ToastContext';

interface SavedMessage {
  id: number;
  content: string;
  created_at: string;
}

interface PauseServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (message: string) => Promise<void>;
}

export default function PauseServiceModal({
  isOpen,
  onClose,
  onConfirm
}: PauseServiceModalProps) {
  const { toast } = useToast();
  const [isMounted, setIsMounted] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedSavedMessageId, setSelectedSavedMessageId] = useState<number | null>(null);
  const [savedMessages, setSavedMessages] = useState<SavedMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [useSavedMessage, setUseSavedMessage] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadSavedMessages();
      setMessage('');
      setSelectedSavedMessageId(null);
      setUseSavedMessage(false);
    }
  }, [isOpen]);

  const loadSavedMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('saved_call_messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (!error && data) {
        setSavedMessages(data);
      }
    } catch (error) {
      console.error('Erro ao carregar mensagens salvas:', error);
    }
  };

  const handleConfirm = async () => {
    let finalMessage = '';
    
    if (useSavedMessage && selectedSavedMessageId) {
      const saved = savedMessages.find(m => m.id === selectedSavedMessageId);
      if (saved) {
        finalMessage = saved.content;
      } else {
        toast.toast.error('Mensagem salva não encontrada');
        return;
      }
    } else {
      finalMessage = message.trim();
    }

    if (!finalMessage) {
      toast.toast.error('Por favor, escreva ou selecione uma mensagem');
      return;
    }

    setIsLoading(true);
    try {
      await onConfirm(finalMessage);
      onClose();
    } catch (error) {
      console.error('Erro ao ativar pausa:', error);
      toast.toast.error('Erro ao ativar pausa. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectSavedMessage = (id: number) => {
    setSelectedSavedMessageId(id);
    const saved = savedMessages.find(m => m.id === id);
    if (saved) {
      setMessage(saved.content);
    }
  };

  if (!isOpen || !isMounted) return null;

  const previewMessage = useSavedMessage && selectedSavedMessageId
    ? savedMessages.find(m => m.id === selectedSavedMessageId)?.content || ''
    : message;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 dark:bg-black/70 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#1e2028] rounded-2xl shadow-xl w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-[#111b21] dark:text-gray-100">
            Pausar Atendimento
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors text-[#54656f] dark:text-gray-400"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Opção: Escrever mensagem */}
          <div>
            <label className="flex items-center gap-2 mb-2">
              <input
                type="radio"
                checked={!useSavedMessage}
                onChange={() => setUseSavedMessage(false)}
                className="w-4 h-4 text-pink-500"
              />
              <span className="text-sm font-medium text-[#111b21] dark:text-gray-100">
                Escrever mensagem personalizada
              </span>
            </label>
            {!useSavedMessage && (
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Digite a mensagem que será enviada automaticamente..."
                className="w-full min-h-[100px] p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-[#2a2d36] text-[#111b21] dark:text-gray-100 placeholder-[#8696a0] resize-none focus:outline-none focus:ring-2 focus:ring-pink-500/50"
              />
            )}
          </div>

          {/* Opção: Selecionar mensagem salva */}
          <div>
            <label className="flex items-center gap-2 mb-2">
              <input
                type="radio"
                checked={useSavedMessage}
                onChange={() => setUseSavedMessage(true)}
                className="w-4 h-4 text-pink-500"
              />
              <span className="text-sm font-medium text-[#111b21] dark:text-gray-100">
                Selecionar mensagem salva
              </span>
            </label>
            {useSavedMessage && (
              <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar">
                {savedMessages.length === 0 ? (
                  <p className="text-sm text-[#8696a0] dark:text-gray-400 p-3 text-center">
                    Nenhuma mensagem salva encontrada
                  </p>
                ) : (
                  savedMessages.map((saved) => (
                    <button
                      key={saved.id}
                      onClick={() => handleSelectSavedMessage(saved.id)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        selectedSavedMessageId === saved.id
                          ? 'border-pink-500 bg-pink-50 dark:bg-pink-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div className={`mt-0.5 ${selectedSavedMessageId === saved.id ? 'text-pink-500' : 'text-gray-400'}`}>
                          {selectedSavedMessageId === saved.id ? (
                            <Check size={16} />
                          ) : (
                            <div className="w-4 h-4 rounded-full border-2 border-gray-300 dark:border-gray-600" />
                          )}
                        </div>
                        <p className="text-sm text-[#111b21] dark:text-gray-100 flex-1">
                          {saved.content}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Preview */}
          {previewMessage && (
            <div className="mt-4 p-4 bg-gray-50 dark:bg-[#2a2d36] rounded-lg border border-gray-200 dark:border-gray-700">
              <p className="text-xs font-medium text-[#54656f] dark:text-gray-400 mb-2">
                Preview da mensagem:
              </p>
              <p className="text-sm text-[#111b21] dark:text-gray-100 whitespace-pre-wrap">
                {previewMessage}
              </p>
            </div>
          )}

          {/* Info */}
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-xs text-blue-700 dark:text-blue-300">
              <strong>Como funciona:</strong> Quando uma nova mensagem chegar, o sistema enviará automaticamente esta mensagem após 1 minuto. Cada chat receberá a mensagem apenas 1 vez por pausa.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-[#54656f] dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading || (!message.trim() && !selectedSavedMessageId)}
            className="px-4 py-2 text-sm font-medium text-white bg-pink-500 hover:bg-pink-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Ativando...
              </>
            ) : (
              <>
                <Check size={16} />
                Pausar e Ativar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  , document.body);
}
