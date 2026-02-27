import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

// ─── Tipos ───────────────────────────────────────────────────────────────────
export interface PatientFile {
  id?: number;
  patient_id: number;
  medical_record_id?: number | null;
  file_name: string;
  file_url: string;
  file_type: string | null;
  description?: string | null;
  uploaded_at?: string;
}

export interface UploadProgress {
  fileName: string;
  progress: number; // 0–100
  error?: string;
}

// Bucket público onde os arquivos são armazenados
const BUCKET = 'midia';

// ─── Helpers ─────────────────────────────────────────────────────────────────
export function isImage(fileType: string | null | undefined): boolean {
  if (!fileType) return false;
  return fileType.startsWith('image/');
}

export function isVideo(fileType: string | null | undefined): boolean {
  if (!fileType) return false;
  return fileType.startsWith('video/');
}

export function isPdf(fileType: string | null | undefined): boolean {
  return fileType === 'application/pdf';
}

// ─── Hook ────────────────────────────────────────────────────────────────────
export function useAttachments(patientId: number, medicalRecordId?: number | null) {
  const [files, setFiles] = useState<PatientFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgresses, setUploadProgresses] = useState<UploadProgress[]>([]);

  const loadFiles = useCallback(async () => {
    if (!patientId) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('patient_files')
        .select('*')
        .eq('patient_id', patientId)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;
      setFiles(data ?? []);
    } catch (err) {
      console.error('[useAttachments] loadFiles:', err);
    } finally {
      setIsLoading(false);
    }
  }, [patientId, medicalRecordId]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  // Faz upload de uma lista de arquivos para o bucket e salva os metadados
  async function uploadFiles(rawFiles: File[]): Promise<PatientFile[]> {
    if (!rawFiles.length) return [];
    setUploading(true);

    // Inicializa progresso
    setUploadProgresses(rawFiles.map((f) => ({ fileName: f.name, progress: 0 })));

    const uploaded: PatientFile[] = [];

    for (let i = 0; i < rawFiles.length; i++) {
      const file = rawFiles[i];
      const safeName = file.name.replace(/[^a-zA-Z0-9._\-]/g, '_');
      const path = `patients/${patientId}/${Date.now()}_${safeName}`;

      try {
        // Upload para o storage
        const { error: storageErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { upsert: false });

        if (storageErr) throw storageErr;

        // Obtém URL pública
        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
        const publicUrl = urlData.publicUrl;

        // Salva metadados no banco
        const { data: dbData, error: dbErr } = await supabase
          .from('patient_files')
          .insert({
            patient_id: patientId,
            medical_record_id: medicalRecordId ?? null,
            file_name: file.name,
            file_url: publicUrl,
            file_type: file.type || null,
          })
          .select()
          .single();

        if (dbErr) throw dbErr;

        uploaded.push(dbData);

        // Atualiza progresso
        setUploadProgresses((prev) =>
          prev.map((p, idx) => (idx === i ? { ...p, progress: 100 } : p))
        );
      } catch (err: any) {
        console.error(`[useAttachments] upload error for ${file.name}:`, err);
        setUploadProgresses((prev) =>
          prev.map((p, idx) =>
            idx === i ? { ...p, progress: 0, error: err.message } : p
          )
        );
      }
    }

    // Atualiza a lista de arquivos
    setFiles((prev) => [...uploaded.reverse(), ...prev]);
    setUploading(false);
    setUploadProgresses([]);
    return uploaded;
  }

  async function deleteFile(file: PatientFile): Promise<void> {
    if (!file.id) return;

    // Remove do storage (extrai o path do bucket a partir da URL pública)
    try {
      const url = new URL(file.file_url);
      // Formato: /storage/v1/object/public/{bucket}/{path}
      const parts = url.pathname.split(`/object/public/${BUCKET}/`);
      if (parts[1]) {
        await supabase.storage.from(BUCKET).remove([parts[1]]);
      }
    } catch {
      // Ignora erro de remoção no storage (arquivo pode ter sido deletado externamente)
    }

    // Remove do banco
    const { error } = await supabase.from('patient_files').delete().eq('id', file.id);
    if (error) throw error;
    setFiles((prev) => prev.filter((f) => f.id !== file.id));
  }

  return {
    files,
    isLoading,
    uploading,
    uploadProgresses,
    uploadFiles,
    deleteFile,
    reload: loadFiles,
  };
}
