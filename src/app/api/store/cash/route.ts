import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireApprovedProfile } from '@/lib/auth/requireApprovedProfile';
import { getBrazilTodayDate, getDayBoundsISO } from '@/lib/financePeriod';
import { logAuditServer } from '@/lib/auditServer';

type PaymentMethod = 'pix' | 'cash' | 'credit_card' | 'debit_card';

type StoreCashTx = {
  id: number;
  amount: number;
  occurred_at: string;
  daily_closure_id: number | null;
  origin: string;
  notes: string | null;
  sales?: Array<{
    id: number;
    patient_id: number | null;
    chat_id: number | null;
  }> | null;
  financial_transaction_payments: Array<{
    payment_method: PaymentMethod;
    amount: number;
  }>;
};

function buildTotals(transactions: StoreCashTx[]) {
  const totalsByMethod: Record<PaymentMethod, number> = {
    pix: 0,
    cash: 0,
    credit_card: 0,
    debit_card: 0
  };

  for (const tx of transactions) {
    for (const payment of tx.financial_transaction_payments || []) {
      totalsByMethod[payment.payment_method] += Number(payment.amount || 0);
    }
  }

  const totalAmount = Number(
    Object.values(totalsByMethod)
      .reduce((acc, value) => acc + value, 0)
      .toFixed(2)
  );

  return {
    totalsByMethod: Object.fromEntries(
      Object.entries(totalsByMethod).map(([key, value]) => [key, Number(value.toFixed(2))])
    ),
    totalAmount
  };
}

async function loadStoreTransactions(date: string) {
  const supabase = await createClient();
  const { startISO, endISO } = getDayBoundsISO(date);

  const { data, error } = await supabase
    .from('financial_transactions')
    .select(`
      id,
      amount,
      occurred_at,
      daily_closure_id,
      origin,
      notes,
      sales (
        id,
        patient_id,
        chat_id
      ),
      financial_transaction_payments (
        payment_method,
        amount
      )
    `)
    .eq('origin', 'loja')
    .gte('occurred_at', startISO)
    .lte('occurred_at', endISO)
    .order('occurred_at', { ascending: true });

  if (error) {
    throw new Error(error.message || 'Erro ao carregar transações do caixa da loja.');
  }

  return ((data || []) as unknown) as StoreCashTx[];
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    await requireApprovedProfile(supabase, {
      allowedRoles: ['admin', 'secretary']
    });

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || getBrazilTodayDate();
    const transactions = await loadStoreTransactions(date);
    const totals = buildTotals(transactions);
    const isClosed = transactions.length > 0 && transactions.every((tx) => tx.daily_closure_id != null);

    return NextResponse.json({
      date,
      isClosed,
      totals,
      transactions
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao carregar caixa da loja.';
    const status =
      message === 'Usuário não autenticado.'
        ? 401
        : message === 'Acesso negado para perfil não aprovado.' || message === 'Perfil sem permissão para esta ação.'
          ? 403
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { user } = await requireApprovedProfile(supabase, {
      allowedRoles: ['admin']
    });

    const body = await request.json().catch(() => ({}));
    const date = (body?.date as string | undefined) || getBrazilTodayDate();
    const { startISO, endISO } = getDayBoundsISO(date);

    const transactions = await loadStoreTransactions(date);
    if (transactions.length === 0) {
      return NextResponse.json(
        { error: 'Não existem lançamentos de loja para fechar neste dia.' },
        { status: 400 }
      );
    }

    const closureAlreadyLinked = transactions.every((tx) => tx.daily_closure_id != null);
    if (closureAlreadyLinked) {
      return NextResponse.json(
        { error: 'Caixa da lojinha já fechado para este dia.' },
        { status: 409 }
      );
    }

    const { data: existingClosure } = await supabase
      .from('financial_daily_closures')
      .select('*')
      .eq('closure_date', date)
      .maybeSingle();

    const totals = buildTotals(transactions);

    let closureId: number;

    if (existingClosure) {
      closureId = existingClosure.id as number;
    } else {
      const { data: closure, error: closureError } = await supabase
        .from('financial_daily_closures')
        .insert({
          closure_date: date,
          closed_by: user.id,
          totals_by_method: totals.totalsByMethod,
          totals_by_origin: { loja: totals.totalAmount, atendimento: 0 },
          total_amount: totals.totalAmount,
          notes: 'Fechamento da lojinha'
        })
        .select('id')
        .single();

      if (closureError || !closure) {
        throw new Error(closureError?.message || 'Erro ao registrar fechamento da lojinha.');
      }
      closureId = closure.id as number;
    }

    const { error: updateError } = await supabase
      .from('financial_transactions')
      .update({ daily_closure_id: closureId })
      .eq('origin', 'loja')
      .gte('occurred_at', startISO)
      .lte('occurred_at', endISO)
      .is('daily_closure_id', null);

    if (updateError) {
      throw new Error(updateError.message || 'Erro ao vincular transações da lojinha ao fechamento.');
    }

    await logAuditServer({
      supabase,
      userId: user.id,
      action: 'create',
      entityType: 'cash_closure',
      entityId: String(closureId),
      details: {
        scope: 'store',
        date,
        totals
      }
    });

    return NextResponse.json({
      success: true,
      closureId,
      date
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao fechar caixa da lojinha.';
    const status =
      message === 'Usuário não autenticado.'
        ? 401
        : message === 'Acesso negado para perfil não aprovado.' || message === 'Perfil sem permissão para esta ação.'
          ? 403
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
