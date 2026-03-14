'use client';

import { useState, useCallback } from 'react';
import { createSchemaClient } from '@/lib/supabase/schemaClient';
import type { Formula, FormulaComposition } from '@/types/cadastros';

const supabase = createSchemaClient('atendimento');

export type FormulaInput = Omit<Formula, 'id' | 'created_at' | 'updated_at' | 'created_by'>;
export type SortDirection = 'asc' | 'desc';

export interface CompositionInput {
  substance_id: string;
  quantity: number | null;
  unit: string | null;
  sort_order: number;
}

export function useFormulas() {
  const [formulas, setFormulas] = useState<Formula[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const listFormulas = useCallback(async (
    search = '',
    page = 0,
    pageSize = 25,
    sort?: { key: string; direction: SortDirection },
  ) => {
    setLoading(true);
    try {
      const from = page * pageSize;
      let query = supabase
        .from('formulas')
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

      setFormulas((data as Formula[]) || []);
      setTotalCount(count || 0);
    } finally {
      setLoading(false);
    }
  }, []);

  const getFormula = useCallback(async (id: string): Promise<Formula | null> => {
    const { data, error } = await supabase
      .from('formulas')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as Formula;
  }, []);

  const createFormula = useCallback(async (input: FormulaInput) => {
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('formulas')
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return data as Formula;
    } finally {
      setSaving(false);
    }
  }, []);

  const updateFormula = useCallback(async (id: string, input: Partial<FormulaInput>) => {
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('formulas')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Formula;
    } finally {
      setSaving(false);
    }
  }, []);

  const deleteFormula = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('formulas')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }, []);

  const duplicateFormula = useCallback(async (id: string) => {
    setSaving(true);
    try {
      const original = await getFormula(id);
      if (!original) throw new Error('Fórmula não encontrada.');

      const { data: newFormula, error: createError } = await supabase
        .from('formulas')
        .insert({
          name: `${original.name} (cópia)`,
          route_of_use: original.route_of_use,
          form: original.form,
          quantity: original.quantity,
          unit: original.unit,
          posology: original.posology,
          reference: original.reference,
          notes: original.notes,
          status: original.status,
        })
        .select()
        .single();

      if (createError) throw createError;

      // Copiar composição
      const { data: comps, error: compError } = await supabase
        .from('formula_compositions')
        .select('*')
        .eq('formula_id', id)
        .order('sort_order', { ascending: true });

      if (compError) throw compError;

      if (comps && comps.length > 0) {
        const rows = comps.map((c: FormulaComposition) => ({
          formula_id: newFormula.id,
          substance_id: c.substance_id,
          quantity: c.quantity,
          unit: c.unit,
          sort_order: c.sort_order,
        }));

        const { error: insError } = await supabase
          .from('formula_compositions')
          .insert(rows);

        if (insError) throw insError;
      }

      return newFormula as Formula;
    } finally {
      setSaving(false);
    }
  }, [getFormula]);

  // --- Composição ---

  const getCompositions = useCallback(async (formulaId: string): Promise<FormulaComposition[]> => {
    const { data, error } = await supabase
      .from('formula_compositions')
      .select('*')
      .eq('formula_id', formulaId)
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return (data as FormulaComposition[]) || [];
  }, []);

  const setCompositions = useCallback(async (formulaId: string, items: CompositionInput[]) => {
    const { error: delError } = await supabase
      .from('formula_compositions')
      .delete()
      .eq('formula_id', formulaId);

    if (delError) throw delError;

    if (items.length > 0) {
      const rows = items.map((item, idx) => ({
        formula_id: formulaId,
        substance_id: item.substance_id,
        quantity: item.quantity,
        unit: item.unit,
        sort_order: idx,
      }));

      const { error: insError } = await supabase
        .from('formula_compositions')
        .insert(rows);

      if (insError) throw insError;
    }
  }, []);

  return {
    formulas,
    totalCount,
    loading,
    saving,
    listFormulas,
    getFormula,
    createFormula,
    updateFormula,
    deleteFormula,
    duplicateFormula,
    getCompositions,
    setCompositions,
  };
}
