'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { SidebarProvider } from '@/contexts/SidebarContext';
import Navigation from '@/components/Navigation';
import SidebarWrapper from '@/components/SidebarWrapper';

const AUTH_PATHS = ['/login', '/signup', '/recuperar-senha', '/aguardando-aprovacao'];

export default function AuthLayoutGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, loading } = useAuth();

  const lastRedirectRef = useRef<string | null>(null);
  const [canRedirectToLogin, setCanRedirectToLogin] = useState(false);

  const isAuthPath = AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));

  const replaceOnce = useCallback((targetPath: string) => {
    if (!pathname || pathname === targetPath) return;
    const redirectKey = `${pathname}->${targetPath}`;
    if (lastRedirectRef.current === redirectKey) return;
    lastRedirectRef.current = redirectKey;
    router.replace(targetPath);
  }, [pathname, router]);

  useEffect(() => {
    lastRedirectRef.current = null;
  }, [pathname]);

  useEffect(() => {
    if (loading || user) {
      setCanRedirectToLogin(false);
      return;
    }
    const timer = window.setTimeout(() => setCanRedirectToLogin(true), 150);
    return () => window.clearTimeout(timer);
  }, [loading, user]);

  useEffect(() => {
    if (loading) return;
    if (!pathname) return;

    if (!isAuthPath) {
      if (!user && canRedirectToLogin) {
        replaceOnce('/login');
        return;
      }
      if (user && profile?.status === 'pending') {
        replaceOnce('/aguardando-aprovacao');
      }
    } else {
      if (user && pathname === '/login') {
        replaceOnce('/dashboard');
      }
    }
  }, [user, profile, loading, isAuthPath, pathname, replaceOnce, canRedirectToLogin]);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[rgb(var(--background))]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-pink-400 border-t-transparent" />
          <p className="text-sm text-slate-500 dark:text-gray-400">Carregando...</p>
        </div>
      </div>
    );
  }

  // Previne "flash" de conteúdo protegido antes do redirect acontecer
  if (!isAuthPath && !user) return null;

  // Se for rota de auth, renderiza limpo (sem sidebar)
  if (isAuthPath) {
    return <>{children}</>;
  }

  // Se pendente, não mostra sidebar
  if (profile?.status === 'pending') return null;

  // Renderização da Aplicação Protegida
  return (
    <SidebarProvider>
      <div className="flex h-screen w-full min-w-0 transition-colors duration-500 print:block print:h-auto print:bg-white">
        <SidebarWrapper>
          <Navigation />
        </SidebarWrapper>
        <main className="flex-1 min-w-0 overflow-hidden relative w-full h-full transition-all duration-500 ease-in-out print:overflow-visible print:h-auto">
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}