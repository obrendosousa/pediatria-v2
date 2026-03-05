'use client';

import React, { createContext, useContext } from 'react';
import type { ModuleConfig } from '@/config/modules';

type ModuleContextType = {
  config: ModuleConfig;
};

const ModuleContext = createContext<ModuleContextType | undefined>(undefined);

export function ModuleProvider({
  config,
  children,
}: {
  config: ModuleConfig;
  children: React.ReactNode;
}) {
  return (
    <ModuleContext.Provider value={{ config }}>
      {children}
    </ModuleContext.Provider>
  );
}

export function useModule(): ModuleContextType {
  const context = useContext(ModuleContext);
  if (!context) {
    throw new Error('useModule deve ser usado dentro de um ModuleProvider');
  }
  return context;
}

// Hook seguro que retorna undefined se fora do provider (para componentes compartilhados)
export function useModuleSafe(): ModuleContextType | undefined {
  return useContext(ModuleContext);
}
