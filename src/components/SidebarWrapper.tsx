'use client';

import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';

export default function SidebarWrapper({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  
  // Se estiver na rota do scanner, esconde a barra de navegação (retorna null)
  if (pathname?.includes('/scanner')) {
    return null;
  }

  // Se não, retorna os filhos (Navigation) normalmente
  return <>{children}</>;
}