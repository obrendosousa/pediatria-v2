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
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Paperclip,
  Search,
} from 'lucide-react';
import { useAttachments, PatientFile, isImage, isVideo, isPdf } from '@/hooks/useAttachments';
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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileTypeLabel(fileType: string | null): string {
  if (!fileType) return 'Arquivo';
  if (isImage(fileType)) return 'Imagem';
  if (isVideo(fileType)) return 'Vídeo';
  if (isPdf(fileType)) return 'PDF';
  if (fileType.includes('word') || fileType.includes('document')) return 'Documento';
  if (fileType.includes('sheet') || fileType.includes('excel')) return 'Planilha';
  return 'Arquivo';
}

function getFileExtension(fileName: string): string {
  const ext = fileName.split('.').pop()?.toUpperCase();
  return ext || '—';
}

// ─── Ícone por tipo ──────────────────────────────────────────────────────────
function FileTypeIcon({ fileType, className = 'w-5 h-5' }: { fileType: string | null; className?: string }) {
  if (isImage(fileType)) return <ImageIcon className={`${className} text-blue-500`} />;
  if (isVideo(fileType)) return <Film className={`${className} text-purple-500`} />;
  if (isPdf(fileType)) return <FileText className={`${className} text-red-500`} />;
  return <File className={`${className} text-slate-400`} />;
}

