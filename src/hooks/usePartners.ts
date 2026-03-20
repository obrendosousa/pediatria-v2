'use client';

import { useState, useCallback } from 'react';
import { createSchemaClient } from '@/lib/supabase/schemaClient';
import type { Partner, RecordStatus } from '@/types/cadastros';

const supabase = createSchemaClient('atendimento');

export type PartnerInput = {
  name: string;
  email: string;
  phone: string | null;
  whatsapp: string | null;
  notes: string | null;
  status: RecordStatus;
};

export type SortDirection = 'asc' | 'desc';

export function usePartners() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const listPartners = useCallback(async (
    search = '',
    page = 0,
    pageSize = 25,
    sort?: { key: string; direction: SortDirection },
  ) => {
    setLoading(true);
    try {
      const from = page * pageSize;
      let query = supabase
        .from('partners')
        .select('*', { count: 'exact' });

      if (search.trim()) {
        const escaped = search.trim().replace(/[%_\\]/g, '\\$&');
        query = query.or(`name.ilike.%${escaped}%,email.ilike.%${escaped}%`);
      }

      if (sort) {
        query = query.order(sort.key, { ascending: sort.direction === 'asc' });
      } else {
        query = query.order('name', { ascending: true });
      }

      const { data, count, error } = await query.range(from, from + pageSize - 1);
      if (error) throw error;

      setPartners((data as Partner[]) || []);
      setTotalCount(count || 0);
    } finally {
      setLoading(false);
    }
  }, []);

  const createPartner = useCallback(async (input: PartnerInput) => {
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('partners')
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return data as Partner;
    } finally {
      setSaving(false);
    }
  }, []);

  const updatePartner = useCallback(async (id: string, input: Partial<PartnerInput>) => {
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('partners')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Partner;
    } finally {
      setSaving(false);
    }
  }, []);

  const deletePartner = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('partners')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }, []);

  return {
    partners,
    totalCount,
    loading,
    saving,
    listPartners,
    createPartner,
    updatePartner,
    deletePartner,
  };
}
