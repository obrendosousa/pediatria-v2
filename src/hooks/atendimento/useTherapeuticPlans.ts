'use client';

import { useState, useCallback } from 'react';
import { createSchemaClient } from '@/lib/supabase/schemaClient';

const supabase = createSchemaClient('atendimento');

export interface TherapeuticPlan {
  id: number;
  patient_id: number;
  doctor_id: number | null;
  title: string;
  description: string | null;
  status: 'active' | 'completed' | 'cancelled';
  created_at: string;
  doctor_name?: string;
}

export function useTherapeuticPlans() {
  const [plans, setPlans] = useState<TherapeuticPlan[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const fetchPlans = useCallback(async (patientId: number) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('therapeutic_plans')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPlans((data || []) as TherapeuticPlan[]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createPlan = useCallback(async (plan: Omit<TherapeuticPlan, 'id' | 'created_at' | 'doctor_name'>) => {
    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('therapeutic_plans')
        .insert(plan)
        .select()
        .single();
      if (error) throw error;
      return data as TherapeuticPlan;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const updatePlanStatus = useCallback(async (id: number, status: TherapeuticPlan['status']) => {
    const { error } = await supabase
      .from('therapeutic_plans')
      .update({ status })
      .eq('id', id);
    if (error) throw error;
  }, []);

  return { plans, isLoading, isSaving, fetchPlans, createPlan, updatePlanStatus };
}
