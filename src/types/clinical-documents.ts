// src/types/clinical-documents.ts
// Tipos para documentos clínicos do prontuário — schema atendimento
// PRD seções 5.5 a 5.18

// === MODELOS REUTILIZÁVEIS ===
export type TemplateType = 'anamnese' | 'evolucao' | 'atestado' | 'laudo' | 'documento' | 'exame' | 'receita' | 'dieta';

export interface ClinicalTemplate {
  id: number;
  template_type: TemplateType;
  title: string;
  content: string | null;
  category: string | null;
  is_default: boolean;
  created_by: string | null;
  created_at: string;
}

// === ANAMNESES ===
export interface Anamnesis {
  id: number;
  patient_id: number;
  doctor_id: number | null;
  appointment_id: number | null;
  template_id: number | null;
  title: string | null;
  content: string | null;
  signed: boolean;
  signed_at: string | null;
  created_at: string;
}

// === EVOLUÇÕES CLÍNICAS ===
export interface ClinicalEvolution {
  id: number;
  patient_id: number;
  doctor_id: number | null;
  appointment_id: number | null;
  content: string | null;
  signed: boolean;
  digital_signature: boolean;
  show_date: boolean;
  evolution_date: string;
  created_at: string;
}

// === ATESTADOS ===
export interface MedicalCertificate {
  id: number;
  patient_id: number;
  doctor_id: number | null;
  template_id: number | null;
  title: string | null;
  content: string | null;
  signed: boolean;
  digital_signature: boolean;
  show_date: boolean;
  certificate_date: string;
  created_at: string;
}

// === LAUDOS ===
export interface MedicalReport {
  id: number;
  patient_id: number;
  doctor_id: number | null;
  template_id: number | null;
  title: string | null;
  content: string | null;
  signed: boolean;
  digital_signature: boolean;
  show_date: boolean;
  report_date: string;
  created_at: string;
}

// === ALERGIAS ===
export type AllergyType = 'medicamento' | 'alimento' | 'substancia' | 'outro';
export type AllergySeverity = 'leve' | 'moderada' | 'grave';

export interface PatientAllergy {
  id: number;
  patient_id: number;
  allergy_type: AllergyType;
  substance: string;
  reaction: string | null;
  severity: AllergySeverity | null;
  notes: string | null;
  created_at: string;
}

// === RESULTADOS DE EXAMES ===
export interface ExamResult {
  id: number;
  patient_id: number;
  doctor_id: number | null;
  exam_name: string;
  result_date: string | null;
  content: string | null;
  file_url: string | null;
  created_at: string;
}

// === PLANOS TERAPÊUTICOS ===
export type TherapeuticPlanStatus = 'active' | 'completed' | 'cancelled';

export interface TherapeuticPlanProcedure {
  name: string;
  sessions: number;
  frequency: string;
  notes?: string;
}

export interface TherapeuticPlan {
  id: number;
  patient_id: number;
  doctor_id: number | null;
  title: string | null;
  description: string | null;
  procedures: TherapeuticPlanProcedure[];
  status: TherapeuticPlanStatus;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

// === ANEXOS ===
export interface PatientAttachment {
  id: number;
  patient_id: number;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  category: string | null;
  uploaded_by: string | null;
  created_at: string;
}

// === GALERIA DE IMAGENS ===
export interface PatientImage {
  id: number;
  patient_id: number;
  image_url: string;
  thumbnail_url: string | null;
  title: string | null;
  description: string | null;
  category: string | null;
  taken_at: string | null;
  created_at: string;
}

// === DOCUMENTOS/TERMOS ===
export type DocumentType = 'termo_consentimento' | 'declaracao' | 'outro';

export interface ClinicalDocument {
  id: number;
  patient_id: number;
  doctor_id: number | null;
  template_id: number | null;
  document_type: DocumentType | null;
  title: string | null;
  content: string | null;
  signed: boolean;
  signed_at: string | null;
  created_at: string;
}
