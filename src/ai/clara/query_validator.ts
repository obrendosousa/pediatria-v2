// ═══════════════════════════════════════════════════════════════════════════
// CAMADA 3: Query Validator
// Valida queries SQL pré e pós execução contra o temporal anchor.
// ═══════════════════════════════════════════════════════════════════════════

import type { TemporalAnchor } from "./temporal_anchor";

export interface PreValidationResult {
  is_valid: boolean;
  issues: string[];
  corrected_sql?: string;
  expected_behavior: string;
}

export interface PostValidationResult {
  is_valid: boolean;
  issues: string[];
  data_quality: {
    row_count: number;
    date_range_found: { min: string; max: string } | null;
    date_range_expected: { min: string; max: string };
    has_out_of_range_data: boolean;
    missing_days: string[];
    null_count: number;
  };
  summary_for_model: string;
}

// ── Pré-validação ──────────────────────────────────────────────────────────

export function preValidateQuery(
  sql: string,
  temporalAnchor: TemporalAnchor | null
): PreValidationResult {
  const issues: string[] = [];
  const upper = sql.replace(/\s+/g, " ").toUpperCase();
  let correctedSql = sql;
  let needsCorrection = false;

  // 1. Só SELECT/WITH
  if (!upper.startsWith("SELECT") && !upper.startsWith("WITH")) {
    return {
      is_valid: false,
      issues: ["Apenas SELECT/WITH são permitidos. Query rejeitada por segurança."],
      expected_behavior: "Query rejeitada por segurança.",
    };
  }

  // 1b. Bloquear multi-statement (ponto-e-vírgula seguido de comando)
  if (/;\s*\S/.test(sql)) {
    return {
      is_valid: false,
      issues: ["Multi-statement detectado (';' seguido de outro comando). Query rejeitada por segurança."],
      expected_behavior: "Query rejeitada por segurança.",
    };
  }

  // 1c. Bloquear DML/DDL keywords em qualquer posição (subqueries, CTEs etc.)
  // Usa word-boundary (\b) para evitar falsos positivos com nomes de colunas
  // como created_at (CREATE), updated_at (UPDATE), OFFSET (SET)
  const DML_KEYWORD_RE = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|COPY|EXECUTE|PREPARE)\b/;
  const DML_SPACE_RE = /\b(DO|CALL|SET|NOTIFY|LISTEN|UNLISTEN)\s/;
  const dmlMatch = upper.match(DML_KEYWORD_RE) || upper.match(DML_SPACE_RE);
  if (dmlMatch) {
    return {
      is_valid: false,
      issues: [`Keyword proibido detectado: ${dmlMatch[1]}. Query rejeitada por segurança.`],
      expected_behavior: "Query rejeitada por segurança.",
    };
  }

  // 1d. Bloquear funções perigosas do PostgreSQL
  const DANGEROUS_FUNCTIONS = [
    "SET_CONFIG", "PG_READ_FILE", "PG_WRITE_FILE", "PG_READ_BINARY_FILE",
    "LO_EXPORT", "LO_IMPORT", "LO_GET", "LO_PUT",
    "PG_TERMINATE_BACKEND", "PG_CANCEL_BACKEND", "PG_RELOAD_CONF",
    "PG_SLEEP", "DBLINK", "DBLINK_EXEC",
  ];
  for (const fn of DANGEROUS_FUNCTIONS) {
    if (upper.includes(fn)) {
      return {
        is_valid: false,
        issues: [`Função proibida detectada: ${fn}. Query rejeitada por segurança.`],
        expected_behavior: "Query rejeitada por segurança.",
      };
    }
  }

  // 2. Se tem temporal anchor, deve ter filtro de data
  if (temporalAnchor) {
    const hasDateFilter = /WHERE.*(?:created_at|last_interaction_at|updated_at|start_time|occurred_at|scheduled_for|sent_at|finished_at)\s*(?:>=|>|BETWEEN)/i.test(sql);
    if (!hasDateFilter) {
      issues.push("Query não tem filtro de data. Adicionando filtro do período solicitado.");
    }
  }

  // 3. Deve ter LIMIT
  if (!/\bLIMIT\b/i.test(sql)) {
    issues.push("LIMIT ausente — adicionando LIMIT 500.");
    correctedSql = correctedSql.replace(/;?\s*$/, " LIMIT 500;");
    needsCorrection = true;
  } else {
    // Verificar se LIMIT é > 1000
    const limitMatch = sql.match(/LIMIT\s+(\d+)/i);
    if (limitMatch && parseInt(limitMatch[1]) > 1000) {
      issues.push(`LIMIT muito alto (${limitMatch[1]}) — reduzindo para 1000.`);
      correctedSql = correctedSql.replace(/LIMIT\s+\d+/i, "LIMIT 1000");
      needsCorrection = true;
    }
  }

  // 4. Se agrupa por dia, deve usar AT TIME ZONE
  if (/GROUP\s+BY.*DATE\s*\(/i.test(sql) && !/AT\s+TIME\s+ZONE/i.test(sql)) {
    issues.push("Agrupamento por dia sem AT TIME ZONE — datas podem estar em UTC.");
  }

  // 5. Timestamps devem ter offset BRT
  const dateMatches = sql.match(/'(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})'/g);
  if (dateMatches) {
    for (const match of dateMatches) {
      if (!match.includes("-03:00") && !match.includes("+00:00")) {
        issues.push(`Timestamp sem offset BRT: ${match}. Pode causar erro de período.`);
      }
    }
  }

  const startLabel = temporalAnchor?.period_label || "período não especificado";
  const expected = temporalAnchor
    ? `Deve retornar dados de ${startLabel}.`
    : "Sem período específico — retorna dados gerais.";

  return {
    is_valid: issues.length === 0,
    issues,
    corrected_sql: needsCorrection ? correctedSql : undefined,
    expected_behavior: expected,
  };
}

