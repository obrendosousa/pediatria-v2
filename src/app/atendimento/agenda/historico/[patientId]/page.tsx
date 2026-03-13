'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createSchemaClient } from '@/lib/supabase/schemaClient';
import { ArrowLeft, Calendar, Loader2 } from 'lucide-react';
import PatientAppointmentHistory from '@/components/atendimento/agenda/PatientAppointmentHistory';

const supabase = createSchemaClient('atendimento');

function usePatientName(patientId: number) {
  const [state, setState] = useState<{ name: string | null; loading: boolean }>({ name: null, loading: true });

  useEffect(() => {
    if (!patientId || isNaN(patientId)) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from('patients').select('full_name').eq('id', patientId).single();
      if (!cancelled) setState({ name: data?.full_name ?? null, loading: false });
    })();
    return () => { cancelled = true; };
  }, [patientId]);

  if (!patientId || isNaN(patientId)) return { name: null, loading: false };
  return state;
}

export default function HistoricoAgendamentosPage() {
  const params = useParams();
  const router = useRouter();
  const patientId = Number(params.patientId);
  const { name: patientName, loading } = usePatientName(patientId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-[#16171c]">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
      </div>
    );
  }

  if (!patientId || isNaN(patientId)) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50 dark:bg-[#16171c] text-slate-500 dark:text-gray-400">
        <p className="text-sm">Paciente não encontrado.</p>
        <button onClick={() => router.back()} className="mt-3 text-xs text-teal-600 hover:underline">Voltar</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#16171c] transition-colors">
      {/* Header */}
      <div className="h-16 px-6 flex items-center justify-between bg-white dark:bg-[#1e2028] border-b border-slate-100 dark:border-gray-800 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg text-slate-400 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="p-2 bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-300 rounded-lg">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-800 dark:text-gray-100 leading-none">Histórico de Agendamentos</h1>
            <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">{patientName || `Paciente #${patientId}`}</p>
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="px-6 py-4">
        <PatientAppointmentHistory
          patientId={patientId}
          patientName={patientName ?? undefined}
        />
      </div>
    </div>
  );
}
