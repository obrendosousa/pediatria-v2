import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { orchestrateDelete } from '@/ai/message-orchestration/state';
import { evolutionRequest, getEvolutionConfig } from '@/lib/evolution';

// Usa a chave de serviço (Admin) para ignorar regras de RLS e garantir a exclusão
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
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

    // 1. Se for para apagar para TODOS e temos wpp_id, chama a Evolution API
    // Evolution API v2: DELETE /chat/deleteMessageForEveryone/{instance}
    // Body: { id, remoteJid, fromMe } - ver doc.evolution-api.com
    // wpp_id é obrigatório: sem ele não conseguimos apagar no WhatsApp
    if (orchestration.shouldCallEvolution) {
      const rawPhone = phone || '';

      let configError = false;
      try {
        getEvolutionConfig();
      } catch {
        configError = true;
      }

      if (configError) {
        console.error('[Delete API] Evolution não configurada (EVOLUTION_API_URL, EVOLUTION_INSTANCE, EVOLUTION_API_KEY)');
      } else if (!rawPhone) {
        console.error('[Delete API] telefone ausente - necessário para remoteJid');
      } else {
        try {
          const cleanPhone = rawPhone.replace(/\D/g, '');
          const remoteJid = `${cleanPhone}@s.whatsapp.net`;
          console.log(`[Delete API] Revogando mensagem ${wppId} no WhatsApp (remoteJid: ${remoteJid})...`);
          const response = await evolutionRequest('/chat/deleteMessageForEveryone/{instance}', {
            method: 'DELETE',
            body: {
              id: wppId,
              remoteJid,
              fromMe: true,
            },
          });

          if (response.ok) {
            whatsappDeleted = true;
          } else {
            console.error('[Delete API] Falha na Evolution (mas vamos apagar do banco):', response.data);
          }
        } catch (err) {
          console.error('[Delete API] Erro de conexão Evolution:', err);
        }
      }
    }

    // 2. Banco de Dados: orquestração define se marca revoked ou só deleta
    // deleteForEveryone: UPDATE in-place para revoked (idempotente, evita duplicatas)
    // deleteForMe: só DELETE
    if (orchestration.shouldUpdateToRevoked) {
      const { data: original, error: fetchErr } = await supabase
        .from('chat_messages')
        .select('id, message_type')
        .eq('id', messageId)
        .maybeSingle();

      if (fetchErr) {
        console.error('[Delete API] Erro ao buscar mensagem:', fetchErr);
        throw fetchErr;
      }
      // Idempotência: se já não existe, não precisa falhar
      if (!original) {
        return NextResponse.json({
          success: true,
          whatsappDeleted,
          skippedNoWppId: orchestration.skippedNoWppId,
          alreadyDeleted: true,
        });
      }

      // Idempotência: já está revogada, então não faz nada.
      if (original.message_type !== 'revoked') {
        const { error: updErr } = await supabase
          .from('chat_messages')
          .update({
            message_text: '',
            message_type: 'revoked',
            media_url: null,
          })
          .eq('id', original.id);

        if (updErr) {
          console.error('[Delete API] Erro ao marcar como revogada:', updErr);
          throw updErr;
        }
      }
    } else if (orchestration.shouldDeleteFromDb) {
      const { error } = await supabase.from('chat_messages').delete().eq('id', messageId);
      if (error) {
        console.error('[Delete API] Erro ao apagar do banco:', error);
        throw error;
      }
    }

    return NextResponse.json({
      success: true,
      whatsappDeleted,
      skippedNoWppId: orchestration.skippedNoWppId,
    });

  } catch (error: any) {
    console.error('[Delete API] Erro Geral:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}