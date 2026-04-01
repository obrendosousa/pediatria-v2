'use client';

import { useEffect, useRef, useState } from 'react';
import { useCheckoutNotifications } from '@/contexts/CheckoutNotificationContext';
import { Stethoscope, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function CheckoutAlertPopup() {
  const { notifications, markAsRead } = useCheckoutNotifications();
  const router = useRouter();
  const [visibleToasts, setVisibleToasts] = useState<number[]>([]);
  const shownRef = useRef<Set<number>>(new Set());

  // Detectar novas notificacoes nao lidas e mostrar toast
  useEffect(() => {
    const newUnread = notifications.filter(n => !n.read && !shownRef.current.has(n.id));
    if (newUnread.length === 0) return;

    for (const n of newUnread) {
      shownRef.current.add(n.id);
      setVisibleToasts(prev => [...prev, n.id]);

      // Auto-dismiss apos 5 segundos
      setTimeout(() => {
        setVisibleToasts(prev => prev.filter(id => id !== n.id));
      }, 5000);
    }
  }, [notifications]);

  const handleClick = (id: number) => {
    markAsRead(id);
    setVisibleToasts(prev => prev.filter(tid => tid !== id));
    router.push('/crm');
  };

  const handleDismiss = (id: number) => {
    markAsRead(id);
    setVisibleToasts(prev => prev.filter(tid => tid !== id));
  };

  const activeToasts = visibleToasts
    .map(id => notifications.find(n => n.id === id))
    .filter(Boolean);

  if (activeToasts.length === 0) return null;

  return (
    <div className="fixed top-16 right-4 z-[200] space-y-2 max-w-xs">
      {activeToasts.map((notification) => {
        if (!notification) return null;
        return (
          <div
            key={notification.id}
            className="bg-white dark:bg-[#1c1c21] rounded-xl shadow-lg border border-slate-200 dark:border-[#3d3d48] overflow-hidden animate-in slide-in-from-top-2 fade-in duration-300 cursor-pointer group"
            onClick={() => handleClick(notification.id)}
          >
            <div className="p-3 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0 mt-0.5">
                <Stethoscope className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-800 dark:text-[#fafafa] truncate">
                  {notification.patientName}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-[#a1a1aa] mt-0.5">
                  Consulta finalizada. Aguardando checkout.
                </p>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleDismiss(notification.id); }}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 dark:text-[#71717a] opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="h-0.5 bg-purple-500 animate-shrink-width" />
          </div>
        );
      })}
    </div>
  );
}
