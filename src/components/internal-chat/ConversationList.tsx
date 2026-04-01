/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Search, MessageCircle, UserCircle2, Loader2, Users, MessagesSquare, MoreVertical, Trash2 } from 'lucide-react';
import { useInternalChat } from '@/contexts/InternalChatContext';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ConfirmModal from '@/components/ui/ConfirmModal';

type Tab = 'conversas' | 'equipe';

export default function ConversationList() {
  const { user } = useAuth();
  const {
    conversations,
    users,
    onlineUserIds,
    totalUnread,
    loadingUsers,
    openConversation,
    startConversationWith,
    markAsRead,
    deleteConversation,
    setIsOpen,
    refreshUsers,
    isUserOnline,
  } = useInternalChat();

  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('conversas');
  const [startingChat, setStartingChat] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on click outside
  useEffect(() => {
    if (!menuOpenId) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpenId]);

  function handleTabChange(tab: Tab) {
    setActiveTab(tab);
    setSearch('');
    if (tab === 'equipe') void refreshUsers();
  }

  const filteredConversations = conversations.filter((conv) => {
    if (!search) return true;
    const name = resolveConvName(conv);
    return name.toLowerCase().includes(search.toLowerCase());
  });

  const filteredUsers = users.filter((u) =>
    u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    const aOnline = isUserOnline(a.id);
    const bOnline = isUserOnline(b.id);
    if (aOnline && !bOnline) return -1;
    if (!aOnline && bOnline) return 1;
    return (a.full_name || '').localeCompare(b.full_name || '');
  });

  // ── Helper: resolve name from participant profile OR users list fallback ──
  function resolveConvName(conv: typeof conversations[0]): string {
    const other = conv.participants?.find((p) => p.user_id !== user?.id);
    if (other?.profile?.full_name) return other.profile.full_name;
    // Fallback: find in users list
    const fromList = users.find((u) => u.id === other?.user_id);
    return fromList?.full_name || 'Usuario';
  }

  function resolveConvUserId(conv: typeof conversations[0]): string {
    const other = conv.participants?.find((p) => p.user_id !== user?.id);
    return other?.user_id || '';
  }

  function resolveConvRole(conv: typeof conversations[0]): string {
    const other = conv.participants?.find((p) => p.user_id !== user?.id);
    if (other?.profile?.role) return other.profile.role;
    const fromList = users.find((u) => u.id === other?.user_id);
    return fromList?.role || '';
  }

  function getInitials(name: string): string {
    return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  }

  function getRoleBadge(role: string) {
    if (role === 'admin') return { label: 'Admin', color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' };
    if (role === 'secretary') return { label: 'Sec.', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' };
    return { label: role, color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' };
  }

  function truncateMessage(text: string, maxLen = 38): string {
    if (!text) return '';
    return text.length > maxLen ? text.slice(0, maxLen) + '...' : text;
  }

  async function handleOpenConversation(convId: string) {
    openConversation(convId);
    await markAsRead(convId);
  }

  async function handleStartChat(targetUserId: string) {
    setStartingChat(true);
    const convId = await startConversationWith(targetUserId);
    setStartingChat(false);
    if (!convId) {
      alert('Erro ao iniciar conversa. Verifique o console (F12) para detalhes.');
      return;
    }
    setActiveTab('conversas');
    setSearch('');
  }

  function handleDeleteClick(convId: string, convName: string) {
    setMenuOpenId(null);
    setDeleteTarget({ id: convId, name: convName });
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    await deleteConversation(deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
  }

  const onlineCount = onlineUserIds.size > 0 ? onlineUserIds.size - 1 : 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-[#1e1e24] shrink-0">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-[#e4e4e7]">
          Chat Interno
        </h3>
        <button
          onClick={() => setIsOpen(false)}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors text-slate-400 dark:text-[#71717a] text-sm leading-none font-medium"
        >
          ✕
        </button>
      </div>

      {/* Tab Switcher */}
      <div className="px-3 pt-2 pb-1 shrink-0">
        <div className="flex bg-slate-100 dark:bg-[#0a0a0d] rounded-xl p-1 gap-1">
          <button
            onClick={() => handleTabChange('conversas')}
            className={`
              flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-[13px] font-semibold
              transition-all duration-200
              ${activeTab === 'conversas'
                ? 'bg-white dark:bg-[#1c1c21] text-slate-800 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-[#71717a] hover:text-slate-700 dark:hover:text-[#a1a1aa]'
              }
            `}
          >
            <MessagesSquare className="w-4 h-4" />
            Conversas
            {totalUnread > 0 && (
              <span className="min-w-[18px] h-[18px] px-1 bg-pink-500 dark:bg-sky-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {totalUnread > 99 ? '99+' : totalUnread}
              </span>
            )}
          </button>
          <button
            onClick={() => handleTabChange('equipe')}
            className={`
              flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-[13px] font-semibold
              transition-all duration-200
              ${activeTab === 'equipe'
                ? 'bg-white dark:bg-[#1c1c21] text-slate-800 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-[#71717a] hover:text-slate-700 dark:hover:text-[#a1a1aa]'
              }
            `}
          >
            <Users className="w-4 h-4" />
            Equipe
            {onlineCount > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                {onlineCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2 shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-[#52525b]" />
          <input
            type="text"
            placeholder={activeTab === 'equipe' ? 'Buscar pessoa...' : 'Buscar conversa...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="
              w-full pl-9 pr-3 py-2 text-sm rounded-xl
              bg-slate-50 dark:bg-[#0a0a0d]
              text-slate-800 dark:text-[#e4e4e7]
              placeholder:text-slate-400 dark:placeholder:text-[#52525b]
              border border-slate-200 dark:border-[#1e1e24]
              focus:border-pink-300 dark:focus:border-sky-500/50 focus:outline-none
              focus:ring-2 focus:ring-pink-100 dark:focus:ring-sky-500/10
              transition-all
            "
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {activeTab === 'equipe' ? (
          /* ── Team user list ──────────────────────────────────────────── */
          <div className="px-2 py-1">
            {loadingUsers ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2 text-slate-400 dark:text-[#52525b]">
                <Loader2 className="w-5 h-5 animate-spin" />
                <p className="text-xs">Carregando equipe...</p>
              </div>
            ) : sortedUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2 text-slate-400 dark:text-[#52525b]">
                <UserCircle2 className="w-10 h-10 opacity-40" />
                <p className="text-sm">Nenhum usuario encontrado</p>
              </div>
            ) : (
              sortedUsers.map((u) => {
                const badge = getRoleBadge(u.role);
                const online = isUserOnline(u.id);
                return (
                  <button
                    key={u.id}
                    onClick={() => handleStartChat(u.id)}
                    disabled={startingChat}
                    className="
                      w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
                      hover:bg-slate-50 dark:hover:bg-white/[0.03]
                      active:bg-slate-100 dark:active:bg-white/[0.06]
                      transition-colors text-left group
                      disabled:opacity-50 disabled:pointer-events-none
                    "
                  >
                    <div className="relative shrink-0">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-rose-400 dark:from-sky-400 dark:to-blue-500 flex items-center justify-center text-white text-sm font-semibold overflow-hidden">
                        {u.photo_url ? (
                          <img src={u.photo_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          getInitials(u.full_name || u.email)
                        )}
                      </div>
                      <div className={`
                        absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-[#111114]
                        ${online ? 'bg-emerald-400' : 'bg-slate-300 dark:bg-[#3f3f46]'}
                      `} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-700 dark:text-[#d4d4d8] truncate group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                          {u.full_name || u.email}
                        </span>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${badge.color}`}>
                          {badge.label}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 dark:text-[#52525b] truncate">
                        {online ? 'Online agora' : 'Offline'}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        ) : (
          /* ── Conversation list ────────────────────────────────────────── */
          <div className="px-2 py-1">
            {filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400 dark:text-[#52525b]">
                <div className="w-14 h-14 rounded-2xl bg-slate-50 dark:bg-[#1c1c21] flex items-center justify-center">
                  <MessageCircle className="w-7 h-7 opacity-40" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-500 dark:text-[#71717a]">Nenhuma conversa</p>
                  <p className="text-xs mt-0.5">Inicie uma conversa com sua equipe</p>
                </div>
                <button
                  onClick={() => handleTabChange('equipe')}
                  className="text-xs font-medium text-pink-500 dark:text-sky-400 hover:underline mt-1"
                >
                  Ver equipe
                </button>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const name = resolveConvName(conv);
                const otherId = resolveConvUserId(conv);
                const role = resolveConvRole(conv);
                const badge = getRoleBadge(role);
                const hasUnread = (conv.unread_count || 0) > 0;
                const lastMsg = conv.last_message;
                const online = isUserOnline(otherId);

                let preview = '';
                if (lastMsg) {
                  if (lastMsg.message_type === 'text') {
                    preview = truncateMessage(lastMsg.content);
                  } else if (lastMsg.message_type === 'image') {
                    preview = 'Imagem';
                  } else if (lastMsg.message_type === 'video') {
                    preview = 'Video';
                  } else if (lastMsg.message_type === 'audio') {
                    preview = 'Audio';
                  } else if (lastMsg.message_type === 'document') {
                    preview = lastMsg.file_name || 'Documento';
                  }
                  if (lastMsg.sender_id === user?.id) {
                    preview = 'Voce: ' + preview;
                  }
                }

                return (
                  <div
                    key={conv.id}
                    className={`
                      relative flex items-center gap-3 px-3 py-3 rounded-xl
                      transition-all text-left group
                      ${hasUnread
                        ? 'bg-pink-50/60 dark:bg-sky-500/[0.06] hover:bg-pink-50 dark:hover:bg-sky-500/[0.1]'
                        : 'hover:bg-slate-50 dark:hover:bg-white/[0.03]'
                      }
                    `}
                  >
                    {/* Clickable area */}
                    <button
                      onClick={() => handleOpenConversation(conv.id)}
                      className="absolute inset-0 z-0"
                      aria-label={`Abrir conversa com ${name}`}
                    />

                    {/* Avatar */}
                    <div className="relative shrink-0 z-[1] pointer-events-none">
                      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-pink-400 to-rose-400 dark:from-sky-400 dark:to-blue-500 flex items-center justify-center text-white text-sm font-semibold">
                        {getInitials(name)}
                      </div>
                      <div className={`
                        absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-[#111114]
                        transition-colors
                        ${online ? 'bg-emerald-400' : 'bg-slate-300 dark:bg-[#3f3f46]'}
                      `} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 z-[1] pointer-events-none">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`text-sm truncate transition-colors ${
                            hasUnread
                              ? 'font-bold text-slate-900 dark:text-white'
                              : 'font-medium text-slate-700 dark:text-[#d4d4d8]'
                          }`}>
                            {name}
                          </span>
                          {role && (
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${badge.color}`}>
                              {badge.label}
                            </span>
                          )}
                        </div>
                        {lastMsg && (
                          <span className="text-[10px] text-slate-400 dark:text-[#52525b] shrink-0 ml-2">
                            {formatDistanceToNow(new Date(lastMsg.created_at), {
                              addSuffix: false,
                              locale: ptBR,
                            })}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <p className={`text-xs truncate ${
                          hasUnread
                            ? 'text-slate-700 dark:text-[#d4d4d8] font-medium'
                            : 'text-slate-400 dark:text-[#52525b]'
                        }`}>
                          {preview || 'Conversa iniciada'}
                        </p>
                        {hasUnread && (
                          <span className="
                            min-w-[20px] h-5 px-1.5 ml-2
                            bg-pink-500 dark:bg-sky-500 text-white text-[11px] font-bold
                            rounded-full flex items-center justify-center shrink-0
                          ">
                            {conv.unread_count}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 3-dot menu */}
                    <div className="relative z-[2] shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpenId(menuOpenId === conv.id ? null : conv.id);
                        }}
                        className="
                          p-1 rounded-lg
                          opacity-0 group-hover:opacity-100 focus:opacity-100
                          hover:bg-slate-200/70 dark:hover:bg-white/10
                          transition-all
                        "
                      >
                        <MoreVertical className="w-4 h-4 text-slate-400 dark:text-[#71717a]" />
                      </button>

                      {menuOpenId === conv.id && (
                        <div
                          ref={menuRef}
                          className="
                            absolute right-0 top-8 z-50
                            bg-white dark:bg-[#1c1c21]
                            rounded-xl shadow-xl border border-slate-200 dark:border-[#2a2a30]
                            py-1 w-44 overflow-hidden
                          "
                          style={{ animation: 'chatPanelIn 0.15s ease-out' }}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClick(conv.id, name);
                            }}
                            className="
                              w-full flex items-center gap-2.5 px-3 py-2 text-sm
                              text-red-600 dark:text-red-400
                              hover:bg-red-50 dark:hover:bg-red-900/10
                              transition-colors
                            "
                          >
                            <Trash2 className="w-4 h-4" />
                            Apagar conversa
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Apagar conversa"
        message={`Tem certeza que deseja apagar a conversa com ${deleteTarget?.name || ''}? Todas as mensagens serao perdidas permanentemente.`}
        type="danger"
        confirmText="Apagar"
        cancelText="Cancelar"
        isLoading={deleting}
      />
    </div>
  );
}
