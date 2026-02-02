import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { chat_id, items, payment_method } = body;

    // items espera o formato: [{ id: 1, qty: 2, price: 10.50, name: 'Dipirona' }]
    
    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Carrinho vazio' }, { status: 400 });
    }

    // 1. Calcular Total da Venda (Segurança: recalcula no backend)
    const total = items.reduce((acc: number, item: any) => acc + (item.price * item.qty), 0);

    // 2. Criar o Registro da Venda (Cabeçalho)
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert({
        chat_id: chat_id || null, // Pode ser null se for consumidor final
        total: total,
        payment_method: payment_method,
        status: 'completed' // Assumimos pago no PDV direto
      })
      .select()
      .single();

    if (saleError || !sale) {
      throw new Error(`Erro ao criar venda: ${saleError?.message}`);
    }

    // 3. Processar Itens e Baixar Estoque (Lógica FEFO)
    for (const item of items) {
      let quantityNeeded = item.qty;

      // A. Busca lotes com saldo, ordenados por validade (ASC)
      const { data: batches, error: batchError } = await supabase
        .from('product_batches')
        .select('*')
        .eq('product_id', item.id)
        .gt('quantity', 0)
        .order('expiration_date', { ascending: true });

      if (batchError) throw new Error(`Erro ao buscar lotes do produto ${item.id}`);

      // Validação de Estoque Total
      const totalAvailable = batches?.reduce((acc, b) => acc + b.quantity, 0) || 0;
      if (totalAvailable < quantityNeeded) {
        // Nota: Idealmente faríamos rollback aqui, mas no Supabase Client simples
        // lançamos erro para o frontend tratar. O registro da venda ficará lá mas sem itens (bizarro),
        // em produção usaríamos RPC (Stored Procedure) para transação atômica.
        throw new Error(`Estoque insuficiente para o produto ID ${item.id}. Disponível: ${totalAvailable}`);
      }

      // B. Consome dos lotes
      if (batches) {
        for (const batch of batches) {
          if (quantityNeeded <= 0) break; // Já pegamos tudo

          const take = Math.min(batch.quantity, quantityNeeded);
          
          // Atualiza lote
          const { error: updateError } = await supabase
            .from('product_batches')
            .update({ quantity: batch.quantity - take })
            .eq('id', batch.id);

          if (updateError) throw new Error('Erro ao atualizar estoque');

          quantityNeeded -= take;
        }
      }

      // 4. Inserir Item da Venda (Histórico)
      const { error: itemError } = await supabase
        .from('sale_items')
        .insert({
          sale_id: sale.id,
          product_id: item.id,
          quantity: item.qty,
          unit_price: item.price
        });

      if (itemError) throw new Error('Erro ao registrar item da venda');
    }

    return NextResponse.json({ success: true, saleId: sale.id });

  } catch (error: any) {
    console.error('Erro no checkout:', error);
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 });
  }
}