import { z } from 'zod';
import { familyMemberSchema } from './patientSchema';

export const atendimentoPatientSchema = z.object({
  // Identificação
  full_name: z.string().min(2, 'O nome deve ter pelo menos 2 caracteres'),
  social_name: z.string().optional().or(z.literal('')),
  use_social_name: z.boolean().optional(),
  sex: z.enum(['M', 'F']).optional().nullable(),
  birth_date: z.string().optional().or(z.literal('')),

  // Documentos
  cpf: z.string().optional().or(z.literal('')),
  rg: z.string().optional().or(z.literal('')),
  cns_number: z.string().optional().or(z.literal('')),

  // Contato
  phone: z.string().min(10, 'Telefone inválido (mínimo 10 dígitos)').optional().or(z.literal('')),
  phone_work: z.string().optional().or(z.literal('')),
  phone_home: z.string().optional().or(z.literal('')),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),

  // Endereço (campos flat no form, serializados para JSONB no submit)
  address_zip: z.string().optional().or(z.literal('')),
  address_street: z.string().optional().or(z.literal('')),
  address_number: z.string().optional().or(z.literal('')),
  address_complement: z.string().optional().or(z.literal('')),
  address_neighborhood: z.string().optional().or(z.literal('')),
  address_city: z.string().optional().or(z.literal('')),
  address_state: z.string().optional().or(z.literal('')),

  // Complementares
  nationality: z.string().optional().or(z.literal('')),
  ethnicity: z.string().optional().or(z.literal('')),
  religion: z.string().optional().or(z.literal('')),
  marital_status: z.string().optional().or(z.literal('')),
  education_level: z.string().optional().or(z.literal('')),
  profession: z.string().optional().or(z.literal('')),
  how_found_us: z.string().optional().or(z.literal('')),

  // Convênio
  insurance: z.string().optional().or(z.literal('')),
  insurance_plan: z.string().optional().or(z.literal('')),
  insurance_card_number: z.string().optional().or(z.literal('')),
  insurance_validity: z.string().optional().or(z.literal('')),
  insurance_accommodation: z.string().optional().or(z.literal('')),

  // Controle
  active: z.boolean().optional(),
  notes: z.string().optional().or(z.literal('')),

  // Família / Responsável (campos flat mantidos para backward compat)
  mother_name: z.string().optional().or(z.literal('')),
  father_name: z.string().optional().or(z.literal('')),
  responsible_name: z.string().optional().or(z.literal('')),
  responsible_cpf: z.string().optional().or(z.literal('')),
  // Novo: array dinâmico de familiares (fonte principal)
  family_members: z.array(familyMemberSchema).optional(),
}).superRefine((data, ctx) => {
  if (data.use_social_name && !data.social_name) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Informe o nome social',
      path: ['social_name'],
    });
  }
});

export type AtendimentoPatientFormData = z.infer<typeof atendimentoPatientSchema>;
