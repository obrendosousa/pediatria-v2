import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Usa a chave de serviço (Admin) para ignorar regras de RLS e garantir a exclusão
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    // Recebe o alvo: 'everyone' (WhatsApp + Sistema) ou 'system' (Só Sistema)
    const { messageId, wppId, target = 'system' } = await req.json();

    if (!messageId) {
      return NextResponse.json({ error: 'ID da mensagem não fornecido' }, { status: 400 });
    }

    let whatsappDeleted = false;

    // 1. Se for para apagar para TODOS, chama a Evolution API
    if (target === 'everyone' && wppId) {
      const baseUrl = process.env.EVOLUTION_API_URL?.replace(/\/$/, '');
      const instance = process.env.EVOLUTION_INSTANCE;
      const apiKey = process.env.EVOLUTION_API_KEY!;

      try {
        console.log(`[Delete API] Revogando mensagem ${wppId} no WhatsApp...`);
        const response = await fetch(`${baseUrl}/message/deleteMessageForEveryone/${instance}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'apikey': apiKey
          },
          body: JSON.stringify({ messageId: wppId })
        });

        if (response.ok) {
            whatsappDeleted = true;
        } else {
            console.error('[Delete API] Falha na Evolution (mas vamos apagar do banco):', await response.text());
        }
      } catch (err) {
        console.error('[Delete API] Erro de conexão Evolution:', err);
      }
    }

    // 2. Apagar do Banco de Dados (Supabase) - SEMPRE DELETA
    // Usamos o .delete() direto. Como estamos com a role de admin, nada impede.
    const { error } = await supabase
        .from('chat_messages')
        .delete()
        .eq('id', messageId);

    if (error) {
        console.error('[Delete API] Erro ao apagar do banco:', error);
        throw error;
    }

    return NextResponse.json({ success: true, whatsappDeleted });

  } catch (error: any) {
    console.error('[Delete API] Erro Geral:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}