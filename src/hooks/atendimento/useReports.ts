'use client';

import { useState, useCallback } from 'react';
import { createSchemaClient } from '@/lib/supabase/schemaClient';
import { useAuth } from '@/contexts/AuthContext';

const supabase = createSchemaClient('atendimento');

export type MedicalReport = {
  id: number;
  patient_id: number;
  doctor_id: number | null;
  template_id: number | null;
  title: string | null;
  content: string | null;
  signed: boolean;
  digital_signature: boolean;
  show_date: boolean;
  report_date: string | null;
  created_at: string;
};

export type ReportTemplate = {
  id: number;
  title: string;
  content: string | null;
};

type ReportInput = {
  title?: string | null;
  content?: string | null;
  signed?: boolean;
  digital_signature?: boolean;
  show_date?: boolean;
  report_date?: string | null;
  template_id?: number | null;
  appointment_id?: number | null;
};

export function useReports(patientId: number) {
  const { profile } = useAuth();
  const [reports, setReports] = useState<MedicalReport[]>([]);
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [doctors, setDoctors] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('medical_reports')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false });
      if (data) setReports(data as MedicalReport[]);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  const fetchDoctors = useCallback(async () => {
    const { data } = await supabase
      .from('doctors')
      .select('id, name')
      .eq('active', true)
      .order('name');
    if (data) {
      const map: Record<number, string> = {};
      data.forEach((d: { id: number; name: string }) => { map[d.id] = d.name; });
      setDoctors(map);
    }
  }, []);

  const fetchTemplates = useCallback(async () => {
    const { data } = await supabase
      .from('clinical_templates')
      .select('id, title, content')
      .eq('template_type', 'laudo')
      .order('title');
    if (data) setTemplates(data as ReportTemplate[]);
  }, []);

  const create = useCallback(async (input: ReportInput) => {
    const { data, error } = await supabase
      .from('medical_reports')
      .insert({
        ...input,
        patient_id: patientId,
        doctor_id: profile?.doctor_id || null,
      })
      .select()
      .single();
    if (error) throw error;
    return data as MedicalReport;
  }, [patientId, profile]);

  const update = useCallback(async (id: number, input: ReportInput) => {
    const { error } = await supabase
      .from('medical_reports')
      .update(input)
      .eq('id', id);
    if (error) throw error;
  }, []);

  const remove = useCallback(async (id: number) => {
    const { error } = await supabase
      .from('medical_reports')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }, []);

  return {
    reports, templates, doctors, loading,
    fetchReports, fetchDoctors, fetchTemplates,
    create, update, remove,
  };
}
