// ═══════════════════════════════════════════════════════════════════════════
// CAMADA 1: Temporal Anchor Service
// Resolve TODAS as expressões temporais em timestamps BRT absolutos
// ANTES de qualquer processamento.
// ═══════════════════════════════════════════════════════════════════════════

export interface TemporalAnchor {
  start_brt: string;
  end_brt: string;
  period_label: string;
  sql_start: string;
  sql_end: string;
  sql_group_by: string;

  comparison_period: {
    start_brt: string;
    end_brt: string;
    sql_start: string;
    sql_end: string;
    label: string;
    comparison_type: "previous_period" | "same_period_last_month" | "same_period_last_year" | "custom";
  } | null;

  previous_anchor: TemporalAnchor | null;

  resolved_from: string;
  now_brt: string;

  intent_type: "operational" | "strategic" | "comparative" | "specific" | "ambiguous";
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getNowBRT(): Date {
  const now = new Date();
  const brtStr = now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
  return new Date(brtStr);
}

function formatBRT(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  const sec = String(date.getSeconds()).padStart(2, "0");
  return `${y}-${m}-${d}T${h}:${min}:${sec}-03:00`;
}

function formatDateBR(date: Date): string {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1; // Monday = start
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(date: Date): Date {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfMonth(date: Date): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1, 0);
  d.setHours(23, 59, 59, 999);
  return d;
}

function toSqlTs(date: Date): string {
  return `'${formatBRT(date)}'::timestamptz`;
}

// ── Classificação de intenção temporal ─────────────────────────────────────

export function classifyTemporalIntent(
  userMessage: string,
  previousAnchor: TemporalAnchor | null
): "operational" | "strategic" | "comparative" | "specific" | "ambiguous" {
  const msg = userMessage.toLowerCase();

  // 1. Específico — tem datas explícitas
  if (/\d{1,2}\/\d{1,2}|\d{4}-\d{2}|janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro/.test(msg)) {
    return "specific";
  }

  // 2. Comparativo — verbos de mudança
  if (/cai[ur]|subi[ur]|cresc|diminu|melhor|pior|compar|diferença|mudou|vs|em relação/.test(msg)) {
    return "comparative";
  }

  // 3. Operacional — referências temporais curtas
  if (/hoje|ontem|essa semana|esta semana|esse mês|este mês|últimos? \d+/.test(msg)) {
    return "operational";
  }

  // 4. Estratégico — perguntas de padrão/tendência sem período
  if (/objeç|padrão|padrões|tendência|principal|mais comum|recorrente|geral|sempre|costum/.test(msg)) {
    return "strategic";
  }

  // 5. Multi-turn — referência ao anterior
  if (previousAnchor && /e o|e a|e no|e na|antes|anterior|passado|comparando/.test(msg)) {
    return previousAnchor.intent_type === "comparative" ? "comparative" : "operational";
  }

  // 6. Tem alguma referência temporal implícita?
  if (/atendimento|conversa|mensagen|relatório|desempenho|quantos|quantas|volume/.test(msg)) {
    return "operational";
  }

  // 7. Verdadeiramente ambíguo
  return "ambiguous";
}

// ── Resolução de expressão temporal ────────────────────────────────────────

function resolveTemporalExpression(
  msg: string,
  now: Date,
  previousAnchor: TemporalAnchor | null
): { start: Date; end: Date; label: string; resolvedFrom: string } | null {
  const lower = msg.toLowerCase();

  // "hoje"
  if (/\bhoje\b/.test(lower)) {
    return {
      start: startOfDay(now),
      end: endOfDay(now),
      label: `hoje (${formatDateBR(now)})`,
      resolvedFrom: "hoje",
    };
  }

  // "ontem"
  if (/\bontem\b/.test(lower)) {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return {
      start: startOfDay(yesterday),
      end: endOfDay(yesterday),
      label: `ontem (${formatDateBR(yesterday)})`,
      resolvedFrom: "ontem",
    };
  }

  // "esta semana" / "essa semana"
  if (/\b(esta|essa) semana\b/.test(lower)) {
    const weekStart = startOfWeek(now);
    return {
      start: weekStart,
      end: endOfDay(now),
      label: `esta semana (${formatDateBR(weekStart)} a ${formatDateBR(now)})`,
      resolvedFrom: "esta semana",
    };
  }

  // "semana passada"
  if (/\bsemana passada\b/.test(lower)) {
    const thisWeekStart = startOfWeek(now);
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const lastWeekEnd = new Date(thisWeekStart);
    lastWeekEnd.setDate(lastWeekEnd.getDate() - 1);
    return {
      start: startOfDay(lastWeekStart),
      end: endOfDay(lastWeekEnd),
      label: `semana passada (${formatDateBR(lastWeekStart)} a ${formatDateBR(lastWeekEnd)})`,
      resolvedFrom: "semana passada",
    };
  }

  // "este mês" / "esse mês"
  if (/\b(este|esse) mês\b/.test(lower)) {
    const monthStart = startOfMonth(now);
    return {
      start: monthStart,
      end: endOfDay(now),
      label: `este mês (${formatDateBR(monthStart)} a ${formatDateBR(now)})`,
      resolvedFrom: "este mês",
    };
  }

  // "mês passado"
  if (/\bmês passado\b/.test(lower)) {
    const lastMonth = new Date(now);
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    return {
      start: startOfMonth(lastMonth),
      end: endOfMonth(lastMonth),
      label: `mês passado (${formatDateBR(startOfMonth(lastMonth))} a ${formatDateBR(endOfMonth(lastMonth))})`,
      resolvedFrom: "mês passado",
    };
  }

  // "últimos N dias"
  const lastNDays = lower.match(/últimos?\s+(\d+)\s*dias?/);
  if (lastNDays) {
    const n = parseInt(lastNDays[1]);
    const start = new Date(now);
    start.setDate(start.getDate() - n);
    return {
      start: startOfDay(start),
      end: endOfDay(now),
      label: `últimos ${n} dias (${formatDateBR(start)} a ${formatDateBR(now)})`,
      resolvedFrom: `últimos ${n} dias`,
    };
  }

  // "de DD/MM a DD/MM" ou "de DD/MM/YYYY a DD/MM/YYYY"
  const dateRange = lower.match(/de\s+(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\s+a\s+(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (dateRange) {
    const y1 = dateRange[3] ? (dateRange[3].length === 2 ? 2000 + parseInt(dateRange[3]) : parseInt(dateRange[3])) : now.getFullYear();
    const y2 = dateRange[6] ? (dateRange[6].length === 2 ? 2000 + parseInt(dateRange[6]) : parseInt(dateRange[6])) : now.getFullYear();
    const start = new Date(y1, parseInt(dateRange[2]) - 1, parseInt(dateRange[1]));
    const end = new Date(y2, parseInt(dateRange[5]) - 1, parseInt(dateRange[4]));
    return {
      start: startOfDay(start),
      end: endOfDay(end),
      label: `${formatDateBR(start)} a ${formatDateBR(end)}`,
      resolvedFrom: `de ${dateRange[1]}/${dateRange[2]} a ${dateRange[4]}/${dateRange[5]}`,
    };
  }

  // Mês standalone: "janeiro", "fevereiro", "março", etc.
  const MONTH_NAMES: Record<string, number> = {
    janeiro: 0, fevereiro: 1, "março": 2, marco: 2, abril: 3, maio: 4, junho: 5,
    julho: 6, agosto: 7, setembro: 8, outubro: 9, novembro: 10, dezembro: 11,
  };
  for (const [name, monthIdx] of Object.entries(MONTH_NAMES)) {
    if (new RegExp(`\\b${name}\\b`).test(lower)) {
      const year = now.getFullYear();
      const start = new Date(year, monthIdx, 1);
      const isCurrentMonth = now.getMonth() === monthIdx && now.getFullYear() === year;
      const end = isCurrentMonth ? now : endOfMonth(start);
      return {
        start: startOfDay(start),
        end: endOfDay(end),
        label: `${name} (${formatDateBR(start)} a ${formatDateBR(end)})`,
        resolvedFrom: name,
      };
    }
  }

  // Multi-turn: "e o mês passado?" / "e antes disso?"
  if (previousAnchor) {
    if (/e (o|a|no|na)\s*(mês|semana)\s*(passad|anterior)/.test(lower)) {
      const prevStart = new Date(previousAnchor.start_brt);
      const prevEnd = new Date(previousAnchor.end_brt);
      const durationMs = prevEnd.getTime() - prevStart.getTime();
      const newEnd = new Date(prevStart.getTime() - 1);
      const newStart = new Date(newEnd.getTime() - durationMs);
      return {
        start: startOfDay(newStart),
        end: endOfDay(newEnd),
        label: `período anterior (${formatDateBR(newStart)} a ${formatDateBR(newEnd)})`,
        resolvedFrom: "referência ao período anterior",
      };
    }

    if (/antes disso|anterior/.test(lower)) {
      const prevStart = new Date(previousAnchor.start_brt);
      const prevEnd = new Date(previousAnchor.end_brt);
      const durationMs = prevEnd.getTime() - prevStart.getTime();
      const newEnd = new Date(prevStart.getTime() - 1);
      const newStart = new Date(newEnd.getTime() - durationMs);
      return {
        start: startOfDay(newStart),
        end: endOfDay(newEnd),
        label: `antes disso (${formatDateBR(newStart)} a ${formatDateBR(newEnd)})`,
        resolvedFrom: "antes disso",
      };
    }

    // "comparando com o ano passado" → mesmo período, -1 ano
    if (/ano passado|year ago|mesmo per[ií]odo.*ano/.test(lower)) {
      const prevStart = new Date(previousAnchor.start_brt);
      const prevEnd = new Date(previousAnchor.end_brt);
      const yearAgoStart = new Date(prevStart);
      yearAgoStart.setFullYear(yearAgoStart.getFullYear() - 1);
      const yearAgoEnd = new Date(prevEnd);
      yearAgoEnd.setFullYear(yearAgoEnd.getFullYear() - 1);
      return {
        start: startOfDay(yearAgoStart),
        end: endOfDay(yearAgoEnd),
        label: `mesmo período do ano passado (${formatDateBR(yearAgoStart)} a ${formatDateBR(yearAgoEnd)})`,
        resolvedFrom: "comparação com ano passado",
      };
    }
  }

  return null;
}

// ── Período de comparação automático ──────────────────────────────────────

function buildComparisonPeriod(
  start: Date,
  end: Date,
  intentType: string,
  userMessage?: string
): TemporalAnchor["comparison_period"] {
  if (intentType !== "comparative") return null;

  const durationMs = end.getTime() - start.getTime();
  const durationDays = Math.round(durationMs / (1000 * 60 * 60 * 24));
  const lower = (userMessage || "").toLowerCase();

  let compStart: Date;
  let compEnd: Date;
  let label: string;
  let compType: "previous_period" | "same_period_last_month" | "same_period_last_year" | "custom" = "previous_period";

  // Yearly comparison when user mentions "ano passado" / "year"
  if (/ano passado|ano anterior|year ago|mesmo per[ií]odo.*ano/.test(lower)) {
    compStart = new Date(start);
    compStart.setFullYear(compStart.getFullYear() - 1);
    compEnd = new Date(end);
    compEnd.setFullYear(compEnd.getFullYear() - 1);
    compStart = startOfDay(compStart);
    compEnd = endOfDay(compEnd);
    label = `mesmo período do ano anterior (${formatDateBR(compStart)} a ${formatDateBR(compEnd)})`;
    compType = "same_period_last_year";
  } else if (durationDays <= 7) {
    // Semana → semana anterior
    compEnd = new Date(start.getTime() - 1);
    compStart = new Date(compEnd.getTime() - durationMs);
    compStart = startOfDay(compStart);
    compEnd = endOfDay(compEnd);
    label = `período anterior (${formatDateBR(compStart)} a ${formatDateBR(compEnd)})`;
  } else {
    // Mês → mesmo recorte do mês anterior
    compStart = new Date(start);
    compStart.setMonth(compStart.getMonth() - 1);
    compEnd = new Date(end);
    compEnd.setMonth(compEnd.getMonth() - 1);
    compStart = startOfDay(compStart);
    compEnd = endOfDay(compEnd);
    label = `mesmo período do mês anterior (${formatDateBR(compStart)} a ${formatDateBR(compEnd)})`;
    compType = "same_period_last_month";
  }

  return {
    start_brt: formatBRT(compStart),
    end_brt: formatBRT(compEnd),
    sql_start: toSqlTs(compStart),
    sql_end: toSqlTs(compEnd),
    label,
    comparison_type: compType,
  };
}

// ── Resolução principal ───────────────────────────────────────────────────

export function resolveTemporalAnchor(
  userMessage: string,
  previousAnchor: TemporalAnchor | null = null
): TemporalAnchor | null {
  const now = getNowBRT();
  const intentType = classifyTemporalIntent(userMessage, previousAnchor);

  // Se ambíguo, retornar null (Clara vai perguntar)
  if (intentType === "ambiguous") {
    return null;
  }

  const resolved = resolveTemporalExpression(userMessage, now, previousAnchor);

  let start: Date;
  let end: Date;
  let label: string;
  let resolvedFrom: string;

  if (resolved) {
    start = resolved.start;
    end = resolved.end;
    label = resolved.label;
    resolvedFrom = resolved.resolvedFrom;
  } else {
    // Defaults baseados no intent
    if (intentType === "strategic") {
      start = new Date(now);
      start.setDate(start.getDate() - 90);
      start = startOfDay(start);
      end = endOfDay(now);
      label = `últimos 90 dias (${formatDateBR(start)} a ${formatDateBR(now)})`;
      resolvedFrom = "default estratégico (90 dias)";
    } else {
      // Operational default: últimos 7 dias
      start = new Date(now);
      start.setDate(start.getDate() - 7);
      start = startOfDay(start);
      end = endOfDay(now);
      label = `últimos 7 dias (${formatDateBR(start)} a ${formatDateBR(now)})`;
      resolvedFrom = "default operacional (7 dias)";
    }
  }

  const comparisonPeriod = buildComparisonPeriod(start, end, intentType, userMessage);

  return {
    start_brt: formatBRT(start),
    end_brt: formatBRT(end),
    period_label: label,
    sql_start: toSqlTs(start),
    sql_end: toSqlTs(end),
    sql_group_by: "DATE(campo AT TIME ZONE 'America/Sao_Paulo')",
    comparison_period: comparisonPeriod,
    previous_anchor: previousAnchor,
    resolved_from: resolvedFrom,
    now_brt: formatBRT(now),
    intent_type: intentType,
  };
}
