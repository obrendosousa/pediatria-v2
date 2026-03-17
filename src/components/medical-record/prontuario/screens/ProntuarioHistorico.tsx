'use client';

import { useState } from 'react';
import { ProntuarioScreenProps } from '@/types/prontuario';
import { ClinicalTimeline } from '@/components/medical-record/ClinicalTimeline';

export function ProntuarioHistorico({ patientId, patientData }: ProntuarioScreenProps) {
  const [refreshTrigger] = useState(0);

  return (
    <div className="p-6">
      <ClinicalTimeline
        patientId={patientId}
        patientData={patientData}
        refreshTrigger={refreshTrigger}
      />
    </div>
  );
}
