'use client';

import { useState, useCallback } from 'react';
import { createSchemaClient } from '@/lib/supabase/schemaClient';
import { createClient } from '@/lib/supabase/client';

const ateSupabase = createSchemaClient('atendimento');
const pubSupabase = createClient();

// ── Tipos ────────────────────────────────────────────────────

export type TimelineEntryType =
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
}

export interface TimelineFilters {
  doctorId: number | null;
  types: TimelineEntryType[];
  dateFrom: string;
  dateTo: string;
}

// ── Helpers ──────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + '…';
}

// ── Hook ─────────────────────────────────────────────────────

export function useClinicalTimeline(patientId: number) {
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [doctors, setDoctors] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchDoctors = useCallback(async () => {
    const { data } = await ateSupabase
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
        anamneses,
        evolutions,
        certificates,
        reports,
        examResults,
        prescriptions,
        examRequests,
        documents,
      ] = await Promise.all([
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
          .select('id, items, created_at')
          .eq('patient_id', patientId),
        pubSupabase
          .from('exam_requests')
          .select('id, exams, request_date, request_type, created_at')
          .eq('patient_id', patientId),
        pubSupabase
          .from('medical_documents')
          .select('id, type, content, document_date, created_at')
          .eq('patient_id', patientId),
      ]);

      const all: TimelineEntry[] = [];

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
          htmlContent: null,
          date: (r.result_date as string) || (r.created_at as string),
          doctorId: (r.doctor_id as number) || null,
          signed: false,
        });
      });

      // Receitas
      (prescriptions.data || []).forEach((r: Record<string, unknown>) => {
        const items = (r.items as Array<{ medication?: string; name?: string }>) || [];
        const itemNames = items
          .map((i) => i.medication || i.name || '')
          .filter(Boolean)
          .join(', ');
        all.push({
          id: r.id as number,
          type: 'receita',
          title: 'Receita',
          preview: truncate(itemNames || 'Sem itens', 120),
          htmlContent: null,
          date: (r.created_at as string) || '',
          doctorId: null,
          signed: false,
        });
      });

      // Pedidos de exame
      (examRequests.data || []).forEach((r: Record<string, unknown>) => {
        const exams = (r.exams as Array<{ name?: string; code?: string }>) || [];
        const examNames = exams
          .map((e) => e.name || e.code || '')
          .filter(Boolean)
          .join(', ');
        const rType = (r.request_type as string) || '';
        all.push({
          id: r.id as number,
          type: 'exame_pedido',
          title: `Pedido de Exame${rType ? ` (${rType})` : ''}`,
          preview: truncate(examNames || 'Sem exames', 120),
          htmlContent: null,
          date: (r.request_date as string) || (r.created_at as string) || '',
          doctorId: null,
          signed: false,
        });
      });

      // Documentos
      (documents.data || []).forEach((r: Record<string, unknown>) => {
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
