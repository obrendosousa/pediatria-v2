'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { AttendanceTabKey, AttendanceScreenProps } from '@/types/attendance';
import { AttendanceSidebar } from './AttendanceSidebar';
import { useModuleSafe } from '@/contexts/ModuleContext';
import { ATTENDANCE_CONFIGS, PEDIATRIA_ATTENDANCE } from '@/config/attendance';

interface AttendanceLayoutProps {
  patientId: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  patientData: any;
  isConsultationActive: boolean;
  consultationDuration: number;
  onFinishConsultation: () => void;
  onRefresh?: () => void;
  appointmentId?: number | null;
  medicalRecordId?: number | null;
}

export function AttendanceLayout({
  patientId,
  patientData,
  isConsultationActive,
  consultationDuration,
  onFinishConsultation,
  onRefresh,
  appointmentId,
  medicalRecordId,
}: AttendanceLayoutProps) {
  // Detecta módulo: se tem ModuleProvider = usa config dele, senão = pediatria (default)
  const moduleCtx = useModuleSafe();
  const attendanceConfig = useMemo(() => {
    if (moduleCtx?.config.id) {
      return ATTENDANCE_CONFIGS[moduleCtx.config.id] ?? PEDIATRIA_ATTENDANCE;
    }
    return PEDIATRIA_ATTENDANCE;
  }, [moduleCtx?.config.id]);

  const [activeTab, setActiveTab] = useState<AttendanceTabKey>(attendanceConfig.defaultTab);
  // Lazy mount: tela só monta na primeira visita, mas permanece montada depois
  const [visitedTabs, setVisitedTabs] = useState<Set<AttendanceTabKey>>(new Set([attendanceConfig.defaultTab]));

  const handleTabChange = useCallback((tab: AttendanceTabKey) => {
    setActiveTab(tab);
    setVisitedTabs(prev => {
      if (prev.has(tab)) return prev;
      return new Set([...prev, tab]);
    });
  }, []);

  // Screens disponíveis para este módulo
  const screenComponents = attendanceConfig.screens as Record<AttendanceTabKey, React.ComponentType<AttendanceScreenProps>>;

  return (
    <div className="flex flex-1 h-full bg-slate-50/50 dark:bg-[#0b141a]">
      {/* Sidebar — driven pela config do módulo */}
      <AttendanceSidebar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        isConsultationActive={isConsultationActive}
        consultationDuration={consultationDuration}
        onFinishConsultation={onFinishConsultation}
        sidebarItems={attendanceConfig.sidebar}
      />

      {/* Área de Conteúdo — só renderiza screens que existem na config do módulo */}
      <div className="flex-1 min-w-0 overflow-y-auto custom-scrollbar">
        {(Object.keys(screenComponents) as AttendanceTabKey[]).map((tabKey) => {
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
                appointmentId={appointmentId ?? undefined}
                medicalRecordId={medicalRecordId ?? undefined}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
