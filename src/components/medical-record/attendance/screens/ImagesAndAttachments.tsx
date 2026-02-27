'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Upload,
  Image as ImageIcon,
  FileText,
  Film,
  File,
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
} from 'lucide-react';
import { useAttachments, PatientFile, isImage, isVideo, isPdf } from '@/hooks/useAttachments';
import { useToast } from '@/contexts/ToastContext';
import { AttendanceScreenProps } from '@/types/attendance';

// ─── Constantes ──────────────────────────────────────────────────────────────
const MAX_FILE_SIZE_MB = 64;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const DAYS_PT = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const MONTHS_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function formatLongDate(date: Date): string {
  const day = DAYS_PT[date.getDay()];
  const d = String(date.getDate()).padStart(2, '0');
  const month = MONTHS_PT[date.getMonth()];
  const year = date.getFullYear();
  return `${day.toUpperCase()}, ${d} DE ${month.toUpperCase()} DE ${year}`;
}

function formatDateShort(isoString: string): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Ícone por tipo de arquivo ────────────────────────────────────────────────
function FileTypeIcon({ fileType, className = 'w-8 h-8' }: { fileType: string | null; className?: string }) {
  if (isImage(fileType)) return <ImageIcon className={`${className} text-blue-500`} />;
  if (isVideo(fileType)) return <Film className={`${className} text-purple-500`} />;
  if (isPdf(fileType)) return <FileText className={`${className} text-red-500`} />;
  return <File className={`${className} text-slate-400`} />;
}

