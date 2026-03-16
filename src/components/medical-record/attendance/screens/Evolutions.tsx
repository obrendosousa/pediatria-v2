'use client';

import { AttendanceScreenProps } from '@/types/attendance';
import { TrendingUp } from 'lucide-react';

export function Evolutions({ patientId }: AttendanceScreenProps) {
  return (
    <div className="p-6 flex flex-col items-center justify-center h-full text-center">
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl mb-4">
        <TrendingUp className="w-12 h-12 text-blue-400 dark:text-blue-300" />
      </div>
      <h2 className="text-lg font-bold text-slate-700 dark:text-gray-200">Evoluções</h2>
      <p className="text-sm text-slate-400 dark:text-[#565d73] mt-2 max-w-sm">
        Registro de evoluções clínicas do paciente #{patientId}. Em breve.
      </p>
    </div>
  );
}
