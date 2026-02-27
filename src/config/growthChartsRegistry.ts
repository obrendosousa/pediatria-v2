// Registro central de configurações de gráficos de crescimento disponíveis

export interface ChartRegistryConfig {
  label: string;
  dbType: 'wfa' | 'lhfa' | 'bmifa' | 'hcfa' | 'wfl' | 'wfh';
  source: 'WHO' | 'CDC';
  dbAgeRange: string;          // age_range exato na tabela growth_standards
  recommendedAgeMin?: number;  // Idade mínima recomendada (meses)
  recommendedAgeMax?: number;  // Idade máxima recomendada (meses)
  isXAxisLength?: boolean;     // true se eixo X é comprimento/altura (não idade)
  xAxisLabel: string;
  yAxisLabel: string;
  value: string;               // Identificador único
}

export const AVAILABLE_CHARTS: ChartRegistryConfig[] = [

  // ── PESO PARA IDADE ──────────────────────────────────────────────────────
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

  // ── ESTATURA / COMPRIMENTO PARA IDADE ─────────────────────────────────────
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
  {
    label: 'Estatura para idade (0-5 anos) — OMS',
    dbType: 'lhfa',
    source: 'WHO',
    dbAgeRange: '0_5',
    recommendedAgeMax: 60,
    xAxisLabel: 'Idade',
    yAxisLabel: 'Estatura (cm)',
    value: 'lhfa_who_0_5',
  },
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
  {
    label: 'Estatura para idade (2-20 anos) — CDC',
    dbType: 'lhfa',
    source: 'CDC',
    dbAgeRange: '2_20',
    recommendedAgeMin: 24,
    recommendedAgeMax: 240,
    xAxisLabel: 'Idade',
    yAxisLabel: 'Estatura (cm)',
    value: 'lhfa_cdc_2_20',
  },

  // ── IMC PARA IDADE ────────────────────────────────────────────────────────
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
  {
    label: 'IMC para idade (2-20 anos) — CDC',
    dbType: 'bmifa',
    source: 'CDC',
    dbAgeRange: '2_20',
    recommendedAgeMin: 24,
    recommendedAgeMax: 240,
    xAxisLabel: 'Idade',
    yAxisLabel: 'IMC (kg/m²)',
    value: 'bmifa_cdc_2_20',
  },

  // ── PERÍMETRO CEFÁLICO PARA IDADE ─────────────────────────────────────────
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

  // ── PESO PARA COMPRIMENTO / ESTATURA ─────────────────────────────────────
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
