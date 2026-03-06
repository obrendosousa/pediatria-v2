// Utilitário para mapear campos JSON para estrutura do banco de dados

import { GrowthFileMetadata } from './parseGrowthFile';

export interface GrowthStandardRow {
  source: string;
  type: string;
  gender: string;
  age_range?: string | null;
  age_months?: number | null;
  x_value?: number | null;
  l?: number | null;
  m?: number | null;
  s?: number | null;
  sd0?: number | null;
  sd1?: number | null;
  sd2?: number | null;
  sd3?: number | null;
  sd_neg1?: number | null;
  sd_neg2?: number | null;
  sd_neg3?: number | null;
  p3?: number | null;
  p15?: number | null;
  p50?: number | null;
  p85?: number | null;
  p97?: number | null;
}

/**
 * Interface esperada do JSON do pygrowup
 */
export interface PyGrowupJsonRow {
  Month?: number;
  Week?: number;  // Para arquivos _0_13_ (dados semanais)
  Length?: number; // Para curvas peso x comprimento/altura
  Height?: number; // Para curvas peso x altura
  L?: number;
  M?: number;
  S?: number;
  SD0?: number;
  SD1?: number;
  SD2?: number;
  SD3?: number;
  SD2neg?: number;
  SD3neg?: number;
  SD1neg?: number; // Alguns arquivos podem ter
  P3?: number;
  P15?: number;
  P50?: number;
  P85?: number;
  P97?: number;
}

/**
 * Mapeia uma linha do JSON para o formato do banco de dados
 */
export function mapJsonRowToDb(
  jsonRow: PyGrowupJsonRow,
  metadata: GrowthFileMetadata
): GrowthStandardRow {
  const row: GrowthStandardRow = {
    source: metadata.source,
    type: metadata.type,
    gender: metadata.gender,
    age_range: metadata.ageRange || null,
  };

  // Para curvas baseadas em idade, usar Month como age_months
  if (jsonRow.Month !== undefined && jsonRow.Month !== null) {
    row.age_months = jsonRow.Month;
  } else if (jsonRow.Week !== undefined && jsonRow.Week !== null) {
    // Arquivos _0_13_ usam semanas (0-13), converter para meses
    row.age_months = Math.round((Number(jsonRow.Week) / 4.345) * 100) / 100;
  }

  // Para curvas peso x altura/comprimento, usar Length/Height como x_value
  if (jsonRow.Length !== undefined && jsonRow.Length !== null) {
    row.x_value = jsonRow.Length;
  } else if (jsonRow.Height !== undefined && jsonRow.Height !== null) {
    row.x_value = jsonRow.Height;
  }

  // Parâmetros LMS
  if (jsonRow.L !== undefined && jsonRow.L !== null) row.l = jsonRow.L;
  if (jsonRow.M !== undefined && jsonRow.M !== null) row.m = jsonRow.M;
  if (jsonRow.S !== undefined && jsonRow.S !== null) row.s = jsonRow.S;

  // Desvios padrão
  if (jsonRow.SD0 !== undefined && jsonRow.SD0 !== null) row.sd0 = jsonRow.SD0;
  if (jsonRow.SD1 !== undefined && jsonRow.SD1 !== null) row.sd1 = jsonRow.SD1;
  if (jsonRow.SD2 !== undefined && jsonRow.SD2 !== null) row.sd2 = jsonRow.SD2;
  if (jsonRow.SD3 !== undefined && jsonRow.SD3 !== null) row.sd3 = jsonRow.SD3;
  
  // Desvios padrão negativos
  if (jsonRow.SD1neg !== undefined && jsonRow.SD1neg !== null) {
    row.sd_neg1 = jsonRow.SD1neg;
  }
  if (jsonRow.SD2neg !== undefined && jsonRow.SD2neg !== null) {
    row.sd_neg2 = jsonRow.SD2neg;
  }
  if (jsonRow.SD3neg !== undefined && jsonRow.SD3neg !== null) {
    row.sd_neg3 = jsonRow.SD3neg;
  }

  // Se não temos SD1neg mas temos SD1, calcular SD1neg = 2*SD0 - SD1
  if (!row.sd_neg1 && row.sd0 && row.sd1) {
    row.sd_neg1 = 2 * row.sd0 - row.sd1;
  }
  // Se não temos SD2neg mas temos SD2, calcular SD2neg = 2*SD0 - SD2
  if (!row.sd_neg2 && row.sd0 && row.sd2) {
    row.sd_neg2 = 2 * row.sd0 - row.sd2;
  }
  // Se não temos SD3neg mas temos SD3, calcular SD3neg = 2*SD0 - SD3
  if (!row.sd_neg3 && row.sd0 && row.sd3) {
    row.sd_neg3 = 2 * row.sd0 - row.sd3;
  }

  // Percentis (se vierem diretamente do JSON)
  if (jsonRow.P3 !== undefined && jsonRow.P3 !== null) row.p3 = jsonRow.P3;
  if (jsonRow.P15 !== undefined && jsonRow.P15 !== null) row.p15 = jsonRow.P15;
  if (jsonRow.P50 !== undefined && jsonRow.P50 !== null) row.p50 = jsonRow.P50;
  if (jsonRow.P85 !== undefined && jsonRow.P85 !== null) row.p85 = jsonRow.P85;
  if (jsonRow.P97 !== undefined && jsonRow.P97 !== null) row.p97 = jsonRow.P97;

  // Se temos parâmetros LMS, calcular percentis faltantes via fórmula Box-Cox (OMS)
  // X = M × (1 + L × S × z)^(1/L)   ou   X = M × exp(S × z) quando L ≈ 0
  const L = Number(row.l);
  const M = Number(row.m);
  const S = Number(row.s);
  if (!isNaN(L) && !isNaN(M) && !isNaN(S) && M > 0) {
    const calcLMS = (z: number) => {
      let val: number;
      if (Math.abs(L) < 0.001) {
        val = M * Math.exp(S * z);
      } else {
        val = M * Math.pow(1 + L * S * z, 1 / L);
      }
      return Math.round(val * 10) / 10;
    };

    if (!row.p3)  row.p3  = calcLMS(-1.88079);
    if (!row.p15) row.p15 = calcLMS(-1.03643);
    if (!row.p50) row.p50 = calcLMS(0);
    if (!row.p85) row.p85 = calcLMS(1.03643);
    if (!row.p97) row.p97 = calcLMS(1.88079);
  } else {
    // Fallback: Se não temos LMS, usar SD0 como P50
    if (!row.p50 && row.sd0) {
      row.p50 = row.sd0;
    }
  }

  return row;
}

/**
 * Valida se uma linha mapeada é válida antes de inserir no banco
 */
export function validateRow(row: GrowthStandardRow): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validar campos obrigatórios
  if (!row.source) errors.push('source é obrigatório');
  if (!row.type) errors.push('type é obrigatório');
  if (!row.gender) errors.push('gender é obrigatório');

  // Validar que temos pelo menos age_months OU x_value
  if (!row.age_months && row.x_value === null && row.x_value === undefined) {
    errors.push('age_months ou x_value deve ser fornecido');
  }

  // Validar que temos pelo menos alguns dados (LMS ou SDs)
  const hasLMS = row.l !== null && row.m !== null && row.s !== null;
  const hasSDs = row.sd0 !== null || row.sd1 !== null || row.sd2 !== null;
  const hasPercentiles = row.p3 !== null || row.p50 !== null || row.p97 !== null;

  if (!hasLMS && !hasSDs && !hasPercentiles) {
    errors.push('Linha deve ter pelo menos parâmetros LMS, SDs ou percentis');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
