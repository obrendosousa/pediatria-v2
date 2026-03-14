'use client';

import { useState, useCallback } from 'react';
import { createSchemaClient } from '@/lib/supabase/schemaClient';
import type { Substance } from '@/types/cadastros';

const supabase = createSchemaClient('atendimento');

export type SubstanceInput = { name: string };

export function useSubstances() {
  const [substances, setSubstances] = useState<Substance[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const listSubstances = useCallback(async (
    search = '',
    page = 0,
    pageSize = 25,
  ) => {
    setLoading(true);
    try {
      const from = page * pageSize;
      let query = supabase
        .from('substances')
        .select('*', { count: 'exact' });

      if (search.trim()) {
        query = query.ilike('name', `%${search.trim()}%`);
      }

      query = query.order('name', { ascending: true });

      const { data, count, error } = await query.range(from, from + pageSize - 1);
      if (error) throw error;

      setSubstances((data as Substance[]) || []);
      setTotalCount(count || 0);
    } finally {
      setLoading(false);
    }
  }, []);

  const createSubstance = useCallback(async (input: SubstanceInput) => {
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('substances')
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return data as Substance;
    } finally {
      setSaving(false);
    }
  }, []);

  const updateSubstance = useCallback(async (id: string, input: SubstanceInput) => {
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('substances')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Substance;
    } finally {
      setSaving(false);
    }
  }, []);

  const deleteSubstance = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('substances')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }, []);

  return {
    substances,
    totalCount,
    loading,
    saving,
    listSubstances,
    createSubstance,
    updateSubstance,
    deleteSubstance,
  };
}
