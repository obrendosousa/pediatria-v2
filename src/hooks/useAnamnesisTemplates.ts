'use client';

import { useState, useCallback } from 'react';
import { createSchemaClient } from '@/lib/supabase/schemaClient';
import type { AnamnesisTemplate, AnamnesisQuestion, AnamnesisQuestionType } from '@/types/cadastros';

const supabase = createSchemaClient('atendimento');

export type AnamnesisTemplateInput = {
  title: string;
  allow_send_on_scheduling: boolean;
};

export type AnamnesisQuestionInput = {
  question: string;
  type: AnamnesisQuestionType;
  options: unknown[];
  sort_order: number;
};

export type SortDirection = 'asc' | 'desc';

export function useAnamnesisTemplates() {
  const [templates, setTemplates] = useState<AnamnesisTemplate[]>([]);
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
        .from('anamnesis_templates')
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

      setTemplates((data as AnamnesisTemplate[]) || []);
      setTotalCount(count || 0);
    } finally {
      setLoading(false);
    }
  }, []);

  const getTemplate = useCallback(async (id: string) => {
    const { data, error } = await supabase
      .from('anamnesis_templates')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as AnamnesisTemplate;
  }, []);

  const getQuestions = useCallback(async (templateId: string) => {
    const { data, error } = await supabase
      .from('anamnesis_questions')
      .select('*')
      .eq('template_id', templateId)
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return (data as AnamnesisQuestion[]) || [];
  }, []);

  const createTemplate = useCallback(async (
    input: AnamnesisTemplateInput,
    questions: AnamnesisQuestionInput[],
  ) => {
    setSaving(true);
    try {
      const { data: tpl, error: tplError } = await supabase
        .from('anamnesis_templates')
        .insert(input)
        .select()
        .single();

      if (tplError) throw tplError;

      const template = tpl as AnamnesisTemplate;

      if (questions.length > 0) {
        const rows = questions.map((q, idx) => ({
          template_id: template.id,
          question: q.question,
          type: q.type,
          options: q.options,
          sort_order: idx,
        }));

        const { error: qError } = await supabase
          .from('anamnesis_questions')
          .insert(rows);

        if (qError) throw qError;
      }

      return template;
    } finally {
      setSaving(false);
    }
  }, []);

  const updateTemplate = useCallback(async (
    id: string,
    input: Partial<AnamnesisTemplateInput>,
    questions?: AnamnesisQuestionInput[],
  ) => {
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('anamnesis_templates')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      if (questions !== undefined) {
        // Delete existing questions and re-insert
        const { error: delError } = await supabase
          .from('anamnesis_questions')
          .delete()
          .eq('template_id', id);

        if (delError) throw delError;

        if (questions.length > 0) {
          const rows = questions.map((q, idx) => ({
            template_id: id,
            question: q.question,
            type: q.type,
            options: q.options,
            sort_order: idx,
          }));

          const { error: qError } = await supabase
            .from('anamnesis_questions')
            .insert(rows);

          if (qError) throw qError;
        }
      }

      return data as AnamnesisTemplate;
    } finally {
      setSaving(false);
    }
  }, []);

  const deleteTemplate = useCallback(async (id: string) => {
    // Questions are deleted via ON DELETE CASCADE
    const { error } = await supabase
      .from('anamnesis_templates')
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
    getQuestions,
    createTemplate,
    updateTemplate,
    deleteTemplate,
  };
}
