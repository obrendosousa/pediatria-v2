'use client';

import { useState, useCallback } from 'react';
import { createSchemaClient } from '@/lib/supabase/schemaClient';
import type { PrescriptionProtocol, RecordStatus } from '@/types/cadastros';

const supabase = createSchemaClient('atendimento');

export type PrescriptionProtocolInput = {
  name: string;
  content: string | null;
  status: RecordStatus;
};

export type SortDirection = 'asc' | 'desc';

export function usePrescriptionProtocols() {
  const [protocols, setProtocols] = useState<PrescriptionProtocol[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const listProtocols = useCallback(async (
    search = '',
    page = 0,
    pageSize = 25,
    sort?: { key: string; direction: SortDirection },
  ) => {
    setLoading(true);
    try {
      const from = page * pageSize;
      let query = supabase
        .from('prescription_protocols')
        .select('*', { count: 'exact' });

      if (search.trim()) {
        query = query.ilike('name', `%${search.trim()}%`);
      }

      if (sort) {
        query = query.order(sort.key, { ascending: sort.direction === 'asc' });
      } else {
        query = query.order('name', { ascending: true });
      }

      const { data, count, error } = await query.range(from, from + pageSize - 1);
      if (error) throw error;

      setProtocols((data as PrescriptionProtocol[]) || []);
      setTotalCount(count || 0);
    } finally {
      setLoading(false);
    }
  }, []);

  const getProtocol = useCallback(async (id: string): Promise<PrescriptionProtocol | null> => {
    const { data, error } = await supabase
      .from('prescription_protocols')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as PrescriptionProtocol;
  }, []);

  const createProtocol = useCallback(async (input: PrescriptionProtocolInput) => {
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('prescription_protocols')
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return data as PrescriptionProtocol;
    } finally {
      setSaving(false);
    }
  }, []);

  const updateProtocol = useCallback(async (id: string, input: Partial<PrescriptionProtocolInput>) => {
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('prescription_protocols')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as PrescriptionProtocol;
    } finally {
      setSaving(false);
    }
  }, []);

  const deleteProtocol = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('prescription_protocols')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }, []);

  return {
    protocols,
    totalCount,
    loading,
    saving,
    listProtocols,
    getProtocol,
    createProtocol,
    updateProtocol,
    deleteProtocol,
  };
}
