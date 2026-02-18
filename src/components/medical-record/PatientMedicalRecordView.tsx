// src/components/medical-record/PatientMedicalRecordView.tsx

'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
const supabase = createClient();
import { ClinicalSummary } from '@/types/medical';
import { PatientStickyHeader } from './PatientStickyHeader';
import { ClinicalSummaryGrid } from './ClinicalSummaryGrid';
import { ClinicalTimeline } from './ClinicalTimeline';
import { AttendanceLayout } from './attendance/AttendanceLayout';
import { PatientPhonesManager } from './PatientPhonesManager';
import QuickChatModal from '../chat/QuickChatModal';
import { getPatientPhones } from '@/utils/patientRelations';
import { Stethoscope, Activity, FileText, LayoutDashboard, Phone, X } from 'lucide-react';
import { useMedicalRecord } from '@/hooks/useMedicalRecord';
import FinishConsultationModal from './FinishConsultationModal';
import { NewPatientModal } from './NewPatientModal';

interface PatientMedicalRecordViewProps {
  patientId: number;
  appointmentId?: number | null;
  currentDoctorId?: number | null;
  onRefresh?: () => void;
  onBack?: () => void;
}

export function PatientMedicalRecordView({ patientId, appointmentId, currentDoctorId, onRefresh, onBack }: PatientMedicalRecordViewProps) {
  const [patientData, setPatientData] = useState<any | null>(null);
  const [summaryData, setSummaryData] = useState<ClinicalSummary | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(true);
  const [isConsultationActive, setIsConsultationActive] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [activeView, setActiveView] = useState<'summary' | 'attendance'>('summary');
  const [consultationTimer, setConsultationTimer] = useState(0);
  const [primaryPhone, setPrimaryPhone] = useState<string | null>(null);
  const [selectedChatPhone, setSelectedChatPhone] = useState<string | null>(null);
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPhonesModalOpen, setIsPhonesModalOpen] = useState(false);

  useEffect(() => {
    if (patientId) {
      fetchPatientDetails(patientId);
    }
  }, [patientId]);

  async function fetchPatientDetails(id: number) {
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
      setPatientData(pData);
      
      // Buscar telefone principal
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
  }

  const handleRefreshData = () => {
    fetchPatientDetails(patientId);
    setRefreshTrigger(prev => prev + 1);
    if (onRefresh) onRefresh();
  };

  // Timer da consulta
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isConsultationActive) {
      interval = setInterval(() => {
        setConsultationTimer((prev) => prev + 1);
      }, 1000);
    } else {
      setConsultationTimer(0);
    }
    return () => clearInterval(interval);
  }, [isConsultationActive]);

  const { record, saveAllData, startConsultationTimer } = useMedicalRecord(patientId, appointmentId, currentDoctorId);

  useEffect(() => {
    setIsConsultationActive(Boolean(record?.started_at && !record?.finished_at));
  }, [record?.started_at, record?.finished_at]);

  const handleStartConsultation = async () => {
    try {
      await startConsultationTimer();
      setIsConsultationActive(true);
    } catch (error) {
      console.error('Erro ao iniciar atendimento:', error);
    }
  };
  
  const handleFinishConsultation = () => {
    setShowFinishModal(true);
  };

  const handleFinishSuccess = () => {
    setIsConsultationActive(false);
    setConsultationTimer(0);
    setShowFinishModal(false);
    if (onRefresh) onRefresh();
  };

  const handleSaveAllData = async (): Promise<boolean> => {
    try {
      // Esta função será chamada pelo modal para garantir que todos os dados estão salvos
      // Como cada tela salva seus dados individualmente, apenas garantimos que o registro existe
      return await saveAllData();
    } catch (error) {
      console.error('Erro ao salvar todos os dados:', error);
      return false;
    }
  };

  if (isLoadingDetails) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50/50 dark:bg-[#0b141a]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-600"></div>
      </div>
    );
  }

  if (!patientData) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50/50 dark:bg-[#0b141a]">
        <div className="p-10 text-center text-slate-500 dark:text-gray-400">Paciente não encontrado.</div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full relative bg-slate-50/50 dark:bg-[#0b141a] animate-in fade-in duration-300">
      <PatientStickyHeader 
        patient={patientData}
        summary={summaryData}
        onStartConsultation={handleStartConsultation}
        onFinishConsultation={handleFinishConsultation}
        isConsultationActive={isConsultationActive}
        onBack={onBack}
        onOpenChat={(phone) => {
          setSelectedChatPhone(phone);
          setIsChatModalOpen(true);
        }}
        primaryPhone={primaryPhone || undefined}
        onEditPatient={() => setIsEditModalOpen(true)}
        onOpenPhonesManager={() => setIsPhonesModalOpen(true)}
      />

      {/* Sistema de Abas */}
      <div className="bg-white dark:bg-[#1e2028] border-b border-slate-200 dark:border-gray-800 px-6">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveView('summary')}
            className={`
              px-4 py-3 font-medium text-sm transition-all duration-200 border-b-2
              ${
                activeView === 'summary'
                  ? 'border-rose-500 text-rose-600 dark:text-rose-400'
                  : 'border-transparent text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-300'
              }
            `}
          >
            <div className="flex items-center gap-2">
              <LayoutDashboard className="w-4 h-4" />
              Resumo
            </div>
          </button>
          
          <button
            onClick={() => setActiveView('attendance')}
            className={`
              px-4 py-3 font-medium text-sm transition-all duration-200 border-b-2
              ${
                activeView === 'attendance'
                  ? 'border-rose-500 text-rose-600 dark:text-rose-400'
                  : 'border-transparent text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-300'
              }
            `}
          >
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Atendimento
            </div>
          </button>
        </div>
      </div>

      {/* Conteúdo Baseado na Aba Ativa */}
      {activeView === 'summary' ? (
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 scroll-smooth">
          <div className="max-w-7xl mx-auto space-y-8 pb-20">
            
            <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center gap-2 mb-4 px-1">
                 <Activity className="w-5 h-5 text-rose-500" />
                 <h2 className="text-lg font-bold text-slate-700 dark:text-gray-200">Resumo Clínico</h2>
              </div>
              <ClinicalSummaryGrid 
                patientId={patientId}
                summaryData={summaryData}
                onRefresh={handleRefreshData}
              />
            </section>

            <div className="border-t border-slate-200 dark:border-gray-800" />

            <section className="animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
               <div className="flex items-center justify-between mb-6 px-1">
                  <div className="flex items-center gap-2">
                    <Stethoscope className="w-5 h-5 text-rose-500" />
                    <h2 className="text-lg font-bold text-slate-700 dark:text-gray-200">Histórico de Atendimentos</h2>
                  </div>
               </div>
               
               <ClinicalTimeline 
                 patientId={patientId}
                 refreshTrigger={refreshTrigger}
               />
            </section>

          </div>
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

      {/* Modal de Edição de Paciente */}
      {patientData && (
        <NewPatientModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSuccess={(updatedPatientId) => {
            // Recarregar dados do paciente após edição
            fetchPatientDetails(updatedPatientId);
            setIsEditModalOpen(false);
            if (onRefresh) onRefresh();
          }}
          patientId={patientId}
          initialData={{
            name: patientData.name,
            phone: primaryPhone || patientData.phone,
            biological_sex: patientData.biological_sex || patientData.gender,
            parent_name: patientData.family_members?.[0]?.name
          }}
        />
      )}

      {/* Modal de Gerenciamento de Contatos */}
      {isPhonesModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#1e2028] rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-gray-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Phone className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800 dark:text-gray-100">
                    Números de Contato
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-gray-400">
                    Gerencie os telefones do paciente
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsPhonesModalOpen(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-[#2a2d36] rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-500 dark:text-gray-400" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <PatientPhonesManager 
                patientId={patientId}
                onPhoneAdded={async () => {
                  await fetchPatientDetails(patientId);
                  handleRefreshData();
                }}
                onPhoneRemoved={async () => {
                  await fetchPatientDetails(patientId);
                  handleRefreshData();
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
