import { NextResponse } from "next/server";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Pool } = require("pg");

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return NextResponse.json({ error: "DATABASE_URL not configured" }, { status: 500 });
  }

  const pool = new Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });

  try {
    const client = await pool.connect();

    const queries = [
      `ALTER TABLE atendimento.chat_messages ADD COLUMN IF NOT EXISTS quoted_wpp_id TEXT`,
      `ALTER TABLE atendimento.chat_messages ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT false`,
      `ALTER TABLE atendimento.chat_messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ`,
      `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='atendimento' AND indexname='idx_atd_chat_messages_wpp_id') THEN
          CREATE UNIQUE INDEX idx_atd_chat_messages_wpp_id ON atendimento.chat_messages (wpp_id) WHERE wpp_id IS NOT NULL;
        END IF;
      END $$`,
      `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='atendimento' AND indexname='idx_atd_chats_phone_unique') THEN
          CREATE UNIQUE INDEX idx_atd_chats_phone_unique ON atendimento.chats (phone) WHERE phone IS NOT NULL AND phone != '';
        END IF;
      END $$`,
      `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_pub_chats_phone_unique') THEN
          CREATE UNIQUE INDEX idx_pub_chats_phone_unique ON public.chats (phone) WHERE phone IS NOT NULL AND phone != '';
        END IF;
      END $$`,
      `NOTIFY pgrst, 'reload schema'`,
    ];

    const results = [];
    for (const sql of queries) {
      try {
        await client.query(sql);
        results.push({ sql: sql.substring(0, 80), status: "ok" });
      } catch (e: unknown) {
        results.push({ sql: sql.substring(0, 80), status: "error", error: (e as Error).message });
      }
    }

    client.release();
    await pool.end();

    return NextResponse.json({ success: true, results });
  } catch (e: unknown) {
    await pool.end().catch(() => {});
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
