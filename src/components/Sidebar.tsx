'use client';

import { useState, useRef, useEffect } from 'react';
import { 
  Search, Plus, MoreVertical, Archive, 
  Trash2, Filter, User, X,
  Settings, ArrowLeft, Tag, Loader2, Pause, Play, Sparkles
} from 'lucide-react';

import { Chat } from '@/types';
import { getAvatarColorHex, getAvatarTextColor } from '@/utils/colorUtils';

import { useChatList } from './sidebar/useChatList';
import ChatListItem from './sidebar/ChatListItem';
import TagsManager from './sidebar/TagsManager';
import TagSelector from './sidebar/TagSelector';

import NewChatModal from './chat/modals/NewChatModal';
import EditContactModal from './chat/modals/EditContactModal';
import PauseServiceModal from './sidebar/PauseServiceModal';
import ConfirmModal from './ui/ConfirmModal';

import { useAutoPauseMessages } from '@/hooks/useAutoPauseMessages';
import { activatePause, deactivatePause, isPauseActive } from '@/utils/pauseService';

interface SidebarProps {
  onSelectChat?: (chat: Chat | null) => void;
  selectedChatId?: number;
}

export default function Sidebar({ onSelectChat, selectedChatId }: SidebarProps) {
  // --- ESTADOS DE UI ---
  const [searchTerm, setSearchTerm] = useState('');
  const [isViewingArchived, setIsViewingArchived] = useState(false);
  const [isViewingDrafts, setIsViewingDrafts] = useState(false); // NOVO: Estado para as sugestões da IA
  
  // Seleção Múltipla
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedChatIds, setSelectedChatIds] = useState<number[]>([]);
  
  // Menus e Modais
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
  const [isTagsManagerOpen, setIsTagsManagerOpen] = useState(false);
  const [tagSelectorChat, setTagSelectorChat] = useState<Chat | null>(null);
  
  // Modais de Chat
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
    fetch('/api/whatsapp/my-profile-picture')
      .then((res) => res.json())
      .then((data: { profile_pic?: string | null }) => {
        const url = data?.profile_pic;
        if (typeof url === 'string' && url.startsWith('http')) setMyProfilePic(url);
      })
      .catch(() => {});
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
  // NOVO: Passando isViewingDrafts para o hook
  const { chats, tags, isLoading, actions, fetchTags } = useChatList(isViewingArchived, isViewingDrafts, searchTerm, { confirm: confirmFn });

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

    const wasDeleted = action === 'delete' ? await actions.singleAction(action, chat) : false;
    if (wasDeleted && selectedChatId === chat.id) {
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
    <div className="w-[320px] min-w-[260px] md:w-[380px] lg:w-[400px] shrink-0 flex flex-col border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1e2028] h-full relative z-10 transition-colors duration-300">
      
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
        <div className="flex flex-col animate-in fade-in duration-200 bg-[#f0f2f5] dark:bg-[#2a2d36]">
            <div className="h-[60px] flex items-center px-4 gap-4 border-b border-gray-200/50 dark:border-gray-700">
                <button 
                  onClick={() => setIsViewingArchived(false)} 
                  className="hover:bg-gray-200 dark:hover:bg-white/10 rounded-full p-2 transition-colors -ml-2 text-[#54656f] dark:text-gray-300"
                >
                    <ArrowLeft size={20} />
                </button>
                <h2 className="text-[19px] font-medium text-[#111b21] dark:text-gray-100">Arquivadas</h2>
            </div>
            <div className="py-4 px-8 text-center bg-gray-50/50 dark:bg-transparent border-b border-gray-100 dark:border-gray-800">
               <p className="text-[13px] text-[#54656f] dark:text-gray-400 leading-relaxed">
                 Todas as suas conversas arquivadas estão aqui.
               </p>
            </div>
        </div>

      /* 2. MODO SUGESTÕES DA IA (NOVO) */
      ) : isViewingDrafts ? (
        <div className="flex flex-col animate-in fade-in duration-200 bg-[#f8f5ff] dark:bg-[#2a2536]">
            <div className="h-[60px] flex items-center px-4 gap-4 border-b border-purple-200/50 dark:border-purple-900/50">
                <button 
                  onClick={() => setIsViewingDrafts(false)} 
                  className="hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded-full p-2 transition-colors -ml-2 text-[#54656f] dark:text-gray-300"
                >
                    <ArrowLeft size={20} />
                </button>
                <div className="flex items-center gap-2 text-[#111b21] dark:text-gray-100">
                  <Sparkles size={20} className="text-purple-600 dark:text-purple-400" />
                  <h2 className="text-[19px] font-medium">Sugestões da IA</h2>
                </div>
            </div>
            <div className="py-4 px-8 text-center bg-purple-50/50 dark:bg-transparent border-b border-purple-100 dark:border-purple-900/30">
               <p className="text-[13px] text-[#54656f] dark:text-gray-400 leading-relaxed">
                 Chats aguardando aprovação das mensagens geradas pelo Agente Autônomo.
               </p>
            </div>
        </div>

      /* 3. MODO SELEÇÃO */
      ) : isSelectionMode ? (
        <div className="h-[60px] bg-primary/15 dark:bg-primary/20 flex items-center justify-between px-4 shrink-0 border-b border-primary/20 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
               <button onClick={toggleSelectionMode} className="p-2 hover:bg-white/50 dark:hover:bg-white/10 rounded-full text-primary-foreground/70 dark:text-gray-200">
                 <X size={20} />
               </button>
               <span className="font-bold text-primary-foreground/90 dark:text-gray-100 text-sm">
                 {selectedChatIds.length} selecionados
               </span>
            </div>
            <div className="flex gap-2">
               <button onClick={handleBulkArchive} className="p-2 hover:bg-white/50 dark:hover:bg-white/10 rounded-full text-primary-foreground dark:text-gray-200" title="Arquivar">
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
          <div className="h-[60px] bg-[#f0f2f5] dark:bg-[#2a2d36] flex items-center justify-between px-4 shrink-0 border-b border-gray-200 dark:border-gray-700">
            <div 
              className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
              style={!myProfilePic || myProfilePicError ? { backgroundColor: getAvatarColorHex(0) } : {}}
            >
              {myProfilePic && !myProfilePicError ? (
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
            <div className="flex gap-2 text-[#54656f] dark:text-gray-300">
               <button 
                 onClick={() => setIsNewChatModalOpen(true)}
                 className="hover:bg-gray-200 dark:hover:bg-white/10 rounded-full p-2 transition-colors"
                 title="Nova Conversa"
               >
                 <Plus size={22} />
               </button>
               
               <button
                 onClick={() => isPaused ? handleDeactivatePause() : setIsPauseModalOpen(true)}
                 className={`relative hover:bg-gray-200 dark:hover:bg-white/10 rounded-full p-2 transition-colors ${
                   isPaused ? 'text-red-500 dark:text-red-400' : ''
                 }`}
                 title={isPaused ? 'Desativar Pausa' : 'Pausar Atendimento'}
               >
                 {isPaused ? <Play size={20} /> : <Pause size={20} />}
                 {isPaused && (
                   <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white dark:border-[#1e2028] animate-pulse" />
                 )}
               </button>
               
               <div className="relative" ref={headerMenuRef}>
                   <button 
                     onClick={() => setIsHeaderMenuOpen(!isHeaderMenuOpen)} 
                     className={`hover:bg-gray-200 dark:hover:bg-white/10 rounded-full p-2 transition-colors ${isHeaderMenuOpen ? 'bg-gray-200 dark:bg-white/10' : ''}`}
                   >
                     <MoreVertical size={20} />
                   </button>
                   
                   {isHeaderMenuOpen && (
                     <div className="absolute right-0 top-12 w-56 bg-white dark:bg-[#2a2d36] rounded-lg shadow-[0_4px_20px_rgba(0,0,0,0.15)] py-2 z-[60] border border-gray-100 dark:border-gray-700 animate-in fade-in zoom-in-95 duration-200 origin-top-right transition-all">
                        <button 
                          onClick={() => { setIsTagsManagerOpen(true); setIsHeaderMenuOpen(false); }} 
                          className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-white/5 flex items-center gap-3 text-[14.5px] text-[#3b4a54] dark:text-gray-200"
                        >
                          <Tag size={18} className="text-[#54656f] dark:text-gray-400"/> Gerenciar Etiquetas
                        </button>
                        <button className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-white/5 flex items-center gap-3 text-[14.5px] text-[#3b4a54] dark:text-gray-200">
                          <Settings size={18} className="text-[#54656f] dark:text-gray-400"/> Configurações
                        </button>
                     </div>
                   )}
               </div>
            </div>
          </div>

          <div className="p-2 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-[#1e2028] relative transition-colors duration-300">
            <div className="bg-[#f0f2f5] dark:bg-[#2a2d36] rounded-lg flex items-center px-4 py-1.5 h-[35px] transition-colors duration-300">
              <Search size={18} className="text-[#54656f] dark:text-gray-400 mr-4 shrink-0" />
              <input 
                type="text" 
                placeholder="Pesquisar ou começar uma nova conversa" 
                className="bg-transparent outline-none text-[14px] w-full placeholder-[#54656f] dark:placeholder-gray-500 text-[#3b4a54] dark:text-gray-200" 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
              />
            </div>
            <button className="absolute right-5 top-1/2 -translate-y-1/2 text-[#54656f] dark:text-gray-400">
              <Filter size={18} />
            </button>
          </div>
        </>
      )}

      {/* --- LISTAGEM --- */}
      <div className="flex-1 overflow-y-auto scrollbar-thin hover:scrollbar-thumb-gray-300 dark:hover:scrollbar-thumb-gray-600 bg-white dark:bg-[#1e2028] transition-colors duration-300">
        
        {/* BOTÕES DE NAVEGAÇÃO SUPERIORES */}
        {!isViewingArchived && !isViewingDrafts && !isSelectionMode && !searchTerm && (
          <>
            {/* Botão de Sugestões da IA (NOVO) */}
            <div 
              onClick={() => setIsViewingDrafts(true)} 
              className="flex items-center px-4 py-3 cursor-pointer hover:bg-purple-50 dark:hover:bg-purple-900/10 text-[#111b21] dark:text-gray-200 border-b border-gray-50 dark:border-gray-800 transition-all duration-200 ease-in-out"
            >
                <div className="w-8 flex justify-center">
                  <Sparkles size={18} className="text-purple-600 dark:text-purple-400" />
                </div>
                <div className="flex flex-col ml-2">
                  <span className="font-medium text-[15px]">Sugestões da IA</span>
                  <span className="text-[12px] text-gray-500 dark:text-gray-400">Mensagens aguardando aprovação</span>
                </div>
            </div>

            {/* Botão de Arquivados (ORIGINAL) */}
            <div 
              onClick={() => setIsViewingArchived(true)} 
              className="flex items-center px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 text-[#111b21] dark:text-gray-200 border-b border-gray-50 dark:border-gray-800 transition-all duration-200 ease-in-out"
            >
                <div className="w-8 flex justify-center">
                  <Archive size={18} className="text-[#00a884] dark:text-primary" />
                </div>
                <span className="font-medium text-[15px] ml-2">Arquivadas</span>
            </div>
          </>
        )}
        
        {/* ESTADO: CARREGANDO */}
        {isLoading && (!chats || chats.length === 0) ? (
           <div className="p-10 flex justify-center text-gray-400">
              <Loader2 className="animate-spin"/>
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
            <div className="p-10 text-center text-gray-400 text-sm flex flex-col items-center gap-2">
                {isViewingArchived ? (
                    <>Nenhuma conversa arquivada.</>
                ) : isViewingDrafts ? (
                    <>Nenhuma sugestão pendente de aprovação.</>
                ) : searchTerm ? (
                    <>{`Nenhuma conversa encontrada para "${searchTerm}".`}</>
                ) : (
                    <>Nenhuma conversa.</>
                )}
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