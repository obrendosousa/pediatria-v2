// Clara v2 Neural Network - Output Schemas
// Structured JSON outputs that workers MUST return
// Coordinator aggregates these programmatically (no LLM summarization loss)

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Daily Report (all sectors)
// ---------------------------------------------------------------------------

export const DailyReportOutputSchema = z.object({
  agent_id: z.string(),
  period: z.object({
    start: z.string(),
    end: z.string(),
  }),
  kpis: z.record(z.string(), z.number()),
  highlights: z.array(z.string()).max(5),
  alerts: z.array(z.object({
    severity: z.enum(['info', 'warning', 'critical']),
    message: z.string(),
    metric: z.string(),
    value: z.number(),
    threshold: z.number(),
  })),
  comparisons: z.array(z.object({
    metric: z.string(),
    current: z.number(),
    previous: z.number(),
    change_pct: z.number(),
  })),
});

export type DailyReportOutput = z.infer<typeof DailyReportOutputSchema>;

// ---------------------------------------------------------------------------
// Classification (recepcao + comercial)
// ---------------------------------------------------------------------------

export const ClassificationOutputSchema = z.object({
  classifications: z.array(z.object({
    chat_id: z.number(),
    category: z.string(),
    subcategory: z.string().optional(),
    confidence: z.number().min(0).max(1),
    evidence: z.string().max(200),
  })),
  aggregates: z.object({
    total_processed: z.number(),
    by_category: z.record(z.string(), z.number()),
    avg_confidence: z.number(),
  }),
  errors: z.array(z.string()),
});

export type ClassificationOutput = z.infer<typeof ClassificationOutputSchema>;

// ---------------------------------------------------------------------------
// Financial Analysis (financeiro)
// ---------------------------------------------------------------------------

export const FinancialAnalysisOutputSchema = z.object({
  revenue: z.object({
    total: z.number(),
    by_origin: z.record(z.string(), z.number()),
    by_payment_method: z.record(z.string(), z.number()),
    by_professional: z.record(z.string(), z.number()),
  }),
  expenses: z.object({
    total: z.number(),
    by_category: z.record(z.string(), z.number()),
  }),
  margin: z.object({
    gross: z.number(),
    gross_pct: z.number(),
  }),
  ticket_medio: z.object({
    geral: z.number(),
    by_professional: z.record(z.string(), z.number()),
  }),
  trends: z.array(z.object({
    metric: z.string(),
    direction: z.enum(['up', 'down', 'stable']),
    change_pct: z.number(),
    significance: z.enum(['low', 'medium', 'high']),
  })),
});

export type FinancialAnalysisOutput = z.infer<typeof FinancialAnalysisOutputSchema>;

// ---------------------------------------------------------------------------
// Funnel Analysis (comercial)
// ---------------------------------------------------------------------------

export const FunnelAnalysisOutputSchema = z.object({
  stages: z.array(z.object({
    name: z.string(),
    count: z.number(),
    conversion_pct: z.number(),
    avg_time_hours: z.number().optional(),
  })),
  objections: z.array(z.object({
    type: z.string(),
    count: z.number(),
    pct: z.number(),
    top_examples: z.array(z.object({
      chat_id: z.number(),
      evidence: z.string(),
    })).max(5),
  })),
  overall_conversion_pct: z.number(),
  total_leads: z.number(),
  total_converted: z.number(),
});

export type FunnelAnalysisOutput = z.infer<typeof FunnelAnalysisOutputSchema>;

// ---------------------------------------------------------------------------
// Stock Analysis (estoque)
// ---------------------------------------------------------------------------

export const StockAnalysisOutputSchema = z.object({
  levels: z.array(z.object({
    product_id: z.number(),
    name: z.string(),
    current_stock: z.number(),
    days_of_stock: z.number().nullable(),
    status: z.enum(['critical', 'low', 'normal', 'excess']),
  })),
  turnover: z.object({
    fast_movers: z.array(z.string()).max(10),
    slow_movers: z.array(z.string()).max(10),
    avg_turnover_days: z.number(),
  }),
  abc: z.object({
    a: z.object({ count: z.number(), revenue_pct: z.number() }),
    b: z.object({ count: z.number(), revenue_pct: z.number() }),
    c: z.object({ count: z.number(), revenue_pct: z.number() }),
  }),
  alerts: z.array(z.object({
    product: z.string(),
    reason: z.enum(['out_of_stock', 'low_stock', 'expiring_soon', 'no_movement']),
    details: z.string(),
  })),
});

