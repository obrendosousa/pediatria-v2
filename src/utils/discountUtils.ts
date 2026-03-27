export type DiscountType = '%' | 'R$';

/** Calcula o valor do desconto em R$ dado o tipo e valor bruto */
export function computeDiscountAmount(
  totalAmount: number,
  discountType: DiscountType,
  discountValue: number
): number {
  if (totalAmount <= 0 || discountValue <= 0) return 0;
  if (discountType === '%') {
    const clamped = Math.min(discountValue, 100);
    return Math.round(totalAmount * (clamped / 100) * 100) / 100;
  }
  // R$ fixo
  return Math.min(discountValue, totalAmount);
}

/** Retorna o valor efetivo (total - desconto), nunca negativo */
export function effectiveAmount(totalAmount: number, discountAmount: number): number {
  return Math.max(0, totalAmount - discountAmount);
}
