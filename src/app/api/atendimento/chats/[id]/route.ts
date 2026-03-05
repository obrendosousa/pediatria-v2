import { NextResponse } from 'next/server';
import { createSchemaAdminClient } from '@/lib/supabase/schemaServer';

const SCHEMA = 'atendimento';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createSchemaAdminClient(SCHEMA);
  const { id } = await params;
  const chatId = Number(id);

  if (!Number.isFinite(chatId) || chatId <= 0) {
    return NextResponse.json({ error: 'id inválido' }, { status: 400 });
  }

  const { data, error } = await supabase.from('chats').select('*').eq('id', chatId).single();

  if (error || !data) {
    return NextResponse.json({ error: 'chat não encontrado' }, { status: 404 });
  }

  return NextResponse.json(data);
}
