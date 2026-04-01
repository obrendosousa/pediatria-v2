import { z } from 'zod';

export const simplifiedPatientSchema = z.object({
  // Identificação
  full_name: z.string().min(2, 'O nome deve ter pelo menos 2 caracteres'),
  sex: z.enum(['M', 'F']).optional().nullable(),
  birth_date: z.string().optional().or(z.literal('')),

  // Endereço
  zone: z.string().optional().or(z.literal('')),
  address_type: z.string().optional().or(z.literal('')),
  address_street: z.string().optional().or(z.literal('')),
  address_number: z.string().optional().or(z.literal('')),
  address_neighborhood: z.string().optional().or(z.literal('')),

  // Contato
  phone: z.string().min(10, 'Telefone inválido (mínimo 10 dígitos)').optional().or(z.literal('')),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),

  // Documentos
  cpf: z.string().optional().or(z.literal('')),

  // Controle
  active: z.boolean().optional(),
  notes: z.string().optional().or(z.literal('')),
});

export type SimplifiedPatientFormData = z.infer<typeof simplifiedPatientSchema>;
