import type { Procedure } from '@/types/cadastros';

// --- Constantes ---

export const PROCEDURE_TYPES = [
  { value: 'consultation', label: 'Consultas' },
  { value: 'exam', label: 'Exames' },
  { value: 'injectable', label: 'Injetáveis' },
  { value: 'other', label: 'Outros' },
] as const;

export const APPLICATION_ROUTES = [
  { value: 'articular', label: 'Articular' },
  { value: 'auricular', label: 'Auricular' },
  { value: 'cutanea', label: 'Cutânea' },
  { value: 'endovenosa', label: 'Endovenosa' },
  { value: 'escleroterapia', label: 'Escleroterapia' },
  { value: 'implante', label: 'Implante' },
  { value: 'intradermica', label: 'Intradérmica' },
  { value: 'intramuscular', label: 'Intramuscular' },
  { value: 'intramuscular_profundo', label: 'Intramuscular profundo' },
  { value: 'intramuscular_profundo_lento', label: 'Intramuscular profundo e lento' },
  { value: 'intravaginal', label: 'Intravaginal' },
  { value: 'oral', label: 'Oral' },
  { value: 'retal', label: 'Retal' },
  { value: 'subcutanea', label: 'Subcutânea' },
  { value: 'outros', label: 'Outros' },
] as const;

// --- Form Data ---

export interface ProcedureFormData {
  name: string;
  procedure_type: string;
  duration_minutes: number;
  way_id: string;
  composition_enabled: boolean;
  note: string;
  // Precificacao
  composition_value: number;
  honorarium_value: number;
  total_value: number;
  formula_id: string;
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
  contribution_margin_type: 'percentage' | 'fixed';
}

export const EMPTY_FORM: ProcedureFormData = {
  name: '',
  procedure_type: '',
  duration_minutes: 30,
  way_id: '',
  composition_enabled: false,
  note: '',
  composition_value: 0,
  honorarium_value: 0,
  total_value: 0,
  formula_id: 'default',
  treatment_composition: 0,
  other_costs: 0,
  card_tax: 0,
  commission: 0,
  discount: 0,
  inss: 0,
  irrf: 0,
  irpj: 0,
  csll: 0,
  pis: 0,
  cofins: 0,
  cpp: 0,
  iss: 0,
  other_tax: 0,
  contribution_margin: 0,
  contribution_margin_type: 'percentage',
};

// --- Composicao com Produtos ---

export interface ProductCompositionItem {
  product_id: string;
  product_name: string;
  quantity: number;
  purchase_price: number;
  cost_price: number;
  stock: number;
}

// --- Medicamento do catálogo (retorno da API) ---

export interface CompositionProduct {
  id: string;
  name: string;
  active_ingredient: string;
  dosage: string;
  form: string;
}

// --- Helpers ---

export function procedureToFormData(p: Procedure): ProcedureFormData {
  return {
    name: p.name,
    procedure_type: p.procedure_type,
    duration_minutes: p.duration_minutes,
    way_id: p.way_id || '',
    composition_enabled: p.composition_enabled,
    note: p.note || '',
    composition_value: p.composition_value || 0,
    honorarium_value: p.honorarium_value || 0,
    total_value: p.total_value || 0,
    formula_id: p.formula_id || 'default',
    treatment_composition: p.treatment_composition || 0,
    other_costs: p.other_costs || 0,
    card_tax: p.card_tax || 0,
    commission: p.commission || 0,
    discount: p.discount || 0,
    inss: p.inss || 0,
    irrf: p.irrf || 0,
    irpj: p.irpj || 0,
    csll: p.csll || 0,
    pis: p.pis || 0,
    cofins: p.cofins || 0,
    cpp: p.cpp || 0,
    iss: p.iss || 0,
    other_tax: p.other_tax || 0,
    contribution_margin: p.contribution_margin || 0,
    contribution_margin_type: (p.contribution_margin_type as 'percentage' | 'fixed') || 'percentage',
  };
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

// --- CSS Classes (reutilizaveis) ---

export const inputClass = 'w-full px-3 py-2.5 text-sm border border-slate-200 dark:border-[#3d3d48] rounded-xl bg-white dark:bg-[#1c1c21] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-400 disabled:opacity-50';
export const selectClass = `${inputClass} appearance-none cursor-pointer`;
export const labelClass = 'text-xs font-bold text-slate-500 dark:text-[#a1a1aa] mb-1.5 ml-1 flex items-center min-h-[20px] uppercase tracking-wider';
