'use client';

import { useState, useCallback } from 'react';
import { createSchemaClient } from '@/lib/supabase/schemaClient';
import type { DietTemplate } from '@/types/cadastros';

const supabase = createSchemaClient('atendimento');

export type DietTemplateInput = {
  name: string;
  content: string;
};

export type SortDirection = 'asc' | 'desc';

export function useDietTemplates() {
  const [templates, setTemplates] = useState<DietTemplate[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const listTemplates = useCallback(async (
    search = '',
    page = 0,
    pageSize = 10,
    sort?: { key: string; direction: SortDirection },
    onlyMine?: string,
  ) => {
    setLoading(true);
    try {
      const from = page * pageSize;
      let query = supabase
        .from('diet_templates')
        .select('*', { count: 'exact' });

      if (search.trim()) {
        query = query.ilike('name', `%${search.trim()}%`);
      }

      if (onlyMine) {
        query = query.eq('created_by', onlyMine);
      }

      if (sort) {
        query = query.order(sort.key, { ascending: sort.direction === 'asc' });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      const { data, count, error } = await query.range(from, from + pageSize - 1);
      if (error) throw error;

      setTemplates((data as DietTemplate[]) || []);
      setTotalCount(count || 0);
    } finally {
      setLoading(false);
    }
  }, []);

  const getTemplate = useCallback(async (id: string) => {
    const { data, error } = await supabase
      .from('diet_templates')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as DietTemplate;
  }, []);

  const createTemplate = useCallback(async (input: DietTemplateInput) => {
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('diet_templates')
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return data as DietTemplate;
    } finally {
      setSaving(false);
    }
  }, []);

  const updateTemplate = useCallback(async (id: string, input: Partial<DietTemplateInput>) => {
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('diet_templates')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as DietTemplate;
    } finally {
      setSaving(false);
    }
  }, []);

  const deleteTemplate = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('diet_templates')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }, []);

  return {
    templates,
    totalCount,
    loading,
    saving,
    listTemplates,
    getTemplate,
    createTemplate,
    updateTemplate,
    deleteTemplate,
  };
}
