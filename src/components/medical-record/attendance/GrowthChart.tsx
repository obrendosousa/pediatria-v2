'use client';

import React, { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Dot, Legend
} from 'recharts';
import { GrowthChartData } from '@/types/anthropometry';
import { ChartRegistryConfig } from '@/config/growthChartsRegistry';
import { formatXAxisLabel } from '@/utils/growthChartUtils';

interface GrowthChartProps {
  data: GrowthChartData;
  chartConfig: ChartRegistryConfig;
  displayMode: 'PERCENTILE' | 'Z_SCORE';
  yAxisLabel: string;
  xAxisLabel: string;
}

// Bolinha do paciente
const PatientDot = (props: any) => {
  const { cx, cy, payload } = props;
  if (!payload || payload.paciente === undefined) return null;
  return <Dot cx={cx} cy={cy} r={5} fill="#1e293b" stroke="#ffffff" strokeWidth={2} />;
};

// Legenda customizada das linhas de referência
function ReferenceLineLegend({ lines }: { lines: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-2 pb-1">
      {lines.map(l => (
        <div key={l.label} className="flex items-center gap-1">
          <span className="inline-block w-6 h-0.5 rounded" style={{ backgroundColor: l.color }} />
          <span className="text-[11px] text-slate-500 dark:text-gray-400">{l.label}</span>
        </div>
      ))}
      <div className="flex items-center gap-1">
        <span className="inline-block w-3 h-3 rounded-full bg-slate-800 dark:bg-gray-200 border-2 border-white dark:border-gray-800" />
        <span className="text-[11px] text-slate-500 dark:text-gray-400">Paciente</span>
      </div>
    </div>
  );
}

export function GrowthChart({ data, chartConfig, displayMode, yAxisLabel, xAxisLabel }: GrowthChartProps) {

  // Unidade do eixo Y baseada no tipo de gráfico
  const yUnit = useMemo(() => {
    switch (chartConfig.dbType) {
      case 'wfa': case 'wfl': case 'wfh': return 'kg';
      case 'lhfa': case 'hcfa': return 'cm';
      case 'bmifa': return '';
      default: return '';
    }
  }, [chartConfig.dbType]);

  // Tooltip customizado
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;

    const patientPayload = payload.find((p: any) => p.dataKey === 'paciente');
    const xText = chartConfig.isXAxisLength
      ? `${Math.round(label)} cm`
      : formatXAxisLabel(label);

    return (
      <div className="bg-white/95 dark:bg-[#1e2028]/95 backdrop-blur shadow-xl border border-slate-200 dark:border-gray-700 rounded-lg p-3 text-xs min-w-[130px]">
        <p className="text-slate-500 dark:text-gray-400 font-medium pb-1 mb-1.5 border-b border-slate-100 dark:border-gray-700">
          {xAxisLabel}: <span className="text-slate-700 dark:text-gray-200">{xText}</span>
        </p>
        {patientPayload?.value !== undefined && (
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-800 dark:bg-gray-200 border border-white flex-shrink-0" />
            <div>
              <p className="font-bold text-slate-800 dark:text-gray-100 text-sm">
                {Number(patientPayload.value).toFixed(2)}{yUnit ? ` ${yUnit}` : ''}
              </p>
              <p className="text-[10px] text-slate-400 dark:text-gray-500">Paciente</p>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Combina pontos de referência + pontos do paciente em um array único para o Recharts
  const chartData: any[] = useMemo(() => {
    const allX = new Set<number>();
    data.referenceLines.forEach(l => l.data.forEach(p => allX.add(p.x)));
    data.patientPoints.forEach(p => allX.add(p.x));

    return Array.from(allX).sort((a, b) => a - b).map(x => {
      const point: any = { x };
      data.referenceLines.forEach(line => {
        const p = line.data.find(d => Math.abs(d.x - x) < 0.01);
        if (p) point[line.label] = p.y;
      });
      const pat = data.patientPoints.find(d => Math.abs(d.x - x) < 0.01);
      if (pat) point.paciente = pat.y;
      return point;
    });
  }, [data]);

  const legendLines = data.referenceLines.map(l => ({ label: l.label, color: l.color }));

  return (
    <div className="w-full bg-white dark:bg-[#1e2028] rounded-lg">
      <ResponsiveContainer width="100%" height={460}>
        <LineChart data={chartData} margin={{ top: 16, right: 24, left: 8, bottom: 8 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#f1f5f9"
            className="dark:stroke-gray-800"
            vertical={false}
          />

          <XAxis
            dataKey="x"
            tickFormatter={(val) =>
              chartConfig.isXAxisLength
                ? `${Math.round(val)}`
                : formatXAxisLabel(val)
            }
            tick={{ fontSize: 11, fill: '#64748b' }}
            tickLine={false}
            axisLine={{ stroke: '#e2e8f0' }}
            minTickGap={28}
            label={{
              value: xAxisLabel,
              position: 'insideBottom',
              offset: -4,
              fontSize: 11,
              fill: '#94a3b8',
            }}
          />

          <YAxis
            tick={{ fontSize: 11, fill: '#64748b' }}
            tickLine={false}
            axisLine={false}
            width={38}
            tickFormatter={(val) => yUnit ? `${val}` : `${val}`}
            label={{
              value: yAxisLabel,
              angle: -90,
              position: 'insideLeft',
              offset: 12,
              fontSize: 11,
              fill: '#94a3b8',
            }}
            domain={['auto', 'auto']}
          />

          <Tooltip
            content={<CustomTooltip />}
            cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '4 4' }}
          />

          {/* Linhas de referência coloridas */}
          {data.referenceLines.map((line) => (
            <Line
              key={line.label}
              type="monotone"
              dataKey={line.label}
              stroke={line.color}
              strokeWidth={line.label === 'Z0' || line.label === 'P50' ? 2.5 : 1.5}
              strokeOpacity={0.85}
              dot={false}
              activeDot={false}
              isAnimationActive={false}
            />
          ))}

          {/* Linha do paciente */}
          <Line
            type="monotone"
            dataKey="paciente"
            name="Paciente"
            stroke="#1e293b"
            strokeWidth={2.5}
            dot={<PatientDot />}
            activeDot={{ r: 6, fill: '#1e293b', stroke: '#fff', strokeWidth: 2 }}
            connectNulls
            isAnimationActive
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Legenda das curvas */}
      <ReferenceLineLegend lines={legendLines} />
    </div>
  );
}
