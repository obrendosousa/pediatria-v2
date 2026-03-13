'use client';

import { AttendanceScreenProps } from '@/types/attendance';
import { Award } from 'lucide-react';

export function Certificates({ patientId }: AttendanceScreenProps) {
  return (
    <div className="p-6 flex flex-col items-center justify-center h-full text-center">
      <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-2xl mb-4">
        <Award className="w-12 h-12 text-purple-400 dark:text-purple-300" />
      </div>
      <h2 className="text-lg font-bold text-slate-700 dark:text-gray-200">Atestados</h2>
      <p className="text-sm text-slate-400 dark:text-gray-500 mt-2 max-w-sm">
        Emissão de atestados médicos do paciente #{patientId}. Em breve.
      </p>
    </div>
  );
}
