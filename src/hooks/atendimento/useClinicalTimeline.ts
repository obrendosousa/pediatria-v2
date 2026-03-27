'use client';

import { useState, useCallback } from 'react';
import { createSchemaClient } from '@/lib/supabase/schemaClient';
import { createClient } from '@/lib/supabase/client';

const ateSupabase = createSchemaClient('atendimento');
const pubSupabase = createClient();

// ── Tipos ────────────────────────────────────────────────────

export type TimelineEntryType =
  | 'consulta'
  | 'anamnese'
  | 'evolucao'
  | 'receita'
  | 'atestado'
  | 'laudo'
  | 'exame_pedido'
  | 'exame_resultado'
  | 'documento';

export interface TimelineEntry {
  id: number;
  type: TimelineEntryType;
  title: string;
  preview: string;
  htmlContent: string | null;
  date: string;
  doctorId: number | null;
  signed: boolean;
  /** Dados brutos da prescrição para impressão especializada */
  rawPrescription?: {
    items: Array<{ name: string; posology: string; quantity: number; unit: string; receipt_type: 'simples' | 'especial' }>;
    exam_items: Array<{ code?: string; name: string; quantity: number }>;
    vaccine_items: Array<{ name: string; dose?: string }>;
  };
}

export interface TimelineFilters {
  doctorId: number | null;
  types: TimelineEntryType[];
  dateFrom: string;
  dateTo: string;
}

// ── Tipos internos dos sub-registros ─────────────────────────

type PrescRow = Record<string, unknown>;
type ExamReqRow = Record<string, unknown>;
type DocRow = Record<string, unknown>;

// ── Helpers ──────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + '…';
}

/** Gera HTML de sinais vitais em badges */
function buildVitalsHtml(vitals: Record<string, number | undefined>): string {
  const pairs: [string, string][] = [];
  if (vitals.weight) pairs.push(['Peso', `${vitals.weight} kg`]);
  if (vitals.height) pairs.push(['Altura', `${vitals.height} cm`]);
  if (vitals.imc) pairs.push(['IMC', `${vitals.imc}`]);
  if (vitals.pe) pairs.push(['PC', `${vitals.pe} cm`]);
  if (vitals.temp) pairs.push(['Temp', `${vitals.temp} °C`]);
  if (vitals.heartRate) pairs.push(['FC', `${vitals.heartRate} bpm`]);
  if (vitals.respRate) pairs.push(['FR', `${vitals.respRate} rpm`]);
  if (vitals.saturation) pairs.push(['SpO₂', `${vitals.saturation}%`]);
  if (vitals.sysBP && vitals.diaBP) pairs.push(['PA', `${vitals.sysBP}/${vitals.diaBP} mmHg`]);
  if (pairs.length === 0) return '';
  let html = '<div style="margin-bottom:14px"><strong style="font-size:12px;color:#0ea5e9;text-transform:uppercase;letter-spacing:0.5px">Sinais Vitais</strong>';
  html += '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:6px">';
  pairs.forEach(([label, value]) => {
    html += `<span style="background:#f0f9ff;border:1px solid #e0f2fe;border-radius:6px;padding:3px 8px;font-size:12px"><strong>${label}:</strong> ${value}</span>`;
  });
  html += '</div></div>';
  return html;
}

/** Gera HTML das seções SOAP */
function buildSoapHtml(fields: { chiefComplaint: string; hda: string; physicalExam: string; diagnosis: string; conducts: string }): string {
  const sections: [string, string, string][] = [
    ['Queixa Principal', fields.chiefComplaint, '#dc2626'],
    ['HDA', fields.hda, '#2563eb'],
    ['Exame Físico', fields.physicalExam, '#059669'],
    ['Diagnóstico', fields.diagnosis, '#7c3aed'],
    ['Condutas', fields.conducts, '#d97706'],
  ];
  let html = '';
  sections.forEach(([label, content, color]) => {
    if (!content) return;
    html += `<div style="margin-bottom:10px"><strong style="font-size:12px;color:${color};text-transform:uppercase;letter-spacing:0.5px">${label}</strong>`;
    html += `<div style="margin-top:4px;font-size:13px;line-height:1.5">${content}</div></div>`;
  });
  return html;
}

