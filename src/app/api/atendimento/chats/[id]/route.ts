import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createSchemaAdminClient } from '@/lib/supabase/schemaServer';
import { requireApprovedProfile } from '@/lib/auth/requireApprovedProfile';

const SCHEMA = 'atendimento';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    await requireApprovedProfile(supabase, {
      allowedRoles: ['admin', 'secretary'],
    });

    const schemaClient = createSchemaAdminClient(SCHEMA);
    const { id } = await params;
    const chatId = Number(id);

    if (!Number.isFinite(chatId) || chatId <= 0) {
      return NextResponse.json({ error: 'id inválido' }, { status: 400 });
    }

    const { data, error } = await schemaClient.from('chats').select('*').eq('id', chatId).single();

    if (error || !data) {
      return NextResponse.json({ error: 'chat não encontrado' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao buscar chat.';
    const status =
      message === 'Usuário não autenticado.'
        ? 401
        : message === 'Acesso negado para perfil não aprovado.' || message === 'Perfil sem permissão para esta ação.'
          ? 403
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
