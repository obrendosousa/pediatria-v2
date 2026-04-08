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
  attachments: { name: string; url: string }[];
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

  is_admin: boolean;
  restrict_prices: boolean;
  has_schedule: boolean;
  restrict_schedule: boolean;

  // Complementares
  attachments: { name: string; url: string }[];
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
  // Novos campos — composicao com produtos
  way_id: string | null;
  note: string | null;
  composition_value: number;
  honorarium_value: number;
  formula_id: string | null;
  // Custos variaveis
  treatment_composition: number;
  other_costs: number;
  // Despesas variaveis
  card_tax: number;
  commission: number;
  discount: number;
  // Impostos
  inss: number;
  irrf: number;
  irpj: number;
  csll: number;
  pis: number;
  cofins: number;
  cpp: number;
  iss: number;
  other_tax: number;
  // Margem de contribuicao
  contribution_margin: number;
  contribution_margin_type: string;
}

/** @deprecated Use ProcedureProductComposition instead */
export interface ProcedureComposition {
  id: string;
  procedure_id: string;
  sub_procedure_id: string;
  quantity: number;
  created_at: string;
}

export interface ProcedureProductComposition {
  id: string;
  procedure_id: string;
  product_id: number | null;
  quantity: number;
  purchase_price: number;
  cost_price: number;
  is_manual: boolean;
  manual_name: string | null;
  product_name: string | null;
  created_at: string;
}

// --- Procedimentos por Profissional ---

export type SplitType = 'percentage' | 'fixed';

export interface ProfessionalProcedure {
  id: string;
  professional_id: string;
  name: string;
  procedure_type: ProcedureType;
  custom_type: string | null;
  duration_minutes: number;
  value: number;
  split_type: SplitType;
  split_value: number;
  status: RecordStatus;
  created_at: string;
  updated_at: string;
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
