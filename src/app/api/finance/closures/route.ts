import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolveFinanceRange } from '@/lib/financePeriod';
import { normalizeFinancialOrigin, resolveFinancialType } from '@/lib/finance';
import { requireApprovedProfile } from '@/lib/auth/requireApprovedProfile';
import { logAuditServer } from '@/lib/auditServer';

type PaymentMethod = 'pix' | 'cash' | 'credit_card' | 'debit_card';
type FinancialOrigin = 'atendimento' | 'loja';
type FinancialType = 'consulta' | 'retorno' | 'loja';

type TransactionRow = {
  id: number;
  amount: number;
  origin: string;
  occurred_at: string;
  created_by: string | null;
  appointment_id: number | null;
  sale_id: number | null;
  medical_checkout_id: number | null;
  notes: string | null;
  appointments?: Array<{
    id: number;
    patient_id: number | null;
    patient_name: string | null;
    parent_name: string | null;
    appointment_type: 'consulta' | 'retorno' | null;
  }> | null;
  sales?: Array<{
    id: number;
    patient_id: number | null;
    chat_id: number | null;
    total: number | null;
    payment_method: string | null;
  }> | null;
  financial_transaction_payments: Array<{
    payment_method: PaymentMethod;
    amount: number;
  }>;
};

function firstAppointment(transaction: TransactionRow) {
  return transaction.appointments?.[0] ?? null;
}

function firstSale(transaction: TransactionRow) {
  return transaction.sales?.[0] ?? null;
}

function buildDailyTotals(transactions: TransactionRow[]) {
  const totalsByMethod: Record<PaymentMethod, number> = {
    pix: 0,
    cash: 0,
    credit_card: 0,
    debit_card: 0
  };
  const totalsByOrigin: Record<FinancialOrigin, number> = {
    atendimento: 0,
    loja: 0
  };
  const totalsByType: Record<FinancialType, number> = {
    consulta: 0,
    retorno: 0,
    loja: 0
  };

  for (const transaction of transactions) {
    const amount = Number(transaction.amount || 0);
    const normalizedOrigin = normalizeFinancialOrigin(transaction.origin);
    const appointment = firstAppointment(transaction);
    const financialType = resolveFinancialType({
      origin: transaction.origin,
      appointmentType: appointment?.appointment_type ?? null
    });

    totalsByOrigin[normalizedOrigin] += amount;
    totalsByType[financialType] += amount;
    for (const payment of transaction.financial_transaction_payments || []) {
      totalsByMethod[payment.payment_method] += Number(payment.amount || 0);
    }
  }

  const totalAmount = Number(
    Object.values(totalsByMethod).reduce((acc, amount) => acc + amount, 0).toFixed(2)
  );

  return {
    totalsByMethod: Object.fromEntries(
      Object.entries(totalsByMethod).map(([key, value]) => [key, Number(value.toFixed(2))])
    ),
    totalsByOrigin: Object.fromEntries(
      Object.entries(totalsByOrigin).map(([key, value]) => [key, Number(value.toFixed(2))])
    ),
    totalsByType: Object.fromEntries(
      Object.entries(totalsByType).map(([key, value]) => [key, Number(value.toFixed(2))])
    ),
    totalAmount
  };
}

function mapTransactionLog(
  transaction: TransactionRow,
  patientNameById: Map<number, string>,
  chatNameById: Map<number, string>
) {
  const appointment = firstAppointment(transaction);
  const sale = firstSale(transaction);
  const appointmentType = appointment?.appointment_type ?? null;
  const patientName =
    appointment?.patient_name ||
    (sale?.patient_id ? patientNameById.get(sale.patient_id) : null) ||
    (sale?.chat_id ? chatNameById.get(sale.chat_id) : null) ||
    'Não identificado';

  const normalizedOrigin = normalizeFinancialOrigin(transaction.origin);
  const attendanceType = resolveFinancialType({
    origin: transaction.origin,
    appointmentType
  });

  return {
    id: transaction.id,
    occurred_at: transaction.occurred_at,
    origin: normalizedOrigin,
    attendance_type: attendanceType,
    patient_name: patientName,
    amount: Number(transaction.amount || 0),
    payment_methods: transaction.financial_transaction_payments || [],
    notes: transaction.notes
  };
}

function countDaysInclusive(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const diff = end.getTime() - start.getTime();
  return Math.floor(diff / (24 * 60 * 60 * 1000)) + 1;
}

