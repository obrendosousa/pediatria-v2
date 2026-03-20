'use client';

import { useState, useCallback } from 'react';
import { createSchemaClient } from '@/lib/supabase/schemaClient';
import type { Collaborator } from '@/types/cadastros';

const supabase = createSchemaClient('atendimento');

export type CollaboratorInput = Omit<Collaborator, 'id' | 'created_at' | 'updated_at' | 'created_by'>;

export type SortDirection = 'asc' | 'desc';

export function useCollaborators() {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const listCollaborators = useCallback(async (
    search = '',
    page = 0,
    pageSize = 25,
    sort?: { key: string; direction: SortDirection },
  ) => {
    setLoading(true);
    try {
      const from = page * pageSize;
      let query = supabase
        .from('collaborators')
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

      setCollaborators((data as Collaborator[]) || []);
      setTotalCount(count || 0);
    } finally {
      setLoading(false);
    }
  }, []);

  const getCollaborator = useCallback(async (id: string): Promise<Collaborator | null> => {
    const { data, error } = await supabase
      .from('collaborators')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as Collaborator;
  }, []);

  const createCollaborator = useCallback(async (input: CollaboratorInput) => {
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('collaborators')
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return data as Collaborator;
    } finally {
      setSaving(false);
    }
  }, []);

  const updateCollaborator = useCallback(async (id: string, input: Partial<CollaboratorInput>) => {
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('collaborators')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Collaborator;
    } finally {
      setSaving(false);
    }
  }, []);

  const deleteCollaborator = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('collaborators')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }, []);

  return {
    collaborators,
    totalCount,
    loading,
    saving,
    listCollaborators,
    getCollaborator,
    createCollaborator,
    updateCollaborator,
    deleteCollaborator,
  };
}
