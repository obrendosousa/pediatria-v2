import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

// ─── Tipos dos itens por aba ────────────────────────────────────────────────
export interface PrescriptionItem {
  name: string;
  posology: string;
  quantity: number;
  unit: string;
  receipt_type: 'simples' | 'especial';
}

export interface PrescriptionExamItem {
  code?: string;
  name: string;
  quantity: number;
}

export interface PrescriptionVaccineItem {
  name: string;
  dose?: string; // "1ª dose", "2ª dose", "Reforço", "Dose Única"
}

// ─── Tipo principal ──────────────────────────────────────────────────────────
export interface Prescription {
  id?: number;
  patient_id: number;
  medical_record_id?: number | null;
  items: PrescriptionItem[];           // medicamentos
  exam_items: PrescriptionExamItem[];  // exames prescritos
  vaccine_items: PrescriptionVaccineItem[]; // vacinas prescritas
  model_name?: string | null;
  created_at?: string;
}

// ─── Hook ────────────────────────────────────────────────────────────────────
export function usePrescriptions(patientId: number, medicalRecordId?: number | null) {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadPrescriptions = useCallback(async () => {
    if (!patientId) return;
    setIsLoading(true);
    try {
      let query = supabase
        .from('prescriptions')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false });

      // Removing the medical_record_id filter to show history of all prescriptions

      const { data, error } = await query;
      if (error) throw error;

      setPrescriptions(
        (data ?? []).map((r: any) => ({
          ...r,
          items: Array.isArray(r.items) ? r.items : [],
          exam_items: Array.isArray(r.exam_items) ? r.exam_items : [],
          vaccine_items: Array.isArray(r.vaccine_items) ? r.vaccine_items : [],
        }))
      );
    } catch (err) {
      console.error('[usePrescriptions] loadPrescriptions:', err);
    } finally {
      setIsLoading(false);
    }
  }, [patientId, medicalRecordId]);

  useEffect(() => {
    loadPrescriptions();
  }, [loadPrescriptions]);

  async function createPrescription(
    prescription: Omit<Prescription, 'id' | 'created_at'>
  ): Promise<Prescription> {
    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('prescriptions')
        .insert({
          ...prescription,
          patient_id: patientId,
          medical_record_id: medicalRecordId ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      const newPrescription: Prescription = {
        ...data,
        items: Array.isArray(data.items) ? data.items : [],
        exam_items: Array.isArray(data.exam_items) ? data.exam_items : [],
        vaccine_items: Array.isArray(data.vaccine_items) ? data.vaccine_items : [],
      };
      setPrescriptions((prev) => [newPrescription, ...prev]);
      return newPrescription;
    } finally {
      setIsSaving(false);
    }
  }

  async function updatePrescription(id: number, updates: Partial<Prescription>): Promise<void> {
    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('prescriptions')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      const updated: Prescription = {
        ...data,
        items: Array.isArray(data.items) ? data.items : [],
        exam_items: Array.isArray(data.exam_items) ? data.exam_items : [],
        vaccine_items: Array.isArray(data.vaccine_items) ? data.vaccine_items : [],
      };
      setPrescriptions((prev) => prev.map((p) => (p.id === id ? updated : p)));
    } finally {
      setIsSaving(false);
    }
  }

  async function deletePrescription(id: number): Promise<void> {
    const { error } = await supabase.from('prescriptions').delete().eq('id', id);
    if (error) throw error;
    setPrescriptions((prev) => prev.filter((p) => p.id !== id));
  }

  return {
    prescriptions,
    isLoading,
    isSaving,
    createPrescription,
    updatePrescription,
    deletePrescription,
    reload: loadPrescriptions,
  };
}

// ─── Funções de busca via API routes ────────────────────────────────────────
export async function searchMedications(
  q: string
): Promise<{ id: number; name: string; active_ingredient: string; dosage: string; form: string }[]> {
  if (!q || q.length < 2) return [];
  const res = await fetch(`/api/medications/search?q=${encodeURIComponent(q)}&limit=12`);
  if (!res.ok) return [];
  return res.json();
}

export async function searchVaccines(
  q: string
): Promise<{ id: number; name: string; commercial_names: string; category: string; type: string }[]> {
  if (!q || q.length < 2) return [];
  const res = await fetch(`/api/vaccines/search?q=${encodeURIComponent(q)}&limit=12`);
  if (!res.ok) return [];
  return res.json();
}
