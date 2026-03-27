'use client';

import { useState, useEffect, useRef } from 'react';
import { LogOut, Moon, Sun, User, ChevronDown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import ProfilePopover from './ProfilePopover';

export default function TopBar() {
  const { signOut, profile } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileBtnRef = useRef<HTMLButtonElement>(null);

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

  return (
    <div className="h-12 shrink-0 w-full bg-white dark:bg-[#0f0f14] border-b border-slate-200 dark:border-[#1c1c24] flex items-center justify-between px-4 z-30 print:hidden">
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

        {/* Separador */}
        <div className="w-px h-6 bg-slate-200 dark:bg-[#2d2d36] mx-1" />

        {/* Perfil + Sair */}
        <div className="relative flex items-center">
          <button
            ref={profileBtnRef}
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer group"
          >
            <div className="w-7 h-7 rounded-full overflow-hidden bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center shrink-0 ring-1 ring-slate-200 dark:ring-[#2d2d36]">
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
