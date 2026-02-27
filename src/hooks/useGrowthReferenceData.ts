import { useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
const supabase = createClient();
import { GrowthStandardRow, ReferenceLine, DisplayMode } from '@/types/anthropometry';
import { ChartRegistryConfig } from '@/config/growthChartsRegistry';

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
        .filter(p => p.x > 0 && !isNaN(p.y));

    // Paleta iClinic: vermelho (extremos), laranja (alerta), azul (média)
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
        { label: 'P3',  color: '#dc2626', data: mapToPoints('p3') },
        { label: 'P15', color: '#f59e0b', data: mapToPoints('p15') },
        { label: 'P50', color: '#3b82f6', data: mapToPoints('p50') },
        { label: 'P85', color: '#f59e0b', data: mapToPoints('p85') },
        { label: 'P97', color: '#dc2626', data: mapToPoints('p97') },
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
