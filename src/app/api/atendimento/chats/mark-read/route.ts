import { NextResponse } from 'next/server';
import { createSchemaAdminClient } from '@/lib/supabase/schemaServer';

const SCHEMA = 'atendimento';

export async function POST(req: Request) {
  const supabase = createSchemaAdminClient(SCHEMA);
  try {
    const body = await req.json().catch(() => ({}));
    const chatId = Number(body?.chatId);

    if (!Number.isFinite(chatId) || chatId <= 0) {
      return NextResponse.json({ error: 'chatId inválido' }, { status: 400 });
    }

    const { error } = await supabase.from('chats').update({ unread_count: 0 }).eq('id', chatId);
    if (error) {
      return NextResponse.json({ error: 'Falha ao marcar como lida' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
