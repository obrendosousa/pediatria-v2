/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState } from 'react';
import { Download, FileText, Play, Pause } from 'lucide-react';
import type { InternalMessage } from '@/types/internal-chat';

interface InternalMessageBubbleProps {
  message: InternalMessage;
  isMe: boolean;
  showTimestamp: boolean;
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ImageContent({ url, name }: { url: string; name?: string | null }) {
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <button onClick={() => setExpanded(true)} className="block rounded-lg overflow-hidden max-w-[240px] relative group">
        {!loaded && (
          <div className="w-[240px] h-[160px] bg-[rgb(var(--muted))] dark:bg-[#1c1c21] animate-pulse rounded-lg" />
        )}
        <img
          src={url}
          alt={name || 'Imagem'}
          onLoad={() => setLoaded(true)}
          className={`max-w-[240px] rounded-lg cursor-pointer transition-opacity ${loaded ? 'opacity-100' : 'opacity-0 absolute inset-0'}`}
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-lg" />
      </button>

      {/* Lightbox */}
      {expanded && (
        <div
          className="fixed inset-0 z-[99999] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setExpanded(false)}
        >
          <img
            src={url}
            alt={name || 'Imagem'}
            className="max-w-full max-h-full rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}

function VideoContent({ url }: { url: string }) {
  return (
    <video
      src={url}
      controls
      preload="metadata"
      className="max-w-[260px] rounded-lg"
    />
  );
}

function AudioContent({ url }: { url: string }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = React.useRef<HTMLAudioElement>(null);

  function togglePlay() {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      void audioRef.current.play();
    }
    setPlaying(!playing);
  }

  return (
    <div className="flex items-center gap-2 min-w-[180px]">
      <button
        onClick={togglePlay}
        className="w-9 h-9 rounded-full bg-[rgb(var(--primary))]/20 flex items-center justify-center shrink-0 hover:bg-[rgb(var(--primary))]/30 transition-colors"
      >
        {playing ? (
          <Pause className="w-4 h-4 text-[rgb(var(--primary))]" />
        ) : (
          <Play className="w-4 h-4 text-[rgb(var(--primary))] ml-0.5" />
        )}
      </button>
      <div className="flex-1 h-1.5 rounded-full bg-[rgb(var(--muted))] dark:bg-[#2d2d36] overflow-hidden">
        <div className="h-full w-0 bg-[rgb(var(--primary))] rounded-full transition-all" />
      </div>
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onEnded={() => setPlaying(false)}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
      />
    </div>
  );
}

function DocumentContent({ url, name, size }: { url: string; name?: string | null; size?: number | null }) {
  const displayName = name || 'Documento';
  const ext = displayName.split('.').pop()?.toUpperCase() || 'FILE';

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 p-2.5 rounded-xl bg-[rgb(var(--muted))]/50 dark:bg-[#0e0e11]/50 hover:bg-[rgb(var(--muted))] dark:hover:bg-[#1c1c21] transition-colors group min-w-[200px]"
    >
      <div className="w-10 h-10 rounded-lg bg-[rgb(var(--primary))]/10 flex items-center justify-center shrink-0">
        <FileText className="w-5 h-5 text-[rgb(var(--primary))]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate text-[rgb(var(--foreground))]">
          {displayName}
        </p>
        <p className="text-[10px] text-[rgb(var(--muted-foreground))]">
          {ext} {size ? `• ${formatFileSize(size)}` : ''}
        </p>
      </div>
      <Download className="w-4 h-4 text-[rgb(var(--muted-foreground))] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </a>
  );
}

export default function InternalMessageBubble({ message, isMe, showTimestamp }: InternalMessageBubbleProps) {
  const senderName = message.sender_profile?.full_name?.split(' ')[0] || '';

  return (
    <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
      {/* Timestamp separator */}
      {showTimestamp && (
        <div className="flex items-center gap-2 w-full justify-center my-2">
          <span className="text-[10px] text-[rgb(var(--muted-foreground))] bg-[rgb(var(--card))]/80 dark:bg-[#131316]/80 px-2.5 py-0.5 rounded-full">
            {formatTime(message.created_at)}
            {!isMe && senderName ? ` • ${senderName}` : ''}
          </span>
        </div>
      )}

      {/* Message bubble */}
      <div
        className={`
          max-w-[85%] rounded-2xl px-3 py-2 text-sm
          animate-chat-msg-in
          ${isMe
            ? 'bg-gradient-to-br from-pink-500 to-rose-500 dark:from-sky-500 dark:to-blue-600 text-white rounded-br-md'
            : 'bg-[rgb(var(--card))] dark:bg-[#1c1c21] text-[rgb(var(--foreground))] rounded-bl-md shadow-sm border border-[rgb(var(--border))]/50 dark:border-[#2d2d36]/50'
          }
        `}
      >
        {/* Text content */}
        {message.message_type === 'text' && (
          <p className="whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
        )}

        {/* Image content */}
        {message.message_type === 'image' && message.file_url && (
          <div className="space-y-1.5">
            <ImageContent url={message.file_url} name={message.file_name} />
            {message.content && (
              <p className="whitespace-pre-wrap break-words text-xs leading-relaxed">{message.content}</p>
            )}
          </div>
        )}

        {/* Video content */}
        {message.message_type === 'video' && message.file_url && (
          <div className="space-y-1.5">
            <VideoContent url={message.file_url} />
            {message.content && (
              <p className="whitespace-pre-wrap break-words text-xs leading-relaxed">{message.content}</p>
            )}
          </div>
        )}

        {/* Audio content */}
        {message.message_type === 'audio' && message.file_url && (
          <AudioContent url={message.file_url} />
        )}

        {/* Document content */}
        {message.message_type === 'document' && message.file_url && (
          <div className="space-y-1.5">
            <DocumentContent
              url={message.file_url}
              name={message.file_name}
              size={message.file_size}
            />
            {message.content && message.content !== message.file_name && (
              <p className="whitespace-pre-wrap break-words text-xs leading-relaxed">{message.content}</p>
            )}
          </div>
        )}

        {/* Time inside bubble */}
        <div className={`flex justify-end mt-0.5 ${isMe ? 'text-white/60' : 'text-[rgb(var(--muted-foreground))]'}`}>
          <span className="text-[10px]">{formatTime(message.created_at)}</span>
        </div>
      </div>
    </div>
  );
}
