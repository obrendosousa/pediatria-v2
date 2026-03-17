'use client';

import { useState, useCallback } from 'react';
import { createSchemaClient } from '@/lib/supabase/schemaClient';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const supabase = createSchemaClient('atendimento');
const pubSupabase = createClient();

// ── Tipos de pergunta dinâmica ──
export type QuestionType = 'text' | 'multiple_choice' | 'checkbox' | 'gestational_calculator';

export interface AnamneseQuestion {
  id: string;
  text: string;
  type: QuestionType;
  options?: string[];
  answer?: string | string[] | null;
}

export type Anamnese = {
  id: number;
  patient_id: number;
  doctor_id: number | null;
  appointment_id: number | null;
  template_id: number | null;
  title: string | null;
  content: string | null;
  questions: AnamneseQuestion[] | null;
  cid_codes: string[] | null;
  blocked: boolean;
  allowed_professionals: number[] | null;
  save_as_template: boolean;
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
  questions?: AnamneseQuestion[] | null;
  _cadastroId?: string; // UUID from anamnesis_templates table
};

type AnamneseInput = {
  title?: string | null;
  content?: string | null;
  questions?: AnamneseQuestion[] | null;
  cid_codes?: string[] | null;
  blocked?: boolean;
  allowed_professionals?: number[] | null;
  save_as_template?: boolean;
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
  const [professionals, setProfessionals] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(false);

  const currentProfessionalId = profile?.doctor_id ?? null;

  const fetchAnamneses = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('anamneses')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false });
      if (data) {
        // Filtra anamneses bloqueadas: só mostra se o profissional logado está na lista
        const filtered = (data as Anamnese[]).filter(a => {
          if (!a.blocked) return true;
          if (!currentProfessionalId) return false;
          if (!a.allowed_professionals || a.allowed_professionals.length === 0) return false;
          return a.allowed_professionals.includes(currentProfessionalId);
        });
        setAnamneses(filtered);
      }
    } finally {
      setLoading(false);
    }
  }, [patientId, currentProfessionalId]);

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

  const fetchProfessionals = useCallback(async () => {
    const { data } = await supabase
      .from('professionals')
      .select('id, name')
      .eq('status', 'active')
      .order('name');
    if (data) setProfessionals(data);
  }, []);

  const fetchTemplates = useCallback(async () => {
    // Legacy templates (rich text content)
    const { data: legacy } = await supabase
      .from('clinical_templates')
      .select('id, title, content')
      .eq('template_type', 'anamnese')
      .order('title');

    // New cadastros templates (with questions)
    const { data: cadastros } = await supabase
      .from('anamnesis_templates')
      .select('id, title')
      .order('title');

    const list: AnamneseTemplate[] = (legacy as AnamneseTemplate[]) || [];
    if (cadastros) {
      for (const t of cadastros) {
        // Use negative ID offset + uuid prefix to distinguish from legacy
        list.push({ id: -(list.length + 5000), title: t.title, content: null, _cadastroId: t.id });
      }
    }
    setTemplates(list);
  }, []);

  // Fetch questions from an anamnesis_template (cadastros)
  const getTemplateQuestions = useCallback(async (cadastroTemplateId: string): Promise<AnamneseQuestion[]> => {
    const { data } = await supabase
      .from('anamnesis_questions')
      .select('*')
      .eq('template_id', cadastroTemplateId)
      .order('sort_order', { ascending: true });

    if (!data) return [];
    return data.map((q: Record<string, unknown>) => ({
      id: String(q.id),
      text: q.question as string,
      type: q.type as QuestionType,
      options: Array.isArray(q.options) ? (q.options as string[]) : undefined,
    }));
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
    // Preserva signed_at original se já estava assinado
    const existing = anamneses.find(a => a.id === id);
    const alreadySigned = existing?.signed && existing?.signed_at;

    const payload = {
      ...input,
      signed_at: input.signed
        ? (alreadySigned ? existing.signed_at : new Date().toISOString())
        : null,
    };
    const { error } = await supabase
      .from('anamneses')
      .update(payload)
      .eq('id', id);
    if (error) throw error;
  }, [anamneses]);

  const remove = useCallback(async (id: number) => {
    const { error } = await supabase
      .from('anamneses')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }, []);

  return {
    anamneses, templates, doctors, professionals, loading,
    fetchAnamneses, fetchDoctors, fetchProfessionals, fetchTemplates, getTemplateQuestions,
    create, update, remove,
  };
}
