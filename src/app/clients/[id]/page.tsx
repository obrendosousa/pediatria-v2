'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { PatientMedicalRecordView } from '@/components/medical-record/PatientMedicalRecordView';
import { useAuth } from '@/contexts/AuthContext';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ClientDetailPage({ params }: PageProps) {
  const router = useRouter();
  const { profile } = useAuth();
  const resolvedParams = use(params);
  const patientId = parseInt(resolvedParams.id);

  if (isNaN(patientId)) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f8fafc] dark:bg-[#0b141a]">
        <div className="text-center">
          <p className="text-lg font-medium text-slate-600 dark:text-gray-400 mb-2">
            ID de paciente inválido
          </p>
          <button
            onClick={() => router.push('/clients')}
            className="text-rose-600 hover:text-rose-700 font-medium"
          >
            Voltar para lista
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-[#f8fafc] dark:bg-[#0b141a] overflow-hidden">
      {/* Prontuário */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        <PatientMedicalRecordView
          patientId={patientId}
          currentDoctorId={profile?.doctor_id}
          onRefresh={() => {
            // Refresh pode ser implementado se necessário
          }}
          onBack={() => router.push('/clients')}
        />
      </div>
    </div>
  );
}
