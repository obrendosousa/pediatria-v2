'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { NotificationToast } from '@/components/NotificationToast';
import type { Notification } from '@/components/NotificationToast';
import ConfirmModal from '@/components/ui/ConfirmModal';

type ToastMethods = {
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
  checkout: (patientName: string, total: number) => void;
  confirm: (message: string, title?: string) => Promise<boolean>;
};

interface ToastContextValue {
  toast: ToastMethods & {
    // Compatibilidade com componentes legados que chamam toast.toast.error(...)
    toast: ToastMethods;
  };
  addNotification: (notification: Omit<Notification, 'id'>) => string;
  dismissNotification: (id: string) => void;
  notifications: Notification[];
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION = 5000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [confirmState, setConfirmState] = useState<{ isOpen: boolean; title: string; message: string }>({
    isOpen: false,
    title: '',
    message: ''
  });
  const confirmResolveRef = useRef<(value: boolean) => void>(() => {});

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const addNotification = useCallback((notification: Omit<Notification, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const duration = notification.duration ?? DEFAULT_DURATION;
    const newNotification: Notification = {
      ...notification,
      id,
      duration: duration || DEFAULT_DURATION,
    };
    setNotifications((prev) => [...prev, newNotification]);
    if (duration > 0) {
      setTimeout(() => dismissNotification(id), duration);
    }
    return id;
  }, [dismissNotification]);

  const success = useCallback(
    (message: string, title?: string) => {
      addNotification({
        type: 'success',
        title: title ?? '',
        message,
        duration: DEFAULT_DURATION,
      });
    },
    [addNotification]
  );

  const error = useCallback(
    (message: string, title?: string) => {
      addNotification({
        type: 'error',
        title: title ?? 'Erro',
        message,
        duration: DEFAULT_DURATION,
      });
    },
    [addNotification]
  );

  const info = useCallback(
    (message: string, title?: string) => {
      addNotification({
        type: 'info',
        title: title ?? '',
        message,
        duration: DEFAULT_DURATION,
      });
    },
    [addNotification]
  );

  const checkout = useCallback(
    (patientName: string, total: number) => {
      addNotification({
        type: 'checkout',
        title: 'Novo Checkout Pendente',
        message: `${patientName} - Total: R$ ${total.toFixed(2)}`,
        duration: 8000,
      });
    },
    [addNotification]
  );

  const confirm = useCallback((message: string, title = 'Confirmar') => {
    return new Promise<boolean>((resolve) => {
      confirmResolveRef.current = resolve;
      setConfirmState({ isOpen: true, title, message });
    });
  }, []);

  const handleConfirmClose = useCallback(() => {
    confirmResolveRef.current(false);
    setConfirmState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const handleConfirmConfirm = useCallback(() => {
    confirmResolveRef.current(true);
    setConfirmState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const toastApi: ToastMethods = { success, error, info, checkout, confirm };

  const value: ToastContextValue = {
    toast: { ...toastApi, toast: toastApi },
    addNotification,
    dismissNotification,
    notifications,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <NotificationToast notifications={notifications} onDismiss={dismissNotification} />
      <ConfirmModal
        isOpen={confirmState.isOpen}
        onClose={handleConfirmClose}
        onConfirm={handleConfirmConfirm}
        title={confirmState.title}
        message={confirmState.message}
        type="warning"
        confirmText="Confirmar"
        cancelText="Cancelar"
      />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}
