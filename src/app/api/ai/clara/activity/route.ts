import { NextResponse } from 'next/server';
import { getCronStatuses, ensureHydrated } from '@/lib/claraActivityStore';
import { getSupabaseAdminClient } from '@/lib/automation/adapters/supabaseAdmin';
import fs from 'node:fs/promises';
import path from 'node:path';

const VAULT_DIR = path.join(process.cwd(), 'clinica-vault');

async function getMemoryStats() {
  try {
    const indexFile = path.join(VAULT_DIR, '.memory-index.json');
    const raw = await fs.readFile(indexFile, 'utf-8');
    const idx = JSON.parse(raw);
    const entries: Array<{ quality_score: number; memory_type: string; updated_at: string }> = idx.entries ?? [];
    const embCount = Object.keys(idx.embeddings ?? {}).length;
    const avgScore = entries.length > 0
      ? Math.round(entries.reduce((s, e) => s + (e.quality_score ?? 0), 0) / entries.length)
      : 0;
    const byType: Record<string, number> = {};
    for (const e of entries) byType[e.memory_type] = (byType[e.memory_type] ?? 0) + 1;
    const lastUpdated = entries.sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0]?.updated_at;
    return { total: entries.length, withEmbedding: embCount, avgScore, byType, lastUpdated, builtAt: idx.built_at };
  } catch {
    return null;
  }
}

async function getRecentDecisions() {
  try {
    const decisionsDir = path.join(VAULT_DIR, 'decisions');
    const files = await fs.readdir(decisionsDir).catch(() => []);
    const decisions = [];
    for (const file of files.filter(f => f.endsWith('.md')).slice(-10)) {
      const content = await fs.readFile(path.join(decisionsDir, file), 'utf-8');
      const summaryMatch = content.match(/^summary:\s*(.+)$/m);
      const decidedByMatch = content.match(/^decided_by:\s*(.+)$/m);
      const dateMatch = content.match(/^decision_date:\s*(.+)$/m);
      const categoryMatch = content.match(/^category:\s*(.+)$/m);
      if (summaryMatch) {
        decisions.push({
          file,
          summary: summaryMatch[1].replace(/^['"]|['"]$/g, ''),
          decided_by: decidedByMatch?.[1]?.replace(/^['"]|['"]$/g, '') ?? 'clara',
          date: dateMatch?.[1]?.replace(/^['"]|['"]$/g, '') ?? '',
          category: categoryMatch?.[1]?.replace(/^['"]|['"]$/g, '') ?? 'operacional',
        });
      }
    }
    return decisions.reverse();
  } catch {
    return [];
  }
}

export async function GET() {
  ensureHydrated();
  const supabase = getSupabaseAdminClient();

  const [cronStatuses, memoryStats, decisions, recentReports, scheduledTasks] = await Promise.allSettled([
    Promise.resolve(getCronStatuses()),
    getMemoryStats(),
    getRecentDecisions(),
    supabase
      .from('clara_reports')
      .select('id, titulo, tipo, created_at')
      .order('created_at', { ascending: false })
      .limit(6)
      .then(r => r.data ?? []),
    supabase
      .from('clara_scheduled_tasks')
      .select('id, task_type, title, status, priority, run_at, executed_at, created_at')
      .in('status', ['pending', 'running', 'completed', 'failed'])
      .order('run_at', { ascending: true })
      .limit(20)
      .then(r => r.data ?? []),
  ]);

  return NextResponse.json({
    crons: cronStatuses.status === 'fulfilled' ? cronStatuses.value : [],
    memory: memoryStats.status === 'fulfilled' ? memoryStats.value : null,
    decisions: decisions.status === 'fulfilled' ? decisions.value : [],
    recentReports: recentReports.status === 'fulfilled' ? recentReports.value : [],
    scheduledTasks: scheduledTasks.status === 'fulfilled' ? scheduledTasks.value : [],
    serverTime: new Date().toISOString(),
  });
}
