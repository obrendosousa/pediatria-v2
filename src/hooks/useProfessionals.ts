'use client';

import { useState, useCallback } from 'react';
import { createSchemaClient } from '@/lib/supabase/schemaClient';
import type { Professional } from '@/types/cadastros';

const supabase = createSchemaClient('atendimento');

export type ProfessionalInput = Omit<Professional, 'id' | 'created_at' | 'updated_at' | 'created_by'>;

export type SortDirection = 'asc' | 'desc';

export function useProfessionals() {
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const listProfessionals = useCallback(async (
    search = '',
    page = 0,
    pageSize = 25,
    sort?: { key: string; direction: SortDirection },
  ) => {
    setLoading(true);
    try {
      const from = page * pageSize;
      let query = supabase
        .from('professionals')
        .select('*', { count: 'exact' });

      if (search.trim()) {
        const escaped = search.trim().replace(/[%_\\]/g, '\\$&');
        query = query.or(`name.ilike.%${escaped}%,cpf.ilike.%${escaped}%,email.ilike.%${escaped}%`);
      }

      if (sort) {
        query = query.order(sort.key, { ascending: sort.direction === 'asc' });
      } else {
        query = query.order('name', { ascending: true });
      }

      const { data, count, error } = await query.range(from, from + pageSize - 1);
      if (error) throw error;

      setProfessionals((data as Professional[]) || []);
      setTotalCount(count || 0);
    } finally {
      setLoading(false);
    }
  }, []);

  const getProfessional = useCallback(async (id: string): Promise<Professional | null> => {
    const { data, error } = await supabase
      .from('professionals')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as Professional;
  }, []);

  const createProfessional = useCallback(async (input: ProfessionalInput) => {
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('professionals')
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return data as Professional;
    } finally {
      setSaving(false);
    }
  }, []);

  const updateProfessional = useCallback(async (id: string, input: Partial<ProfessionalInput>) => {
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('professionals')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Professional;
    } finally {
      setSaving(false);
    }
  }, []);

  const deleteProfessional = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('professionals')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }, []);

  return {
    professionals,
    totalCount,
    loading,
    saving,
    listProfessionals,
    getProfessional,
    createProfessional,
    updateProfessional,
    deleteProfessional,
  };
}
