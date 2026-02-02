// Hook para buscar e gerenciar dados de referência das curvas de crescimento (OMS/CDC)

import React, { useState, useEffect, useCallback } from 'react';
import { ReferenceLine } from '@/types/anthropometry';
import { ChartRegistryConfig } from '@/config/growthChartsRegistry';
import { supabase } from '@/lib/supabase';

// Estrutura mockada de dados de referência
// Em produção, estes dados devem ser buscados de uma API ou repositório GitHub
const mockReferenceData: Record<string, {
  percentile: Record<string, { ageMonths: number; value: number }[]>;
  zscore: Record<string, { ageMonths: number; value: number }[]>;
}> = {
  'WHO_WEIGHT_AGE_0_5': {
    percentile: {
      P3: [
        { ageMonths: 0, value: 2.1 },
        { ageMonths: 6, value: 5.8 },
        { ageMonths: 12, value: 7.8 },
        { ageMonths: 18, value: 9.2 },
        { ageMonths: 24, value: 10.2 },
        { ageMonths: 36, value: 12.1 },
        { ageMonths: 48, value: 13.7 },
        { ageMonths: 60, value: 15.2 },
      ],
      P15: [
        { ageMonths: 0, value: 2.5 },
        { ageMonths: 6, value: 6.4 },
        { ageMonths: 12, value: 8.5 },
        { ageMonths: 18, value: 10.0 },
        { ageMonths: 24, value: 11.0 },
        { ageMonths: 36, value: 13.0 },
        { ageMonths: 48, value: 14.6 },
        { ageMonths: 60, value: 16.2 },
      ],
      P50: [
        { ageMonths: 0, value: 3.3 },
        { ageMonths: 6, value: 7.3 },
        { ageMonths: 12, value: 9.6 },
        { ageMonths: 18, value: 11.1 },
        { ageMonths: 24, value: 12.1 },
        { ageMonths: 36, value: 14.3 },
        { ageMonths: 48, value: 16.0 },
        { ageMonths: 60, value: 17.7 },
      ],
      P85: [
        { ageMonths: 0, value: 4.0 },
        { ageMonths: 6, value: 8.3 },
        { ageMonths: 12, value: 10.8 },
        { ageMonths: 18, value: 12.3 },
        { ageMonths: 24, value: 13.3 },
        { ageMonths: 36, value: 15.7 },
        { ageMonths: 48, value: 17.5 },
        { ageMonths: 60, value: 19.4 },
      ],
      P97: [
        { ageMonths: 0, value: 4.6 },
        { ageMonths: 6, value: 9.4 },
        { ageMonths: 12, value: 12.1 },
        { ageMonths: 18, value: 13.7 },
        { ageMonths: 24, value: 14.8 },
        { ageMonths: 36, value: 17.4 },
        { ageMonths: 48, value: 19.4 },
        { ageMonths: 60, value: 21.5 },
      ],
    },
    zscore: {
      Z_MINUS_3: [
        { ageMonths: 0, value: 1.8 },
        { ageMonths: 6, value: 5.1 },
        { ageMonths: 12, value: 6.9 },
        { ageMonths: 18, value: 8.2 },
        { ageMonths: 24, value: 9.1 },
        { ageMonths: 36, value: 10.8 },
        { ageMonths: 48, value: 12.3 },
        { ageMonths: 60, value: 13.7 },
      ],
      Z_MINUS_2: [
        { ageMonths: 0, value: 2.0 },
        { ageMonths: 6, value: 5.5 },
        { ageMonths: 12, value: 7.3 },
        { ageMonths: 18, value: 8.7 },
        { ageMonths: 24, value: 9.6 },
        { ageMonths: 36, value: 11.4 },
        { ageMonths: 48, value: 12.9 },
        { ageMonths: 60, value: 14.4 },
      ],
      Z_0: [
        { ageMonths: 0, value: 3.3 },
        { ageMonths: 6, value: 7.3 },
        { ageMonths: 12, value: 9.6 },
        { ageMonths: 18, value: 11.1 },
        { ageMonths: 24, value: 12.1 },
        { ageMonths: 36, value: 14.3 },
        { ageMonths: 48, value: 16.0 },
        { ageMonths: 60, value: 17.7 },
      ],
      Z_PLUS_2: [
        { ageMonths: 0, value: 4.6 },
        { ageMonths: 6, value: 9.1 },
        { ageMonths: 12, value: 11.9 },
        { ageMonths: 18, value: 13.5 },
        { ageMonths: 24, value: 14.6 },
        { ageMonths: 36, value: 17.2 },
        { ageMonths: 48, value: 19.1 },
        { ageMonths: 60, value: 21.0 },
      ],
      Z_PLUS_3: [
        { ageMonths: 0, value: 5.1 },
        { ageMonths: 6, value: 9.8 },
        { ageMonths: 12, value: 12.9 },
        { ageMonths: 18, value: 14.7 },
        { ageMonths: 24, value: 15.9 },
        { ageMonths: 36, value: 18.7 },
        { ageMonths: 48, value: 20.8 },
        { ageMonths: 60, value: 22.9 },
      ],
    },
  },
  // Adicionar mais curvas conforme necessário
};

