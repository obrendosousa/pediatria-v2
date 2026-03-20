'use client';

import { useState, useCallback } from 'react';
import { createSchemaClient } from '@/lib/supabase/schemaClient';
import type { ServicePoint, ServicePointType, ServicePointStatus } from '@/types/queue';

const supabase = createSchemaClient('atendimento');

export type ServicePointInput = {
  name: string;
  code: string;
  type: ServicePointType;
  status?: ServicePointStatus;
  display_order?: number;
};

export function useServicePoints() {
  const [servicePoints, setServicePoints] = useState<ServicePoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const listServicePoints = useCallback(async (filters?: {
    type?: ServicePointType;
    status?: ServicePointStatus;
  }) => {
    setLoading(true);
    try {
      let query = supabase
        .from('service_points')
        .select('*')
        .order('display_order', { ascending: true })
        .order('name', { ascending: true });

      if (filters?.type) {
        query = query.eq('type', filters.type);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query;
      if (error) {
        console.error('[useServicePoints] listServicePoints error:', error);
        return [];
      }
      setServicePoints((data || []) as ServicePoint[]);
      return data as ServicePoint[];
    } catch (err) {
      console.error('[useServicePoints] listServicePoints catch:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const createServicePoint = useCallback(async (input: ServicePointInput) => {
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('service_points')
        .insert({
          name: input.name,
          code: input.code,
          type: input.type,
          status: input.status || 'active',
          display_order: input.display_order || 0,
        })
        .select()
        .single();
      if (error) throw error;
      return data as ServicePoint;
    } finally {
      setSaving(false);
    }
  }, []);

  const updateServicePoint = useCallback(async (id: number, updates: Partial<ServicePointInput>) => {
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('service_points')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as ServicePoint;
    } finally {
      setSaving(false);
    }
  }, []);

  const deleteServicePoint = useCallback(async (id: number) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('service_points')
        .delete()
        .eq('id', id);
      if (error) throw error;
    } finally {
      setSaving(false);
    }
  }, []);

  return {
    servicePoints,
    loading,
    saving,
    listServicePoints,
    createServicePoint,
    updateServicePoint,
    deleteServicePoint,
  };
}
