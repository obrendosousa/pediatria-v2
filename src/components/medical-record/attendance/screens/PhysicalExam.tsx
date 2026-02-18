'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Save } from 'lucide-react';
import { useMedicalRecord, PhysicalExamData } from '@/hooks/useMedicalRecord';
import { RichTextEditor } from '../RichTextEditor';
import { ModelTemplateModal } from '../ModelTemplateModal';
import { AttendanceScreenProps } from '@/types/attendance';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { createClient } from '@/lib/supabase/client';
const supabase = createClient();
import { useToast } from '@/contexts/ToastContext';

interface PhysicalExamFormData {
  general_exam: string;
  otoscopy: string;
  mouth_throat_exam: string;
  skin_mucosa_exam: string;
  head_neck_exam: string;
  respiratory_exam: string;
  abdomen_exam: string;
  nervous_system_exam: string;
  genitals_exam: string;
}

export function PhysicalExam({ patientId, patientData, onRefresh, appointmentId }: AttendanceScreenProps) {
  const { toast } = useToast();
  const { record, isLoading, saveRecord } = useMedicalRecord(patientId, appointmentId);
  const { register, handleSubmit, watch, setValue, formState: { isSubmitting } } = useForm<PhysicalExamFormData>({
    defaultValues: {
      general_exam: '',
      otoscopy: '',
      mouth_throat_exam: '',
      skin_mucosa_exam: '',
      head_neck_exam: '',
      respiratory_exam: '',
      abdomen_exam: '',
      nervous_system_exam: '',
      genitals_exam: '',
    }
  });

  const [modelModalOpen, setModelModalOpen] = useState(false);
  const [modelModalType, setModelModalType] = useState<string>('');
  const [currentModelContent, setCurrentModelContent] = useState<string>('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const currentDate = format(new Date(), "EEEE, d 'de' MMM. 'de' yyyy", { locale: ptBR });

  // Carregar dados iniciais
  useEffect(() => {
    if (record?.physical_exam_data) {
      const data = record.physical_exam_data;
      setValue('general_exam', data.general_exam || '');
      setValue('otoscopy', data.otoscopy || '');
      setValue('mouth_throat_exam', data.mouth_throat_exam || '');
      setValue('skin_mucosa_exam', data.skin_mucosa_exam || '');
      setValue('head_neck_exam', data.head_neck_exam || '');
      setValue('respiratory_exam', data.respiratory_exam || '');
      setValue('abdomen_exam', data.abdomen_exam || '');
      setValue('nervous_system_exam', data.nervous_system_exam || '');
      setValue('genitals_exam', data.genitals_exam || '');
    }
  }, [record, setValue]);

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
    if (modelModalType === 'physical_exam_general') {
      setValue('general_exam', content);
    } else if (modelModalType === 'physical_exam_skin') {
      setValue('skin_mucosa_exam', content);
    } else if (modelModalType === 'physical_exam_abdomen') {
      setValue('abdomen_exam', content);
    } else if (modelModalType === 'physical_exam_nervous') {
      setValue('nervous_system_exam', content);
    } else if (modelModalType === 'physical_exam_genitals') {
      setValue('genitals_exam', content);
    }
  };

  const onSubmit = async (data: PhysicalExamFormData) => {
    try {
      const physicalExamData: PhysicalExamData = {
        general_exam: data.general_exam || null,
        otoscopy: data.otoscopy || null,
        mouth_throat_exam: data.mouth_throat_exam || null,
        skin_mucosa_exam: data.skin_mucosa_exam || null,
        head_neck_exam: data.head_neck_exam || null,
        respiratory_exam: data.respiratory_exam || null,
        abdomen_exam: data.abdomen_exam || null,
        nervous_system_exam: data.nervous_system_exam || null,
        genitals_exam: data.genitals_exam || null,
      };

      await saveRecord({
        physical_exam_data: physicalExamData,
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast.toast.error('Erro ao salvar o formulário. Tente novamente.');
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 pb-20">
      {/* Header */}
      <div className="mb-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-slate-800 dark:text-gray-100">EXAME FÍSICO</h1>
        <span className="text-xs text-slate-500 dark:text-gray-400 uppercase">{currentDate}</span>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        {/* 1. EXAME FÍSICO GERAL - Rich Text */}
        <div className="bg-white dark:bg-[#1e2028] rounded-lg border border-slate-200 dark:border-gray-700 p-4">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-gray-200">EXAME FÍSICO GERAL</h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleUseModel('physical_exam_general')}
                className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
              >
                Usar modelo
              </button>
              <button
                type="button"
                onClick={() => handleSaveModel('physical_exam_general', watch('general_exam'))}
                className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
              >
                Salvar modelo
              </button>
            </div>
          </div>
          <RichTextEditor
            value={watch('general_exam') || ''}
            onChange={(value) => setValue('general_exam', value)}
            placeholder="Descreva o exame físico geral..."
            onSaveModel={() => handleSaveModel('physical_exam_general', watch('general_exam') || '')}
            onUseModel={() => handleUseModel('physical_exam_general')}
            modelType="physical_exam_general"
          />
        </div>

        {/* Card agrupado: Cabeça e Pescoço */}
        <div className="bg-white dark:bg-[#1e2028] rounded-lg border border-slate-200 dark:border-gray-700 p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-1">
              OTOSCOPIA
            </label>
            <input
              type="text"
              {...register('otoscopy')}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#2a2d36] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              placeholder="Digite informações sobre otoscopia..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-1">
              EXAME BOCA E GARGANTA
            </label>
            <input
              type="text"
              {...register('mouth_throat_exam')}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#2a2d36] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              placeholder="Digite informações sobre exame de boca e garganta..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-1">
              EXAME CABEÇA E PESCOÇO
            </label>
            <input
              type="text"
              {...register('head_neck_exam')}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#2a2d36] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              placeholder="Digite informações sobre exame de cabeça e pescoço..."
            />
          </div>
        </div>

        {/* 4. EXAME DE PELE, MUCOSAS E ANEXOS - Rich Text */}
        <div className="bg-white dark:bg-[#1e2028] rounded-lg border border-slate-200 dark:border-gray-700 p-4">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-gray-200">EXAME DE PELE, MUCOSAS E ANEXOS</h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleUseModel('physical_exam_skin')}
                className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
              >
                Usar modelo
              </button>
              <button
                type="button"
                onClick={() => handleSaveModel('physical_exam_skin', watch('skin_mucosa_exam'))}
                className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
              >
                Salvar modelo
              </button>
            </div>
          </div>
          <RichTextEditor
            value={watch('skin_mucosa_exam') || ''}
            onChange={(value) => setValue('skin_mucosa_exam', value)}
            placeholder="Descreva o exame de pele, mucosas e anexos..."
            onSaveModel={() => handleSaveModel('physical_exam_skin', watch('skin_mucosa_exam') || '')}
            onUseModel={() => handleUseModel('physical_exam_skin')}
            modelType="physical_exam_skin"
          />
        </div>

        {/* Card agrupado: Sistemas */}
        <div className="bg-white dark:bg-[#1e2028] rounded-lg border border-slate-200 dark:border-gray-700 p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-1">
              EXAME APARELHO RESPIRATÓRIO
            </label>
            <input
              type="text"
              {...register('respiratory_exam')}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#2a2d36] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              placeholder="Digite informações sobre exame do aparelho respiratório..."
            />
          </div>
        </div>

        {/* 7. EXAME DO ABDÔMEN - Rich Text */}
        <div className="bg-white dark:bg-[#1e2028] rounded-lg border border-slate-200 dark:border-gray-700 p-4">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-gray-200">EXAME DO ABDÔMEN</h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleUseModel('physical_exam_abdomen')}
                className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
              >
                Usar modelo
              </button>
              <button
                type="button"
                onClick={() => handleSaveModel('physical_exam_abdomen', watch('abdomen_exam'))}
                className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
              >
                Salvar modelo
              </button>
            </div>
          </div>
          <RichTextEditor
            value={watch('abdomen_exam') || ''}
            onChange={(value) => setValue('abdomen_exam', value)}
            placeholder="Descreva o exame do abdômen..."
            onSaveModel={() => handleSaveModel('physical_exam_abdomen', watch('abdomen_exam') || '')}
            onUseModel={() => handleUseModel('physical_exam_abdomen')}
            modelType="physical_exam_abdomen"
          />
        </div>

        {/* 8. EXAME SISTEMA NERVOSO - Rich Text */}
        <div className="bg-white dark:bg-[#1e2028] rounded-lg border border-slate-200 dark:border-gray-700 p-4">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-gray-200">EXAME SISTEMA NERVOSO</h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleUseModel('physical_exam_nervous')}
                className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
              >
                Usar modelo
              </button>
              <button
                type="button"
                onClick={() => handleSaveModel('physical_exam_nervous', watch('nervous_system_exam'))}
                className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
              >
                Salvar modelo
              </button>
            </div>
          </div>
          <RichTextEditor
            value={watch('nervous_system_exam') || ''}
            onChange={(value) => setValue('nervous_system_exam', value)}
            placeholder="Descreva o exame do sistema nervoso..."
            onSaveModel={() => handleSaveModel('physical_exam_nervous', watch('nervous_system_exam') || '')}
            onUseModel={() => handleUseModel('physical_exam_nervous')}
            modelType="physical_exam_nervous"
          />
        </div>

        {/* 9. EXAME DOS GENITAIS - Rich Text */}
        <div className="bg-white dark:bg-[#1e2028] rounded-lg border border-slate-200 dark:border-gray-700 p-4">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-gray-200">EXAME DOS GENITAIS</h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleUseModel('physical_exam_genitals')}
                className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
              >
                Usar modelo
              </button>
              <button
                type="button"
                onClick={() => handleSaveModel('physical_exam_genitals', watch('genitals_exam'))}
                className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
              >
                Salvar modelo
              </button>
            </div>
          </div>
          <RichTextEditor
            value={watch('genitals_exam') || ''}
            onChange={(value) => setValue('genitals_exam', value)}
            placeholder="Descreva o exame dos genitais..."
            onSaveModel={() => handleSaveModel('physical_exam_genitals', watch('genitals_exam') || '')}
            onUseModel={() => handleUseModel('physical_exam_genitals')}
            modelType="physical_exam_genitals"
          />
        </div>

        {/* Botão Salvar */}
        <div className="sticky bottom-0 bg-slate-50/95 dark:bg-[#0b141a]/95 backdrop-blur-sm py-3 border-t border-slate-200 dark:border-gray-700 -mx-4 px-4">
          <div className="flex justify-end items-center gap-3">
            {saveSuccess && (
              <span className="text-xs text-green-600 dark:text-green-400">Salvo com sucesso!</span>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-md transition-colors flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              SALVAR
            </button>
          </div>
        </div>
      </form>

      {/* Modal de Modelos */}
      <ModelTemplateModal
        isOpen={modelModalOpen}
        onClose={() => setModelModalOpen(false)}
        onSelect={handleModelSelect}
        onSave={async (title, content, type) => {
          try {
            const { error } = await supabase
              .from('macros')
              .insert({
                title,
                type: type || modelModalType,
                content,
                category: 'geral',
              });
            if (error) throw error;
            setModelModalOpen(false);
            toast.toast.success('Modelo salvo com sucesso!');
          } catch (err: any) {
            console.error('Erro ao salvar modelo:', err);
            toast.toast.error('Erro ao salvar modelo: ' + err.message);
          }
        }}
        type={modelModalType}
        currentContent={currentModelContent}
      />
    </div>
  );
}
