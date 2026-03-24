import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Pool } from 'pg';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const CLARA_CHAT_ID = 1495;

/**
 * POST /api/ai/clara/new-session
 * Limpa o histórico de conversa da Clara E o estado do checkpointer LangGraph.
 * Chamado pelo comando /new no chat interno.
 */
export async function POST() {
  try {
    // 1. Deletar mensagens do chat da Clara
    await supabase
      .from('chat_messages')
      .delete()
      .eq('chat_id', CLARA_CHAT_ID);

    // 2. Limpar checkpointer do LangGraph (thread_id fixo)
    const threadId = `clara_chat_${CLARA_CHAT_ID}`;
    try {
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
      });

      // Deletar o estado do thread no checkpointer
      await pool.query(
        `DELETE FROM checkpoints WHERE thread_id = $1`,
        [threadId]
      );
      await pool.query(
        `DELETE FROM checkpoint_writes WHERE thread_id = $1`,
        [threadId]
      );

      await pool.end();
      console.log(`[/new] Checkpointer limpo para thread: ${threadId}`);
    } catch (err) {
      // Se não conseguir limpar o checkpointer, não é crítico
      console.warn('[/new] Falha ao limpar checkpointer:', (err as Error).message);
    }

    // 3. Inserir mensagem de boas-vindas
    const welcomeMessage = `✨ Nova sessão iniciada. Histórico e memória de conversa resetados.

Oi Brendo! 👋 Estou pronta para começar do zero. Pode perguntar qualquer coisa sobre a clínica.`;

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

    await supabase.from('chats').update({
      last_message: welcomeMessage.slice(0, 100),
      last_interaction_at: new Date().toISOString(),
      unread_count: 1,
    }).eq('id', CLARA_CHAT_ID);

    return NextResponse.json({ success: true, message: 'Sessão reiniciada com sucesso.' });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
