'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Upload,
  Image as ImageIcon,
  Trash2,
  Download,
  ZoomIn,
  X,
  ChevronLeft,
  ChevronRight,
  SplitSquareHorizontal,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Camera,
} from 'lucide-react';
import { useAttachments, PatientFile, isImage } from '@/hooks/useAttachments';
import { useToast } from '@/contexts/ToastContext';
import { AttendanceScreenProps } from '@/types/attendance';
import ConfirmModal from '@/components/ui/ConfirmModal';

// ─── Constantes ──────────────────────────────────────────────────────────────
const MAX_FILE_SIZE_MB = 64;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

function formatDateShort(isoString: string): string {
  if (!isoString) return '—';
  const d = new Date(isoString);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ─── Lightbox ────────────────────────────────────────────────────────────────
function Lightbox({
  files,
  currentIndex,
  onClose,
  onPrev,
  onNext,
}: {
  files: PatientFile[];
  currentIndex: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const [zoom, setZoom] = useState(1);
  const file = files[currentIndex];

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onPrev();
      if (e.key === 'ArrowRight') onNext();
      if (e.key === '+' || e.key === '=') setZoom(z => Math.min(z + 0.25, 4));
      if (e.key === '-') setZoom(z => Math.max(z - 0.25, 0.5));
      if (e.key === '0') setZoom(1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onPrev, onNext]);

  if (!file) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={onClose}>
      {/* Fechar */}
      <button onClick={onClose} className="absolute top-4 right-4 p-2 text-white/70 hover:text-white rounded-lg transition-colors z-10">
        <X className="w-6 h-6" />
      </button>

      {/* Contador + controles de zoom */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-4 text-white/60 text-sm z-10">
        <span>{currentIndex + 1} / {files.length}</span>
        <div className="flex items-center gap-1 bg-white/10 rounded-lg px-2 py-1">
          <button onClick={(e) => { e.stopPropagation(); setZoom(z => Math.max(z - 0.25, 0.5)); }} className="px-1.5 py-0.5 hover:text-white transition-colors font-bold">−</button>
          <span className="px-2 text-xs font-medium">{Math.round(zoom * 100)}%</span>
          <button onClick={(e) => { e.stopPropagation(); setZoom(z => Math.min(z + 0.25, 4)); }} className="px-1.5 py-0.5 hover:text-white transition-colors font-bold">+</button>
        </div>
      </div>

      {/* Download */}
      <a
        href={file.file_url}
        download={file.file_name}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="absolute top-4 left-4 p-2 text-white/70 hover:text-white rounded-lg transition-colors z-10"
        title="Baixar"
      >
        <Download className="w-5 h-5" />
      </a>

      {/* Anterior */}
      {currentIndex > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); onPrev(); }}
          className="absolute left-4 p-3 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors z-10"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}

      {/* Imagem */}
      <div
        className="max-w-5xl max-h-[90vh] p-4 overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={file.file_url}
          alt={file.file_name}
          className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl transition-transform duration-200"
          style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
        />
        <p className="text-white/60 text-sm text-center mt-2">{file.file_name}</p>
      </div>

      {/* Próxima */}
      {currentIndex < files.length - 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          className="absolute right-4 p-3 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors z-10"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}
    </div>
  );
}

