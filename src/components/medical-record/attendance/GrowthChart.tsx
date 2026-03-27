'use client';

import React, { useMemo, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Dot,
} from 'recharts';
import { GrowthChartData } from '@/types/anthropometry';
import { ChartRegistryConfig } from '@/config/growthChartsRegistry';
import {
  formatXAxisLabel,
  formatChartLabel,
  generateMonthlyTicks,
  calculatePreciseAgeBetweenDates,
} from '@/utils/growthChartUtils';

interface GrowthChartProps {
  data: GrowthChartData;
  chartConfig: ChartRegistryConfig;
  displayMode: 'PERCENTILE' | 'Z_SCORE';
  yAxisLabel: string;
  xAxisLabel: string;
  patientBirthDate?: string;
}

interface PatientDotProps {
  cx?: number;
  cy?: number;
  payload?: Record<string, unknown>;
}

interface ChartDataPoint {
  x: number;
  paciente?: number;
  _patientDate?: string;
  _patientAge?: string;
  [key: string]: unknown;
}

// Bolinha do paciente
const PatientDot = (props: PatientDotProps) => {
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
          <span className="text-[11px] text-slate-500 dark:text-[#a1a1aa]">{l.label}</span>
        </div>
      ))}
      <div className="flex items-center gap-1">
        <span className="inline-block w-3 h-3 rounded-full bg-slate-800 dark:bg-gray-200 border-2 border-white dark:border-[#2d2d36]" />
        <span className="text-[11px] text-slate-500 dark:text-[#a1a1aa]">Paciente</span>
      </div>
    </div>
  );
}

