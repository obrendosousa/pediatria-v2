'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PatientListTable } from '@/components/medical-record/PatientListTable';
import { NewPatientModal } from '@/components/medical-record/NewPatientModal';

interface PatientAppointment {
  start_time: string;
}

interface PatientRow {
  id: number;
  name: string;
  phone: string | null;
  created_at: string;
  appointments: PatientAppointment[];
}

const supabase = createClient();

export default function ClientsPage() {
  const router = useRouter();

  const [patientsList, setPatientsList] = useState<PatientRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isNewPatientModalOpen, setIsNewPatientModalOpen] = useState(false);

  const fetchPatientsList = useCallback(async () => {
    setIsLoading(true);

    const { data, error } = await supabase
      .from('patients')
      .select('id, name, phone, created_at, appointments(start_time)')
      .order('name')
      .order('start_time', { referencedTable: 'appointments', ascending: false })
      .limit(1, { referencedTable: 'appointments' });

    if (error) {
      console.error('Erro ao buscar pacientes:', error);
    }

    if (data) {
      setPatientsList(data as unknown as PatientRow[]);
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carregamento inicial de dados
    fetchPatientsList();
  }, [fetchPatientsList]);

  const handleSelectPatient = (id: number) => {
    router.push(`/clients/${id}`);
  };

  const handlePatientCreated = () => {
    fetchPatientsList();
    setIsNewPatientModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0b141a]">
      <PatientListTable
        patients={patientsList}
        isLoading={isLoading}
        onSelectPatient={handleSelectPatient}
        onNewPatient={() => setIsNewPatientModalOpen(true)}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onPatientDeleted={fetchPatientsList}
      />

      <NewPatientModal
        isOpen={isNewPatientModalOpen}
        onClose={() => setIsNewPatientModalOpen(false)}
        onSuccess={handlePatientCreated}
      />
    </div>
  );
}
