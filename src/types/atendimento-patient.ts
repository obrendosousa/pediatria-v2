// Tipos do paciente no schema atendimento
// Nomes de coluna: full_name (não name), sex (não biological_sex)

export interface AtendimentoPatient {
  id: number;
  created_at?: string;
  updated_at?: string;

  // Identificação
  full_name: string;
  social_name?: string | null;
  use_social_name?: boolean;
  sex: 'M' | 'F' | null;
  birth_date?: string | null;

  // Documentos
  cpf?: string | null;
  rg?: string | null;
  cns_number?: string | null;

  // Contato
  phone?: string | null;
  phone_work?: string | null;
  phone_home?: string | null;
  email?: string | null;

  // Endereço (JSONB)
  address?: {
    zip?: string;
    street?: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
  } | null;

  // Dados complementares
  nationality?: string | null;
  ethnicity?: string | null;
  religion?: string | null;
  marital_status?: string | null;
  education_level?: string | null;
  profession?: string | null;
  how_found_us?: string | null;

  // Convênio
  insurance?: string | null;
  insurance_plan?: string | null;
  insurance_card_number?: string | null;
  insurance_validity?: string | null;
  insurance_accommodation?: string | null;

  // Controle
  active?: boolean;
  notes?: string | null;

  // Família / Responsável
  mother_name?: string | null;
  father_name?: string | null;
  responsible_name?: string | null;
  responsible_cpf?: string | null;
  family_members?: Array<{
    name: string;
    relationship: string;
    phone?: string;
    cpf?: string;
    is_legal_guardian?: boolean;
  }> | null;
}