async function loadTransactionsByRange(startISO: string, endISO: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('financial_transactions')
    .select(`
      id,
      amount,
      origin,
      occurred_at,
      created_by,
      appointment_id,
      sale_id,
      medical_checkout_id,
      notes,
      appointments (
        id,
        patient_id,
        patient_name,
        parent_name,
        appointment_type
      ),
      sales (
        id,
        patient_id,
        chat_id,
        total,
        payment_method
      ),
      financial_transaction_payments (
        payment_method,
        amount
      )
    `)
    .gte('occurred_at', startISO)
    .lte('occurred_at', endISO)
    .order('occurred_at', { ascending: true });

  if (error) {
    throw new Error(error.message || 'Erro ao carregar transações do dia.');
  }

  const rows = ((data || []) as unknown) as TransactionRow[];
  const patientIds = [
    ...new Set(
      rows
        .map((row) => firstSale(row)?.patient_id)
        .filter((id): id is number => Number.isInteger(id))
    ),
  ];
  const chatIds = [
    ...new Set(
      rows
        .map((row) => firstSale(row)?.chat_id)
        .filter((id): id is number => Number.isInteger(id))
    ),
  ];

  const [patientsRes, chatsRes] = await Promise.all([
    patientIds.length > 0
      ? supabase.from('patients').select('id, name').in('id', patientIds)
      : Promise.resolve({ data: [], error: null }),
    chatIds.length > 0
      ? supabase.from('chats').select('id, contact_name, phone').in('id', chatIds)
      : Promise.resolve({ data: [], error: null })
  ]);

  if (patientsRes.error) {
    throw new Error(patientsRes.error.message || 'Erro ao carregar pacientes.');
  }
  if (chatsRes.error) {
    throw new Error(chatsRes.error.message || 'Erro ao carregar chats.');
  }

  const patientNameById = new Map((patientsRes.data || []).map((patient) => [patient.id, patient.name || 'Paciente']));
  const chatNameById = new Map((chatsRes.data || []).map((chat) => [chat.id, chat.contact_name || chat.phone || 'Cliente']));

  return {
    rows,
    patientNameById,
    chatNameById
  };
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    await requireApprovedProfile(supabase, {
      allowedRoles: ['admin', 'secretary']
    });
    const { searchParams } = new URL(request.url);
    const preset = searchParams.get('preset');
    const date = searchParams.get('date');
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    const range = resolveFinanceRange({
      preset: preset ?? (start || end ? 'custom' : 'today'),
      start: start || date,
      end: end || date
    });

    const { data: closureRows, error: closureError } = await supabase
      .from('financial_daily_closures')
      .select('*')
      .gte('closure_date', range.startDate)
      .lte('closure_date', range.endDate);

    if (closureError) {
      throw new Error(closureError.message || 'Erro ao buscar fechamento diário.');
    }
    const expectedClosureDays = countDaysInclusive(range.startDate, range.endDate);
    const closures = closureRows || [];
    const isSingleDay = range.startDate === range.endDate;
    const closure = isSingleDay ? (closures[0] ?? null) : null;
    const isClosed = isSingleDay ? Boolean(closure) : closures.length >= expectedClosureDays;

    const { rows, patientNameById, chatNameById } = await loadTransactionsByRange(range.startISO, range.endISO);
    const totals = buildDailyTotals(rows);
    const logs = rows.map((transaction) => mapTransactionLog(transaction, patientNameById, chatNameById));

    return NextResponse.json({
      date: range.startDate,
      startDate: range.startDate,
      endDate: range.endDate,
      isClosed,
      closure: closure ?? null,
      closures_count: closures.length,
      totals,
      logs
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao buscar fechamento de caixa.';
    console.error('[finance/closures][GET]', error);
    const status =
      message === 'Usuário não autenticado.'
        ? 401
        : message === 'Acesso negado para perfil não aprovado.' || message === 'Perfil sem permissão para esta ação.'
          ? 403
          : 500;
    return NextResponse.json(
      { error: message },
      { status }
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { user } = await requireApprovedProfile(supabase, {
      allowedRoles: ['admin']
    });
    const body = await request.json().catch(() => ({}));
    const requestedDate = (body?.date as string | undefined) ?? undefined;
    const notes = (body?.notes as string | undefined) ?? null;
    const range = resolveFinanceRange({
      preset: 'today',
      start: requestedDate,
      end: requestedDate
    });

    const { data: existingClosure } = await supabase
      .from('financial_daily_closures')
      .select('*')
      .eq('closure_date', range.startDate)
      .maybeSingle();

    if (existingClosure) {
      return NextResponse.json(
        {
          error: 'Este dia já possui fechamento.',
          closure: existingClosure
        },
        { status: 409 }
      );
    }

    const { rows, patientNameById, chatNameById } = await loadTransactionsByRange(range.startISO, range.endISO);
    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'Não existem lançamentos para fechar neste dia.' },
        { status: 400 }
      );
    }

    const totals = buildDailyTotals(rows);
    const { data: closure, error: insertError } = await supabase
      .from('financial_daily_closures')
      .insert({
        closure_date: range.startDate,
        closed_by: user?.id ?? null,
        totals_by_method: totals.totalsByMethod,
        totals_by_origin: totals.totalsByOrigin,
        total_amount: totals.totalAmount,
        notes
      })
      .select()
      .single();

    if (insertError || !closure) {
      throw new Error(insertError?.message || 'Erro ao registrar fechamento diário.');
    }

    const { error: updateError } = await supabase
      .from('financial_transactions')
      .update({ daily_closure_id: closure.id })
      .gte('occurred_at', range.startISO)
      .lte('occurred_at', range.endISO)
      .is('daily_closure_id', null);

    if (updateError) {
      throw new Error(updateError.message || 'Erro ao vincular transações ao fechamento.');
    }

    await logAuditServer({
      supabase,
      userId: user.id,
      action: 'create',
      entityType: 'cash_closure',
      entityId: String(closure.id),
      details: {
        closure_date: range.startDate,
        totals: totals,
        transactions_count: rows.length
      }
    });

    return NextResponse.json({
      success: true,
      closure,
      totals,
      logs: rows.map((transaction) => mapTransactionLog(transaction, patientNameById, chatNameById))
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao fechar o caixa diário.';
    console.error('[finance/closures][POST]', error);
    const status =
      message === 'Usuário não autenticado.'
        ? 401
        : message === 'Acesso negado para perfil não aprovado.' || message === 'Perfil sem permissão para esta ação.'
          ? 403
          : 500;
    return NextResponse.json(
      { error: message },
      { status }
    );
  }
}
