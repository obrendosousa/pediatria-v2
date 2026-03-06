'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { X, Printer, Download, FileText, Pill, Microscope, Loader2, FileCheck, Syringe } from 'lucide-react';
import { printPrescription, generatePrescriptionHTML, PrescriptionDocType } from '@/components/medical-record/attendance/screens/Prescriptions';
import { printRequest, generateRequestHTML } from '@/components/medical-record/attendance/screens/ExamsAndProcedures';
import { printDocument, generateDocumentHTML } from '@/components/medical-record/attendance/screens/DocumentsAndCertificates';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const supabase = createClient();

async function downloadHtmlAsPdf(html: string, filename: string) {
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;background:white;';
  container.innerHTML = '';

  // Create an iframe to properly render the full HTML document
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'width:794px;min-height:1123px;border:none;';
  container.appendChild(iframe);
  document.body.appendChild(container);

  await new Promise<void>((resolve) => {
    iframe.onload = () => resolve();
    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
    }
    // Fallback timeout
    setTimeout(resolve, 1000);
  });

  // Wait a bit more for styles to apply
  await new Promise((r) => setTimeout(r, 500));

  try {
    const body = iframe.contentWindow?.document.body;
    if (!body) throw new Error('Erro ao renderizar documento');

    // Set iframe height to match content
    iframe.style.height = body.scrollHeight + 'px';

    const canvas = await html2canvas(body, {
      scale: 2,
      useCORS: true,
      logging: false,
      width: 794,
      height: body.scrollHeight,
      windowWidth: 794,
    });

    const imgData = canvas.toDataURL('image/png');
    const imgWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    const pdf = new jsPDF('p', 'mm', 'a4');
    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = -(imgHeight - heightLeft);
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(filename);
  } finally {
    document.body.removeChild(container);
  }
}

interface PrintDocumentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: number;
  patientName: string;
}

