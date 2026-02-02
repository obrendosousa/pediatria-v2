// src/schemas/patientSchema.ts
import { z } from 'zod';

// Schema de um familiar individual
const familyMemberSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  relationship: z.string().min(1, "Vínculo é obrigatório"), // Ex: Mãe, Pai, Cônjuge
  phone: z.string().optional(),
});

export const patientBaseSchema = z.object({
  // --- Identificação ---
  profile_picture: z.any().optional(), // Aceita File ou String (URL)
  name: z.string().min(2, "O nome deve ter pelo menos 2 caracteres"),
  code: z.string().optional(),
  
  use_social_name: z.boolean().default(false),
  social_name: z.string().optional(),
  
  birth_date: z.string().min(1, "Data de nascimento é obrigatória"),
  biological_sex: z.enum(['M', 'F']).optional().refine((val) => !!val, {
    message: "Selecione o sexo biológico"
  }),
  
  use_gender_identity: z.boolean().default(false),
  gender_identity: z.enum(['trans_male', 'trans_female', 'non_binary', 'other']).optional().nullable(),

  // Documentos
  cpf: z.string().optional(), 
  rg: z.string().optional(),
  cns_number: z.string().optional(),

  // --- Contato ---
  email: z.string().email("E-mail inválido").optional().or(z.literal('')),
  phone: z.string().min(10, "Telefone inválido (mínimo 10 dígitos)"),
  phone_work: z.string().optional(),
  phone_home: z.string().optional(),
  receive_sms_alerts: z.boolean().default(true),

  // --- Endereço ---
  address_zip: z.string().optional(),
  address_street: z.string().optional(),
  address_number: z.string().optional(),
  address_complement: z.string().optional(),
  address_neighborhood: z.string().optional(),
  address_city: z.string().optional(),
  address_state: z.string().optional(),
  address_country: z.string().default('Brasil'),

  // --- Dados Complementares ---
  nationality: z.string().default('Brasileira'),
  naturality_city: z.string().optional(),
  naturality_state: z.string().optional(),
  ethnicity: z.string().optional(),
  religion: z.string().optional(),
  marital_status: z.string().optional(),
  education_level: z.string().optional(),
  profession: z.string().optional(),
  how_found_us: z.string().optional(),

  // --- Lógica de Óbito ---
  is_deceased: z.boolean().default(false),
  cause_of_death: z.string().optional(),

  // --- NOVA ESTRUTURA DE FAMÍLIA ---
  // Removemos mother_name/father_name e usamos array
  family_members: z.array(familyMemberSchema).optional().default([]),

  active: z.boolean().default(true),
  notes: z.string().optional(),
});

export const patientRefinements = (data: any, ctx: z.RefinementCtx) => {
  if (data.use_social_name && !data.social_name) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Informe o nome social",
      path: ["social_name"]
    });
  }
  if (data.is_deceased && !data.cause_of_death) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Informe a causa do óbito",
      path: ["cause_of_death"]
    });
  }
};

export const patientSchema = patientBaseSchema.superRefine(patientRefinements);
export type PatientFormData = z.infer<typeof patientSchema>;