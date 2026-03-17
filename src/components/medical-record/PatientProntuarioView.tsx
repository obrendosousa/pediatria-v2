// src/components/medical-record/PatientProntuarioView.tsx
// Prontuário dedicado para o módulo da Clínica Geral
/* eslint-disable react-hooks/set-state-in-effect */

'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { createSchemaClient } from '@/lib/supabase/schemaClient';
import { useModuleSafe } from '@/contexts/ModuleContext';
import { ClinicalSummary } from '@/types/medical';
import { PatientStickyHeader } from './PatientStickyHeader';
import { ClinicalSummaryGrid } from './ClinicalSummaryGrid';
import { ClinicalTimeline } from './ClinicalTimeline';
import { AttendanceLayout } from './attendance/AttendanceLayout';
import { ProntuarioLayout } from './prontuario/ProntuarioLayout';
import { getPatientPhones } from '@/utils/patientRelations';
import { Stethoscope, Activity, FileText, LayoutDashboard, ClipboardList } from 'lucide-react';
import { ConsultationProvider, useConsultation } from '@/contexts/ConsultationContext';
import FinishConsultationModal from './FinishConsultationModal';
import { GERAL_PRONTUARIO } from '@/config/prontuario';

interface PatientProntuarioViewProps {
  patientId: number;
  appointmentId?: number | null;
  currentDoctorId?: number | null;
  onRefresh?: () => void;
  onBack?: () => void;
}

