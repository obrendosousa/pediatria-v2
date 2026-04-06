// Clara v2 Neural Network - Scheduled Analysis
// Daily/weekly/monthly report dispatcher via cron
// Uses existing dispatchAndWait() to invoke workers

import { getSupabaseAdminClient } from '@/lib/automation/adapters/supabaseAdmin';
import type { AgentId } from './types';
import { AGENT_DEFINITIONS } from './types';
import { dispatchAndWait } from './worker-executor';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AnalysisType = 'daily' | 'weekly' | 'monthly';

interface AnalysisResult {
  reports_created: number;
  alerts: Array<{ agent_id: string; severity: string; message: string }>;
  failed_agents: string[];
  execution_time_ms: number;
}

// ---------------------------------------------------------------------------
// Schedule Config
// ---------------------------------------------------------------------------

/** Agents that receive scheduled analyses (only implemented workers) */
const ACTIVE_WORKERS: AgentId[] = [
  'financeiro_agent',
  'recepcao_agent',
  'comercial_agent',
];

/** Minimum interval between runs of same type (prevents double execution) */
const MIN_INTERVALS: Record<AnalysisType, number> = {
  daily: 6 * 60 * 60 * 1000,    // 6 hours
  weekly: 3 * 24 * 60 * 60 * 1000, // 3 days
  monthly: 15 * 24 * 60 * 60 * 1000, // 15 days
};

// ---------------------------------------------------------------------------
// Report Prompt Builders
// ---------------------------------------------------------------------------

function buildDailyPrompt(agentId: AgentId, date: string): string {
  const def = AGENT_DEFINITIONS[agentId];
  return `Gere o relatorio DIARIO de ${date} para o setor ${def.name}.

Analise os dados do dia ${date} usando TIER 1 (get_daily_kpis) primeiro, depois TIER 2 (execute_sql) se necessario.

Retorne um JSON com EXATAMENTE esta estrutura:
{
  "agent_id": "${agentId}",
  "period": { "start": "${date}", "end": "${date}" },
  "kpis": { "metrica_1": 123, "metrica_2": 456 },
  "highlights": ["destaque 1", "destaque 2"],
  "alerts": [{ "severity": "info|warning|critical", "message": "...", "metric": "...", "value": 0, "threshold": 0 }],
  "comparisons": [{ "metric": "...", "current": 0, "previous": 0, "change_pct": 0 }]
}

Regras:
- Datas em BRT (UTC-3). SQL: 'YYYY-MM-DDTHH:MM:SS-03:00'::timestamptz
- Dados de producao a partir de 2026-03-21
- ZERO e valido — reporte "0" explicitamente
- Sem PII (nomes de pacientes, CPFs, telefones)`;
}

function buildWeeklyPrompt(agentId: AgentId, weekStart: string, weekEnd: string): string {
  const def = AGENT_DEFINITIONS[agentId];
  return `Gere o relatorio SEMANAL de ${weekStart} a ${weekEnd} para o setor ${def.name}.

Identifique TENDENCIAS e pontos de melhoria comparando com a semana anterior.

Retorne JSON:
{
  "agent_id": "${agentId}",
  "period": { "start": "${weekStart}", "end": "${weekEnd}" },
  "kpis": { "metrica_1": 123 },
  "highlights": ["tendencia 1"],
  "alerts": [{ "severity": "...", "message": "...", "metric": "...", "value": 0, "threshold": 0 }],
  "comparisons": [{ "metric": "...", "current": 0, "previous": 0, "change_pct": 0 }]
}`;
}

function buildMonthlyPrompt(agentId: AgentId, month: string, monthStart: string, monthEnd: string): string {
  const def = AGENT_DEFINITIONS[agentId];
  return `Gere o relatorio MENSAL de ${month} (${monthStart} a ${monthEnd}) para o setor ${def.name}.

Foco em insights ESTRATEGICOS e recomendacoes acionaveis.

Retorne JSON:
{
  "agent_id": "${agentId}",
  "period": { "start": "${monthStart}", "end": "${monthEnd}" },
  "kpis": { "metrica_1": 123 },
  "highlights": ["insight estrategico 1"],
  "alerts": [{ "severity": "...", "message": "...", "metric": "...", "value": 0, "threshold": 0 }],
  "comparisons": [{ "metric": "...", "current": 0, "previous": 0, "change_pct": 0 }]
}`;
}

// ---------------------------------------------------------------------------
// Date Helpers (BRT)
// ---------------------------------------------------------------------------

