'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { PatientProntuarioView } from '@/components/medical-record/PatientProntuarioView';
import { useAuth } from '@/contexts/AuthContext';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function AtendimentoClientDetailPage({ params }: PageProps) {
  const router = useRouter();
  const { profile } = useAuth();
  const resolvedParams = use(params);
  const patientId = parseInt(resolvedParams.id);

  if (isNaN(patientId)) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f8fafc] dark:bg-[#111118]">
        <div className="text-center">
          <p className="text-lg font-medium text-slate-600 dark:text-[#a1a1aa] mb-2">
            ID de paciente inválido
          </p>
          <button
            onClick={() => router.push('/atendimento/clients')}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Voltar para lista
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-[#f8fafc] dark:bg-[#111118] overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        <PatientProntuarioView
          patientId={patientId}
          currentDoctorId={profile?.doctor_id}
          onRefresh={() => {}}
          onBack={() => router.push('/atendimento/clients')}
        />
      </div>
    </div>
  );
}