// ─── Card de arquivo na galeria ───────────────────────────────────────────────
function FileCard({
  file,
  isSelected,
  onSelect,
  onDelete,
  onPreview,
}: {
  file: PatientFile;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onPreview: () => void;
}) {
  return (
    <div
      className={`relative group rounded-xl border-2 overflow-hidden transition-all cursor-pointer ${
        isSelected
          ? 'border-blue-500 shadow-md shadow-blue-100 dark:shadow-blue-900/20'
          : 'border-slate-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700'
      }`}
    >
      {/* Checkbox de seleção */}
      <div
        className="absolute top-2 left-2 z-10"
        onClick={(e) => { e.stopPropagation(); onSelect(); }}
      >
        <div
          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
            isSelected
              ? 'bg-blue-500 border-blue-500'
              : 'bg-white/80 dark:bg-gray-900/80 border-slate-300 dark:border-gray-600 opacity-0 group-hover:opacity-100'
          }`}
        >
          {isSelected && (
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
      </div>

      {/* Botões de ação (hover) */}
      <div className="absolute top-2 right-2 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {isImage(file.file_type) && (
          <button
            onClick={(e) => { e.stopPropagation(); onPreview(); }}
            className="p-1.5 bg-white/90 dark:bg-gray-900/90 rounded-lg shadow hover:bg-white dark:hover:bg-gray-800 transition-colors"
            title="Ampliar"
          >
            <ZoomIn className="w-3.5 h-3.5 text-slate-700 dark:text-gray-200" />
          </button>
        )}
        <a
          href={file.file_url}
          download={file.file_name}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="p-1.5 bg-white/90 dark:bg-gray-900/90 rounded-lg shadow hover:bg-white dark:hover:bg-gray-800 transition-colors"
          title="Baixar"
        >
          <Download className="w-3.5 h-3.5 text-slate-700 dark:text-gray-200" />
        </a>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-1.5 bg-white/90 dark:bg-gray-900/90 rounded-lg shadow hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
          title="Excluir"
        >
          <Trash2 className="w-3.5 h-3.5 text-red-500" />
        </button>
      </div>

      {/* Conteúdo da miniatura */}
      <div
        className="aspect-square flex items-center justify-center bg-slate-50 dark:bg-[#2a2d36] overflow-hidden"
        onClick={isImage(file.file_type) ? onPreview : onSelect}
      >
        {isImage(file.file_type) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={file.file_url}
            alt={file.file_name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : isVideo(file.file_type) ? (
          <video src={file.file_url} className="w-full h-full object-cover" muted />
        ) : (
          <div className="flex flex-col items-center gap-2 p-4">
            <FileTypeIcon fileType={file.file_type} className="w-10 h-10" />
            <span className="text-xs text-slate-500 dark:text-gray-400 text-center break-all line-clamp-2">
              {file.file_name}
            </span>
          </div>
        )}
      </div>

      {/* Rodapé do card */}
      <div className="px-2 py-1.5 bg-white dark:bg-[#1e2028] border-t border-slate-100 dark:border-gray-800">
        <p className="text-xs font-medium text-slate-700 dark:text-gray-200 truncate" title={file.file_name}>
          {file.file_name}
        </p>
        <p className="text-xs text-slate-400 dark:text-gray-500">
          {formatDateShort(file.uploaded_at || '')}
        </p>
      </div>
    </div>
  );
}

// ─── Lightbox (visualizador de imagem ampliada) ───────────────────────────────
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
  const file = files[currentIndex];

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onPrev();
      if (e.key === 'ArrowRight') onNext();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onPrev, onNext]);

  if (!file) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Fechar */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 text-white/70 hover:text-white rounded-lg transition-colors"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Contador */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/60 text-sm">
        {currentIndex + 1} / {files.length}
      </div>

      {/* Anterior */}
      {currentIndex > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); onPrev(); }}
          className="absolute left-4 p-3 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}

      {/* Imagem */}
      <div className="max-w-5xl max-h-[90vh] p-4" onClick={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={file.file_url}
          alt={file.file_name}
          className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
        />
        <p className="text-white/60 text-sm text-center mt-2">{file.file_name}</p>
      </div>

      {/* Próxima */}
      {currentIndex < files.length - 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          className="absolute right-4 p-3 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}
    </div>
  );
}

// ─── Modal de comparação de imagens ──────────────────────────────────────────
function CompareModal({
  files,
  onClose,
}: {
  files: PatientFile[];
  onClose: () => void;
}) {
  const images = files.filter((f) => isImage(f.file_type));

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex flex-col" onClick={onClose}>
      <div className="flex items-center justify-between p-4 text-white">
        <span className="font-semibold text-lg">Comparar Imagens ({images.length})</span>
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div
        className="flex-1 overflow-auto p-4"
        onClick={(e) => e.stopPropagation()}
        style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(images.length, 3)}, 1fr)`, gap: 12 }}
      >
        {images.map((f) => (
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

// ─── Componente principal ─────────────────────────────────────────────────────
export function ImagesAndAttachments({ patientId, patientData, appointmentId, medicalRecordId }: AttendanceScreenProps) {
  const { toast } = useToast();
  const { files, isLoading, uploading, uploadProgresses, uploadFiles, deleteFile } = useAttachments(patientId, medicalRecordId);

  // Arquivos pendentes (ainda não salvos — selecionados pelo usuário)
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pendingPreviews, setPendingPreviews] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // Seleção para comparação
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Lightbox
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const lightboxImages = files.filter((f) => isImage(f.file_type));

  // Compare modal
  const [compareOpen, setCompareOpen] = useState(false);
  const selectedForCompare = files.filter((f) => f.id && selectedIds.has(f.id) && isImage(f.file_type));

  const fileInputRef = useRef<HTMLInputElement>(null);
  const today = formatLongDate(new Date());

  // ── Limpa previews ao desmontar ────────────────────────────────────────
  useEffect(() => {
    return () => {
      pendingPreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [pendingPreviews]);

  // ── Valida e adiciona arquivos à fila pendente ─────────────────────────
  const addPendingFiles = useCallback((incoming: File[]) => {
    const valid: File[] = [];
    const previews: string[] = [];

    for (const f of incoming) {
      if (f.size > MAX_FILE_SIZE_BYTES) {
        toast.toast.error(`"${f.name}" excede ${MAX_FILE_SIZE_MB} MB e foi ignorado.`);
        continue;
      }
      valid.push(f);
      previews.push(URL.createObjectURL(f));
    }

    setPendingFiles((prev) => [...prev, ...valid]);
    setPendingPreviews((prev) => [...prev, ...previews]);
  }, [toast]);

  // ── Drag-and-drop ──────────────────────────────────────────────────────
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

  // ── Input de arquivo ───────────────────────────────────────────────────
  function onFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return;
    addPendingFiles(Array.from(e.target.files));
    e.target.value = ''; // reset para permitir re-selecionar o mesmo arquivo
  }

  // ── Remove arquivo da fila pendente ───────────────────────────────────
  function removePending(index: number) {
    URL.revokeObjectURL(pendingPreviews[index]);
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
    setPendingPreviews((prev) => prev.filter((_, i) => i !== index));
  }

  // ── Salvar (faz upload de todos os pendentes) ──────────────────────────
  async function handleSave() {
    if (!pendingFiles.length) {
      toast.toast.error('Nenhum arquivo selecionado para salvar.');
      return;
    }
    try {
      await uploadFiles(pendingFiles);
      pendingPreviews.forEach((url) => URL.revokeObjectURL(url));
      setPendingFiles([]);
      setPendingPreviews([]);
      toast.toast.success(
        `${pendingFiles.length} arquivo${pendingFiles.length > 1 ? 's' : ''} enviado${pendingFiles.length > 1 ? 's' : ''} com sucesso!`
      );
    } catch (err: any) {
      toast.toast.error('Erro ao fazer upload: ' + err.message);
    }
  }

  // ── Excluir arquivo salvo ──────────────────────────────────────────────
  async function handleDelete(file: PatientFile) {
    if (!window.confirm(`Excluir "${file.file_name}" permanentemente?`)) return;
    try {
      await deleteFile(file);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (file.id) next.delete(file.id);
        return next;
      });
      toast.toast.success('Arquivo excluído.');
    } catch (err: any) {
      toast.toast.error('Erro ao excluir: ' + err.message);
    }
  }

  // ── Toggle seleção ─────────────────────────────────────────────────────
  function toggleSelect(id: number | undefined) {
    if (!id) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // ── Lightbox ───────────────────────────────────────────────────────────
  function openLightbox(file: PatientFile) {
    const idx = lightboxImages.findIndex((f) => f.id === file.id);
    if (idx >= 0) setLightboxIndex(idx);
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* ── Cabeçalho ──────────────────────────────────────────────────── */}
      <div className="px-6 pt-5 pb-4 flex items-start justify-between border-b border-slate-200 dark:border-gray-700">
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-gray-100">Imagens e Anexos</h2>
          <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5">{today}</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Comparar imagens */}
          <button
            type="button"
            onClick={() => {
              if (selectedForCompare.length < 2) {
                toast.toast.error('Selecione ao menos 2 imagens para comparar.');
                return;
              }
              setCompareOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-gray-300 border border-slate-200 dark:border-gray-700 rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors"
          >
            <SplitSquareHorizontal className="w-4 h-4" />
            Comparar Imagens
            {selectedIds.size > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-xs rounded-full">
                {selectedIds.size}
              </span>
            )}
          </button>

          {/* Salvar */}
          <button
            type="button"
            onClick={handleSave}
            disabled={uploading || !pendingFiles.length}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            {uploading ? 'Enviando...' : 'Salvar'}
            {!uploading && pendingFiles.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-blue-500 text-white text-xs rounded-full">
                {pendingFiles.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Conteúdo ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-6 py-5 custom-scrollbar space-y-6">

        {/* ── Zona de upload ─────────────────────────────────────────── */}
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={`relative rounded-xl border-2 border-dashed transition-colors ${
            isDragging
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/10'
              : 'border-slate-300 dark:border-gray-700 bg-slate-50 dark:bg-[#1e2028] hover:border-blue-400 dark:hover:border-blue-600'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx"
            onChange={onFileInputChange}
            className="hidden"
          />

          <div className="flex flex-col items-center justify-center py-10 gap-4 text-center">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${
              isDragging ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-slate-200 dark:bg-[#2a2d36]'
            }`}>
              <Upload className={`w-7 h-7 transition-colors ${isDragging ? 'text-blue-500' : 'text-slate-400'}`} />
            </div>

            <div>
              <p className="text-sm text-slate-600 dark:text-gray-300">
                Arraste os arquivos para cá para fazer o upload
              </p>
              <p className="text-sm text-slate-400 dark:text-gray-500">ou</p>
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg transition-colors uppercase tracking-wide"
            >
              Selecione os arquivos do seu computador
            </button>

            <p className="text-xs text-slate-400 dark:text-gray-500">
              O tamanho máximo do arquivo de upload: {MAX_FILE_SIZE_MB} MB.
            </p>
          </div>
        </div>

        {/* ── Progresso de upload ──────────────────────────────────── */}
        {uploadProgresses.length > 0 && (
          <div className="space-y-2">
            {uploadProgresses.map((p, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5 bg-slate-50 dark:bg-[#2a2d36] rounded-lg">
                {p.error ? (
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                ) : p.progress === 100 ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                ) : (
                  <Loader2 className="w-4 h-4 text-blue-500 animate-spin flex-shrink-0" />
                )}
                <span className="text-sm text-slate-600 dark:text-gray-300 flex-1 truncate">{p.fileName}</span>
                {p.error && <span className="text-xs text-red-500">{p.error}</span>}
              </div>
            ))}
          </div>
        )}

        {/* ── Pré-visualização dos arquivos pendentes (ainda não salvos) ── */}
        {pendingFiles.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-slate-600 dark:text-gray-300 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              Aguardando envio ({pendingFiles.length})
            </h3>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
              {pendingFiles.map((f, i) => (
                <div key={i} className="relative group rounded-xl border-2 border-dashed border-amber-300 dark:border-amber-700 overflow-hidden bg-amber-50 dark:bg-amber-900/10">
                  {/* Botão remover */}
                  <button
                    onClick={() => removePending(i)}
                    className="absolute top-1.5 right-1.5 z-10 p-1 bg-white/90 dark:bg-gray-900/90 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3 text-red-500" />
                  </button>

                  {/* Miniatura */}
                  <div className="aspect-square flex items-center justify-center overflow-hidden bg-slate-100 dark:bg-[#2a2d36]">
                    {f.type.startsWith('image/') ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={pendingPreviews[i]}
                        alt={f.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1 p-3">
                        <FileTypeIcon fileType={f.type} className="w-8 h-8" />
                      </div>
                    )}
                  </div>

                  {/* Nome e tamanho */}
                  <div className="px-2 py-1 bg-white dark:bg-[#1e2028]">
                    <p className="text-xs font-medium text-slate-600 dark:text-gray-300 truncate">{f.name}</p>
                    <p className="text-xs text-slate-400 dark:text-gray-500">{formatFileSize(f.size)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Galeria de arquivos salvos ──────────────────────────────── */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-slate-400 dark:text-gray-500 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Carregando arquivos...</span>
          </div>
        ) : files.length > 0 ? (
          <div>
            <h3 className="text-sm font-semibold text-slate-600 dark:text-gray-300 mb-3 flex items-center justify-between">
              <span>Arquivos enviados ({files.length})</span>
              {selectedIds.size > 0 && (
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="text-xs text-blue-500 hover:text-blue-600 font-normal"
                >
                  Limpar seleção
                </button>
              )}
            </h3>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
              {files.map((file) => (
                <FileCard
                  key={file.id}
                  file={file}
                  isSelected={!!(file.id && selectedIds.has(file.id))}
                  onSelect={() => toggleSelect(file.id)}
                  onDelete={() => handleDelete(file)}
                  onPreview={() => openLightbox(file)}
                />
              ))}
            </div>
          </div>
        ) : (
          !pendingFiles.length && (
            <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
              <ImageIcon className="w-10 h-10 text-slate-300 dark:text-gray-600" />
              <p className="text-sm text-slate-400 dark:text-gray-500">
                Nenhum arquivo enviado para este paciente ainda.
              </p>
            </div>
          )
        )}
      </div>

      {/* ── Lightbox ─────────────────────────────────────────────────────── */}
      {lightboxIndex !== null && (
        <Lightbox
          files={lightboxImages}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onPrev={() => setLightboxIndex((i) => (i !== null && i > 0 ? i - 1 : i))}
          onNext={() =>
            setLightboxIndex((i) =>
              i !== null && i < lightboxImages.length - 1 ? i + 1 : i
            )
          }
        />
      )}

      {/* ── Modal de comparação ───────────────────────────────────────────── */}
      {compareOpen && (
        <CompareModal
          files={selectedForCompare}
          onClose={() => setCompareOpen(false)}
        />
      )}
    </div>
  );
}
