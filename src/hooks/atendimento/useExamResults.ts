'use client';

import { useState, useCallback } from 'react';
import { createSchemaClient } from '@/lib/supabase/schemaClient';
import { useAuth } from '@/contexts/AuthContext';

const supabase = createSchemaClient('atendimento');

export type ExamResult = {
  id: number;
  patient_id: number;
  doctor_id: number | null;
  exam_name: string;
  result_date: string | null;
  content: string | null;
  file_url: string | null;
  created_at: string;
};

type ExamResultInput = {
  exam_name: string;
  result_date?: string | null;
  content?: string | null;
  file_url?: string | null;
};

export function useExamResults(patientId: number) {
  const { profile } = useAuth();
  const [results, setResults] = useState<ExamResult[]>([]);
  const [doctors, setDoctors] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);

  const fetchResults = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('exam_results')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false });
      if (data) setResults(data as ExamResult[]);
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

  const create = useCallback(async (input: ExamResultInput) => {
    const { data, error } = await supabase
      .from('exam_results')
      .insert({
        ...input,
        patient_id: patientId,
        doctor_id: profile?.doctor_id || null,
      })
      .select()
      .single();
    if (error) throw error;
    return data as ExamResult;
  }, [patientId, profile]);

  const update = useCallback(async (id: number, input: ExamResultInput) => {
    const { error } = await supabase
      .from('exam_results')
      .update(input)
      .eq('id', id);
    if (error) throw error;
  }, []);

  const remove = useCallback(async (id: number) => {
    const { error } = await supabase
      .from('exam_results')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }, []);

  return {
    results, doctors, loading,
    fetchResults, fetchDoctors,
    create, update, remove,
  };
}
