// Tipos do módulo Cadastros Gerais (schema: atendimento)

export type CollaboratorRole =
  | 'administrator'
  | 'administrative_assistant'
  | 'other'
  | 'receptionist'
  | 'seller';

export type ScheduleAccess = 'view_appointment' | 'open_record';

export type RecordStatus = 'active' | 'inactive';

export type ProcedureType = 'consultation' | 'exam' | 'injectable' | 'other';

export interface Collaborator {
  id: string;
  name: string;
  sex: string | null;
  birth_date: string | null;
  marital_status: string | null;
  cpf: string;
  rg: string | null;

  // Endereço
  street: string | null;
  zip_code: string | null;
  state: string | null;
  city: string | null;
  neighborhood: string | null;
  number: string | null;
  complement: string | null;

  // Contato
  email: string;
  phone: string | null;
  mobile: string | null;
  whatsapp: string | null;

  // Profissional
  role: CollaboratorRole;
  schedule_access: ScheduleAccess;
  is_admin: boolean;

  // Complementares
  attachments: Record<string, unknown>[];
  notes: string | null;

  status: RecordStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Professional {
  id: string;
  name: string;
  sex: string | null;
  birth_date: string | null;
  marital_status: string | null;
  cpf: string;
  rg: string | null;

  // Endereço
  street: string | null;
  zip_code: string | null;
  state: string | null;
  city: string | null;
  neighborhood: string | null;
  number: string | null;
  complement: string | null;

  // Contato
  email: string;
  phone: string | null;
  mobile: string | null;
  whatsapp: string | null;

  // Dados profissionais
  professional_type: string;
  specialty: string | null;
  registration_state: string;
  registration_type: string;
  registration_number: string;

  schedule_access: ScheduleAccess;
  is_admin: boolean;
  restrict_prices: boolean;
  has_schedule: boolean;
  restrict_schedule: boolean;

  // Complementares
  attachments: Record<string, unknown>[];
  notes: string | null;

  status: RecordStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// --- Clínico ---

export interface Procedure {
  id: string;
  name: string;
  procedure_type: ProcedureType;
  duration_minutes: number;
  composition_enabled: boolean;
  fee_value: number;
  total_value: number;
  status: RecordStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProcedureComposition {
  id: string;
  procedure_id: string;
  sub_procedure_id: string;
  quantity: number;
  created_at: string;
}

export interface ClinicalProtocol {
  id: string;
  name: string;
  description: string | null;
  total_value: number;
  status: RecordStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClinicalProtocolItem {
  id: string;
  protocol_id: string;
  procedure_id: string;
  sort_order: number;
  created_at: string;
}

export interface Partner {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  whatsapp: string | null;
  notes: string | null;
  status: RecordStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// --- Receituário ---

export interface Substance {
  id: string;
  name: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Formula {
  id: string;
  name: string;
  route_of_use: string;
  form: string;
  quantity: number;
  unit: string;
  posology: string;
  reference: string | null;
  notes: string | null;
  status: RecordStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface FormulaComposition {
  id: string;
  formula_id: string;
  substance_id: string;
  quantity: number | null;
  unit: string | null;
  sort_order: number;
  created_at: string;
}

export interface PrescriptionProtocol {
  id: string;
  name: string;
  content: string | null;
  status: RecordStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Medication {
  id: string;
  description: string;
  presentation: string;
  active_ingredient: string;
  barcode: string;
  type: string;
  label: string;
  therapeutic_class: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// --- Modelos de Prontuário ---

export type AnamnesisQuestionType =
  | 'text'
  | 'checkbox'
  | 'gestational_calculator'
  | 'multiple_choice';

export interface AnamnesisTemplate {
  id: string;
  title: string;
  allow_send_on_scheduling: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AnamnesisQuestion {
  id: string;
  template_id: string;
  question: string;
  type: AnamnesisQuestionType;
  options: unknown[];
  sort_order: number;
  created_at: string;
}

export interface CertificateTemplate {
  id: string;
  name: string;
  content: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DietTemplate {
  id: string;
  name: string;
  content: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface EvolutionTemplate {
  id: string;
  name: string;
  content: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExamTemplate {
  id: string;
  name: string;
  content: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExamCategory {
  id: string;
  name: string;
  sort_order: number | null;
  created_at: string;
}

export interface ReportTemplate {
  id: string;
  name: string;
  content: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecipeTemplate {
  id: string;
  name: string;
  content: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// --- Modelos de Documentos ---

export interface DocumentTemplate {
  id: string;
  title: string;
  content: string;
  is_default: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
