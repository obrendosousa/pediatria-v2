import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { fetchProfilePictureFromEvolution } from '@/ai/ingestion/services';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/whatsapp/profile-picture
 * Busca a foto de perfil do contato na Evolution API e atualiza o chat.
 * Body: { chatId: number } - ID do chat para atualizar
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { chatId } = body;

    if (!chatId) {
      return NextResponse.json({ error: 'chatId é obrigatório' }, { status: 400 });
    }

    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .select('id, phone')
      .eq('id', chatId)
      .single();

    if (chatError || !chat?.phone) {
      return NextResponse.json({ error: 'Chat não encontrado' }, { status: 404 });
    }

    const url = await fetchProfilePictureFromEvolution(chat.phone);
    if (!url) {
      return NextResponse.json({
        success: false,
        profile_pic: null,
        message: 'Contato sem foto ou Evolution API indisponível',
      });
    }

    await supabase.from('chats').update({ profile_pic: url }).eq('id', chatId);

    return NextResponse.json({ success: true, profile_pic: url });
  } catch (error) {
    console.error('[profile-picture] Erro:', error);
    return NextResponse.json({ error: 'Erro ao buscar foto de perfil' }, { status: 500 });
  }
}
