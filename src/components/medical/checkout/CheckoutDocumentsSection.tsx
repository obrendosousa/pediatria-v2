'use client';

import { useState, useRef } from 'react';
import { Printer, Download, Loader2, Pill, Microscope, Syringe, FileText } from 'lucide-react';
import { printPrescription, generatePrescriptionHTML, PrescriptionDocType } from '@/components/medical-record/attendance/screens/Prescriptions';
import { printRequest, generateRequestHTML } from '@/components/medical-record/attendance/screens/ExamsAndProcedures';
import { printDocument, generateDocumentHTML } from '@/components/medical-record/attendance/screens/DocumentsAndCertificates';
import { downloadHtmlAsPdf } from '@/lib/pdfUtils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ConsultationDocs, PrescriptionDoc, ExamRequestDoc, MedicalDocumentDoc } from '@/hooks/useCheckoutPanel';

interface PrescriptionItemEntry {
  name?: string;
}

interface ExamEntry {
  name?: string;
  code?: string;
}

interface CheckoutDocumentsSectionProps {
  docs: ConsultationDocs;
}

export default function CheckoutDocumentsSection({ docs }: CheckoutDocumentsSectionProps) {
  const [downloading, setDownloading] = useState<string | null>(null);
  const printIframeRef = useRef<HTMLIFrameElement>(null);
  const { prescriptions, examRequests, documents, patientData } = docs;

  const totalDocs = prescriptions.length + examRequests.length + documents.length;
  if (totalDocs === 0) return null;

  const handlePrintPrescription = (presc: PrescriptionDoc, docType: PrescriptionDocType) => {
    printPrescription(
      { medications: presc.items || [], exams: presc.exam_items || [], vaccines: presc.vaccine_items || [] },
      patientData,
      docType
    );
  };

  const handleDownloadPrescription = async (presc: PrescriptionDoc, idx: number, docType: PrescriptionDocType) => {
    const suffixMap: Record<PrescriptionDocType, string> = { medications: 'Medicamentos', exams: 'Exames', vaccines: 'Vacinas' };
    const key = `presc-${presc.id || idx}-${docType}`;
    setDownloading(key);
    try {
      const html = generatePrescriptionHTML(
        { medications: presc.items || [], exams: presc.exam_items || [], vaccines: presc.vaccine_items || [] },
        patientData,
        docType
      );
      const baseName = (presc.model_name || `Receita_${idx + 1}`).replace(/\s+/g, '_');
      await downloadHtmlAsPdf(html, `${baseName}_${suffixMap[docType]}.pdf`);
    } catch (err) {
      console.error('Erro ao baixar receita:', err);
    } finally {
      setDownloading(null);
    }
  };

  const handlePrintExamRequest = (req: ExamRequestDoc) => {
    printRequest(req, patientData);
  };

  const handleDownloadExamRequest = async (req: ExamRequestDoc, idx: number) => {
    const key = `exam-${req.id || idx}`;
    setDownloading(key);
    try {
      const html = generateRequestHTML(req, patientData);
      const isSADT = req.request_type === 'SADT';
      const name = (req.model_name || `Solicitacao_${idx + 1}`).replace(/\s+/g, '_');
      await downloadHtmlAsPdf(html, `${name}.pdf`, !isSADT);
    } catch (err) {
      console.error('Erro ao baixar solicitacao:', err);
    } finally {
      setDownloading(null);
    }
  };

  const handlePrintDocument = (doc: MedicalDocumentDoc) => {
    printDocument(
      doc.type,
      doc.document_date || doc.created_at || '',
      doc.content,
      printIframeRef,
      { ...patientData, doctor_name: 'Dra. Fernanda Santana', doctor_phone: '(99) 98429-2254' }
    );
  };

  const handleDownloadDocument = async (doc: MedicalDocumentDoc, idx: number) => {
    const key = `doc-${doc.id || idx}`;
    setDownloading(key);
    try {
      const html = generateDocumentHTML(
        doc.type,
        doc.document_date || doc.created_at || '',
        doc.content,
        { ...patientData, doctor_name: 'Dra. Fernanda Santana', doctor_phone: '(99) 98429-2254' }
      );
      const name = (doc.type || `Documento_${idx + 1}`).replace(/\s+/g, '_');
      await downloadHtmlAsPdf(html, `${name}.pdf`);
    } catch (err) {
      console.error('Erro ao baixar documento:', err);
    } finally {
      setDownloading(null);
    }
  };

  const buildPrescLabel = (presc: PrescriptionDoc, idx: number): string => {
    if (presc.model_name) return presc.model_name;
    const names = (presc.items || []).filter((i: PrescriptionItemEntry) => i.name?.trim()).map((i: PrescriptionItemEntry) => i.name!.trim());
    if (names.length > 0) return `Receita - ${names.slice(0, 3).join(', ')}${names.length > 3 ? '...' : ''}`;
    return `Receita ${idx + 1}`;
  };

  return (
    <section className="rounded-xl border-l-4 border-l-blue-500 border border-slate-200 dark:border-[#3d3d48] bg-white dark:bg-[#0f0f14] p-4">
      <h4 className="text-sm font-bold text-slate-800 dark:text-[#fafafa] flex items-center gap-2 mb-3">
        <FileText className="w-4 h-4 text-blue-500" />
        Documentos da Consulta
        <span className="text-[10px] font-medium px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full">
          {totalDocs}
        </span>
      </h4>

      <div className="space-y-2">
        {/* Prescriptions */}
        {prescriptions.map((presc, idx) => {
          const medsCount = (presc.items || []).filter((i: PrescriptionItemEntry) => i.name?.trim()).length;
          const examsCount = (presc.exam_items || []).filter((i: PrescriptionItemEntry) => i.name?.trim()).length;
          const vaccCount = (presc.vaccine_items || []).filter((i: PrescriptionItemEntry) => i.name?.trim()).length;

          const types: { type: PrescriptionDocType; label: string; count: number; icon: React.ReactNode; color: string }[] = [
            { type: 'medications', label: 'Medicamentos', count: medsCount, icon: <Pill className="w-3.5 h-3.5" />, color: 'blue' },
            { type: 'exams', label: 'Exames', count: examsCount, icon: <Microscope className="w-3.5 h-3.5" />, color: 'emerald' },
            { type: 'vaccines', label: 'Vacinas', count: vaccCount, icon: <Syringe className="w-3.5 h-3.5" />, color: 'purple' },
          ];

          return types.filter(t => t.count > 0).map(({ type, label, count, icon, color }) => {
            const dlKey = `presc-${presc.id || idx}-${type}`;
            return (
              <div key={`${presc.id}-${type}`} className="flex items-center justify-between bg-slate-50/80 dark:bg-[#1a1a22] rounded-lg p-3 group hover:bg-slate-100 dark:hover:bg-[#1f1f2a] transition-colors">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span className={`text-${color}-500`}>{icon}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-700 dark:text-gray-200 truncate">
                      {buildPrescLabel(presc, idx)} - {label}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-[#71717a]">{count} ite{count > 1 ? 'ns' : 'm'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100">
                  <button
                    onClick={() => handlePrintPrescription(presc, type)}
                    className="p-2 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 transition-colors"
                    title="Imprimir"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDownloadPrescription(presc, idx, type)}
                    disabled={downloading === dlKey}
                    className="p-2 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 transition-colors disabled:opacity-50"
                    title="Baixar PDF"
                  >
                    {downloading === dlKey ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            );
          });
        })}

        {/* Exam Requests */}
        {examRequests.map((req, idx) => {
          const exCount = (req.exams || []).filter((e: ExamEntry) => e.name || e.code).length;
          const dlKey = `exam-${req.id || idx}`;
          const label = req.model_name || (req.exams || []).slice(0, 2).map((e: ExamEntry) => e.name).filter(Boolean).join(', ') || `Solicitacao ${idx + 1}`;
          return (
            <div key={`exam-${req.id}`} className="flex items-center justify-between bg-slate-50/80 dark:bg-[#1a1a22] rounded-lg p-3 group hover:bg-slate-100 dark:hover:bg-[#1f1f2a] transition-colors">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <span className="text-emerald-500"><Microscope className="w-3.5 h-3.5" /></span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-700 dark:text-gray-200 truncate">
                    {label}
                    <span className="ml-2 text-[10px] font-medium px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded">
                      {req.request_type || 'PARTICULAR'}
                    </span>
                  </p>
                  <p className="text-xs text-slate-400 dark:text-[#71717a]">{exCount} exame{exCount !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100">
                <button onClick={() => handlePrintExamRequest(req)} className="p-2 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 transition-colors" title="Imprimir">
                  <Printer className="w-4 h-4" />
                </button>
                <button onClick={() => handleDownloadExamRequest(req, idx)} disabled={downloading === dlKey} className="p-2 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 transition-colors disabled:opacity-50" title="Baixar PDF">
                  {downloading === dlKey ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                </button>
              </div>
            </div>
          );
        })}

        {/* Medical Documents / Certificates */}
        {documents.map((doc, idx) => {
          const dlKey = `doc-${doc.id || idx}`;
          return (
            <div key={`doc-${doc.id}`} className="flex items-center justify-between bg-slate-50/80 dark:bg-[#1a1a22] rounded-lg p-3 group hover:bg-slate-100 dark:hover:bg-[#1f1f2a] transition-colors">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <span className="text-amber-500"><FileText className="w-3.5 h-3.5" /></span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-700 dark:text-gray-200 truncate">{doc.type || 'Documento'}</p>
                  <p className="text-xs text-slate-400 dark:text-[#71717a]">
                    {doc.document_date ? format(new Date(doc.document_date + 'T12:00:00'), "dd/MM/yyyy", { locale: ptBR }) : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100">
                <button onClick={() => handlePrintDocument(doc)} className="p-2 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 transition-colors" title="Imprimir">
                  <Printer className="w-4 h-4" />
                </button>
                <button onClick={() => handleDownloadDocument(doc, idx)} disabled={downloading === dlKey} className="p-2 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 transition-colors disabled:opacity-50" title="Baixar PDF">
                  {downloading === dlKey ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <iframe ref={printIframeRef} style={{ position: 'absolute', width: 0, height: 0, border: 'none' }} />
    </section>
  );
}