export type StockAnalysisOutput = z.infer<typeof StockAnalysisOutputSchema>;

// ---------------------------------------------------------------------------
// Schedule Analysis (rh_ops)
// ---------------------------------------------------------------------------

export const ScheduleAnalysisOutputSchema = z.object({
  utilization: z.array(z.object({
    professional: z.string(),
    total_slots: z.number(),
    filled_slots: z.number(),
    utilization_pct: z.number(),
    no_show_count: z.number(),
  })),
  gaps: z.array(z.object({
    professional: z.string(),
    day: z.string(),
    empty_slots: z.number(),
  })),
  summary: z.object({
    avg_utilization_pct: z.number(),
    total_no_shows: z.number(),
    busiest_day: z.string(),
    emptiest_day: z.string(),
  }),
});

export type ScheduleAnalysisOutput = z.infer<typeof ScheduleAnalysisOutputSchema>;

// ---------------------------------------------------------------------------
// Generic Worker Output (wrapper for any worker result)
// ---------------------------------------------------------------------------

export const WorkerOutputSchema = z.object({
  task_id: z.string(),
  agent_id: z.string(),
  status: z.enum(['complete', 'partial', 'failed']),
  data: z.unknown(),
  errors: z.array(z.string()),
  token_usage: z.number(),
  execution_time_ms: z.number(),
});

export type WorkerOutput = z.infer<typeof WorkerOutputSchema>;

// ---------------------------------------------------------------------------
// Programmatic Aggregation Functions (NO LLM involved)
// ---------------------------------------------------------------------------

function groupBy<T>(items: T[], keyFn: (item: T) => string): Record<string, T[]> {
  const result: Record<string, T[]> = {};
  for (const item of items) {
    const key = keyFn(item);
    if (!result[key]) result[key] = [];
    result[key].push(item);
  }
  return result;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function aggregateClassifications(
  workerResults: ClassificationOutput[]
): {
  total: number;
  by_category: Record<string, { count: number; pct: number; avg_confidence: number; top_examples: { chat_id: number; evidence: string }[] }>;
  failed_batches: number;
  total_errors: number;
} {
  const all = workerResults.flatMap(r => r.classifications);
  const total = all.length;
  const byCategory = groupBy(all, c => c.category);

  return {
    total,
    by_category: Object.fromEntries(
      Object.entries(byCategory).map(([cat, items]) => [
        cat,
        {
          count: items.length,
          pct: total > 0 ? (items.length / total) * 100 : 0,
          avg_confidence: mean(items.map(i => i.confidence)),
          top_examples: items
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, 5)
            .map(i => ({ chat_id: i.chat_id, evidence: i.evidence })),
        },
      ])
    ),
    failed_batches: workerResults.filter(r => r.errors.length > 0).length,
    total_errors: workerResults.reduce((sum, r) => sum + r.errors.length, 0),
  };
}

export function aggregateFinancials(
  workerResults: FinancialAnalysisOutput[]
): {
  total_revenue: number;
  total_expenses: number;
  gross_margin_pct: number;
  combined_trends: FinancialAnalysisOutput['trends'];
} {
  const totalRevenue = workerResults.reduce((sum, r) => sum + r.revenue.total, 0);
  const totalExpenses = workerResults.reduce((sum, r) => sum + r.expenses.total, 0);

  return {
    total_revenue: totalRevenue,
    total_expenses: totalExpenses,
    gross_margin_pct: totalRevenue > 0
      ? ((totalRevenue - totalExpenses) / totalRevenue) * 100
      : 0,
    combined_trends: workerResults.flatMap(r => r.trends),
  };
}

export function mergeReports(
  reports: DailyReportOutput[]
): {
  merged_kpis: Record<string, number>;
  all_alerts: DailyReportOutput['alerts'];
  all_highlights: string[];
} {
  const mergedKpis: Record<string, number> = {};

  for (const report of reports) {
    for (const [key, value] of Object.entries(report.kpis)) {
      mergedKpis[key] = (mergedKpis[key] ?? 0) + value;
    }
  }

  return {
    merged_kpis: mergedKpis,
    all_alerts: reports
      .flatMap(r => r.alerts)
      .sort((a, b) => {
        const severity = { critical: 0, warning: 1, info: 2 };
        return severity[a.severity] - severity[b.severity];
      }),
    all_highlights: reports.flatMap(r => r.highlights),
  };
}
