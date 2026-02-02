// Registro central de configurações de gráficos de crescimento disponíveis
// Baseado nos dados importados do banco de dados (WHO e CDC)

export interface ChartRegistryConfig {
  label: string; // Nome exibido no dropdown
  dbType: 'wfa' | 'lhfa' | 'bmifa' | 'hcfa' | 'wfl' | 'wfh';
  source: 'WHO' | 'CDC';
  recommendedAgeMin?: number; // Idade mínima recomendada (meses)
  recommendedAgeMax?: number; // Idade máxima recomendada (meses)
  isXAxisLength?: boolean; // true se eixo X é altura/comprimento (não idade)
  xAxisLabel: string; // Label do eixo X
  yAxisLabel: string; // Label do eixo Y
  value: string; // Identificador único para o gráfico
}

/**
 * Lista completa de gráficos disponíveis baseada nos dados do banco
 * Apenas WHO e CDC (não incluir Unicamp/Síndrome de Down por enquanto)
 */
export const AVAILABLE_CHARTS: ChartRegistryConfig[] = [
  // ========== PESO PARA IDADE (Weight for Age) ==========
  {
    label: 'Peso para idade (0-2 anos) - OMS',
    dbType: 'wfa',
    source: 'WHO',
    recommendedAgeMax: 24,
    xAxisLabel: 'Idade (Meses)',
    yAxisLabel: 'Peso (kg)',
    value: 'wfa_who_0_2',
  },
  {
    label: 'Peso para idade (0-5 anos) - OMS',
    dbType: 'wfa',
    source: 'WHO',
    recommendedAgeMax: 60,
    xAxisLabel: 'Idade',
    yAxisLabel: 'Peso (kg)',
    value: 'wfa_who_0_5',
  },
  {
    label: 'Peso para idade (2-20 anos) - CDC',
    dbType: 'wfa',
    source: 'CDC',
    recommendedAgeMin: 24,
    recommendedAgeMax: 240,
    xAxisLabel: 'Idade (Anos)',
    yAxisLabel: 'Peso (kg)',
    value: 'wfa_cdc_2_20',
  },

  // ========== ESTATURA/COMPRIMENTO PARA IDADE (Length/Height for Age) ==========
  {
    label: 'Comprimento para idade (0-2 anos) - OMS',
    dbType: 'lhfa',
    source: 'WHO',
    recommendedAgeMax: 24,
    xAxisLabel: 'Idade (Meses)',
    yAxisLabel: 'Comprimento (cm)',
    value: 'lhfa_who_0_2',
  },
  {
    label: 'Estatura para idade (0-5 anos) - OMS',
    dbType: 'lhfa',
    source: 'WHO',
    recommendedAgeMax: 60,
    xAxisLabel: 'Idade',
    yAxisLabel: 'Estatura (cm)',
    value: 'lhfa_who_0_5',
  },
  {
    label: 'Estatura para idade (2-5 anos) - OMS',
    dbType: 'lhfa',
    source: 'WHO',
    recommendedAgeMin: 24,
    recommendedAgeMax: 60,
    xAxisLabel: 'Idade',
    yAxisLabel: 'Estatura (cm)',
    value: 'lhfa_who_2_5',
  },
  {
    label: 'Estatura para idade (2-20 anos) - CDC',
    dbType: 'lhfa',
    source: 'CDC',
    recommendedAgeMin: 24,
    recommendedAgeMax: 240,
    xAxisLabel: 'Idade (Anos)',
    yAxisLabel: 'Estatura (cm)',
    value: 'lhfa_cdc_2_20',
  },

  // ========== IMC PARA IDADE (BMI for Age) ==========
  {
    label: 'IMC para idade (0-2 anos) - OMS',
    dbType: 'bmifa',
    source: 'WHO',
    recommendedAgeMax: 24,
    xAxisLabel: 'Idade (Meses)',
    yAxisLabel: 'IMC',
    value: 'bmifa_who_0_2',
  },
  {
    label: 'IMC para idade (0-5 anos) - OMS',
    dbType: 'bmifa',
    source: 'WHO',
    recommendedAgeMax: 60,
    xAxisLabel: 'Idade',
    yAxisLabel: 'IMC',
    value: 'bmifa_who_0_5',
  },
  {
    label: 'IMC para idade (2-5 anos) - OMS',
    dbType: 'bmifa',
    source: 'WHO',
    recommendedAgeMin: 24,
    recommendedAgeMax: 60,
    xAxisLabel: 'Idade',
    yAxisLabel: 'IMC',
    value: 'bmifa_who_2_5',
  },
  {
    label: 'IMC para idade (2-20 anos) - CDC',
    dbType: 'bmifa',
    source: 'CDC',
    recommendedAgeMin: 24,
    recommendedAgeMax: 240,
    xAxisLabel: 'Idade (Anos)',
    yAxisLabel: 'IMC',
    value: 'bmifa_cdc_2_20',
  },

  // ========== PERÍMETRO CEFÁLICO PARA IDADE (Head Circumference for Age) ==========
  {
    label: 'Perímetro Cefálico para idade (0-5 anos) - OMS',
    dbType: 'hcfa',
    source: 'WHO',
    recommendedAgeMax: 60,
    xAxisLabel: 'Idade',
    yAxisLabel: 'Perímetro Cefálico (cm)',
    value: 'hcfa_who_0_5',
  },

  // ========== PESO PARA COMPRIMENTO/ESTATURA (Weight for Length/Height) ==========
  {
    label: 'Peso para comprimento (0-2 anos) - OMS',
    dbType: 'wfl',
    source: 'WHO',
    recommendedAgeMax: 24,
    isXAxisLength: true,
    xAxisLabel: 'Comprimento (cm)',
    yAxisLabel: 'Peso (kg)',
    value: 'wfl_who_0_2',
  },
  {
    label: 'Peso para estatura (2-5 anos) - OMS',
    dbType: 'wfh',
    source: 'WHO',
    recommendedAgeMin: 24,
    recommendedAgeMax: 60,
    isXAxisLength: true,
    xAxisLabel: 'Estatura (cm)',
    yAxisLabel: 'Peso (kg)',
    value: 'wfh_who_2_5',
  },
];

/**
 * Busca uma configuração de gráfico pelo valor
 */
export function getChartConfig(value: string): ChartRegistryConfig | undefined {
  return AVAILABLE_CHARTS.find(chart => chart.value === value);
}

/**
 * Filtra gráficos disponíveis baseado na idade do paciente
 */
export function getRecommendedCharts(ageMonths: number): ChartRegistryConfig[] {
  return AVAILABLE_CHARTS.filter(chart => {
    if (chart.recommendedAgeMin && ageMonths < chart.recommendedAgeMin) return false;
    if (chart.recommendedAgeMax && ageMonths > chart.recommendedAgeMax) return false;
    return true;
  });
}
