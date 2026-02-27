import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

export interface ExamItem {
  code: string;
  name: string;
  quantity: number;
}

export interface ExamRequest {
  id?: number;
  patient_id: number;
  medical_record_id?: number | null;
  include_date: boolean;
  request_date: string;
  request_type: 'SADT' | 'PARTICULAR';
  clinical_indication: string;
  exams: ExamItem[];
  model_name?: string | null;
  created_at?: string;
}

export function useExamRequests(patientId: number, medicalRecordId?: number | null) {
  const [requests, setRequests] = useState<ExamRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadRequests = useCallback(async () => {
    if (!patientId) return;
    setIsLoading(true);
    try {
      let query = supabase
        .from('exam_requests')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false });

      if (medicalRecordId) {
        query = query.eq('medical_record_id', medicalRecordId);
      }

      const { data, error } = await query;
      if (error) throw error;

      setRequests(
        (data ?? []).map((r: any) => ({
          ...r,
          exams: Array.isArray(r.exams) ? r.exams : [],
        }))
      );
    } catch (err) {
      console.error('[useExamRequests] loadRequests:', err);
    } finally {
      setIsLoading(false);
    }
  }, [patientId, medicalRecordId]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  async function createRequest(req: Omit<ExamRequest, 'id' | 'created_at'>): Promise<ExamRequest> {
    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('exam_requests')
        .insert({ ...req, patient_id: patientId, medical_record_id: medicalRecordId ?? null })
        .select()
        .single();
      if (error) throw error;
      const newReq = { ...data, exams: Array.isArray(data.exams) ? data.exams : [] };
      setRequests((prev) => [newReq, ...prev]);
      return newReq;
    } finally {
      setIsSaving(false);
    }
  }

  async function updateRequest(id: number, updates: Partial<ExamRequest>): Promise<void> {
    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('exam_requests')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      const updated = { ...data, exams: Array.isArray(data.exams) ? data.exams : [] };
      setRequests((prev) => prev.map((r) => (r.id === id ? updated : r)));
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteRequest(id: number): Promise<void> {
    const { error } = await supabase.from('exam_requests').delete().eq('id', id);
    if (error) throw error;
    setRequests((prev) => prev.filter((r) => r.id !== id));
  }

  return { requests, isLoading, isSaving, createRequest, updateRequest, deleteRequest, reload: loadRequests };
}

// Busca TUSS via API route
export async function searchTuss(q: string): Promise<{ id: number; code: string; name: string; category: string }[]> {
  if (!q || q.length < 2) return [];
  const res = await fetch(`/api/tuss/search?q=${encodeURIComponent(q)}&limit=12`);
  if (!res.ok) return [];
  return res.json();
}
