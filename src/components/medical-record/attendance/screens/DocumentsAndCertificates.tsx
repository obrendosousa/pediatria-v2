'use client';

import React, { useState, useRef, useCallback } from 'react';
import {
  FileText,
  Plus,
  Printer,
  Save,
  Trash2,
  PenLine,
  ChevronRight,
  Calendar,
  BookOpen,
  CheckSquare,
  Square,
  AlertCircle,
} from 'lucide-react';
import { RichTextEditor } from '../RichTextEditor';
import { ModelTemplateModal } from '../ModelTemplateModal';
import { useDocuments, MedicalDocument, DocumentType } from '@/hooks/useDocuments';
import { useToast } from '@/contexts/ToastContext';
import { AttendanceScreenProps } from '@/types/attendance';

// ─── Constantes ──────────────────────────────────────────────────────────────
const DOCUMENT_TYPES: DocumentType[] = [
  'Atestado Médico',
  'Declaração de Comparecimento',
  'Laudo Médico',
  'Relatório Médico',
  'Atestado para Escola/Faculdade',
  'Prescrição de Dieta',
  'Encaminhamento',
  'Receita',
  'Outros',
];

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

function formatDateBR(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function formatRelativeDate(isoString: string): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Hoje';
  if (days === 1) return 'Ontem';
  if (days < 7) return `${days} dias atrás`;
  return formatDateBR(isoString.split('T')[0]);
}

// ─── Ícone por tipo ──────────────────────────────────────────────────────────
function DocTypeIcon({ type }: { type: string }) {
  return <FileText className="w-4 h-4 text-blue-500" />;
}

