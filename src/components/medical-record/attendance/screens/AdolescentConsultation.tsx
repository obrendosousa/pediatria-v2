'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Save } from 'lucide-react';
import { useMedicalRecord, AdolescentConsultationData } from '@/hooks/useMedicalRecord';
import { RichTextEditor } from '../RichTextEditor';
import { ModelTemplateModal } from '../ModelTemplateModal';
import { AttendanceScreenProps } from '@/types/attendance';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';

interface AdolescentConsultationFormData {
  companions: string;
  lives_where: string;
  birthplace: string;
  school_turn_consultation_reason: string;
  parents_antecedents: string;
  personal_antecedents: string;
  allergies: string;
  hospitalizations: string;
  vision_headache_problems: string;
  consultation_reason: string;
  feels_anxious: 'sim' | 'não' | null;
}

export function AdolescentConsultation({ patientId, patientData, onRefresh, appointmentId }: AttendanceScreenProps) {
  const { record, isLoading, saveRecord } = useMedicalRecord(patientId, appointmentId);
  const { register, handleSubmit, watch, setValue, formState: { isSubmitting } } = useForm<AdolescentConsultationFormData>({
    defaultValues: {
      companions: '',
      lives_where: '',
      birthplace: '',
      school_turn_consultation_reason: '',
      parents_antecedents: '',
      personal_antecedents: '',
      allergies: '',
      hospitalizations: '',
      vision_headache_problems: '',
      consultation_reason: '',
      feels_anxious: null,
    }
  });

  const [modelModalOpen, setModelModalOpen] = useState(false);
  const [modelModalType, setModelModalType] = useState<string>('');
  const [currentModelContent, setCurrentModelContent] = useState<string>('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const currentDate = format(new Date(), "EEEE, d 'de' MMM. 'de' yyyy", { locale: ptBR });

  // Carregar dados iniciais
  useEffect(() => {
    if (record?.adolescent_consultation) {
      const data = record.adolescent_consultation;
      setValue('companions', data.companions || '');
      setValue('lives_where', data.lives_where || '');
      setValue('birthplace', data.birthplace || '');
      setValue('school_turn_consultation_reason', data.school_turn_consultation_reason || '');
      setValue('parents_antecedents', data.parents_antecedents || '');
      setValue('personal_antecedents', data.personal_antecedents || '');
      setValue('allergies', data.allergies || '');
      setValue('hospitalizations', data.hospitalizations || '');
      setValue('vision_headache_problems', data.vision_headache_problems || '');
      setValue('consultation_reason', data.consultation_reason || '');
      setValue('feels_anxious', data.feels_anxious || null);
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
    if (modelModalType === 'adolescent_consultation_reason') {
      setValue('consultation_reason', content);
    }
  };

  const onSubmit = async (data: AdolescentConsultationFormData) => {
    try {
      const adolescentConsultation: AdolescentConsultationData = {
        companions: data.companions || null,
        lives_where: data.lives_where || null,
        birthplace: data.birthplace || null,
        school_turn_consultation_reason: data.school_turn_consultation_reason || null,
        parents_antecedents: data.parents_antecedents || null,
        personal_antecedents: data.personal_antecedents || null,
        allergies: data.allergies || null,
        hospitalizations: data.hospitalizations || null,
        vision_headache_problems: data.vision_headache_problems || null,
        consultation_reason: data.consultation_reason || null,
        feels_anxious: data.feels_anxious || null,
      };

      await saveRecord({
        adolescent_consultation: adolescentConsultation,
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert('Erro ao salvar o formulário. Tente novamente.');
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
        <h1 className="text-xl font-bold text-slate-800 dark:text-gray-100">CONSULTA ADOLESCENTE</h1>
        <span className="text-xs text-slate-600 dark:text-gray-400 uppercase">{currentDate}</span>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        {/* Card agrupado: Informações Básicas */}
        <div className="bg-white dark:bg-[#1e2028] rounded-lg border border-slate-200 dark:border-gray-700 p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-1">
              ACOMPANHANTES
            </label>
            <input
              type="text"
              {...register('companions')}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#1e2028] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              placeholder="Digite os acompanhantes..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-1">
              MORA ONDE
            </label>
            <input
              type="text"
              {...register('lives_where')}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#1e2028] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              placeholder="Digite onde mora..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-1">
              NATURALIDADE
            </label>
            <input
              type="text"
              {...register('birthplace')}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#1e2028] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              placeholder="Digite a naturalidade..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-1">
              ESCOLA/TURNO/MOTIVO CONSULTA?
            </label>
            <input
              type="text"
              {...register('school_turn_consultation_reason')}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#1e2028] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              placeholder="Digite escola, turno e motivo da consulta..."
            />
          </div>
        </div>

        {/* Card agrupado: Antecedentes */}
        <div className="bg-white dark:bg-[#1e2028] rounded-lg border border-slate-200 dark:border-gray-700 p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-1">
              ANTECEDENTES DOS PAIS
            </label>
            <input
              type="text"
              {...register('parents_antecedents')}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#1e2028] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              placeholder="Digite os antecedentes dos pais..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-1">
              ANTECEDENTES PESSOAIS
            </label>
            <input
              type="text"
              {...register('personal_antecedents')}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#1e2028] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              placeholder="Digite os antecedentes pessoais..."
            />
          </div>
        </div>

        {/* Card agrupado: Saúde */}
        <div className="bg-white dark:bg-[#1e2028] rounded-lg border border-slate-200 dark:border-gray-700 p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-1">
              ALERGIAS ?
            </label>
            <input
              type="text"
              {...register('allergies')}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#1e2028] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              placeholder="Digite as alergias..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-1">
              INTERNAÇÕES
            </label>
            <input
              type="text"
              {...register('hospitalizations')}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#1e2028] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              placeholder="Digite informações sobre internações..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-1">
              PROBLEMAS DE VISTA? CEFALEIA?
            </label>
            <input
              type="text"
              {...register('vision_headache_problems')}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#1e2028] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              placeholder="Digite problemas de vista ou cefaleia..."
            />
          </div>
        </div>

        {/* Campo: MOTIVO DE CONSULTA? (Rich Text) */}
        <div className="bg-white dark:bg-[#1e2028] rounded-lg border border-slate-200 dark:border-gray-700 p-4">
          <div className="flex justify-between items-center mb-2">
            <label className="block text-xs font-medium text-slate-700 dark:text-gray-300">
              MOTIVO DE CONSULTA?
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleUseModel('adolescent_consultation_reason')}
                className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
              >
                Usar modelo
              </button>
              <button
                type="button"
                onClick={() => handleSaveModel('adolescent_consultation_reason', watch('consultation_reason'))}
                className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
              >
                Salvar modelo
              </button>
            </div>
          </div>
          <RichTextEditor
            value={watch('consultation_reason')}
            onChange={(value) => setValue('consultation_reason', value)}
            placeholder="Digite o motivo da consulta..."
            onSaveModel={() => handleSaveModel('adolescent_consultation_reason', watch('consultation_reason'))}
            onUseModel={() => handleUseModel('adolescent_consultation_reason')}
            modelType="adolescent_consultation_reason"
          />
        </div>

        {/* Campo: SE SENTE ANSIOSO (Radio Group) */}
        <div className="bg-white dark:bg-[#1e2028] rounded-lg border border-slate-200 dark:border-gray-700 p-4">
          <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-2">
            SE SENTE ANSIOSO
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                {...register('feels_anxious')}
                value="sim"
                className="w-4 h-4 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-slate-700 dark:text-gray-300">Sim</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                {...register('feels_anxious')}
                value="não"
                className="w-4 h-4 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-slate-700 dark:text-gray-300">Não</span>
            </label>
          </div>
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
            alert('Modelo salvo com sucesso!');
          } catch (err: any) {
            console.error('Erro ao salvar modelo:', err);
            alert('Erro ao salvar modelo: ' + err.message);
          }
        }}
        type={modelModalType}
        currentContent={currentModelContent}
      />
    </div>
  );
}
