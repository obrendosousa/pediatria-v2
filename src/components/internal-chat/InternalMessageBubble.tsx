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
      <button onClick={() => setExpanded(true)} className="block rounded-lg overflow-hidden max-w-[220px] relative group">
        {!loaded && (
          <div className="w-[220px] h-[140px] bg-slate-100 dark:bg-[#1c1c21] animate-pulse rounded-lg" />
        )}
        <img
          src={url}
          alt={name || 'Imagem'}
          onLoad={() => setLoaded(true)}
          className={`max-w-[220px] rounded-lg cursor-pointer transition-opacity ${loaded ? 'opacity-100' : 'opacity-0 absolute inset-0'}`}
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-lg" />
      </button>
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
    <video src={url} controls preload="metadata" className="max-w-[240px] rounded-lg" />
  );
}

function AudioContent({ url }: { url: string }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = React.useRef<HTMLAudioElement>(null);

  function togglePlay() {
    if (!audioRef.current) return;
    if (playing) audioRef.current.pause();
    else void audioRef.current.play();
    setPlaying(!playing);
  }

  return (
    <div className="flex items-center gap-2 min-w-[160px]">
      <button
        onClick={togglePlay}
        className="w-8 h-8 rounded-full bg-slate-200 dark:bg-[#2a2a30] flex items-center justify-center shrink-0 hover:bg-slate-300 dark:hover:bg-[#3a3a40] transition-colors"
      >
        {playing ? (
          <Pause className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
        ) : (
          <Play className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300 ml-0.5" />
        )}
      </button>
      <div className="flex-1 h-1 rounded-full bg-slate-200 dark:bg-[#2d2d36] overflow-hidden">
        <div className="h-full w-0 bg-slate-400 dark:bg-slate-500 rounded-full transition-all" />
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

function PdfPreview({ url, name, size }: { url: string; name?: string | null; size?: number | null }) {
  const displayName = name || 'Documento';

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-lg overflow-hidden bg-white dark:bg-[#161619] hover:bg-slate-50 dark:hover:bg-[#1c1c21] transition-colors group w-[190px]"
    >
      {/* PDF preview */}
      <div className="overflow-hidden relative bg-white" style={{ height: 100 }}>
        <iframe
          src={`${url}#page=1&view=FitH&toolbar=0&navpanes=0&scrollbar=0`}
          title={displayName}
          className="border-0 pointer-events-none origin-top-left"
          style={{ width: 570, height: 760, transform: 'scale(0.333)', transformOrigin: 'top left' }}
        />
        <div className="absolute inset-0" />
      </div>
      {/* File info */}
      <div className="flex items-center gap-2 px-2 py-1.5">
        <FileText className="w-4 h-4 text-red-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-medium text-slate-700 dark:text-[#d4d4d8] truncate">{displayName}</p>
          <p className="text-[9px] text-slate-400 dark:text-[#52525b]">PDF {size ? `· ${formatFileSize(size)}` : ''}</p>
        </div>
        <Download className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      </div>
    </a>
  );
}

function DocumentContent({ url, name, size }: { url: string; name?: string | null; size?: number | null }) {
  const displayName = name || 'Documento';
  const ext = displayName.split('.').pop()?.toLowerCase() || '';

  // PDF gets special preview
  if (ext === 'pdf') {
    return <PdfPreview url={url} name={name} size={size} />;
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-[#0e0e11] hover:bg-slate-100 dark:hover:bg-[#1c1c21] transition-colors group min-w-[180px] border border-slate-200/60 dark:border-[#2a2a30]"
    >
      <div className="w-9 h-9 rounded-lg bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center shrink-0">
        <FileText className="w-4.5 h-4.5 text-violet-500 dark:text-violet-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium truncate text-slate-700 dark:text-[#d4d4d8]">
          {displayName}
        </p>
        <p className="text-[10px] text-slate-400 dark:text-[#52525b]">
          {ext.toUpperCase()} {size ? `· ${formatFileSize(size)}` : ''}
        </p>
      </div>
      <Download className="w-3.5 h-3.5 text-slate-300 dark:text-[#3a3a40] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
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
          <span className="text-[10px] text-slate-400 dark:text-[#52525b] bg-white/80 dark:bg-[#111114]/80 px-2.5 py-0.5 rounded-full">
            {formatTime(message.created_at)}
            {!isMe && senderName ? ` · ${senderName}` : ''}
          </span>
        </div>
      )}

      {/* Message bubble */}
      <div
        className={`
          max-w-[82%] rounded-2xl px-3 py-2 text-sm
          animate-chat-msg-in
          ${isMe
            ? 'bg-slate-800 dark:bg-slate-700 text-white rounded-br-md'
            : 'bg-white dark:bg-[#1c1c21] text-slate-800 dark:text-[#e4e4e7] rounded-bl-md shadow-sm border border-slate-100 dark:border-[#2a2a30]'
          }
        `}
      >
        {message.message_type === 'text' && (
          <p className="whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
        )}

        {message.message_type === 'image' && message.file_url && (
          <div className="space-y-1.5">
            <ImageContent url={message.file_url} name={message.file_name} />
            {message.content && (
              <p className="whitespace-pre-wrap break-words text-xs leading-relaxed">{message.content}</p>
            )}
          </div>
        )}

        {message.message_type === 'video' && message.file_url && (
          <div className="space-y-1.5">
            <VideoContent url={message.file_url} />
            {message.content && (
              <p className="whitespace-pre-wrap break-words text-xs leading-relaxed">{message.content}</p>
            )}
          </div>
        )}

        {message.message_type === 'audio' && message.file_url && (
          <AudioContent url={message.file_url} />
        )}

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
        <div className={`flex justify-end mt-0.5 ${isMe ? 'text-white/50' : 'text-slate-400 dark:text-[#52525b]'}`}>
          <span className="text-[10px]">{formatTime(message.created_at)}</span>
        </div>
      </div>
    </div>
  );
}
