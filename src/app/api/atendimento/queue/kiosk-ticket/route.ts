import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { KioskCategory } from '@/types/queue';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { db: { schema: 'atendimento' } }
);

/** Mapa de categoria → prefixo da senha + ticket_type + is_priority */
const CATEGORY_CONFIG: Record<KioskCategory, {
  prefix: string;
  ticket_type: string;
  is_priority: boolean;
  label: string;
}> = {
  normal: { prefix: 'N', ticket_type: 'guiche', is_priority: false, label: 'NORMAL' },
  prioridade: { prefix: 'P', ticket_type: 'priority', is_priority: true, label: 'PRIORIDADE' },
  laboratorio: { prefix: 'L', ticket_type: 'laboratorio', is_priority: false, label: 'LABORATÓRIO' },
  laboratorio_prioridade: { prefix: 'LP', ticket_type: 'laboratorio', is_priority: true, label: 'LABORATÓRIO PRIORIDADE' },
};

const VALID_CATEGORIES: KioskCategory[] = ['normal', 'prioridade', 'laboratorio', 'laboratorio_prioridade'];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { category, patient_name } = body as { category: KioskCategory; patient_name?: string };

    if (!category || !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { error: `Categoria inválida. Use: ${VALID_CATEGORIES.join(', ')}` },
        { status: 400 }
      );
    }

    const config = CATEGORY_CONFIG[category];

    // Gerar próximo número via RPC
    const { data: ticketNumber, error: rpcError } = await supabase
      .rpc('next_ticket_number', { p_prefix: config.prefix });

    if (rpcError) {
      console.error('[Kiosk] Erro RPC next_ticket_number:', rpcError);
      return NextResponse.json(
        { error: 'Erro ao gerar número da senha' },
        { status: 500 }
      );
    }

    // Inserir ticket sem appointment_id
    const { data: ticket, error: insertError } = await supabase
      .from('queue_tickets')
      .insert({
        appointment_id: null,
        ticket_number: ticketNumber as string,
        ticket_type: config.ticket_type,
        queue_stage: 'reception',
        is_priority: config.is_priority,
        status: 'waiting',
        source_schema: 'atendimento',
        kiosk_category: category,
        patient_name: patient_name || null,
      })
      .select('id, ticket_number, created_at')
      .single();

    if (insertError) {
      console.error('[Kiosk] Erro ao inserir ticket:', insertError);
      return NextResponse.json(
        { error: 'Erro ao criar senha' },
        { status: 500 }
      );
    }

    // Calcular tempo médio de espera (tickets waiting na mesma categoria × ~5 min)
    const { count } = await supabase
      .from('queue_tickets')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'waiting')
      .eq('ticket_date', new Date().toISOString().split('T')[0])
      .neq('id', ticket.id);

    const estimatedWaitMinutes = Math.max(5, (count || 0) * 5);

    return NextResponse.json({
      ticket_number: ticket.ticket_number,
      category,
      label: config.label,
      created_at: ticket.created_at,
      estimated_wait_minutes: estimatedWaitMinutes,
    });
  } catch (error) {
    console.error('[Kiosk API] Erro:', error);
    return NextResponse.json(
      { error: 'Erro interno ao gerar senha' },
      { status: 500 }
    );
  }
}
