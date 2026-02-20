'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AttendanceScreenProps } from '@/types/attendance';
import { useAnthropometry } from '@/hooks/useAnthropometry';
import { useGrowthReferenceData } from '@/hooks/useGrowthReferenceData';
import { GrowthChart } from '../GrowthChart';
import { RichTextEditor } from '../RichTextEditor';
import { ModelTemplateModal } from '../ModelTemplateModal';
import { AVAILABLE_CHARTS } from '@/config/growthChartsRegistry';
import { preparePatientPoints } from '@/utils/chartDataAdapter'; // <--- Importamos o novo adaptador
import {
  calculateBMI,
  exportChartToPNG,
  validateAnthropometryInputs,
} from '@/utils/growthChartUtils';
import { createClient } from '@/lib/supabase/client';
const supabase = createClient();
import {
  Download,
  Plus,
  Save,
  AlertCircle,
  Info
} from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';

export function VitalsChart({ patientId, patientData }: AttendanceScreenProps) {
  const { toast } = useToast();
  // 1. Configuração do Paciente
  const patientGender = (patientData?.sex?.toLowerCase() === 'masculino' || patientData?.sex?.toLowerCase() === 'm') 
    ? 'male' 
    : 'female';

  const patientBirthDate = patientData?.birth_date || '';

  // 2. Estado (Configuração do Gráfico)
  // NOTA: Para este teste, vamos fixar na configuração que implementamos no backend (WHO 0-5)
  // Mesmo que o usuário mude o dropdown, os dados virão da WHO 0-5 por enquanto.
  const [selectedChartValue, setSelectedChartValue] = useState('wfa_who_0_5');
  const [displayMode, setDisplayMode] = useState<'PERCENTILE' | 'Z_SCORE'>('Z_SCORE');
  
  // Encontra a configuração completa baseada no valor selecionado
  const activeChartConfig = useMemo(() => 
    AVAILABLE_CHARTS.find(c => c.value === selectedChartValue) || AVAILABLE_CHARTS[0]
  , [selectedChartValue]);

  // 3. Hooks de Dados (Conectando com o que criamos nas etapas anteriores)
  const { entries, isLoading: isLoadingEntries, addEntry, fetchEntries } = useAnthropometry(patientId);
  const { 
    fetchReferenceData, 
    getReferenceLines, 
    isLoading: isLoadingReference, 
    error: referenceError 
  } = useGrowthReferenceData();

  const [physicalExamContent, setPhysicalExamContent] = useState('');
  const [isModelModalOpen, setIsModelModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  
  // Estados do Formulário de Medição
  const [isPremature, setIsPremature] = useState(false);
  const [gestationalAgeWeeks, setGestationalAgeWeeks] = useState<number | ''>('');
  const [measurementDate, setMeasurementDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [weightKg, setWeightKg] = useState<number | ''>('');
  const [heightCm, setHeightCm] = useState<number | ''>('');
  const [headCircumferenceCm, setHeadCircumferenceCm] = useState<number | ''>('');

  // 4. EFEITO: Carregar dados de referência
  useEffect(() => {
    // Chama o hook novo (que busca WHO 0-5 fixo por enquanto)
    fetchReferenceData(patientGender);
  }, [fetchReferenceData, patientGender]);

  // 5. CÁLCULO: Preparar dados para o gráfico (Usando o Adapter)
  const chartData = useMemo(() => {
    // a. Linhas de referência (Z-Score ou Percentil)
    const referenceLines = getReferenceLines(displayMode);

    // b. Pontos do paciente (Calculados pelo Adapter)
    const patientPoints = preparePatientPoints({
      entries,
      chartConfig: activeChartConfig,
      patientBirthDate,
      // Passar dados de prematuridade se necessário (futuro)
    });

    return {
      referenceLines,
      patientPoints
    };
  }, [entries, activeChartConfig, patientBirthDate, displayMode, getReferenceLines]);

  useEffect(() => {
    const loadPhysicalExam = async () => {
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
    loadPhysicalExam();
  }, [patientId]);

  // Funções de Ação (Adicionar, Salvar, Exportar)
  const handleAddMeasurement = async () => {
    const validation = validateAnthropometryInputs(
      weightKg as number, heightCm as number, headCircumferenceCm as number
    );
    if (validation) return toast.error(validation.message);
    if (!measurementDate) return toast.error('Selecione uma data');

    try {
      const bmi = calculateBMI(weightKg as number, heightCm as number);
      await addEntry({
        patient_id: patientId,
        measurement_date: measurementDate,
        weight_kg: weightKg ? Number(weightKg) : null,
        height_cm: heightCm ? Number(heightCm) : null,
        head_circumference_cm: headCircumferenceCm ? Number(headCircumferenceCm) : null,
        bmi,
        is_premature: isPremature,
        gestational_age_weeks: isPremature && gestationalAgeWeeks ? Number(gestationalAgeWeeks) : null,
      });
      // Limpar form
      setWeightKg(''); setHeightCm(''); setHeadCircumferenceCm('');
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { data: existing } = await supabase
        .from('medical_records').select('*').eq('patient_id', patientId)
        .eq('status', 'draft').limit(1).maybeSingle();

      const payload = { patient_id: patientId, physical_exam: physicalExamContent, status: 'draft' };

      if (existing) {
        await supabase.from('medical_records').update(payload).eq('id', existing.id);
      } else {
        await supabase.from('medical_records').insert(payload);
      }
      await fetchEntries();
      toast.success('Salvo com sucesso!');
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-gray-100">
            Curvas de Crescimento
          </h1>
          <p className="text-sm text-slate-500">
            Paciente: {patientGender === 'male' ? 'Menino' : 'Menina'} | DN: {new Date(patientBirthDate).toLocaleDateString('pt-BR')}
          </p>
        </div>
      </div>

      {/* Área do Gráfico */}
      <div className="bg-white dark:bg-[#1e2028] rounded-xl border border-slate-200 p-4">
        {/* Barra de Ferramentas */}
        <div className="flex flex-wrap gap-4 mb-4 items-center">
          <div className="flex-1 min-w-[200px]">
            <select
              value={selectedChartValue}
              onChange={(e) => setSelectedChartValue(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm bg-slate-50"
            >
              {AVAILABLE_CHARTS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {/* Aviso de Teste */}
            <div className="text-xs text-orange-600 mt-1 flex items-center gap-1">
              <Info size={12} />
              <span>Modo Validação: Exibindo apenas WHO 0-5 Anos (Peso)</span>
            </div>
          </div>

          <div className="flex bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setDisplayMode('Z_SCORE')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                displayMode === 'Z_SCORE' ? 'bg-white shadow text-blue-600' : 'text-slate-500'
              }`}
            >
              Z-Score (OMS)
            </button>
            <button
              onClick={() => setDisplayMode('PERCENTILE')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                displayMode === 'PERCENTILE' ? 'bg-white shadow text-blue-600' : 'text-slate-500'
              }`}
            >
              Percentil
            </button>
          </div>
          
          <button onClick={() => exportChartToPNG(chartContainerRef as React.RefObject<HTMLElement>)} className="p-2 hover:bg-slate-100 rounded-lg" title="Baixar PNG">
            <Download className="w-4 h-4 text-slate-600" />
          </button>
        </div>

        {/* Componente Visual do Gráfico */}
        <div ref={chartContainerRef} className="w-full min-h-[500px]">
          {isLoadingReference ? (
            <div className="h-[500px] flex items-center justify-center text-slate-400">
              Carregando curvas de referência...
            </div>
          ) : referenceError ? (
            <div className="h-[500px] flex flex-col items-center justify-center text-red-500 gap-2">
              <AlertCircle />
              <span>{referenceError}</span>
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

      {/* Formulário de Adição (Mantido original simplificado) */}
      <div className="bg-white dark:bg-[#1e2028] rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-bold mb-4">Nova Medição</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase">Data</label>
            <input type="date" value={measurementDate} onChange={e => setMeasurementDate(e.target.value)} className="w-full p-2 border rounded" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase">Peso (kg)</label>
            <input type="number" step="0.1" value={weightKg} onChange={e => setWeightKg(e.target.value ? Number(e.target.value) : '')} className="w-full p-2 border rounded" placeholder="0.0" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase">Altura (cm)</label>
            <input type="number" step="0.1" value={heightCm} onChange={e => setHeightCm(e.target.value ? Number(e.target.value) : '')} className="w-full p-2 border rounded" placeholder="0.0" />
          </div>
          <div className="flex items-end">
            <button onClick={handleAddMeasurement} className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium">
              <Plus className="w-4 h-4 inline mr-2" /> Adicionar
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1e2028] rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-bold mb-4">Exame Físico</h2>
        <RichTextEditor
          value={physicalExamContent}
          onChange={setPhysicalExamContent}
          onSaveModel={() => setIsModelModalOpen(true)}
          onUseModel={() => setIsModelModalOpen(true)}
          modelType="physical_exam"
        />
        <div className="mt-4 flex justify-end">
          <button onClick={handleSave} disabled={isSaving} className="px-6 py-2 bg-rose-600 text-white rounded font-bold hover:bg-rose-700 flex items-center gap-2">
            <Save className="w-4 h-4" /> {isSaving ? 'Salvando...' : 'Salvar Prontuário'}
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
