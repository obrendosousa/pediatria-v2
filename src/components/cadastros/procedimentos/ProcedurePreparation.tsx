'use client';

import { inputClass, labelClass } from './types';

interface Props {
  note: string;
  onChange: (value: string) => void;
}

export default function ProcedurePreparation({ note, onChange }: Props) {
  return (
    <div>
      <label className={labelClass}>Preparação</label>
      <textarea
        value={note}
        onChange={e => onChange(e.target.value)}
        placeholder="Instruções de preparação do procedimento..."
        rows={4}
        className={`${inputClass} resize-y min-h-[100px]`}
      />
    </div>
  );
}
