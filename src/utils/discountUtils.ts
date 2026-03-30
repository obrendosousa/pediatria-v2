export type DiscountType = '%' | 'R$';

/** Arredondamento seguro para 2 casas decimais (financeiro) */
function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Calcula o valor do desconto em R$ dado o tipo e valor bruto */
export function computeDiscountAmount(
  totalAmount: number,
  discountType: DiscountType,
  discountValue: number
): number {
  if (totalAmount <= 0 || discountValue <= 0) return 0;
  if (discountType === '%') {
    const clamped = Math.min(discountValue, 100);
    return round2(totalAmount * clamped / 100);
  }
  // R$ fixo — nunca excede o total
  return round2(Math.min(discountValue, totalAmount));
}

/** Retorna o valor efetivo (total - desconto), nunca negativo */
export function effectiveAmount(totalAmount: number, discountAmount: number): number {
  return round2(Math.max(0, totalAmount - discountAmount));
}
