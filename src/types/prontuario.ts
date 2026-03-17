import React from 'react';

export type ProntuarioTabKey =
  | 'historico'
  | 'anamneses'
  | 'alergias'
  | 'evolucoes'
  | 'receitas'
  | 'memed'
  | 'atestados'
  | 'laudos'
  | 'exames-pedidos'
  | 'exames-resultados'
  | 'support-lab'
  | 'planos'
  | 'anexos'
  | 'dietas'
  | 'cids'
  | 'galeria'
  | 'documentos';

export interface ProntuarioScreenProps {
  patientId: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  patientData: any;
  onRefresh?: () => void;
}

export type ProntuarioSidebarEntry =
  | { type: 'section'; label: string }
  | { type: 'item'; key: ProntuarioTabKey; label: string; icon: React.ElementType }
  | { type: 'submenu'; label: string; icon: React.ElementType; children: { key: ProntuarioTabKey; label: string; icon: React.ElementType }[] };

export interface ProntuarioModuleConfig {
  defaultTab: ProntuarioTabKey;
  sidebar: ProntuarioSidebarEntry[];
  screens: Partial<Record<ProntuarioTabKey, React.ComponentType<ProntuarioScreenProps>>>;
}
