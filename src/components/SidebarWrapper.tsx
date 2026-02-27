'use client';

import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';

export default function SidebarWrapper({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // Se estiver na rota do scanner, esconde a barra de navegação (retorna null)
  if (pathname?.includes('/scanner')) {
    return null;
  }

  // Wrapper com shrink-0 para evitar que Navigation encolha e sobreponha outros elementos
  return <div className="shrink-0 print:hidden">{children}</div>;
}