'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Save } from 'lucide-react';
import { useMedicalRecord } from '@/hooks/useMedicalRecord';
import { RichTextEditor } from '../RichTextEditor';
import { ModelTemplateModal } from '../ModelTemplateModal';
import { AttendanceScreenProps } from '@/types/attendance';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { createClient } from '@/lib/supabase/client';
const supabase = createClient();
import { useToast } from '@/contexts/ToastContext';

interface ConductsFormData {
  conducts: string;
}

export function Conducts({ patientId, patientData, onRefresh, appointmentId }: AttendanceScreenProps) {
  const { record, isLoading, saveRecord } = useMedicalRecord(patientId, appointmentId);
  const { register, handleSubmit, watch, setValue, formState: { isSubmitting } } = useForm<ConductsFormData>({
    defaultValues: {
      conducts: '',
    }
  });

  const [modelModalOpen, setModelModalOpen] = useState(false);
  const [modelModalType, setModelModalType] = useState<string>('');
  const [currentModelContent, setCurrentModelContent] = useState<string>('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const currentDate = format(new Date(), "EEEE, d 'de' MMM. 'de' yyyy", { locale: ptBR });

  // Carregar dados iniciais
  useEffect(() => {
    if (record?.conducts) {
      setValue('conducts', record.conducts || '');
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
    if (modelModalType === 'conduct') {
      setValue('conducts', content);
    }
  };

  const onSubmit = async (data: ConductsFormData) => {
    try {
      await saveRecord({
        conducts: data.conducts || null,
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
        <div className="text-center text-slate-500 dark:text-gray-400">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="p-4 pb-20">
      {/* Card Principal */}
      <div className="bg-white dark:bg-[#1e2028] rounded-lg border border-slate-200 dark:border-gray-700 shadow-sm p-4">
        {/* Header */}
        <div className="mb-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-slate-800 dark:text-gray-100">CONDUTAS</h1>
          <span className="text-xs text-slate-600 dark:text-gray-400 uppercase">{currentDate}</span>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Campo: CONDUTAS (Rich Text) */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-2">
              CONDUTAS:
            </label>
            <RichTextEditor
              value={watch('conducts')}
              onChange={(value) => setValue('conducts', value)}
              placeholder="Digite as condutas e plano terapêutico..."
              onSaveModel={() => handleSaveModel('conduct', watch('conducts'))}
              onUseModel={() => handleUseModel('conduct')}
              modelType="conduct"
            />
          </div>

          {/* Botão Salvar */}
          <div className="flex justify-end items-center gap-3 pt-3 border-t border-slate-200 dark:border-gray-700">
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
        </form>
      </div>

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
