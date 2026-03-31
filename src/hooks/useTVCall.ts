import { useCallback, useState } from 'react';
import { useToast } from '@/contexts/ToastContext';
import type { ServicePoint } from '@/types/queue';

/** Hook compartilhado para chamar pacientes na TV — funciona em qualquer módulo */
export function useTVCall() {
  const { toast } = useToast();
  const [isCalling, setIsCalling] = useState(false);

  /** Chamar paciente pelo nome na TV */
  const callPatientOnTV = useCallback(async (
    patientName: string,
    options?: {
      servicePointName?: string;
      servicePointCode?: string;
      doctorName?: string;
      ticketNumber?: string;
      isPriority?: boolean;
    }
  ) => {
    setIsCalling(true);
    try {
      const res = await fetch('/api/tv/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientName, ...options }),
      });
      if (!res.ok) throw new Error('Falha na chamada');
      toast.success(`${patientName} chamado na TV`);
    } catch {
      toast.error('Erro ao chamar na TV');
    } finally {
      setIsCalling(false);
    }
  }, [toast]);

  /** Chamada manual por texto livre na TV */
  const manualCallOnTV = useCallback(async (
    text: string,
    servicePoint?: ServicePoint | null,
  ) => {
    setIsCalling(true);
    try {
      const res = await fetch('/api/tv/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientName: text.trim(),
          servicePointName: servicePoint?.name || undefined,
          servicePointCode: servicePoint?.code || undefined,
        }),
      });
      if (!res.ok) throw new Error('Falha na chamada');
      toast.success('Chamada enviada para a TV');
    } catch {
      toast.error('Erro ao enviar chamada');
    } finally {
      setIsCalling(false);
    }
  }, [toast]);

  return { callPatientOnTV, manualCallOnTV, isCalling };
}
