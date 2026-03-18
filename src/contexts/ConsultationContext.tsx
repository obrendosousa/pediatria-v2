'use client';

import React, { createContext, useContext, useRef, useCallback } from 'react';
import { useMedicalRecord, MedicalRecordData } from '@/hooks/useMedicalRecord';

type SaveHandler = () => Promise<void>;

interface ConsultationContextType {
  record: MedicalRecordData | null;
  isLoading: boolean;
  error: string | null;
  saveRecord: (data: Partial<MedicalRecordData>) => Promise<unknown>;
  finishRecord: () => Promise<unknown>;
  startConsultationTimer: () => Promise<unknown>;
  saveAllData: () => Promise<boolean>;
  reload: () => void;
  registerSaveHandler: (key: string, handler: SaveHandler) => void;
  unregisterSaveHandler: (key: string) => void;
  saveAllScreens: () => Promise<void>;
}

const ConsultationContext = createContext<ConsultationContextType | null>(null);

export function ConsultationProvider({
  children,
  patientId,
  appointmentId,
  currentDoctorId,
}: {
  children: React.ReactNode;
  patientId: number;
  appointmentId?: number | null;
  currentDoctorId?: number | null;
}) {
  const medRecord = useMedicalRecord(patientId, appointmentId, currentDoctorId);
  const saveHandlersRef = useRef<Map<string, SaveHandler>>(new Map());

  const registerSaveHandler = useCallback((key: string, handler: SaveHandler) => {
    saveHandlersRef.current.set(key, handler);
  }, []);

  const unregisterSaveHandler = useCallback((key: string) => {
    saveHandlersRef.current.delete(key);
  }, []);

  const saveAllScreens = useCallback(async () => {
    const handlers = Array.from(saveHandlersRef.current.values());
    const errors: Error[] = [];
    await Promise.all(
      handlers.map((h) =>
        h().catch((err) => {
          console.error('Erro ao salvar tela:', err);
          errors.push(err instanceof Error ? err : new Error(String(err)));
        })
      )
    );
    if (errors.length > 0) {
      throw new Error(`${errors.length} tela(s) falharam ao salvar.`);
    }
  }, []);

  return (
    <ConsultationContext.Provider
      value={{
        ...medRecord,
        registerSaveHandler,
        unregisterSaveHandler,
        saveAllScreens,
      }}
    >
      {children}
    </ConsultationContext.Provider>
  );
}

export function useConsultation() {
  const ctx = useContext(ConsultationContext);
  if (!ctx) {
    throw new Error('useConsultation must be used within ConsultationProvider');
  }
  return ctx;
}
