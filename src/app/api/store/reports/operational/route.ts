import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireApprovedProfile } from '@/lib/auth/requireApprovedProfile';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    await requireApprovedProfile(supabase, {
      allowedRoles: ['admin', 'secretary']
    });

    const { searchParams } = new URL(request.url);
    const days = Number(searchParams.get('days') || 7);
    const safeDays = Number.isFinite(days) ? Math.min(Math.max(Math.floor(days), 1), 60) : 7;

    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(now.getDate() - safeDays);

    const startISO = startDate.toISOString();

    const [salesRes, movementsRes, auditsRes] = await Promise.all([
      supabase
        .from('sales')
        .select('id, total, status, created_at, payment_method, origin, patient_id')
        .gte('created_at', startISO)
        .order('created_at', { ascending: false }),
      supabase
        .from('stock_movements')
        .select('id, product_id, movement_type, quantity_change, reason, created_at, created_by, reference_type, reference_id')
        .gte('created_at', startISO)
        .order('created_at', { ascending: false })
        .limit(200),
      supabase
        .from('audit_log')
        .select('id, user_id, action, entity_type, entity_id, details, created_at')
        .in('entity_type', ['sale', 'cash_closure', 'product', 'product_batch', 'stock_movement'])
        .gte('created_at', startISO)
        .order('created_at', { ascending: false })
        .limit(300)
    ]);

    if (salesRes.error) throw new Error(salesRes.error.message || 'Erro ao carregar vendas do relatório.');
    if (movementsRes.error) throw new Error(movementsRes.error.message || 'Erro ao carregar movimentações de estoque.');
    if (auditsRes.error) throw new Error(auditsRes.error.message || 'Erro ao carregar trilha de auditoria.');

    const completedSales = (salesRes.data || []).filter((sale) => ['paid', 'completed'].includes(sale.status || ''));
    const totalRevenue = completedSales.reduce((acc, sale) => acc + Number(sale.total || 0), 0);
    const salesCount = completedSales.length;
    const averageTicket = salesCount > 0 ? totalRevenue / salesCount : 0;

    const movementTotals = (movementsRes.data || []).reduce(
      (acc, movement) => {
        const qty = Number(movement.quantity_change || 0);
        if (qty > 0) acc.in += qty;
        if (qty < 0) acc.out += Math.abs(qty);
        return acc;
      },
      { in: 0, out: 0 }
    );

    return NextResponse.json({
      generated_at: new Date().toISOString(),
      period: {
        days: safeDays,
        start: startISO,
        end: now.toISOString()
      },
      summary: {
        sales_count: salesCount,
        total_revenue: Number(totalRevenue.toFixed(2)),
        average_ticket: Number(averageTicket.toFixed(2)),
        stock_entries: movementTotals.in,
        stock_exits: movementTotals.out
      },
      sales: salesRes.data || [],
      stock_movements: movementsRes.data || [],
      audit_events: auditsRes.data || []
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao gerar relatório operacional.';
    const status =
      message === 'Usuário não autenticado.'
        ? 401
        : message === 'Acesso negado para perfil não aprovado.' || message === 'Perfil sem permissão para esta ação.'
          ? 403
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
