import { useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
const supabase = createClient();
import { GrowthStandardRow, ReferenceLine, DisplayMode } from '@/types/anthropometry';

export function useGrowthReferenceData() {
  const [rawData, setRawData] = useState<GrowthStandardRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReferenceData = useCallback(async (gender: 'male' | 'female') => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('growth_standards')
        .select('*')
        .eq('source', 'WHO')
        .eq('type', 'wfa')
        .eq('age_range', '0_5')
        .eq('gender', gender)
        .order('age_months', { ascending: true });

      if (error) throw error;
      setRawData(data as GrowthStandardRow[] || []);
    } catch (err: any) {
      console.error('Erro:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getReferenceLines = useCallback((displayMode: DisplayMode): ReferenceLine[] => {
    if (rawData.length === 0) return [];

    // Helper: mapeia o banco para o formato do gráfico
    const mapToPoints = (key: keyof GrowthStandardRow) => 
      rawData.map(row => ({ x: row.age_months ?? 0, y: Number(row[key]) }));

    // Cores estilo iClinic:
    // Vermelho (Extremos), Amarelo (Alerta), Azul (Média)
    const colorRed = '#ef4444';
    const colorYellow = '#f59e0b'; // Amarelo/Laranja
    const colorBlue = '#3b82f6';   // Azul

    if (displayMode === 'Z_SCORE') {
      return [
        // Z-3 e Z+3 (Pretos) foram removidos para ficar "clean" (5 linhas)
        { label: 'Z-2', color: colorRed,    data: mapToPoints('sd_neg2') },
        { label: 'Z-1', color: colorYellow, data: mapToPoints('sd_neg1') },
        { label: 'Z0',  color: colorBlue,   data: mapToPoints('sd0') }, // Média Azul
        { label: 'Z+1', color: colorYellow, data: mapToPoints('sd1') },
        { label: 'Z+2', color: colorRed,    data: mapToPoints('sd2') }
      ];
    } else {
      // Percentil (Também ajustado para cores iClinic)
      return [
        { label: 'P3',  color: colorRed,    data: mapToPoints('p3') },
        { label: 'P15', color: colorYellow, data: mapToPoints('p15') },
        { label: 'P50', color: colorBlue,   data: mapToPoints('p50') },
        { label: 'P85', color: colorYellow, data: mapToPoints('p85') },
        { label: 'P97', color: colorRed,    data: mapToPoints('p97') }
      ];
    }
  }, [rawData]);

  return { isLoading, error, fetchReferenceData, getReferenceLines, hasData: rawData.length > 0 };
}