import { CanonicalPaymentSplit, FinancialOrigin } from '@/lib/finance';

export type SupabaseLikeClient = {
  from: (table: string) => unknown;
};

export type CreateFinancialTransactionParams = {
  amount: number;
  origin: FinancialOrigin;
  createdBy: string | null;
  payments: CanonicalPaymentSplit[];
  occurredAt?: string;
  appointmentId?: number | null;
  saleId?: number | null;
  medicalCheckoutId?: number | null;
  notes?: string | null;
  groupCode?: string | null;
};

function isMissingFinancialTable(message?: string): boolean {
  if (!message) return false;
  return (
    message.includes("Could not find the table 'public.financial_transactions'") ||
    message.includes("Could not find the table 'public.financial_transaction_payments'")
  );
}

function isOriginConstraintError(message?: string): boolean {
  if (!message) return false;
  return message.includes('financial_transactions_origin_check');
}

function legacyOriginFallback(origin: FinancialOrigin): string | null {
  if (origin === 'atendimento') return 'consulta';
  return null;
}

export async function createFinancialTransaction(
  supabase: SupabaseLikeClient,
  params: CreateFinancialTransactionParams
): Promise<number> {
  const {
    amount,
    origin,
    createdBy,
    payments,
    occurredAt,
    appointmentId = null,
    saleId = null,
    medicalCheckoutId = null,
    notes = null,
    groupCode = null
  } = params;

  const transactionsTable = supabase.from('financial_transactions') as {
    insert: (values: unknown) => {
      select: (columns: string) => {
        single: () => Promise<{
          data: { id: number } | null;
          error: { message?: string } | null;
        }>;
      };
    };
  };

  const insertTransaction = async (originValue: string) =>
    transactionsTable
      .insert({
        amount,
        origin: originValue,
        created_by: createdBy,
        occurred_at: occurredAt ?? new Date().toISOString(),
        appointment_id: appointmentId,
        sale_id: saleId,
        medical_checkout_id: medicalCheckoutId,
        notes,
        group_code: groupCode
      })
      .select('id')
      .single();

  let { data: transaction, error: txError } = await insertTransaction(origin);

  if (txError && isOriginConstraintError(txError.message)) {
    const fallbackOrigin = legacyOriginFallback(origin);
    if (fallbackOrigin) {
      const retryResult = await insertTransaction(fallbackOrigin);
      transaction = retryResult.data;
      txError = retryResult.error;
    }
  }

  if (txError || !transaction) {
    if (isMissingFinancialTable(txError?.message)) {
      throw new Error('[finance] Tabelas financeiras não encontradas. Execute a migration create_financial_module_tables.sql antes de registrar transações.');
    }
    throw new Error(txError?.message || 'Erro ao registrar transação financeira.');
  }

  const paymentRows = payments.map((payment) => ({
    transaction_id: transaction.id,
    payment_method: payment.payment_method,
    amount: payment.amount
  }));

  const paymentsTable = supabase.from('financial_transaction_payments') as {
    insert: (values: unknown) => Promise<{
      error: { message?: string } | null;
    }>;
  };

  const { error: paymentError } = await paymentsTable.insert(paymentRows);

  if (paymentError) {
    if (isMissingFinancialTable(paymentError.message)) {
      throw new Error('[finance] Tabela de formas de pagamento não encontrada. Execute a migration create_financial_module_tables.sql.');
    }
    throw new Error(paymentError.message || 'Erro ao registrar formas de pagamento.');
  }

  return transaction.id as number;
}
