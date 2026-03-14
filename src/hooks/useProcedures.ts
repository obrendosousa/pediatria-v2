'use client';

import { useState, useCallback } from 'react';
import { createSchemaClient } from '@/lib/supabase/schemaClient';
import type { Procedure, ProcedureComposition } from '@/types/cadastros';

const supabase = createSchemaClient('atendimento');

export type ProcedureInput = Omit<Procedure, 'id' | 'created_at' | 'updated_at' | 'created_by'>;
export type SortDirection = 'asc' | 'desc';

export interface ProcedureFilters {
  search?: string;
  types?: string[];
  status?: string;
  page?: number;
  pageSize?: number;
  sort?: { key: string; direction: SortDirection };
}

export function useProcedures() {
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const listProcedures = useCallback(async (filters: ProcedureFilters = {}) => {
    const { search = '', types, status, page = 0, pageSize = 25, sort } = filters;
    setLoading(true);
    try {
      const from = page * pageSize;
      let query = supabase
        .from('procedures')
        .select('*', { count: 'exact' });

      if (search.trim()) {
        query = query.ilike('name', `%${search.trim()}%`);
      }

      if (types && types.length > 0) {
        query = query.in('procedure_type', types);
      }

      if (status) {
        query = query.eq('status', status);
      }

      if (sort) {
        query = query.order(sort.key, { ascending: sort.direction === 'asc' });
      } else {
        query = query.order('name', { ascending: true });
      }

      const { data, count, error } = await query.range(from, from + pageSize - 1);
      if (error) throw error;

      setProcedures((data as Procedure[]) || []);
      setTotalCount(count || 0);
    } finally {
      setLoading(false);
    }
  }, []);

  const getProcedure = useCallback(async (id: string): Promise<Procedure | null> => {
    const { data, error } = await supabase
      .from('procedures')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as Procedure;
  }, []);

  const createProcedure = useCallback(async (input: ProcedureInput) => {
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('procedures')
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return data as Procedure;
    } finally {
      setSaving(false);
    }
  }, []);

  const updateProcedure = useCallback(async (id: string, input: Partial<ProcedureInput>) => {
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('procedures')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Procedure;
    } finally {
      setSaving(false);
    }
  }, []);

  const deleteProcedure = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('procedures')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }, []);

  const adjustPrices = useCallback(async (percentage: number) => {
    setSaving(true);
    try {
      const { data: all, error: fetchError } = await supabase
        .from('procedures')
        .select('id, fee_value, total_value')
        .eq('status', 'active');

      if (fetchError) throw fetchError;
      if (!all || all.length === 0) return 0;

      const multiplier = 1 + percentage / 100;

      const updates = all.map((p) =>
        supabase
          .from('procedures')
          .update({
            fee_value: Math.round(p.fee_value * multiplier * 100) / 100,
            total_value: Math.round(p.total_value * multiplier * 100) / 100,
          })
          .eq('id', p.id)
      );

      await Promise.all(updates);
      return all.length;
    } finally {
      setSaving(false);
    }
  }, []);

  // --- Composição ---

  const getCompositions = useCallback(async (procedureId: string): Promise<ProcedureComposition[]> => {
    const { data, error } = await supabase
      .from('procedure_compositions')
      .select('*')
      .eq('procedure_id', procedureId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data as ProcedureComposition[]) || [];
  }, []);

  const setCompositions = useCallback(async (procedureId: string, items: { sub_procedure_id: string; quantity: number }[]) => {
    const { error: delError } = await supabase
      .from('procedure_compositions')
      .delete()
      .eq('procedure_id', procedureId);

    if (delError) throw delError;

    if (items.length > 0) {
      const rows = items.map(item => ({
        procedure_id: procedureId,
        sub_procedure_id: item.sub_procedure_id,
        quantity: item.quantity,
      }));

      const { error: insError } = await supabase
        .from('procedure_compositions')
        .insert(rows);

      if (insError) throw insError;
    }
  }, []);

  return {
    procedures,
    totalCount,
    loading,
    saving,
    listProcedures,
    getProcedure,
    createProcedure,
    updateProcedure,
    deleteProcedure,
    adjustPrices,
    getCompositions,
    setCompositions,
  };
}
