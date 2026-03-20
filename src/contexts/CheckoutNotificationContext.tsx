'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

interface CheckoutAlert {
  id: number;
  patientName: string;
  timestamp: string;
}

interface CheckoutNotificationContextValue {
  /** Número de appointments com status waiting_payment */
  pendingCount: number;
  /** Alertas recentes (novos checkouts que a secretária ainda não viu) */
  alerts: CheckoutAlert[];
  /** Dispensar um alerta específico */
  dismissAlert: (appointmentId: number) => void;
  /** Dispensar todos os alertas */
  dismissAllAlerts: () => void;
}

const CheckoutNotificationContext = createContext<CheckoutNotificationContextValue>({
  pendingCount: 0,
  alerts: [],
  dismissAlert: () => {},
  dismissAllAlerts: () => {}
});

export function CheckoutNotificationProvider({ children }: { children: React.ReactNode }) {
  const [pendingCount, setPendingCount] = useState(0);
  const [alerts, setAlerts] = useState<CheckoutAlert[]>([]);
  const knownIdsRef = useRef<Set<number>>(new Set());

  const fetchPendingCount = useCallback(async () => {
    const { count, data } = await supabase
      .from('appointments')
      .select('id, patient_name, start_time', { count: 'exact', head: false })
      .eq('status', 'waiting_payment');

    setPendingCount(count ?? 0);

    // Na primeira carga, preenche os IDs conhecidos sem criar alertas
    if (knownIdsRef.current.size === 0 && data) {
      for (const apt of data) {
        knownIdsRef.current.add(apt.id);
      }
    }
  }, []);

  useEffect(() => {
    // Carga inicial ao montar
    let cancelled = false;
    (async () => {
      const { count, data } = await supabase
        .from('appointments')
        .select('id, patient_name, start_time', { count: 'exact', head: false })
        .eq('status', 'waiting_payment');
      if (cancelled) return;
      setPendingCount(count ?? 0);
      if (data) {
        for (const apt of data) {
          knownIdsRef.current.add(apt.id);
        }
      }
    })();

    const channel = supabase
      .channel('checkout_notifications_global')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'appointments' },
        (payload) => {
          const newStatus = payload.new?.status;
          const oldStatus = payload.old?.status;
          const aptId = payload.new?.id as number;

          // Novo checkout pendente
          if (newStatus === 'waiting_payment' && oldStatus !== 'waiting_payment') {
            const name = (payload.new?.patient_name as string) || 'Paciente';
            if (!knownIdsRef.current.has(aptId)) {
              knownIdsRef.current.add(aptId);
              setAlerts(prev => [
                ...prev,
                { id: aptId, patientName: name, timestamp: new Date().toISOString() }
              ]);
            }
            fetchPendingCount();
          }

          // Checkout finalizado (saiu de waiting_payment)
          if (oldStatus === 'waiting_payment' && newStatus !== 'waiting_payment') {
            knownIdsRef.current.delete(aptId);
            setAlerts(prev => prev.filter(a => a.id !== aptId));
            fetchPendingCount();
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [fetchPendingCount]);

  const dismissAlert = useCallback((appointmentId: number) => {
    setAlerts(prev => prev.filter(a => a.id !== appointmentId));
  }, []);

  const dismissAllAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  return (
    <CheckoutNotificationContext.Provider value={{ pendingCount, alerts, dismissAlert, dismissAllAlerts }}>
      {children}
    </CheckoutNotificationContext.Provider>
  );
}

export function useCheckoutNotifications() {
  return useContext(CheckoutNotificationContext);
}
