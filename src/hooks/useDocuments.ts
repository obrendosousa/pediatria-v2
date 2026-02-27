import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

// ─── Tipos ───────────────────────────────────────────────────────────────────
export type DocumentType =
  | 'Atestado Médico'
  | 'Declaração de Comparecimento'
  | 'Laudo Médico'
  | 'Relatório Médico'
  | 'Atestado para Escola/Faculdade'
  | 'Prescrição de Dieta'
  | 'Encaminhamento'
  | 'Receita'
  | 'Outros';

export interface MedicalDocument {
  id?: number;
  patient_id: number;
  medical_record_id?: number | null;
  type: DocumentType | string;
  content: string;
  document_date: string; // ISO date string YYYY-MM-DD
  requires_signature: boolean;
  created_at?: string;
}

// ─── Hook ────────────────────────────────────────────────────────────────────
export function useDocuments(patientId: number, medicalRecordId?: number | null) {
  const [documents, setDocuments] = useState<MedicalDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadDocuments = useCallback(async () => {
    if (!patientId) return;
    setIsLoading(true);
    try {
      let query = supabase
        .from('medical_documents')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false });

      // Removing the medical_record_id filter to show history of all documents

      const { data, error } = await query;

      if (error) throw error;
      setDocuments(data ?? []);
    } catch (err) {
      console.error('[useDocuments] loadDocuments:', err);
    } finally {
      setIsLoading(false);
    }
  }, [patientId, medicalRecordId]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  async function createDocument(
    doc: Omit<MedicalDocument, 'id' | 'created_at'>
  ): Promise<MedicalDocument> {
    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('medical_documents')
        .insert({
          ...doc,
          patient_id: patientId,
          medical_record_id: medicalRecordId ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      setDocuments((prev) => [data, ...prev]);
      return data;
    } finally {
      setIsSaving(false);
    }
  }

  async function updateDocument(id: number, updates: Partial<MedicalDocument>): Promise<void> {
    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('medical_documents')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      setDocuments((prev) => prev.map((d) => (d.id === id ? data : d)));
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteDocument(id: number): Promise<void> {
    const { error } = await supabase.from('medical_documents').delete().eq('id', id);
    if (error) throw error;
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  }

  return {
    documents,
    isLoading,
    isSaving,
    createDocument,
    updateDocument,
    deleteDocument,
    reload: loadDocuments,
  };
}
