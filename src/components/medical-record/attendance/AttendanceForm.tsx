'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { Save } from 'lucide-react';
import { useConsultation } from '@/contexts/ConsultationContext';
import { createClient } from '@/lib/supabase/client';
const supabase = createClient();
import { RichTextEditor } from './RichTextEditor';
import { DiagnosisSelect } from './DiagnosisSelect';
import { ModelTemplateModal } from './ModelTemplateModal';
import { format } from 'date-fns';
import { useToast } from '@/contexts/ToastContext';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { ptBR } from 'date-fns/locale';

interface AttendanceFormProps {
  patientId: number;
  appointmentId?: number | null;
  onSave?: () => void;
  onFinish?: () => void;
}

interface FormData {
  chief_complaint: string;
  hda: string;
  antecedents: string;
  physical_exam: string;
  conducts: string;
  diagnosis: string;
  weight: number | null;
  height: number | null;
  imc: number | null;
  pe: number | null;
}

export function AttendanceForm({
  // patientId e appointmentId vêm do ConsultationContext
  patientId: _patientId,
  appointmentId: _appointmentId,
  onSave: _onSave,
  onFinish
}: AttendanceFormProps) {
  void _patientId; void _appointmentId; void _onSave;
  const { toast } = useToast();
  const [confirmFinishOpen, setConfirmFinishOpen] = useState(false);
  const { record, isLoading, saveRecord, finishRecord, registerSaveHandler, unregisterSaveHandler } = useConsultation();
  const { register, handleSubmit, watch, setValue, formState: { isSubmitting } } = useForm<FormData>({
    defaultValues: {
      chief_complaint: '',
      hda: '',
      antecedents: '',
      physical_exam: '',
      conducts: '',
      diagnosis: '',
      weight: null,
      height: null,
      imc: null,
      pe: null,
    }
  });

  const [modelModalOpen, setModelModalOpen] = useState(false);
  const [modelModalType, setModelModalType] = useState<string>('');
  const [currentModelContent, setCurrentModelContent] = useState<string>('');
  const [diagnoses, setDiagnoses] = useState<Array<{ code: string; description: string }>>([]);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const weight = watch('weight');
  const height = watch('height');

  // Carregar dados iniciais
  useEffect(() => {
    if (record) {
      setValue('chief_complaint', record.chief_complaint || '');
      setValue('hda', record.hda || '');
      setValue('antecedents', record.antecedents || '');
      setValue('physical_exam', record.physical_exam || '');
      setValue('diagnosis', record.diagnosis || '');
      setValue('conducts', record.conducts || '');
      
      if (record.vitals) {
        // Peso armazenado em kg no banco → converte para gramas na UI
        const weightKg = record.vitals.weight || null;
        setValue('weight', weightKg ? weightKg * 1000 : null);
        setValue('height', record.vitals.height || null);
        setValue('imc', record.vitals.imc || null);
        setValue('pe', record.vitals.pe || null);
      }
    }
  }, [record, setValue]);

  // Calcular IMC automaticamente (peso em gramas → converte para kg)
  useEffect(() => {
    if (weight && height && height > 0) {
      const weightInKg = weight / 1000;
      const heightInMeters = height / 100;
      const imcValue = weightInKg / (heightInMeters * heightInMeters);
      setValue('imc', parseFloat(imcValue.toFixed(2)));
    } else {
      setValue('imc', null);
    }
  }, [weight, height, setValue]);

  // Formatar IMC para exibição (com vírgula)
  const formatIMC = (value: number | null): string => {
    if (!value || !Number.isFinite(value)) return '0,00';
    return value.toFixed(2).replace('.', ',');
  };

  const handleSaveModel = (type: string, content: string) => {
    setModelModalType(type);
    setCurrentModelContent(content);
    setModelModalOpen(true);
  };

  const handleUseModel = (type: string) => {
    setModelModalType(type);
    setCurrentModelContent('');
    setModelModalOpen(true);
  };

  const handleModelSelect = (content: string) => {
    if (modelModalType === 'hda') {
      setValue('hda', content);
    } else if (modelModalType === 'antecedents') {
      setValue('antecedents', content);
    } else if (modelModalType === 'physical_exam') {
      setValue('physical_exam', content);
    } else if (modelModalType === 'conduct') {
      setValue('conducts', content);
    }
  };

  const handleAddDiagnosis = (code: string, description: string) => {
    const newDiagnosis = { code, description };
    setDiagnoses(prev => {
      if (prev.some(d => d.code === code)) return prev;
      return [...prev, newDiagnosis];
    });
    // Atualizar campo de diagnóstico com todos os diagnósticos
    const allDiagnoses = [...diagnoses, newDiagnosis]
      .map(d => `${d.code} - ${d.description}`)
      .join('; ');
    setValue('diagnosis', allDiagnoses);
  };

  // Função reutilizável para salvar dados do formulário
  const saveFormData = useCallback(async () => {
    const data = watch();
    // Merge com vitals existentes para não sobrescrever campos de outras telas
    // (temp, sysBP, diaBP, heartRate, respRate, saturation)
    // Converte null → undefined para compatibilidade com tipo Vitals
    const existing = record?.vitals || {};
    const sanitized: Record<string, number | undefined> = {};
    for (const [k, v] of Object.entries(existing)) {
      sanitized[k] = typeof v === 'number' && Number.isFinite(v) ? v : undefined;
    }
    // Peso na UI está em gramas → converte para kg ao salvar
    const weightInKg = Number.isFinite(data.weight) ? (data.weight as number) / 1000 : undefined;
    const vitals = {
      ...sanitized,
      weight: weightInKg,
      height: Number.isFinite(data.height) ? (data.height as number) : undefined,
      imc: Number.isFinite(data.imc) ? (data.imc as number) : undefined,
      pe: Number.isFinite(data.pe) ? (data.pe as number) : undefined,
    };

    await saveRecord({
      chief_complaint: data.chief_complaint,
      hda: data.hda,
      antecedents: data.antecedents,
      physical_exam: data.physical_exam,
      diagnosis: data.diagnosis,
      conducts: data.conducts,
      vitals,
    });
  }, [watch, saveRecord, record]);

  // Registrar save handler para o contexto (usado ao Finalizar atendimento)
  useEffect(() => {
    registerSaveHandler('overview', saveFormData);
    return () => unregisterSaveHandler('overview');
  }, [registerSaveHandler, unregisterSaveHandler, saveFormData]);

  const onSubmit = async () => {
    try {
      await saveFormData();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast.toast.error('Erro ao salvar o atendimento. Tente novamente.');
    }
  };

  const handleFinishConfirm = async () => {
    setConfirmFinishOpen(false);
    try {
      await saveFormData();

      if (record?.id) {
        await finishRecord();
        if (onFinish) onFinish();
        toast.toast.success('Atendimento finalizado com sucesso!');
      } else {
        throw new Error('Erro ao salvar o registro antes de finalizar');
      }
    } catch (error: unknown) {
      console.error('Erro ao finalizar:', error);
      toast.toast.error(error instanceof Error ? error.message : 'Erro ao finalizar o atendimento. Tente novamente.');
    }
  };

  const currentDate = format(new Date(), "EEEE, d 'de' MMM 'de' yyyy", { locale: ptBR });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-600"></div>
      </div>
    );
  }

  return (
    <div className="w-full p-4">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        {/* Header com data */}
        <div className="flex justify-end mb-3">
          <span className="text-xs text-slate-500 dark:text-[#a1a1aa] uppercase">
            {currentDate}
          </span>
        </div>

      {/* Seção: Anamnese */}
      <div className="bg-white dark:bg-[#08080b] rounded-lg border border-slate-200 dark:border-[#3d3d48] p-4 space-y-3">
        <h2 className="text-sm font-bold text-slate-800 dark:text-gray-200 mb-3">Atendimento</h2>
        
        {/* Queixa Principal */}
        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-[#d4d4d8] mb-1">
            Queixa principal:
          </label>
          <input
            {...register('chief_complaint')}
            type="text"
            className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-[#3d3d48] rounded-md bg-white dark:bg-[#1c1c21] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            placeholder="Digite a queixa principal..."
          />
        </div>

        {/* História da Moléstia Atual */}
        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-[#d4d4d8] mb-2">
            História da moléstia atual:
          </label>
          <RichTextEditor
            value={watch('hda')}
            onChange={(value) => setValue('hda', value)}
            placeholder="Descreva a história da moléstia atual..."
            onSaveModel={() => handleSaveModel('hda', watch('hda'))}
            onUseModel={() => handleUseModel('hda')}
            modelType="hda"
          />
        </div>

        {/* Histórico e Antecedentes */}
        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-[#d4d4d8] mb-2">
            Histórico e antecedentes:
          </label>
          <RichTextEditor
            value={watch('antecedents')}
            onChange={(value) => setValue('antecedents', value)}
            placeholder="Descreva o histórico e antecedentes..."
            onSaveModel={() => handleSaveModel('antecedents', watch('antecedents'))}
            onUseModel={() => handleUseModel('antecedents')}
            modelType="antecedents"
          />
        </div>
      </div>

      {/* Seção: Exame Físico & Vitals */}
      <div className="bg-white dark:bg-[#08080b] rounded-lg border border-slate-200 dark:border-[#3d3d48] p-4 space-y-3">
        <h2 className="text-sm font-bold text-slate-800 dark:text-gray-200 mb-3">Exame físico</h2>

        {/* Exame Físico */}
        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-[#d4d4d8] mb-2">
            Exame físico:
          </label>
          <RichTextEditor
            value={watch('physical_exam')}
            onChange={(value) => setValue('physical_exam', value)}
            placeholder="Descreva o exame físico..."
            onSaveModel={() => handleSaveModel('physical_exam', watch('physical_exam'))}
            onUseModel={() => handleUseModel('physical_exam')}
            modelType="physical_exam"
          />
        </div>

        {/* Cálculo IMC */}
        <div>
          <label className="block text-xs font-medium text-blue-600 dark:text-blue-400 mb-2">
            Cálculo IMC
          </label>
          <div className="flex items-end gap-3">
            <div className="w-24">
              <label className="block text-xs text-slate-600 dark:text-[#a1a1aa] mb-1">Peso</label>
              <div className="flex items-center gap-1">
                <input
                  {...register('weight', { valueAsNumber: true })}
                  type="number"
                  step="0.1"
                  className="w-full px-2 py-1.5 text-sm border border-slate-200 dark:border-[#3d3d48] rounded-md bg-white dark:bg-[#1c1c21] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-center"
                  placeholder="0"
                />
                <span className="text-xs text-slate-500">g</span>
              </div>
            </div>
            <div className="w-20">
              <label className="block text-xs text-slate-600 dark:text-[#a1a1aa] mb-1">Altura</label>
              <div className="flex items-center gap-1">
                <input
                  {...register('height', { valueAsNumber: true })}
                  type="number"
                  step="0.1"
                  className="w-full px-2 py-1.5 text-sm border border-slate-200 dark:border-[#3d3d48] rounded-md bg-white dark:bg-[#1c1c21] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-center"
                  placeholder="0"
                />
                <span className="text-xs text-slate-500">cm</span>
              </div>
            </div>
            <div className="flex items-center gap-2 pb-1">
              <span className="text-sm text-slate-700 dark:text-gray-200 font-medium">
                IMC: <span className="text-blue-600 dark:text-blue-400">{formatIMC(watch('imc'))}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Seção: Diagnóstico */}
      <div className="bg-white dark:bg-[#08080b] rounded-lg border border-slate-200 dark:border-[#3d3d48] p-4">
        <h2 className="text-sm font-bold text-slate-800 dark:text-gray-200 mb-3">Diagnóstico</h2>
        <DiagnosisSelect
          value={watch('diagnosis')}
          onChange={(value) => setValue('diagnosis', value)}
          onAdd={handleAddDiagnosis}
        />
        
        {/* Lista de diagnósticos adicionados */}
        {diagnoses.length > 0 && (
          <div className="mt-4 space-y-2">
            {diagnoses.map((diag, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg"
              >
                <div>
                  <span className="font-medium text-blue-700 dark:text-blue-300">{diag.code}</span>
                  <span className="text-sm text-slate-600 dark:text-[#a1a1aa] ml-2">{diag.description}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const newDiagnoses = diagnoses.filter((_, i) => i !== index);
                    setDiagnoses(newDiagnoses);
                    const allDiagnoses = newDiagnoses
                      .map(d => `${d.code} - ${d.description}`)
                      .join('; ');
                    setValue('diagnosis', allDiagnoses || '');
                  }}
                  className="text-red-500 hover:text-red-700 text-sm"
                >
                  Remover
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Seção: Condutas */}
      <div className="bg-white dark:bg-[#08080b] rounded-lg border border-slate-200 dark:border-[#3d3d48] p-4">
        <h2 className="text-sm font-bold text-slate-800 dark:text-gray-200 mb-3">Condutas</h2>
        <RichTextEditor
          value={watch('conducts')}
          onChange={(value) => setValue('conducts', value)}
          placeholder="Descreva as condutas..."
          onSaveModel={() => handleSaveModel('conduct', watch('conducts'))}
          onUseModel={() => handleUseModel('conduct')}
          modelType="conduct"
        />
      </div>

        {/* Barra de Ações */}
        <div className="sticky bottom-0 bg-slate-50/95 dark:bg-[#0b141a]/95 backdrop-blur-sm py-3 border-t border-slate-200 dark:border-[#3d3d48] -mx-4 px-4">
          <div className="flex justify-end items-center gap-3">
            {saveSuccess && (
              <span className="text-xs text-green-600 dark:text-green-400">Salvo com sucesso!</span>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              Salvar
            </button>
          </div>
        </div>
      </form>

      {/* Modal de Modelos */}
      <ModelTemplateModal
        isOpen={modelModalOpen}
        onClose={() => setModelModalOpen(false)}
        onSelect={handleModelSelect}
        onSave={async (title, content) => {
          try {
            const { error } = await supabase
              .from('macros')
              .insert({
                title,
                type: modelModalType,
                content,
                category: 'geral',
              });
            if (error) throw error;
            setModelModalOpen(false);
          } catch (err: unknown) {
            console.error('Erro ao salvar modelo:', err);
            toast.toast.error('Erro ao salvar modelo: ' + (err instanceof Error ? err.message : String(err)));
          }
        }}
        type={modelModalType}
        currentContent={currentModelContent}
      />
      <ConfirmModal
        isOpen={confirmFinishOpen}
        onClose={() => setConfirmFinishOpen(false)}
        onConfirm={handleFinishConfirm}
        title="Finalizar atendimento"
        message="Deseja finalizar o atendimento? Esta ação não pode ser desfeita."
        type="danger"
        confirmText="Sim, finalizar"
      />
    </div>
  );
}

// Exportação default como fallback
export default AttendanceForm;
