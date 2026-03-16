'use client';

import { useState, useCallback } from 'react';
import { createSchemaClient } from '@/lib/supabase/schemaClient';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const supabase = createSchemaClient('atendimento');
const pubSupabase = createClient();

export type Anamnese = {
  id: number;
  patient_id: number;
  doctor_id: number | null;
  appointment_id: number | null;
  template_id: number | null;
  title: string | null;
  content: string | null;
  signed: boolean;
  signed_at: string | null;
  show_date: boolean;
  fill_date: string | null;
  created_at: string;
};

export type AnamneseTemplate = {
  id: number;
  title: string;
  content: string | null;
};

type AnamneseInput = {
  title?: string | null;
  content?: string | null;
  signed?: boolean;
  show_date?: boolean;
  fill_date?: string | null;
  template_id?: number | null;
  appointment_id?: number | null;
};

export function useAnamneses(patientId: number) {
  const { profile } = useAuth();
  const [anamneses, setAnamneses] = useState<Anamnese[]>([]);
  const [templates, setTemplates] = useState<AnamneseTemplate[]>([]);
  const [doctors, setDoctors] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);

  const fetchAnamneses = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('anamneses')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false });
      if (data) setAnamneses(data as Anamnese[]);
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
      .eq('template_type', 'anamnese')
      .order('title');

    // Also fetch from new cadastros anamnesis_templates
    const { data: cadastros } = await supabase
      .from('anamnesis_templates')
      .select('id, title')
      .order('title');

    const list: AnamneseTemplate[] = (legacy as AnamneseTemplate[]) || [];
    if (cadastros) {
      for (const t of cadastros) {
        list.push({ id: -(list.length + 5000), title: t.title, content: null });
      }
    }
    setTemplates(list);
  }, []);

  const create = useCallback(async (input: AnamneseInput) => {
    const payload = {
      ...input,
      patient_id: patientId,
      doctor_id: profile?.doctor_id || null,
      signed_at: input.signed ? new Date().toISOString() : null,
    };
    const { data, error } = await supabase
      .from('anamneses')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data as Anamnese;
  }, [patientId, profile]);

  const update = useCallback(async (id: number, input: AnamneseInput) => {
    const payload = {
      ...input,
      signed_at: input.signed ? new Date().toISOString() : null,
    };
    const { error } = await supabase
      .from('anamneses')
      .update(payload)
      .eq('id', id);
    if (error) throw error;
  }, []);

  const remove = useCallback(async (id: number) => {
    const { error } = await supabase
      .from('anamneses')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }, []);

  return {
    anamneses, templates, doctors, loading,
    fetchAnamneses, fetchDoctors, fetchTemplates,
    create, update, remove,
  };
}
