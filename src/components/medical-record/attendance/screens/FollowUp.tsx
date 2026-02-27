'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Save } from 'lucide-react';
import { useMedicalRecord, FollowUpData } from '@/hooks/useMedicalRecord';
import { RichTextEditor } from '../RichTextEditor';
import { ModelTemplateModal } from '../ModelTemplateModal';
import { AttendanceScreenProps } from '@/types/attendance';
import { useToast } from '@/contexts/ToastContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface FollowUpFormData {
  retorno: string;
  fez_exames: 'sim' | 'não' | null;
  condutas: string;
}

export function FollowUp({ patientId, patientData, onRefresh, appointmentId }: AttendanceScreenProps) {
  const { toast } = useToast();
  const { record, isLoading, saveRecord } = useMedicalRecord(patientId, appointmentId);
  const { register, handleSubmit, watch, setValue, formState: { isSubmitting } } =
    useForm<FollowUpFormData>({
      defaultValues: {
        retorno: '',
        fez_exames: null,
        condutas: '',
      },
    });

  const [modelModalOpen, setModelModalOpen] = useState(false);
  const [modelModalType, setModelModalType] = useState<string>('');
  const [currentModelContent, setCurrentModelContent] = useState<string>('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const currentDate = format(new Date(), "EEEE, d 'de' MMM. 'de' yyyy", { locale: ptBR });

  useEffect(() => {
    if (record?.follow_up_data) {
      const d = record.follow_up_data;
      setValue('retorno', d.retorno || '');
      setValue('fez_exames', d.fez_exames || null);
      setValue('condutas', d.condutas || '');
    }
  }, [record, setValue]);

  const handleUseModel = (type: string) => {
    setModelModalType(type);
    setCurrentModelContent('');
    setModelModalOpen(true);
  };

  const handleSaveModel = (type: string, content: string) => {
    setModelModalType(type);
    setCurrentModelContent(content);
    setModelModalOpen(true);
  };

  const handleModelSelect = (content: string) => {
    if (modelModalType === 'follow_up_retorno') setValue('retorno', content);
    else if (modelModalType === 'follow_up_condutas') setValue('condutas', content);
  };

  const onSubmit = async (data: FollowUpFormData) => {
    try {
      const followUp: FollowUpData = {
        retorno: data.retorno || null,
        fez_exames: data.fez_exames || null,
        condutas: data.condutas || null,
      };

      await saveRecord({ follow_up_data: followUp });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Erro ao salvar retorno:', error);
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
      {/* Header */}
      <div className="mb-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-slate-800 dark:text-gray-100">RETORNO</h1>
        <span className="text-xs text-slate-600 dark:text-gray-400 uppercase">{currentDate}</span>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">

        {/* RETORNO (rich text) */}
        <div className="bg-white dark:bg-[#1e2028] rounded-lg border border-slate-200 dark:border-gray-700 p-4">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-gray-100">RETORNO</h2>
            <div className="flex gap-2">
              <button type="button" onClick={() => handleUseModel('follow_up_retorno')}
                className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors">
                Usar modelo
              </button>
              <button type="button" onClick={() => handleSaveModel('follow_up_retorno', watch('retorno'))}
                className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors">
                Salvar modelo
              </button>
            </div>
          </div>
          <RichTextEditor
            value={watch('retorno')}
            onChange={(v) => setValue('retorno', v)}
            placeholder="Anotações do retorno..."
          />
        </div>

        {/* FEZ EXAMES */}
        <div className="bg-white dark:bg-[#1e2028] rounded-lg border border-slate-200 dark:border-gray-700 p-4">
          <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-2">
            FEZ EXAMES
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" {...register('fez_exames')} value="sim"
                className="w-4 h-4 text-blue-600 focus:ring-blue-500" />
              <span className="text-sm text-slate-700 dark:text-gray-300">Sim</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" {...register('fez_exames')} value="não"
                className="w-4 h-4 text-blue-600 focus:ring-blue-500" />
              <span className="text-sm text-slate-700 dark:text-gray-300">Não</span>
            </label>
          </div>
        </div>

        {/* CONDUTAS (rich text) */}
        <div className="bg-white dark:bg-[#1e2028] rounded-lg border border-slate-200 dark:border-gray-700 p-4">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-gray-100">CONDUTAS?</h2>
            <div className="flex gap-2">
              <button type="button" onClick={() => handleUseModel('follow_up_condutas')}
                className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors">
                Usar modelo
              </button>
              <button type="button" onClick={() => handleSaveModel('follow_up_condutas', watch('condutas'))}
                className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors">
                Salvar modelo
              </button>
            </div>
          </div>
          <RichTextEditor
            value={watch('condutas')}
            onChange={(v) => setValue('condutas', v)}
            placeholder="Condutas do retorno..."
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

      <ModelTemplateModal
        isOpen={modelModalOpen}
        onClose={() => setModelModalOpen(false)}
        onSelect={handleModelSelect}
        onSave={() => setModelModalOpen(false)}
        type={modelModalType}
        currentContent={currentModelContent}
      />
    </div>
  );
}
