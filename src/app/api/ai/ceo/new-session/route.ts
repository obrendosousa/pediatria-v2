import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const CEO_THREAD_ID = 'ceo_chat_global';

/**
 * POST /api/ai/ceo/new-session
 * Limpa o estado do checkpointer LangGraph para o CEO Agent.
 * Nao limpa chat_messages (CEO nao usa chat WhatsApp).
 */
export async function POST() {
  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });

    await pool.query(`DELETE FROM checkpoints WHERE thread_id = $1`, [CEO_THREAD_ID]);
    await pool.query(`DELETE FROM checkpoint_writes WHERE thread_id = $1`, [CEO_THREAD_ID]);
    await pool.end();

    return NextResponse.json({ success: true, message: 'CEO Agent session reset.' });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