// ─── Modal de comparação ─────────────────────────────────────────────────────
function CompareModal({
  files,
  onClose,
}: {
  files: PatientFile[];
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex flex-col" onClick={onClose}>
      <div className="flex items-center justify-between p-4 text-white">
        <span className="font-semibold text-lg">Comparar Imagens ({files.length})</span>
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div
        className="flex-1 overflow-auto p-4"
        onClick={(e) => e.stopPropagation()}
        style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(files.length, 3)}, 1fr)`, gap: 12 }}
      >
        {files.map((f) => (
          <div key={f.id} className="flex flex-col gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={f.file_url}
              alt={f.file_name}
              className="w-full object-contain rounded-lg bg-black/40 max-h-[70vh]"
            />
            <p className="text-white/60 text-xs text-center truncate">{f.file_name}</p>
            <p className="text-white/40 text-xs text-center">{formatDateShort(f.uploaded_at || '')}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────
export function ImageGallery({ patientId, medicalRecordId }: AttendanceScreenProps) {
  const { toast } = useToast();
  const { files, isLoading, uploading, uploadProgresses, uploadFiles, deleteFile } = useAttachments(patientId, medicalRecordId);

  // Filtra apenas imagens
  const images = React.useMemo(() => files.filter(f => isImage(f.file_type)), [files]);

  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pendingPreviews, setPendingPreviews] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [confirmDeleteFile, setConfirmDeleteFile] = useState<PatientFile | null>(null);

  const selectedForCompare = images.filter(f => f.id && selectedIds.has(f.id));
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Limpa previews ao desmontar
  useEffect(() => {
    return () => {
      pendingPreviews.forEach(url => URL.revokeObjectURL(url));
    };
  }, [pendingPreviews]);

  // ── Valida e adiciona imagens pendentes ─────────────────────────────────
  const addPendingFiles = useCallback((incoming: File[]) => {
    const valid: File[] = [];
    const previews: string[] = [];

    for (const f of incoming) {
      if (!f.type.startsWith('image/')) {
        toast.error(`"${f.name}" não é uma imagem.`);
        continue;
      }
      if (f.size > MAX_FILE_SIZE_BYTES) {
        toast.error(`"${f.name}" excede ${MAX_FILE_SIZE_MB} MB e foi ignorado.`);
        continue;
      }
      valid.push(f);
      previews.push(URL.createObjectURL(f));
    }

    setPendingFiles(prev => [...prev, ...valid]);
    setPendingPreviews(prev => [...prev, ...previews]);
  }, [toast]);

  // ── Drag-and-drop ───────────────────────────────────────────────────────
  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }
  function onDragLeave() {
    setIsDragging(false);
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    addPendingFiles(Array.from(e.dataTransfer.files));
  }

  function onFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return;
    addPendingFiles(Array.from(e.target.files));
    e.target.value = '';
  }

  function removePending(index: number) {
    URL.revokeObjectURL(pendingPreviews[index]);
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
    setPendingPreviews(prev => prev.filter((_, i) => i !== index));
  }

  // ── Upload ──────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!pendingFiles.length) {
      toast.error('Nenhuma imagem selecionada.');
      return;
    }
    try {
      await uploadFiles(pendingFiles);
      pendingPreviews.forEach(url => URL.revokeObjectURL(url));
      setPendingFiles([]);
      setPendingPreviews([]);
      toast.success(
        `${pendingFiles.length} imagem${pendingFiles.length > 1 ? 'ns' : ''} enviada${pendingFiles.length > 1 ? 's' : ''} com sucesso!`
      );
    } catch (err: unknown) {
      toast.error('Erro ao enviar: ' + (err instanceof Error ? err.message : 'Tente novamente.'));
    }
  }

  // ── Excluir ─────────────────────────────────────────────────────────────
  async function handleDelete(file: PatientFile) {
    try {
      await deleteFile(file);
      setSelectedIds(prev => {
        const next = new Set(prev);
        if (file.id) next.delete(file.id);
        return next;
      });
      toast.success('Imagem excluída.');
    } catch (err: unknown) {
      toast.error('Erro ao excluir: ' + (err instanceof Error ? err.message : ''));
    }
    setConfirmDeleteFile(null);
  }

  // ── Seleção ─────────────────────────────────────────────────────────────
  function toggleSelect(id: number | undefined) {
    if (!id) return;
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openLightbox(file: PatientFile) {
    const idx = images.findIndex(f => f.id === file.id);
    if (idx >= 0) setLightboxIndex(idx);
  }

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* Cabeçalho */}
      <div className="px-6 pt-5 pb-4 flex items-center justify-between border-b border-slate-200 dark:border-[#2e2e33]">
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-[#fafafa]">Galeria de Imagens</h2>
          <p className="text-xs text-slate-400 dark:text-[#71717a] mt-0.5">
            {images.length} imagem{images.length !== 1 ? 'ns' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Comparar */}
          <button
            type="button"
            onClick={() => {
              if (selectedForCompare.length < 2) {
                toast.error('Selecione ao menos 2 imagens para comparar.');
                return;
              }
              setCompareOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-600 dark:text-[#d4d4d8] border border-slate-200 dark:border-[#2e2e33] rounded-xl hover:bg-slate-50 dark:hover:bg-[#27272a] transition-colors"
          >
            <SplitSquareHorizontal className="w-4 h-4" />
            COMPARAR
            {selectedIds.size > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-xs rounded-full font-bold">
                {selectedIds.size}
              </span>
            )}
          </button>

          {/* Enviar pendentes */}
          {pendingFiles.length > 0 && (
            <button
              type="button"
              onClick={handleSave}
              disabled={uploading}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-colors shadow-md active:scale-95"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploading ? 'ENVIANDO...' : `ENVIAR (${pendingFiles.length})`}
            </button>
          )}

          {/* Adicionar imagem */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md transition-all active:scale-95"
          >
            <Camera className="w-4 h-4" /> ADICIONAR IMAGEM
          </button>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-y-auto px-6 py-5 custom-scrollbar space-y-5">
        {/* Zona de upload */}
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={`rounded-xl border-2 border-dashed transition-colors ${
            isDragging
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/10'
              : 'border-slate-300 dark:border-[#2e2e33] bg-slate-50 dark:bg-[#0a0a0c] hover:border-blue-400 dark:hover:border-blue-600'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={onFileInputChange}
            className="hidden"
          />
          <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${
              isDragging ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-slate-200 dark:bg-[#18181b]'
            }`}>
              <Camera className={`w-6 h-6 transition-colors ${isDragging ? 'text-blue-500' : 'text-slate-400'}`} />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-[#d4d4d8]">Arraste imagens para cá ou</p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-sm font-bold text-blue-600 dark:text-blue-400 hover:underline"
              >
                selecione do computador
              </button>
            </div>
            <p className="text-xs text-slate-400 dark:text-[#71717a]">
              Aceita: JPG, PNG, GIF, WEBP, SVG &middot; Máx: {MAX_FILE_SIZE_MB} MB
            </p>
          </div>
        </div>

        {/* Progresso de upload */}
        {uploadProgresses.length > 0 && (
          <div className="space-y-2">
            {uploadProgresses.map((p, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5 bg-slate-50 dark:bg-[#18181b] rounded-lg">
                {p.error ? (
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                ) : p.progress === 100 ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                ) : (
                  <Loader2 className="w-4 h-4 text-blue-500 animate-spin flex-shrink-0" />
                )}
                <span className="text-sm text-slate-600 dark:text-[#d4d4d8] flex-1 truncate">{p.fileName}</span>
                {p.error && <span className="text-xs text-red-500">{p.error}</span>}
              </div>
            ))}
          </div>
        )}

        {/* Previews de imagens pendentes */}
        {pendingFiles.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-slate-600 dark:text-[#d4d4d8] mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              Aguardando envio ({pendingFiles.length})
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {pendingFiles.map((f, i) => (
                <div key={i} className="relative group rounded-xl border-2 border-dashed border-amber-300 dark:border-amber-700 overflow-hidden bg-amber-50 dark:bg-amber-900/10">
                  <button
                    onClick={() => removePending(i)}
                    className="absolute top-1.5 right-1.5 z-10 p-1 bg-white/90 dark:bg-[#0a0a0c]/90 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3 text-red-500" />
                  </button>
                  <div className="aspect-square flex items-center justify-center overflow-hidden bg-slate-100 dark:bg-[#18181b]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={pendingPreviews[i]} alt={f.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="px-2 py-1 bg-white dark:bg-[#0a0a0c]">
                    <p className="text-xs font-medium text-slate-600 dark:text-[#d4d4d8] truncate">{f.name}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Seleção header */}
        {images.length > 0 && selectedIds.size > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-[#a1a1aa]">
              {selectedIds.size} selecionada{selectedIds.size > 1 ? 's' : ''}
            </span>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-xs text-blue-500 hover:text-blue-600 font-medium"
            >
              Limpar seleção
            </button>
          </div>
        )}

        {/* Grid de imagens */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-slate-400 dark:text-[#71717a] gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Carregando imagens...</span>
          </div>
        ) : images.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {images.map(file => (
              <div
                key={file.id}
                className={`relative group rounded-xl border-2 overflow-hidden transition-all cursor-pointer ${
                  file.id && selectedIds.has(file.id)
                    ? 'border-blue-500 shadow-md shadow-blue-100 dark:shadow-blue-900/20'
                    : 'border-slate-200 dark:border-[#2e2e33] hover:border-blue-300 dark:hover:border-blue-700'
                }`}
              >
                {/* Checkbox de seleção */}
                <div
                  className="absolute top-2 left-2 z-10"
                  onClick={(e) => { e.stopPropagation(); toggleSelect(file.id); }}
                >
                  <div
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      file.id && selectedIds.has(file.id)
                        ? 'bg-blue-500 border-blue-500'
                        : 'bg-white/80 dark:bg-[#0a0a0c]/80 border-slate-300 dark:border-gray-600 opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    {file.id && selectedIds.has(file.id) && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>

                {/* Botões de ação (hover) */}
                <div className="absolute top-2 right-2 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => { e.stopPropagation(); openLightbox(file); }}
                    className="p-1.5 bg-white/90 dark:bg-[#0a0a0c]/90 rounded-lg shadow hover:bg-white dark:hover:bg-[#18181b] transition-colors"
                    title="Ampliar"
                  >
                    <ZoomIn className="w-3.5 h-3.5 text-slate-700 dark:text-gray-200" />
                  </button>
                  <a
                    href={file.file_url}
                    download={file.file_name}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="p-1.5 bg-white/90 dark:bg-[#0a0a0c]/90 rounded-lg shadow hover:bg-white dark:hover:bg-[#18181b] transition-colors"
                    title="Baixar"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-700 dark:text-gray-200" />
                  </a>
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmDeleteFile(file); }}
                    className="p-1.5 bg-white/90 dark:bg-[#0a0a0c]/90 rounded-lg shadow hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                    title="Excluir"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  </button>
                </div>

                {/* Thumbnail */}
                <div
                  className="aspect-square flex items-center justify-center bg-slate-50 dark:bg-[#18181b] overflow-hidden"
                  onClick={() => openLightbox(file)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={file.file_url}
                    alt={file.file_name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>

                {/* Rodapé */}
                <div className="px-2 py-1.5 bg-white dark:bg-[#0a0a0c] border-t border-slate-100 dark:border-[#27272a]">
                  <p className="text-xs font-medium text-slate-700 dark:text-gray-200 truncate" title={file.file_name}>
                    {file.file_name}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-[#71717a]">
                    {formatDateShort(file.uploaded_at || '')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          !pendingFiles.length && (
            <div className="text-center py-16">
              <ImageIcon className="w-12 h-12 text-slate-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-sm text-slate-400 dark:text-[#71717a]">Nenhuma imagem enviada para este paciente.</p>
            </div>
          )
        )}
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <Lightbox
          files={images}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onPrev={() => setLightboxIndex(i => (i !== null && i > 0 ? i - 1 : i))}
          onNext={() => setLightboxIndex(i => (i !== null && i < images.length - 1 ? i + 1 : i))}
        />
      )}

      {/* Modal de comparação */}
      {compareOpen && (
        <CompareModal
          files={selectedForCompare}
          onClose={() => setCompareOpen(false)}
        />
      )}

      {/* Modal de confirmação de exclusão */}
      <ConfirmModal
        isOpen={confirmDeleteFile !== null}
        onClose={() => setConfirmDeleteFile(null)}
        onConfirm={() => { if (confirmDeleteFile) handleDelete(confirmDeleteFile); }}
        title="Excluir imagem"
        message={`Tem certeza que deseja excluir "${confirmDeleteFile?.file_name}"? Esta ação não pode ser desfeita.`}
        confirmText="Excluir"
        type="danger"
      />
    </div>
  );
}
