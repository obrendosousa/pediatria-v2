import { NextResponse } from 'next/server';
import { createSchemaAdminClient } from '@/lib/supabase/schemaServer';
import { getEvolutionConfig, buildEvolutionEndpoint } from '@/lib/evolution';

const SCHEMA = 'atendimento';
const EVOLUTION_INSTANCE_KEY = 'EVOLUTION_ATENDIMENTO_INSTANCE';

function evoRequest(pathTemplate: string, body: unknown) {
  const cfg = getEvolutionConfig(EVOLUTION_INSTANCE_KEY);
  const endpoint = buildEvolutionEndpoint(pathTemplate, cfg);
  return fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: cfg.apiKey },
    body: JSON.stringify(body),
  }).then(async (res) => {
    const ct = res.headers.get('content-type') ?? '';
    const data = ct.includes('json') ? await res.json().catch(() => ({})) : await res.text().catch(() => '');
    return { ok: res.ok, status: res.status, data };
  });
}

export async function POST(req: Request) {
  const supabase = createSchemaAdminClient(SCHEMA);
  try {
    const body = await req.json();
    const messageWppId = String(body?.messageWppId || '').trim();
    const remoteJid = String(body?.remoteJid || '').trim();
    const reaction = String(body?.reaction || '').trim();
    const targetFromMe = Boolean(body?.targetFromMe);

    if (!messageWppId || !remoteJid) {
      return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 });
    }

    const { ok, status, data } = await evoRequest('/message/sendReaction/{instance}', {
      key: { remoteJid, fromMe: targetFromMe, id: messageWppId },
      reaction,
    });

    if (!ok) {
      return NextResponse.json({ error: 'Falha ao enviar reação', details: data }, { status: status || 502 });
    }

    const { data: targetMessage } = await supabase
      .from('chat_messages')
      .select('id, chat_id')
      .eq('wpp_id', messageWppId)
      .maybeSingle();

    if (targetMessage?.chat_id && targetMessage?.id) {
      if (!reaction) {
        await supabase.from('message_reactions').delete()
          .eq('target_wpp_id', messageWppId)
          .eq('from_me', true)
          .eq('sender_phone', '__me__');
      } else {
        await supabase.from('message_reactions').upsert({
          chat_id: targetMessage.chat_id,
          message_id: targetMessage.id,
          target_wpp_id: messageWppId,
          emoji: reaction,
          sender_phone: '__me__',
          sender_name: 'Você',
          from_me: true,
          created_at: new Date().toISOString(),
        }, { onConflict: 'target_wpp_id,sender_phone,from_me' });
      }
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[ATD/Reaction] Erro:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
