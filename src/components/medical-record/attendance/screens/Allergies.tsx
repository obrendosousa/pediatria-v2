'use client';

import { AttendanceScreenProps } from '@/types/attendance';
import { ShieldAlert } from 'lucide-react';

export function Allergies({ patientId }: AttendanceScreenProps) {
  return (
    <div className="p-6 flex flex-col items-center justify-center h-full text-center">
      <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-2xl mb-4">
        <ShieldAlert className="w-12 h-12 text-orange-400 dark:text-orange-300" />
      </div>
      <h2 className="text-lg font-bold text-slate-700 dark:text-gray-200">Alergias</h2>
      <p className="text-sm text-slate-400 dark:text-gray-500 mt-2 max-w-sm">
        Gerenciamento de alergias do paciente #{patientId}. Em breve.
      </p>
    </div>
  );
}
