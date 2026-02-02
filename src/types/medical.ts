// src/types/medical.ts

export type CriticalityLevel = 'low' | 'medium' | 'high';

export interface Allergy {
  substance: string;
  reaction?: string;
  criticality?: CriticalityLevel; // Para mostrar ícone vermelho ou amarelo
}

export interface MedicationInUse {
  name: string;
  dosage: string;    // ex: "500mg"
  frequency?: string; // ex: "8/8h"
  started_at?: string;
}

// === CARD FIXO (OS 6 CARDS) ===
export interface ClinicalSummary {
  id: number;
  patient_id: number;
  
  // Texto Livre
  antecedents_clinical: string;
  antecedents_surgical: string;
  antecedents_family: string;
  habits: string;
  
  // Estruturados (JSONB do Banco viram Arrays aqui)
  allergies: Allergy[];
  medications_in_use: MedicationInUse[];
  
  updated_at: string;
}

// === PRONTUÁRIO / TIMELINE ===
export interface Vitals {
  weight?: number;      // kg
  height?: number;      // cm
  imc?: number;         // calculado
  pe?: number;          // Perímetro cefálico (cm)
  temp?: number;        // Celsius
  sysBP?: number;       // Pressão Sistólica (120)
  diaBP?: number;       // Pressão Diastólica (80)
  heartRate?: number;   // bpm
  respRate?: number;    // rpm
  saturation?: number;  // %
}

export interface PrescriptionItem {
  medication_name: string;
  dosage: string;
  instructions: string; // "Tomar 1 comprimido a cada 8 horas"
  quantity?: string;    // "1 Caixa"
}

export interface MedicalRecord {
  id: number;
  appointment_id?: number;
  patient_id: number;
  doctor_id?: number;
  
  // SOAP
  chief_complaint: string;
  hda: string;
  physical_exam: string;
  diagnosis: string;
  
  // JSONB Types
  vitals: Vitals;
  prescription: PrescriptionItem[];
  
  // Controle
  status: 'draft' | 'signed';
  started_at?: string;
  finished_at?: string;
  created_at: string;
}

// === CATÁLOGO DE MEDICAMENTOS (PARA O AUTOCOMPLETE) ===
export interface MedicationCatalogItem {
  id: number;
  name: string;
  active_ingredient: string;
  dosage: string;
  form: string; // Comprimido, Xarope...
}

// === AGENDAMENTOS ===
export interface Appointment {
  id: number;
  start_time: string;
  patient_name: string | null;
  patient_phone: string | null;
  patient_id?: number | null;
  parent_name?: string | null;
  patient_sex?: 'M' | 'F' | null;
  doctor_name: string;
  doctor_id: number | null;
  status: 'scheduled' | 'waiting' | 'in_service' | 'finished' | 'blocked' | 'cancelled';
  notes?: string | null;
  anamnesis?: string | null;
  created_at?: string;
}