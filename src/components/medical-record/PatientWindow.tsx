// src/components/medical-record/PatientWindow.tsx

'use client';

import React from 'react';
import { PatientListTable } from './PatientListTable';
import { PatientMedicalRecordView } from './PatientMedicalRecordView';

interface Patient {
  id: number;
  name: string;
  phone?: string;
  [key: string]: any;
}

interface PatientWindowProps {
  patient: Patient | null;
  patientsList: Patient[];
  isLoading: boolean;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onSelectPatient: (id: number) => void;
  onNewPatient: () => void;
  onRefresh?: () => void;
}

export function PatientWindow({
  patient,
  patientsList,
  isLoading,
  searchTerm,
  onSearchChange,
  onSelectPatient,
  onNewPatient,
  onRefresh
}: PatientWindowProps) {

  // Se não há paciente selecionado, mostra a lista
  if (!patient) {
    return (
      <div className="flex-1 flex flex-col bg-[#f8fafc] dark:bg-[#0b141a] overflow-hidden animate-in fade-in duration-300">
        <PatientListTable 
          patients={patientsList}
          isLoading={isLoading}
          onSelectPatient={onSelectPatient}
          onNewPatient={onNewPatient}
          searchTerm={searchTerm}
          onSearchChange={onSearchChange}
        />
      </div>
    );
  }

  // Se há paciente selecionado, mostra o prontuário completo com transição suave
  return (
    <div className="flex-1 flex flex-col bg-[#f8fafc] dark:bg-[#0b141a] overflow-hidden animate-in fade-in slide-in-from-right-2 duration-300">
      <PatientMedicalRecordView 
        patientId={patient.id}
        onRefresh={onRefresh}
      />
    </div>
  );
}
