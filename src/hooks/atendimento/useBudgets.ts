'use client';

import { useState, useCallback } from 'react';
import { createSchemaClient } from '@/lib/supabase/schemaClient';
import type { Budget, BudgetItem, BudgetStatus } from '@/types/budget';

const supabase = createSchemaClient('atendimento');

export interface BudgetFilters {
  search?: string;
  status?: BudgetStatus | 'all';
  dateFrom?: string;
  dateTo?: string;
  page: number;
  pageSize: number;
}

export function useBudgets() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const fetchBudgets = useCallback(async (filters: BudgetFilters) => {
    setIsLoading(true);
    try {
      const from = filters.page * filters.pageSize;
      const to = from + filters.pageSize - 1;

      let query = supabase
        .from('budgets')
        .select('*', { count: 'exact' });

      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }
      if (filters.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
      }
      if (filters.dateTo) {
        query = query.lte('created_at', filters.dateTo + 'T23:59:59');
      }

      const { data, count, error } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      // Buscar nomes de pacientes e profissionais
      const rows = (data || []) as Budget[];
      if (rows.length > 0) {
        const patientIds = [...new Set(rows.map(r => r.patient_id))];
        const doctorIds = [...new Set(rows.filter(r => r.doctor_id).map(r => r.doctor_id!))];

        const { data: patients } = await supabase
          .from('patients')
          .select('id, full_name')
          .in('id', patientIds);

        const patientMap = new Map((patients || []).map(p => [p.id, p.full_name]));

        let doctorMap = new Map<number, string>();
        if (doctorIds.length > 0) {
          // doctors está no schema public — usar fetch separado
          const { data: docs } = await supabase
            .from('doctors')
            .select('id, name')
            .in('id', doctorIds);
          doctorMap = new Map((docs || []).map((d: { id: number; name: string }) => [d.id, d.name]));
        }

        for (const row of rows) {
          row.patient_name = patientMap.get(row.patient_id) || '';
          if (row.doctor_id) row.doctor_name = doctorMap.get(row.doctor_id) || '';
        }

        // Filtro por busca de nome de paciente (client-side, após join)
        if (filters.search?.trim()) {
          const term = filters.search.trim().toLowerCase();
          const filtered = rows.filter(r =>
            r.patient_name?.toLowerCase().includes(term) ||
            String(r.id).includes(term)
          );
          setBudgets(filtered);
          setTotalCount(filtered.length);
          return;
        }
      }

      setBudgets(rows);
      setTotalCount(count || 0);
    } catch (err) {
      console.error('[useBudgets] fetchBudgets error:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createBudget = useCallback(async (
    budget: {
      patient_id: number;
      doctor_id: number;
      subtotal: number;
      discount_type: '%' | 'R$';
      discount_value: number;
      discount_amount: number;
      total: number;
      installments: number;
      notes?: string;
      status: BudgetStatus;
    },
    items: Omit<BudgetItem, 'id' | 'budget_id'>[]
  ) => {
    setIsSaving(true);
    try {
      const { data: newBudget, error: budgetError } = await supabase
        .from('budgets')
        .insert(budget)
        .select()
        .single();

      if (budgetError) throw budgetError;

      const budgetItems = items.map(item => ({
        ...item,
        budget_id: newBudget.id,
      }));

      const { error: itemsError } = await supabase
        .from('budget_items')
        .insert(budgetItems);

      if (itemsError) throw itemsError;

      return newBudget as Budget;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const updateBudgetStatus = useCallback(async (id: number, status: BudgetStatus) => {
    const { error } = await supabase
      .from('budgets')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  }, []);

  return {
    budgets,
    totalCount,
    isLoading,
    isSaving,
    fetchBudgets,
    createBudget,
    updateBudgetStatus,
  };
}
