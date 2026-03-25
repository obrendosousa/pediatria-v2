'use client';

import React from 'react';
import { MessageCircle, X } from 'lucide-react';
import { useInternalChat } from '@/contexts/InternalChatContext';
import { useAuth } from '@/contexts/AuthContext';
import InternalChatModal from './InternalChatModal';

export default function InternalChatFab() {
  const { user } = useAuth();
  const { isOpen, setIsOpen, totalUnread } = useInternalChat();

  if (!user) return null;

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="
          fixed bottom-6 right-6 z-[9990]
          w-14 h-14 rounded-full
          bg-gradient-to-br from-pink-500 to-rose-500
          dark:from-sky-500 dark:to-blue-600
          text-white shadow-lg
          hover:shadow-xl hover:scale-105
          active:scale-95
          transition-all duration-200 ease-out
          flex items-center justify-center
          group
          print:hidden
        "
        aria-label={isOpen ? 'Fechar chat interno' : 'Abrir chat interno'}
      >
        <div className="relative">
          {isOpen ? (
            <X className="w-6 h-6 transition-transform duration-200 group-hover:rotate-90" />
          ) : (
            <MessageCircle className="w-6 h-6 transition-transform duration-200 group-hover:scale-110" />
          )}

          {/* Unread badge */}
          {!isOpen && totalUnread > 0 && (
            <span className="
              absolute -top-2.5 -right-2.5
              min-w-[20px] h-5 px-1.5
              bg-red-500 text-white text-[11px] font-bold
              rounded-full flex items-center justify-center
              animate-bounce-subtle
              shadow-md
            ">
              {totalUnread > 99 ? '99+' : totalUnread}
            </span>
          )}
        </div>
      </button>

      {/* Chat Modal */}
      {isOpen && <InternalChatModal />}
    </>
  );
}
