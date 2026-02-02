// src/utils/formatUtils.ts

/**
 * Formata CPF: 000.000.000-00
 */
export function formatCPF(value: string): string {
  const clean = value.replace(/\D/g, '');
  if (clean.length <= 3) return clean;
  if (clean.length <= 6) return `${clean.slice(0, 3)}.${clean.slice(3)}`;
  if (clean.length <= 9) return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6)}`;
  return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9, 11)}`;
}

/**
 * Remove formatação do CPF
 */
export function cleanCPF(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Formata telefone: (00) 00000-0000 ou (00) 0000-0000
 */
export function formatPhone(value: string): string {
  const clean = value.replace(/\D/g, '');
  if (clean.length <= 2) return clean;
  if (clean.length <= 6) return `(${clean.slice(0, 2)}) ${clean.slice(2)}`;
  if (clean.length <= 10) return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
  return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7, 11)}`;
}

/**
 * Remove formatação do telefone
 */
export function cleanPhone(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Formata CEP: 00000-000
 */
export function formatCEP(value: string): string {
  const clean = value.replace(/\D/g, '');
  if (clean.length <= 5) return clean;
  return `${clean.slice(0, 5)}-${clean.slice(5, 8)}`;
}

/**
 * Remove formatação do CEP
 */
export function cleanCEP(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Formata RG (formato simples, pode variar por estado)
 */
export function formatRG(value: string): string {
  // RG pode ter formatos diferentes, mantemos simples por enquanto
  // Se necessário, pode ser customizado por estado
  return value;
}

/**
 * Remove formatação do RG
 */
export function cleanRG(value: string): string {
  return value.replace(/\D/g, '');
}
