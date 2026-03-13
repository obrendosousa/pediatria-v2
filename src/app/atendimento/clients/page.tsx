'use client';

import { useState, useCallback } from 'react';
import PatientListTable from '@/components/atendimento/patients/PatientListTable';
import NewPatientModal from '@/components/atendimento/patients/NewPatientModal';
import type { AtendimentoPatient } from '@/types/atendimento-patient';

export default function AtendimentoClientsPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPatientId, setEditingPatientId] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleNewPatient = useCallback(() => {
    setEditingPatientId(null);
    setModalOpen(true);
  }, []);

  const handleEditPatient = useCallback((patient: AtendimentoPatient) => {
    setEditingPatientId(patient.id);
    setModalOpen(true);
  }, []);

  const handleSuccess = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  const handleClose = useCallback(() => {
    setModalOpen(false);
    setEditingPatientId(null);
  }, []);

  return (
    <div className="h-full flex flex-col">
      <PatientListTable
        key={refreshKey}
        onNewPatient={handleNewPatient}
        onEditPatient={handleEditPatient}
      />
      <NewPatientModal
        isOpen={modalOpen}
        onClose={handleClose}
        onSuccess={handleSuccess}
        patientId={editingPatientId}
      />
    </div>
  );
}
