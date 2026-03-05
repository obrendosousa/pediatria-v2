'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Search, Plus, MoreVertical, Archive,
  Trash2, Filter, User, X,
  Settings, ArrowLeft, Tag, Loader2, Pause, Play
} from 'lucide-react';

import { Chat } from '@/types';
import { getAvatarColorHex, getAvatarTextColor } from '@/utils/colorUtils';

import { useChatList } from './sidebar/useChatList';
import ChatListItem from '@/components/sidebar/ChatListItem';
import TagsManager from '@/components/sidebar/TagsManager';
import TagSelector from '@/components/sidebar/TagSelector';

import NewChatModal from '@/components/chat/modals/NewChatModal';
import EditContactModal from '@/components/chat/modals/EditContactModal';
import PauseServiceModal from '@/components/sidebar/PauseServiceModal';
import ConfirmModal from '@/components/ui/ConfirmModal';

import { useAutoPauseMessages } from '@/hooks/useAutoPauseMessages';
import { activatePause, deactivatePause, isPauseActive } from '@/utils/pauseService';

interface SidebarProps {
  onSelectChat?: (chat: Chat | null) => void;
  selectedChatId?: number;
}

export default function AtendimentoSidebar({ onSelectChat, selectedChatId }: SidebarProps) {
  // --- ESTADOS DE UI ---
  const [searchTerm, setSearchTerm] = useState('');
  const [isViewingArchived, setIsViewingArchived] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedChatIds, setSelectedChatIds] = useState<number[]>([]);

  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
  const [isTagsManagerOpen, setIsTagsManagerOpen] = useState(false);
  const [tagSelectorChat, setTagSelectorChat] = useState<Chat | null>(null);

  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Chat | null>(null);
  const [isPauseModalOpen, setIsPauseModalOpen] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [confirmState, setConfirmState] = useState<{ message: string; title: string; resolve: (ok: boolean) => void } | null>(null);

  const headerMenuRef = useRef<HTMLDivElement>(null);
  const lastSyncedSelectedKeyRef = useRef<string>('');
  const [myProfilePic, setMyProfilePic] = useState<string | null>(null);
  const [myProfilePicError, setMyProfilePicError] = useState(false);

  useEffect(() => {
    fetch('/api/atendimento/whatsapp/my-profile-picture')
      .then((res) => res.json())
      .then((data: { profile_pic?: string | null }) => {
        const url = data?.profile_pic;
        if (typeof url === 'string' && url.startsWith('http')) setMyProfilePic(url);
      })
      .catch(() => { });
  }, []);

  const confirmFn = (message: string, title = 'Confirmar') =>
    new Promise<boolean>((resolve) => {
      setConfirmState({ message, title, resolve });
    });

  useAutoPauseMessages();

  useEffect(() => {
    const checkPauseStatus = async () => {
      try {
        const active = await isPauseActive();
        setIsPaused(active);
      } catch {
        setIsPaused(false);
      }
    };

    checkPauseStatus();

    const interval = setInterval(checkPauseStatus, 3000);
    return () => clearInterval(interval);
  }, [isPauseModalOpen]);

  // --- DADOS E AÇÕES (HOOK) ---
  const { chats, tags, isLoading, actions, fetchTags } = useChatList(isViewingArchived, searchTerm, { confirm: confirmFn });

  // --- EFEITOS DE UI ---
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Element;
      const isInsideChatMenu = target.closest('[data-chat-menu]');
      const isInsideGroup = target.closest('.group');
      if (activeMenuId !== null && !isInsideGroup && !isInsideChatMenu) {
        setActiveMenuId(null);
      }
      if (headerMenuRef.current && !headerMenuRef.current.contains(event.target as Node)) {
        setIsHeaderMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [activeMenuId]);

  useEffect(() => {
    if (!onSelectChat || !selectedChatId) return;

    const selectedFromList = chats.find((c) => c.id === selectedChatId);
    if (!selectedFromList) return;

    const syncKey = [
      selectedFromList.id,
      selectedFromList.contact_name || '',
      selectedFromList.phone || '',
      selectedFromList.updated_at || '',
      selectedFromList.last_interaction_at || '',
      selectedFromList.last_message || '',
      selectedFromList.last_message_type || '',
      selectedFromList.unread_count || 0,
    ].join('|');

    if (syncKey !== lastSyncedSelectedKeyRef.current) {
      lastSyncedSelectedKeyRef.current = syncKey;
      onSelectChat(selectedFromList);
    }
  }, [chats, selectedChatId, onSelectChat]);

  // --- HANDLERS ---
  const handleSelectChat = (chat: Chat) => {
    actions.select(chat);
    if (onSelectChat) onSelectChat(chat);
  };

  // --- HANDLER: abre chat via evento customizado ---
  useEffect(() => {
    const handler = (e: Event) => {
      const chatId = (e as CustomEvent<{ chatId: number }>).detail?.chatId;
      if (!chatId) return;

      setIsViewingArchived(false);

      const found = chats.find((c) => c.id === chatId);
      if (found) {
        handleSelectChat(found);
        return;
      }

      fetch(`/api/atendimento/chats/${chatId}`)
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          if (data) handleSelectChat(data as Chat);
        })
        .catch(() => {});
    };

    window.addEventListener('clara:open_chat', handler);
    return () => window.removeEventListener('clara:open_chat', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chats]);

  const toggleSelectionMode = () => {
    if (isSelectionMode) {
      setSelectedChatIds([]);
      setIsSelectionMode(false);
    } else {
      setIsSelectionMode(true);
    }
  };

  const toggleChatSelection = (chatId: number) => {
    setSelectedChatIds(prev =>
      prev.includes(chatId) ? prev.filter(id => id !== chatId) : [...prev, chatId]
    );
  };

  const handlePauseConfirm = async (message: string) => {
    await activatePause(message);
    setIsPaused(true);
  };

  const handleDeactivatePause = () => {
    setConfirmState({
      message: 'Deseja realmente desativar o modo de pausa?',
      title: 'Desativar pausa',
      resolve: (ok) => {
        setConfirmState(null);
        if (ok) deactivatePause().then(() => setIsPaused(false));
      },
    });
  };

  const handleItemAction = async (e: React.MouseEvent, action: string, chat: Chat) => {
    e.stopPropagation();
    e.preventDefault();

    if (action === 'tags') {
      setActiveMenuId(null);
      setTagSelectorChat(chat);
      return;
    }
    if (action === 'edit_contact') {
      setActiveMenuId(null);
      setEditingContact(chat);
      return;
    }
    if (action === 'select') {
      setActiveMenuId(null);
      setIsSelectionMode(true);
      setSelectedChatIds((prev) => (prev.includes(chat.id) ? prev : [...prev, chat.id]));
      return;
    }

    setActiveMenuId(null);

    const shouldClearSelection = await actions.singleAction(action, chat);
    if (shouldClearSelection && selectedChatId === chat.id) {
      onSelectChat?.(null);
    }
  };

  const handleBulkArchive = async () => {
    if (selectedChatIds.length === 0) return;
    await actions.bulkAction('archive', selectedChatIds);
    toggleSelectionMode();
  };

  const handleBulkDelete = async () => {
    if (selectedChatIds.length === 0) return;
    const deletingCurrentChat = selectedChatId ? selectedChatIds.includes(selectedChatId) : false;
    const didDelete = await actions.bulkAction('delete', selectedChatIds);
    if (didDelete && deletingCurrentChat) {
      onSelectChat?.(null);
    }
    toggleSelectionMode();
  };

  return (
    <>
      <div className="w-[320px] min-w-[260px] md:w-[380px] lg:w-[400px] shrink-0 flex flex-col border-r border-[#CCFBF1] dark:border-gray-800 bg-white dark:bg-[#1e2028] h-full relative z-10 transition-colors duration-300">

        {/* --- MODAIS --- */}
        <TagsManager
          isOpen={isTagsManagerOpen}
          onClose={() => setIsTagsManagerOpen(false)}
          tags={tags || []}
          onUpdate={fetchTags}
        />

        <TagSelector
          isOpen={!!tagSelectorChat}
          onClose={() => setTagSelectorChat(null)}
          chat={tagSelectorChat ? (chats.find(c => c.id === tagSelectorChat.id) ?? tagSelectorChat) : null}
          allTags={tags || []}
          onSaveTags={async (chat, tagIds) => {
            await actions.setTagsOnChat(chat, tagIds);
          }}
        />

        <NewChatModal
          isOpen={isNewChatModalOpen}
          onClose={() => setIsNewChatModalOpen(false)}
          onStartChat={(chatData: unknown) => {
            const newChat = chatData as Chat;
            const createdChat = actions.create(newChat);
            setIsNewChatModalOpen(false);
            handleSelectChat(createdChat);
          }}
        />

        {editingContact && (
          <EditContactModal
            isOpen={true}
            onClose={() => setEditingContact(null)}
            chat={editingContact}
            onUpdate={(updated: Chat) => {
              actions.updateContact(updated);
              setEditingContact(null);
            }}
          />
        )}

        <PauseServiceModal
          isOpen={isPauseModalOpen}
          onClose={() => setIsPauseModalOpen(false)}
          onConfirm={handlePauseConfirm}
        />

        {/* --- HEADER (4 ESTADOS) --- */}

        {/* 1. MODO ARQUIVADOS */}
        {isViewingArchived ? (
          <div className="flex flex-col animate-in fade-in duration-200 bg-[#F0FDFA] dark:bg-[#2a2d36]">
            <div className="h-[60px] flex items-center px-4 gap-4 border-b border-gray-200/50 dark:border-gray-700">
              <button
                onClick={() => setIsViewingArchived(false)}
                className="hover:bg-gray-200 dark:hover:bg-white/10 rounded-full p-2 transition-colors -ml-2 text-[#5E8683] dark:text-gray-300"
              >
                <ArrowLeft size={20} />
              </button>
              <h2 className="text-[19px] font-medium text-[#134E4A] dark:text-gray-100">Arquivadas</h2>
            </div>
            <div className="py-4 px-8 text-center bg-gray-50/50 dark:bg-transparent border-b border-gray-100 dark:border-gray-800">
              <p className="text-[13px] text-[#5E8683] dark:text-gray-400 leading-relaxed">
                Todas as suas conversas arquivadas estão aqui.
              </p>
            </div>
          </div>


          /* 3. MODO SELEÇÃO */
        ) : isSelectionMode ? (
          <div className="h-[60px] bg-blue-500/15 dark:bg-blue-500/20 flex items-center justify-between px-4 shrink-0 border-b border-blue-500/20 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
              <button onClick={toggleSelectionMode} className="p-2 hover:bg-white/50 dark:hover:bg-white/10 rounded-full text-blue-900/70 dark:text-gray-200">
                <X size={20} />
              </button>
              <span className="font-bold text-blue-900/90 dark:text-gray-100 text-sm">
                {selectedChatIds.length} selecionados
              </span>
            </div>
            <div className="flex gap-2">
              <button onClick={handleBulkArchive} className="p-2 hover:bg-white/50 dark:hover:bg-white/10 rounded-full text-blue-900 dark:text-gray-200" title="Arquivar">
                <Archive size={20} />
              </button>
              <button onClick={handleBulkDelete} className="p-2 hover:bg-white/50 dark:hover:bg-white/10 rounded-full text-red-500 dark:text-red-400" title="Excluir">
                <Trash2 size={20} />
              </button>
            </div>
          </div>

          /* 4. MODO PADRÃO */
        ) : (
          <>
            <div className="h-[60px] bg-[#F0FDFA] dark:bg-[#2a2d36] flex items-center justify-between px-4 shrink-0 border-b border-gray-200/60 dark:border-gray-700">
              <div
                className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity ring-2 ring-transparent hover:ring-teal-200 dark:hover:ring-teal-700"
                style={!myProfilePic || myProfilePicError ? { backgroundColor: getAvatarColorHex(0) } : {}}
              >
                {myProfilePic && !myProfilePicError ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={myProfilePic}
                    alt="Sua foto de perfil"
                    className="w-full h-full object-cover"
                    onError={() => setMyProfilePicError(true)}
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <User
                    className="w-6 h-6"
                    style={{ color: getAvatarTextColor(0) }}
                  />
                )}
              </div>
              <div className="flex gap-1 text-[#5E8683] dark:text-gray-300">
                <button
                  onClick={() => setIsNewChatModalOpen(true)}
                  className="hover:bg-teal-100/60 dark:hover:bg-white/10 rounded-lg p-2 transition-colors cursor-pointer"
                  title="Nova Conversa"
                  aria-label="Nova Conversa"
                >
                  <Plus size={20} />
                </button>

                <button
                  onClick={() => isPaused ? handleDeactivatePause() : setIsPauseModalOpen(true)}
                  className={`relative hover:bg-teal-100/60 dark:hover:bg-white/10 rounded-lg p-2 transition-colors cursor-pointer ${isPaused ? 'text-red-500 dark:text-red-400' : ''
                    }`}
                  title={isPaused ? 'Desativar Pausa' : 'Pausar Atendimento'}
                  aria-label={isPaused ? 'Desativar Pausa' : 'Pausar Atendimento'}
                >
                  {isPaused ? <Play size={18} /> : <Pause size={18} />}
                  {isPaused && (
                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#F0FDFA] dark:border-[#2a2d36] animate-pulse" />
                  )}
                </button>

                <div className="relative" ref={headerMenuRef}>
                  <button
                    onClick={() => setIsHeaderMenuOpen(!isHeaderMenuOpen)}
                    className={`hover:bg-teal-100/60 dark:hover:bg-white/10 rounded-lg p-2 transition-colors cursor-pointer ${isHeaderMenuOpen ? 'bg-teal-100/60 dark:bg-white/10' : ''}`}
                    aria-label="Menu"
                  >
                    <MoreVertical size={18} />
                  </button>

                  {isHeaderMenuOpen && (
                    <div className="absolute right-0 top-12 w-56 bg-white dark:bg-[#2a2d36] rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.12)] py-1.5 z-[60] border border-gray-100 dark:border-gray-700 animate-in fade-in zoom-in-95 duration-200 origin-top-right transition-all">
                      <button
                        onClick={() => { setIsTagsManagerOpen(true); setIsHeaderMenuOpen(false); }}
                        className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-white/5 flex items-center gap-3 text-[14px] text-[#134E4A] dark:text-gray-200 cursor-pointer transition-colors"
                      >
                        <Tag size={16} className="text-[#5E8683] dark:text-gray-400" /> Gerenciar Etiquetas
                      </button>
                      <button className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-white/5 flex items-center gap-3 text-[14px] text-[#134E4A] dark:text-gray-200 cursor-pointer transition-colors">
                        <Settings size={16} className="text-[#5E8683] dark:text-gray-400" /> Configurações
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-[#1e2028] relative transition-colors duration-300">
              <div className="bg-[#F0FDFA] dark:bg-[#2a2d36] rounded-lg flex items-center px-3.5 py-1.5 h-[36px] transition-colors duration-300 focus-within:ring-2 focus-within:ring-teal-300/50 dark:focus-within:ring-teal-700/50">
                <Search size={16} className="text-[#5E8683] dark:text-gray-400 mr-3 shrink-0" />
                <input
                  type="text"
                  placeholder="Pesquisar conversas..."
                  className="bg-transparent outline-none text-[13.5px] w-full placeholder-[#5E8683]/70 dark:placeholder-gray-500 text-[#134E4A] dark:text-gray-200"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm('')} className="text-[#5E8683] dark:text-gray-400 hover:text-[#134E4A] dark:hover:text-gray-200 p-0.5 cursor-pointer transition-colors">
                    <X size={14} />
                  </button>
                )}
              </div>
              <button className="absolute right-5 top-1/2 -translate-y-1/2 text-[#5E8683] dark:text-gray-400 hover:text-[#134E4A] dark:hover:text-gray-200 cursor-pointer transition-colors" aria-label="Filtrar">
                <Filter size={16} />
              </button>
            </div>
          </>
        )}

        {/* --- LISTAGEM --- */}
        <div className="flex-1 overflow-y-auto scrollbar-thin hover:scrollbar-thumb-gray-300 dark:hover:scrollbar-thumb-gray-600 bg-white dark:bg-[#1e2028] transition-colors duration-300">

          {/* BOTÕES DE NAVEGAÇÃO SUPERIORES */}
          {!isViewingArchived && !isSelectionMode && !searchTerm && (
            <div
              onClick={() => setIsViewingArchived(true)}
              className="flex items-center px-4 py-2.5 cursor-pointer hover:bg-teal-50/50 dark:hover:bg-white/5 text-[#134E4A] dark:text-gray-200 border-b border-gray-100 dark:border-gray-800 transition-colors duration-200"
            >
              <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center">
                <Archive size={16} className="text-[#0891B2] dark:text-teal-400" />
              </div>
              <span className="font-medium text-[13.5px] ml-3">Arquivadas</span>
            </div>
          )}

          {/* ESTADO: CARREGANDO */}
          {isLoading && (!chats || chats.length === 0) ? (
            <div className="p-10 flex justify-center text-gray-400">
              <Loader2 className="animate-spin" />
            </div>
          ) : (
            /* ESTADO: LISTA DE CHATS */
            (chats || []).length > 0 ? (
              (chats || []).map((chat: Chat) => (
                <ChatListItem
                  key={chat.id}
                  chat={chat}
                  isSelected={selectedChatId === chat.id}
                  isSelectionMode={isSelectionMode}
                  isSelectedInMode={selectedChatIds.includes(chat.id)}
                  isMenuOpen={activeMenuId === chat.id}
                  allTags={tags || []}

                  onSelect={handleSelectChat}
                  onToggleSelection={toggleChatSelection}
                  onToggleMenu={(e, id) => {
                    e.stopPropagation();
                    setActiveMenuId(activeMenuId === id ? null : id);
                  }}
                  onAction={handleItemAction}
                />
              ))
            ) : (
              /* ESTADO: VAZIO */
              <div className="p-10 text-center flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-gray-50 dark:bg-white/5 flex items-center justify-center">
                  {searchTerm ? (
                    <Search size={24} className="text-gray-300 dark:text-gray-600" />
                  ) : (
                    <Archive size={24} className="text-gray-300 dark:text-gray-600" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    {isViewingArchived ? 'Nenhuma conversa arquivada' : searchTerm ? 'Nenhum resultado' : 'Nenhuma conversa'}
                  </p>
                  {searchTerm && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Tente outro termo de busca</p>
                  )}
                </div>
              </div>
            )
          )}
        </div>
      </div>
      <ConfirmModal
        isOpen={!!confirmState}
        onClose={() => { confirmState?.resolve(false); setConfirmState(null); }}
        onConfirm={() => { confirmState?.resolve(true); setConfirmState(null); }}
        title={confirmState?.title ?? 'Confirmar'}
        message={confirmState?.message ?? ''}
        type="warning"
      />
    </>
  );
}
