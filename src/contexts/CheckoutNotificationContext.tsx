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

/** Toca um som curto de notificação usando Web Audio API (sem arquivo externo) */
function playNotificationSound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    // Duas notas curtas: "ti-ding"
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);        // A5
    osc.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.12); // D6
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
    osc.onended = () => ctx.close();
  } catch {
    // Silencioso se AudioContext não disponível
  }
}

export function CheckoutNotificationProvider({ children }: { children: React.ReactNode }) {
  const [pendingCount, setPendingCount] = useState(0);
  const [alerts, setAlerts] = useState<CheckoutAlert[]>([]);
  const knownIdsRef = useRef<Set<number>>(new Set());
  const initializedRef = useRef(false);

  const syncFromDatabase = useCallback(async () => {
    const { count, data } = await supabase
      .from('appointments')
      .select('id, patient_name, start_time', { count: 'exact', head: false })
      .eq('status', 'waiting_payment');

    setPendingCount(count ?? 0);

    if (data) {
      for (const apt of data) {
        knownIdsRef.current.add(apt.id);
      }
    }
  }, []);

  // Carga inicial separada
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    let cancelled = false;
    (async () => {
      const { count, data } = await supabase
        .from('appointments')
        .select('id, patient_name, start_time', { count: 'exact', head: false })
        .eq('status', 'waiting_payment');
      if (cancelled) return;
      setPendingCount(count ?? 0);
      if (data) {
        for (const apt of data) knownIdsRef.current.add(apt.id);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Subscription realtime
  useEffect(() => {
    const channel = supabase
      .channel('checkout_notifications_global')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'appointments' },
        (payload) => {
          const newStatus = payload.new?.status;
          const oldStatus = payload.old?.status;
          const aptId = payload.new?.id as number;

          // Novo checkout pendente — update otimista + som + alerta
          if (newStatus === 'waiting_payment' && oldStatus !== 'waiting_payment') {
            const name = (payload.new?.patient_name as string) || 'Paciente';

            // Update otimista imediato (sem esperar query)
            setPendingCount(prev => prev + 1);

            if (!knownIdsRef.current.has(aptId)) {
              knownIdsRef.current.add(aptId);
              setAlerts(prev => [
                ...prev,
                { id: aptId, patientName: name, timestamp: new Date().toISOString() }
              ]);
              playNotificationSound();
            }

            // Sync preciso em background
            syncFromDatabase();
          }

          // Checkout finalizado — update otimista + limpar alerta
          if (oldStatus === 'waiting_payment' && newStatus !== 'waiting_payment') {
            knownIdsRef.current.delete(aptId);
            setPendingCount(prev => Math.max(0, prev - 1));
            setAlerts(prev => prev.filter(a => a.id !== aptId));

            syncFromDatabase();
          }

          // Fallback: se não conseguiu detectar transição pelo old/new,
          // re-sincroniza para garantir contagem precisa
          if (newStatus === 'waiting_payment' && oldStatus === undefined) {
            syncFromDatabase();
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'medical_checkouts' },
        () => {
          // Médica criou checkout → em breve o appointment vai para waiting_payment
          // Pré-sincroniza para pegar rápido
          setTimeout(() => syncFromDatabase(), 1500);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [syncFromDatabase]);

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
