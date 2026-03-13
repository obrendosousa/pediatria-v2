// Tipos do módulo de orçamentos (schema atendimento)

export type BudgetStatus = 'pendente' | 'orcado' | 'aprovado' | 'rejeitado';
export type DiscountType = '%' | 'R$';

export interface Budget {
  id: number;
  patient_id: number;
  doctor_id?: number | null;
  status: BudgetStatus;
  subtotal: number;
  discount_type: DiscountType;
  discount_value: number;
  discount_amount: number;
  total: number;
  installments: number;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  // Campos de JOIN (opcionais)
  patient_name?: string;
  doctor_name?: string;
}

export interface BudgetItem {
  id?: number;
  budget_id?: number;
  procedure_name: string;
  sessions: number;
  unit_price: number;
  subtotal: number;
}

export interface BudgetWithItems extends Budget {
  items: BudgetItem[];
}
