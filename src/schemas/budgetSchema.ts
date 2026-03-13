import { z } from 'zod';

export const budgetItemSchema = z.object({
  procedure_name: z.string().min(1, 'Informe o procedimento'),
  sessions: z.number().int().positive('Mínimo 1 sessão'),
  unit_price: z.number().nonnegative('Valor deve ser positivo'),
  subtotal: z.number().nonnegative(),
});

export const budgetSchema = z.object({
  patient_id: z.number().positive('Selecione um paciente'),
  doctor_id: z.number().positive('Selecione um profissional'),
  items: z.array(budgetItemSchema).min(1, 'Adicione ao menos um item'),
  discount_type: z.enum(['%', 'R$']).optional(),
  discount_value: z.number().nonnegative().optional(),
  installments: z.number().int().positive().optional(),
  notes: z.string().optional().or(z.literal('')),
});

export type BudgetFormData = z.infer<typeof budgetSchema>;
