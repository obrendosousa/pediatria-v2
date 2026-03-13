'use client';

import React, { useState, useCallback } from 'react';
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
import { AttachmentsList } from './screens/AttachmentsList';
import { ImageGallery } from './screens/ImageGallery';
import { Allergies } from './screens/Allergies';
import { EvolutionsList as Evolutions } from '@/components/medical-record/screens/EvolutionsList';
import { CertificatesList as Certificates } from '@/components/medical-record/screens/CertificatesList';
import { ReportsList as Reports } from '@/components/medical-record/screens/ReportsList';
import { AnamnesesList } from '@/components/medical-record/screens/AnamnesesList';

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
  'images': AttachmentsList,
  'allergies': Allergies,
  'evolutions': Evolutions,
  'certificates': Certificates,
  'reports': Reports,
  'gallery': ImageGallery,
  'anamneses-list': AnamnesesList,
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

  const handleTabChange = useCallback((tab: AttendanceTabKey) => {
    setActiveTab(tab);
    setVisitedTabs(prev => {
      if (prev.has(tab)) return prev;
      return new Set([...prev, tab]);
    });
  }, []);

  return (
    <div className="flex flex-1 h-full bg-slate-50/50 dark:bg-[#0b141a]">
      {/* Sidebar */}
      <AttendanceSidebar
        activeTab={activeTab}
        onTabChange={handleTabChange}
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
