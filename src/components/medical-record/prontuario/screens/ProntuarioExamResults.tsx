'use client';

import { ProntuarioScreenProps } from '@/types/prontuario';
import { ExamResultsTab } from '@/components/medical-record/attendance/screens/ExamResultsTab';

export function ProntuarioExamResults({ patientId }: ProntuarioScreenProps) {
  return (
    <div className="p-6">
      <ExamResultsTab patientId={patientId} />
    </div>
  );
}
