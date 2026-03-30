import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireApprovedProfile } from '@/lib/auth/requireApprovedProfile';
import { logAuditServer } from '@/lib/auditServer';

type CheckoutItemPayload = {
  product_id?: number | null;
  qty: number;
  type: string;
  name: string;
  price: number;
};

type PaymentSplitPayload = {
  method: string;
  amount: number;
};

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { user } = await requireApprovedProfile(supabase, {
      allowedRoles: ['admin', 'secretary']
    });

    const body = await request.json().catch(() => ({}));

    const {
      appointment_id,
      medical_checkout_id,
      patient_id,
      chat_id,
      items,
      payment_method,
      payments,
      client_total
    } = body as {
      appointment_id?: number | null;
      medical_checkout_id?: number | null;
      patient_id?: number | null;
      chat_id?: number | null;
      items?: CheckoutItemPayload[];
      payment_method?: string;
      payments?: PaymentSplitPayload[];
      client_total?: number;
    };

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Carrinho vazio.' }, { status: 400 });
    }

    if (!payment_method && (!payments || payments.length === 0)) {
      return NextResponse.json(
        { error: 'Informe a forma de pagamento.' },
        { status: 400 }
      );
    }

    const rpcParams = {
      appointment_id: appointment_id ?? null,
      medical_checkout_id: medical_checkout_id ?? null,
      created_by: user.id,
      patient_id: patient_id ?? null,
      chat_id: chat_id ?? null,
      payment_method: payment_method ?? null,
      payments: payments ?? null,
      items: items.map((item) => ({
        product_id: item.product_id ?? null,
        qty: item.qty,
        type: item.type,
        name: item.name,
        price: item.price
      })),
      client_total: client_total ?? 0
    };

    const { data, error } = await supabase.rpc('process_secretary_checkout', {
      p_params: rpcParams
    });

    if (error) {
      const message = error.message || 'Erro ao processar checkout.';
      console.error('[checkout]', message);
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const result = data as {
      sale_id: number;
      server_total: number;
      consultation_amount: number;
      store_amount: number;
      tx_atendimento_id: number | null;
      tx_loja_id: number | null;
      idempotent: boolean;
    };

    if (!result.idempotent) {
      await logAuditServer({
        supabase,
        userId: user.id,
        action: 'create',
        entityType: 'checkout',
        entityId: String(result.sale_id),
        details: {
          appointment_id: appointment_id ?? null,
          medical_checkout_id: medical_checkout_id ?? null,
          server_total: result.server_total,
          consultation_amount: result.consultation_amount,
          store_amount: result.store_amount,
          payment_method: payment_method ?? 'mixed',
          items_count: items.length
        }
      });
    }

    return NextResponse.json({ success: true, result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao processar checkout.';
    console.error('[checkout]', error);
    const status =
      message === 'Usuário não autenticado.'
        ? 401
        : message === 'Acesso negado para perfil não aprovado.' ||
            message === 'Perfil sem permissão para esta ação.'
          ? 403
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
