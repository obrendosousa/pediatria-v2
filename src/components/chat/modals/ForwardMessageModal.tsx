'use client';

import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Loader2, Send } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
const supabase = createClient();
import { Message, Chat } from '@/types';
import { getAvatarColorHex, getAvatarTextColor } from '@/utils/colorUtils';

const DEBOUNCE_MS = 300;
const FORWARD_CHATS_SELECT = 'id, phone, contact_name, profile_pic, last_message, last_interaction_at';

interface ForwardMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: Message | null;
  currentChatId: number | string;
  onForward: (targetChat: Chat) => void;
  /** Lista pré-carregada para abrir o modal sem esperar (opcional) */
  initialChats?: Chat[] | null;
}

export default function ForwardMessageModal({
  isOpen,
  onClose,
  message,
  currentChatId,
  onForward,
  initialChats = null,
}: ForwardMessageModalProps) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [mounted, setMounted] = useState(false);
  const [failedAvatarIds, setFailedAvatarIds] = useState<Set<number>>(new Set());

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!isOpen) return;
    setSearchInput('');
    setSelectedChat(null);
    setFailedAvatarIds(new Set());
  }, [isOpen]);

  // Debounce do termo de busca
  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => setSearchTerm(searchInput.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput, isOpen]);

  // Lista exibida: com cache inicial (sem busca) ou resultado da busca
  const hasInitial = initialChats && initialChats.length > 0;
  const showInitial = isOpen && !searchTerm && hasInitial;
  const displayChats = useMemo(() => {
    if (showInitial) {
      return initialChats!.filter((c) => String(c.id) !== String(currentChatId));
    }
    return chats;
  }, [showInitial, initialChats, currentChatId, chats]);

  const isLoading = loading && !showInitial;

  // Busca ao digitar (debounced)
  useEffect(() => {
    if (!isOpen) return;
    setSelectedChat(null);
    if (!searchTerm) {
      setChats([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    supabase
      .from('chats')
      .select(FORWARD_CHATS_SELECT)
      .eq('is_archived', false)
      .neq('id', currentChatId)
      .or(`contact_name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`)
      .order('last_interaction_at', { ascending: false })
      .limit(50)
      .then(
        ({ data }) => {
          if (!cancelled) setChats((data as Chat[]) || []);
          if (!cancelled) setLoading(false);
        },
        () => {
          if (!cancelled) setChats([]);
          if (!cancelled) setLoading(false);
        }
      );
    return () => { cancelled = true; };
  }, [isOpen, currentChatId, searchTerm]);

  // Se abriu sem cache, carrega lista uma vez (sem busca)
  useEffect(() => {
    if (!isOpen || searchTerm || hasInitial) return;
    let cancelled = false;
    setLoading(true);
    supabase
      .from('chats')
      .select(FORWARD_CHATS_SELECT)
      .eq('is_archived', false)
      .neq('id', currentChatId)
      .order('last_interaction_at', { ascending: false })
      .limit(60)
      .then(
        ({ data }) => {
          if (!cancelled) setChats((data as Chat[]) || []);
          if (!cancelled) setLoading(false);
        },
        () => {
          if (!cancelled) setChats([]);
          if (!cancelled) setLoading(false);
        }
      );
    return () => { cancelled = true; };
  }, [isOpen, currentChatId, searchTerm, hasInitial]);

  const handleForward = () => {
    if (!selectedChat) return;
    onForward(selectedChat);
    // Modal é fechado pelo pai após sucesso (setForwardMessage(null))
  };

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#233138] rounded-xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col border border-gray-200 dark:border-gray-700">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between shrink-0">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Encaminhar mensagem
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400"
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        {message && (
          <div className="px-4 py-2 bg-gray-50 dark:bg-[#0b141a] border-b border-gray-100 dark:border-gray-700 shrink-0">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Mensagem selecionada</p>
            <p className="text-sm text-gray-800 dark:text-gray-200 line-clamp-2">
              {message.message_type === 'text'
                ? (message.message_text || '').trim() || '(sem texto)'
                : `[${message.message_type}] ${(message.message_text || '').trim() || ''}`.trim() || `Mídia: ${message.message_type}`}
            </p>
          </div>
        )}

        <div className="p-2 border-b border-gray-100 dark:border-gray-700 shrink-0">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="Buscar contato..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-[#0b141a] text-gray-900 dark:text-gray-100 placeholder-gray-400 text-sm focus:ring-2 focus:ring-green-500/30 focus:border-green-500 outline-none"
            />
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={28} className="animate-spin text-green-500" />
            </div>
          ) : displayChats.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
              Nenhum chat encontrado.
            </div>
          ) : (
            <ul className="py-1">
              {displayChats.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedChat(c)}
                    className={`w-full px-4 py-3 text-left flex items-center gap-3 transition-colors ${
                      selectedChat?.id === c.id
                        ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200'
                        : 'hover:bg-gray-50 dark:hover:bg-white/5 text-gray-900 dark:text-gray-100'
                    }`}
                  >
                    <div 
                      className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 overflow-hidden"
                      style={!c.profile_pic || failedAvatarIds.has(c.id) ? { backgroundColor: getAvatarColorHex(c.id) } : {}}
                    >
                      {c.profile_pic && !failedAvatarIds.has(c.id) ? (
                        <img
                          src={c.profile_pic}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={() => setFailedAvatarIds((prev) => new Set(prev).add(c.id))}
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <span className="text-sm font-medium select-none" style={{ color: getAvatarTextColor(c.id) }}>
                          {(c.contact_name || c.phone || '?').charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">
                        {c.contact_name || c.phone || `Chat ${c.id}`}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {c.contact_name && c.phone ? c.phone : c.last_message || ''}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 text-sm font-medium transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleForward}
            disabled={!selectedChat}
            className="flex-1 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:pointer-events-none text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors"
          >
            <Send size={18} />
            Encaminhar
          </button>
        </div>
      </div>
    </div>
  );

  return mounted && typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : null;
}
