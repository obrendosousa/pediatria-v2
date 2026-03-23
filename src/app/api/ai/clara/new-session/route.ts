import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const CLARA_CHAT_ID = 1495;

/**
 * POST /api/ai/clara/new-session
 * Limpa o histórico de conversa da Clara e insere mensagem de boas-vindas.
 * Chamado pelo comando /new no chat interno.
 */
export async function POST() {
  // 1. Deletar todo o histórico do chat da Clara
  const { error: deleteError } = await supabase
    .from('chat_messages')
    .delete()
    .eq('chat_id', CLARA_CHAT_ID);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  // 2. Inserir mensagem de boas-vindas da Clara
  const welcomeMessage = `✨ Nova sessão iniciada. Histórico anterior apagado.

Oi Brendo! 👋 Estou pronta para uma nova conversa. Pode perguntar qualquer coisa sobre a clínica — análises, relatórios, dados de atendimento, ou o que precisar.`;

  await supabase.from('chat_messages').insert({
    chat_id: CLARA_CHAT_ID,
    phone: '00000000000',
    sender: 'contact',
    message_text: welcomeMessage,
    message_type: 'text',
    status: 'read',
    created_at: new Date().toISOString(),
    wpp_id: `new_session_${Date.now()}`,
  });

  // 3. Atualizar o chat com a última mensagem
  await supabase.from('chats').update({
    last_message: welcomeMessage.slice(0, 100),
    last_interaction_at: new Date().toISOString(),
    unread_count: 1,
  }).eq('id', CLARA_CHAT_ID);

  return NextResponse.json({ success: true, message: 'Sessão reiniciada com sucesso.' });
}
