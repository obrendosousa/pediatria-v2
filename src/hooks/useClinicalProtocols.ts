'use client';

import { useState, useCallback } from 'react';
import { createSchemaClient } from '@/lib/supabase/schemaClient';
import type { ClinicalProtocol, ClinicalProtocolItem, RecordStatus } from '@/types/cadastros';

const supabase = createSchemaClient('atendimento');

export type ClinicalProtocolInput = {
  name: string;
  description: string | null;
  total_value: number;
  status: RecordStatus;
};

export interface ProtocolItemInput {
  procedure_id: string;
  sort_order: number;
}

export interface ProtocolItemWithDetails {
  procedure_id: string;
  procedure_name: string;
  procedure_type: string;
  total_value: number;
  sort_order: number;
}

export type SortDirection = 'asc' | 'desc';

export function useClinicalProtocols() {
  const [protocols, setProtocols] = useState<ClinicalProtocol[]>([]);
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
        .from('clinical_protocols')
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

      setProtocols((data as ClinicalProtocol[]) || []);
      setTotalCount(count || 0);
    } finally {
      setLoading(false);
    }
  }, []);

  const getProtocol = useCallback(async (id: string): Promise<ClinicalProtocol | null> => {
    const { data, error } = await supabase
      .from('clinical_protocols')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as ClinicalProtocol;
  }, []);

  const getProtocolItems = useCallback(async (protocolId: string): Promise<ProtocolItemWithDetails[]> => {
    const { data: items, error: itemsError } = await supabase
      .from('clinical_protocol_items')
      .select('*')
      .eq('protocol_id', protocolId)
      .order('sort_order', { ascending: true });

    if (itemsError) throw itemsError;
    if (!items || items.length === 0) return [];

    const procedureIds = (items as ClinicalProtocolItem[]).map(i => i.procedure_id);

    const { data: procs, error: procsError } = await supabase
      .from('procedures')
      .select('id, name, procedure_type, total_value')
      .in('id', procedureIds);

    if (procsError) throw procsError;

    const procsMap = new Map(
      (procs || []).map((p: { id: string; name: string; procedure_type: string; total_value: number }) => [p.id, p])
    );

    return (items as ClinicalProtocolItem[]).map(item => {
      const proc = procsMap.get(item.procedure_id);
      return {
        procedure_id: item.procedure_id,
        procedure_name: proc?.name ?? 'Procedimento removido',
        procedure_type: proc?.procedure_type ?? '',
        total_value: proc?.total_value ?? 0,
        sort_order: item.sort_order,
      };
    });
  }, []);

  const createProtocol = useCallback(async (input: ClinicalProtocolInput) => {
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('clinical_protocols')
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return data as ClinicalProtocol;
    } finally {
      setSaving(false);
    }
  }, []);

  const updateProtocol = useCallback(async (id: string, input: Partial<ClinicalProtocolInput>) => {
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('clinical_protocols')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as ClinicalProtocol;
    } finally {
      setSaving(false);
    }
  }, []);

  const deleteProtocol = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('clinical_protocols')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }, []);

  const setProtocolItems = useCallback(async (protocolId: string, items: ProtocolItemInput[]) => {
    const { error: delError } = await supabase
      .from('clinical_protocol_items')
      .delete()
      .eq('protocol_id', protocolId);

    if (delError) throw delError;

    if (items.length > 0) {
      const rows = items.map((item, idx) => ({
        protocol_id: protocolId,
        procedure_id: item.procedure_id,
        sort_order: idx,
      }));

      const { error: insError } = await supabase
        .from('clinical_protocol_items')
        .insert(rows);

      if (insError) throw insError;
    }
  }, []);

  return {
    protocols,
    totalCount,
    loading,
    saving,
    listProtocols,
    getProtocol,
    getProtocolItems,
    createProtocol,
    updateProtocol,
    deleteProtocol,
    setProtocolItems,
  };
}
