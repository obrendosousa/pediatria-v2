'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AttendanceScreenProps } from '@/types/attendance';
import { useAnthropometry } from '@/hooks/useAnthropometry';
import { useGrowthReferenceData } from '@/hooks/useGrowthReferenceData';
import { GrowthChart } from '../GrowthChart';
import { RichTextEditor } from '../RichTextEditor';
import { ModelTemplateModal } from '../ModelTemplateModal';
import { AVAILABLE_CHARTS, getRecommendedCharts } from '@/config/growthChartsRegistry';
import { preparePatientPoints } from '@/utils/chartDataAdapter';
import {
  calculateBMI,
  exportChartToPNG,
  validateAnthropometryInputs,
  calculateAgeInMonths,
  formatXAxisLabel,
} from '@/utils/growthChartUtils';
import { createClient } from '@/lib/supabase/client';
const supabase = createClient();
import {
  Download,
  Plus,
  Save,
  AlertCircle,
  Trash2,
  Activity,
} from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';

// Seleciona automaticamente o gráfico padrão com base na idade do paciente
function getDefaultChart(ageMonths: number): string {
  if (ageMonths <= 60) return 'wfa_who_0_5';
  return 'wfa_cdc_2_20';
}

function formatDateBR(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function VitalsChart({ patientId, patientData, medicalRecordId }: AttendanceScreenProps) {
  const { toast } = useToast();

  // ── Dados do paciente ───────────────────────────────────────────────────
  const patientGender = (
    patientData?.sex?.toLowerCase() === 'masculino' ||
    patientData?.sex?.toLowerCase() === 'm'
  ) ? 'male' : 'female';

  const patientBirthDate = patientData?.birth_date || '';

  const patientAgeMonths = useMemo(() => {
    if (!patientBirthDate) return 0;
    return calculateAgeInMonths(patientBirthDate, new Date().toISOString().split('T')[0]);
  }, [patientBirthDate]);

  // ── Configuração do gráfico ─────────────────────────────────────────────
  const [selectedChartValue, setSelectedChartValue] = useState<string>('wfa_who_0_5');
  const [displayMode, setDisplayMode] = useState<'PERCENTILE' | 'Z_SCORE'>('Z_SCORE');

  // Auto-seleciona o gráfico adequado para a idade do paciente (apenas no mount)
  useEffect(() => {
    if (patientAgeMonths > 0) {
      setSelectedChartValue(getDefaultChart(patientAgeMonths));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeChartConfig = useMemo(
    () => AVAILABLE_CHARTS.find(c => c.value === selectedChartValue) || AVAILABLE_CHARTS[0],
    [selectedChartValue]
  );

  // ── Hooks de dados ──────────────────────────────────────────────────────
  const {
    entries,
    isLoading: isLoadingEntries,
    addEntry,
    deleteEntry,
    fetchEntries,
  } = useAnthropometry(patientId);

  const {
    fetchReferenceData,
    getReferenceLines,
    isLoading: isLoadingReference,
    error: referenceError,
  } = useGrowthReferenceData();

  // Re-busca dados de referência quando o gráfico ou gênero mudar
  useEffect(() => {
    fetchReferenceData(patientGender, activeChartConfig);
  }, [fetchReferenceData, patientGender, activeChartConfig]);

  // ── Dados do gráfico ────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    const referenceLines = getReferenceLines(displayMode, activeChartConfig.isXAxisLength);
    const patientPoints = preparePatientPoints({
      entries,
      chartConfig: activeChartConfig,
      patientBirthDate,
    });
    return { referenceLines, patientPoints };
  }, [entries, activeChartConfig, patientBirthDate, displayMode, getReferenceLines]);

  // ── Exame físico ────────────────────────────────────────────────────────
  const [physicalExamContent, setPhysicalExamContent] = useState('');
  const [isModelModalOpen, setIsModelModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      if (!patientId) return;
      const { data } = await supabase
        .from('medical_records')
        .select('physical_exam')
        .eq('patient_id', patientId)
        .eq('status', 'draft')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.physical_exam) setPhysicalExamContent(data.physical_exam);
    };
    load();
  }, [patientId]);

  // ── Formulário de medição ───────────────────────────────────────────────
  const [isPremature, setIsPremature] = useState(false);
  const [gestationalAgeWeeks, setGestationalAgeWeeks] = useState<number | ''>('');
  const [measurementDate, setMeasurementDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [weightKg, setWeightKg] = useState<number | ''>('');
  const [heightCm, setHeightCm] = useState<number | ''>('');
  const [headCircumferenceCm, setHeadCircumferenceCm] = useState<number | ''>('');

  const handleAddMeasurement = async () => {
    if (!weightKg && !heightCm && !headCircumferenceCm) {
      toast.toast.error('Preencha pelo menos um dado da medição.');
      return;
    }
    if (!measurementDate) {
      toast.toast.error('Selecione uma data.');
      return;
    }
    const validation = validateAnthropometryInputs(
      weightKg ? Number(weightKg) : null,
      heightCm ? Number(heightCm) : null,
      headCircumferenceCm ? Number(headCircumferenceCm) : null
    );
    if (validation) {
      toast.toast.error(validation.message);
      return;
    }
    try {
      const bmi = calculateBMI(
        weightKg ? Number(weightKg) : null,
        heightCm ? Number(heightCm) : null
      );
      await addEntry({
        patient_id: patientId,
        medical_record_id: medicalRecordId ?? null,
        measurement_date: measurementDate,
        weight_kg: weightKg ? Number(weightKg) : null,
        height_cm: heightCm ? Number(heightCm) : null,
        head_circumference_cm: headCircumferenceCm ? Number(headCircumferenceCm) : null,
        bmi,
        is_premature: isPremature,
        gestational_age_weeks: isPremature && gestationalAgeWeeks ? Number(gestationalAgeWeeks) : null,
      });
      setWeightKg('');
      setHeightCm('');
      setHeadCircumferenceCm('');
      toast.toast.success('Medição adicionada!');
    } catch (err: any) {
      toast.toast.error('Erro ao adicionar: ' + err.message);
    }
  };

  const handleDeleteEntry = async (id: number) => {
    if (!window.confirm('Excluir esta medição?')) return;
    try {
      await deleteEntry(id);
      toast.toast.success('Medição excluída.');
    } catch (err: any) {
      toast.toast.error('Erro ao excluir: ' + err.message);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { data: existing } = await supabase
        .from('medical_records')
        .select('*')
        .eq('patient_id', patientId)
        .eq('status', 'draft')
        .limit(1)
        .maybeSingle();

      const payload = {
        patient_id: patientId,
        physical_exam: physicalExamContent,
        status: 'draft',
      };

      if (existing) {
        await supabase.from('medical_records').update(payload).eq('id', existing.id);
      } else {
        await supabase.from('medical_records').insert(payload);
      }
      await fetchEntries();
      toast.toast.success('Exame físico salvo!');
    } catch (err: any) {
      toast.toast.error('Erro ao salvar: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Gráficos recomendados para a idade do paciente
  const recommendedCharts = useMemo(
    () => getRecommendedCharts(patientAgeMonths),
    [patientAgeMonths]
  );

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="p-5 space-y-5">

      {/* ── Área do Gráfico ─────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-[#1e2028] rounded-xl border border-slate-200 dark:border-gray-700 overflow-hidden">

        {/* Toolbar */}
        <div className="flex flex-wrap gap-3 px-5 py-3.5 border-b border-slate-100 dark:border-gray-700 items-center">
          {/* Seletor de gráfico */}
          <div className="flex-1 min-w-[220px]">
            <select
              value={selectedChartValue}
              onChange={(e) => setSelectedChartValue(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-[#2a2d36] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
            >
              {/* Recomendados para a idade */}
              {recommendedCharts.length > 0 && (
                <optgroup label="Recomendados para a idade">
                  {recommendedCharts.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </optgroup>
              )}
              {/* Todos os gráficos */}
              <optgroup label="Todos">
                {AVAILABLE_CHARTS.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Toggle Z-Score / Percentil */}
          <div className="flex bg-slate-100 dark:bg-[#2a2d36] rounded-lg p-1 gap-0.5">
            <button
              onClick={() => setDisplayMode('Z_SCORE')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                displayMode === 'Z_SCORE'
                  ? 'bg-white dark:bg-[#353842] shadow text-blue-600 dark:text-blue-400'
                  : 'text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-200'
              }`}
            >
              Z-Score (OMS)
            </button>
            <button
              onClick={() => setDisplayMode('PERCENTILE')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                displayMode === 'PERCENTILE'
                  ? 'bg-white dark:bg-[#353842] shadow text-blue-600 dark:text-blue-400'
                  : 'text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-200'
              }`}
            >
              Percentil
            </button>
          </div>

          {/* Download */}
          <button
            onClick={() => exportChartToPNG(chartContainerRef as React.RefObject<HTMLElement>)}
            className="p-2 hover:bg-slate-100 dark:hover:bg-[#2a2d36] rounded-lg transition-colors"
            title="Exportar PNG"
          >
            <Download className="w-4 h-4 text-slate-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Gráfico */}
        <div ref={chartContainerRef} className="px-2 pb-3">
          {isLoadingReference ? (
            <div className="h-[460px] flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-slate-400 dark:text-gray-500">Carregando curvas de referência...</p>
            </div>
          ) : referenceError ? (
            <div className="h-[460px] flex flex-col items-center justify-center gap-2 text-red-500">
              <AlertCircle className="w-8 h-8" />
              <span className="text-sm">{referenceError}</span>
            </div>
          ) : chartData.referenceLines.length === 0 ? (
            <div className="h-[460px] flex flex-col items-center justify-center gap-2 text-slate-400 dark:text-gray-500">
              <Activity className="w-8 h-8" />
              <span className="text-sm">Nenhum dado de referência para este gráfico.</span>
            </div>
          ) : (
            <GrowthChart
              data={chartData}
              chartConfig={activeChartConfig}
              displayMode={displayMode}
              xAxisLabel={activeChartConfig.xAxisLabel}
              yAxisLabel={activeChartConfig.yAxisLabel}
            />
          )}
        </div>
      </div>

      {/* ── Formulário de Nova Medição ───────────────────────────────────── */}
      <div className="bg-white dark:bg-[#1e2028] rounded-xl border border-slate-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-bold text-slate-700 dark:text-gray-200 uppercase tracking-wide mb-4">
          Nova Medição
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
              Data
            </label>
            <input
              type="date"
              value={measurementDate}
              onChange={e => setMeasurementDate(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-[#2a2d36] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
              Peso (kg)
            </label>
            <input
              type="number" step="0.01" min="0"
              value={weightKg}
              onChange={e => setWeightKg(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-3 py-2.5 border border-slate-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-[#2a2d36] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
              Estatura (cm)
            </label>
            <input
              type="number" step="0.1" min="0"
              value={heightCm}
              onChange={e => setHeightCm(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-3 py-2.5 border border-slate-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-[#2a2d36] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder="0.0"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
              PC (cm)
            </label>
            <input
              type="number" step="0.1" min="0"
              value={headCircumferenceCm}
              onChange={e => setHeadCircumferenceCm(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-3 py-2.5 border border-slate-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-[#2a2d36] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder="0.0"
            />
          </div>
          <div>
            <button
              onClick={handleAddMeasurement}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors"
            >
              <Plus className="w-4 h-4" /> Adicionar
            </button>
          </div>
        </div>

        {/* Prematuro */}
        <div className="mt-3.5 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isPremature}
              onChange={e => setIsPremature(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-slate-600 dark:text-gray-300">Paciente prematuro</span>
          </label>
          {isPremature && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500 dark:text-gray-400">Idade gestacional:</label>
              <input
                type="number" min="24" max="36"
                value={gestationalAgeWeeks}
                onChange={e => setGestationalAgeWeeks(e.target.value ? Number(e.target.value) : '')}
                className="w-20 px-2 py-1.5 border border-slate-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-[#2a2d36] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="semanas"
              />
              <span className="text-xs text-slate-400 dark:text-gray-500">semanas</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Histórico de Medições ────────────────────────────────────────── */}
      {(isLoadingEntries || entries.length > 0) && (
        <div className="bg-white dark:bg-[#1e2028] rounded-xl border border-slate-200 dark:border-gray-700 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-700 dark:text-gray-200 uppercase tracking-wide">
              Histórico de Medições
            </h2>
            <span className="text-xs text-slate-400 dark:text-gray-500">
              {entries.length} registro{entries.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-[#2a2d36]">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide">
                    Data
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide">
                    Peso (kg)
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide">
                    Estatura (cm)
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide">
                    PC (cm)
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide">
                    IMC
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide">
                    Idade
                  </th>
                  <th className="px-4 py-3 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                {isLoadingEntries ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-6 text-center text-sm text-slate-400 dark:text-gray-500">
                      Carregando...
                    </td>
                  </tr>
                ) : (
                  entries.map((entry) => {
                    const ageAtMeasurement = patientBirthDate
                      ? calculateAgeInMonths(patientBirthDate, entry.measurement_date)
                      : null;
                    return (
                      <tr
                        key={entry.id}
                        className="hover:bg-slate-50 dark:hover:bg-[#2a2d36] transition-colors"
                      >
                        <td className="px-5 py-3 font-medium text-slate-700 dark:text-gray-200 whitespace-nowrap">
                          {formatDateBR(entry.measurement_date)}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600 dark:text-gray-300 tabular-nums">
                          {entry.weight_kg != null ? entry.weight_kg.toFixed(2) : '—'}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600 dark:text-gray-300 tabular-nums">
                          {entry.height_cm != null ? entry.height_cm.toFixed(1) : '—'}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600 dark:text-gray-300 tabular-nums">
                          {entry.head_circumference_cm != null ? entry.head_circumference_cm.toFixed(1) : '—'}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600 dark:text-gray-300 tabular-nums">
                          {entry.bmi != null ? entry.bmi.toFixed(1) : '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-500 dark:text-gray-400 text-xs whitespace-nowrap">
                          {ageAtMeasurement !== null ? formatXAxisLabel(ageAtMeasurement) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleDeleteEntry(entry.id!)}
                            className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-400 dark:text-red-500" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Exame Físico ─────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-[#1e2028] rounded-xl border border-slate-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-bold text-slate-700 dark:text-gray-200 uppercase tracking-wide mb-4">
          Exame Físico
        </h2>
        <RichTextEditor
          value={physicalExamContent}
          onChange={setPhysicalExamContent}
          onSaveModel={() => setIsModelModalOpen(true)}
          onUseModel={() => setIsModelModalOpen(true)}
          modelType="physical_exam"
        />
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg font-semibold text-sm transition-colors"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Salvando...' : 'Salvar Exame Físico'}
          </button>
        </div>
      </div>

      <ModelTemplateModal
        isOpen={isModelModalOpen}
        onClose={() => setIsModelModalOpen(false)}
        onSelect={(content) => { setPhysicalExamContent(content); setIsModelModalOpen(false); }}
        onSave={() => setIsModelModalOpen(false)}
        type="physical_exam"
        currentContent={physicalExamContent}
      />
    </div>
  );
}
