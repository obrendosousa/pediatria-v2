import { NextResponse } from 'next/server';
import { evolutionRequest } from '@/lib/evolution';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ReactionBody {
  messageWppId?: string;
  remoteJid?: string;
  targetFromMe?: boolean;
  reaction?: string;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ReactionBody;
    const messageWppId = String(body?.messageWppId || '').trim();
    const remoteJid = String(body?.remoteJid || '').trim();
    const reaction = String(body?.reaction || '').trim();
    const targetFromMe = Boolean(body?.targetFromMe);

    if (!messageWppId || !remoteJid) {
      return NextResponse.json({ error: 'Parâmetros inválidos para reação' }, { status: 400 });
    }

    const { ok, status, data } = await evolutionRequest('/message/sendReaction/{instance}', {
      method: 'POST',
      body: {
        key: {
          remoteJid,
          fromMe: targetFromMe,
          id: messageWppId,
        },
        reaction,
      },
    });

    if (!ok) {
      return NextResponse.json(
        { error: 'Falha ao enviar reação para Evolution', details: data },
        { status: status || 502 }
      );
    }

    // Persistência local para refletir em realtime imediato no painel
    const { data: targetMessage } = await supabase
      .from('chat_messages')
      .select('id, chat_id')
      .eq('wpp_id', messageWppId)
      .maybeSingle();

    if (targetMessage?.chat_id && targetMessage?.id) {
      if (!reaction) {
        await supabase
          .from('message_reactions')
          .delete()
          .eq('target_wpp_id', messageWppId)
          .eq('from_me', true)
          .eq('sender_phone', '__me__');
      } else {
        await supabase
          .from('message_reactions')
          .upsert(
            {
              chat_id: targetMessage.chat_id,
              message_id: targetMessage.id,
              target_wpp_id: messageWppId,
              emoji: reaction,
              sender_phone: '__me__',
              sender_name: 'Você',
              from_me: true,
              created_at: new Date().toISOString(),
            },
            { onConflict: 'target_wpp_id,sender_phone,from_me' }
          );
      }
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[whatsapp/reaction] erro:', error);
    return NextResponse.json({ error: 'Erro interno ao reagir mensagem' }, { status: 500 });
  }
}
