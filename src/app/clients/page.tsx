'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { PatientListTable } from '@/components/medical-record/PatientListTable';
import { NewPatientModal } from '@/components/medical-record/NewPatientModal';

export default function ClientsPage() {
  const router = useRouter();
  
  // --- ESTADOS ---
  const [patientsList, setPatientsList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Estado do Modal
  const [isNewPatientModalOpen, setIsNewPatientModalOpen] = useState(false);

  // --- EFEITOS ---
  useEffect(() => {
    fetchPatientsList();
  }, []);

  // --- FUNÇÕES DE DADOS ---
  async function fetchPatientsList() {
    setIsLoading(true);
    
    // Busca os dados para preencher a tabela
    const { data, error } = await supabase
      .from('patients')
      .select('id, name, phone, created_at') 
      .order('name');
    
    if (error) {
      console.error('Erro ao buscar pacientes:', error);
    }

    if (data) {
      setPatientsList(data);
    }
    
    setIsLoading(false);
  }

  // --- AÇÕES ---

  // Ao clicar na linha da tabela, navega para a rota dinâmica [id]
  const handleSelectPatient = (id: number) => {
    router.push(`/clients/${id}`);
  };

  // Callback após criar paciente
  const handlePatientCreated = (newId: number) => {
    fetchPatientsList(); // Recarrega a tabela
    setIsNewPatientModalOpen(false); // Fecha o modal
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0b141a]">
      
      {/* IMPORTANTE: Aqui renderizamos APENAS a tabela.
         Não há Sidebar nem Header Sticky nesta página.
      */}
      <PatientListTable 
        patients={patientsList}
        isLoading={isLoading}
        onSelectPatient={handleSelectPatient}
        onNewPatient={() => setIsNewPatientModalOpen(true)}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onPatientDeleted={fetchPatientsList}
      />

      {/* Modal para criar novo paciente (acessível pelo botão da tabela) */}
      <NewPatientModal 
        isOpen={isNewPatientModalOpen}
        onClose={() => setIsNewPatientModalOpen(false)}
        onSuccess={handlePatientCreated}
      />
    </div>
  );
}