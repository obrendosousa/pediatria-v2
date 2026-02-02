'use client';

import { useEffect, useState } from 'react';
import { Bell, X, CheckCircle2, ShoppingBag, DollarSign } from 'lucide-react';

interface Notification {
  id: string;
  type: 'checkout' | 'info' | 'success';
  title: string;
  message: string;
  duration?: number;
}

interface NotificationToastProps {
  notifications: Notification[];
  onDismiss: (id: string) => void;
}

export function NotificationToast({ notifications, onDismiss }: NotificationToastProps) {
  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] space-y-2">
      {notifications.map(notification => (
        <div
          key={notification.id}
          className={`
            bg-white dark:bg-[#1e2028] rounded-xl shadow-2xl border-l-4 p-4 min-w-[320px] max-w-md
            animate-in slide-in-from-right fade-in
            ${notification.type === 'checkout' ? 'border-l-rose-500' : ''}
            ${notification.type === 'success' ? 'border-l-emerald-500' : ''}
            ${notification.type === 'info' ? 'border-l-blue-500' : ''}
          `}
        >
          <div className="flex items-start gap-3">
            <div className={`
              p-2 rounded-lg
              ${notification.type === 'checkout' ? 'bg-rose-100 dark:bg-rose-900/20' : ''}
              ${notification.type === 'success' ? 'bg-emerald-100 dark:bg-emerald-900/20' : ''}
              ${notification.type === 'info' ? 'bg-blue-100 dark:bg-blue-900/20' : ''}
            `}>
              {notification.type === 'checkout' && <ShoppingBag className="w-5 h-5 text-rose-600 dark:text-rose-400" />}
              {notification.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
              {notification.type === 'info' && <Bell className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-sm text-slate-800 dark:text-gray-100 mb-1">
                {notification.title}
              </h4>
              <p className="text-xs text-slate-600 dark:text-gray-400">
                {notification.message}
              </p>
            </div>
            <button
              onClick={() => onDismiss(notification.id)}
              className="p-1 hover:bg-slate-100 dark:hover:bg-white/10 rounded transition-colors"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// Hook para gerenciar notificações
export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = (notification: Omit<Notification, 'id'>) => {
    const id = `notif-${Date.now()}-${Math.random()}`;
    const newNotification: Notification = {
      ...notification,
      id,
      duration: notification.duration || 5000,
    };

    setNotifications(prev => [...prev, newNotification]);

    // Auto-dismiss após duração
    if (newNotification.duration > 0) {
      setTimeout(() => {
        dismissNotification(id);
      }, newNotification.duration);
    }

    return id;
  };

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const showCheckoutNotification = (patientName: string, total: number) => {
    addNotification({
      type: 'checkout',
      title: 'Novo Checkout Pendente',
      message: `${patientName} - Total: R$ ${total.toFixed(2)}`,
      duration: 8000,
    });
  };

  return {
    notifications,
    addNotification,
    dismissNotification,
    showCheckoutNotification,
  };
}
