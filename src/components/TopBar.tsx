'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { LogOut, Moon, Sun, User, ChevronDown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useInternalChat } from '@/contexts/InternalChatContext';
import ProfilePopover from './ProfilePopover';
import NotificationBell from './NotificationBell';
import InternalChatPanel from './internal-chat/InternalChatPanel';
import { MessageDock, type Character } from './ui/message-dock';
import { useImageCache } from '@/hooks/useImageCache';

export default function TopBar() {
  const { signOut, profile } = useAuth();
  const {
    totalUnread, isOpen, toggleOpen, onlineUserIds,
    users, conversations, startConversationWith, sendMessage,
  } = useInternalChat();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileBtnRef = useRef<HTMLButtonElement>(null);
  const chatBtnRef = useRef<HTMLDivElement>(null);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light';
    const saved = localStorage.getItem('theme');
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return saved === 'dark' || (!saved && systemDark) ? 'dark' : 'light';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
    localStorage.setItem('theme', newTheme);
  };

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  // Build characters: 4 most recent chats first, then online fallback, then offline
  const characters = useMemo<Character[]>(() => {
    const selfId = profile?.id;
    const teamUsers = users.filter(u => u.id !== selfId && u.full_name);

    // Get partner user IDs from conversations sorted by most recent activity
    const recentPartnerIds: string[] = [];
    const sortedConvs = [...conversations].sort((a, b) => {
      const aTime = a.last_message?.created_at || a.updated_at || a.created_at;
      const bTime = b.last_message?.created_at || b.updated_at || b.created_at;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });

    for (const conv of sortedConvs) {
      const other = conv.participants?.find(p => p.user_id !== selfId);
      if (other?.user_id && !recentPartnerIds.includes(other.user_id)) {
        recentPartnerIds.push(other.user_id);
      }
      if (recentPartnerIds.length >= 4) break;
    }

    // Build ordered list: recent chats first
    const picked = new Set<string>();
    const ordered: typeof teamUsers = [];

    // 1. Recent conversations
    for (const id of recentPartnerIds) {
      const u = teamUsers.find(t => t.id === id);
      if (u) { ordered.push(u); picked.add(id); }
    }

    // 2. Fallback: online users not yet picked
    if (ordered.length < 4) {
      const onlineUsers = teamUsers
        .filter(u => !picked.has(u.id) && onlineUserIds.has(u.id));
      for (const u of onlineUsers) {
        if (ordered.length >= 4) break;
        ordered.push(u); picked.add(u.id);
      }
    }

    // 3. Fallback: offline users not yet picked
    if (ordered.length < 4) {
      const offlineUsers = teamUsers
        .filter(u => !picked.has(u.id) && !onlineUserIds.has(u.id));
      for (const u of offlineUsers) {
        if (ordered.length >= 4) break;
        ordered.push(u); picked.add(u.id);
      }
    }

    return ordered.map(u => ({
      id: u.id,
      name: u.full_name || u.email,
      online: onlineUserIds.has(u.id),
      avatar: u.photo_url || undefined,
      emoji: u.full_name ? u.full_name[0].toUpperCase() : '?',
      backgroundColor: 'bg-gradient-to-br from-pink-400 to-rose-400 dark:from-sky-400 dark:to-blue-500',
      gradientColors: '#fb7185, #fecdd3',
    }));
  }, [users, profile?.id, onlineUserIds, conversations]);

  // Pre-load avatar images into browser cache
  useImageCache(characters.map(c => c.avatar));

  const handleMessageSend = useCallback(async (message: string, character: Character) => {
    if (!character.id) return;
    await startConversationWith(character.id as string);
    await sendMessage(message);
  }, [startConversationWith, sendMessage]);

  const handleCharacterSelect = useCallback((character: Character) => {
    if (!character.id) return;
    startConversationWith(character.id as string);
  }, [startConversationWith]);

  const handleMenuClick = useCallback(() => {
    toggleOpen();
  }, [toggleOpen]);

  return (
    <div className="h-12 shrink-0 w-full bg-white dark:bg-[#0c0c10] border-b border-slate-200 dark:border-[#1a1a1f] flex items-center justify-between px-4 z-30 print:hidden">
      {/* Lado esquerdo */}
      <div />

      {/* Lado direito */}
      <div className="flex items-center gap-1">
        {/* Toggle tema */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
          title={theme === 'light' ? 'Modo Escuro' : 'Modo Claro'}
        >
          {theme === 'light' ? (
            <Sun className="w-[18px] h-[18px] text-amber-500" />
          ) : (
            <Moon className="w-[18px] h-[18px] text-blue-400" />
          )}
        </button>

        {/* Notificacoes */}
        <NotificationBell />

        {/* Chat Interno - MessageDock do 21st.dev */}
        <div className="relative" ref={chatBtnRef}>
          <MessageDock
            characters={characters}
            onMessageSend={handleMessageSend}
            onCharacterSelect={handleCharacterSelect}
            onMenuClick={handleMenuClick}
            expandedWidth={320}
            placeholder={(name) => `Msg para ${name}...`}
            theme={theme}
            unreadCount={totalUnread}
            closeOnSend
          />

          {/* Chat Panel Dropdown */}
          {isOpen && <InternalChatPanel anchorRef={chatBtnRef} />}
        </div>

        {/* Separador */}
        <div className="w-px h-6 bg-slate-200 dark:bg-[#2a2a30] mx-1" />

        {/* Perfil + Sair */}
        <div className="relative flex items-center">
          <button
            ref={profileBtnRef}
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer group"
          >
            <div className="w-7 h-7 rounded-full overflow-hidden bg-gradient-to-br from-violet-500 to-rose-400 flex items-center justify-center shrink-0 ring-1 ring-slate-200 dark:ring-[#2a2a30]">
              {profile?.photo_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={profile.photo_url} alt="Foto" className="w-full h-full object-cover" />
              ) : (
                profile?.full_name ? (
                  <span className="text-[10px] font-bold text-white">{initials}</span>
                ) : (
                  <User className="w-3.5 h-3.5 text-white/70" />
                )
              )}
            </div>
            <span className="text-sm font-medium text-slate-700 dark:text-[#d4d4d8] max-w-[120px] truncate hidden sm:block">
              {profile?.full_name || 'Perfil'}
            </span>
            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 dark:text-[#71717a] transition-transform ${isProfileOpen ? 'rotate-180' : ''}`} />
          </button>

          <ProfilePopover
            isOpen={isProfileOpen}
            onClose={() => setIsProfileOpen(false)}
            anchorRef={profileBtnRef}
          />
        </div>

        {/* Botão Sair */}
        <button
          onClick={() => signOut()}
          className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors cursor-pointer group"
          title="Sair"
        >
          <LogOut className="w-[18px] h-[18px] text-slate-400 dark:text-[#71717a] group-hover:text-red-500" />
        </button>
      </div>
    </div>
  );
}
