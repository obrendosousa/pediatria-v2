'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ModuleProvider } from '@/contexts/ModuleContext';
import { ATENDIMENTO_CONFIG } from '@/config/modules';

export default function AtendimentoLayout({ children }: { children: React.ReactNode }) {
  const { modules, loading } = useAuth();
  const router = useRouter();
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);

  useEffect(() => {
    if (loading) return;

    const access = modules.some(m => m.module === 'atendimento');
    setHasAccess(access);

    if (!access) {
      router.replace('/dashboard?error=no_access');
    }
  }, [modules, loading, router]);

  // Carregando ou verificando acesso
  if (loading || hasAccess === null) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-400 border-t-transparent" />
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
        {children}
      </div>
    </ModuleProvider>
  );
}