/** Gera HTML de receitas (medicamentos + vacinas + exames) */
function buildPrescriptionsHtml(rows: PrescRow[]): string {
  let html = '';
  rows.forEach((r, idx) => {
    const items = (r.items as Array<{ medication?: string; name?: string; posology?: string; quantity?: number; unit?: string }>) || [];
    const examItems = (r.exam_items as Array<{ code?: string; name?: string; quantity?: number }>) || [];
    const vaccineItems = (r.vaccine_items as Array<{ name?: string; dose?: string }>) || [];
    if (items.length === 0 && examItems.length === 0 && vaccineItems.length === 0) return;

    if (rows.length > 1) {
      html += `<div style="margin-bottom:4px;margin-top:${idx > 0 ? '12px' : '0'}"><strong style="font-size:11px;color:#9333ea">Receita ${idx + 1}</strong></div>`;
    }

    if (items.length > 0) {
      html += '<div style="margin-bottom:8px"><strong style="font-size:11px;color:#7c3aed;text-transform:uppercase;letter-spacing:0.5px">Medicamentos</strong>';
      html += '<table style="width:100%;border-collapse:collapse;margin-top:4px;font-size:12px">';
      html += '<thead><tr style="background:#f5f3ff"><th style="text-align:left;padding:4px 8px;border-bottom:1px solid #e5e7eb">Medicamento</th><th style="text-align:left;padding:4px 8px;border-bottom:1px solid #e5e7eb">Posologia</th><th style="text-align:center;padding:4px 8px;border-bottom:1px solid #e5e7eb">Qtd</th></tr></thead><tbody>';
      items.forEach(i => {
        const name = i.medication || i.name || '—';
        html += `<tr><td style="padding:4px 8px;border-bottom:1px solid #f0f0f0;font-weight:600">${name}</td><td style="padding:4px 8px;border-bottom:1px solid #f0f0f0">${i.posology || '—'}</td><td style="padding:4px 8px;border-bottom:1px solid #f0f0f0;text-align:center">${i.quantity || ''} ${i.unit || ''}</td></tr>`;
      });
      html += '</tbody></table></div>';
    }
    if (vaccineItems.length > 0) {
      html += '<div style="margin-bottom:8px"><strong style="font-size:11px;color:#7c3aed;text-transform:uppercase;letter-spacing:0.5px">Vacinas</strong>';
      html += '<ul style="margin-top:4px;padding-left:18px;font-size:12px">';
      vaccineItems.forEach(v => { html += `<li style="margin-bottom:2px"><strong>${v.name || '—'}</strong>${v.dose ? ` — ${v.dose}` : ''}</li>`; });
      html += '</ul></div>';
    }
    if (examItems.length > 0) {
      html += '<div style="margin-bottom:8px"><strong style="font-size:11px;color:#7c3aed;text-transform:uppercase;letter-spacing:0.5px">Exames Prescritos</strong>';
      html += '<ul style="margin-top:4px;padding-left:18px;font-size:12px">';
      examItems.forEach(e => { html += `<li style="margin-bottom:2px">${e.code ? `<code style="color:#2563eb;font-size:10px">${e.code}</code> — ` : ''}${e.name || '—'} <span style="color:#888">×${e.quantity || 1}</span></li>`; });
      html += '</ul></div>';
    }
  });
  return html;
}

/** Gera HTML de pedidos de exame */
function buildExamRequestsHtml(rows: ExamReqRow[]): string {
  let html = '';
  rows.forEach(r => {
    const exams = (r.exams as Array<{ name?: string; code?: string; quantity?: number }>) || [];
    const rType = (r.request_type as string) || '';
    if (exams.length === 0) return;
    if (rType) html += `<div style="margin-bottom:4px"><strong style="font-size:11px;color:#0891b2;text-transform:uppercase">Pedido de Exame${rType ? ` (${rType})` : ''}</strong></div>`;
    html += '<table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:8px">';
    html += '<thead><tr style="background:#ecfeff"><th style="text-align:left;padding:4px 8px;border-bottom:1px solid #e5e7eb">Exame</th><th style="text-align:left;padding:4px 8px;border-bottom:1px solid #e5e7eb">Código</th><th style="text-align:center;padding:4px 8px;border-bottom:1px solid #e5e7eb">Qtd</th></tr></thead><tbody>';
    exams.forEach(e => {
      html += `<tr><td style="padding:4px 8px;border-bottom:1px solid #f0f0f0;font-weight:600">${e.name || '—'}</td><td style="padding:4px 8px;border-bottom:1px solid #f0f0f0"><code style="color:#0891b2;font-size:10px">${e.code || '—'}</code></td><td style="padding:4px 8px;border-bottom:1px solid #f0f0f0;text-align:center">${e.quantity || 1}</td></tr>`;
    });
    html += '</tbody></table>';
  });
  return html;
}

