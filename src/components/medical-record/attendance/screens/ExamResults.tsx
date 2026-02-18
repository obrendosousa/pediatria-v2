'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Save } from 'lucide-react';
import { useMedicalRecord, ExamResultsData } from '@/hooks/useMedicalRecord';
import { RichTextEditor } from '../RichTextEditor';
import { ModelTemplateModal } from '../ModelTemplateModal';
import { AttendanceScreenProps } from '@/types/attendance';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { createClient } from '@/lib/supabase/client';
const supabase = createClient();
import { useToast } from '@/contexts/ToastContext';

interface ExamResultsFormData {
  ultrasound: string;
  xray: string;
  laboratory_observations: string;
  leukocytes: string;
  eosinophils: string;
  platelets: string;
  urea_creatinine: string;
  tgo_tgp: string;
  vitamins: string;
  ferritin_pcr: string;
  tsh_t4: string;
  eas_uroculture_epf: string;
  blood_typing: string;
  electrolytes: string;
  glucose_insulin: string;
  lipidogram: string;
  karyotype: string;
}

export function ExamResults({ patientId, patientData, onRefresh, appointmentId }: AttendanceScreenProps) {
  const { record, isLoading, saveRecord } = useMedicalRecord(patientId, appointmentId);
  const { register, handleSubmit, watch, setValue, formState: { isSubmitting } } = useForm<ExamResultsFormData>({
    defaultValues: {
      ultrasound: '',
      xray: '',
      laboratory_observations: '',
      leukocytes: '',
      eosinophils: '',
      platelets: '',
      urea_creatinine: '',
      tgo_tgp: '',
      vitamins: '',
      ferritin_pcr: '',
      tsh_t4: '',
      eas_uroculture_epf: '',
      blood_typing: '',
      electrolytes: '',
      glucose_insulin: '',
      lipidogram: '',
      karyotype: '',
    }
  });

  const [modelModalOpen, setModelModalOpen] = useState(false);
  const [modelModalType, setModelModalType] = useState<string>('');
  const [currentModelContent, setCurrentModelContent] = useState<string>('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const currentDate = format(new Date(), "EEEE, d 'de' MMM. 'de' yyyy", { locale: ptBR });

  // Carregar dados iniciais
  useEffect(() => {
    if (record?.exam_results_data) {
      const data = record.exam_results_data;
      setValue('ultrasound', data.ultrasound || '');
      setValue('xray', data.xray || '');
      setValue('laboratory_observations', data.laboratory_observations || '');
      setValue('leukocytes', data.leukocytes || '');
      setValue('eosinophils', data.eosinophils || '');
      setValue('platelets', data.platelets || '');
      setValue('urea_creatinine', data.urea_creatinine || '');
      setValue('tgo_tgp', data.tgo_tgp || '');
      setValue('vitamins', data.vitamins || '');
      setValue('ferritin_pcr', data.ferritin_pcr || '');
      setValue('tsh_t4', data.tsh_t4 || '');
      setValue('eas_uroculture_epf', data.eas_uroculture_epf || '');
      setValue('blood_typing', data.blood_typing || '');
      setValue('electrolytes', data.electrolytes || '');
      setValue('glucose_insulin', data.glucose_insulin || '');
      setValue('lipidogram', data.lipidogram || '');
      setValue('karyotype', data.karyotype || '');
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
    if (modelModalType === 'exam_results_laboratory') {
      setValue('laboratory_observations', content);
    }
  };

  const onSubmit = async (data: ExamResultsFormData) => {
    try {
      const examResults: ExamResultsData = {
        ultrasound: data.ultrasound || null,
        xray: data.xray || null,
        laboratory_observations: data.laboratory_observations || null,
        leukocytes: data.leukocytes || null,
        eosinophils: data.eosinophils || null,
        platelets: data.platelets || null,
        urea_creatinine: data.urea_creatinine || null,
        tgo_tgp: data.tgo_tgp || null,
        vitamins: data.vitamins || null,
        ferritin_pcr: data.ferritin_pcr || null,
        tsh_t4: data.tsh_t4 || null,
        eas_uroculture_epf: data.eas_uroculture_epf || null,
        blood_typing: data.blood_typing || null,
        electrolytes: data.electrolytes || null,
        glucose_insulin: data.glucose_insulin || null,
        lipidogram: data.lipidogram || null,
        karyotype: data.karyotype || null,
      };

      await saveRecord({
        exam_results_data: examResults,
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
        <h1 className="text-xl font-bold text-slate-800 dark:text-gray-100">RESULTADO DE EXAMES?</h1>
        <span className="text-xs text-slate-600 dark:text-gray-400 uppercase">{currentDate}</span>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        {/* Card: Exames de Imagem */}
        <div className="bg-white dark:bg-[#1e2028] rounded-lg border border-slate-200 dark:border-gray-700 p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-1">
              ULTRASSOM
            </label>
            <input
              type="text"
              {...register('ultrasound')}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#1e2028] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              placeholder="Digite os resultados do ultrassom..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-1">
              RAIO X
            </label>
            <input
              type="text"
              {...register('xray')}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#1e2028] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              placeholder="Digite os resultados do raio X..."
            />
          </div>
        </div>

        {/* Campo: LABORATORIAS/ OBSERVAÇÕES (Rich Text) */}
        <div className="bg-white dark:bg-[#1e2028] rounded-lg border border-slate-200 dark:border-gray-700 p-4">
          <div className="flex justify-between items-center mb-2">
            <label className="block text-xs font-medium text-slate-700 dark:text-gray-300">
              LABORATORIAS/ OBSERVAÇÕES
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleUseModel('exam_results_laboratory')}
                className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
              >
                Usar modelo
              </button>
              <button
                type="button"
                onClick={() => handleSaveModel('exam_results_laboratory', watch('laboratory_observations'))}
                className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
              >
                Salvar modelo
              </button>
            </div>
          </div>
          <RichTextEditor
            value={watch('laboratory_observations')}
            onChange={(value) => setValue('laboratory_observations', value)}
            placeholder="Digite os resultados laboratoriais e observações..."
            onSaveModel={() => handleSaveModel('exam_results_laboratory', watch('laboratory_observations'))}
            onUseModel={() => handleUseModel('exam_results_laboratory')}
            modelType="exam_results_laboratory"
          />
        </div>

        {/* Card: Hemograma */}
        <div className="bg-white dark:bg-[#1e2028] rounded-lg border border-slate-200 dark:border-gray-700 p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-1">
              LEUCOCITOS
            </label>
            <input
              type="text"
              {...register('leukocytes')}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#1e2028] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              placeholder="Digite os valores de leucócitos..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-1">
              EOSINOFILOS
            </label>
            <input
              type="text"
              {...register('eosinophils')}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#1e2028] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              placeholder="Digite os valores de eosinófilos..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-1">
              PLAQUETAS
            </label>
            <input
              type="text"
              {...register('platelets')}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#1e2028] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              placeholder="Digite os valores de plaquetas..."
            />
          </div>
        </div>

        {/* Card: Função Renal e Hepática */}
        <div className="bg-white dark:bg-[#1e2028] rounded-lg border border-slate-200 dark:border-gray-700 p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-1">
              UREIA/ CREATININA
            </label>
            <input
              type="text"
              {...register('urea_creatinine')}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#1e2028] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              placeholder="Digite os valores de ureia e creatinina..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-1">
              TGO/TGP
            </label>
            <input
              type="text"
              {...register('tgo_tgp')}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#1e2028] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              placeholder="Digite os valores de TGO e TGP..."
            />
          </div>
        </div>

        {/* Card: Vitaminas e Minerais */}
        <div className="bg-white dark:bg-[#1e2028] rounded-lg border border-slate-200 dark:border-gray-700 p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-1">
              VITD, VITC, VIT B12 E ZINCO
            </label>
            <input
              type="text"
              {...register('vitamins')}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#1e2028] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              placeholder="Digite os valores de vitaminas D, C, B12 e zinco..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-1">
              FERRITINA/ PCR ULTRASSENSIVEL
            </label>
            <input
              type="text"
              {...register('ferritin_pcr')}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#1e2028] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              placeholder="Digite os valores de ferritina e PCR ultrassensível..."
            />
          </div>
        </div>

        {/* Card: Função Tireoidiana */}
        <div className="bg-white dark:bg-[#1e2028] rounded-lg border border-slate-200 dark:border-gray-700 p-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-1">
              TSH E T4 TOTAL
            </label>
            <input
              type="text"
              {...register('tsh_t4')}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#1e2028] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              placeholder="Digite os valores de TSH e T4 total..."
            />
          </div>
        </div>

        {/* Card: Urina */}
        <div className="bg-white dark:bg-[#1e2028] rounded-lg border border-slate-200 dark:border-gray-700 p-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-1">
              EAS/ UROCULTURA / EPF
            </label>
            <input
              type="text"
              {...register('eas_uroculture_epf')}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#1e2028] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              placeholder="Digite os resultados de EAS, urocultura e EPF..."
            />
          </div>
        </div>

        {/* Card: Outros */}
        <div className="bg-white dark:bg-[#1e2028] rounded-lg border border-slate-200 dark:border-gray-700 p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-1">
              TIPAGEM SANGUINEA
            </label>
            <input
              type="text"
              {...register('blood_typing')}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#1e2028] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              placeholder="Digite a tipagem sanguínea..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-1">
              SODIO/ POTASSIO/ CALCIO
            </label>
            <input
              type="text"
              {...register('electrolytes')}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#1e2028] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              placeholder="Digite os valores de sódio, potássio e cálcio..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-1">
              GLICEMIA JEJUM/ HB GLICADA/ INSULINA
            </label>
            <input
              type="text"
              {...register('glucose_insulin')}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#1e2028] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              placeholder="Digite os valores de glicemia em jejum, hemoglobina glicada e insulina..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-1">
              LIPIDOGRAMA
            </label>
            <input
              type="text"
              {...register('lipidogram')}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#1e2028] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              placeholder="Digite os valores do lipidograma..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-1">
              CARIOTIPO
            </label>
            <input
              type="text"
              {...register('karyotype')}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#1e2028] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              placeholder="Digite os resultados do cariótipo..."
            />
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
