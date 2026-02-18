'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Save } from 'lucide-react';
import { useMedicalRecord, RoutineConsultationData } from '@/hooks/useMedicalRecord';
import { RichTextEditor } from '../RichTextEditor';
import { ModelTemplateModal } from '../ModelTemplateModal';
import { AttendanceScreenProps } from '@/types/attendance';
import { useToast } from '@/contexts/ToastContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface RoutineConsultationFormData {
  caregivers_name: string;
  companion_location: string;
  support_network: string;
  school_info: string;
  siblings_info: string;
  allergies_interactions: string;
  consultation_reason: string;
  breathing_info: string;
  medications: string;
  breastfeeding_formula: string;
  vaccines_up_to_date: 'sim' | 'não' | null;
  delayed_vaccine: string;
  uses_pacifier: string;
  nose_wash: string;
  skin_products: string;
  dental_info: string;
  gastrointestinal: string;
  genitourinary: string;
  nervous_system: string;
  screen_exposure: string;
  sleep_info: string;
  monthly_milestones: 'sim' | 'não' | null;
  exam_results: string;
  print_development_guide: 'sim' | 'não' | null;
}

export function RoutineConsultation({ patientId, patientData, onRefresh, appointmentId }: AttendanceScreenProps) {
  const { toast } = useToast();
  const { record, isLoading, saveRecord } = useMedicalRecord(patientId, appointmentId);
  const { register, handleSubmit, watch, setValue, formState: { isSubmitting } } = useForm<RoutineConsultationFormData>({
    defaultValues: {
      caregivers_name: '',
      companion_location: '',
      support_network: '',
      school_info: '',
      siblings_info: '',
      allergies_interactions: '',
      consultation_reason: '',
      breathing_info: '',
      medications: '',
      breastfeeding_formula: '',
      vaccines_up_to_date: null,
      delayed_vaccine: '',
      uses_pacifier: '',
      nose_wash: '',
      skin_products: '',
      dental_info: '',
      gastrointestinal: '',
      genitourinary: '',
      nervous_system: '',
      screen_exposure: '',
      sleep_info: '',
      monthly_milestones: null,
      exam_results: '',
      print_development_guide: null,
    }
  });

  const [modelModalOpen, setModelModalOpen] = useState(false);
  const [modelModalType, setModelModalType] = useState<string>('');
  const [currentModelContent, setCurrentModelContent] = useState<string>('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const currentDate = format(new Date(), "EEEE, d 'de' MMM. 'de' yyyy", { locale: ptBR });

  // Carregar dados iniciais
  useEffect(() => {
    if (record?.routine_consultation) {
      const data = record.routine_consultation;
      setValue('caregivers_name', data.caregivers_name || '');
      setValue('companion_location', data.companion_location || '');
      setValue('support_network', data.support_network || '');
      setValue('school_info', data.school_info || '');
      setValue('siblings_info', data.siblings_info || '');
      setValue('allergies_interactions', data.allergies_interactions || '');
      setValue('consultation_reason', data.consultation_reason || '');
      setValue('breathing_info', data.breathing_info || '');
      setValue('medications', data.medications || '');
      setValue('breastfeeding_formula', data.breastfeeding_formula || '');
      setValue('vaccines_up_to_date', data.vaccines_up_to_date || null);
      setValue('delayed_vaccine', data.delayed_vaccine || '');
      setValue('uses_pacifier', data.uses_pacifier || '');
      setValue('nose_wash', data.nose_wash || '');
      setValue('skin_products', data.skin_products || '');
      setValue('dental_info', data.dental_info || '');
      setValue('gastrointestinal', data.gastrointestinal || '');
      setValue('genitourinary', data.genitourinary || '');
      setValue('nervous_system', data.nervous_system || '');
      setValue('screen_exposure', data.screen_exposure || '');
      setValue('sleep_info', data.sleep_info || '');
      setValue('monthly_milestones', data.monthly_milestones || null);
      setValue('exam_results', data.exam_results || '');
      setValue('print_development_guide', data.print_development_guide || null);
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
    if (modelModalType === 'routine_consultation_reason') {
      setValue('consultation_reason', content);
    } else if (modelModalType === 'routine_consultation_sleep') {
      setValue('sleep_info', content);
    } else if (modelModalType === 'routine_consultation_exams') {
      setValue('exam_results', content);
    }
  };

  const onSubmit = async (data: RoutineConsultationFormData) => {
    try {
      const routineConsultation: RoutineConsultationData = {
        caregivers_name: data.caregivers_name || null,
        companion_location: data.companion_location || null,
        support_network: data.support_network || null,
        school_info: data.school_info || null,
        siblings_info: data.siblings_info || null,
        allergies_interactions: data.allergies_interactions || null,
        consultation_reason: data.consultation_reason || null,
        breathing_info: data.breathing_info || null,
        medications: data.medications || null,
        breastfeeding_formula: data.breastfeeding_formula || null,
        vaccines_up_to_date: data.vaccines_up_to_date || null,
        delayed_vaccine: data.delayed_vaccine || null,
        uses_pacifier: data.uses_pacifier || null,
        nose_wash: data.nose_wash || null,
        skin_products: data.skin_products || null,
        dental_info: data.dental_info || null,
        gastrointestinal: data.gastrointestinal || null,
        genitourinary: data.genitourinary || null,
        nervous_system: data.nervous_system || null,
        screen_exposure: data.screen_exposure || null,
        sleep_info: data.sleep_info || null,
        monthly_milestones: data.monthly_milestones || null,
        exam_results: data.exam_results || null,
        print_development_guide: data.print_development_guide || null,
      };

      await saveRecord({
        routine_consultation: routineConsultation,
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
      {/* Header */}
      <div className="mb-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-slate-800 dark:text-gray-100">CONSULTA DE ROTINA</h1>
        <span className="text-xs text-slate-600 dark:text-gray-400 uppercase">{currentDate}</span>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        {/* Seção: Informações do Paciente/Cuidador */}
        <div className="bg-white dark:bg-[#1e2028] rounded-lg border border-slate-200 dark:border-gray-700 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-gray-100 mb-3">Informações do Paciente/Cuidador</h2>
          
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-1">
              NOME CUIDADORES E CHAMAR PELO NOME
            </label>
            <input
              type="text"
              {...register('caregivers_name')}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#1e2028] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              placeholder="Digite o nome dos cuidadores..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-1">
              ACOMPANHANTE/ MORA ONDE
            </label>
            <input
              type="text"
              {...register('companion_location')}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#1e2028] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              placeholder="Digite o acompanhante e localização..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-1">
              REDE APOIO? NOME BABÁ?
            </label>
            <input
              type="text"
              {...register('support_network')}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#1e2028] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              placeholder="Digite a rede de apoio e nome da babá..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-1">
              ESTUDA ONDE/ TURNO
            </label>
            <input
              type="text"
              {...register('school_info')}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#1e2028] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              placeholder="Digite onde estuda e o turno..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-1">
              TEM IRMÃOS? NOME: COMO ELES ESTÃO? TEM DOENÇA?
            </label>
            <input
              type="text"
              {...register('siblings_info')}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#1e2028] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              placeholder="Digite informações sobre irmãos..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-1">
              APRESENTOU ALGUMA ALERGIA/ INTERAÇÃO
            </label>
            <input
              type="text"
              {...register('allergies_interactions')}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#1e2028] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              placeholder="Digite informações sobre alergias..."
            />
          </div>
        </div>

        {/* Seção: Motivo de Consulta (Rich Text) */}
        <div className="bg-white dark:bg-[#1e2028] rounded-lg border border-slate-200 dark:border-gray-700 p-4">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-gray-100">MOTIVO DE CONSULTA</h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleUseModel('routine_consultation_reason')}
                className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
              >
                Usar modelo
              </button>
              <button
                type="button"
                onClick={() => handleSaveModel('routine_consultation_reason', watch('consultation_reason'))}
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
            modelType="routine_consultation_reason"
          />
        </div>

        {/* Seção: Hábitos e Saúde */}
        <div className="bg-white dark:bg-[#1e2028] rounded-lg border border-slate-200 dark:border-gray-700 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-gray-100 mb-3">Hábitos e Saúde</h2>
          
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-1">
              RESPIRA COM A BOCA ABERTA? RONCA A NOITE? RESFRIA COM FREQUÊNCIA?
            </label>
            <input
              type="text"
              {...register('breathing_info')}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#1e2028] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              placeholder="Digite informações sobre respiração..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-1">
              FAZ USO DE ALGUMA MEDICAÇÃO?
            </label>
            <input
              type="text"
              {...register('medications')}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#1e2028] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              placeholder="Digite informações sobre medicações..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-1">
              AME/FORMULA?
            </label>
            <input
              type="text"
              {...register('breastfeeding_formula')}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#1e2028] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              placeholder="Digite informações sobre amamentação..."
            />
          </div>

          {/* Vacinas */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-2">
              VACINAS EM DIA?
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  {...register('vaccines_up_to_date')}
                  value="sim"
                  className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-700 dark:text-gray-300">Sim</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  {...register('vaccines_up_to_date')}
                  value="não"
                  className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-700 dark:text-gray-300">Não</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-1">
              VACINA ATRASADA QUAL?
            </label>
            <input
              type="text"
              {...register('delayed_vaccine')}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#1e2028] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              placeholder="Digite qual vacina está atrasada..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-1">
              USA CHUPETA AINDA?
            </label>
            <input
              type="text"
              {...register('uses_pacifier')}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#1e2028] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              placeholder="Digite informações sobre uso de chupeta..."
            />
          </div>
        </div>

        {/* Seção: Sistemas */}
        <div className="bg-white dark:bg-[#1e2028] rounded-lg border border-slate-200 dark:border-gray-700 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-gray-100 mb-3">Sistemas</h2>
          
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-1">
              NARIZ/LAVAGEM NASAL
            </label>
            <input
              type="text"
              {...register('nose_wash')}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#1e2028] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              placeholder="Digite informações sobre lavagem nasal..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-1">
              PELE E ANEXO? PRODUTOS QUE USA OS MESMO?
            </label>
            <input
              type="text"
              {...register('skin_products')}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#1e2028] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              placeholder="Digite informações sobre pele e produtos..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-1">
              BOCA E DENTE/ JÁ FOI AO DENTISTA?
            </label>
            <input
              type="text"
              {...register('dental_info')}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#1e2028] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              placeholder="Digite informações sobre saúde bucal..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-1">
              SISTEMA GASTRO-INTESTINAL/ EVACUANDO NORMAL?
            </label>
            <input
              type="text"
              {...register('gastrointestinal')}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#1e2028] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              placeholder="Digite informações sobre sistema gastrointestinal..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-1">
              SISTEMA GÊNITO-URINÁRIO/ POMADA?
            </label>
            <input
              type="text"
              {...register('genitourinary')}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#1e2028] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              placeholder="Digite informações sobre sistema geniturinário..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-1">
              SISTEMA NERVOSO?
            </label>
            <input
              type="text"
              {...register('nervous_system')}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#1e2028] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              placeholder="Digite informações sobre sistema nervoso..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-1">
              EXPOSIÇÃO DE TELA? QUANTO TEMPO?
            </label>
            <input
              type="text"
              {...register('screen_exposure')}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#1e2028] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              placeholder="Digite informações sobre exposição a telas..."
            />
          </div>
        </div>

        {/* Seção: Sono (Rich Text) */}
        <div className="bg-white dark:bg-[#1e2028] rounded-lg border border-slate-200 dark:border-gray-700 p-4">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-gray-100">SONO? AGITAÇÃO A NOITE? DORME EM QUE LOCAL?</h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleUseModel('routine_consultation_sleep')}
                className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
              >
                Usar modelo
              </button>
              <button
                type="button"
                onClick={() => handleSaveModel('routine_consultation_sleep', watch('sleep_info'))}
                className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
              >
                Salvar modelo
              </button>
            </div>
          </div>
          <RichTextEditor
            value={watch('sleep_info')}
            onChange={(value) => setValue('sleep_info', value)}
            placeholder="Digite informações sobre sono..."
            modelType="routine_consultation_sleep"
          />
        </div>

        {/* Seção: Marcos e Exames */}
        <div className="bg-white dark:bg-[#1e2028] rounded-lg border border-slate-200 dark:border-gray-700 p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-2">
              FALA DOS MARCOS DO MÊS E AVISAR O QUE PODE ACONTECER NESSE
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  {...register('monthly_milestones')}
                  value="sim"
                  className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-700 dark:text-gray-300">Sim</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  {...register('monthly_milestones')}
                  value="não"
                  className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-700 dark:text-gray-300">Não</span>
              </label>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-gray-300">
                EXAMES REALIZADOS, RESULTADOS:
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleUseModel('routine_consultation_exams')}
                  className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                >
                  Usar modelo
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveModel('routine_consultation_exams', watch('exam_results'))}
                  className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                >
                  Salvar modelo
                </button>
              </div>
            </div>
            <RichTextEditor
              value={watch('exam_results')}
              onChange={(value) => setValue('exam_results', value)}
              placeholder="Digite os exames realizados e resultados..."
              modelType="routine_consultation_exams"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-2">
              IMPRIMIR GUIA DESENVOLVIMENTO-VACINA CERTA-
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  {...register('print_development_guide')}
                  value="sim"
                  className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-700 dark:text-gray-300">Sim</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  {...register('print_development_guide')}
                  value="não"
                  className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-700 dark:text-gray-300">Não</span>
              </label>
            </div>
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
        onSave={(title, content, type) => {
          // Implementar salvamento do modelo via supabase
          setModelModalOpen(false);
        }}
        type={modelModalType}
        currentContent={currentModelContent}
      />
    </div>
  );
}
