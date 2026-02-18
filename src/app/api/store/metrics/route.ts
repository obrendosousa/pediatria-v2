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
    const days = parseInt(searchParams.get('days') || '7');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - days);
    const startDateISO = startDate.toISOString();

    // 1. Vendas de hoje
    const todayISO = today.toISOString();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowISO = tomorrow.toISOString();

    const { data: salesToday, error: salesError } = await supabase
      .from('sales')
      .select('total, created_at')
      .gte('created_at', todayISO)
      .lt('created_at', tomorrowISO)
      .in('status', ['completed', 'paid']);

    if (salesError) throw salesError;

    const revenueToday = salesToday?.reduce((acc, s) => acc + Number(s.total || 0), 0) || 0;
    const salesCountToday = salesToday?.length || 0;
    const ticketAverage = salesCountToday > 0 ? revenueToday / salesCountToday : 0;

    // 2. Vendas dos últimos 7 dias (para gráfico)
    const { data: salesWeek, error: weekError } = await supabase
      .from('sales')
      .select('total, created_at')
      .gte('created_at', startDateISO)
      .in('status', ['completed', 'paid'])
      .order('created_at', { ascending: true });

    if (weekError) throw weekError;

    // Agrupar por dia
    const salesByDay: Record<string, number> = {};
    salesWeek?.forEach(sale => {
      const dateKey = new Date(sale.created_at).toISOString().slice(0, 10);
      salesByDay[dateKey] = (salesByDay[dateKey] || 0) + Number(sale.total || 0);
    });
    const salesByDayEntries = Object.entries(salesByDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dateKey, val]) => ({
        date: dateKey,
        name: new Date(`${dateKey}T00:00:00`).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit'
        }),
        val: Number(val.toFixed(2))
      }));

    // 3. Estoque baixo (produtos com stock < 5)
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, stock')
      .eq('active', true);

    if (productsError) throw productsError;

    const lowStockItems = products?.filter(p => {
      const stock = p.stock || 0;
      return stock < 5;
    }).length || 0;

    // 4. Produtos vencendo (próximos 30 dias)
    let expiringItems = 0;
    let expiringList: any[] = [];
    
    try {
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 30);
      const expirationDateISO = expirationDate.toISOString();

      const { data: expiringBatches, error: batchesError } = await supabase
        .from('product_batches')
        .select('id, expiration_date, quantity, product_id')
        .gte('expiration_date', todayISO)
        .lte('expiration_date', expirationDateISO)
        .gt('quantity', 0)
        .order('expiration_date', { ascending: true })
        .limit(10);

      if (!batchesError && expiringBatches) {
        // Buscar nomes dos produtos separadamente
        const productIds = [...new Set(expiringBatches.map(b => b.product_id))];
        const { data: productNames } = await supabase
          .from('products')
          .select('id, name')
          .in('id', productIds);

        const productMap = new Map(productNames?.map(p => [p.id, p.name]) || []);

        expiringItems = expiringBatches.length;
        expiringList = expiringBatches.map(b => ({
          id: b.id,
          name: productMap.get(b.product_id) || 'Produto',
          expiration_date: b.expiration_date,
          quantity: b.quantity,
        }));
      }
    } catch (err) {
      // Se a tabela product_batches não existir, apenas ignora
      console.warn('Erro ao buscar produtos vencendo:', err);
    }

    // 5. Comparação com período anterior (para tendências)
    const previousStart = new Date(startDate);
    previousStart.setDate(previousStart.getDate() - days);
    const previousEnd = startDate;

    const { data: previousSales } = await supabase
      .from('sales')
      .select('total')
      .gte('created_at', previousStart.toISOString())
      .lt('created_at', previousEnd.toISOString())
      .in('status', ['completed', 'paid']);

    const previousRevenue = previousSales?.reduce((acc, s) => acc + Number(s.total || 0), 0) || 0;
    const revenueChange = previousRevenue > 0 
      ? ((revenueToday - previousRevenue) / previousRevenue) * 100 
      : 0;

    const prevLen = previousSales?.length ?? 0;
    const previousTicket = prevLen > 0 
      ? (previousSales!.reduce((acc, s) => acc + Number(s.total || 0), 0) / prevLen)
      : 0;
    const ticketChange = previousTicket > 0 
      ? ((ticketAverage - previousTicket) / previousTicket) * 100 
      : 0;

    return NextResponse.json({
      revenueToday,
      ticketAverage,
      lowStockItems,
      expiringItems,
      revenueChange: revenueChange > 0 ? `+${revenueChange.toFixed(1)}%` : `${revenueChange.toFixed(1)}%`,
      ticketChange: ticketChange > 0 ? `+${ticketChange.toFixed(1)}%` : `${ticketChange.toFixed(1)}%`,
      salesByDay: salesByDayEntries,
      expiringList,
    });
  } catch (error: any) {
    console.error('[Store Metrics API Error]', error);
    const message = error?.message || 'Erro ao buscar métricas da loja';
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
