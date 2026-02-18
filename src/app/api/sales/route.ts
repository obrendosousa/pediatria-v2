import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  normalizeFinancialOrigin,
  normalizePaymentSplits,
  resolveSalePaymentMethodFromSplits,
  type PaymentSplitInput
} from '@/lib/finance';
import { createFinancialTransaction } from '@/lib/financialTransactions';
import { requireApprovedProfile } from '@/lib/auth/requireApprovedProfile';
import { logAuditServer } from '@/lib/auditServer';

type SaleItemPayload = {
  id: number;
  qty: number;
  price: number;
  name?: string;
};

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { user } = await requireApprovedProfile(supabase, {
      allowedRoles: ['admin', 'secretary']
    });
    const body = await request.json();
    const {
      chat_id,
      patient_id,
      appointment_id,
      items,
      payment_method,
      payments,
      origin = 'loja'
    } = body as {
      chat_id?: number | null;
      patient_id?: number | null;
      appointment_id?: number | null;
      items: SaleItemPayload[];
      payment_method?: string;
      payments?: PaymentSplitInput[];
      origin?: 'atendimento' | 'consulta' | 'retorno' | 'pendencia' | 'loja';
    };
    const normalizedOrigin = normalizeFinancialOrigin(origin);

    // items espera o formato: [{ id: 1, qty: 2, price: 10.50, name: 'Dipirona' }]
    
    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Carrinho vazio' }, { status: 400 });
    }

    const productIds = [...new Set(items.map((item) => item.id))];
    const { data: dbProducts, error: productsError } = await supabase
      .from('products')
      .select('id, name, price_sale, active')
      .in('id', productIds);

    if (productsError) {
      throw new Error('Erro ao validar produtos da venda.');
    }

    const productMap = new Map((dbProducts || []).map((product) => [product.id, product]));
    const normalizedItems = items.map((item) => {
      if (!Number.isFinite(item.qty) || item.qty <= 0 || !Number.isInteger(item.qty)) {
        throw new Error(`Quantidade inválida para o produto ID ${item.id}.`);
      }
      const dbProduct = productMap.get(item.id);
      if (!dbProduct || dbProduct.active !== true) {
        throw new Error(`Produto ID ${item.id} não está disponível para venda.`);
      }
      return {
        ...item,
        price: Number(dbProduct.price_sale || 0),
        name: item.name || dbProduct.name || `Produto ${item.id}`
      };
    });

    // 1. Calcular Total da Venda usando preço canônico do backend
    const total = normalizedItems.reduce((acc: number, item) => acc + (item.price * item.qty), 0);
    const paymentSplits = normalizePaymentSplits(total, payment_method, payments);
    const salePaymentMethod = resolveSalePaymentMethodFromSplits(paymentSplits);

    // 1.5. Pré-validar Estoque de Todos os Itens (Evita falha no meio do processo)
    for (const item of normalizedItems) {
      const { data: batches, error: batchError } = await supabase
        .from('product_batches')
        .select('quantity')
        .eq('product_id', item.id)
        .gt('quantity', 0);

      if (batchError) throw new Error(`Erro ao verificar estoque do produto ${item.id}`);

      const totalAvailable = batches?.reduce((acc, b) => acc + b.quantity, 0) || 0;
      if (totalAvailable < item.qty) {
        throw new Error(`Estoque insuficiente para o produto ID ${item.id}. Disponível: ${totalAvailable}`);
      }
    }

    // 2. Criar o Registro da Venda (Cabeçalho)
    const salePayload: Record<string, unknown> = {
      chat_id: chat_id ?? null,
      total: total,
      payment_method: salePaymentMethod,
      status: 'completed',
      created_by: user?.id ?? null,
      origin: normalizedOrigin,
      appointment_id: appointment_id ?? null
    };
    if (patient_id != null) {
      salePayload.patient_id = patient_id;
    }
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert(salePayload)
      .select()
      .single();

    if (saleError || !sale) {
      throw new Error(`Erro ao criar venda: ${saleError?.message}`);
    }

    await createFinancialTransaction(supabase, {
      amount: total,
      origin: normalizedOrigin,
      createdBy: user?.id ?? null,
      appointmentId: appointment_id ?? null,
      saleId: sale.id,
      payments: paymentSplits
    });

    // 3. Processar Itens e Baixar Estoque (Lógica FEFO)
    const stockMovements: Array<{
      product_id: number;
      movement_type: 'sale_out';
      quantity_change: number;
      reason: string;
      reference_type: 'sale';
      reference_id: string;
      metadata: Record<string, unknown>;
      created_by: string;
    }> = [];

    for (const item of normalizedItems) {
      let quantityNeeded = item.qty;

      // A. Busca lotes com saldo, ordenados por validade (ASC)
      const { data: batches, error: batchError } = await supabase
        .from('product_batches')
        .select('*')
        .eq('product_id', item.id)
        .gt('quantity', 0)
        .order('expiration_date', { ascending: true });

      if (batchError) throw new Error(`Erro ao buscar lotes do produto ${item.id}`);
      
      // (Validação já feita acima, mas mantemos o fluxo de consumo)

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

          stockMovements.push({
            product_id: item.id,
            movement_type: 'sale_out',
            quantity_change: -take,
            reason: 'Baixa de estoque por venda finalizada',
            reference_type: 'sale',
            reference_id: String(sale.id),
            metadata: {
              sale_id: sale.id,
              batch_id: batch.id,
              unit_price: item.price
            },
            created_by: user.id
          });
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

      const { data: remainingBatches, error: remainingError } = await supabase
        .from('product_batches')
        .select('quantity')
        .eq('product_id', item.id)
        .gt('quantity', 0);

      if (remainingError) {
        throw new Error(`Erro ao sincronizar estoque do produto ${item.id}.`);
      }

      const syncedStock = (remainingBatches || []).reduce((acc, batch) => acc + Number(batch.quantity || 0), 0);
      const { error: productSyncError } = await supabase
        .from('products')
        .update({ stock: syncedStock })
        .eq('id', item.id);

      if (productSyncError) {
        throw new Error(`Erro ao sincronizar estoque no produto ${item.id}.`);
      }
    }

    if (stockMovements.length > 0) {
      const { error: stockLogError } = await supabase.from('stock_movements').insert(stockMovements);
      if (stockLogError) {
        console.warn('[sales][stock_movements]', stockLogError.message);
      }
    }

    await logAuditServer({
      supabase,
      userId: user.id,
      action: 'create',
      entityType: 'sale',
      entityId: String(sale.id),
      details: {
        total,
        patient_id: patient_id ?? null,
        appointment_id: appointment_id ?? null,
        payment_method: salePaymentMethod,
        payments: paymentSplits,
        items: normalizedItems.map((item) => ({
          id: item.id,
          qty: item.qty,
          price: item.price
        }))
      }
    });

    return NextResponse.json({ success: true, saleId: sale.id });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro interno';
    console.error('Erro no checkout:', error);
    const status =
      message === 'Usuário não autenticado.'
        ? 401
        : message === 'Acesso negado para perfil não aprovado.' || message === 'Perfil sem permissão para esta ação.'
          ? 403
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}