export function PatientProntuarioView({ patientId, appointmentId, currentDoctorId, onRefresh, onBack }: PatientProntuarioViewProps) {
  return (
    <ConsultationProvider patientId={patientId} appointmentId={appointmentId} currentDoctorId={currentDoctorId}>
      <PatientProntuarioViewInner
        patientId={patientId}
        appointmentId={appointmentId}
        onRefresh={onRefresh}
        onBack={onBack}
      />
    </ConsultationProvider>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function PatientProntuarioViewInner({ patientId, appointmentId, onRefresh, onBack }: Omit<PatientProntuarioViewProps, 'currentDoctorId'>) {
  const moduleCtx = useModuleSafe();
  const supabase = useMemo(() => {
    const schema = moduleCtx?.config.schema;
    return schema && schema !== 'public' ? createSchemaClient(schema) : createSchemaClient('atendimento');
  }, [moduleCtx?.config.schema]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [patientData, setPatientData] = useState<any | null>(null);
  const [summaryData, setSummaryData] = useState<ClinicalSummary | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(true);
  const [isConsultationActive, setIsConsultationActive] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [activeView, setActiveView] = useState<'summary' | 'prontuario' | 'attendance'>('summary');
  const [primaryPhone, setPrimaryPhone] = useState<string | null>(null);
  const [showFinishModal, setShowFinishModal] = useState(false);

  const fetchPatientDetails = React.useCallback(async (id: number) => {
    setIsLoadingDetails(true);

    const { data: pData } = await supabase
      .from('patients')
      .select('*')
      .eq('id', id)
      .single();

    const { data: sData } = await supabase
      .from('clinical_summaries')
      .select('*')
      .eq('patient_id', id)
      .single();

    if (pData) {
      // Normalizar full_name → name
      if (!pData.name && pData.full_name) {
        pData.name = pData.full_name;
      }
      setPatientData(pData);

      const phones = await getPatientPhones(id);
      const primary = phones.find(p => p.is_primary) || phones[0];
      if (primary) {
        setPrimaryPhone(primary.phone_formatted || primary.phone);
      } else if (pData.phone) {
        setPrimaryPhone(pData.phone);
      }
    }

    setSummaryData(sData);
    setIsLoadingDetails(false);
  }, [supabase]);

  useEffect(() => {
    if (patientId) fetchPatientDetails(patientId);
  }, [patientId, fetchPatientDetails]);

  const handleRefreshData = () => {
    fetchPatientDetails(patientId);
    setRefreshTrigger(prev => prev + 1);
    if (onRefresh) onRefresh();
  };

  const { record, saveAllData, startConsultationTimer, saveAllScreens } = useConsultation();

  useEffect(() => {
    setIsConsultationActive(Boolean(record?.started_at && !record?.finished_at));
  }, [record?.started_at, record?.finished_at]);

  // Timer
  const [consultationTimer, setConsultationTimer] = useState(0);
  useEffect(() => {
    if (!isConsultationActive || !record?.started_at) {
      setConsultationTimer(0);
      return;
    }
    const startedAtStr = record.started_at as string;
    const calc = () => Math.max(0, Math.floor((Date.now() - new Date(startedAtStr).getTime()) / 1000));
    setConsultationTimer(calc());
    const interval = setInterval(() => setConsultationTimer(calc()), 1000);
    return () => clearInterval(interval);
  }, [isConsultationActive, record?.started_at]);

  const handleStartConsultation = async () => {
    try {
      await startConsultationTimer();
      setIsConsultationActive(true);
      setActiveView('attendance');
    } catch (error) {
      console.error('Erro ao iniciar atendimento:', error);
    }
  };

  const handleFinishConsultation = () => setShowFinishModal(true);

  const handleFinishSuccess = () => {
    setIsConsultationActive(false);
    setShowFinishModal(false);
    setActiveView('summary');
    setRefreshTrigger(prev => prev + 1);
    if (onRefresh) onRefresh();
  };

  const handleSaveAllData = async (): Promise<boolean> => {
    try {
      await saveAllScreens();
      return await saveAllData();
    } catch (error) {
      console.error('Erro ao salvar todos os dados:', error);
      return false;
    }
  };

  if (isLoadingDetails) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#f4f5f7] dark:bg-[#08080b]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!patientData) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#f4f5f7] dark:bg-[#08080b]">
        <div className="p-10 text-center text-slate-500 dark:text-[#a1a1aa]">Paciente não encontrado.</div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full relative bg-[#f4f5f7] dark:bg-[#08080b]">
      <PatientStickyHeader
        patient={patientData}
        summary={summaryData}
        onStartConsultation={handleStartConsultation}
        onFinishConsultation={handleFinishConsultation}
        isConsultationActive={isConsultationActive}
        onBack={onBack}
        primaryPhone={primaryPhone || undefined}
        startedAt={record?.started_at}
      />

      {/* ── Tab Bar — clean, minimal ── */}
      <div className="bg-white dark:bg-[#0c0c0e] border-b border-slate-200/80 dark:border-[#1a1a1f] px-6">
        <div className="flex gap-0">
          {([
            { key: 'summary' as const, label: 'Resumo', icon: LayoutDashboard },
            { key: 'prontuario' as const, label: 'Prontuário', icon: ClipboardList },
            ...(isConsultationActive ? [{ key: 'attendance' as const, label: 'Atendimento', icon: FileText }] : []),
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveView(tab.key)}
              className={`relative px-5 py-3 text-[13px] font-medium transition-colors duration-150 flex items-center gap-2 cursor-pointer ${
                activeView === tab.key
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-slate-400 dark:text-[#52525b] hover:text-slate-600 dark:hover:text-[#a1a1aa]'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {activeView === tab.key && (
                <div className="absolute bottom-0 left-2 right-2 h-[2px] bg-blue-500 rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      {activeView === 'summary' ? (
        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 md:p-8 scroll-smooth">
          <div className="max-w-7xl mx-auto space-y-8 pb-20">
            <section>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 dark:bg-blue-500/10 flex items-center justify-center">
                  <Activity className="w-4 h-4 text-blue-500" />
                </div>
                <h2 className="text-base font-semibold text-slate-800 dark:text-[#e4e4e7]">Resumo Clínico</h2>
              </div>
              <ClinicalSummaryGrid
                patientId={patientId}
                summaryData={summaryData}
                onRefresh={handleRefreshData}
              />
            </section>

            <div className="border-t border-slate-200/60 dark:border-[#1a1a1f]" />

            <section>
              <div className="flex items-center gap-2.5 mb-5">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 dark:bg-blue-500/10 flex items-center justify-center">
                  <Stethoscope className="w-4 h-4 text-blue-500" />
                </div>
                <h2 className="text-base font-semibold text-slate-800 dark:text-[#e4e4e7]">Histórico de Atendimentos</h2>
              </div>
              <ClinicalTimeline
                patientId={patientId}
                refreshTrigger={refreshTrigger}
                patientData={patientData}
              />
            </section>
          </div>
        </div>
      ) : activeView === 'prontuario' ? (
        <div className="flex-1 min-h-0 h-full flex flex-col overflow-hidden">
          <ProntuarioLayout
            patientId={patientId}
            patientData={patientData}
            onRefresh={handleRefreshData}
            config={GERAL_PRONTUARIO}
          />
        </div>
      ) : (
        <div className="flex-1 min-h-0 h-full flex flex-col overflow-hidden">
          <AttendanceLayout
            patientId={patientId}
            patientData={patientData}
            isConsultationActive={isConsultationActive}
            consultationDuration={consultationTimer}
            onFinishConsultation={handleFinishConsultation}
            onRefresh={handleRefreshData}
            appointmentId={appointmentId ?? undefined}
            medicalRecordId={record?.id ?? undefined}
          />
        </div>
      )}

      {/* Modal de Finalização */}
      <FinishConsultationModal
        isOpen={showFinishModal}
        onClose={() => setShowFinishModal(false)}
        onSuccess={handleFinishSuccess}
        patientId={patientId}
        appointmentId={appointmentId || undefined}
        patientName={patientData?.name || 'Paciente'}
        onSaveAllData={handleSaveAllData}
      />
    </div>
  );
}
