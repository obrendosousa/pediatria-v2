'use client';

import { useState, useEffect, useRef } from 'react';
import { LogOut, Moon, Sun, User, ChevronDown, MessageCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useInternalChat } from '@/contexts/InternalChatContext';
import ProfilePopover from './ProfilePopover';
import NotificationBell from './NotificationBell';
import InternalChatPanel from './internal-chat/InternalChatPanel';

export default function TopBar() {
  const { signOut, profile } = useAuth();
  const { totalUnread, isOpen, toggleOpen, onlineUserIds } = useInternalChat();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileBtnRef = useRef<HTMLButtonElement>(null);
  const chatBtnRef = useRef<HTMLButtonElement>(null);

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

  // Online count (excluding self)
  const onlineCount = onlineUserIds.size > 0 ? onlineUserIds.size - 1 : 0;

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

        {/* Chat Interno */}
        <div className="relative">
          <button
            ref={chatBtnRef}
            onClick={toggleOpen}
            className={`
              relative p-2 rounded-lg transition-colors cursor-pointer
              ${isOpen
                ? 'bg-gradient-to-br from-pink-500/10 to-rose-500/10 dark:from-sky-500/10 dark:to-blue-600/10'
                : 'hover:bg-slate-100 dark:hover:bg-white/5'
              }
            `}
            title={`Chat Interno${onlineCount > 0 ? ` (${onlineCount} online)` : ''}`}
          >
            <MessageCircle className={`w-[18px] h-[18px] transition-colors ${
              isOpen
                ? 'text-pink-500 dark:text-sky-400'
                : 'text-slate-500 dark:text-[#a1a1aa]'
            }`} />

            {/* Unread badge */}
            {totalUnread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-bounce-once">
                {totalUnread > 99 ? '99+' : totalUnread}
              </span>
            )}

            {/* Online dot indicator */}
            {totalUnread === 0 && onlineCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-emerald-400 rounded-full ring-2 ring-white dark:ring-[#0c0c10]" />
            )}
          </button>

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
