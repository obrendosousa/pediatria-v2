import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolveFinanceRange } from '@/lib/financePeriod';
import { normalizeFinancialOrigin, resolveFinancialType } from '@/lib/finance';
import { requireApprovedProfile } from '@/lib/auth/requireApprovedProfile';

type PaymentMethod = 'pix' | 'cash' | 'credit_card' | 'debit_card';

type FinancialTransaction = {
  id: number;
  amount: number;
  origin: string;
  occurred_at: string;
  sale_id: number | null;
  appointment_id: number | null;
  appointments?: Array<{
    appointment_type: 'consulta' | 'retorno' | null;
  }> | null;
  financial_transaction_payments: Array<{
    payment_method: PaymentMethod;
    amount: number;
  }>;
};

type SaleRow = {
  id: number;
  total: number;
  created_at: string;
  chat_id: number | null;
  patient_id: number | null;
  origin: string | null;
  appointment_id: number | null;
  appointments?: Array<{
    appointment_type: 'consulta' | 'retorno' | null;
  }> | null;
};

type SaleItemRow = {
  sale_id: number;
  quantity: number;
  unit_price: number;
  products?: Array<{ price_cost: number | null }> | null;
};

function dateKeyFromISO(dateISO: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit'
  }).format(new Date(dateISO));
}

function round2(value: number): number {
  return Number(value.toFixed(2));
}