// ── Pós-validação ──────────────────────────────────────────────────────────

export function postValidateResults(
  sql: string,
  results: Record<string, unknown>[],
  temporalAnchor: TemporalAnchor | null
): PostValidationResult {
  const issues: string[] = [];

  if (!temporalAnchor) {
    return {
      is_valid: true,
      issues: [],
      data_quality: {
        row_count: results.length,
        date_range_found: null,
        date_range_expected: { min: "N/A", max: "N/A" },
        has_out_of_range_data: false,
        missing_days: [],
        null_count: 0,
      },
      summary_for_model: `Encontrados ${results.length} registros (sem período específico).`,
    };
  }

  // Detectar colunas de data nos resultados
  const dateColumns = ["dia", "date", "created_at", "last_interaction_at", "updated_at", "start_time", "occurred_at"];
  let foundDateCol: string | null = null;
  let dates: string[] = [];

  if (results.length > 0) {
    const firstRow = results[0];
    for (const col of dateColumns) {
      if (col in firstRow) {
        foundDateCol = col;
        break;
      }
    }

    if (foundDateCol) {
      dates = results
        .map((r) => {
          const val = r[foundDateCol!];
          if (!val) return null;
          return typeof val === "string" ? val.slice(0, 10) : String(val);
        })
        .filter((d): d is string => d !== null);
    }
  }

  // Calcular range esperado
  const expectedStart = temporalAnchor.start_brt.slice(0, 10);
  const expectedEnd = temporalAnchor.end_brt.slice(0, 10);

  let dateRangeFound: { min: string; max: string } | null = null;
  let hasOutOfRange = false;

  if (dates.length > 0) {
    const sorted = [...dates].sort();
    dateRangeFound = { min: sorted[0], max: sorted[sorted.length - 1] };

    // Verificar se dados estão fora do range
    if (sorted[0] < expectedStart || sorted[sorted.length - 1] > expectedEnd) {
      hasOutOfRange = true;
      issues.push(
        `Resultados contêm datas fora do período solicitado (${expectedStart} a ${expectedEnd}). ` +
        `Encontrado: ${sorted[0]} a ${sorted[sorted.length - 1]}.`
      );
    }
  }

  // Calcular dias faltantes (para queries de grupo por dia)
  const missingDays: string[] = [];
  if (foundDateCol && /GROUP\s+BY/i.test(sql)) {
    const startDate = new Date(expectedStart);
    const endDate = new Date(expectedEnd);
    const dateSet = new Set(dates);

    const current = new Date(startDate);
    while (current <= endDate) {
      const dateStr = current.toISOString().slice(0, 10);
      if (!dateSet.has(dateStr)) {
        missingDays.push(dateStr);
      }
      current.setDate(current.getDate() + 1);
    }
  }

  // Contar nulls
  const nullCount = results.reduce((count, row) => {
    return count + Object.values(row).filter((v) => v === null || v === undefined).length;
  }, 0);

  const summary = buildSummary(results.length, expectedStart, expectedEnd, dateRangeFound, missingDays, hasOutOfRange);

  return {
    is_valid: issues.length === 0,
    issues,
    data_quality: {
      row_count: results.length,
      date_range_found: dateRangeFound,
      date_range_expected: { min: expectedStart, max: expectedEnd },
      has_out_of_range_data: hasOutOfRange,
      missing_days: missingDays,
      null_count: nullCount,
    },
    summary_for_model: summary,
  };
}

function buildSummary(
  rowCount: number,
  expectedStart: string,
  expectedEnd: string,
  dateRangeFound: { min: string; max: string } | null,
  missingDays: string[],
  hasOutOfRange: boolean
): string {
  const parts: string[] = [];

  parts.push(`Encontrados ${rowCount} registros para o período ${expectedStart} a ${expectedEnd}.`);

  if (dateRangeFound) {
    parts.push(`Range efetivo dos dados: ${dateRangeFound.min} a ${dateRangeFound.max}.`);
  }

  if (hasOutOfRange) {
    parts.push("⚠️ ATENÇÃO: Há dados fora do período solicitado.");
  }

  if (missingDays.length > 0 && missingDays.length <= 10) {
    parts.push(`Dias sem dados no período: ${missingDays.join(", ")} (0 registros — reporte como zero, não omita).`);
  } else if (missingDays.length > 10) {
    parts.push(`${missingDays.length} dias sem dados no período (reporte como zero).`);
  }

  return parts.join(" ");
}
