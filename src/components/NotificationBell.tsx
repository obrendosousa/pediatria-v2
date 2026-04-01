'use client';

import { useState, useRef, useEffect } from 'react';
import { Bell, Stethoscope, Check, CheckCheck, Trash2, X } from 'lucide-react';
import { useCheckoutNotifications } from '@/contexts/CheckoutNotificationContext';
import { useRouter } from 'next/navigation';

function timeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return 'ontem';
}

export default function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, dismissNotification, clearAll } = useCheckoutNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Fechar ao clicar fora
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const handleNotificationClick = (id: number) => {
    markAsRead(id);
    setIsOpen(false);
    router.push('/crm');
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
        title="Notificacoes"
      >
        <Bell className={`w-[18px] h-[18px] ${unreadCount > 0 ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400 dark:text-[#71717a]'} transition-colors`} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-purple-600 text-white text-[10px] font-bold ring-2 ring-white dark:ring-[#0c0c10]">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-[#141419] rounded-xl shadow-2xl border border-slate-200 dark:border-[#2d2d36] overflow-hidden z-[250] animate-in fade-in slide-in-from-top-1 duration-200">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-100 dark:border-[#2d2d36] flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 dark:text-[#fafafa]">Notificacoes</h3>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 dark:text-[#71717a] transition-colors"
                  title="Marcar todas como lidas"
                >
                  <CheckCheck className="w-4 h-4" />
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={() => { clearAll(); setIsOpen(false); }}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 dark:text-[#71717a] transition-colors"
                  title="Limpar tudo"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Notification List */}
          <div className="max-h-80 overflow-y-auto custom-scrollbar">
            {notifications.length === 0 ? (
              <div className="py-10 px-4 text-center">
                <Bell className="w-8 h-8 text-slate-200 dark:text-[#3d3d48] mx-auto mb-2" />
                <p className="text-xs text-slate-400 dark:text-[#71717a]">Nenhuma notificacao</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors group border-b border-slate-50 dark:border-[#1f1f26] last:border-0 ${
                    notification.read
                      ? 'hover:bg-slate-50 dark:hover:bg-white/[0.02]'
                      : 'bg-purple-50/50 dark:bg-purple-900/10 hover:bg-purple-50 dark:hover:bg-purple-900/15'
                  }`}
                  onClick={() => handleNotificationClick(notification.id)}
                >
                  {/* Icon */}
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                    notification.read
                      ? 'bg-slate-100 dark:bg-[#2d2d36]'
                      : 'bg-purple-100 dark:bg-purple-900/30'
                  }`}>
                    <Stethoscope className={`w-4 h-4 ${
                      notification.read
                        ? 'text-slate-400 dark:text-[#71717a]'
                        : 'text-purple-600 dark:text-purple-400'
                    }`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-xs truncate ${
                        notification.read
                          ? 'font-medium text-slate-600 dark:text-[#a1a1aa]'
                          : 'font-bold text-slate-800 dark:text-[#fafafa]'
                      }`}>
                        {notification.patientName}
                      </p>
                      {!notification.read && (
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 dark:text-[#71717a] mt-0.5">
                      Aguardando checkout
                    </p>
                    <p className="text-[10px] text-slate-300 dark:text-[#52525b] mt-0.5">
                      {timeAgo(notification.timestamp)}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!notification.read && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); markAsRead(notification.id); }}
                        className="p-1 rounded hover:bg-white dark:hover:bg-white/10 text-slate-400 dark:text-[#71717a]"
                        title="Marcar como lida"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); dismissNotification(notification.id); }}
                      className="p-1 rounded hover:bg-white dark:hover:bg-white/10 text-slate-400 dark:text-[#71717a]"
                      title="Remover"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2 border-t border-slate-100 dark:border-[#2d2d36] bg-slate-50/50 dark:bg-[#0f0f14]">
              <p className="text-[10px] text-slate-400 dark:text-[#52525b] text-center">
                Mostrando notificacoes das ultimas 24h
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