// ─── Componente principal ────────────────────────────────────────────────────
export function AttachmentsList({ patientId, medicalRecordId }: AttendanceScreenProps) {
  const { toast } = useToast();
  const { files, isLoading, uploading, uploadProgresses, uploadFiles, deleteFile } = useAttachments(patientId, medicalRecordId);

  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmDeleteFile, setConfirmDeleteFile] = useState<PatientFile | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Filtro por busca ─────────────────────────────────────────────────────
  const filteredFiles = React.useMemo(() => {
    if (!searchTerm.trim()) return files;
    const term = searchTerm.toLowerCase();
    return files.filter(f =>
      f.file_name.toLowerCase().includes(term) ||
      getFileTypeLabel(f.file_type).toLowerCase().includes(term)
    );
  }, [files, searchTerm]);

  // ── Limpa previews ao desmontar ─────────────────────────────────────────
  useEffect(() => {
    return () => {
      pendingFiles.forEach(() => {});
    };
  }, [pendingFiles]);

  // ── Valida e adiciona arquivos pendentes ────────────────────────────────
  const addPendingFiles = useCallback((incoming: File[]) => {
    const valid: File[] = [];
    for (const f of incoming) {
      if (f.size > MAX_FILE_SIZE_BYTES) {
        toast.error(`"${f.name}" excede ${MAX_FILE_SIZE_MB} MB e foi ignorado.`);
        continue;
      }
      valid.push(f);
    }
    setPendingFiles(prev => [...prev, ...valid]);
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
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  }

  // ── Upload ──────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!pendingFiles.length) {
      toast.error('Nenhum arquivo selecionado para enviar.');
      return;
    }
    try {
      await uploadFiles(pendingFiles);
      setPendingFiles([]);
      toast.success(
        `${pendingFiles.length} arquivo${pendingFiles.length > 1 ? 's' : ''} enviado${pendingFiles.length > 1 ? 's' : ''} com sucesso!`
      );
    } catch (err: unknown) {
      toast.error('Erro ao fazer upload: ' + (err instanceof Error ? err.message : 'Tente novamente.'));
    }
  }

  // ── Excluir ─────────────────────────────────────────────────────────────
  async function handleDelete(file: PatientFile) {
    try {
      await deleteFile(file);
      toast.success('Arquivo excluído.');
    } catch (err: unknown) {
      toast.error('Erro ao excluir: ' + (err instanceof Error ? err.message : ''));
    }
    setConfirmDeleteFile(null);
  }

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* Cabeçalho */}
      <div className="px-6 pt-5 pb-4 flex items-center justify-between border-b border-slate-200 dark:border-gray-700">
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-gray-100">Anexos</h2>
          <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5">
            {files.length} arquivo{files.length !== 1 ? 's' : ''} enviado{files.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
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
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md transition-all active:scale-95"
          >
            <Paperclip className="w-4 h-4" /> ADICIONAR ANEXO
          </button>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-y-auto px-6 py-5 custom-scrollbar space-y-5">
        {/* Zona de upload (drag & drop) */}
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={`rounded-xl border-2 border-dashed transition-colors ${
            isDragging
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/10'
              : 'border-slate-300 dark:border-gray-700 bg-slate-50 dark:bg-[#1e2028] hover:border-blue-400 dark:hover:border-blue-600'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip,.rar"
            onChange={onFileInputChange}
            className="hidden"
          />
          <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${
              isDragging ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-slate-200 dark:bg-[#2a2d36]'
            }`}>
              <Upload className={`w-6 h-6 transition-colors ${isDragging ? 'text-blue-500' : 'text-slate-400'}`} />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-gray-300">Arraste arquivos para cá ou</p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-sm font-bold text-blue-600 dark:text-blue-400 hover:underline"
              >
                selecione do computador
              </button>
            </div>
            <p className="text-xs text-slate-400 dark:text-gray-500">
              Máximo: {MAX_FILE_SIZE_MB} MB por arquivo
            </p>
          </div>
        </div>

        {/* Progresso de upload */}
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

        {/* Arquivos pendentes */}
        {pendingFiles.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-slate-600 dark:text-gray-300 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              Aguardando envio ({pendingFiles.length})
            </h3>
            <div className="space-y-1">
              {pendingFiles.map((f, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-lg">
                  <FileTypeIcon fileType={f.type} className="w-4 h-4" />
                  <span className="text-sm text-slate-700 dark:text-gray-200 flex-1 truncate">{f.name}</span>
                  <span className="text-xs text-slate-400 dark:text-gray-500">{formatFileSize(f.size)}</span>
                  <button onClick={() => removePending(i)} className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded transition-colors">
                    <X className="w-3.5 h-3.5 text-red-500" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Barra de busca */}
        {files.length > 0 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome do arquivo..."
              className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-[#2a2d36] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
        )}

        {/* Tabela de arquivos */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-slate-400 dark:text-gray-500 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Carregando arquivos...</span>
          </div>
        ) : filteredFiles.length > 0 ? (
          <div className="bg-white dark:bg-[#1e2028] rounded-xl border border-slate-200 dark:border-gray-700 overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-[#2a2d36] border-b border-slate-200 dark:border-gray-700">
                  <th className="px-4 py-3 text-xs font-extrabold text-slate-500 dark:text-gray-400 uppercase">Nome do arquivo</th>
                  <th className="px-4 py-3 text-xs font-extrabold text-slate-500 dark:text-gray-400 uppercase">Tipo</th>
                  <th className="px-4 py-3 text-xs font-extrabold text-slate-500 dark:text-gray-400 uppercase">Ext.</th>
                  <th className="px-4 py-3 text-xs font-extrabold text-slate-500 dark:text-gray-400 uppercase">Data</th>
                  <th className="px-4 py-3 text-xs font-extrabold text-slate-500 dark:text-gray-400 uppercase text-right">Opções</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                {filteredFiles.map(file => (
                  <tr key={file.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <FileTypeIcon fileType={file.file_type} className="w-5 h-5 flex-shrink-0" />
                        <span className="font-medium text-slate-700 dark:text-gray-200 truncate max-w-xs" title={file.file_name}>
                          {file.file_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-gray-300">
                      {getFileTypeLabel(file.file_type)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 text-xs font-bold bg-slate-100 dark:bg-[#2a2d36] text-slate-500 dark:text-gray-400 rounded">
                        {getFileExtension(file.file_name)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-gray-300">
                      {formatDateShort(file.uploaded_at || '')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <a
                          href={file.file_url}
                          download={file.file_name}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Baixar"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                        <button
                          onClick={() => setConfirmDeleteFile(file)}
                          title="Excluir"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : files.length > 0 && searchTerm ? (
          <div className="text-center py-8">
            <Search className="w-10 h-10 text-slate-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-slate-400 dark:text-gray-500">Nenhum arquivo encontrado para &quot;{searchTerm}&quot;.</p>
          </div>
        ) : (
          !pendingFiles.length && (
            <div className="text-center py-16">
              <Paperclip className="w-12 h-12 text-slate-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-sm text-slate-400 dark:text-gray-500">Nenhum anexo enviado para este paciente.</p>
            </div>
          )
        )}
      </div>

      {/* Modal de confirmação de exclusão */}
      <ConfirmModal
        isOpen={confirmDeleteFile !== null}
        onClose={() => setConfirmDeleteFile(null)}
        onConfirm={() => { if (confirmDeleteFile) handleDelete(confirmDeleteFile); }}
        title="Excluir anexo"
        message={`Tem certeza que deseja excluir "${confirmDeleteFile?.file_name}"? Esta ação não pode ser desfeita.`}
        confirmText="Excluir"
        type="danger"
      />
    </div>
  );
}
