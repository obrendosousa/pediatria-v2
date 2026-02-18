'use client';

import React, { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Dot
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

// Ponto visual do paciente (Bolinha preta)
const PatientDot = (props: any) => {
  const { cx, cy, payload } = props;
  
  // Só desenha a bolinha se tiver valor real
  if (payload && payload.paciente === undefined) return null;

  return (
    <Dot cx={cx} cy={cy} r={5} fill="#1e293b" stroke="#ffffff" strokeWidth={2} />
  );
};

export function GrowthChart({ 
  data, chartConfig, displayMode, yAxisLabel, xAxisLabel 
}: GrowthChartProps) {

  // Tooltip Inteligente
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      // Tenta encontrar o dado do paciente no ponto atual
      const patientData = payload.find((p: any) => p.dataKey === 'paciente');
      
      const xLabelText = chartConfig.isXAxisLength 
        ? `${Math.round(label)} cm` 
        : formatXAxisLabel(label, false);

      return (
        <div className="bg-white/95 backdrop-blur shadow-xl border border-slate-200 rounded-lg p-3 text-xs min-w-[120px]">
          {/* Cabeçalho: Sempre mostra a Idade/Eixo X (Serve como régua) */}
          <p className="text-slate-500 font-medium pb-1 mb-1 border-b border-slate-100">
            {xAxisLabel}: <span className="text-slate-700">{xLabelText}</span>
          </p>

          {/* Corpo: Só mostra o Peso se tiver medição neste ponto exato */}
          {patientData && patientData.value !== undefined ? (
            <div className="flex items-center gap-2 mt-1">
              <span className="w-2 h-2 rounded-full bg-slate-800"></span>
              <div>
                <p className="font-bold text-slate-800 text-sm">
                  {Number(patientData.value).toFixed(2)} kg
                </p>
                <p className="text-[10px] text-slate-400">Paciente</p>
              </div>
            </div>
          ) : (
            // Se não tiver ponto do paciente aqui, não mostra nada extra (nem "Sem medição")
            null
          )}
        </div>
      );
    }
    return null;
  };

  // Prepara os dados combinando linhas de referência + pontos do paciente
  const chartData: any[] = useMemo(() => {
    const allX = new Set<number>();
    
    // Coleta todos os pontos X (Idades) existentes
    data.referenceLines.forEach(l => l.data.forEach(p => allX.add(p.x)));
    data.patientPoints.forEach(p => allX.add(p.x));
    
    // Cria array ordenado único
    return Array.from(allX).sort((a, b) => a - b).map(x => {
      const point: any = { x };
      
      // Adiciona Y das linhas de referência (Coloridas)
      data.referenceLines.forEach(line => {
        // Tolerância pequena para encontrar o ponto correspondente
        const p = line.data.find(d => Math.abs(d.x - x) < 0.01);
        if (p) point[line.label] = p.y;
      });
      
      // Adiciona Y do paciente (Preto)
      const pat = data.patientPoints.find(d => Math.abs(d.x - x) < 0.01);
      if (pat) point.paciente = pat.y;
      
      return point;
    });
  }, [data]);

  return (
    <div className="w-full h-full bg-white rounded-lg p-2">
      <ResponsiveContainer width="100%" height={500}>
        <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          
          <XAxis
            dataKey="x"
            tickFormatter={(val) => chartConfig.isXAxisLength ? `${Math.round(val)}` : formatXAxisLabel(val, false)}
            tick={{ fontSize: 11, fill: '#64748b' }}
            tickLine={false}
            axisLine={{ stroke: '#e2e8f0' }}
            minTickGap={30}
          />
          
          <YAxis
            tick={{ fontSize: 11, fill: '#64748b' }}
            tickLine={false}
            axisLine={false}
            width={30}
            domain={['auto', 'auto']} // Ajusta escala automaticamente
          />

          <Tooltip 
            content={<CustomTooltip />} 
            cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '4 4' }} // Linha pontilhada vertical
          />
          
          {/* Linhas de Referência (Coloridas) */}
          {data.referenceLines.map((line) => (
            <Line
              key={line.label}
              type="monotone"
              dataKey={line.label}
              stroke={line.color}
              strokeWidth={line.label === 'Z0' || line.label === 'P50' ? 2 : 1.5}
              strokeOpacity={1}
              dot={false}
              activeDot={false}
              isAnimationActive={false} // Desativa animação para performance
            />
          ))}
          
          {/* Linha do Paciente (Preta) */}
          <Line
            type="monotone"
            dataKey="paciente"
            name="Paciente"
            stroke="#1e293b"
            strokeWidth={2}
            dot={<PatientDot />}
            activeDot={{ r: 6, fill: '#1e293b', stroke: '#fff', strokeWidth: 2 }}
            connectNulls={true} // Liga os pontos mesmo se houver meses vazios no meio
            isAnimationActive={true}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}