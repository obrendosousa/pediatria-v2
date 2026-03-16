'use client';

import { useState, useCallback } from 'react';
import { createSchemaClient } from '@/lib/supabase/schemaClient';
import type { DocumentTemplate } from '@/types/cadastros';

const supabase = createSchemaClient('atendimento');

export type DocumentTemplateInput = {
  title: string;
  content: string;
  is_default: boolean;
};

export type SortDirection = 'asc' | 'desc';

export function useDocumentTemplates() {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
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
        .from('document_templates')
        .select('*', { count: 'exact' });

      if (search.trim()) {
        query = query.ilike('title', `%${search.trim()}%`);
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

      setTemplates((data as DocumentTemplate[]) || []);
      setTotalCount(count || 0);
    } finally {
      setLoading(false);
    }
  }, []);

  const getTemplate = useCallback(async (id: string) => {
    const { data, error } = await supabase
      .from('document_templates')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as DocumentTemplate;
  }, []);

  const createTemplate = useCallback(async (input: DocumentTemplateInput) => {
    setSaving(true);
    try {
      // If setting as default, clear previous default
      if (input.is_default) {
        const { error: clearErr } = await supabase
          .from('document_templates')
          .update({ is_default: false })
          .eq('is_default', true);
        if (clearErr) throw clearErr;
      }

      const { data, error } = await supabase
        .from('document_templates')
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return data as DocumentTemplate;
    } finally {
      setSaving(false);
    }
  }, []);

  const updateTemplate = useCallback(async (id: string, input: Partial<DocumentTemplateInput>) => {
    setSaving(true);
    try {
      // If setting as default, clear previous default (except self)
      if (input.is_default) {
        const { error: clearErr } = await supabase
          .from('document_templates')
          .update({ is_default: false })
          .eq('is_default', true)
          .neq('id', id);
        if (clearErr) throw clearErr;
      }

      const { data, error } = await supabase
        .from('document_templates')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as DocumentTemplate;
    } finally {
      setSaving(false);
    }
  }, []);

  const deleteTemplate = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('document_templates')
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
