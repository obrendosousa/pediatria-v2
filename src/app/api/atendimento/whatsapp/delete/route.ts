import { NextResponse } from 'next/server';
import { createSchemaAdminClient } from '@/lib/supabase/schemaServer';
import { orchestrateDelete } from '@/ai/message-orchestration/state';
import { getEvolutionConfig, buildEvolutionEndpoint } from '@/lib/evolution';

const SCHEMA = 'atendimento';
const EVOLUTION_INSTANCE_KEY = 'EVOLUTION_ATENDIMENTO_INSTANCE';

export async function POST(req: Request) {
  const supabase = createSchemaAdminClient(SCHEMA);
  try {
    const body = await req.json();
    const { messageId, wppId, target = 'system', phone } = body;

    if (!messageId) {
      return NextResponse.json({ error: 'ID da mensagem não fornecido' }, { status: 400 });
    }

    const orchestration = orchestrateDelete({
      messageId,
      wppId: wppId ?? null,
      target: target as 'everyone' | 'system',
      phone: phone || '',
    });

    let whatsappDeleted = false;

    if (orchestration.shouldCallEvolution) {
      try {
        const cfg = getEvolutionConfig(EVOLUTION_INSTANCE_KEY);
        const cleanPhone = String(phone || '').replace(/\D/g, '');
        if (cleanPhone) {
          const endpoint = buildEvolutionEndpoint('/chat/deleteMessageForEveryone/{instance}', cfg);
          const res = await fetch(endpoint, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', apikey: cfg.apiKey },
            body: JSON.stringify({ id: wppId, remoteJid: `${cleanPhone}@s.whatsapp.net`, fromMe: true }),
          });
          if (res.ok) whatsappDeleted = true;
        }
      } catch (err) {
        console.error('[ATD/Delete] Erro Evolution:', err);
      }
    }

    if (orchestration.shouldUpdateToRevoked) {
      const { data: original } = await supabase
        .from('chat_messages').select('id, message_type').eq('id', messageId).maybeSingle();

      if (!original) {
        return NextResponse.json({ success: true, whatsappDeleted, alreadyDeleted: true });
      }
      if (original.message_type !== 'revoked') {
        await supabase.from('chat_messages')
          .update({ message_text: '', message_type: 'revoked', media_url: null })
          .eq('id', original.id);
      }
    } else if (orchestration.shouldDeleteFromDb) {
      await supabase.from('chat_messages').delete().eq('id', messageId);
    }

    return NextResponse.json({
      success: true,
      whatsappDeleted,
      skippedNoWppId: orchestration.skippedNoWppId,
    });
  } catch (error: any) {
    console.error('[ATD/Delete] Erro:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
