// Registro central de configurações de gráficos de crescimento disponíveis

export interface ChartRegistryConfig {
  label: string;
  dbType: 'wfa' | 'lhfa' | 'bmifa' | 'hcfa' | 'wfl' | 'wfh';
  source: 'WHO' | 'CDC' | 'UNICAMP';
  dbAgeRange: string;          // age_range exato na tabela growth_standards
  recommendedAgeMin?: number;  // Idade mínima recomendada (meses)
  recommendedAgeMax?: number;  // Idade máxima recomendada (meses)
  isXAxisLength?: boolean;     // true se eixo X é comprimento/altura (não idade)
  xAxisLabel: string;
  yAxisLabel: string;
  value: string;               // Identificador único
}

export const AVAILABLE_CHARTS: ChartRegistryConfig[] = [

  // ── 1. PESO PARA IDADE (OMS 0-5) ──────────────────────────────────────────
  {
    label: 'Peso para idade (0-5 anos) — OMS',
    dbType: 'wfa',
    source: 'WHO',
    dbAgeRange: '0_5',
    recommendedAgeMax: 60,
    xAxisLabel: 'Idade',
    yAxisLabel: 'Peso (kg)',
    value: 'wfa_who_0_5',
  },

  // ── 2. PESO PARA IDADE (OMS 5-10 — WHO 2007) ─────────────────────────────
  {
    label: 'Peso para idade (5-10 anos) — OMS',
    dbType: 'wfa',
    source: 'WHO',
    dbAgeRange: '5_10',
    recommendedAgeMin: 60,
    recommendedAgeMax: 120,
    xAxisLabel: 'Idade',
    yAxisLabel: 'Peso (kg)',
    value: 'wfa_who_5_10',
  },

  // ── 3. COMPRIMENTO PARA IDADE (OMS 0-2) ───────────────────────────────────
  {
    label: 'Comprimento para idade (0-2 anos) — OMS',
    dbType: 'lhfa',
    source: 'WHO',
    dbAgeRange: '0_2',
    recommendedAgeMax: 24,
    xAxisLabel: 'Idade',
    yAxisLabel: 'Comprimento (cm)',
    value: 'lhfa_who_0_2',
  },

  // ── 4. ESTATURA PARA IDADE (OMS 2-5) ──────────────────────────────────────
  {
    label: 'Estatura para idade (2-5 anos) — OMS',
    dbType: 'lhfa',
    source: 'WHO',
    dbAgeRange: '2_5',
    recommendedAgeMin: 24,
    recommendedAgeMax: 60,
    xAxisLabel: 'Idade',
    yAxisLabel: 'Estatura (cm)',
    value: 'lhfa_who_2_5',
  },

  // ── 5. ESTATURA PARA IDADE (OMS 5-19 — WHO 2007) ─────────────────────────
  {
    label: 'Estatura para idade (5-19 anos) — OMS',
    dbType: 'lhfa',
    source: 'WHO',
    dbAgeRange: '5_19',
    recommendedAgeMin: 60,
    recommendedAgeMax: 228,
    xAxisLabel: 'Idade',
    yAxisLabel: 'Estatura (cm)',
    value: 'lhfa_who_5_19',
  },

  // ── 6. IMC PARA IDADE (OMS 0-2) ──────────────────────────────────────────
  {
    label: 'IMC para idade (0-2 anos) — OMS',
    dbType: 'bmifa',
    source: 'WHO',
    dbAgeRange: '0_2',
    recommendedAgeMax: 24,
    xAxisLabel: 'Idade',
    yAxisLabel: 'IMC (kg/m²)',
    value: 'bmifa_who_0_2',
  },

  // ── 7. IMC PARA IDADE (OMS 2-5) ──────────────────────────────────────────
  {
    label: 'IMC para idade (2-5 anos) — OMS',
    dbType: 'bmifa',
    source: 'WHO',
    dbAgeRange: '2_5',
    recommendedAgeMin: 24,
    recommendedAgeMax: 60,
    xAxisLabel: 'Idade',
    yAxisLabel: 'IMC (kg/m²)',
    value: 'bmifa_who_2_5',
  },

  // ── 8. IMC PARA IDADE (OMS 5-19 — WHO 2007) ─────────────────────────────
  {
    label: 'IMC para idade (5-19 anos) — OMS',
    dbType: 'bmifa',
    source: 'WHO',
    dbAgeRange: '5_19',
    recommendedAgeMin: 60,
    recommendedAgeMax: 228,
    xAxisLabel: 'Idade',
    yAxisLabel: 'IMC (kg/m²)',
    value: 'bmifa_who_5_19',
  },

  // ── 9. PERÍMETRO CEFÁLICO (OMS 0-5) ──────────────────────────────────────
  {
    label: 'Perímetro Cefálico para idade (0-5 anos) — OMS',
    dbType: 'hcfa',
    source: 'WHO',
    dbAgeRange: '0_5',
    recommendedAgeMax: 60,
    xAxisLabel: 'Idade',
    yAxisLabel: 'PC (cm)',
    value: 'hcfa_who_0_5',
  },

  // ── 10. PESO PARA COMPRIMENTO (OMS 0-2) ──────────────────────────────────
  {
    label: 'Peso para comprimento (0-2 anos) — OMS',
    dbType: 'wfl',
    source: 'WHO',
    dbAgeRange: '0_2',
    recommendedAgeMax: 24,
    isXAxisLength: true,
    xAxisLabel: 'Comprimento (cm)',
    yAxisLabel: 'Peso (kg)',
    value: 'wfl_who_0_2',
  },

  // ── 11. PESO PARA ESTATURA (OMS 2-5) ─────────────────────────────────────
  {
    label: 'Peso para estatura (2-5 anos) — OMS',
    dbType: 'wfh',
    source: 'WHO',
    dbAgeRange: '2_5',
    recommendedAgeMin: 24,
    recommendedAgeMax: 60,
    isXAxisLength: true,
    xAxisLabel: 'Estatura (cm)',
    yAxisLabel: 'Peso (kg)',
    value: 'wfh_who_2_5',
  },

  // ── 12. PESO DOWN (0-3) — UNICAMP ────────────────────────────────────────
  {
    label: 'Peso para idade Down (0-3 anos) — Unicamp',
    dbType: 'wfa',
    source: 'UNICAMP',
    dbAgeRange: '0_3',
    recommendedAgeMax: 36,
    xAxisLabel: 'Idade',
    yAxisLabel: 'Peso (kg)',
    value: 'wfa_unicamp_0_3',
  },

  // ── 13. ESTATURA DOWN (0-3) — UNICAMP ────────────────────────────────────
  {
    label: 'Estatura para idade Down (0-3 anos) — Unicamp',
    dbType: 'lhfa',
    source: 'UNICAMP',
    dbAgeRange: '0_3',
    recommendedAgeMax: 36,
    xAxisLabel: 'Idade',
    yAxisLabel: 'Estatura (cm)',
    value: 'lhfa_unicamp_0_3',
  },

  // ── 14. PC DOWN (0-2) — UNICAMP ──────────────────────────────────────────
  {
    label: 'Perímetro Cefálico Down (0-2 anos) — Unicamp',
    dbType: 'hcfa',
    source: 'UNICAMP',
    dbAgeRange: '0_2',
    recommendedAgeMax: 24,
    xAxisLabel: 'Idade',
    yAxisLabel: 'PC (cm)',
    value: 'hcfa_unicamp_0_2',
  },

  // ── 15. ESTATURA DOWN (3-20) — UNICAMP ───────────────────────────────────
  {
    label: 'Estatura para idade Down (3-20 anos) — Unicamp',
    dbType: 'lhfa',
    source: 'UNICAMP',
    dbAgeRange: '3_20',
    recommendedAgeMin: 36,
    recommendedAgeMax: 240,
    xAxisLabel: 'Idade',
    yAxisLabel: 'Estatura (cm)',
    value: 'lhfa_unicamp_3_20',
  },

  // ── 16. PESO DOWN (3-20) — UNICAMP ───────────────────────────────────────
  {
    label: 'Peso para idade Down (3-20 anos) — Unicamp',
    dbType: 'wfa',
    source: 'UNICAMP',
    dbAgeRange: '3_20',
    recommendedAgeMin: 36,
    recommendedAgeMax: 240,
    xAxisLabel: 'Idade',
    yAxisLabel: 'Peso (kg)',
    value: 'wfa_unicamp_3_20',
  },

  // ── 17. IMC DOWN (2-18) — UNICAMP ────────────────────────────────────────
  {
    label: 'IMC para idade Down (2-18 anos) — Unicamp',
    dbType: 'bmifa',
    source: 'UNICAMP',
    dbAgeRange: '2_18',
    recommendedAgeMin: 24,
    recommendedAgeMax: 216,
    xAxisLabel: 'Idade',
    yAxisLabel: 'IMC (kg/m²)',
    value: 'bmifa_unicamp_2_18',
  },

  // ── 18. PESO PARA IDADE (CDC 2-20) ───────────────────────────────────────
  {
    label: 'Peso para idade (2-20 anos) — CDC',
    dbType: 'wfa',
    source: 'CDC',
    dbAgeRange: '2_20',
    recommendedAgeMin: 24,
    recommendedAgeMax: 240,
    xAxisLabel: 'Idade',
    yAxisLabel: 'Peso (kg)',
    value: 'wfa_cdc_2_20',
  },
];

export function getChartConfig(value: string): ChartRegistryConfig | undefined {
  return AVAILABLE_CHARTS.find(c => c.value === value);
}

export function getRecommendedCharts(ageMonths: number): ChartRegistryConfig[] {
  return AVAILABLE_CHARTS.filter(c => {
    if (c.recommendedAgeMin !== undefined && ageMonths < c.recommendedAgeMin) return false;
    if (c.recommendedAgeMax !== undefined && ageMonths > c.recommendedAgeMax) return false;
    return true;
  });
}
