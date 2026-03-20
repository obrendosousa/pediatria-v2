'use client';

import React, { useState } from 'react';
import { Search, Plus, MessageCircle, UserCircle2, Loader2 } from 'lucide-react';
import { useInternalChat } from '@/contexts/InternalChatContext';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function ConversationList() {
  const { user } = useAuth();
  const {
    conversations,
    users,
    loadingUsers,
    openConversation,
    startConversationWith,
    markAsRead,
    setIsOpen,
    refreshUsers,
  } = useInternalChat();

  const [search, setSearch] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);

  function handleShowNewChat() {
    const next = !showNewChat;
    setShowNewChat(next);
    setSearch('');
    if (next) void refreshUsers();
  }

  const filteredConversations = conversations.filter((conv) => {
    if (!search) return true;
    const otherParticipant = conv.participants?.find((p) => p.user_id !== user?.id);
    const name = otherParticipant?.profile?.full_name || '';
    return name.toLowerCase().includes(search.toLowerCase());
  });

  const filteredUsers = users.filter((u) =>
    u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  function getOtherParticipantName(conv: typeof conversations[0]): string {
    const other = conv.participants?.find((p) => p.user_id !== user?.id);
    return other?.profile?.full_name || 'Usuário';
  }

  function getOtherParticipantRole(conv: typeof conversations[0]): string {
    const other = conv.participants?.find((p) => p.user_id !== user?.id);
    return other?.profile?.role || '';
  }

  function getInitials(name: string): string {
    return name
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
  }

  function getRoleBadge(role: string) {
    if (role === 'admin') return { label: 'Dra.', color: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300' };
    if (role === 'secretary') return { label: 'Sec.', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' };
    return { label: role, color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' };
  }

  function truncateMessage(text: string, maxLen = 40): string {
    if (!text) return '';
    return text.length > maxLen ? text.slice(0, maxLen) + '…' : text;
  }

  async function handleOpenConversation(convId: string) {
    openConversation(convId);
    await markAsRead(convId);
  }

  async function handleStartChat(targetUserId: string) {
    await startConversationWith(targetUserId);
    setShowNewChat(false);
    setSearch('');
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[rgb(var(--border))] dark:border-[#2d2d36]">
        <h3 className="text-base font-semibold text-[rgb(var(--foreground))]">
          Chat Interno
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={handleShowNewChat}
            className="p-1.5 rounded-lg hover:bg-[rgb(var(--muted))] dark:hover:bg-[#1c1c21] transition-colors"
            title="Nova conversa"
          >
            <Plus className="w-5 h-5 text-[rgb(var(--muted-foreground))]" />
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded-lg hover:bg-[rgb(var(--muted))] dark:hover:bg-[#1c1c21] transition-colors text-[rgb(var(--muted-foreground))] text-lg leading-none"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[rgb(var(--muted-foreground))]" />
          <input
            type="text"
            placeholder={showNewChat ? 'Buscar pessoa...' : 'Buscar conversa...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="
              w-full pl-9 pr-3 py-2 text-sm rounded-xl
              bg-[rgb(var(--muted))] dark:bg-[#0e0e11]
              text-[rgb(var(--foreground))]
              placeholder:text-[rgb(var(--muted-foreground))]
              border border-transparent
              focus:border-[rgb(var(--primary))] focus:outline-none
              transition-colors
            "
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {showNewChat ? (
          /* New conversation - user list */
          <div className="px-2 py-1">
            <p className="px-3 py-1.5 text-xs font-medium text-[rgb(var(--muted-foreground))] uppercase tracking-wider">
              Iniciar conversa com
            </p>
            {loadingUsers ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2 text-[rgb(var(--muted-foreground))]">
                <Loader2 className="w-6 h-6 animate-spin" />
                <p className="text-sm">Carregando equipe...</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2 text-[rgb(var(--muted-foreground))]">
                <UserCircle2 className="w-10 h-10 opacity-40" />
                <p className="text-sm">Nenhum usuário encontrado</p>
              </div>
            ) : (
              filteredUsers.map((u) => {
                const badge = getRoleBadge(u.role);
                return (
                  <button
                    key={u.id}
                    onClick={() => handleStartChat(u.id)}
                    className="
                      w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
                      hover:bg-[rgb(var(--muted))] dark:hover:bg-[#1c1c21]
                      transition-colors text-left
                    "
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-rose-400 dark:from-sky-400 dark:to-blue-500 flex items-center justify-center text-white text-sm font-semibold shrink-0">
                      {getInitials(u.full_name || u.email)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[rgb(var(--foreground))] truncate">
                          {u.full_name || u.email}
                        </span>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${badge.color}`}>
                          {badge.label}
                        </span>
                      </div>
                      <p className="text-xs text-[rgb(var(--muted-foreground))] truncate">{u.email}</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        ) : (
          /* Conversation list */
          <div className="px-2 py-1">
            {filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-[rgb(var(--muted-foreground))]">
                <MessageCircle className="w-12 h-12 opacity-30" />
                <p className="text-sm font-medium">Nenhuma conversa ainda</p>
                <button
                  onClick={handleShowNewChat}
                  className="text-xs text-[rgb(var(--primary))] hover:underline"
                >
                  Iniciar uma conversa
                </button>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const name = getOtherParticipantName(conv);
                const role = getOtherParticipantRole(conv);
                const badge = getRoleBadge(role);
                const hasUnread = (conv.unread_count || 0) > 0;
                const lastMsg = conv.last_message;

                let preview = '';
                if (lastMsg) {
                  if (lastMsg.message_type === 'text') {
                    preview = truncateMessage(lastMsg.content);
                  } else if (lastMsg.message_type === 'image') {
                    preview = '📷 Imagem';
                  } else if (lastMsg.message_type === 'video') {
                    preview = '🎥 Vídeo';
                  } else if (lastMsg.message_type === 'audio') {
                    preview = '🎵 Áudio';
                  } else if (lastMsg.message_type === 'document') {
                    preview = '📄 ' + (lastMsg.file_name || 'Documento');
                  }
                  if (lastMsg.sender_id === user?.id) {
                    preview = 'Você: ' + preview;
                  }
                }

                return (
                  <button
                    key={conv.id}
                    onClick={() => handleOpenConversation(conv.id)}
                    className={`
                      w-full flex items-center gap-3 px-3 py-3 rounded-xl
                      hover:bg-[rgb(var(--muted))] dark:hover:bg-[#1c1c21]
                      transition-colors text-left
                      ${hasUnread ? 'bg-[rgb(var(--primary))]/5 dark:bg-[rgb(var(--primary))]/10' : ''}
                    `}
                  >
                    {/* Avatar */}
                    <div className="relative shrink-0">
                      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-pink-400 to-rose-400 dark:from-sky-400 dark:to-blue-500 flex items-center justify-center text-white text-sm font-semibold">
                        {getInitials(name)}
                      </div>
                      {/* Online indicator */}
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[rgb(var(--card))] dark:border-[#131316]" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`text-sm truncate ${hasUnread ? 'font-bold text-[rgb(var(--foreground))]' : 'font-medium text-[rgb(var(--foreground))]'}`}>
                            {name}
                          </span>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${badge.color}`}>
                            {badge.label}
                          </span>
                        </div>
                        {lastMsg && (
                          <span className="text-[11px] text-[rgb(var(--muted-foreground))] shrink-0 ml-2">
                            {formatDistanceToNow(new Date(lastMsg.created_at), {
                              addSuffix: false,
                              locale: ptBR,
                            })}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <p className={`text-xs truncate ${hasUnread ? 'text-[rgb(var(--foreground))] font-medium' : 'text-[rgb(var(--muted-foreground))]'}`}>
                          {preview || 'Conversa iniciada'}
                        </p>
                        {hasUnread && (
                          <span className="
                            min-w-[20px] h-5 px-1.5 ml-2
                            bg-[rgb(var(--primary))] text-white text-[11px] font-bold
                            rounded-full flex items-center justify-center shrink-0
                          ">
                            {conv.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
