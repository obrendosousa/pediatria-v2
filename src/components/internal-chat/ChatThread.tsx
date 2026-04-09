/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Send,
  Paperclip,
  Image as ImageIcon,
  FileText,
  X,
  Loader2,
  Mic,
} from 'lucide-react';
import { useInternalChat } from '@/contexts/InternalChatContext';
import { useAuth } from '@/contexts/AuthContext';
import InternalMessageBubble from './InternalMessageBubble';
import type { InternalMessageType } from '@/types/internal-chat';

const ACCEPTED_IMAGES = 'image/jpeg,image/png,image/gif,image/webp';
const ACCEPTED_DOCUMENTS = '.pdf,.doc,.docx,.xls,.xlsx,.txt';
const ACCEPTED_AUDIO = 'audio/mpeg,audio/ogg,audio/wav,audio/webm';

function detectFileType(file: File): InternalMessageType {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  return 'document';
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ChatThread() {
  const { user } = useAuth();
  const {
    activeConversationId,
    activePartnerId,
    activeMessages,
    conversations,
    users,
    sendMessage,
    goBackToList,
    markAsRead,
    loading,
    sendingFile,
    isUserOnline,
  } = useInternalChat();

  const [text, setText] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingFilePreview, setPendingFilePreview] = useState<string | null>(null);
  const [showAttachMenu, setShowAttachMenu] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [activeMessages, scrollToBottom]);

  useEffect(() => {
    if (activeConversationId) {
      void markAsRead(activeConversationId);
    }
  }, [activeConversationId, markAsRead]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) {
        setShowAttachMenu(false);
      }
    }
    if (showAttachMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showAttachMenu]);

  useEffect(() => {
    return () => {
      if (pendingFilePreview) URL.revokeObjectURL(pendingFilePreview);
    };
  }, [pendingFilePreview]);

  const activeConv = conversations.find((c) => c.id === activeConversationId);
  const otherParticipant = activeConv?.participants?.find((p) => p.user_id !== user?.id);
  const otherId = otherParticipant?.user_id || activePartnerId || '';

  // Fallback: if participant profile isn't loaded yet, find from users list
  const userFromList = users.find((u) => u.id === otherId);
  const otherName = otherParticipant?.profile?.full_name || userFromList?.full_name || 'Usuario';
  const otherPhoto = otherParticipant?.profile?.photo_url || userFromList?.photo_url || null;
  const otherOnline = isUserOnline(otherId);

  function getInitials(name: string): string {
    return name
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
  }

  function handleFileSelect(accept: string) {
    if (fileInputRef.current) {
      fileInputRef.current.accept = accept;
      fileInputRef.current.click();
    }
    setShowAttachMenu(false);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setPendingFile(file);
    if (file.type.startsWith('image/')) {
      setPendingFilePreview(URL.createObjectURL(file));
    } else {
      setPendingFilePreview(null);
    }
    e.target.value = '';
  }

  function clearPendingFile() {
    if (pendingFilePreview) URL.revokeObjectURL(pendingFilePreview);
    setPendingFile(null);
    setPendingFilePreview(null);
  }

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed && !pendingFile) return;

    if (pendingFile) {
      const type = detectFileType(pendingFile);
      await sendMessage(trimmed || '', type, pendingFile);
      clearPendingFile();
    } else {
      await sendMessage(trimmed, 'text');
    }
    setText('');
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-3 py-2.5 border-b border-slate-100 dark:border-[#1e1e24] shrink-0">
        <button
          onClick={goBackToList}
          className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
        >
          <ArrowLeft className="w-4.5 h-4.5 text-slate-400 dark:text-[#71717a]" />
        </button>

        {/* Avatar with online status */}
        <div className="relative shrink-0">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-pink-400 to-rose-400 dark:from-sky-400 dark:to-blue-500 flex items-center justify-center text-white text-xs font-semibold overflow-hidden">
            {otherPhoto ? (
              <img src={otherPhoto} alt="" className="w-full h-full object-cover" />
            ) : (
              getInitials(otherName)
            )}
          </div>
          <div className={`
            absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-[#111114]
            ${otherOnline ? 'bg-emerald-400' : 'bg-slate-300 dark:bg-[#3f3f46]'}
          `} />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800 dark:text-[#e4e4e7] truncate">{otherName}</p>
          <p className={`text-[11px] font-medium ${
            otherOnline
              ? 'text-emerald-500 dark:text-emerald-400'
              : 'text-slate-400 dark:text-[#52525b]'
          }`}>
            {otherOnline ? 'Online' : 'Offline'}
          </p>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1 scrollbar-thin bg-slate-50/50 dark:bg-[#0a0a0d]">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400 dark:text-[#52525b]" />
          </div>
        ) : activeMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400 dark:text-[#52525b]">
            <div className="w-14 h-14 rounded-2xl bg-white dark:bg-[#1c1c21] flex items-center justify-center shadow-sm">
              <Send className="w-6 h-6 opacity-40" />
            </div>
            <p className="text-xs">Envie a primeira mensagem!</p>
          </div>
        ) : (
          activeMessages.map((msg, idx) => {
            const isMe = msg.sender_id === user?.id;
            const prev = activeMessages[idx - 1];
            const showTime = !prev ||
              new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime() > 300000 ||
              prev.sender_id !== msg.sender_id;

            return (
              <InternalMessageBubble
                key={msg.id}
                message={msg}
                isMe={isMe}
                showTimestamp={showTime}
              />
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* File Preview */}
      {pendingFile && (
        <div className="px-3 py-2 border-t border-slate-100 dark:border-[#1e1e24] bg-white dark:bg-[#111114]">
          <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-[#0a0a0d]">
            {pendingFilePreview ? (
              <img
                src={pendingFilePreview}
                alt="Preview"
                className="w-12 h-12 rounded-lg object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-pink-50 dark:bg-sky-500/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-pink-500 dark:text-sky-400" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-700 dark:text-[#d4d4d8] truncate">
                {pendingFile.name}
              </p>
              <p className="text-[11px] text-slate-400 dark:text-[#52525b]">
                {formatFileSize(pendingFile.size)}
              </p>
            </div>
            <button
              onClick={clearPendingFile}
              className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-[#1e1e24] transition-colors"
            >
              <X className="w-4 h-4 text-slate-400 dark:text-[#52525b]" />
            </button>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="px-3 py-2 border-t border-slate-100 dark:border-[#1e1e24] shrink-0 bg-white dark:bg-[#111114]">
        <div className="flex items-end gap-2">
          {/* Attach Button */}
          <div className="relative" ref={attachMenuRef}>
            <button
              onClick={() => setShowAttachMenu(!showAttachMenu)}
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
            >
              <Paperclip className="w-5 h-5 text-slate-400 dark:text-[#52525b]" />
            </button>

            {showAttachMenu && (
              <div className="absolute bottom-12 left-0 bg-white dark:bg-[#1c1c21] rounded-xl shadow-xl border border-slate-200 dark:border-[#2a2a30] py-1.5 w-44"
                style={{ animation: 'chatPanelIn 0.15s ease-out' }}
              >
                <button
                  onClick={() => handleFileSelect(ACCEPTED_IMAGES)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-slate-700 dark:text-[#d4d4d8]"
                >
                  <ImageIcon className="w-4 h-4 text-emerald-500" />
                  Imagem
                </button>
                <button
                  onClick={() => handleFileSelect(ACCEPTED_AUDIO)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-slate-700 dark:text-[#d4d4d8]"
                >
                  <Mic className="w-4 h-4 text-orange-500" />
                  Audio
                </button>
                <button
                  onClick={() => handleFileSelect(ACCEPTED_DOCUMENTS)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-slate-700 dark:text-[#d4d4d8]"
                >
                  <FileText className="w-4 h-4 text-violet-500" />
                  Documento
                </button>
              </div>
            )}
          </div>

          {/* Text Input */}
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite uma mensagem..."
            rows={1}
            className="
              flex-1 resize-none
              max-h-24 py-2 px-3 text-sm rounded-xl
              bg-slate-50 dark:bg-[#0a0a0d]
              text-slate-800 dark:text-[#e4e4e7]
              placeholder:text-slate-400 dark:placeholder:text-[#52525b]
              border border-slate-200 dark:border-[#1e1e24]
              focus:border-pink-300 dark:focus:border-sky-500/50 focus:outline-none
              focus:ring-2 focus:ring-pink-100 dark:focus:ring-sky-500/10
              transition-all scrollbar-thin
            "
          />

          {/* Send Button */}
          <button
            onClick={() => void handleSend()}
            disabled={(!text.trim() && !pendingFile) || sendingFile}
            className="
              p-2 rounded-xl transition-all
              bg-slate-800 dark:bg-slate-600
              text-white
              hover:bg-slate-700 dark:hover:bg-slate-500
              hover:shadow-md
              active:scale-95
              disabled:opacity-40 disabled:hover:scale-100 disabled:hover:shadow-none
            "
          >
            {sendingFile ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
}