function firstAppointmentType(row: { appointments?: Array<{ appointment_type: 'consulta' | 'retorno' | null }> | null }) {
  return row.appointments?.[0]?.appointment_type ?? null;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const range = resolveFinanceRange({
      preset: searchParams.get('preset'),
      start: searchParams.get('start'),
      end: searchParams.get('end')
    });
    const supabase = await createClient();
    await requireApprovedProfile(supabase, {
      allowedRoles: ['admin', 'secretary']
    });

    const [{ data: transactions, error: txError }, { data: sales, error: salesError }, { data: saleItems, error: itemsError }] =
      await Promise.all([
        supabase
          .from('financial_transactions')
          .select(`
            id,
            amount,
            origin,
            occurred_at,
            sale_id,
            appointment_id,
            appointments (
              appointment_type
            ),
            financial_transaction_payments (
              payment_method,
              amount
            )
          `)
          .gte('occurred_at', range.startISO)
          .lte('occurred_at', range.endISO)
          .order('occurred_at', { ascending: true }),
        supabase
          .from('sales')
          .select(`
            id,
            total,
            created_at,
            chat_id,
            patient_id,
            origin,
            appointment_id,
            appointments (
              appointment_type
            )
          `)
          .in('status', ['paid', 'completed'])
          .gte('created_at', range.startISO)
          .lte('created_at', range.endISO),
        supabase
          .from('sale_items')
          .select(`
            sale_id,
            quantity,
            unit_price,
            products (price_cost)
          `)
      ]);

    if (txError) throw new Error(txError.message || 'Erro ao consultar transações financeiras.');
    if (salesError) throw new Error(salesError.message || 'Erro ao consultar vendas.');
    if (itemsError) throw new Error(itemsError.message || 'Erro ao consultar itens de venda.');

    const txRows = ((transactions || []) as unknown) as FinancialTransaction[];
    const salesRows = (sales || []) as SaleRow[];
    const saleItemsRows = ((saleItems || []) as unknown) as SaleItemRow[];
    const patientIds = [...new Set(salesRows.map((sale) => sale.patient_id).filter((id): id is number => Number.isInteger(id)))];
    const chatIds = [...new Set(salesRows.map((sale) => sale.chat_id).filter((id): id is number => Number.isInteger(id)))];

    const [patientsRes, chatsRes] = await Promise.all([
      patientIds.length > 0
        ? supabase.from('patients').select('id, name').in('id', patientIds)
        : Promise.resolve({ data: [], error: null }),
      chatIds.length > 0
        ? supabase.from('chats').select('id, contact_name, phone').in('id', chatIds)
        : Promise.resolve({ data: [], error: null })
    ]);

    if (patientsRes.error) throw new Error(patientsRes.error.message || 'Erro ao buscar pacientes.');
    if (chatsRes.error) throw new Error(chatsRes.error.message || 'Erro ao buscar chats.');

    const patientMap = new Map((patientsRes.data || []).map((patient) => [patient.id, patient.name || 'Paciente']));
    const chatMap = new Map((chatsRes.data || []).map((chat) => [chat.id, chat.contact_name || chat.phone || 'Cliente']));

    const salesInPeriodSet = new Set(salesRows.map((sale) => sale.id));
    const saleItemsInRange = saleItemsRows.filter((item) => salesInPeriodSet.has(item.sale_id));
    const storeCost = saleItemsInRange.reduce((acc, item) => {
      const unitCost = Number(item.products?.[0]?.price_cost || 0);
      return acc + unitCost * Number(item.quantity || 0);
    }, 0);

    const revenueByOrigin = {
      atendimento: 0,
      loja: 0
    };
    const revenueByType = {
      consulta: 0,
      retorno: 0,
      loja: 0
    };
    const paymentByMethod: Record<PaymentMethod, number> = {
      pix: 0,
      cash: 0,
      credit_card: 0,
      debit_card: 0
    };
    const dailyRevenue: Record<string, number> = {};
    let txRevenueTotal = 0;

    for (const tx of txRows) {
      const amount = Number(tx.amount || 0);
      const normalizedOrigin = normalizeFinancialOrigin(tx.origin);
      const financialType = resolveFinancialType({
        origin: tx.origin,
        appointmentType: firstAppointmentType(tx)
      });

      revenueByOrigin[normalizedOrigin] += amount;
      revenueByType[financialType] += amount;
      txRevenueTotal += amount;

      const key = dateKeyFromISO(tx.occurred_at);
      dailyRevenue[key] = (dailyRevenue[key] || 0) + amount;

      for (const payment of tx.financial_transaction_payments || []) {
        paymentByMethod[payment.payment_method] += Number(payment.amount || 0);
      }
    }

    const salesRevenueByType = {
      consulta: 0,
      retorno: 0,
      loja: 0
    };
    let salesRevenueTotal = 0;
    for (const sale of salesRows) {
      const saleAmount = Number(sale.total || 0);
      const saleType = resolveFinancialType({
        origin: sale.origin,
        appointmentType: firstAppointmentType(sale)
      });
      salesRevenueByType[saleType] += saleAmount;
      salesRevenueTotal += saleAmount;
    }

    const txConsultationRevenue = round2(revenueByType.consulta + revenueByType.retorno);
    const txStoreRevenue = round2(revenueByType.loja);
    const txTotalRevenue = round2(txRevenueTotal);
    const grossProfit = round2(txConsultationRevenue + (txStoreRevenue - storeCost));

    const reconciliation = {
      txTotalRevenue,
      salesTotalRevenue: round2(salesRevenueTotal),
      txConsultationRevenue,
      salesConsultationRevenue: round2(salesRevenueByType.consulta + salesRevenueByType.retorno),
      txStoreRevenue,
      salesStoreRevenue: round2(salesRevenueByType.loja)
    };
    const divergence = {
      totalRevenue: round2(reconciliation.txTotalRevenue - reconciliation.salesTotalRevenue),
      consultationRevenue: round2(
        reconciliation.txConsultationRevenue - reconciliation.salesConsultationRevenue
      ),
      storeRevenue: round2(reconciliation.txStoreRevenue - reconciliation.salesStoreRevenue)
    };
    const hasDivergence = Object.values(divergence).some((value) => Math.abs(value) > 0.01);

    const clientSpend: Record<string, { name: string; total: number; visits: number }> = {};
    for (const sale of salesRows) {
      const key = String(sale.patient_id || sale.chat_id || sale.id);
      const name =
        (sale.patient_id ? patientMap.get(sale.patient_id) : null) ||
        (sale.chat_id ? chatMap.get(sale.chat_id) : null) ||
        'Cliente não identificado';
      if (!clientSpend[key]) {
        clientSpend[key] = { name, total: 0, visits: 0 };
      }
      clientSpend[key].total += Number(sale.total || 0);
      clientSpend[key].visits += 1;
    }

    const bestClients = Object.values(clientSpend)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    const uniqueClients = Object.keys(clientSpend).length;
    const ltv = uniqueClients > 0 ? round2(txTotalRevenue / uniqueClients) : 0;

    return NextResponse.json({
      range: {
        preset: range.preset,
        startDate: range.startDate,
        endDate: range.endDate
      },
      kpis: {
        totalRevenue: txTotalRevenue,
        consultationRevenue: txConsultationRevenue,
        storeRevenue: txStoreRevenue,
        storeCost: round2(storeCost),
        grossProfit,
        ltv
      },
      charts: {
        revenueByDay: Object.entries(dailyRevenue).map(([date, value]) => ({
          date,
          revenue: round2(value)
        })),
        revenueByOrigin: [
          { name: 'Atendimento', value: round2(revenueByOrigin.atendimento) },
          { name: 'Loja', value: round2(revenueByOrigin.loja) }
        ],
        revenueByPaymentMethod: [
          { name: 'Pix', value: round2(paymentByMethod.pix) },
          { name: 'Dinheiro', value: round2(paymentByMethod.cash) },
          { name: 'Crédito', value: round2(paymentByMethod.credit_card) },
          { name: 'Débito', value: round2(paymentByMethod.debit_card) }
        ]
      },
      reconciliation: {
        hasDivergence,
        divergence,
        tx: {
          totalRevenue: reconciliation.txTotalRevenue,
          consultationRevenue: reconciliation.txConsultationRevenue,
          storeRevenue: reconciliation.txStoreRevenue
        },
        sales: {
          totalRevenue: reconciliation.salesTotalRevenue,
          consultationRevenue: reconciliation.salesConsultationRevenue,
          storeRevenue: reconciliation.salesStoreRevenue
        }
      },
      bestClients
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao carregar visão financeira.';
    console.error('[finance/overview][GET]', error);
    const status =
      message === 'Usuário não autenticado.'
        ? 401
        : message === 'Acesso negado para perfil não aprovado.' || message === 'Perfil sem permissão para esta ação.'
          ? 403
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
