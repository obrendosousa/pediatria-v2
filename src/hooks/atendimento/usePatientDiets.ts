'use client';

import { useState, useCallback } from 'react';
import { createSchemaClient } from '@/lib/supabase/schemaClient';

const supabase = createSchemaClient('atendimento');

export interface PatientDiet {
  id: number;
  patient_id: number;
  doctor_id: number | null;
  title: string;
  content: string | null;
  notes: string | null;
  diet_date: string | null;
  created_at: string;
  doctor_name?: string;
}

export function usePatientDiets() {
  const [diets, setDiets] = useState<PatientDiet[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const fetchDiets = useCallback(async (patientId: number) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('patient_diets')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDiets((data || []) as PatientDiet[]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createDiet = useCallback(async (diet: Omit<PatientDiet, 'id' | 'created_at' | 'doctor_name'>) => {
    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('patient_diets')
        .insert(diet)
        .select()
        .single();
      if (error) throw error;
      return data as PatientDiet;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const deleteDiet = useCallback(async (id: number) => {
    const { error } = await supabase.from('patient_diets').delete().eq('id', id);
    if (error) throw error;
  }, []);

  return { diets, isLoading, isSaving, fetchDiets, createDiet, deleteDiet };
}
