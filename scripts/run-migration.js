// Temporary script to run clara_v2_foundation migration
// Delete after use

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.juctfolupehtaoehjkwl:SLZ%402015%40eli@aws-1-sa-east-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false },
});

async function addColIfMissing(client, table, col, def) {
  const check = await client.query(
    `SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name=$2`,
    [table, col]
  );
  if (check.rows.length === 0) {
    await client.query(`ALTER TABLE public.${table} ADD COLUMN ${col} ${def}`);
    return true;
  }
  return false;
}

(async () => {
  const client = await pool.connect();
  try {
    // 1. clara_tasks
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.clara_tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        subject TEXT NOT NULL,
        description TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        parent_task_id UUID REFERENCES public.clara_tasks(id) ON DELETE SET NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
        blocked_by UUID[] DEFAULT '{}',
        blocks UUID[] DEFAULT '{}',
        input_params JSONB,
        output_data JSONB,
        output_schema TEXT,
        error_message TEXT,
        token_usage INTEGER DEFAULT 0,
        execution_time_ms INTEGER,
        model_used TEXT,
        max_retries INTEGER DEFAULT 2,
        retry_count INTEGER DEFAULT 0,
        timeout_ms INTEGER DEFAULT 120000,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        started_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ
      )
    `);
    console.log('1/8 clara_tasks created');

    await client.query('CREATE INDEX IF NOT EXISTS idx_clara_tasks_status ON public.clara_tasks(status)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_clara_tasks_agent ON public.clara_tasks(agent_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_clara_tasks_parent ON public.clara_tasks(parent_task_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_clara_tasks_created ON public.clara_tasks(created_at DESC)');
    await client.query('ALTER TABLE public.clara_tasks ENABLE ROW LEVEL SECURITY');
    await client.query('DROP POLICY IF EXISTS "Service role full access on clara_tasks" ON public.clara_tasks');
    await client.query('CREATE POLICY "Service role full access on clara_tasks" ON public.clara_tasks FOR ALL USING (true) WITH CHECK (true)');
    console.log('2/8 clara_tasks indexes + RLS');

    // 2. clara_agent_messages
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.clara_agent_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        from_agent TEXT NOT NULL,
        to_agent TEXT NOT NULL,
        task_id UUID REFERENCES public.clara_tasks(id) ON DELETE SET NULL,
        message_type TEXT NOT NULL CHECK (message_type IN ('directive', 'result', 'error', 'status_update')),
        content JSONB NOT NULL,
        read_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('3/8 clara_agent_messages created');

    await client.query('CREATE INDEX IF NOT EXISTS idx_agent_messages_to ON public.clara_agent_messages(to_agent, read_at)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_agent_messages_task ON public.clara_agent_messages(task_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_agent_messages_created ON public.clara_agent_messages(created_at DESC)');
    await client.query('ALTER TABLE public.clara_agent_messages ENABLE ROW LEVEL SECURITY');
    await client.query('DROP POLICY IF EXISTS "Service role full access on clara_agent_messages" ON public.clara_agent_messages');
    await client.query('CREATE POLICY "Service role full access on clara_agent_messages" ON public.clara_agent_messages FOR ALL USING (true) WITH CHECK (true)');
    console.log('4/8 clara_agent_messages indexes + RLS');

    // 3. clara_dream_state
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.clara_dream_state (
        id TEXT PRIMARY KEY,
        last_consolidated_at TIMESTAMPTZ,
        lock_acquired_at TIMESTAMPTZ,
        lock_acquired_by TEXT,
        session_count INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('5/8 clara_dream_state created');

    await client.query('ALTER TABLE public.clara_dream_state ENABLE ROW LEVEL SECURITY');
    await client.query('DROP POLICY IF EXISTS "Service role full access on clara_dream_state" ON public.clara_dream_state');
    await client.query('CREATE POLICY "Service role full access on clara_dream_state" ON public.clara_dream_state FOR ALL USING (true) WITH CHECK (true)');
    console.log('6/8 clara_dream_state RLS');

    // 4. ALTER clara_reports
    await addColIfMissing(client, 'clara_reports', 'agent_id', "TEXT DEFAULT 'ceo_agent'");
    await addColIfMissing(client, 'clara_reports', 'report_type', "TEXT DEFAULT 'on_demand'");
    await addColIfMissing(client, 'clara_reports', 'structured_data', 'JSONB');
    await addColIfMissing(client, 'clara_reports', 'period_start', 'DATE');
    await addColIfMissing(client, 'clara_reports', 'period_end', 'DATE');
    await addColIfMissing(client, 'clara_reports', 'confidence_score', 'REAL');
    await addColIfMissing(client, 'clara_reports', 'data_sources', 'TEXT[]');
    await addColIfMissing(client, 'clara_reports', 'execution_time_ms', 'INTEGER');
    await client.query('CREATE INDEX IF NOT EXISTS idx_clara_reports_agent_type ON public.clara_reports(agent_id, report_type)');
    console.log('7/8 clara_reports altered');

    // 5. ALTER clara_memories
    await addColIfMissing(client, 'clara_memories', 'agent_id', "TEXT DEFAULT 'ceo_agent'");
    await client.query('CREATE INDEX IF NOT EXISTS idx_clara_memories_agent ON public.clara_memories(agent_id)');
    console.log('8/8 clara_memories altered');

    // VERIFY
    console.log('\n=== VERIFICATION ===');
    const tables = await client.query("SELECT tablename FROM pg_tables WHERE tablename LIKE 'clara_%' AND schemaname = 'public' ORDER BY tablename");
    console.log('Clara tables:', tables.rows.map(r => r.tablename));

    const taskCols = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'clara_tasks' AND table_schema = 'public' ORDER BY ordinal_position");
    console.log(`clara_tasks (${taskCols.rows.length} cols):`, taskCols.rows.map(r => r.column_name).join(', '));

    const msgCols = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'clara_agent_messages' AND table_schema = 'public'");
    console.log(`clara_agent_messages (${msgCols.rows.length} cols):`, msgCols.rows.map(r => r.column_name).join(', '));

    const dreamCols = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'clara_dream_state' AND table_schema = 'public'");
    console.log(`clara_dream_state (${dreamCols.rows.length} cols):`, dreamCols.rows.map(r => r.column_name).join(', '));

    // Test insert + delete
    const testTask = await client.query("INSERT INTO clara_tasks (subject, description, agent_id) VALUES ('test', 'test migration', 'ceo_agent') RETURNING id");
    await client.query('DELETE FROM clara_tasks WHERE id = $1', [testTask.rows[0].id]);
    console.log('\nInsert/delete test: PASSED');

    console.log('\n✅ Migration complete!');

  } catch (err) {
    console.error('Migration FAILED:', err.message);
    if (err.detail) console.error('Detail:', err.detail);
  } finally {
    client.release();
    await pool.end();
  }
})();
