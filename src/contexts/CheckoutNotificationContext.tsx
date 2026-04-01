'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

const STORAGE_KEY = 'checkout_notifications_history';
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

interface CheckoutNotification {
  id: number;
  patientName: string;
  timestamp: string;
  read: boolean;
}

interface CheckoutNotificationContextValue {
  pendingCount: number;
  notifications: CheckoutNotification[];
  unreadCount: number;
  markAsRead: (id: number) => void;
  markAllAsRead: () => void;
  dismissNotification: (id: number) => void;
  clearAll: () => void;
}

const CheckoutNotificationContext = createContext<CheckoutNotificationContextValue>({
  pendingCount: 0,
  notifications: [],
  unreadCount: 0,
  markAsRead: () => {},
  markAllAsRead: () => {},
  dismissNotification: () => {},
  clearAll: () => {}
});

function playNotificationSound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
    osc.onended = () => ctx.close();
  } catch {
    // Silencioso se AudioContext nao disponivel
  }
}

function loadStoredNotifications(): CheckoutNotification[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CheckoutNotification[];
    const cutoff = Date.now() - TWENTY_FOUR_HOURS;
    return parsed.filter(n => new Date(n.timestamp).getTime() > cutoff);
  } catch {
    return [];
  }
}

function saveNotifications(notifications: CheckoutNotification[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
  } catch {
    // Silencioso
  }
}

export function CheckoutNotificationProvider({ children }: { children: React.ReactNode }) {
  const [pendingCount, setPendingCount] = useState(0);
  const [notifications, setNotifications] = useState<CheckoutNotification[]>(() => loadStoredNotifications());
  const knownIdsRef = useRef<Set<number>>(new Set());
  const initializedRef = useRef(false);

  // Persistir no localStorage quando mudar
  useEffect(() => {
    saveNotifications(notifications);
  }, [notifications]);

  // Limpar notificacoes > 24h periodicamente
  useEffect(() => {
    const interval = setInterval(() => {
      const cutoff = Date.now() - TWENTY_FOUR_HOURS;
      setNotifications(prev => {
        const filtered = prev.filter(n => new Date(n.timestamp).getTime() > cutoff);
        return filtered.length !== prev.length ? filtered : prev;
      });
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

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

  // Carga inicial — sincroniza notificacoes do localStorage com estado real do banco
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

      const activeIds = new Set<number>();
      if (data) {
        for (const apt of data) {
          knownIdsRef.current.add(apt.id);
          activeIds.add(apt.id);
        }
      }

      // Remover notificacoes de checkouts que ja foram finalizados
      setNotifications(prev => {
        const filtered = prev.filter(n => activeIds.has(n.id));
        return filtered.length !== prev.length ? filtered : prev;
      });
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

          if (newStatus === 'waiting_payment' && oldStatus !== 'waiting_payment') {
            const name = (payload.new?.patient_name as string) || 'Paciente';

            setPendingCount(prev => prev + 1);

            if (!knownIdsRef.current.has(aptId)) {
              knownIdsRef.current.add(aptId);
              setNotifications(prev => [
                { id: aptId, patientName: name, timestamp: new Date().toISOString(), read: false },
                ...prev
              ]);
              playNotificationSound();
            }

            syncFromDatabase();
          }

          if (oldStatus === 'waiting_payment' && newStatus !== 'waiting_payment') {
            knownIdsRef.current.delete(aptId);
            setPendingCount(prev => Math.max(0, prev - 1));
            setNotifications(prev => prev.filter(n => n.id !== aptId));
            syncFromDatabase();
          }

          if (newStatus === 'waiting_payment' && oldStatus === undefined) {
            syncFromDatabase();
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'medical_checkouts' },
        () => {
          setTimeout(() => syncFromDatabase(), 1500);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [syncFromDatabase]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = useCallback((id: number) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const dismissNotification = useCallback((id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  return (
    <CheckoutNotificationContext.Provider value={{
      pendingCount,
      notifications,
      unreadCount,
      markAsRead,
      markAllAsRead,
      dismissNotification,
      clearAll
    }}>
      {children}
    </CheckoutNotificationContext.Provider>
  );
}

export function useCheckoutNotifications() {
  return useContext(CheckoutNotificationContext);
}
