'use client';

import { useState, useCallback } from 'react';
import { createSchemaClient } from '@/lib/supabase/schemaClient';
import type { Medication } from '@/types/cadastros';

const supabase = createSchemaClient('atendimento');

export type MedicationInput = Omit<Medication, 'id' | 'created_at' | 'updated_at' | 'created_by'>;

export function useMedications() {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const listMedications = useCallback(async (
    search = '',
    page = 0,
    pageSize = 25,
  ) => {
    setLoading(true);
    try {
      const from = page * pageSize;
      let query = supabase
        .from('medications')
        .select('*', { count: 'exact' });

      if (search.trim()) {
        const escaped = search.trim().replace(/[%_\\]/g, '\\$&');
        query = query.or(`description.ilike.%${escaped}%,presentation.ilike.%${escaped}%,active_ingredient.ilike.%${escaped}%`);
      }

      query = query.order('description', { ascending: true });

      const { data, count, error } = await query.range(from, from + pageSize - 1);
      if (error) throw error;

      setMedications((data as Medication[]) || []);
      setTotalCount(count || 0);
    } finally {
      setLoading(false);
    }
  }, []);

  const createMedication = useCallback(async (input: MedicationInput) => {
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('medications')
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return data as Medication;
    } finally {
      setSaving(false);
    }
  }, []);

  const updateMedication = useCallback(async (id: string, input: Partial<MedicationInput>) => {
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('medications')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Medication;
    } finally {
      setSaving(false);
    }
  }, []);

  const deleteMedication = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('medications')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }, []);

  return {
    medications,
    totalCount,
    loading,
    saving,
    listMedications,
    createMedication,
    updateMedication,
    deleteMedication,
  };
}