/** Gera HTML de documentos (atestados, etc.) */
function buildDocumentsHtml(rows: DocRow[]): string {
  let html = '';
  rows.forEach(r => {
    const docType = (r.type as string) || 'Documento';
    const content = (r.content as string) || '';
    if (!content) return;
    html += `<div style="margin-bottom:8px"><strong style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">${docType}</strong>`;
    html += `<div style="margin-top:4px;font-size:12px;line-height:1.5">${content}</div></div>`;
  });
  return html;
}

// ── Hook ─────────────────────────────────────────────────────

export function useClinicalTimeline(patientId: number) {
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [doctors, setDoctors] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchDoctors = useCallback(async () => {
    const { data } = await pubSupabase
      .from('doctors')
      .select('id, name')
      .eq('active', true)
      .order('name');
    if (data) setDoctors(data as { id: number; name: string }[]);
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [
        medicalRecords,
        anamneses,
        evolutions,
        certificates,
        reports,
        examResults,
        prescriptions,
        examRequests,
        documents,
      ] = await Promise.all([
        pubSupabase
          .from('medical_records')
          .select('id, doctor_id, chief_complaint, hda, physical_exam, diagnosis, conducts, vitals, status, started_at, finished_at, created_at')
          .eq('patient_id', patientId),
        ateSupabase
          .from('anamneses')
          .select('id, doctor_id, title, content, fill_date, created_at, signed')
          .eq('patient_id', patientId),
        ateSupabase
          .from('clinical_evolutions')
          .select('id, doctor_id, content, evolution_date, created_at, signed')
          .eq('patient_id', patientId),
        ateSupabase
          .from('medical_certificates')
          .select('id, doctor_id, title, content, certificate_date, created_at, digital_signature')
          .eq('patient_id', patientId),
        ateSupabase
          .from('medical_reports')
          .select('id, doctor_id, title, content, report_date, created_at, digital_signature')
          .eq('patient_id', patientId),
        ateSupabase
          .from('exam_results')
          .select('id, doctor_id, exam_name, content, result_date, created_at')
          .eq('patient_id', patientId),
        pubSupabase
          .from('prescriptions')
          .select('id, medical_record_id, items, exam_items, vaccine_items, created_at')
          .eq('patient_id', patientId),
        pubSupabase
          .from('exam_requests')
          .select('id, medical_record_id, exams, request_date, request_type, created_at')
          .eq('patient_id', patientId),
        pubSupabase
          .from('medical_documents')
          .select('id, medical_record_id, type, content, document_date, created_at')
          .eq('patient_id', patientId),
      ]);

      // ── Agrupar sub-registros por medical_record_id ───────────
      const prescByMR = new Map<number, PrescRow[]>();
      const examReqByMR = new Map<number, ExamReqRow[]>();
      const docsByMR = new Map<number, DocRow[]>();
      const orphanPresc: PrescRow[] = [];
      const orphanExamReq: ExamReqRow[] = [];
      const orphanDocs: DocRow[] = [];

      (prescriptions.data || []).forEach((r: PrescRow) => {
        const mrId = r.medical_record_id as number | null;
        if (mrId) {
          if (!prescByMR.has(mrId)) prescByMR.set(mrId, []);
          prescByMR.get(mrId)!.push(r);
        } else {
          orphanPresc.push(r);
        }
      });

      (examRequests.data || []).forEach((r: ExamReqRow) => {
        const mrId = r.medical_record_id as number | null;
        if (mrId) {
          if (!examReqByMR.has(mrId)) examReqByMR.set(mrId, []);
          examReqByMR.get(mrId)!.push(r);
        } else {
          orphanExamReq.push(r);
        }
      });

      (documents.data || []).forEach((r: DocRow) => {
        const mrId = r.medical_record_id as number | null;
        if (mrId) {
          if (!docsByMR.has(mrId)) docsByMR.set(mrId, []);
          docsByMR.get(mrId)!.push(r);
        } else {
          orphanDocs.push(r);
        }
      });

      const all: TimelineEntry[] = [];

      // ── Consultas (registro principal + sub-registros agrupados) ──
      (medicalRecords.data || []).forEach((r: Record<string, unknown>) => {
        const mrId = r.id as number;
        const vitals = (r.vitals as Record<string, number | undefined>) || {};
        const chiefComplaint = (r.chief_complaint as string) || '';
        const diagnosis = (r.diagnosis as string) || '';
        const hda = (r.hda as string) || '';
        const physicalExam = (r.physical_exam as string) || '';
        const conducts = (r.conducts as string) || '';
        const status = (r.status as string) || 'draft';

        // Sub-registros vinculados a esta consulta
        const linkedPresc = prescByMR.get(mrId) || [];
        const linkedExamReq = examReqByMR.get(mrId) || [];
        const linkedDocs = docsByMR.get(mrId) || [];

        // Pular registros completamente vazios (sem SOAP, sem vitais, sem sub-registros)
        const hasVitals = Object.values(vitals).some(v => v !== undefined && v !== null);
        const hasSoap = !!(chiefComplaint || hda || physicalExam || diagnosis || conducts);
        const hasLinked = linkedPresc.length > 0 || linkedExamReq.length > 0 || linkedDocs.length > 0;
        if (!hasVitals && !hasSoap && !hasLinked) return;

        // Preview
        const previewParts: string[] = [];
        if (chiefComplaint) previewParts.push(`Queixa: ${stripHtml(chiefComplaint)}`);
        if (diagnosis) previewParts.push(`Diag: ${stripHtml(diagnosis)}`);

        // HTML: sinais vitais + SOAP
        let html = buildVitalsHtml(vitals);
        html += buildSoapHtml({ chiefComplaint, hda, physicalExam, diagnosis, conducts });

        // Receitas vinculadas
        if (linkedPresc.length > 0) {
          html += '<hr style="border:none;border-top:1px solid #e5e7eb;margin:12px 0"/>';
          html += buildPrescriptionsHtml(linkedPresc);
        }

        // Pedidos de exame vinculados
        if (linkedExamReq.length > 0) {
          html += '<hr style="border:none;border-top:1px solid #e5e7eb;margin:12px 0"/>';
          html += buildExamRequestsHtml(linkedExamReq);
        }

        // Documentos vinculados
        if (linkedDocs.length > 0) {
          html += '<hr style="border:none;border-top:1px solid #e5e7eb;margin:12px 0"/>';
          html += buildDocumentsHtml(linkedDocs);
        }

        const title = status === 'signed' ? 'Consulta (Assinada)' : 'Consulta';

        // Consolidar rawPrescription de todas as receitas vinculadas
        const allPrescItems = linkedPresc.flatMap(p => {
          const items = (p.items as Array<{ medication?: string; name?: string; posology?: string; quantity?: number; unit?: string; receipt_type?: string }>) || [];
          return items.map(i => ({
            name: i.name || (i.medication as string) || '',
            posology: i.posology || '',
            quantity: i.quantity || 1,
            unit: i.unit || '',
            receipt_type: (i.receipt_type === 'especial' ? 'especial' : 'simples') as 'simples' | 'especial',
          }));
        });
        const allPrescExams = linkedPresc.flatMap(p => {
          const items = (p.exam_items as Array<{ code?: string; name?: string; quantity?: number }>) || [];
          return items.map(e => ({ code: e.code, name: e.name || '', quantity: e.quantity || 1 }));
        });
        const allPrescVaccines = linkedPresc.flatMap(p => {
          const items = (p.vaccine_items as Array<{ name?: string; dose?: string }>) || [];
          return items.map(v => ({ name: v.name || '', dose: v.dose }));
        });

        all.push({
          id: mrId,
          type: 'consulta',
          title,
          preview: truncate(previewParts.join(' | ') || 'Consulta registrada', 120),
          htmlContent: html || null,
          date: (r.finished_at as string) || (r.started_at as string) || (r.created_at as string),
          doctorId: (r.doctor_id as number) || null,
          signed: status === 'signed',
          rawPrescription: allPrescItems.length > 0 || allPrescExams.length > 0 || allPrescVaccines.length > 0
            ? { items: allPrescItems, exam_items: allPrescExams, vaccine_items: allPrescVaccines }
            : undefined,
        });
      });

      // Anamneses
      (anamneses.data || []).forEach((r: Record<string, unknown>) => {
        all.push({
          id: r.id as number,
          type: 'anamnese',
          title: (r.title as string) || 'Anamnese',
          preview: truncate(stripHtml((r.content as string) || ''), 120),
          htmlContent: (r.content as string) || null,
          date: (r.fill_date as string) || (r.created_at as string),
          doctorId: (r.doctor_id as number) || null,
          signed: !!(r.signed),
        });
      });

      // Evoluções
      (evolutions.data || []).forEach((r: Record<string, unknown>) => {
        all.push({
          id: r.id as number,
          type: 'evolucao',
          title: 'Evolução Clínica',
          preview: truncate(stripHtml((r.content as string) || ''), 120),
          htmlContent: (r.content as string) || null,
          date: (r.evolution_date as string) || (r.created_at as string),
          doctorId: (r.doctor_id as number) || null,
          signed: !!(r.signed),
        });
      });

      // Atestados
      (certificates.data || []).forEach((r: Record<string, unknown>) => {
        all.push({
          id: r.id as number,
          type: 'atestado',
          title: (r.title as string) || 'Atestado Médico',
          preview: truncate(stripHtml((r.content as string) || ''), 120),
          htmlContent: (r.content as string) || null,
          date: (r.certificate_date as string) || (r.created_at as string),
          doctorId: (r.doctor_id as number) || null,
          signed: !!(r.digital_signature),
        });
      });

      // Laudos
      (reports.data || []).forEach((r: Record<string, unknown>) => {
        all.push({
          id: r.id as number,
          type: 'laudo',
          title: (r.title as string) || 'Laudo Médico',
          preview: truncate(stripHtml((r.content as string) || ''), 120),
          htmlContent: (r.content as string) || null,
          date: (r.report_date as string) || (r.created_at as string),
          doctorId: (r.doctor_id as number) || null,
          signed: !!(r.digital_signature),
        });
      });

      // Resultados de exame
      (examResults.data || []).forEach((r: Record<string, unknown>) => {
        all.push({
          id: r.id as number,
          type: 'exame_resultado',
          title: (r.exam_name as string) || 'Resultado de Exame',
          preview: truncate(stripHtml((r.content as string) || ''), 120),
          htmlContent: (r.content as string) || null,
          date: (r.result_date as string) || (r.created_at as string),
          doctorId: (r.doctor_id as number) || null,
          signed: false,
        });
      });

      // ── Receitas órfãs (sem medical_record_id) ────────────────
      orphanPresc.forEach((r) => {
        const items = (r.items as Array<{ medication?: string; name?: string; posology?: string; quantity?: number; unit?: string; receipt_type?: string }>) || [];
        const examItems = (r.exam_items as Array<{ code?: string; name?: string; quantity?: number }>) || [];
        const vaccineItems = (r.vaccine_items as Array<{ name?: string; dose?: string }>) || [];

        const itemNames = items.map((i) => i.medication || i.name || '').filter(Boolean).join(', ');
        const parts: string[] = [];
        if (itemNames) parts.push(itemNames);
        if (vaccineItems.length > 0) parts.push(`Vacinas: ${vaccineItems.map(v => v.name).filter(Boolean).join(', ')}`);
        if (examItems.length > 0) parts.push(`Exames: ${examItems.map(e => e.name).filter(Boolean).join(', ')}`);

        all.push({
          id: r.id as number,
          type: 'receita',
          title: 'Receita',
          preview: truncate(parts.join(' | ') || 'Sem itens', 120),
          htmlContent: buildPrescriptionsHtml([r]) || null,
          date: (r.created_at as string) || '',
          doctorId: null,
          signed: false,
          rawPrescription: {
            items: items.map(i => ({ name: i.name || (i.medication as string) || '', posology: i.posology || '', quantity: i.quantity || 1, unit: i.unit || '', receipt_type: (i.receipt_type === 'especial' ? 'especial' : 'simples') as 'simples' | 'especial' })),
            exam_items: examItems.map(e => ({ code: e.code, name: e.name || '', quantity: e.quantity || 1 })),
            vaccine_items: vaccineItems.map(v => ({ name: v.name || '', dose: v.dose })),
          },
        });
      });

      // ── Pedidos de exame órfãos ───────────────────────────────
      orphanExamReq.forEach((r) => {
        const exams = (r.exams as Array<{ name?: string; code?: string; quantity?: number }>) || [];
        const examNames = exams.map((e) => e.name || e.code || '').filter(Boolean).join(', ');
        const rType = (r.request_type as string) || '';

        all.push({
          id: r.id as number,
          type: 'exame_pedido',
          title: `Pedido de Exame${rType ? ` (${rType})` : ''}`,
          preview: truncate(examNames || 'Sem exames', 120),
          htmlContent: buildExamRequestsHtml([r]) || null,
          date: (r.request_date as string) || (r.created_at as string) || '',
          doctorId: null,
          signed: false,
        });
      });

      // ── Documentos órfãos ─────────────────────────────────────
      orphanDocs.forEach((r) => {
        all.push({
          id: r.id as number,
          type: 'documento',
          title: (r.type as string) || 'Documento',
          preview: truncate(stripHtml((r.content as string) || ''), 120),
          htmlContent: (r.content as string) || null,
          date: (r.document_date as string) || (r.created_at as string) || '',
          doctorId: null,
          signed: false,
        });
      });

      // Ordena por data decrescente
      all.sort((a, b) => {
        const da = new Date(a.date).getTime() || 0;
        const db = new Date(b.date).getTime() || 0;
        return db - da;
      });

      setEntries(all);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  return { entries, doctors, loading, fetchAll, fetchDoctors };
}
