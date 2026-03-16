'use client';

import { AttendanceScreenProps } from '@/types/attendance';
import { ScrollText } from 'lucide-react';

export function Reports({ patientId }: AttendanceScreenProps) {
  return (
    <div className="p-6 flex flex-col items-center justify-center h-full text-center">
      <div className="p-4 bg-teal-50 dark:bg-teal-900/20 rounded-2xl mb-4">
        <ScrollText className="w-12 h-12 text-teal-400 dark:text-teal-300" />
      </div>
      <h2 className="text-lg font-bold text-slate-700 dark:text-gray-200">Laudos</h2>
      <p className="text-sm text-slate-400 dark:text-[#565d73] mt-2 max-w-sm">
        Emissão de laudos médicos do paciente #{patientId}. Em breve.
      </p>
    </div>
  );
}
