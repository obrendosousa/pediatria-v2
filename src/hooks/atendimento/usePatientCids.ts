'use client';

import { useState, useCallback } from 'react';
import { createSchemaClient } from '@/lib/supabase/schemaClient';
import { createClient } from '@/lib/supabase/client';

const supabase = createSchemaClient('atendimento');
const pubSupabase = createClient();

export interface PatientCid {
  id: number;
  patient_id: number;
  doctor_id: number | null;
  cid_code: string;
  cid_description: string;
  status: 'active' | 'resolved' | 'chronic';
  notes: string | null;
  diagnosed_at: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface Cid10Item {
  code: string;
  description: string;
}

export function usePatientCids() {
  const [cids, setCids] = useState<PatientCid[]>([]);
  const [searchResults, setSearchResults] = useState<Cid10Item[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const fetchPatientCids = useCallback(async (patientId: number) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('patient_cids')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCids((data || []) as PatientCid[]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const searchCid10 = useCallback(async (query: string) => {
    if (query.length < 2) { setSearchResults([]); return; }
    // Tenta RPC primeiro, fallback para busca direta
    const { data: rpcData } = await pubSupabase.rpc('search_cid10', { search_query: query });
    if (rpcData && Array.isArray(rpcData) && rpcData.length > 0) {
      setSearchResults(rpcData.slice(0, 20) as Cid10Item[]);
      return;
    }
    // Fallback: busca direta em cid_sub_categoria
    const { data: directData } = await pubSupabase
      .from('cid_sub_categoria')
      .select('id, descricao')
      .or(`id.ilike.%${query.replace(/[%_\\]/g, '\\$&')}%,descricao.ilike.%${query.replace(/[%_\\]/g, '\\$&')}%`)
      .limit(20);
    if (directData) {
      setSearchResults(directData.map((d: Record<string, unknown>) => ({
        code: String(d.id).length === 4 ? String(d.id).slice(0, 3) + '.' + String(d.id).slice(3) : String(d.id),
        description: String(d.descricao),
      })));
      return;
    }
    // Último fallback: tabela cid10
    const { data: cid10Data } = await pubSupabase
      .from('cid10')
      .select('code, description')
      .or(`code.ilike.%${query.replace(/[%_\\]/g, '\\$&')}%,description.ilike.%${query.replace(/[%_\\]/g, '\\$&')}%`)
      .limit(20);
    setSearchResults((cid10Data || []) as Cid10Item[]);
  }, []);

  const addCid = useCallback(async (entry: Omit<PatientCid, 'id' | 'created_at'>) => {
    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('patient_cids')
        .insert(entry)
        .select()
        .single();
      if (error) throw error;
      return data as PatientCid;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const updateCidStatus = useCallback(async (id: number, status: PatientCid['status'], resolved_at?: string) => {
    const update: Record<string, unknown> = { status };
    if (resolved_at) update.resolved_at = resolved_at;
    const { error } = await supabase.from('patient_cids').update(update).eq('id', id);
    if (error) throw error;
  }, []);

  const removeCid = useCallback(async (id: number) => {
    const { error } = await supabase.from('patient_cids').delete().eq('id', id);
    if (error) throw error;
  }, []);

  return { cids, searchResults, isLoading, isSaving, fetchPatientCids, searchCid10, addCid, updateCidStatus, removeCid };
}
