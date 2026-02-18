'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { Save, CheckCircle } from 'lucide-react';
import { useMedicalRecord } from '@/hooks/useMedicalRecord';
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
  patientId,
  appointmentId,
  onSave,
  onFinish
}: AttendanceFormProps) {
  const { toast } = useToast();
  const [confirmFinishOpen, setConfirmFinishOpen] = useState(false);
  const { record, isLoading, saveRecord, finishRecord } = useMedicalRecord(patientId, appointmentId);
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
  const [heightDigitsState, setHeightDigitsState] = useState(''); // Estado com apenas dígitos

  const weight = watch('weight');
  const height = watch('height');

  // Formatar dígitos para exibição (150 -> 1,50)
  const formatHeight = (digits: string): string => {
    if (!digits) return '';
    const padded = digits.padStart(3, '0');
    return padded[0] + ',' + padded.slice(1);
  };

  // Handler de teclas do campo altura
  const handleHeightKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const key = e.key;
    
    // Permitir navegação e seleção
    if (['ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End'].includes(key)) {
      return;
    }
    
    e.preventDefault(); // Prevenir comportamento padrão para tudo exceto navegação
    
    if (/^\d$/.test(key)) {
      // Adicionar dígito
      const newDigits = (heightDigitsState + key).slice(0, 3);
      setHeightDigitsState(newDigits);
      const heightCm = parseInt(newDigits) || null;
      setValue('height', heightCm);
    } else if (key === 'Backspace' || key === 'Delete') {
      // Remover último dígito
      const newDigits = heightDigitsState.slice(0, -1);
      setHeightDigitsState(newDigits);
      const heightCm = newDigits ? parseInt(newDigits) : null;
      setValue('height', heightCm);
    }
  };

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
        setValue('weight', record.vitals.weight || null);
        setValue('height', record.vitals.height || null);
        setValue('imc', record.vitals.imc || null);
        setValue('pe', record.vitals.pe || null);
        
        // Atualizar dígitos da altura para o estado
        if (record.vitals.height) {
          setHeightDigitsState(String(record.vitals.height));
        }
      }
    }
  }, [record, setValue]);

  // Calcular IMC automaticamente
  useEffect(() => {
    if (weight && height && height > 0) {
      const heightInMeters = height / 100; // height está em cm
      const imcValue = weight / (heightInMeters * heightInMeters);
      setValue('imc', parseFloat(imcValue.toFixed(2)));
    } else {
      setValue('imc', null);
    }
  }, [weight, height, setValue]);

  // Formatar IMC para exibição (com vírgula)
  const formatIMC = (value: number | null): string => {
    if (!value) return '0,00';
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

  const onSubmit = async (data: FormData) => {
    try {
      const vitals = {
        weight: data.weight ?? undefined,
        height: data.height ?? undefined,
        imc: data.imc ?? undefined,
        pe: data.pe ?? undefined,
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

      if (onSave) onSave();
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast.toast.error('Erro ao salvar o atendimento. Tente novamente.');
    }
  };

  const handleFinishClick = () => {
    setConfirmFinishOpen(true);
  };

  const handleFinishConfirm = async () => {
    setConfirmFinishOpen(false);
    try {
      const formData = watch();
      const vitals = {
        weight: formData.weight || null,
        height: formData.height || null,
        imc: formData.imc || null,
        pe: formData.pe || null,
      };

      const savedRecord = await saveRecord({
        chief_complaint: formData.chief_complaint,
        hda: formData.hda,
        antecedents: formData.antecedents,
        physical_exam: formData.physical_exam,
        conducts: formData.conducts,
        diagnosis: formData.diagnosis,
        vitals: vitals,
      } as any);

      if (savedRecord?.id) {
        await finishRecord();
        if (onFinish) onFinish();
        toast.toast.success('Atendimento finalizado com sucesso!');
      } else {
        throw new Error('Erro ao salvar o registro antes de finalizar');
      }
    } catch (error: any) {
      console.error('Erro ao finalizar:', error);
      toast.toast.error(error?.message || 'Erro ao finalizar o atendimento. Tente novamente.');
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
          <span className="text-xs text-slate-500 dark:text-gray-400 uppercase">
            {currentDate}
          </span>
        </div>

      {/* Seção: Anamnese */}
      <div className="bg-white dark:bg-[#1e2028] rounded-lg border border-slate-200 dark:border-gray-700 p-4 space-y-3">
        <h2 className="text-sm font-bold text-slate-800 dark:text-gray-200 mb-3">Atendimento</h2>
        
        {/* Queixa Principal */}
        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-1">
            Queixa principal:
          </label>
          <input
            {...register('chief_complaint')}
            type="text"
            className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#2a2d36] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            placeholder="Digite a queixa principal..."
          />
        </div>

        {/* História da Moléstia Atual */}
        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-2">
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
          <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-2">
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
      <div className="bg-white dark:bg-[#1e2028] rounded-lg border border-slate-200 dark:border-gray-700 p-4 space-y-3">
        <h2 className="text-sm font-bold text-slate-800 dark:text-gray-200 mb-3">Exame físico</h2>
        
        {/* Exame Físico */}
        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-2">
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
            <div className="w-20">
              <label className="block text-xs text-slate-600 dark:text-gray-400 mb-1">Peso</label>
              <div className="flex items-center gap-1">
                <input
                  {...register('weight', { valueAsNumber: true })}
                  type="number"
                  step="0.1"
                  className="w-full px-2 py-1.5 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#2a2d36] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-center"
                  placeholder="0"
                />
                <span className="text-xs text-slate-500">kg</span>
              </div>
            </div>
            <div className="w-20">
              <label className="block text-xs text-slate-600 dark:text-gray-400 mb-1">Altura</label>
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={formatHeight(heightDigitsState)}
                  onKeyDown={handleHeightKeyDown}
                  readOnly
                  className="w-full px-2 py-1.5 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#2a2d36] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-center cursor-text"
                  placeholder="0,00"
                />
                <span className="text-xs text-slate-500">m</span>
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
      <div className="bg-white dark:bg-[#1e2028] rounded-lg border border-slate-200 dark:border-gray-700 p-4">
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
                  <span className="text-sm text-slate-600 dark:text-gray-400 ml-2">{diag.description}</span>
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
      <div className="bg-white dark:bg-[#1e2028] rounded-lg border border-slate-200 dark:border-gray-700 p-4">
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
        <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-gray-700">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Salvar
          </button>
          <button
            type="button"
            onClick={handleFinishClick}
            disabled={isSubmitting}
            className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            Finalizar Atendimento
          </button>
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
          } catch (err: any) {
            console.error('Erro ao salvar modelo:', err);
            toast.toast.error('Erro ao salvar modelo: ' + err.message);
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
