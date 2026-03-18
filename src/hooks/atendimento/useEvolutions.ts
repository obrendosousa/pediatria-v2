'use client';

import { useState, useCallback } from 'react';
import { createSchemaClient } from '@/lib/supabase/schemaClient';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const supabase = createSchemaClient('atendimento');
const pubSupabase = createClient();

export type ClinicalEvolution = {
  id: number;
  patient_id: number;
  doctor_id: number | null;
  appointment_id: number | null;
  content: string | null;
  signed: boolean;
  digital_signature: boolean;
  show_date: boolean;
  evolution_date: string | null;
  blocked: boolean;
  created_at: string;
};

export type EvolutionTemplate = {
  id: number;
  title: string;
  content: string | null;
};

type EvolutionInput = {
  content?: string | null;
  signed?: boolean;
  digital_signature?: boolean;
  show_date?: boolean;
  evolution_date?: string | null;
  appointment_id?: number | null;
  blocked?: boolean;
};

export function useEvolutions(patientId: number) {
  const { profile } = useAuth();
  const [evolutions, setEvolutions] = useState<ClinicalEvolution[]>([]);
  const [templates, setTemplates] = useState<EvolutionTemplate[]>([]);
  const [doctors, setDoctors] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);

  const fetchEvolutions = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('clinical_evolutions')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false });
      if (data) setEvolutions(data as ClinicalEvolution[]);
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
    // Fetch from legacy clinical_templates
    const { data: legacy } = await supabase
      .from('clinical_templates')
      .select('id, title, content')
      .eq('template_type', 'evolucao')
      .order('title');

    // Also fetch from new cadastros evolution_templates
    const { data: cadastros } = await supabase
      .from('evolution_templates')
      .select('id, name, content')
      .order('name');

    const list: EvolutionTemplate[] = (legacy as EvolutionTemplate[]) || [];
    if (cadastros) {
      for (const t of cadastros) {
        // Use negative hash to avoid id collision with legacy bigint ids
        list.push({ id: -(list.length + 5000), title: (t as { name: string }).name, content: t.content });
      }
    }
    setTemplates(list);
  }, []);

  const create = useCallback(async (input: EvolutionInput) => {
    const { data, error } = await supabase
      .from('clinical_evolutions')
      .insert({
        ...input,
        patient_id: patientId,
        doctor_id: profile?.doctor_id || null,
      })
      .select()
      .single();
    if (error) throw error;
    return data as ClinicalEvolution;
  }, [patientId, profile]);

  const update = useCallback(async (id: number, input: EvolutionInput) => {
    const { error } = await supabase
      .from('clinical_evolutions')
      .update(input)
      .eq('id', id);
    if (error) throw error;
  }, []);

  const remove = useCallback(async (id: number) => {
    const { error } = await supabase
      .from('clinical_evolutions')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }, []);

  return {
    evolutions, templates, doctors, loading,
    fetchEvolutions, fetchDoctors, fetchTemplates,
    create, update, remove,
  };
}
