'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, FileText, File, FileSpreadsheet, FileCode, Archive } from 'lucide-react';

interface FilePreviewModalProps {
  file: File | null;
  onSend: (file: File, caption: string) => void;
  onClose: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getDocumentIcon(mime: string, fileName: string) {
  const lower = fileName.toLowerCase();
  if (mime.includes('pdf') || lower.endsWith('.pdf')) {
    return { icon: FileText, color: 'text-rose-500', bg: 'bg-rose-100 dark:bg-rose-900/30', label: 'PDF' };
  }
  if (mime.includes('spreadsheet') || mime.includes('excel') || lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.csv')) {
    return { icon: FileSpreadsheet, color: 'text-emerald-500', bg: 'bg-emerald-100 dark:bg-emerald-900/30', label: 'Planilha' };
  }
  if (mime.includes('zip') || mime.includes('rar') || mime.includes('tar') || lower.endsWith('.zip') || lower.endsWith('.rar')) {
    return { icon: Archive, color: 'text-amber-500', bg: 'bg-amber-100 dark:bg-amber-900/30', label: 'Arquivo' };
  }
  if (mime.includes('text') || lower.endsWith('.txt') || lower.endsWith('.md')) {
    return { icon: FileCode, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30', label: 'Texto' };
  }
  return { icon: File, color: 'text-gray-500', bg: 'bg-gray-100 dark:bg-gray-700', label: 'Documento' };
}

export default function FilePreviewModal({ file, onSend, onClose }: FilePreviewModalProps) {
  const [caption, setCaption] = useState('');
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const captionRef = useRef<HTMLInputElement>(null);

  const isImage = file ? file.type.startsWith('image/') : false;
  const isVideo = file ? file.type.startsWith('video/') : false;
  const isVisual = isImage || isVideo;

  useEffect(() => {
    if (!file) {
      setImagePreviewUrl(null);
      setCaption('');
      return;
    }
    if (isVisual) {
      const url = URL.createObjectURL(file);
      setImagePreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setImagePreviewUrl(null);
  }, [file, isVisual]);

  useEffect(() => {
    if (file) {
      setTimeout(() => captionRef.current?.focus(), 150);
    }
  }, [file]);

  const handleSend = useCallback(() => {
    if (!file) return;
    onSend(file, caption.trim());
    setCaption('');
  }, [file, caption, onSend]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); handleSend(); }
    if (e.key === 'Escape') { onClose(); }
  }, [handleSend, onClose]);

  if (!file) return null;

  const docInfo = !isVisual ? getDocumentIcon(file.type, file.name) : null;
  const DocIcon = docInfo?.icon ?? File;

  return (
    <div
      className="absolute inset-0 z-[9999] flex flex-col rounded-none"
      style={{ backgroundColor: 'rgba(11, 20, 26, 0.97)' }}
    >
      {/* Cabeçalho */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <button
          onClick={onClose}
          className="p-2 rounded-full hover:bg-white/10 transition-colors text-white"
          title="Cancelar"
        >
          <X size={24} />
        </button>
        {!isVisual && (
          <span className="text-white text-sm font-medium truncate max-w-[60%] text-center">
            {file.name}
          </span>
        )}
        <div className="w-10" />
      </div>

      {/* ── Área de preview (imagem/vídeo) com legenda sobreposta ── */}
      {isVisual ? (
        <div className="flex-1 relative flex items-center justify-center overflow-hidden">
          {isImage && imagePreviewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imagePreviewUrl}
              alt="Preview"
              className="max-h-full max-w-full object-contain"
            />
          )}
          {isVideo && imagePreviewUrl && (
            <video
              src={imagePreviewUrl}
              controls
              className="max-h-full max-w-full object-contain"
            />
          )}

          {/* Barra de legenda sobreposta — igual ao WhatsApp */}
          <div className="absolute bottom-0 left-0 right-0 flex items-center gap-3 px-4 py-3"
            style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)' }}>
            <div className="flex-1 bg-transparent border-b border-white/50 flex items-center">
              <input
                ref={captionRef}
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Adicione uma legenda..."
                className="flex-1 bg-transparent text-white placeholder-white/60 text-sm outline-none py-1.5"
              />
            </div>
            <button
              onClick={handleSend}
              className="w-12 h-12 rounded-full bg-[#00a884] hover:bg-[#008f6f] flex items-center justify-center transition-all shadow-lg active:scale-95 shrink-0"
              title="Enviar"
            >
              <Send size={20} className="text-white ml-0.5" />
            </button>
          </div>
        </div>
      ) : (
        /* ── Área de preview para documentos ── */
        <>
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className={`w-28 h-28 rounded-2xl ${docInfo!.bg} flex items-center justify-center shadow-xl`}>
                <DocIcon size={56} className={docInfo!.color} />
              </div>
              <div className="text-center px-6">
                <p className="text-white font-semibold text-base max-w-[280px] break-all">
                  {file.name}
                </p>
                <p className="text-gray-400 text-sm mt-1">
                  {docInfo!.label} • {formatFileSize(file.size)}
                </p>
              </div>
            </div>
          </div>

          {/* Rodapé para documentos */}
          <div className="px-4 pb-6 pt-2 flex items-center gap-3 shrink-0">
            <div className="flex-1 bg-[#2a3942] rounded-full px-4 py-2.5 flex items-center">
              <input
                ref={captionRef}
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Adicione uma mensagem..."
                className="flex-1 bg-transparent text-white placeholder-gray-400 text-sm outline-none"
              />
            </div>
            <button
              onClick={handleSend}
              className="w-12 h-12 rounded-full bg-[#00a884] hover:bg-[#008f6f] flex items-center justify-center transition-all shadow-lg active:scale-95 shrink-0"
              title="Enviar"
            >
              <Send size={20} className="text-white ml-0.5" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
