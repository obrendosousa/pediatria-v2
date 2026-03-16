'use client';

import { useState, useCallback } from 'react';
import { createSchemaClient } from '@/lib/supabase/schemaClient';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const supabase = createSchemaClient('atendimento');
const pubSupabase = createClient();

export type MedicalCertificate = {
  id: number;
  patient_id: number;
  doctor_id: number | null;
  template_id: number | null;
  title: string | null;
  content: string | null;
  signed: boolean;
  digital_signature: boolean;
  show_date: boolean;
  certificate_date: string | null;
  created_at: string;
};

export type CertificateTemplate = {
  id: number;
  title: string;
  content: string | null;
};

type CertificateInput = {
  title?: string | null;
  content?: string | null;
  signed?: boolean;
  digital_signature?: boolean;
  show_date?: boolean;
  certificate_date?: string | null;
  template_id?: number | null;
  appointment_id?: number | null;
};

export function useCertificates(patientId: number) {
  const { profile } = useAuth();
  const [certificates, setCertificates] = useState<MedicalCertificate[]>([]);
  const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
  const [doctors, setDoctors] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);

  const fetchCertificates = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('medical_certificates')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false });
      if (data) setCertificates(data as MedicalCertificate[]);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  const fetchDoctors = useCallback(async () => {
    const { data } = await pubSupabase
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
    const { data: legacy } = await supabase
      .from('clinical_templates')
      .select('id, title, content')
      .eq('template_type', 'atestado')
      .order('title');

    const { data: cadastros } = await supabase
      .from('certificate_templates')
      .select('id, name, content')
      .order('name');

    const list: CertificateTemplate[] = (legacy as CertificateTemplate[]) || [];
    if (cadastros) {
      for (const t of cadastros) {
        list.push({ id: -(list.length + 5000), title: (t as { name: string }).name, content: t.content });
      }
    }
    setTemplates(list);
  }, []);

  const create = useCallback(async (input: CertificateInput) => {
    const { data, error } = await supabase
      .from('medical_certificates')
      .insert({
        ...input,
        patient_id: patientId,
        doctor_id: profile?.doctor_id || null,
      })
      .select()
      .single();
    if (error) throw error;
    return data as MedicalCertificate;
  }, [patientId, profile]);

  const update = useCallback(async (id: number, input: CertificateInput) => {
    const { error } = await supabase
      .from('medical_certificates')
      .update(input)
      .eq('id', id);
    if (error) throw error;
  }, []);

  const remove = useCallback(async (id: number) => {
    const { error } = await supabase
      .from('medical_certificates')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }, []);

  return {
    certificates, templates, doctors, loading,
    fetchCertificates, fetchDoctors, fetchTemplates,
    create, update, remove,
  };
}
