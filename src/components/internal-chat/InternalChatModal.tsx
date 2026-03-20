'use client';

import React from 'react';
import { useInternalChat } from '@/contexts/InternalChatContext';
import ConversationList from './ConversationList';
import ChatThread from './ChatThread';

export default function InternalChatModal() {
  const { activeConversationId } = useInternalChat();

  return (
    <div
      className="
        fixed bottom-24 right-6 z-[9989]
        w-[380px] h-[520px]
        bg-[rgb(var(--card))] dark:bg-[#131316]
        rounded-2xl shadow-2xl
        border border-[rgb(var(--border))] dark:border-[#2d2d36]
        flex flex-col overflow-hidden
        animate-chat-modal-in
        print:hidden
      "
    >
      {activeConversationId ? <ChatThread /> : <ConversationList />}
    </div>
  );
}
