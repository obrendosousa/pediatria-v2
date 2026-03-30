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
    const { messageId, wppId, phone, newText } = body as {
      messageId?: number | string;
      wppId?: string;
      phone?: string;
      newText?: string;
    };

    if (!messageId || !phone || !newText?.trim()) {
      return NextResponse.json({ error: 'Dados incompletos (messageId, phone, newText)' }, { status: 400 });
    }

    try { getEvolutionConfig(EVOLUTION_INSTANCE_KEY); } catch {
      return NextResponse.json({ error: 'Evolution API (atendimento) não configurada' }, { status: 500 });
    }

    const cleanPhone = String(phone).replace(/\D/g, '');
    // Verificar se é grupo para usar group_jid como remoteJid
    const { data: chatRowForJid } = await supabase
      .from('chats')
      .select('is_group, group_jid')
      .eq('phone', cleanPhone)
      .maybeSingle();
    const remoteJid = (chatRowForJid?.is_group && chatRowForJid?.group_jid) ? chatRowForJid.group_jid : `${cleanPhone}@s.whatsapp.net`;
    const normalizedText = String(newText).trim();
    const normalizedWppId = typeof wppId === 'string' ? wppId.trim() : '';

    const { data: existing } = await supabase
      .from('chat_messages')
      .select('wpp_id, tool_data')
      .eq('id', messageId)
      .maybeSingle();

    const dbWppId = typeof existing?.wpp_id === 'string' ? existing.wpp_id.trim() : '';
    const effectiveWppId = normalizedWppId || dbWppId;
    let whatsappEdited = false;

    if (effectiveWppId) {
      const { ok, status, data } = await evoRequest('/chat/updateMessage/{instance}', {
        key: { id: effectiveWppId, remoteJid, fromMe: true },
        number: cleanPhone,
        text: normalizedText,
        newContent: normalizedText,
      });
      if (!ok) {
        return NextResponse.json({ error: 'Falha ao editar no WhatsApp', details: data }, { status: status || 502 });
      }
      whatsappEdited = true;
    }

    const prevToolData = existing?.tool_data && typeof existing.tool_data === 'object'
      ? (existing.tool_data as Record<string, unknown>) : {};

    await supabase.from('chat_messages')
      .update({
        message_text: normalizedText,
        is_edited: true,
        edited_at: new Date().toISOString(),
        tool_data: { ...prevToolData, is_edited: true, edited_at: new Date().toISOString() },
      })
      .eq('id', messageId);

    return NextResponse.json({ success: true, whatsappEdited });
  } catch (error) {
    console.error('[ATD/Edit] Erro:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
