/**
 * Escapa caracteres especiais de ILIKE/LIKE do PostgreSQL (%, _, \)
 * para uso seguro em filtros Supabase .ilike() e .or() com ilike.
 */
export function escapeIlike(term: string): string {
  return term.replace(/[%_\\]/g, "\\$&");
}
