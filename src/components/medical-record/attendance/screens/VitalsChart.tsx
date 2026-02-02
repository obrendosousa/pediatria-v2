'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AttendanceScreenProps } from '@/types/attendance';
import { useAnthropometry } from '@/hooks/useAnthropometry';
import { useGrowthReferenceData } from '@/hooks/useGrowthReferenceData';
import { GrowthChart } from '../GrowthChart';
import { RichTextEditor } from '../RichTextEditor';
import { ModelTemplateModal } from '../ModelTemplateModal';
import {
  GrowthChartData,
  AnthropometryEntry,
} from '@/types/anthropometry';
import { AVAILABLE_CHARTS, ChartRegistryConfig } from '@/config/growthChartsRegistry';
import {
  calculateAgeInMonths,
  calculateCorrectedAge,
  calculateBMI,
  exportChartToPNG,
  validateAnthropometryInputs,
} from '@/utils/growthChartUtils';
import { supabase } from '@/lib/supabase';
import {
  Download,
  Plus,
  Calendar,
  Save,
  AlertCircle,
} from 'lucide-react';

export function VitalsChart({ patientId, patientData }: AttendanceScreenProps) {
  // Obter gênero do paciente (male ou female)
  const patientGender = (patientData?.sex?.toLowerCase() === 'masculino' || patientData?.sex?.toLowerCase() === 'm') 
    ? 'male' 
    : 'female';

  const [selectedChart, setSelectedChart] = useState<ChartRegistryConfig>(AVAILABLE_CHARTS[0]);
  const [displayMode, setDisplayMode] = useState<'PERCENTILE' | 'Z_SCORE'>('PERCENTILE');
  const [chartData, setChartData] = useState<GrowthChartData>({
    patientPoints: [],
    referenceLines: [],
  });
  const [physicalExamContent, setPhysicalExamContent] = useState('');
  const [isModelModalOpen, setIsModelModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  // Formulário de entrada
  const [isPremature, setIsPremature] = useState(false);
  const [gestationalAgeWeeks, setGestationalAgeWeeks] = useState<number | ''>('');
  const [measurementDate, setMeasurementDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [weightKg, setWeightKg] = useState<number | ''>('');
  const [heightCm, setHeightCm] = useState<number | ''>('');
  const [headCircumferenceCm, setHeadCircumferenceCm] = useState<number | ''>('');

  const { entries, isLoading: isLoadingEntries, addEntry, fetchEntries } = useAnthropometry(patientId);
  const { getReferenceLines, fetchReferenceData, isLoading: isLoadingReference, error: referenceError, hasData } = useGrowthReferenceData();

  // Carregar exame físico existente
  useEffect(() => {
    const loadPhysicalExam = async () => {
      try {
        const { data, error } = await supabase
          .from('medical_records')
          .select('physical_exam')
          .eq('patient_id', patientId)
          .eq('status', 'draft')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && data?.physical_exam) {
          setPhysicalExamContent(data.physical_exam);
        }
      } catch (error) {
        console.error('Erro ao carregar exame físico:', error);
      }
    };

    if (patientId) {
      loadPhysicalExam();
    }
  }, [patientId]);

  // Buscar dados de referência quando a configuração mudar
  useEffect(() => {
    if (selectedChart && displayMode && patientGender) {
      fetchReferenceData(selectedChart, patientGender, displayMode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChart.value, displayMode, patientGender]);

  // Memoizar linhas de referência para evitar recálculos
  // Incluir isLoadingReference para re-executar quando dados forem carregados
  const referenceLines = useMemo(() => {
    try {
      const lines = getReferenceLines(selectedChart, patientGender, displayMode);
      console.log('[VitalsChart] Reference lines computed:', {
        lineCount: lines.length,
        chartValue: selectedChart.value,
        displayMode,
        patientGender
      });
      return lines;
    } catch (error) {
      console.error('Erro ao obter linhas de referência:', error);
      return [];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChart.value, displayMode, patientGender, isLoadingReference]);

  // Atualizar dados do gráfico quando entries ou configuração mudarem
  useEffect(() => {
    if (!patientData?.birth_date) {
      setChartData({
        patientPoints: [],
        referenceLines: [],
      });
      return;
    }

    try {
      const birthDate = patientData.birth_date;

    // Converter entries em pontos do gráfico
    const patientPoints = entries
      .filter(entry => {
        // Filtrar entries baseado no tipo de gráfico selecionado
        switch (selectedChart.dbType) {
          case 'wfa':
            return entry.weight_kg !== null && entry.weight_kg !== undefined;
          case 'lhfa':
            return entry.height_cm !== null && entry.height_cm !== undefined;
          case 'bmifa':
            return entry.bmi !== null && entry.bmi !== undefined;
          case 'hcfa':
            return entry.head_circumference_cm !== null && entry.head_circumference_cm !== undefined;
          case 'wfl':
          case 'wfh':
            // Peso x altura: precisa de ambos
            return entry.weight_kg !== null && entry.height_cm !== null;
          default:
            return true;
        }
      })
      .map(entry => {
        // Se eixo X é altura (wfl/wfh), usar altura como X
        if (selectedChart.isXAxisLength) {
          const height = entry.height_cm || 0;
          const weight = entry.weight_kg || 0;
          return {
            x: height,
            y: weight,
            date: entry.measurement_date,
            entryId: entry.id || 0,
          };
        }

        // Caso contrário, usar idade como X
        let ageMonths: number;
        if (entry.is_premature && entry.gestational_age_weeks) {
          const corrected = calculateCorrectedAge(
            birthDate,
            entry.gestational_age_weeks,
            entry.measurement_date
          );
          ageMonths = corrected || calculateAgeInMonths(birthDate, entry.measurement_date);
        } else {
          ageMonths = calculateAgeInMonths(birthDate, entry.measurement_date);
        }

        // Determinar valor Y baseado no tipo de gráfico
        let yValue: number;
        switch (selectedChart.dbType) {
          case 'wfa':
            yValue = entry.weight_kg || 0;
            break;
          case 'lhfa':
            yValue = entry.height_cm || 0;
            break;
          case 'bmifa':
            yValue = entry.bmi || 0;
            break;
          case 'hcfa':
            yValue = entry.head_circumference_cm || 0;
            break;
          case 'wfl':
          case 'wfh':
            yValue = entry.weight_kg || 0;
            break;
          default:
            yValue = 0;
        }

        return {
          x: ageMonths,
          y: yValue,
          date: entry.measurement_date,
          entryId: entry.id || 0,
        };
      });

      setChartData({
        patientPoints,
        referenceLines: referenceLines,
      });
    } catch (error) {
      console.error('Erro ao processar dados do gráfico:', error);
      setChartData({
        patientPoints: [],
        referenceLines: [],
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries.length, selectedChart.value, displayMode, patientData?.birth_date]);

  // Adicionar nova medição
  const handleAddMeasurement = async () => {
    // Validação
    const validation = validateAnthropometryInputs(
      weightKg as number,
      heightCm as number,
      headCircumferenceCm as number
    );

    if (validation) {
      alert(validation.message);
      return;
    }

    if (!measurementDate) {
      alert('Selecione uma data para a medição');
      return;
    }

    // Calcular IMC
    const bmi = calculateBMI(weightKg as number, heightCm as number);

    try {
      await addEntry({
        patient_id: patientId,
        measurement_date: measurementDate,
        weight_kg: weightKg ? Number(weightKg) : null,
        height_cm: heightCm ? Number(heightCm) : null,
        head_circumference_cm: headCircumferenceCm ? Number(headCircumferenceCm) : null,
        bmi: bmi,
        is_premature: isPremature,
        gestational_age_weeks: isPremature && gestationalAgeWeeks ? Number(gestationalAgeWeeks) : null,
        notes: null,
      });

      // Limpar formulário
      setWeightKg('');
      setHeightCm('');
      setHeadCircumferenceCm('');
      setGestationalAgeWeeks('');
      setIsPremature(false);
    } catch (error: any) {
      console.error('Erro ao adicionar medição:', error);
      alert('Erro ao adicionar medição: ' + (error.message || 'Erro desconhecido'));
    }
  };

  // Salvar exame físico e medições
  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Buscar ou criar medical_record para este paciente
      let { data: existingRecord, error: fetchError } = await supabase
        .from('medical_records')
        .select('*')
        .eq('patient_id', patientId)
        .eq('status', 'draft')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      const recordData: any = {
        patient_id: patientId,
        physical_exam: physicalExamContent.trim() || null,
        status: 'draft',
      };

      if (existingRecord) {
        // Atualizar registro existente
        const { error: updateError } = await supabase
          .from('medical_records')
          .update(recordData)
          .eq('id', existingRecord.id);

        if (updateError) throw updateError;
      } else {
        // Criar novo registro
        const { error: insertError } = await supabase
          .from('medical_records')
          .insert(recordData);

        if (insertError) throw insertError;
      }

      // Recarregar dados
      await fetchEntries();

      alert('Dados salvos com sucesso!');
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      alert('Erro ao salvar: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setIsSaving(false);
    }
  };

  // Exportar gráfico como PNG
  const handleExportChart = async () => {
    try {
      await exportChartToPNG(chartContainerRef, 'curva-crescimento');
    } catch (error: any) {
      console.error('Erro ao exportar gráfico:', error);
      alert('Erro ao exportar gráfico. Certifique-se de que html2canvas está instalado.');
    }
  };

  // Obter labels dos eixos baseado na configuração do gráfico
  const xAxisLabel = selectedChart.xAxisLabel;
  const yAxisLabel = selectedChart.yAxisLabel;

  return (
    <div className="p-6 space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-gray-100">
            Estatura / Peso / IMC / PC
          </h1>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
            {new Date().toLocaleDateString('pt-BR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>
      </div>

      {/* Controles do Gráfico */}
      <div className="bg-white dark:bg-[#1e2028] rounded-xl border border-slate-200 dark:border-gray-800 p-4">
        <div className="flex items-center gap-4 mb-4">
          <div className="flex-1">
            <label className="block text-xs font-bold text-slate-500 dark:text-gray-400 uppercase mb-2">
              Curva de crescimento:
            </label>
            <select
              value={selectedChart.value}
              onChange={(e) => {
                const option = AVAILABLE_CHARTS.find(opt => opt.value === e.target.value);
                if (option) setSelectedChart(option);
              }}
              className="w-full px-3 py-2 border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-[#2a2d36] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
            >
              {AVAILABLE_CHARTS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setDisplayMode('PERCENTILE')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                displayMode === 'PERCENTILE'
                  ? 'bg-rose-600 text-white'
                  : 'bg-slate-100 dark:bg-[#2a2d36] text-slate-700 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-[#353842]'
              }`}
            >
              PERCENTIL
            </button>
            <button
              onClick={() => setDisplayMode('Z_SCORE')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                displayMode === 'Z_SCORE'
                  ? 'bg-rose-600 text-white'
                  : 'bg-slate-100 dark:bg-[#2a2d36] text-slate-700 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-[#353842]'
              }`}
            >
              SCORE-Z
            </button>
          </div>

          <button
            onClick={handleExportChart}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            BAIXAR CURVA
          </button>
        </div>

        {/* Gráfico */}
        <div ref={chartContainerRef} className="w-full">
          {isLoadingReference ? (
            <div className="h-[500px] flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-600 mx-auto mb-4"></div>
                <p className="text-sm text-slate-500 dark:text-gray-400">Carregando dados de referência...</p>
              </div>
            </div>
          ) : referenceError ? (
            <div className="h-[500px] flex items-center justify-center">
              <div className="text-center max-w-md">
                <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
                <p className="text-sm font-medium text-slate-800 dark:text-gray-200 mb-2">
                  Erro ao carregar dados de referência
                </p>
                <p className="text-xs text-slate-500 dark:text-gray-400">
                  {referenceError}
                </p>
                <button
                  onClick={() => fetchReferenceData(selectedChart, patientGender, displayMode)}
                  className="mt-4 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm transition-colors"
                >
                  Tentar novamente
                </button>
              </div>
            </div>
          ) : referenceLines.length === 0 ? (
            <div className="h-[500px] flex items-center justify-center">
              <div className="text-center max-w-md">
                <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                <p className="text-sm font-medium text-slate-800 dark:text-gray-200 mb-2">
                  Dados de referência não encontrados
                </p>
                <p className="text-xs text-slate-500 dark:text-gray-400 mb-4">
                  Não foi possível carregar as curvas de referência para {selectedChart.label}. 
                  Verifique se os dados foram importados corretamente.
                </p>
                <button
                  onClick={() => fetchReferenceData(selectedChart, patientGender, displayMode)}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm transition-colors"
                >
                  Tentar carregar novamente
                </button>
              </div>
            </div>
          ) : (
            <GrowthChart
              data={chartData}
              chartConfig={selectedChart}
              displayMode={displayMode}
              xAxisLabel={xAxisLabel}
              yAxisLabel={yAxisLabel}
            />
          )}
        </div>

        <p className="text-xs text-slate-400 dark:text-gray-500 mt-2 text-right">
          Fonte: {selectedChart.source === 'WHO' ? 'OMS 2006/2007' : 'CDC'}
        </p>
      </div>

      {/* Formulário de Entrada */}
      <div className="bg-white dark:bg-[#1e2028] rounded-xl border border-slate-200 dark:border-gray-800 p-6">
        <h2 className="text-lg font-bold text-slate-800 dark:text-gray-100 mb-4">
          Adicionar Medição
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          {/* Prematuro */}
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-gray-400 uppercase mb-2">
              Prematuro
            </label>
            <select
              value={isPremature ? 'sim' : 'nao'}
              onChange={(e) => {
                setIsPremature(e.target.value === 'sim');
                if (e.target.value === 'nao') {
                  setGestationalAgeWeeks('');
                }
              }}
              className="w-full px-3 py-2 border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-[#2a2d36] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
            >
              <option value="nao">Não é prematuro</option>
              <option value="sim">Prematuro</option>
            </select>
          </div>

          {/* Idade Gestacional (se prematuro) */}
          {isPremature && (
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-gray-400 uppercase mb-2">
                IG (semanas)
              </label>
              <input
                type="number"
                min="20"
                max="40"
                value={gestationalAgeWeeks}
                onChange={(e) => setGestationalAgeWeeks(e.target.value ? Number(e.target.value) : '')}
                placeholder="Ex: 32"
                className="w-full px-3 py-2 border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-[#2a2d36] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>
          )}

          {/* Data */}
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-gray-400 uppercase mb-2">
              Data
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="date"
                value={measurementDate}
                onChange={(e) => setMeasurementDate(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-[#2a2d36] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>
          </div>

          {/* Peso */}
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-gray-400 uppercase mb-2">
              Peso (kg)
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value ? Number(e.target.value) : '')}
              placeholder="0.0"
              className="w-full px-3 py-2 border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-[#2a2d36] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
            />
          </div>

          {/* Altura */}
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-gray-400 uppercase mb-2">
              Altura (cm)
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value ? Number(e.target.value) : '')}
              placeholder="0.0"
              className="w-full px-3 py-2 border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-[#2a2d36] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
            />
          </div>

          {/* Perímetro Cefálico */}
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-gray-400 uppercase mb-2">
              Per. cefálico (cm)
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={headCircumferenceCm}
              onChange={(e) => setHeadCircumferenceCm(e.target.value ? Number(e.target.value) : '')}
              placeholder="0.0"
              className="w-full px-3 py-2 border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-[#2a2d36] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
            />
          </div>
        </div>

        {/* Botão Adicionar */}
        <div className="mt-4 flex justify-center">
          <button
            onClick={handleAddMeasurement}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            ADICIONAR
          </button>
        </div>
      </div>

      {/* Editor de Exame Físico */}
      <div className="bg-white dark:bg-[#1e2028] rounded-xl border border-slate-200 dark:border-gray-800 p-6">
        <h2 className="text-lg font-bold text-slate-800 dark:text-gray-100 mb-4">
          EXAME FÍSICO
        </h2>
        <RichTextEditor
          value={physicalExamContent}
          onChange={setPhysicalExamContent}
          placeholder="Digite o exame físico aqui..."
          onSaveModel={() => setIsModelModalOpen(true)}
          onUseModel={() => setIsModelModalOpen(true)}
          modelType="physical_exam"
        />
      </div>

      {/* Botão Salvar Global */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-8 py-3 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white rounded-xl font-bold transition-colors flex items-center gap-2 shadow-lg"
        >
          {isSaving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Salvando...
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              SALVAR
            </>
          )}
        </button>
      </div>

      {/* Modal de Modelos */}
      <ModelTemplateModal
        isOpen={isModelModalOpen}
        onClose={() => setIsModelModalOpen(false)}
        onSelect={(content) => {
          setPhysicalExamContent(content);
          setIsModelModalOpen(false);
        }}
        onSave={(title, content) => {
          // O modal já salva via Supabase
          setIsModelModalOpen(false);
        }}
        type="physical_exam"
        currentContent={physicalExamContent}
      />
    </div>
  );
}