// ─── Componente principal ────────────────────────────────────────────────────
export function printDocument(
  docType: string,
  docDate: string,
  content: string,
  printIframeRef: React.RefObject<HTMLIFrameElement | null>,
  patientData: any
) {
  const doctorName = patientData?.doctor_name || 'Dr(a).';
  const doctorPhone = patientData?.doctor_phone || '';
  const patientName = patientData?.full_name || patientData?.name || 'Paciente';
  const patientCPF = patientData?.cpf || '';
  const dateFormatted = formatDateBR(docDate);
  const contentHtml = content || '';

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; color: #1a1a1a; background: white; }
  .page { width: 210mm; min-height: 297mm; padding: 25mm 20mm 20mm; display: flex; flex-direction: column; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 12px; border-bottom: 2px solid #1a1a1a; margin-bottom: 20px; }
  .clinic-name { font-size: 15pt; font-weight: bold; color: #1a1a1a; }
  .clinic-info { font-size: 9pt; color: #555; margin-top: 3px; }
  .doc-title { text-align: center; font-size: 14pt; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 18px; padding-bottom: 8px; border-bottom: 1px solid #ccc; }
  .patient-info { font-size: 10pt; margin-bottom: 18px; color: #333; }
  .patient-info span { font-weight: bold; color: #1a1a1a; }
  .content { flex: 1; font-size: 11pt; line-height: 1.7; text-align: justify; }
  .content p { margin-bottom: 10px; }
  .footer { margin-top: 40px; border-top: 1px solid #ccc; padding-top: 20px; }
  .signature-area { display: flex; flex-direction: column; align-items: center; gap: 6px; }
  .signature-line { width: 220px; border-bottom: 1px solid #1a1a1a; height: 40px; }
  .signature-text { font-size: 10pt; color: #555; text-align: center; }
  .date-location { font-size: 10pt; color: #555; margin-bottom: 20px; text-align: right; }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div>
      <div class="clinic-name">${doctorName}</div>
      ${doctorPhone ? `<div class="clinic-info">Tel: ${doctorPhone}</div>` : ''}
    </div>
    <div style="text-align:right;">
      <div class="clinic-info">${dateFormatted}</div>
    </div>
  </div>

  <div class="doc-title">${docType}</div>

  <div class="patient-info">
    Paciente: <span>${patientName}</span>
    ${patientCPF ? ` &nbsp;|&nbsp; CPF: <span>${patientCPF}</span>` : ''}
  </div>

  <div class="content">${contentHtml}</div>

  <div class="footer">
    <div class="date-location">Data: ${dateFormatted}</div>
    <div class="signature-area">
      <div class="signature-line"></div>
      <div class="signature-text">${doctorName}</div>
    </div>
  </div>
</div>
</body>
</html>`;

  const iframe = printIframeRef.current;
  if (!iframe) return;
  const docHtml = iframe.contentDocument || iframe.contentWindow?.document;
  if (!docHtml) return;
  docHtml.open();
  docHtml.write(html);
  docHtml.close();
  setTimeout(() => {
    iframe.contentWindow?.print();
  }, 400);
}

export function DocumentsAndCertificates({ patientId, patientData, appointmentId, medicalRecordId }: AttendanceScreenProps) {
  const { toast } = useToast();
  const {
    documents,
    isLoading,
    isSaving,
    createDocument,
    updateDocument,
    deleteDocument,
  } = useDocuments(patientId, medicalRecordId);

  // Estado do editor
  const [selectedDoc, setSelectedDoc] = useState<MedicalDocument | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Campos do formulário
  const [docType, setDocType] = useState<string>('Atestado Médico');
  const [docDate, setDocDate] = useState<string>(todayISO());
  const [content, setContent] = useState<string>('');
  const [requiresSignature, setRequiresSignature] = useState(false);

  // Modal de modelos
  const [modelModalOpen, setModelModalOpen] = useState(false);

  // Ref para impressão
  const printIframeRef = useRef<HTMLIFrameElement>(null);

  // ── Novo documento ──────────────────────────────────────────────────────
  function handleNewDocument() {
    setSelectedDoc(null);
    setDocType('Atestado Médico');
    setDocDate(todayISO());
    setContent('');
    setRequiresSignature(false);
    setIsEditing(true);
  }

  // ── Editar documento existente ──────────────────────────────────────────
  function handleEditDocument(doc: MedicalDocument) {
    setSelectedDoc(doc);
    setDocType(doc.type);
    setDocDate(doc.document_date);
    setContent(doc.content);
    setRequiresSignature(doc.requires_signature);
    setIsEditing(true);
  }

  // ── Cancelar edição ─────────────────────────────────────────────────────
  function handleCancel() {
    setIsEditing(false);
    setSelectedDoc(null);
  }

  // ── Salvar ──────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!content.replace(/<[^>]*>/g, '').trim()) {
      toast.toast.error('O conteúdo do documento não pode estar vazio.');
      return;
    }

    try {
      if (selectedDoc?.id) {
        await updateDocument(selectedDoc.id, {
          type: docType,
          content,
          document_date: docDate,
          requires_signature: requiresSignature,
        });
        toast.toast.success('Documento atualizado com sucesso!');
      } else {
        await createDocument({
          patient_id: patientId,
          type: docType,
          content,
          document_date: docDate,
          requires_signature: requiresSignature,
        });
        toast.toast.success('Documento salvo com sucesso!');
      }
      setIsEditing(false);
      setSelectedDoc(null);
    } catch (err: any) {
      console.error('[DocumentsAndCertificates] save:', err);
      toast.toast.error('Erro ao salvar documento: ' + err.message);
    }
  }

  // ── Excluir ─────────────────────────────────────────────────────────────
  async function handleDelete(doc: MedicalDocument) {
    if (!doc.id) return;
    if (!window.confirm('Deseja excluir este documento permanentemente?')) return;
    try {
      await deleteDocument(doc.id);
      if (selectedDoc?.id === doc.id) {
        setIsEditing(false);
        setSelectedDoc(null);
      }
      toast.toast.success('Documento excluído.');
    } catch (err: any) {
      toast.toast.error('Erro ao excluir: ' + err.message);
    }
  }

  // ── Imprimir / PDF ──────────────────────────────────────────────────────
  function handlePrint() {
    printDocument(docType, docDate, content, printIframeRef, patientData);
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full min-h-0">
      {/* iframe oculto para impressão */}
      <iframe
        ref={printIframeRef}
        style={{ position: 'absolute', width: 0, height: 0, border: 'none', opacity: 0 }}
        title="print-frame"
      />

      {/* ── Painel esquerdo: lista de documentos ─────────────────────────── */}
      <div className="w-72 flex-shrink-0 border-r border-slate-200 dark:border-gray-700 flex flex-col">
        {/* Cabeçalho */}
        <div className="p-4 border-b border-slate-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-500" />
            <span className="font-semibold text-slate-700 dark:text-gray-200 text-sm">Documentos</span>
          </div>
          <button
            onClick={handleNewDocument}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Novo
          </button>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {isLoading ? (
            <div className="p-6 text-center text-slate-400 dark:text-gray-500 text-sm">
              Carregando...
            </div>
          ) : documents.length === 0 ? (
            <div className="p-6 text-center">
              <FileText className="w-10 h-10 text-slate-300 dark:text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-slate-400 dark:text-gray-500">Nenhum documento</p>
              <p className="text-xs text-slate-300 dark:text-gray-600 mt-1">
                Clique em &ldquo;Novo&rdquo; para criar
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-gray-800">
              {documents.map((doc) => (
                <li key={doc.id}>
                  <button
                    onClick={() => handleEditDocument(doc)}
                    className={`w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-[#2a2d36] transition-colors group ${selectedDoc?.id === doc.id && isEditing
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-500'
                      : ''
                      }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5">
                        <DocTypeIcon type={doc.type} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 dark:text-gray-200 truncate">
                          {doc.type}
                        </p>
                        <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5">
                          {formatRelativeDate(doc.created_at || '')}
                        </p>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-gray-600 flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ── Painel direito: editor ───────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {isEditing ? (
          <>
            {/* Toolbar do editor */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-gray-700 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3 flex-wrap">
                {/* Tipo do documento */}
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-slate-500 dark:text-gray-400 whitespace-nowrap">
                    Tipo:
                  </label>
                  <select
                    value={docType}
                    onChange={(e) => setDocType(e.target.value)}
                    className="text-sm border border-slate-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-[#2a2d36] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    {DOCUMENT_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                {/* Data */}
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <input
                    type="date"
                    value={docDate}
                    onChange={(e) => setDocDate(e.target.value)}
                    className="text-sm border border-slate-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-[#2a2d36] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                {/* Requer assinatura */}
                <button
                  type="button"
                  onClick={() => setRequiresSignature((v) => !v)}
                  className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  {requiresSignature ? (
                    <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                  <span className="text-xs whitespace-nowrap">Colher assinatura do paciente</span>
                </button>
              </div>

              {/* Ações do documento */}
              <div className="flex items-center gap-2">
                {selectedDoc?.id && (
                  <button
                    type="button"
                    onClick={() => handleDelete(selectedDoc)}
                    className="p-2 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    title="Excluir documento"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setModelModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-gray-300 border border-slate-200 dark:border-gray-700 rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <BookOpen className="w-4 h-4" />
                  Modelos
                </button>

                <button
                  type="button"
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-gray-300 border border-slate-200 dark:border-gray-700 rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  Imprimir
                </button>

                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-3 py-1.5 text-sm font-medium text-slate-500 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  {isSaving ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {isSaving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>

            {/* Badge de assinatura */}
            {requiresSignature && (
              <div className="mx-6 mt-3 flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-700 dark:text-amber-300 text-xs">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                Este documento requer coleta de assinatura do paciente ao imprimir.
              </div>
            )}

            {/* Editor de texto */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              <RichTextEditor
                value={content}
                onChange={setContent}
                placeholder={`Digite o conteúdo do ${docType.toLowerCase()} aqui...`}
                className="min-h-[480px]"
              />
            </div>
          </>
        ) : (
          /* ── Estado vazio / landing ─────────────────────────────────── */
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mb-4">
              <PenLine className="w-8 h-8 text-blue-500" />
            </div>
            <h3 className="text-lg font-semibold text-slate-700 dark:text-gray-200 mb-2">
              Documentos e Atestados
            </h3>
            <p className="text-sm text-slate-400 dark:text-gray-500 max-w-xs mb-6">
              Crie atestados, declarações, laudos e outros documentos médicos para este paciente.
            </p>
            <button
              onClick={handleNewDocument}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Novo Documento
            </button>
          </div>
        )}
      </div>

      {/* Modal de modelos */}
      <ModelTemplateModal
        isOpen={modelModalOpen}
        onClose={() => setModelModalOpen(false)}
        type="documentos"
        currentContent={content}
        onSelect={(templateContent) => {
          setContent(templateContent);
          setModelModalOpen(false);
        }}
        onSave={(title, templateContent, type) => {
          // O modal já lida com o save internamente
        }}
      />
    </div>
  );
}
