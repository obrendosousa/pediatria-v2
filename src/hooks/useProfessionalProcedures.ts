'use client';

import { useState, useCallback } from 'react';
import { createSchemaClient } from '@/lib/supabase/schemaClient';
import type { ProfessionalProcedure } from '@/types/cadastros';

const supabase = createSchemaClient('atendimento');

export type ProfessionalProcedureInput = Omit<
  ProfessionalProcedure,
  'id' | 'created_at' | 'updated_at'
>;

export function useProfessionalProcedures() {
  const [procedures, setProcedures] = useState<ProfessionalProcedure[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const listProcedures = useCallback(async (
    professionalId: string,
    statusFilter?: 'active' | 'inactive',
  ) => {
    setLoading(true);
    try {
      let query = supabase
        .from('professional_procedures')
        .select('*')
        .eq('professional_id', professionalId)
        .order('name', { ascending: true });

      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setProcedures((data as ProfessionalProcedure[]) || []);
    } finally {
      setLoading(false);
    }
  }, []);

  const createProcedure = useCallback(async (input: ProfessionalProcedureInput) => {
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('professional_procedures')
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data as ProfessionalProcedure;
    } finally {
      setSaving(false);
    }
  }, []);

  const updateProcedure = useCallback(async (
    id: string,
    input: Partial<ProfessionalProcedureInput>,
  ) => {
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('professional_procedures')
        .update(input)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as ProfessionalProcedure;
    } finally {
      setSaving(false);
    }
  }, []);

  const deleteProcedure = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('professional_procedures')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }, []);

  return {
    procedures,
    loading,
    saving,
    listProcedures,
    createProcedure,
    updateProcedure,
    deleteProcedure,
  };
}
