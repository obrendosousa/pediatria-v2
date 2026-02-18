// src/types/patient.ts

export type BiologicalSex = 'M' | 'F';
export type GenderIdentity = 'trans_male' | 'trans_female' | 'non_binary' | 'other' | null;

export interface PatientInsurance {
  id?: number; // Opcional na criação
  patient_id?: number;
  insurance_name: string; // Unimed, Bradesco, etc.
  plan_name?: string;
  card_number?: string;
  validity_date?: string; // ISO Date string (YYYY-MM-DD)
  is_indeterminate?: boolean;
  accommodation?: string; // Enfermaria, Apartamento
  created_at?: string;
}

export interface Patient {
  id: number;
  created_at?: string;
  
  // --- Identificação ---
  name: string; // Nome Principal (Civil ou Social dependendo da lógica, mas geralmente o que é exibido)
  code?: string;
  birth_date?: string; // Data de nascimento (YYYY-MM-DD)
  
  // Lógica Social vs Civil
  social_name?: string;
  use_social_name?: boolean;
  civil_name?: string; // Caso o 'name' seja usado como social, este guarda o civil
  
  // Gênero e Sexo
  biological_sex: BiologicalSex;
  gender_identity?: GenderIdentity;
  use_gender_identity?: boolean;
  
  // Documentos
  cpf?: string;
  rg?: string;
  cns_number?: string; // Cartão Nacional de Saúde
  
  // --- Contato ---
  email?: string;
  phone: string; // Celular Principal (Legado ou Atual)
  phone_work?: string;
  phone_home?: string;
  receive_sms_alerts?: boolean;
  
  // --- Endereço ---
  address_zip?: string;
  address_street?: string;
  address_number?: string;
  address_complement?: string;
  address_neighborhood?: string;
  address_city?: string;
  address_state?: string;
  address_country?: string; // Default: 'Brasil'
  
  // --- Dados Complementares (Demográficos) ---
  nationality?: string;
  naturality_city?: string;
  naturality_state?: string;
  ethnicity?: string; // Branca, Parda, Negra, Amarela, Indígena
  religion?: string;
  marital_status?: string; // Solteiro, Casado...
  education_level?: string;
  profession?: string;
  
  // --- Origem ---
  how_found_us?: string;
  
  // --- Controle ---
  active?: boolean;
  notes?: string;
  
  // --- Óbito ---
  is_deceased?: boolean;
  cause_of_death?: string;
  
  // --- Família ---
  mother_name?: string;
  father_name?: string;

  // --- Relacionamentos (Joined via Supabase) ---
  patient_insurances?: PatientInsurance[];
}