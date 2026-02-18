import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { evolutionRequest, getEvolutionConfig } from '@/lib/evolution';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === 'object') {
    const candidate = error as Record<string, unknown>;
    const msg = candidate.message || candidate.error_description || candidate.details || candidate.hint;
    if (typeof msg === 'string' && msg.trim()) return msg.trim();
    try {
      const raw = JSON.stringify(candidate);
      if (raw && raw !== '{}' && raw !== 'null') return raw;
    } catch {
      // ignore
    }
  }
  if (typeof error === 'string' && error.trim()) return error.trim();
  return 'Erro desconhecido';
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messageId, wppId, phone, newText } = body as {
      messageId?: number | string;
      wppId?: string;
      phone?: string;
      newText?: string;
    };

    if (!messageId || !phone || !newText?.trim()) {
      return NextResponse.json(
        { error: 'Dados incompletos para editar mensagem (messageId, phone, newText)' },
        { status: 400 }
      );
    }

    try {
      getEvolutionConfig();
    } catch {
      return NextResponse.json({ error: 'Evolution API não configurada' }, { status: 500 });
    }

    const cleanPhone = String(phone).replace(/\D/g, '');
    const remoteJid = `${cleanPhone}@s.whatsapp.net`;
    const normalizedText = String(newText).trim();
    const normalizedWppId = typeof wppId === 'string' ? wppId.trim() : '';

    const { data: existing, error: fetchErr } = await supabase
      .from('chat_messages')
      .select('wpp_id, tool_data')
      .eq('id', messageId)
      .maybeSingle();

    if (fetchErr) {
      console.error('[Edit API] Erro ao carregar mensagem:', fetchErr);
    }

    const dbWppId = typeof existing?.wpp_id === 'string' ? existing.wpp_id.trim() : '';
    const effectiveWppId = normalizedWppId || dbWppId;
    let whatsappEdited = false;
    let skippedNoWppId = false;

    if (effectiveWppId) {
      const evoPayload = {
        key: {
          id: effectiveWppId,
          remoteJid,
          fromMe: true,
        },
        number: cleanPhone,
        text: normalizedText,
        newContent: normalizedText,
      };

      const { ok, status, data } = await evolutionRequest('/chat/updateMessage/{instance}', {
        method: 'POST',
        body: evoPayload,
      });

      if (!ok) {
        console.error('[Edit API] Falha Evolution:', data);
        return NextResponse.json(
          { error: 'Falha ao editar mensagem no WhatsApp', details: data },
          { status: status || 502 }
        );
      }
      whatsappEdited = true;
    } else {
      // Sem wpp_id, não há como editar no WhatsApp; mantém consistência no banco/UI.
      skippedNoWppId = true;
    }

    const prevToolData =
      existing?.tool_data && typeof existing.tool_data === 'object'
        ? (existing.tool_data as Record<string, unknown>)
        : {};

    const mergedToolData = {
      ...prevToolData,
      is_edited: true,
      edited_at: new Date().toISOString(),
    };

    const updatePayloads: Array<Record<string, unknown>> = [
      {
        message_text: normalizedText,
        is_edited: true,
        edited_at: mergedToolData.edited_at,
        tool_data: mergedToolData,
      },
      {
        message_text: normalizedText,
        tool_data: mergedToolData,
      },
      {
        message_text: normalizedText,
      },
    ];

    let updated = false;
    let lastError: unknown = null;

    for (const payload of updatePayloads) {
      const byId = await supabase
        .from('chat_messages')
        .update(payload)
        .eq('id', messageId)
        .select('id')
        .maybeSingle();

      if (!byId.error && byId.data?.id) {
        updated = true;
        break;
      }

      let byWppId = { data: null as { id?: number | string } | null, error: null as unknown };
      if (effectiveWppId) {
        byWppId = await supabase
          .from('chat_messages')
          .update(payload)
          .eq('wpp_id', effectiveWppId)
          .select('id')
          .maybeSingle();
      }

      if (!byWppId.error && byWppId.data?.id) {
        updated = true;
        break;
      }

      lastError = byWppId.error || byId.error || lastError;
    }

    if (!updated) {
      const details = getErrorMessage(lastError);
      console.error('[Edit API] Erro ao atualizar banco:', details, lastError);
      return NextResponse.json(
        { error: 'Falha ao atualizar mensagem no banco', details },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      whatsappEdited,
      skippedNoWppId,
    });
  } catch (error) {
    console.error('[Edit API] Erro geral:', error);
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}