// Cores para as linhas de referência (todas as 7 linhas)
const getReferenceLineColor = (label: string, displayMode: 'PERCENTILE' | 'Z_SCORE'): string => {
  if (displayMode === 'PERCENTILE') {
    if (label === 'P50') return '#3b82f6'; // Azul para mediana
    if (label === 'P15' || label === 'P85') return '#f59e0b'; // Laranja para intermediários
    return '#ef4444'; // Vermelho para extremos (P3, P97)
  } else {
    // Z-Score: todas as 7 linhas
    if (label === 'Z0') return '#3b82f6'; // Azul para média
    if (label === 'Z-1' || label === 'Z+1') return '#f59e0b'; // Laranja para Z-1 e Z+1
    if (label === 'Z-2' || label === 'Z+2') return '#f59e0b'; // Laranja para Z-2 e Z+2
    return '#ef4444'; // Vermelho para Z-3 e Z+3
  }
};

export function useGrowthReferenceData() {
  const [referenceData, setReferenceData] = useState<typeof mockReferenceData>(mockReferenceData);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Ref para acessar referenceData mais recente sem causar re-renders
  const referenceDataRef = React.useRef(referenceData);
  React.useEffect(() => {
    referenceDataRef.current = referenceData;
  }, [referenceData]);

  // Buscar dados de referência do banco de dados Supabase
  const fetchReferenceData = useCallback(async (
    chartConfig: ChartRegistryConfig,
    patientGender: 'male' | 'female',
    displayMode: 'PERCENTILE' | 'Z_SCORE'
  ) => {
    const cacheKey = `${chartConfig.value}_${patientGender}_${displayMode}`;
    
    // Verificar cache local primeiro
    const cached = localStorage.getItem(`growth_ref_${cacheKey}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setReferenceData(prev => {
          if (prev[cacheKey]) return prev; // Já carregado
          return { ...prev, [cacheKey]: parsed };
        });
        return;
      } catch (e) {
        console.warn('Erro ao ler cache:', e);
      }
    }

    setIsLoading(true);
    setError(null);

    try {
      // Debug: Log query parameters
      console.log('[GrowthChart] Fetching reference data:', {
        cacheKey,
        source: chartConfig.source,
        type: chartConfig.dbType,
        gender: patientGender,
        isXAxisLength: chartConfig.isXAxisLength,
        displayMode
      });

      // Construir query baseada na configuração
      let query = supabase
        .from('growth_standards')
        .select('age_months, x_value, sd_neg3, sd_neg2, sd_neg1, sd0, sd1, sd2, sd3')
        .eq('source', chartConfig.source)
        .eq('type', chartConfig.dbType)
        .eq('gender', patientGender);

      // Se eixo X é altura/comprimento, usar x_value; caso contrário, usar age_months
      if (chartConfig.isXAxisLength) {
        query = query.not('x_value', 'is', null);
      } else {
        query = query.not('age_months', 'is', null);
      }

      // Ordenar pelo campo apropriado
      if (chartConfig.isXAxisLength) {
        query = query.order('x_value', { ascending: true });
      } else {
        query = query.order('age_months', { ascending: true });
      }

      const { data: dbData, error: dbError } = await query;

      // Debug: Log raw database response
      console.log('[GrowthChart] Database query result:', {
        rowCount: dbData?.length || 0,
        hasError: !!dbError,
        error: dbError,
        firstRow: dbData?.[0] || null,
        sampleRows: dbData?.slice(0, 3) || []
      });

      if (dbError) {
        throw dbError;
      }

      // Se temos dados do banco, converter para formato esperado
      if (dbData && dbData.length > 0) {
        const convertedData = convertDbDataToReferenceFormat(
          dbData,
          displayMode,
          chartConfig.isXAxisLength || false
        );
        
        // Debug: Log converted data
        console.log('[GrowthChart] Converted data:', {
          percentileLines: Object.keys(convertedData.percentile).length,
          zscoreLines: Object.keys(convertedData.zscore).length,
          percentileDataPoints: Object.values(convertedData.percentile).reduce((sum, arr) => sum + arr.length, 0),
          zscoreDataPoints: Object.values(convertedData.zscore).reduce((sum, arr) => sum + arr.length, 0),
          samplePercentile: Object.entries(convertedData.percentile).slice(0, 2),
          sampleZscore: Object.entries(convertedData.zscore).slice(0, 2)
        });
        
        // Salvar no cache
        localStorage.setItem(`growth_ref_${cacheKey}`, JSON.stringify(convertedData));
        
        setReferenceData(prev => {
          if (prev[cacheKey]) return prev;
          return { ...prev, [cacheKey]: convertedData };
        });
      } else {
        // Fallback para dados mockados se banco estiver vazio
        console.warn('[GrowthChart] Banco de dados vazio, usando dados mockados', {
          source: chartConfig.source,
          type: chartConfig.dbType,
          gender: patientGender
        });
        const fallbackData = mockReferenceData['WHO_WEIGHT_AGE_0_5'];
        setReferenceData(prev => {
          if (prev[cacheKey]) return prev;
          return { ...prev, [cacheKey]: fallbackData };
        });
      }
    } catch (err: any) {
      console.error('Erro ao buscar dados de referência:', err);
      setError(err.message || 'Erro ao buscar dados de referência');
      // Usar dados mockados em caso de erro
      const fallbackData = mockReferenceData['WHO_WEIGHT_AGE_0_5'];
      setReferenceData(prev => {
        if (prev[cacheKey]) return prev;
        return { ...prev, [cacheKey]: fallbackData };
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Converter dados do banco para formato de referência
  // SEMPRE usa dados de Z-Score (sd_neg3 a sd3) e mapeia para percentis quando necessário
  const convertDbDataToReferenceFormat = (
    dbData: any[],
    displayMode: 'PERCENTILE' | 'Z_SCORE',
    isXAxisLength: boolean
  ) => {
    const percentile: Record<string, { x: number; value: number }[]> = {
      P3: [],
      P15: [],
      P50: [],
      P85: [],
      P97: [],
    };

    const zscore: Record<string, { x: number; value: number }[]> = {
      Z_MINUS_3: [],
      Z_MINUS_2: [],
      Z_MINUS_1: [],
      Z_0: [],
      Z_PLUS_1: [],
      Z_PLUS_2: [],
      Z_PLUS_3: [],
    };

    console.log('[GrowthChart] Converting data:', {
      rowCount: dbData.length,
      isXAxisLength,
      firstRowSample: dbData[0] ? {
        age_months: dbData[0].age_months,
        x_value: dbData[0].x_value,
        has_sd_neg3: dbData[0].sd_neg3 !== null && dbData[0].sd_neg3 !== undefined,
        has_sd0: dbData[0].sd0 !== null && dbData[0].sd0 !== undefined,
        has_sd3: dbData[0].sd3 !== null && dbData[0].sd3 !== undefined
      } : null
    });

    for (const row of dbData) {
      // Usar x_value se for gráfico peso x altura, senão usar age_months
      const xValue = isXAxisLength 
        ? (row.x_value || 0)
        : (row.age_months || 0);

      // SEMPRE usar dados de Z-Score do banco
      // Mapear Z-Scores para percentis quando necessário
      if (row.sd_neg3 !== null && row.sd_neg3 !== undefined) {
        const value = Number(row.sd_neg3);
        zscore.Z_MINUS_3.push({ x: xValue, value });
        // Z-3 ≈ < P1 (percentil muito baixo)
        percentile.P3.push({ x: xValue, value });
      }
      if (row.sd_neg2 !== null && row.sd_neg2 !== undefined) {
        const value = Number(row.sd_neg2);
        zscore.Z_MINUS_2.push({ x: xValue, value });
        // Z-2 ≈ P3
        if (!percentile.P3.find(p => p.x === xValue)) {
          percentile.P3.push({ x: xValue, value });
        }
      }
      if (row.sd_neg1 !== null && row.sd_neg1 !== undefined) {
        const value = Number(row.sd_neg1);
        zscore.Z_MINUS_1.push({ x: xValue, value });
        // Z-1 ≈ P15
        percentile.P15.push({ x: xValue, value });
      }
      if (row.sd0 !== null && row.sd0 !== undefined) {
        const value = Number(row.sd0);
        zscore.Z_0.push({ x: xValue, value });
        // Z0 = P50 (mediana)
        percentile.P50.push({ x: xValue, value });
      }
      if (row.sd1 !== null && row.sd1 !== undefined) {
        const value = Number(row.sd1);
        zscore.Z_PLUS_1.push({ x: xValue, value });
        // Z+1 ≈ P85
        percentile.P85.push({ x: xValue, value });
      }
      if (row.sd2 !== null && row.sd2 !== undefined) {
        const value = Number(row.sd2);
        zscore.Z_PLUS_2.push({ x: xValue, value });
        // Z+2 ≈ P97
        percentile.P97.push({ x: xValue, value });
      }
      if (row.sd3 !== null && row.sd3 !== undefined) {
        const value = Number(row.sd3);
        zscore.Z_PLUS_3.push({ x: xValue, value });
        // Z+3 ≈ > P99 (percentil muito alto)
        if (!percentile.P97.find(p => p.x === xValue)) {
          percentile.P97.push({ x: xValue, value });
        }
      }
    }

    console.log('[GrowthChart] Conversion complete:', {
      percentileCounts: Object.fromEntries(
        Object.entries(percentile).map(([k, v]) => [k, v.length])
      ),
      zscoreCounts: Object.fromEntries(
        Object.entries(zscore).map(([k, v]) => [k, v.length])
      )
    });

    return { percentile, zscore };
  };

  // Converter dados brutos em ReferenceLine[] para o gráfico
  // Retorna todas as 7 linhas de referência (sd_neg3 a sd3)
  const getReferenceLines = useCallback((
    chartConfig: ChartRegistryConfig,
    patientGender: 'male' | 'female',
    displayMode: 'PERCENTILE' | 'Z_SCORE'
  ): ReferenceLine[] => {
    const cacheKey = `${chartConfig.value}_${patientGender}_${displayMode}`;
    
    // Usar dados mockados como fallback
    const fallbackData = mockReferenceData['WHO_WEIGHT_AGE_0_5'] || {
      percentile: {},
      zscore: {},
    };
    
    // Acessar dados mais recentes via ref para evitar dependências
    const currentData = referenceDataRef.current;
    const data = currentData[cacheKey] || fallbackData;

    // Debug: Log what data is being used
    console.log('[GrowthChart] getReferenceLines:', {
      cacheKey,
      hasData: !!currentData[cacheKey],
      usingFallback: !currentData[cacheKey],
      dataKeys: Object.keys(currentData),
      percentileKeys: Object.keys(data.percentile || {}),
      zscoreKeys: Object.keys(data.zscore || {}),
      percentileCounts: Object.fromEntries(
        Object.entries(data.percentile || {}).map(([k, v]: [string, any]) => [k, v?.length || 0])
      ),
      zscoreCounts: Object.fromEntries(
        Object.entries(data.zscore || {}).map(([k, v]: [string, any]) => [k, v?.length || 0])
      )
    });

    const lines: ReferenceLine[] = [];
    const source = displayMode === 'PERCENTILE' ? data.percentile : data.zscore;

    if (displayMode === 'PERCENTILE') {
      // Linhas de percentil: P3, P15, P50, P85, P97
      // (mapeadas a partir dos Z-Scores)
      ['P3', 'P15', 'P50', 'P85', 'P97'].forEach(label => {
        if (source[label] && source[label].length > 0) {
          lines.push({
            label,
            color: getReferenceLineColor(label, 'PERCENTILE'),
            data: source[label].map((point: any) => ({
              x: point.x,
              y: point.value,
            })),
          });
        } else {
          console.warn(`[GrowthChart] Missing percentile data for ${label}`);
        }
      });
    } else {
      // Linhas de Z-Score: Z-3, Z-2, Z-1, Z0, Z+1, Z+2, Z+3 (TODAS as 7 linhas)
      const zScoreKeys = ['Z_MINUS_3', 'Z_MINUS_2', 'Z_MINUS_1', 'Z_0', 'Z_PLUS_1', 'Z_PLUS_2', 'Z_PLUS_3'];
      zScoreKeys.forEach(key => {
        const label = key
          .replace('Z_MINUS_3', 'Z-3')
          .replace('Z_MINUS_2', 'Z-2')
          .replace('Z_MINUS_1', 'Z-1')
          .replace('Z_0', 'Z0')
          .replace('Z_PLUS_1', 'Z+1')
          .replace('Z_PLUS_2', 'Z+2')
          .replace('Z_PLUS_3', 'Z+3');
        
        if (source[key] && source[key].length > 0) {
          lines.push({
            label,
            color: getReferenceLineColor(label, 'Z_SCORE'),
            data: source[key].map((point: any) => ({
              x: point.x,
              y: point.value,
            })),
          });
        } else {
          console.warn(`[GrowthChart] Missing zscore data for ${key}`);
        }
      });
    }

    console.log('[GrowthChart] Generated reference lines:', {
      lineCount: lines.length,
      lines: lines.map(l => ({ label: l.label, pointCount: l.data.length }))
    });

    return lines;
  }, []);

  return {
    referenceData,
    isLoading,
    error,
    fetchReferenceData,
    getReferenceLines,
    hasData: (cacheKey: string) => {
      return !!referenceDataRef.current[cacheKey];
    },
  };
}
