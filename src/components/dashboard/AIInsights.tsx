// src/components/dashboard/AIInsights.tsx

'use client';

import React, { useEffect, useState } from 'react';
import { Sparkles, TrendingUp, AlertTriangle, Zap, Lightbulb } from 'lucide-react';

interface Insight {
  type: 'positive' | 'warning' | 'info' | 'suggestion';
  title: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface AIInsightsProps {
  metrics: any;
}

export function AIInsights({ metrics }: AIInsightsProps) {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [isGenerating, setIsGenerating] = useState(true);

  useEffect(() => {
    generateInsights();
  }, [metrics]);

  function generateInsights() {
    setIsGenerating(true);
    
    // Simulação de análise de IA (aqui você pode integrar com uma API real de IA)
    setTimeout(() => {
      const newInsights: Insight[] = [];

      // 1. Análise de taxa de faltas
      if (metrics.summary.missed > 0) {
        const noShowRate = (metrics.summary.missed / metrics.summary.scheduled) * 100;
        if (noShowRate > 10) {
          newInsights.push({
            type: 'warning',
            title: 'Taxa de faltas alta detectada',
            message: `A taxa de faltas está em ${noShowRate.toFixed(1)}%. Recomendo enviar lembretes automatizados via WhatsApp 24h antes dos agendamentos.`,
            action: {
              label: 'Ativar lembretes automáticos',
              onClick: () => console.log('Ativar lembretes'),
            },
          });
        }
      }

      // 2. Análise de picos de atendimento
      const timelineEntries = Object.entries(metrics.timeline.appointmentsByDate || {});
      if (timelineEntries.length > 7) {
        const avgAppointments = timelineEntries.reduce((sum, [, count]) => sum + (count as number), 0) / timelineEntries.length;
        const peakDay = timelineEntries.find(([, count]) => (count as number) > avgAppointments * 1.5);
        
        if (peakDay) {
          newInsights.push({
            type: 'info',
            title: 'Dia de pico identificado',
            message: `O dia ${peakDay[0]} teve ${peakDay[1]} atendimentos, acima da média. Considere adicionar mais slots nesses horários.`,
          });
        }
      }

      // 3. Análise de novos pacientes
      if (metrics.demographics.new.percentage > 30) {
        newInsights.push({
          type: 'positive',
          title: 'Ótima captação de novos pacientes!',
          message: `${metrics.demographics.new.percentage}% dos pacientes são novos. Mantenha essa estratégia de marketing.`,
        });
      }

      // 4. Análise de eficiência
      if (metrics.performance.avgDuration > 0) {
        if (metrics.performance.avgDuration < 20) {
          newInsights.push({
            type: 'suggestion',
            title: 'Tempo de atendimento otimizado',
            message: `Tempo médio de ${metrics.performance.avgDuration}min está excelente! A IA pode ajudar a acelerar ainda mais com templates de prontuário.`,
            action: {
              label: 'Ver templates',
              onClick: () => console.log('Ver templates'),
            },
          });
        } else if (metrics.performance.avgDuration > 40) {
          newInsights.push({
            type: 'warning',
            title: 'Atendimentos acima da média',
            message: `Tempo médio de ${metrics.performance.avgDuration}min pode estar impactando a capacidade. A IA pode sugerir otimizações.`,
          });
        }
      }

      // 5. Análise de procedimentos
      if (metrics.procedures.returns.percentage > 60) {
        newInsights.push({
          type: 'positive',
          title: 'Alta taxa de retorno',
          message: `${metrics.procedures.returns.percentage}% são retornos, indicando boa retenção de pacientes.`,
        });
      }

      // Se não houver insights, criar um genérico
      if (newInsights.length === 0) {
        newInsights.push({
          type: 'info',
          title: 'Tudo funcionando bem!',
          message: 'Suas métricas estão dentro dos parâmetros esperados. Continue monitorando.',
        });
      }

      setInsights(newInsights.slice(0, 3)); // Limitar a 3 insights
      setIsGenerating(false);
    }, 800); // Simular delay de processamento de IA
  }

  const getIcon = (type: Insight['type']) => {
    switch (type) {
      case 'positive':
        return <TrendingUp className="w-5 h-5 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case 'suggestion':
        return <Lightbulb className="w-5 h-5 text-blue-500" />;
      default:
        return <Zap className="w-5 h-5 text-purple-500" />;
    }
  };

  const getColorClasses = (type: Insight['type']) => {
    switch (type) {
      case 'positive':
        return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
      case 'warning':
        return 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800';
      case 'suggestion':
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
      default:
        return 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800';
    }
  };

  if (isGenerating) {
    return (
      <div className="bg-white dark:bg-[#1e2028] rounded-xl border border-slate-200 dark:border-gray-800 p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <Sparkles className="w-5 h-5 text-purple-500 animate-pulse" />
          <h3 className="text-lg font-bold text-slate-800 dark:text-gray-100">IA Pulse</h3>
          <span className="text-xs text-slate-400">Analisando dados...</span>
        </div>
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-slate-200 dark:bg-gray-700 rounded w-3/4"></div>
          <div className="h-4 bg-slate-200 dark:bg-gray-700 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#1e2028] rounded-2xl border border-slate-200/60 dark:border-gray-800/60 p-5 sm:p-6 shadow-sm hover:shadow-lg transition-all duration-300 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30">
            <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900 dark:text-gray-100">IA Pulse</h3>
            <p className="text-xs text-slate-500 dark:text-gray-400">Análise inteligente em tempo real</p>
          </div>
        </div>
        <span className="text-xs px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full font-bold">
          {insights.length} insights
        </span>
      </div>

      <div className="space-y-3">
        {insights.map((insight, index) => (
          <div
            key={index}
            className={`p-4 sm:p-5 rounded-xl border ${getColorClasses(insight.type)} transition-all hover:shadow-md hover:scale-[1.02] animate-in fade-in slide-in-from-left-4`}
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5">{getIcon(insight.type)}</div>
              <div className="flex-1">
                <h4 className="font-bold text-slate-800 dark:text-gray-100 mb-1">{insight.title}</h4>
                <p className="text-sm text-slate-600 dark:text-gray-400 leading-relaxed">{insight.message}</p>
                {insight.action && (
                  <button
                    onClick={insight.action.onClick}
                    className="mt-3 text-sm font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                  >
                    {insight.action.label}
                    <Zap className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={generateInsights}
        className="mt-4 w-full py-2 text-sm font-medium text-slate-600 dark:text-gray-400 hover:text-slate-800 dark:hover:text-gray-200 hover:bg-slate-50 dark:hover:bg-gray-800 rounded-lg transition-colors"
      >
        Atualizar insights
      </button>
    </div>
  );
}
