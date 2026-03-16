'use client';

import { useState, useCallback } from 'react';
import { createSchemaClient } from '@/lib/supabase/schemaClient';
import type { ExamTemplate, ExamCategory } from '@/types/cadastros';

const supabase = createSchemaClient('atendimento');

export type ExamTemplateInput = {
  name: string;
  content: string;
};

export type SortDirection = 'asc' | 'desc';

export function useExamTemplates() {
  const [templates, setTemplates] = useState<ExamTemplate[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [categories, setCategories] = useState<ExamCategory[]>([]);
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
        .from('exam_templates')
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

      setTemplates((data as ExamTemplate[]) || []);
      setTotalCount(count || 0);
    } finally {
      setLoading(false);
    }
  }, []);

  const getTemplate = useCallback(async (id: string) => {
    const { data, error } = await supabase
      .from('exam_templates')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as ExamTemplate;
  }, []);

  const listCategories = useCallback(async () => {
    const { data, error } = await supabase
      .from('exam_categories')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) throw error;
    setCategories((data as ExamCategory[]) || []);
    return (data as ExamCategory[]) || [];
  }, []);

  const createTemplate = useCallback(async (input: ExamTemplateInput) => {
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('exam_templates')
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return data as ExamTemplate;
    } finally {
      setSaving(false);
    }
  }, []);

  const updateTemplate = useCallback(async (id: string, input: Partial<ExamTemplateInput>) => {
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('exam_templates')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as ExamTemplate;
    } finally {
      setSaving(false);
    }
  }, []);

  const deleteTemplate = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('exam_templates')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }, []);

  return {
    templates,
    totalCount,
    categories,
    loading,
    saving,
    listTemplates,
    getTemplate,
    listCategories,
    createTemplate,
    updateTemplate,
    deleteTemplate,
  };
}
