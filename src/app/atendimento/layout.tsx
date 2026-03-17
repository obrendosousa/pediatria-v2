'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ModuleProvider } from '@/contexts/ModuleContext';
import { ATENDIMENTO_CONFIG } from '@/config/modules';

export default function AtendimentoLayout({ children }: { children: React.ReactNode }) {
  const { modules, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const contentRef = useRef<HTMLDivElement>(null);
  const prevPathRef = useRef(pathname);

  const hasAccess = useMemo(() => {
    if (loading) return null;
    return modules.some(m => m.module === 'atendimento');
  }, [modules, loading]);

  useEffect(() => {
    if (hasAccess === false) {
      router.replace('/dashboard?error=no_access');
    }
  }, [hasAccess, router]);

  // Page transition on route change — uses ref to avoid setState in effect
  useEffect(() => {
    if (pathname === prevPathRef.current) return;
    prevPathRef.current = pathname;
    const el = contentRef.current;
    if (!el) return;
    el.classList.remove('page-transition');
    // Force reflow to restart animation
    void el.offsetWidth;
    el.classList.add('page-transition');
    const timer = setTimeout(() => el.classList.remove('page-transition'), 350);
    return () => clearTimeout(timer);
  }, [pathname]);

  // Carregando ou verificando acesso
  if (loading || hasAccess === null) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
          <p className="text-sm text-slate-500 dark:text-[#a1a1aa]">Carregando módulo...</p>
        </div>
      </div>
    );
  }

  // Sem acesso — aguardando redirect
  if (!hasAccess) return null;

  return (
    <ModuleProvider config={ATENDIMENTO_CONFIG}>
      <div className="module-atendimento contents">
        <div ref={contentRef} className="w-full h-full">
          {children}
        </div>
      </div>
    </ModuleProvider>
  );
}
