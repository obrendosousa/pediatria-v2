import { NextResponse } from 'next/server';
import { createSchemaAdminClient } from '@/lib/supabase/schemaServer';
import { Pool } from 'pg';

/**
 * POST /api/ai/clinica-geral/new-session
 * Limpa o histórico de conversa do Agente Clínica E o estado do checkpointer LangGraph.
 * Chamado pelo comando /new no chat interno do módulo atendimento.
 */
export async function POST() {
  try {
    const supabase = createSchemaAdminClient('atendimento');

    // Busca o chat do agente pelo magic phone
    const { data: agentChat } = await supabase
      .from('chats')
      .select('id')
      .eq('phone', '00000000001')
      .maybeSingle();

    const chatId = (agentChat as { id: number } | null)?.id;
    if (!chatId) {
      return NextResponse.json({ success: true, message: 'Chat do agente não encontrado. Nada a limpar.' });
    }

    // 1. Deletar mensagens do chat do agente
    await supabase
      .from('chat_messages')
      .delete()
      .eq('chat_id', chatId);

    // 2. Limpar checkpointer do LangGraph (thread_id fixo)
    const threadId = `clinica_geral_chat_${chatId}`;
    try {
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
      });

      await pool.query(
        `DELETE FROM checkpoints WHERE thread_id = $1`,
        [threadId]
      );
      await pool.query(
        `DELETE FROM checkpoint_writes WHERE thread_id = $1`,
        [threadId]
      );

      await pool.end();
    } catch (err) {
      console.warn('[clinica-geral/new] Falha ao limpar checkpointer:', (err as Error).message);
    }

    // 3. Inserir mensagem de boas-vindas
    const welcomeMessage = `Nova sessão iniciada. Histórico e memória de conversa resetados.

Oi Brendo! Sou o Agente Clínica, pronto para começar do zero. Pode perguntar qualquer coisa sobre a clínica geral.`;

    await supabase.from('chat_messages').insert({
      chat_id: chatId,
      phone: '00000000001',
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
    }).eq('id', chatId);

    return NextResponse.json({ success: true, message: 'Sessão reiniciada com sucesso.' });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
