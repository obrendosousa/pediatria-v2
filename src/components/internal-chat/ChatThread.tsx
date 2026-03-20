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
  Video,
} from 'lucide-react';
import { useInternalChat } from '@/contexts/InternalChatContext';
import { useAuth } from '@/contexts/AuthContext';
import InternalMessageBubble from './InternalMessageBubble';
import type { InternalMessageType } from '@/types/internal-chat';

const ACCEPTED_IMAGES = 'image/jpeg,image/png,image/gif,image/webp';
const ACCEPTED_DOCUMENTS = '.pdf,.doc,.docx,.xls,.xlsx,.txt';
const ACCEPTED_VIDEO = 'video/mp4,video/webm';
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
    activeMessages,
    conversations,
    sendMessage,
    goBackToList,
    markAsRead,
    loading,
    sendingFile,
  } = useInternalChat();

  const [text, setText] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingFilePreview, setPendingFilePreview] = useState<string | null>(null);
  const [showAttachMenu, setShowAttachMenu] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [activeMessages, scrollToBottom]);

  // Mark as read on open
  useEffect(() => {
    if (activeConversationId) {
      void markAsRead(activeConversationId);
    }
  }, [activeConversationId, markAsRead]);

  // Close attach menu on click outside
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

  // File preview cleanup
  useEffect(() => {
    return () => {
      if (pendingFilePreview) URL.revokeObjectURL(pendingFilePreview);
    };
  }, [pendingFilePreview]);

  const activeConv = conversations.find((c) => c.id === activeConversationId);
  const otherParticipant = activeConv?.participants?.find((p) => p.user_id !== user?.id);
  const otherName = otherParticipant?.profile?.full_name || 'Usuário';

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
      <div className="flex items-center gap-3 px-3 py-2.5 border-b border-[rgb(var(--border))] dark:border-[#2d2d36] shrink-0">
        <button
          onClick={goBackToList}
          className="p-1 rounded-lg hover:bg-[rgb(var(--muted))] dark:hover:bg-[#1c1c21] transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-[rgb(var(--muted-foreground))]" />
        </button>
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-pink-400 to-rose-400 dark:from-sky-400 dark:to-blue-500 flex items-center justify-center text-white text-xs font-semibold shrink-0">
          {getInitials(otherName)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[rgb(var(--foreground))] truncate">{otherName}</p>
          <p className="text-[11px] text-emerald-500 font-medium">Online</p>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1 scrollbar-thin bg-[rgb(var(--muted))]/30 dark:bg-[#0a0a0d]">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-[rgb(var(--muted-foreground))]" />
          </div>
        ) : activeMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-[rgb(var(--muted-foreground))]">
            <div className="w-16 h-16 rounded-full bg-[rgb(var(--muted))] dark:bg-[#1c1c21] flex items-center justify-center">
              <Send className="w-7 h-7 opacity-40" />
            </div>
            <p className="text-sm">Envie a primeira mensagem!</p>
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
        <div className="px-3 py-2 border-t border-[rgb(var(--border))] dark:border-[#2d2d36] bg-[rgb(var(--card))] dark:bg-[#131316]">
          <div className="flex items-center gap-2 p-2 rounded-xl bg-[rgb(var(--muted))] dark:bg-[#1c1c21]">
            {pendingFilePreview ? (
              <img
                src={pendingFilePreview}
                alt="Preview"
                className="w-12 h-12 rounded-lg object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-[rgb(var(--primary))]/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-[rgb(var(--primary))]" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-[rgb(var(--foreground))] truncate">
                {pendingFile.name}
              </p>
              <p className="text-[11px] text-[rgb(var(--muted-foreground))]">
                {formatFileSize(pendingFile.size)}
              </p>
            </div>
            <button
              onClick={clearPendingFile}
              className="p-1 rounded-full hover:bg-[rgb(var(--border))] dark:hover:bg-[#2d2d36] transition-colors"
            >
              <X className="w-4 h-4 text-[rgb(var(--muted-foreground))]" />
            </button>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="px-3 py-2 border-t border-[rgb(var(--border))] dark:border-[#2d2d36] shrink-0">
        <div className="flex items-end gap-2">
          {/* Attach Button */}
          <div className="relative" ref={attachMenuRef}>
            <button
              onClick={() => setShowAttachMenu(!showAttachMenu)}
              className="p-2 rounded-xl hover:bg-[rgb(var(--muted))] dark:hover:bg-[#1c1c21] transition-colors"
            >
              <Paperclip className="w-5 h-5 text-[rgb(var(--muted-foreground))]" />
            </button>

            {/* Attach Menu */}
            {showAttachMenu && (
              <div className="absolute bottom-12 left-0 bg-[rgb(var(--card))] dark:bg-[#1c1c21] rounded-xl shadow-xl border border-[rgb(var(--border))] dark:border-[#2d2d36] py-1.5 w-44 animate-chat-menu-in">
                <button
                  onClick={() => handleFileSelect(ACCEPTED_IMAGES)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-[rgb(var(--muted))] dark:hover:bg-[#252530] transition-colors text-[rgb(var(--foreground))]"
                >
                  <ImageIcon className="w-4 h-4 text-emerald-500" />
                  Imagem
                </button>
                <button
                  onClick={() => handleFileSelect(ACCEPTED_VIDEO)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-[rgb(var(--muted))] dark:hover:bg-[#252530] transition-colors text-[rgb(var(--foreground))]"
                >
                  <Video className="w-4 h-4 text-blue-500" />
                  Vídeo
                </button>
                <button
                  onClick={() => handleFileSelect(ACCEPTED_AUDIO)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-[rgb(var(--muted))] dark:hover:bg-[#252530] transition-colors text-[rgb(var(--foreground))]"
                >
                  <Mic className="w-4 h-4 text-orange-500" />
                  Áudio
                </button>
                <button
                  onClick={() => handleFileSelect(ACCEPTED_DOCUMENTS)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-[rgb(var(--muted))] dark:hover:bg-[#252530] transition-colors text-[rgb(var(--foreground))]"
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
              bg-[rgb(var(--muted))] dark:bg-[#0e0e11]
              text-[rgb(var(--foreground))]
              placeholder:text-[rgb(var(--muted-foreground))]
              border border-transparent
              focus:border-[rgb(var(--primary))] focus:outline-none
              transition-colors
              scrollbar-thin
            "
          />

          {/* Send Button */}
          <button
            onClick={() => void handleSend()}
            disabled={(!text.trim() && !pendingFile) || sendingFile}
            className="
              p-2 rounded-xl transition-all
              bg-gradient-to-br from-pink-500 to-rose-500
              dark:from-sky-500 dark:to-blue-600
              text-white
              hover:shadow-md hover:scale-105
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

        {/* Hidden file input */}
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
