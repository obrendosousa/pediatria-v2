'use client';

import { useState, useCallback } from 'react';
import { createSchemaClient } from '@/lib/supabase/schemaClient';
import type { Invoice, InvoiceStatus } from '@/types/invoice';

const supabase = createSchemaClient('atendimento');

export interface InvoiceFilters {
  status?: InvoiceStatus | 'all';
  dateFrom?: string;
  dateTo?: string;
  page: number;
  pageSize: number;
}

export function useInvoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const fetchInvoices = useCallback(async (filters: InvoiceFilters) => {
    setIsLoading(true);
    try {
      const from = filters.page * filters.pageSize;
      const to = from + filters.pageSize - 1;

      let query = supabase
        .from('invoices')
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

      const rows = (data || []) as Invoice[];

      // Buscar nomes de pacientes
      if (rows.length > 0) {
        const patientIds = [...new Set(rows.map(r => r.patient_id))];
        const { data: patients } = await supabase
          .from('patients')
          .select('id, full_name')
          .in('id', patientIds);

        const patientMap = new Map((patients || []).map(p => [p.id, p.full_name]));
        for (const row of rows) {
          row.patient_name = patientMap.get(row.patient_id) || '';
        }
      }

      setInvoices(rows);
      setTotalCount(count || 0);
    } catch (err) {
      console.error('[useInvoices] fetchInvoices error:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createInvoice = useCallback(async (
    invoiceData: Omit<Invoice, 'id' | 'created_at' | 'patient_name' | 'nfe_number' | 'issued_at' | 'status'>
  ) => {
    setIsSaving(true);
    try {
      const { data: newInvoice, error } = await supabase
        .from('invoices')
        .insert({ ...invoiceData, status: 'processing' as InvoiceStatus })
        .select()
        .single();

      if (error) throw error;

      // Simular emissão: após 2s, atualiza para 'issued' com nfe_number fake
      const invoiceId = (newInvoice as Invoice).id;
      setTimeout(async () => {
        const nfeNumber = `NFE-${String(invoiceId).padStart(6, '0')}`;
        await supabase
          .from('invoices')
          .update({
            status: 'issued',
            nfe_number: nfeNumber,
            issued_at: new Date().toISOString(),
          })
          .eq('id', invoiceId);
      }, 2000);

      return newInvoice as Invoice;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const cancelInvoice = useCallback(async (id: number) => {
    const { error } = await supabase
      .from('invoices')
      .update({ status: 'cancelled' as InvoiceStatus })
      .eq('id', id);
    if (error) throw error;
  }, []);

  return {
    invoices,
    totalCount,
    isLoading,
    isSaving,
    fetchInvoices,
    createInvoice,
    cancelInvoice,
  };
}