function getBRTDate(offset: number = 0): Date {
  const now = new Date();
  // Get BRT date string properly via Intl (handles DST)
  const brtDateStr = now.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const brtDate = new Date(brtDateStr + 'T12:00:00'); // noon to avoid DST edges
  brtDate.setDate(brtDate.getDate() + offset);
  return brtDate;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

function getWeekRange(): { start: string; end: string } {
  const now = getBRTDate();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - dayOfWeek - 6); // Previous Monday
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: formatDate(monday), end: formatDate(sunday) };
}

function getMonthRange(): { month: string; start: string; end: string } {
  const now = getBRTDate();
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
  const monthName = prevMonth.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
  return { month: monthName, start: formatDate(prevMonth), end: formatDate(lastDay) };
}

// ---------------------------------------------------------------------------
// Cron Execution Tracking
// ---------------------------------------------------------------------------

export async function getLastCronRun(type: AnalysisType): Promise<Date | null> {
  const supabase = getSupabaseAdminClient();
  const { data } = await supabase
    .from('clara_cron_executions')
    .select('executed_at')
    .eq('cron_type', type)
    .eq('success', true)
    .order('executed_at', { ascending: false })
    .limit(1)
    .single();

  return data ? new Date(data.executed_at) : null;
}

export async function logCronExecution(
  type: AnalysisType,
  result: AnalysisResult
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  await supabase.from('clara_cron_executions').insert({
    cron_type: type,
    agents_processed: ACTIVE_WORKERS,
    reports_created: result.reports_created,
    alerts_count: result.alerts.length,
    success: result.failed_agents.length === 0,
    error_message: result.failed_agents.length > 0
      ? `Failed: ${result.failed_agents.join(', ')}`
      : null,
    execution_time_ms: result.execution_time_ms,
  });
}

// ---------------------------------------------------------------------------
// Main Dispatcher
// ---------------------------------------------------------------------------

export async function runScheduledAnalysis(type: AnalysisType): Promise<AnalysisResult> {
  const startTime = Date.now();
  const result: AnalysisResult = {
    reports_created: 0,
    alerts: [],
    failed_agents: [],
    execution_time_ms: 0,
  };

  // Check minimum interval
  const lastRun = await getLastCronRun(type);
  if (lastRun && Date.now() - lastRun.getTime() < MIN_INTERVALS[type]) {
    result.execution_time_ms = Date.now() - startTime;
    return result; // Skipped, too soon
  }

  // Build prompt per type
  const yesterday = formatDate(getBRTDate(-1));
  const week = getWeekRange();
  const month = getMonthRange();

  for (const agentId of ACTIVE_WORKERS) {
    try {
      let description: string;
      switch (type) {
        case 'daily':
          description = buildDailyPrompt(agentId, yesterday);
          break;
        case 'weekly':
          description = buildWeeklyPrompt(agentId, week.start, week.end);
          break;
        case 'monthly':
          description = buildMonthlyPrompt(agentId, month.month, month.start, month.end);
          break;
      }

      const { task, result: workerResult } = await dispatchAndWait({
        agentId,
        description,
        outputSchema: 'DailyReportOutput',
        timeoutMs: 180_000, // 3 minutes per agent
      });

      if (task.status === 'completed' && workerResult) {
        // Save to clara_reports
        const supabase = getSupabaseAdminClient();
        await supabase.from('clara_reports').insert({
          titulo: `${type} report — ${agentId} — ${type === 'daily' ? yesterday : type === 'weekly' ? `${week.start} to ${week.end}` : month.month}`,
          conteudo_markdown: JSON.stringify(workerResult, null, 2),
          tipo: 'geral',
          agent_id: agentId,
          report_type: type,
          structured_data: workerResult,
          period_start: type === 'daily' ? yesterday : type === 'weekly' ? week.start : month.start,
          period_end: type === 'daily' ? yesterday : type === 'weekly' ? week.end : month.end,
        });

        result.reports_created++;

        // Extract alerts from worker result
        const alerts = (workerResult as Record<string, unknown>).alerts;
        if (Array.isArray(alerts)) {
          for (const alert of alerts) {
            const a = alert as Record<string, unknown>;
            result.alerts.push({
              agent_id: agentId,
              severity: String(a.severity ?? 'info'),
              message: String(a.message ?? ''),
            });
          }
        }
      } else {
        result.failed_agents.push(agentId);
      }
    } catch (error) {
      result.failed_agents.push(agentId);
      console.error(`[scheduled-analysis] ${agentId} failed:`, error instanceof Error ? error.message : error);
    }
  }

  result.execution_time_ms = Date.now() - startTime;
  return result;
}
