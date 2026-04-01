/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useEffect, useRef } from 'react';
import { useInternalChat } from '@/contexts/InternalChatContext';
import ConversationList from './ConversationList';
import ChatThread from './ChatThread';

interface InternalChatPanelProps {
  anchorRef: React.RefObject<HTMLButtonElement | null>;
}

export default function InternalChatPanel({ anchorRef }: InternalChatPanelProps) {
  const { activeConversationId, setIsOpen } = useInternalChat();
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    // Close on Escape
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false);
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [anchorRef, setIsOpen]);

  return (
    <div
      ref={panelRef}
      className="
        absolute top-full right-0 mt-2 z-[9999]
        w-[360px] h-[520px]
        bg-white dark:bg-[#111114]
        rounded-2xl shadow-2xl shadow-black/10 dark:shadow-black/40
        border border-slate-200 dark:border-[#2a2a30]
        flex flex-col overflow-hidden
        animate-in fade-in slide-in-from-top-2 duration-200
        print:hidden
      "
      style={{
        animation: 'chatPanelIn 0.2s ease-out',
      }}
    >
      {activeConversationId ? <ChatThread /> : <ConversationList />}
    </div>
  );
}
