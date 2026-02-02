'use client';

import React, { useRef, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Dot,
} from 'recharts';
import { ReferenceLine, GrowthChartData } from '@/types/anthropometry';
import { ChartRegistryConfig } from '@/config/growthChartsRegistry';
import { formatXAxisLabel } from '@/utils/growthChartUtils';

interface GrowthChartProps {
  data: GrowthChartData;
  chartConfig: ChartRegistryConfig;
  displayMode: 'PERCENTILE' | 'Z_SCORE';
  yAxisLabel: string;
  xAxisLabel: string;
}

// Componente customizado para os pontos do paciente
const PatientDot = (props: any) => {
  const { cx, cy } = props;
  return (
    <Dot
      cx={cx}
      cy={cy}
      r={6}
      fill="#1e293b"
      stroke="#ffffff"
      strokeWidth={2}
      className="drop-shadow-md"
    />
  );
};

// Mapeamento de labels para exibição
const getDisplayLabel = (label: string, displayMode: 'PERCENTILE' | 'Z_SCORE'): string => {
  if (displayMode === 'PERCENTILE') {
    return label; // P3, P15, P50, P85, P97
  } else {
    return label; // Z-3, Z-2, Z-1, Z0, Z+1, Z+2, Z+3
  }
};

export function GrowthChart({ 
  data, 
  chartConfig, 
  displayMode,
  yAxisLabel, 
  xAxisLabel 
}: GrowthChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);

  // Ordenar linhas de referência para áreas preenchidas
  const sortedReferenceLines = useMemo(() => {
    // Ordenar linhas de Z-Score: Z-3, Z-2, Z-1, Z0, Z+1, Z+2, Z+3
    // Ou Percentil: P3, P15, P50, P85, P97
    const order = displayMode === 'PERCENTILE' 
      ? ['P3', 'P15', 'P50', 'P85', 'P97']
      : ['Z-3', 'Z-2', 'Z-1', 'Z0', 'Z+1', 'Z+2', 'Z+3'];
    
    return [...data.referenceLines].sort((a, b) => {
      const indexA = order.indexOf(a.label);
      const indexB = order.indexOf(b.label);
      return indexA - indexB;
    });
  }, [data.referenceLines, displayMode]);


  // Formatar tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-[#1e2028] border border-slate-200 dark:border-gray-700 rounded-lg shadow-lg p-3">
          <p className="text-sm font-semibold text-slate-800 dark:text-gray-100 mb-2">
            {chartConfig.isXAxisLength 
              ? `${xAxisLabel}: ${Math.round(label)}` 
              : `${xAxisLabel}: ${formatXAxisLabel(label, false)}`}
          </p>
          {payload.map((entry: any, index: number) => (
            <p
              key={index}
              className="text-xs"
              style={{ color: entry.color }}
            >
              <span className="font-semibold">{entry.name}:</span> {entry.value.toFixed(2)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Preparar dados para o gráfico
  // Combinar todas as linhas de referência e pontos do paciente
  const chartData: any[] = useMemo(() => {
    const result: any[] = [];
    
    // Encontrar todos os valores de X únicos
    const allXValues = new Set<number>();
    
    // Adicionar X das linhas de referência
    data.referenceLines.forEach(line => {
      line.data.forEach(point => allXValues.add(point.x));
    });
    
    // Adicionar X dos pontos do paciente
    data.patientPoints.forEach(point => allXValues.add(point.x));
    
    // Criar array ordenado de X
    const sortedXValues = Array.from(allXValues).sort((a, b) => a - b);
    
    // Para cada X, criar um objeto com todos os valores Y
    sortedXValues.forEach(x => {
      const dataPoint: any = {
        x,
        xLabel: chartConfig.isXAxisLength 
          ? `${Math.round(x)} cm`
          : formatXAxisLabel(x, false),
      };
      
      // Adicionar valores das linhas de referência
      data.referenceLines.forEach(line => {
        const point = line.data.find(p => Math.abs(p.x - x) < 0.01); // Tolerância para comparação
        if (point) {
          dataPoint[line.label] = point.y;
        }
      });
      
      // Adicionar ponto do paciente se existir neste X
      const patientPoint = data.patientPoints.find(p => Math.abs(p.x - x) < 0.01);
      if (patientPoint) {
        dataPoint.paciente = patientPoint.y;
      }
      
      result.push(dataPoint);
    });

    return result;
  }, [data.referenceLines, data.patientPoints, chartConfig.isXAxisLength]);

  // Função para formatar tick do eixo X
  const formatXAxisTick = (value: number) => {
    if (chartConfig.isXAxisLength) {
      return `${Math.round(value)}`;
    }
    return formatXAxisLabel(value, false);
  };

  return (
    <div ref={chartRef} className="w-full h-full bg-white dark:bg-[#1e2028] rounded-lg p-4">
      <ResponsiveContainer width="100%" height={500}>
        <LineChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
        >
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke="#e2e8f0" 
            className="dark:stroke-gray-700"
          />
          <XAxis
            dataKey="x"
            tickFormatter={formatXAxisTick}
            label={{ 
              value: xAxisLabel, 
              position: 'insideBottom', 
              offset: -10,
              className: 'text-xs fill-slate-600 dark:fill-gray-400'
            }}
            stroke="#64748b"
            className="dark:stroke-gray-400"
          />
          <YAxis
            label={{ 
              value: yAxisLabel, 
              angle: -90, 
              position: 'insideLeft',
              className: 'text-xs fill-slate-600 dark:fill-gray-400'
            }}
            stroke="#64748b"
            className="dark:stroke-gray-400"
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            wrapperStyle={{ paddingTop: '20px' }}
            iconType="line"
          />
          
          {/* Linhas de referência (TODAS as 7 linhas) */}
          {sortedReferenceLines.map((line, index) => (
            <Line
              key={`ref-${line.label}-${index}`}
              type="monotone"
              dataKey={line.label}
              stroke={line.color}
              strokeWidth={2}
              dot={false}
              activeDot={false}
              name={getDisplayLabel(line.label, displayMode)}
              legendType="line"
            />
          ))}
          
          {/* Linha do paciente */}
          {data.patientPoints.length > 0 && (
            <Line
              type="monotone"
              dataKey="paciente"
              stroke="#1e293b"
              strokeWidth={3}
              dot={<PatientDot />}
              activeDot={{ r: 8 }}
              name="Paciente"
              legendType="line"
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
