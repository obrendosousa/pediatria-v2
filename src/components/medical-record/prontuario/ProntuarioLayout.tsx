'use client';

import React, { useState, useCallback } from 'react';
import { ProntuarioTabKey, ProntuarioScreenProps, ProntuarioModuleConfig } from '@/types/prontuario';
import { ProntuarioSidebar } from './ProntuarioSidebar';

interface ProntuarioLayoutProps {
  patientId: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  patientData: any;
  onRefresh?: () => void;
  config: ProntuarioModuleConfig;
}

export function ProntuarioLayout({ patientId, patientData, onRefresh, config }: ProntuarioLayoutProps) {
  const [activeTab, setActiveTab] = useState<ProntuarioTabKey>(config.defaultTab);
  const [visitedTabs, setVisitedTabs] = useState<Set<ProntuarioTabKey>>(new Set([config.defaultTab]));

  const handleTabChange = useCallback((tab: ProntuarioTabKey) => {
    setActiveTab(tab);
    setVisitedTabs(prev => {
      if (prev.has(tab)) return prev;
      return new Set([...prev, tab]);
    });
  }, []);

  const screenComponents = config.screens as Record<ProntuarioTabKey, React.ComponentType<ProntuarioScreenProps>>;

  return (
    <div className="flex flex-1 h-full bg-[#f8f9fb] dark:bg-[#08080b]">
      <ProntuarioSidebar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        sidebarItems={config.sidebar}
      />

      {/* Content area */}
      <div className="flex-1 min-w-0 overflow-y-auto custom-scrollbar bg-[#f4f5f7] dark:bg-[#08080b]">
        {(Object.keys(screenComponents) as ProntuarioTabKey[]).map((tabKey) => {
          if (!visitedTabs.has(tabKey)) return null;
          const ScreenComponent = screenComponents[tabKey];
          if (!ScreenComponent) return null;
          return (
            <div
              key={tabKey}
              style={{ display: activeTab === tabKey ? 'block' : 'none' }}
              className="h-full"
            >
              <ScreenComponent
                patientId={patientId}
                patientData={patientData}
                onRefresh={onRefresh}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
