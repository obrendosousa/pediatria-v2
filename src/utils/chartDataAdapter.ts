import { AnthropometryEntry } from '@/types/anthropometry';
import { ChartRegistryConfig } from '@/config/growthChartsRegistry';
import { calculateAgeInMonths } from '@/utils/growthChartUtils';

interface PrepareDataProps {
  entries: AnthropometryEntry[];
  chartConfig: ChartRegistryConfig;
  patientBirthDate: string; // ISO Date (YYYY-MM-DD)
}

/**
 * Transforma o histórico de medições do banco (AnthropometryEntry)
 * em pontos X/Y que o gráfico entende.
 */
export function preparePatientPoints(props: PrepareDataProps) {
  const { entries, chartConfig, patientBirthDate } = props;

  // Se não houver data de nascimento, não dá para calcular idade
  if (!patientBirthDate) return [];

  return entries
    .map(entry => {
      let xValue: number | null = null;
      let yValue: number | null = null;

      // 1. CALCULAR O EIXO X (Horizontal)
      if (chartConfig.isXAxisLength) {
        // Gráficos Peso x Altura: O X é a altura da criança
        xValue = entry.height_cm || null;
      } else {
        // Gráficos de Tempo: O X é a idade em meses
        xValue = calculateAgeInMonths(patientBirthDate, entry.measurement_date);
      }

      // 2. CALCULAR O EIXO Y (Vertical)
      switch (chartConfig.dbType) {
        case 'wfa': // Peso por idade (Weight for Age)
        case 'wfl': // Peso por comprimento
        case 'wfh': // Peso por altura
          yValue = entry.weight_kg || null;
          break;
        case 'lhfa': // Altura por idade (Length/Height for Age)
          yValue = entry.height_cm || null;
          break;
        case 'bmifa': // IMC por idade
          yValue = entry.bmi || null;
          break;
        case 'hcfa': // Perímetro Cefálico
          yValue = entry.head_circumference_cm || null;
          break;
      }

      // Se falta algum dado (ex: gráfico de peso mas medição não tem peso), ignora este ponto
      if (xValue === null || yValue === null) return null;

      // Se o ponto estiver muito fora da faixa do gráfico, podemos filtrar aqui ou deixar o gráfico cortar
      // Para WHO 0-5 anos, filtramos idades negativas ou absurdas
      if (!chartConfig.isXAxisLength && xValue < 0) return null;

      return {
        x: xValue,
        y: yValue,
        date: entry.measurement_date,
        entryId: entry.id || 0,
        // Metadados extras para aparecer no Tooltip quando passar o mouse
        weight: entry.weight_kg,
        height: entry.height_cm,
        bmi: entry.bmi
      };
    })
    .filter((point): point is NonNullable<typeof point> => point !== null) // Remove os nulos
    .sort((a, b) => a.x - b.x); // Ordena cronologicamente para a linha não ficar riscada
}