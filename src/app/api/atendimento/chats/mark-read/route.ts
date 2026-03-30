import { NextResponse } from 'next/server';
import { createSchemaAdminClient } from '@/lib/supabase/schemaServer';
import { markMessagesAsRead } from '@/lib/evolution';

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

    // Fire-and-forget: marcar como lida no WhatsApp via Evolution API
    (async () => {
      try {
        const { data: chat } = await supabase
          .from('chats')
          .select('phone, is_group, group_jid')
          .eq('id', chatId)
          .single();
        if (!chat?.phone) return;

        const { data: msgs } = await supabase
          .from('chat_messages')
          .select('wpp_id')
          .eq('chat_id', chatId)
          .eq('sender', 'CUSTOMER')
          .not('wpp_id', 'is', null)
          .order('created_at', { ascending: false })
          .limit(20);
        if (!msgs?.length) return;

        const wppIds = msgs.map((m: { wpp_id: string }) => m.wpp_id);
        const groupJid = chat.is_group ? chat.group_jid : undefined;
        await markMessagesAsRead(chat.phone, wppIds, 'EVOLUTION_ATENDIMENTO_INSTANCE', groupJid);
      } catch (err: unknown) {
        console.error('[atd/mark-read] erro WhatsApp:', err);
      }
    })();

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
