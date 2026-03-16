'use client';

import { AttendanceScreenProps } from '@/types/attendance';
import { Camera } from 'lucide-react';

export function Gallery({ patientId }: AttendanceScreenProps) {
  return (
    <div className="p-6 flex flex-col items-center justify-center h-full text-center">
      <div className="p-4 bg-pink-50 dark:bg-pink-900/20 rounded-2xl mb-4">
        <Camera className="w-12 h-12 text-pink-400 dark:text-pink-300" />
      </div>
      <h2 className="text-lg font-bold text-slate-700 dark:text-gray-200">Galeria de Imagens</h2>
      <p className="text-sm text-slate-400 dark:text-[#71717a] mt-2 max-w-sm">
        Galeria de imagens clínicas do paciente #{patientId}. Em breve.
      </p>
    </div>
  );
}
