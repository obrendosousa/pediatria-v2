import { useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
const supabase = createClient();
import { GrowthStandardRow, ReferenceLine, DisplayMode } from '@/types/anthropometry';
import { ChartRegistryConfig } from '@/config/growthChartsRegistry';

/**
 * Calcula um valor de percentil a partir dos parâmetros LMS (Box-Cox).
 * Fórmula OMS: X = M × (1 + L × S × z)^(1/L)
 * Quando L = 0: X = M × exp(S × z)
 *
 * @param L - Lambda (Box-Cox power)
 * @param M - Mediana
 * @param S - Coeficiente de variação generalizado
 * @param z - Z-score correspondente ao percentil desejado
 * @returns Valor calculado arredondado para 1 casa decimal
 */
function lmsToValue(L: number, M: number, S: number, z: number): number {
  let value: number;
  if (Math.abs(L) < 0.001) {
    // Caso especial: L ≈ 0, usar forma exponencial
    value = M * Math.exp(S * z);
  } else {
    value = M * Math.pow(1 + L * S * z, 1 / L);
  }
  return Math.round(value * 10) / 10; // 1 casa decimal
}

// Z-scores exatos para cada percentil (distribuição normal padrão)
const PERCENTILE_Z: Record<string, number> = {
  p3:  -1.88079,
  p15: -1.03643,
  p50:  0,
  p85:  1.03643,
  p97:  1.88079,
};

export function useGrowthReferenceData() {
  const [rawData, setRawData] = useState<GrowthStandardRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Busca dados de referência com base no gênero + configuração do gráfico selecionado
  const fetchReferenceData = useCallback(async (
    gender: 'male' | 'female',
    chartConfig: ChartRegistryConfig
  ) => {
    setIsLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('growth_standards')
        .select('*')
        .eq('source', chartConfig.source)
        .eq('type', chartConfig.dbType)
        .eq('age_range', chartConfig.dbAgeRange)
        .eq('gender', gender);

      // Ordena pelo eixo X correto: x_value (comprimento) ou age_months (idade)
      if (chartConfig.isXAxisLength) {
        query = query.order('x_value', { ascending: true });
      } else {
        query = query.order('age_months', { ascending: true });
      }

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      setRawData((data as GrowthStandardRow[]) ?? []);
    } catch (err: any) {
      console.error('[useGrowthReferenceData]', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Transforma rawData em linhas de referência coloridas para o gráfico
  const getReferenceLines = useCallback((
    displayMode: DisplayMode,
    isXAxisLength?: boolean
  ): ReferenceLine[] => {
    if (rawData.length === 0) return [];

    // Mapeia uma coluna do banco para pontos {x, y}
    const mapToPoints = (key: keyof GrowthStandardRow) =>
      rawData
        .map(row => ({
          x: isXAxisLength ? (row.x_value ?? 0) : (row.age_months ?? 0),
          y: Number(row[key] ?? 0),
        }))
        .filter(p => p.x >= 0 && !isNaN(p.y) && p.y > 0);

    // Calcula pontos de percentil usando LMS quando os campos p3/p15/p85/p97 são null
    const mapPercentileFromLMS = (percentileKey: string) =>
      rawData
        .map(row => {
          const x = isXAxisLength ? (row.x_value ?? 0) : (row.age_months ?? 0);

          // Se o percentil já existe no banco, usar diretamente
          const directValue = Number((row as any)[percentileKey] ?? 0);
          if (directValue > 0) {
            return { x, y: directValue };
          }

          // Senão, calcular a partir dos parâmetros LMS
          const L = Number(row.l ?? null);
          const M = Number(row.m ?? null);
          const S = Number(row.s ?? null);
          const z = PERCENTILE_Z[percentileKey];

          if (isNaN(L) || isNaN(M) || isNaN(S) || M <= 0 || z === undefined) {
            return { x, y: 0 };
          }

          return { x, y: lmsToValue(L, M, S, z) };
        })
        .filter(p => p.x >= 0 && !isNaN(p.y) && p.y > 0);

    // Paleta: vermelho (extremos), amarelo (alerta), azul (mediana)
    if (displayMode === 'Z_SCORE') {
      return [
        { label: 'Z-3', color: '#dc2626', data: mapToPoints('sd_neg3') },
        { label: 'Z-2', color: '#ef4444', data: mapToPoints('sd_neg2') },
        { label: 'Z-1', color: '#f59e0b', data: mapToPoints('sd_neg1') },
        { label: 'Z0',  color: '#3b82f6', data: mapToPoints('sd0') },
        { label: 'Z+1', color: '#f59e0b', data: mapToPoints('sd1') },
        { label: 'Z+2', color: '#ef4444', data: mapToPoints('sd2') },
        { label: 'Z+3', color: '#dc2626', data: mapToPoints('sd3') },
      ];
    } else {
      return [
        { label: 'P3',  color: '#dc2626', data: mapPercentileFromLMS('p3') },
        { label: 'P15', color: '#f59e0b', data: mapPercentileFromLMS('p15') },
        { label: 'P50', color: '#3b82f6', data: mapPercentileFromLMS('p50') },
        { label: 'P85', color: '#f59e0b', data: mapPercentileFromLMS('p85') },
        { label: 'P97', color: '#dc2626', data: mapPercentileFromLMS('p97') },
      ];
    }
  }, [rawData]);

  return {
    isLoading,
    error,
    fetchReferenceData,
    getReferenceLines,
    hasData: rawData.length > 0,
  };
}