export default function PrintDocumentsModal({
  isOpen,
  onClose,
  patientId,
  patientName
}: PrintDocumentsModalProps) {
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [examRequests, setExamRequests] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [patientData, setPatientData] = useState<any>(null);
  const printIframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (isOpen && patientId) {
      loadDocuments();
    }
  }, [isOpen, patientId]);

  async function loadDocuments() {
    setLoading(true);
    try {
      const { data: patient } = await supabase
        .from('patients')
        .select('*')
        .eq('id', patientId)
        .single();

      setPatientData(patient);

      const { data: record } = await supabase
        .from('medical_records')
        .select('id')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!record?.id) {
        setPrescriptions([]);
        setExamRequests([]);
        setDocuments([]);
        setLoading(false);
        return;
      }

      const [prescRes, examsRes, docsRes] = await Promise.all([
        supabase
          .from('prescriptions')
          .select('*')
          .eq('medical_record_id', record.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('exam_requests')
          .select('*')
          .eq('medical_record_id', record.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('medical_documents')
          .select('*')
          .eq('medical_record_id', record.id)
          .order('created_at', { ascending: false }),
      ]);

      setPrescriptions(prescRes.data || []);
      setExamRequests(examsRes.data || []);
      setDocuments(docsRes.data || []);
    } catch (err) {
      console.error('Erro ao carregar documentos:', err);
    } finally {
      setLoading(false);
    }
  }

  // ── Print handlers ──
  const handlePrintPrescription = (presc: any, docType: PrescriptionDocType) => {
    const draft = {
      medications: presc.items || [],
      exams: presc.exam_items || [],
      vaccines: presc.vaccine_items || [],
    };
    printPrescription(draft, patientData, docType);
  };

  const handlePrintExamRequest = (req: any) => {
    printRequest(req, patientData);
  };

  const handlePrintDocument = (doc: any) => {
    printDocument(
      doc.type,
      doc.document_date || doc.created_at,
      doc.content,
      printIframeRef,
      { ...patientData, doctor_name: 'Dra. Fernanda Santana', doctor_phone: '(99) 98429-2254' }
    );
  };

  // ── Download PDF handlers ──
  const handleDownloadPrescription = async (presc: any, idx: number, docType: PrescriptionDocType) => {
    const suffixMap: Record<PrescriptionDocType, string> = {
      medications: 'Medicamentos',
      exams: 'Exames',
      vaccines: 'Vacinas',
    };
    const key = `presc-${presc.id || idx}-${docType}`;
    setDownloading(key);
    try {
      const draft = {
        medications: presc.items || [],
        exams: presc.exam_items || [],
        vaccines: presc.vaccine_items || [],
      };
      const html = generatePrescriptionHTML(draft, patientData, docType);
      const baseName = (presc.model_name || `Receita_${idx + 1}`).replace(/\s+/g, '_');
      await downloadHtmlAsPdf(html, `${baseName}_${suffixMap[docType]}.pdf`);
    } catch (err) {
      console.error('Erro ao baixar receita:', err);
    } finally {
      setDownloading(null);
    }
  };

  const handleDownloadExamRequest = async (req: any, idx: number) => {
    const key = `exam-${req.id || idx}`;
    setDownloading(key);
    try {
      const html = generateRequestHTML(req, patientData);
      const name = (req.model_name || `Solicitacao_${idx + 1}`).replace(/\s+/g, '_');
      await downloadHtmlAsPdf(html, `${name}.pdf`);
    } catch (err) {
      console.error('Erro ao baixar solicitação:', err);
    } finally {
      setDownloading(null);
    }
  };

  const handleDownloadDocument = async (doc: any, idx: number) => {
    const key = `doc-${doc.id || idx}`;
    setDownloading(key);
    try {
      const html = generateDocumentHTML(
        doc.type,
        doc.document_date || doc.created_at,
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

  const totalDocs = prescriptions.length + examRequests.length + documents.length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[80] flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white dark:bg-[#1e2028] w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="bg-blue-50 dark:bg-blue-900/20 px-6 py-4 border-b border-slate-200 dark:border-gray-700 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-black text-slate-800 dark:text-gray-100 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              Documentos da Consulta
            </h2>
            <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">{patientName}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/50 dark:hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-3" />
              <p className="text-sm text-slate-500">Carregando documentos...</p>
            </div>
          ) : totalDocs === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileCheck className="w-12 h-12 text-slate-300 dark:text-gray-600 mb-3" />
              <p className="text-sm text-slate-500 dark:text-gray-400">Nenhum documento gerado nesta consulta.</p>
              <p className="text-xs text-slate-400 dark:text-gray-500 mt-1">Receitas, exames e atestados aparecem aqui.</p>
            </div>
          ) : (
            <>
              {/* Prescriptions — separadas por tipo */}
              {prescriptions.length > 0 && prescriptions.map((presc: any, idx: number) => {
                const medsCount = (presc.items || []).filter((i: any) => i.name?.trim()).length;
                const examsCount = (presc.exam_items || []).filter((i: any) => i.name?.trim()).length;
                const vaccCount = (presc.vaccine_items || []).filter((i: any) => i.name?.trim()).length;
                const prescLabel = presc.model_name || `Receita ${idx + 1}`;

                const types: { type: PrescriptionDocType; label: string; count: number; icon: React.ReactNode; iconColor: string; btnClass: string; btnDisabledClass: string }[] = [
                  { type: 'medications', label: 'Medicamentos', count: medsCount, icon: <Pill className="w-3.5 h-3.5" />, iconColor: 'text-blue-500', btnClass: 'bg-blue-600 hover:bg-blue-700', btnDisabledClass: 'disabled:bg-blue-400' },
                  { type: 'exams', label: 'Exames', count: examsCount, icon: <Microscope className="w-3.5 h-3.5" />, iconColor: 'text-emerald-500', btnClass: 'bg-emerald-600 hover:bg-emerald-700', btnDisabledClass: 'disabled:bg-emerald-400' },
                  { type: 'vaccines', label: 'Vacinas', count: vaccCount, icon: <Syringe className="w-3.5 h-3.5" />, iconColor: 'text-purple-500', btnClass: 'bg-purple-600 hover:bg-purple-700', btnDisabledClass: 'disabled:bg-purple-400' },
                ];

                const activeTypes = types.filter(t => t.count > 0);
                if (activeTypes.length === 0) return null;

                return (
                  <div key={presc.id || idx}>
                    <h3 className="text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" />
                      {prescLabel}
                    </h3>
                    <div className="space-y-2">
                      {activeTypes.map(({ type, label, count, icon, iconColor, btnClass, btnDisabledClass }) => {
                        const dlKey = `presc-${presc.id || idx}-${type}`;
                        return (
                          <div key={type} className="flex items-center justify-between bg-slate-50 dark:bg-[#2a2d36] rounded-lg border border-slate-200 dark:border-gray-700 p-3">
                            <div className="flex items-center gap-2 min-w-0 flex-1 mr-3">
                              <span className={iconColor}>{icon}</span>
                              <div>
                                <p className="text-sm font-bold text-slate-700 dark:text-gray-200">{label}</p>
                                <p className="text-xs text-slate-500 dark:text-gray-400">{count} ite{count > 1 ? 'ns' : 'm'}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                onClick={() => handlePrintPrescription(presc, type)}
                                className={`flex items-center gap-1.5 px-3 py-2 ${btnClass} text-white rounded-lg text-xs font-bold transition-colors`}
                                title="Imprimir"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                Imprimir
                              </button>
                              <button
                                onClick={() => handleDownloadPrescription(presc, idx, type)}
                                disabled={downloading === dlKey}
                                className={`flex items-center gap-1.5 px-3 py-2 ${btnClass} ${btnDisabledClass} text-white rounded-lg text-xs font-bold transition-colors`}
                                title="Baixar PDF"
                              >
                                {downloading === dlKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                                PDF
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Exam Requests */}
              {examRequests.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Microscope className="w-3.5 h-3.5" />
                    Solicitacoes de Exames ({examRequests.length})
                  </h3>
                  <div className="space-y-2">
                    {examRequests.map((req, idx) => {
                      const examsCount = (req.exams || []).filter((e: any) => e.name || e.code).length;
                      const dlKey = `exam-${req.id || idx}`;
                      return (
                        <div key={req.id || idx} className="flex items-center justify-between bg-slate-50 dark:bg-[#2a2d36] rounded-lg border border-slate-200 dark:border-gray-700 p-3">
                          <div className="min-w-0 flex-1 mr-3">
                            <p className="text-sm font-bold text-slate-700 dark:text-gray-200">
                              {req.model_name || `Solicitacao ${idx + 1}`}
                              <span className="ml-2 text-[10px] font-medium px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded">
                                {req.request_type || 'PARTICULAR'}
                              </span>
                            </p>
                            <p className="text-xs text-slate-500 dark:text-gray-400">
                              {examsCount} exame{examsCount !== 1 ? 's' : ''}
                              {req.clinical_indication ? ` • ${req.clinical_indication.substring(0, 40)}...` : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => handlePrintExamRequest(req)}
                              className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors"
                              title="Imprimir"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              Imprimir
                            </button>
                            <button
                              onClick={() => handleDownloadExamRequest(req, idx)}
                              disabled={downloading === dlKey}
                              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-lg text-xs font-bold transition-colors"
                              title="Baixar PDF"
                            >
                              {downloading === dlKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                              PDF
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Documents / Certificates */}
              {documents.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    Atestados e Documentos ({documents.length})
                  </h3>
                  <div className="space-y-2">
                    {documents.map((doc, idx) => {
                      const dlKey = `doc-${doc.id || idx}`;
                      return (
                        <div key={doc.id || idx} className="flex items-center justify-between bg-slate-50 dark:bg-[#2a2d36] rounded-lg border border-slate-200 dark:border-gray-700 p-3">
                          <div className="min-w-0 flex-1 mr-3">
                            <p className="text-sm font-bold text-slate-700 dark:text-gray-200">
                              {doc.type || 'Documento'}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-gray-400">
                              {doc.document_date
                                ? format(new Date(doc.document_date + 'T12:00:00'), "dd/MM/yyyy", { locale: ptBR })
                                : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => handlePrintDocument(doc)}
                              className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors"
                              title="Imprimir"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              Imprimir
                            </button>
                            <button
                              onClick={() => handleDownloadDocument(doc, idx)}
                              disabled={downloading === dlKey}
                              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-lg text-xs font-bold transition-colors"
                              title="Baixar PDF"
                            >
                              {downloading === dlKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                              PDF
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 dark:bg-[#2a2d36] border-t border-slate-200 dark:border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-gray-400 hover:text-slate-800 dark:hover:text-gray-200 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>

      {/* Hidden iframe for document printing */}
      <iframe ref={printIframeRef} style={{ position: 'absolute', width: 0, height: 0, border: 'none' }} />
    </div>
  );
}
