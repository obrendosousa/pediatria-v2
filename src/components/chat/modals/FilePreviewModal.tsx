'use client';

/* eslint-disable @next/next/no-img-element */
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { staggerContainer, staggerItem } from '@/lib/animations';
import { X, Send, FileText, File, FileSpreadsheet, FileCode, Archive, Smile, Play } from 'lucide-react';

interface FilePreviewModalProps {
  files: File[];
  onSend: (items: Array<{ file: File; caption: string }>) => void;
  onClose: () => void;
  onAddMore?: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getDocumentIcon(mime: string, fileName: string) {
  const lower = fileName.toLowerCase();
  if (mime.includes('pdf') || lower.endsWith('.pdf')) {
    return { icon: FileText, color: 'text-rose-400', bg: 'bg-rose-500', label: 'PDF' };
  }
  if (mime.includes('spreadsheet') || mime.includes('excel') || lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.csv')) {
    return { icon: FileSpreadsheet, color: 'text-orange-400', bg: 'bg-orange-500', label: 'Planilha' };
  }
  if (mime.includes('zip') || mime.includes('rar') || mime.includes('tar') || lower.endsWith('.zip') || lower.endsWith('.rar')) {
    return { icon: Archive, color: 'text-amber-400', bg: 'bg-amber-500', label: 'Arquivo' };
  }
  if (mime.includes('text') || lower.endsWith('.txt') || lower.endsWith('.md')) {
    return { icon: FileCode, color: 'text-blue-400', bg: 'bg-blue-500', label: 'Texto' };
  }
  return { icon: File, color: 'text-gray-400', bg: 'bg-gray-500', label: 'Documento' };
}

function FileThumbnail({ file, previewUrl, size = 52 }: { file: File; previewUrl: string | null; size?: number }) {
  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');
  const docInfo = getDocumentIcon(file.type, file.name);
  const DocIcon = docInfo.icon;

  if (isImage && previewUrl) {
    return (
      <img src={previewUrl} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
    );
  }
  if (isVideo && previewUrl) {
    return (
      <div className="w-full h-full relative">
        <video src={previewUrl} muted playsInline preload="metadata" className="w-full h-full object-cover" />
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <Play size={size > 40 ? 14 : 10} className="text-white" />
        </div>
      </div>
    );
  }
  return (
    <div className={`w-full h-full ${docInfo.bg} flex items-center justify-center`}>
      <DocIcon size={size > 40 ? 24 : 16} className="text-white" />
    </div>
  );
}

export default function FilePreviewModal({ files, onSend, onClose, onAddMore }: FilePreviewModalProps) {
  const [rawSelectedIndex, setSelectedIndex] = useState(0);
  const selectedIndex = files.length > 0 ? Math.min(rawSelectedIndex, files.length - 1) : 0;
  const [captions, setCaptions] = useState<Record<number, string>>({});
  const captionRef = useRef<HTMLInputElement>(null);
  const addMoreRef = useRef<HTMLInputElement>(null);

  const gridPatternDark = useMemo(() => {
    const stroke = 'rgba(255,255,255,0.06)';
    const grid = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><line x1="40" y1="0" x2="40" y2="40" stroke="${stroke}" stroke-width="0.5"/><line x1="0" y1="40" x2="40" y2="40" stroke="${stroke}" stroke-width="0.5"/></svg>`;
    return `url("data:image/svg+xml;utf8,${encodeURIComponent(grid.trim())}")`;
  }, []);
  const gridPatternLight = useMemo(() => {
    const stroke = 'rgba(0,0,0,0.06)';
    const grid = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><line x1="40" y1="0" x2="40" y2="40" stroke="${stroke}" stroke-width="0.5"/><line x1="0" y1="40" x2="40" y2="40" stroke="${stroke}" stroke-width="0.5"/></svg>`;
    return `url("data:image/svg+xml;utf8,${encodeURIComponent(grid.trim())}")`;
  }, []);

  const file = files[selectedIndex] ?? null;
  const isImage = file ? file.type.startsWith('image/') : false;
  const isVideo = file ? file.type.startsWith('video/') : false;
  const isVisual = isImage || isVideo;

  // Gera preview URLs para todos os arquivos visuais (useMemo + cleanup via useEffect)
  const previewUrls = useMemo(() => {
    const urls: Record<number, string> = {};
    files.forEach((f, i) => {
      if (f.type.startsWith('image/') || f.type.startsWith('video/')) {
        urls[i] = URL.createObjectURL(f);
      }
    });
    return urls;
  }, [files]);

  // Cleanup de object URLs ao desmontar ou trocar files
  useEffect(() => {
    return () => {
      Object.values(previewUrls).forEach((u) => URL.revokeObjectURL(u));
    };
  }, [previewUrls]);

  // Focus caption ao abrir ou trocar de arquivo
  useEffect(() => {
    if (files.length > 0) {
      setTimeout(() => captionRef.current?.focus(), 150);
    }
  }, [files.length, selectedIndex]);

  const handleSend = useCallback(() => {
    if (files.length === 0) return;
    const items = files.map((f, i) => ({
      file: f,
      caption: (captions[i] || '').trim(),
    }));
    onSend(items);
    setCaptions({});
    setSelectedIndex(0);
  }, [files, captions, onSend]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); handleSend(); }
    if (e.key === 'Escape') { onClose(); }
  }, [handleSend, onClose]);

  // Intercepta Ctrl+V de imagens/vídeos no modal inteiro e adiciona ao lote
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const pastedFiles: globalThis.File[] = [];
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/') || item.type.startsWith('video/')) {
        const file = item.getAsFile();
        if (file) pastedFiles.push(file);
      }
    }

    if (pastedFiles.length > 0) {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('filepreview:add', { detail: pastedFiles }));
    }
  }, []);

  const handleCaptionChange = (value: string) => {
    setCaptions((prev) => ({ ...prev, [selectedIndex]: value }));
  };

  const handleRemoveFile = (index: number) => {
    if (files.length <= 1) {
      onClose();
      return;
    }
    const remaining = files.filter((_, i) => i !== index);
    setCaptions((prev) => {
      const next: Record<number, string> = {};
      remaining.forEach((_, newIdx) => {
        const oldIdx = files.indexOf(remaining[newIdx]);
        if (prev[oldIdx]) next[newIdx] = prev[oldIdx];
      });
      return next;
    });
    window.dispatchEvent(new CustomEvent('filepreview:update', { detail: remaining }));
  };

  if (files.length === 0) return null;

  const docInfo = getDocumentIcon(file?.type || '', file?.name || '');
  const DocIcon = docInfo.icon;
  const currentCaption = captions[selectedIndex] || '';

  return (
    <motion.div
      className="absolute inset-0 z-[9999] flex flex-col bg-[var(--chat-bg)]"
      onPaste={handlePaste}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1, transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] } }}
      exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.15 } }}
    >
      {/* Grid de fundo — dark */}
      <div
        className="absolute inset-0 z-0 pointer-events-none hidden dark:block"
        style={{
          backgroundImage: gridPatternDark,
          backgroundRepeat: 'repeat',
          backgroundSize: '40px 40px',
          maskImage: 'linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%), linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%)',
          maskComposite: 'intersect',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%), linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%)',
          WebkitMaskComposite: 'source-in',
        }}
      />
      {/* Grid de fundo — light */}
      <div
        className="absolute inset-0 z-0 pointer-events-none dark:hidden"
        style={{
          backgroundImage: gridPatternLight,
          backgroundRepeat: 'repeat',
          backgroundSize: '40px 40px',
          maskImage: 'linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%), linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%)',
          maskComposite: 'intersect',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%), linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%)',
          WebkitMaskComposite: 'source-in',
        }}
      />

      {/* Header */}
      <div className="flex items-center h-[56px] px-4 shrink-0 relative z-10 bg-[var(--chat-surface)] dark:bg-[var(--chat-surface)]">
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full hover:bg-gray-200 dark:hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"
        >
          <X size={22} className="text-gray-500 dark:text-[#828ca5]" />
        </button>
        {!isVisual && file && (
          <span className="ml-4 text-[15px] text-gray-800 dark:text-gray-200 font-medium truncate">
            {file.name}
          </span>
        )}
        {files.length > 1 && (
          <span className="ml-auto text-[13px] text-gray-500 dark:text-[#828ca5]">
            {selectedIndex + 1} / {files.length}
          </span>
        )}
      </div>

      {/* Preview centralizado */}
      <div className="flex-1 flex items-center justify-center px-8 py-4 overflow-hidden min-h-0 relative z-10">
        {isImage && previewUrls[selectedIndex] ? (
          <img
            src={previewUrls[selectedIndex]}
            alt="Preview"
            className="max-w-full max-h-full object-contain rounded-md"
            style={{ maxHeight: 'calc(100vh - 240px)' }}
          />
        ) : isVideo && previewUrls[selectedIndex] ? (
          <video
            src={previewUrls[selectedIndex]}
            controls
            className="max-w-full max-h-full object-contain rounded-md"
            style={{ maxHeight: 'calc(100vh - 240px)' }}
          />
        ) : file ? (
          <div className="flex flex-col items-center gap-5">
            <div className={`w-24 h-24 rounded-2xl ${docInfo.bg} flex items-center justify-center shadow-2xl`}>
              <DocIcon size={48} className="text-white" />
            </div>
            <div className="text-center">
              <p className="text-gray-800 dark:text-gray-200 font-medium text-[15px] max-w-[300px] break-all leading-snug">
                {file.name}
              </p>
              <p className="text-gray-500 dark:text-[#828ca5] text-[13px] mt-1.5">
                {docInfo.label} &bull; {formatFileSize(file.size)}
              </p>
            </div>
          </div>
        ) : null}
      </div>

      {/* Bottom: caption + thumbnails + send */}
      <div className="shrink-0 pb-4 relative z-10 bg-[var(--chat-surface)] dark:bg-[var(--chat-surface)]">
        {/* Caption input */}
        <div className="flex items-center gap-2 mx-auto max-w-[600px] px-4 mb-4 pt-4">
          <div className="flex-1 flex items-center bg-gray-100 dark:bg-[#141722] rounded-lg px-3 h-[42px]">
            <Smile size={20} className="text-gray-400 dark:text-[#565d73] shrink-0 mr-2" />
            <input
              ref={captionRef}
              type="text"
              value={currentCaption}
              onChange={(e) => handleCaptionChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite uma mensagem"
              className="flex-1 bg-transparent text-[14px] text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 outline-none"
            />
          </div>
        </div>

        {/* Thumbnail strip + send */}
        <div className="flex items-center justify-center gap-4 px-4">
          {/* Thumbnails */}
          <motion.div className="flex items-center gap-2 overflow-x-auto max-w-[60%] scrollbar-none pt-2.5 pr-1 pb-1 pl-1" variants={staggerContainer} initial="hidden" animate="visible">
            {files.map((f, i) => (
              <motion.div key={i} className="relative group/thumb shrink-0" variants={staggerItem}>
                <button
                  onClick={() => setSelectedIndex(i)}
                  className={`w-[52px] h-[52px] rounded-md overflow-hidden transition-all cursor-pointer ${
                    i === selectedIndex
                      ? 'border-2 border-[var(--chat-accent)] shadow-lg'
                      : 'border-2 border-gray-300 dark:border-gray-600 opacity-60 hover:opacity-100'
                  }`}
                >
                  <FileThumbnail file={f} previewUrl={previewUrls[i] || null} />
                </button>
                {/* X para remover do lote */}
                <button
                  onClick={(e) => { e.stopPropagation(); handleRemoveFile(i); }}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-red-500 text-gray-600 dark:text-[#a0a8be] hover:text-white flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity shadow-md cursor-pointer z-10"
                >
                  <X size={10} strokeWidth={3} />
                </button>
              </motion.div>
            ))}

            {/* Botão + adicionar mais */}
            <button
              onClick={() => onAddMore ? onAddMore() : addMoreRef.current?.click()}
              className="w-[52px] h-[52px] rounded-md border-2 border-dashed border-gray-400 dark:border-gray-600 flex items-center justify-center text-gray-400 dark:text-[#565d73] hover:border-[var(--chat-accent)]/40 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer shrink-0"
            >
              <span className="text-2xl leading-none font-light">+</span>
            </button>
            <input
              ref={addMoreRef}
              type="file"
              multiple
              className="hidden"
              accept="image/*,video/*,application/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip,.rar"
              onChange={(e) => {
                const newFiles = Array.from(e.target.files || []);
                if (newFiles.length > 0) {
                  window.dispatchEvent(new CustomEvent('filepreview:add', { detail: newFiles }));
                }
                e.target.value = '';
              }}
            />
          </motion.div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Send button */}
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleSend}
            className="w-[52px] h-[52px] rounded-full bg-[var(--chat-accent)] hover:brightness-110 flex items-center justify-center transition-all shadow-xl cursor-pointer"
            title={files.length > 1 ? `Enviar ${files.length} arquivos` : 'Enviar'}
          >
            <Send size={22} className="text-white ml-0.5" />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
