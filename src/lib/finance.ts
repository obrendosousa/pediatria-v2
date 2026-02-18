export type FinancialOrigin = 'atendimento' | 'loja';
export type FinancialType = 'consulta' | 'retorno' | 'loja';
export type CanonicalPaymentMethod = 'pix' | 'cash' | 'credit_card' | 'debit_card';

export type PaymentSplitInput = {
  method: string;
  amount: number;
};

export type CanonicalPaymentSplit = {
  payment_method: CanonicalPaymentMethod;
  amount: number;
};

const METHOD_ALIASES: Record<string, CanonicalPaymentMethod> = {
  pix: 'pix',
  cash: 'cash',
  money: 'cash',
  dinheiro: 'cash',
  debit_card: 'debit_card',
  debit: 'debit_card',
  debito: 'debit_card',
  cartao_debito: 'debit_card',
  credit_card: 'credit_card',
  credit: 'credit_card',
  card: 'credit_card',
  cartao: 'credit_card',
  cartao_credito: 'credit_card'
};

type LegacyOrigin = 'atendimento' | 'consulta' | 'retorno' | 'pendencia' | 'loja';
type AppointmentTypeLike = 'consulta' | 'retorno' | null | undefined;

const PAYMENT_METHOD_LABELS: Record<CanonicalPaymentMethod, string> = {
  pix: 'Pix',
  cash: 'Dinheiro',
  credit_card: 'Crédito',
  debit_card: 'Débito'
};

const ORIGIN_LABELS: Record<FinancialOrigin, string> = {
  atendimento: 'Atendimento',
  loja: 'Loja'
};

const TYPE_LABELS: Record<FinancialType, string> = {
  consulta: 'Consulta',
  retorno: 'Retorno',
  loja: 'Loja'
};

export function normalizeFinancialOrigin(origin: string | null | undefined): FinancialOrigin {
  const normalized = (origin || '').trim().toLowerCase() as LegacyOrigin;
  if (normalized === 'loja') return 'loja';
  return 'atendimento';
}

export function resolveFinancialType(params: {
  origin: string | null | undefined;
  explicitType?: string | null;
  appointmentType?: AppointmentTypeLike;
}): FinancialType {
  const normalizedOrigin = normalizeFinancialOrigin(params.origin);
  if (normalizedOrigin === 'loja') return 'loja';

  const explicitType = (params.explicitType || '').trim().toLowerCase();
  if (explicitType === 'retorno') return 'retorno';
  if (explicitType === 'consulta') return 'consulta';

  if (params.appointmentType === 'retorno') return 'retorno';
  return 'consulta';
}

export function paymentMethodLabel(method: CanonicalPaymentMethod): string {
  return PAYMENT_METHOD_LABELS[method];
}

export function financialOriginLabel(origin: FinancialOrigin): string {
  return ORIGIN_LABELS[origin];
}

export function financialTypeLabel(type: FinancialType): string {
  return TYPE_LABELS[type];
}

export function normalizePaymentMethod(method: string): CanonicalPaymentMethod {
  const normalized = method.trim().toLowerCase();
  const mapped = METHOD_ALIASES[normalized];
  if (!mapped) {
    throw new Error(`Forma de pagamento inválida: ${method}`);
  }
  return mapped;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function normalizePaymentSplits(
  total: number,
  paymentMethod?: string | null,
  payments?: PaymentSplitInput[] | null
): CanonicalPaymentSplit[] {
  if (total <= 0) return [];

  if (payments && payments.length > 0) {
    const normalized = payments.map((payment) => ({
      payment_method: normalizePaymentMethod(payment.method),
      amount: round2(Number(payment.amount || 0))
    }));

    const invalidAmount = normalized.some((payment) => payment.amount <= 0);
    if (invalidAmount) {
      throw new Error('Os valores das formas de pagamento devem ser maiores que zero.');
    }

    const sum = round2(normalized.reduce((acc, payment) => acc + payment.amount, 0));
    const totalRounded = round2(total);
    if (sum !== totalRounded) {
      throw new Error(`Soma das formas de pagamento (${sum}) diferente do total (${totalRounded}).`);
    }

    return normalized;
  }

  if (!paymentMethod) {
    throw new Error('Informe a forma de pagamento.');
  }

  return [
    {
      payment_method: normalizePaymentMethod(paymentMethod),
      amount: round2(total)
    }
  ];
}

export function resolveSalePaymentMethodFromSplits(
  splits: CanonicalPaymentSplit[]
): string {
  if (splits.length === 1) return splits[0].payment_method;
  return 'mixed';
}
