import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { normalizeFinancialOrigin, normalizePaymentSplits, type PaymentSplitInput } from '@/lib/finance';

type RouteContext = {
  params: Promise<{ id: string }>;
};

type TransactionRow = {
  id: number;
  amount: number;
  origin: string;
  occurred_at: string;
  notes: string | null;
  daily_closure_id?: number | null;
  financial_transaction_payments: Array<{
    payment_method: 'pix' | 'cash' | 'credit_card' | 'debit_card';
    amount: number;
  }>;
};

async function ensureAdminWithPassword(supabase: Awaited<ReturnType<typeof createClient>>, password: string) {
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('Usuário não autenticado.');
  }
  if (!user.email) {
    throw new Error('Usuário sem e-mail cadastrado para validação de senha.');
  }
  if (!password) {
    throw new Error('Senha obrigatória para editar lançamento.');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, status, active')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message || 'Erro ao validar perfil.');
  }

  const isAllowed =
    profile?.role === 'admin' && profile?.status === 'approved' && profile?.active === true;
  if (!isAllowed) {
    throw new Error('Apenas administradores podem editar lançamentos.');
  }

  const { error: authError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password
  });

  if (authError) {
    throw new Error('Senha inválida.');
  }

  return user.id;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const transactionId = Number(id);
    if (!Number.isInteger(transactionId) || transactionId <= 0) {
      return NextResponse.json({ error: 'ID inválido.' }, { status: 400 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      amount?: number;
      origin?: string;
      occurred_at?: string;
      notes?: string | null;
      payments?: PaymentSplitInput[];
      password?: string;
    };

    const amount = Number(body.amount || 0);
    const occurredAt = body.occurred_at;
    const notes = body.notes ?? null;
    const paymentsInput = body.payments || [];

    if (amount <= 0) {
      return NextResponse.json(
        { error: 'O valor do lançamento deve ser maior que zero.' },
        { status: 400 }
      );
    }
    if (!occurredAt) {
      return NextResponse.json({ error: 'Data/hora obrigatória.' }, { status: 400 });
    }
    if (!paymentsInput.length) {
      return NextResponse.json(
        { error: 'Informe ao menos uma forma de pagamento.' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const userId = await ensureAdminWithPassword(supabase, body.password || '');

    const normalizedOrigin = normalizeFinancialOrigin(body.origin);
    const normalizedPayments = normalizePaymentSplits(amount, undefined, paymentsInput);

    const { data: currentTransaction, error: currentError } = await supabase
      .from('financial_transactions')
      .select(`
        id,
        amount,
        origin,
        occurred_at,
        notes,
        daily_closure_id,
        financial_transaction_payments (
          payment_method,
          amount
        )
      `)
      .eq('id', transactionId)
      .maybeSingle();

    if (currentError) {
      throw new Error(currentError.message || 'Erro ao carregar lançamento atual.');
    }
    if (!currentTransaction) {
      return NextResponse.json({ error: 'Lançamento não encontrado.' }, { status: 404 });
    }

    const before = currentTransaction as TransactionRow;
    if (before.daily_closure_id) {
      return NextResponse.json(
        { error: 'Não é permitido editar lançamentos após o fechamento do caixa.' },
        { status: 409 }
      );
    }

    const { error: updateError } = await supabase
      .from('financial_transactions')
      .update({
        amount,
        origin: normalizedOrigin,
        occurred_at: occurredAt,
        notes
      })
      .eq('id', transactionId);

    if (updateError) {
      throw new Error(updateError.message || 'Erro ao atualizar lançamento.');
    }

    const { error: deletePaymentsError } = await supabase
      .from('financial_transaction_payments')
      .delete()
      .eq('transaction_id', transactionId);

    if (deletePaymentsError) {
      throw new Error(deletePaymentsError.message || 'Erro ao limpar formas de pagamento antigas.');
    }

    const { error: insertPaymentsError } = await supabase
      .from('financial_transaction_payments')
      .insert(
        normalizedPayments.map((payment) => ({
          transaction_id: transactionId,
          payment_method: payment.payment_method,
          amount: payment.amount
        }))
      );

    if (insertPaymentsError) {
      throw new Error(insertPaymentsError.message || 'Erro ao salvar novas formas de pagamento.');
    }

    const { data: afterTransaction, error: afterError } = await supabase
      .from('financial_transactions')
      .select(`
        id,
        amount,
        origin,
        occurred_at,
        notes,
        financial_transaction_payments (
          payment_method,
          amount
        )
      `)
      .eq('id', transactionId)
      .maybeSingle();

    if (afterError || !afterTransaction) {
      throw new Error(afterError?.message || 'Erro ao confirmar lançamento atualizado.');
    }

    await supabase.from('audit_log').insert({
      user_id: userId,
      action: 'update',
      entity_type: 'financial_transaction',
      entity_id: String(transactionId),
      details: {
        before,
        after: afterTransaction,
        edited_fields: ['amount', 'origin', 'occurred_at', 'notes', 'payment_methods']
      }
    });

    return NextResponse.json({ success: true, transaction: afterTransaction });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao editar lançamento.';
    const status =
      message === 'Apenas administradores podem editar lançamentos.'
        ? 403
        : message === 'Senha inválida.'
          ? 401
          : message === 'Usuário não autenticado.'
            ? 401
            : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
