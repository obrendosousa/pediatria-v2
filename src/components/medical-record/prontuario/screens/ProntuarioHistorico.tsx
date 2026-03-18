'use client';

import { ProntuarioScreenProps } from '@/types/prontuario';
import { ClinicalTimeline } from '@/components/medical-record/ClinicalTimeline';

export function ProntuarioHistorico({ patientId, patientData }: ProntuarioScreenProps) {
  return (
    <div className="p-6">
      <ClinicalTimeline
        patientId={patientId}
        patientData={patientData}
        refreshTrigger={0}
      />
    </div>
  );
}
