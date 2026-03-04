'use client';

import React, { useState, useEffect } from 'react';
import { AttendanceTabKey, AttendanceScreenProps } from '@/types/attendance';
import { AttendanceSidebar } from './AttendanceSidebar';
import { AttendanceOverview } from './screens/AttendanceOverview';
import { RoutineConsultation } from './screens/RoutineConsultation';
import { VitalsChart } from './screens/VitalsChart';
import { AdolescentConsultation } from './screens/AdolescentConsultation';
import { ExamResults } from './screens/ExamResults';
import { DiagnosticHypothesis } from './screens/DiagnosticHypothesis';
import { Conducts } from './screens/Conducts';
import { FoodHistory } from './screens/FoodHistory';
import { FirstConsultationAnamnesis } from './screens/FirstConsultationAnamnesis';
import { FollowUp } from './screens/FollowUp';
import { EmergencyConsultation } from './screens/EmergencyConsultation';
import { ExamsAndProcedures } from './screens/ExamsAndProcedures';
import { Prescriptions } from './screens/Prescriptions';
import { DocumentsAndCertificates } from './screens/DocumentsAndCertificates';
import { ImagesAndAttachments } from './screens/ImagesAndAttachments';

interface AttendanceLayoutProps {
  patientId: number;
  patientData: any;
  isConsultationActive: boolean;
  consultationDuration: number;
  onFinishConsultation: () => void;
  onRefresh?: () => void;
  appointmentId?: number | null;
  medicalRecordId?: number | null;
}

const screenComponents: Record<AttendanceTabKey, React.ComponentType<AttendanceScreenProps>> = {
  'overview': AttendanceOverview,
  'routine': RoutineConsultation,
  'vitals': VitalsChart,
  'adolescent': AdolescentConsultation,
  'exam-results': ExamResults,
  'diagnostic-hypothesis': DiagnosticHypothesis,
  'conducts': Conducts,
  'food-history': FoodHistory,
  'first-consultation': FirstConsultationAnamnesis,
  'follow-up': FollowUp,
  'emergency': EmergencyConsultation,
  'exams-procedures': ExamsAndProcedures,
  'prescriptions': Prescriptions,
  'documents': DocumentsAndCertificates,
  'images': ImagesAndAttachments,
};

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
  const [activeTab, setActiveTab] = useState<AttendanceTabKey>('overview');
  // Lazy mount: tela só monta na primeira visita, mas permanece montada depois
  const [visitedTabs, setVisitedTabs] = useState<Set<AttendanceTabKey>>(new Set(['overview']));

  useEffect(() => {
    setVisitedTabs((prev) => {
      if (prev.has(activeTab)) return prev;
      return new Set([...prev, activeTab]);
    });
  }, [activeTab]);

  return (
    <div className="flex flex-1 h-full bg-slate-50/50 dark:bg-[#0b141a]">
      {/* Sidebar */}
      <AttendanceSidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isConsultationActive={isConsultationActive}
        consultationDuration={consultationDuration}
        onFinishConsultation={onFinishConsultation}
      />

      {/* Área de Conteúdo - todas as telas visitadas ficam montadas */}
      <div className="flex-1 min-w-0 overflow-y-auto custom-scrollbar">
        {(Object.keys(screenComponents) as AttendanceTabKey[]).map((tabKey) => {
          if (!visitedTabs.has(tabKey)) return null;
          const ScreenComponent = screenComponents[tabKey];
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