function formatDateBR(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function getSourceLabel(source: string): string {
  switch (source) {
    case 'WHO': return 'OMS 2006/2007';
    case 'CDC': return 'CDC 2000';
    default: return source;
  }
}

interface TooltipPayloadItem {
  dataKey: string;
  value?: number;
  stroke?: string;
  color?: string;
  payload?: ChartDataPoint;
}

// Tooltip do gráfico no padrão iClinic
function GrowthChartTooltip({
  active, payload, label, xAxisLabel: xLabel, yUnit, isXAxisLength,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: number;
  xAxisLabel: string;
  yUnit: string;
  isXAxisLength?: boolean;
}) {
  if (!active || !payload?.length || label === undefined) return null;

  const patientPayload = payload.find(p => p.dataKey === 'paciente');
  const referencePayloads = payload.filter(
    p => p.dataKey !== 'paciente' && p.value !== undefined && p.value !== null
  );

  // Idade verbosa para o header (ex: "1 ano 10 meses" em vez de "10")
  const xText = isXAxisLength
    ? `${Math.round(label)} cm`
    : formatChartLabel(label);

  return (
    <div className="bg-white/95 dark:bg-[#08080b]/95 backdrop-blur shadow-xl border border-slate-200 dark:border-[#3d3d48] rounded-lg p-3 text-xs min-w-[150px]">
      <p className="text-slate-500 dark:text-[#a1a1aa] font-medium pb-1 mb-1.5 border-b border-slate-100 dark:border-[#3d3d48]">
        {xLabel}: <span className="text-slate-700 dark:text-gray-200">{xText}</span>
      </p>

      {referencePayloads.length > 0 && (
        <div className="space-y-0.5 mb-1.5">
          {referencePayloads.map(p => (
            <div key={p.dataKey} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-block w-3 h-[2px] rounded flex-shrink-0"
                  style={{ backgroundColor: p.stroke || p.color }}
                />
                <span className="text-slate-500 dark:text-[#a1a1aa]">{p.dataKey}</span>
              </div>
              <span className="font-semibold text-slate-700 dark:text-gray-200 tabular-nums">
                {Number(p.value).toFixed(1)}{yUnit ? ` ${yUnit}` : ''}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Ponto do paciente — badge compacto estilo iClinic */}
      {patientPayload?.value !== undefined && (
        <div className="pt-1.5 border-t border-slate-100 dark:border-[#3d3d48]">
          <div className="bg-slate-800 dark:bg-slate-700 text-white rounded-md px-2.5 py-1.5 text-[11px] font-medium leading-snug">
            <span className="font-bold">
              {Number(patientPayload.value).toFixed(2)}{yUnit ? ` ${yUnit}` : ''}
            </span>
            {patientPayload.payload?._patientAge && (
              <span> — {patientPayload.payload._patientAge}</span>
            )}
            {patientPayload.payload?._patientDate && (
              <span> — {formatDateBR(patientPayload.payload._patientDate)}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Tick customizado do eixo X — meses no topo, anos abaixo (duas linhas)
function XAxisTick({ x, y, payload }: { x?: number; y?: number; payload?: { value: number } }) {
  if (x === undefined || y === undefined || !payload) return null;
  const val = payload.value;
  const months = Math.round(val % 12);
  const isYearMark = months === 0;

  if (val === 0) {
    // "Nasc." como label de ano
    return (
      <text x={x} y={y + 22} textAnchor="middle" fontSize={10} fontWeight={600} fill="#334155">
        Nasc.
      </text>
    );
  }

  if (isYearMark) {
    // Marco de ano: label grande abaixo
    const years = Math.floor(val / 12);
    return (
      <text x={x} y={y + 22} textAnchor="middle" fontSize={10} fontWeight={600} fill="#334155">
        {years} {years === 1 ? 'ano' : 'anos'}
      </text>
    );
  }

  // Mês intermediário: número pequeno acima
  return (
    <text x={x} y={y + 10} textAnchor="middle" fontSize={8} fontWeight={400} fill="#94a3b8">
      {months}
    </text>
  );
}

export function GrowthChart(props: GrowthChartProps) {
  const { data, chartConfig, yAxisLabel, xAxisLabel, patientBirthDate } = props;

  const yUnit = useMemo(() => {
    switch (chartConfig.dbType) {
      case 'wfa': case 'wfl': case 'wfh': return 'kg';
      case 'lhfa': case 'hcfa': return 'cm';
      case 'bmifa': return '';
      default: return '';
    }
  }, [chartConfig.dbType]);

  const tooltipContent = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (tooltipProps: any) => (
      <GrowthChartTooltip
        {...tooltipProps}
        xAxisLabel={xAxisLabel}
        yUnit={yUnit}
        isXAxisLength={chartConfig.isXAxisLength}
      />
    ),
    [xAxisLabel, yUnit, chartConfig.isXAxisLength]
  );

  const chartData: ChartDataPoint[] = useMemo(() => {
    const allX = new Set<number>();
    data.referenceLines.forEach(l => l.data.forEach(p => allX.add(p.x)));
    data.patientPoints.forEach(p => allX.add(p.x));

    return Array.from(allX).sort((a, b) => a - b).map(x => {
      const point: ChartDataPoint = { x };
      data.referenceLines.forEach(line => {
        const p = line.data.find(d => Math.abs(d.x - x) < 0.01);
        if (p) point[line.label] = p.y;
      });
      const pat = data.patientPoints.find(d => Math.abs(d.x - x) < 0.01);
      if (pat) {
        point.paciente = pat.y;
        point._patientDate = pat.date;
        point._patientAge = patientBirthDate
          ? calculatePreciseAgeBetweenDates(patientBirthDate, pat.date)
          : undefined;
      }
      return point;
    });
  }, [data, patientBirthDate]);

  const legendLines = data.referenceLines.map(l => ({ label: l.label, color: l.color }));

  const xDomain = useMemo(() => {
    const allX = chartData.map(d => d.x);
    return [Math.min(...allX), Math.max(...allX)] as [number, number];
  }, [chartData]);

  // Range total em meses para decidir densidade de ticks
  const rangeMonths = xDomain[1] - xDomain[0];

  const monthlyTicks = useMemo(() => {
    if (chartConfig.isXAxisLength) return undefined;
    return generateMonthlyTicks(xDomain[0], xDomain[1]);
  }, [chartConfig.isXAxisLength, xDomain]);

  // Para ranges curtos (≤72 meses / 6 anos): mostrar todos os meses
  // Para ranges longos: deixar Recharts auto-espaçar
  const xAxisInterval = useMemo(() => {
    if (chartConfig.isXAxisLength) return undefined;
    if (rangeMonths <= 72) return 0; // Mostra TODOS os ticks (padrão iClinic)
    return undefined; // Deixa o minTickGap controlar
  }, [chartConfig.isXAxisLength, rangeMonths]);

  return (
    <div className="w-full bg-white dark:bg-[#08080b] rounded-lg relative">
      <span className="absolute top-2 right-4 text-[10px] text-slate-400 dark:text-[#71717a] z-10">
        Fonte: {getSourceLabel(chartConfig.source)}
      </span>

      <ResponsiveContainer width="100%" height={480}>
        <LineChart data={chartData} margin={{ top: 16, right: 24, left: 8, bottom: 24 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#f1f5f9"
            className="dark:stroke-gray-800"
            vertical={false}
          />

          <XAxis
            dataKey="x"
            {...(monthlyTicks ? { ticks: monthlyTicks } : {})}
            {...(xAxisInterval !== undefined ? { interval: xAxisInterval } : {})}
            tickFormatter={chartConfig.isXAxisLength
              ? (val: number) => `${Math.round(val)}`
              : (val: number) => formatXAxisLabel(val)
            }
            tick={chartConfig.isXAxisLength
              ? { fontSize: 11, fill: '#64748b' }
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              : XAxisTick as any
            }
            tickLine={false}
            axisLine={{ stroke: '#e2e8f0' }}
            minTickGap={chartConfig.isXAxisLength ? 28 : 4}
            height={40}
          />

          <YAxis
            tick={{ fontSize: 11, fill: '#64748b' }}
            tickLine={false}
            axisLine={false}
            width={38}
            tickFormatter={(val: number) => `${val}`}
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
            content={tooltipContent}
            cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '4 4' }}
          />

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

      <ReferenceLineLegend lines={legendLines} />
    </div>
  );
}
