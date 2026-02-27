'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Save } from 'lucide-react';
import { useMedicalRecord, EmergencyConsultationData } from '@/hooks/useMedicalRecord';
import { RichTextEditor } from '../RichTextEditor';
import { ModelTemplateModal } from '../ModelTemplateModal';
import { AttendanceScreenProps } from '@/types/attendance';
import { useToast } from '@/contexts/ToastContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface EmergencyFormData {
  acompanhantes: string;
  alergias: string;
  internacoes: string;
  antecedentes_mae: string;
  antecedentes_pai: string;
  estuda_turno: string;
  medicacoes_em_uso: string;
  motivo_consulta: string;
  ja_teve_quadro: 'sim' | 'não' | null;
  ronca_coriza_tosse: 'sim' | 'não' | null;
  alimentacao_mingal: 'sim' | 'não' | null;
  cafe_almoco_janta: string;
  marca_produtos_banho: string;
  evacua_consistencia: string;
  diurese_sinequia_fimose: 'sim' | 'não' | null;
  exposicao_tela: string;
}

const inputClass =
  'w-full px-3 py-2 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#1e2028] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all';
const labelClass = 'block text-xs font-medium text-slate-700 dark:text-gray-300 mb-1';

function RadioSimNao({
  label,
  name,
  register,
}: {
  label: string;
  name: keyof EmergencyFormData;
  register: ReturnType<typeof useForm<EmergencyFormData>>['register'];
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <div className="flex gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="radio" {...register(name)} value="sim" className="w-4 h-4 text-blue-600 focus:ring-blue-500" />
          <span className="text-sm text-slate-700 dark:text-gray-300">Sim</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="radio" {...register(name)} value="não" className="w-4 h-4 text-blue-600 focus:ring-blue-500" />
          <span className="text-sm text-slate-700 dark:text-gray-300">Não</span>
        </label>
      </div>
    </div>
  );
}

function RichBlock({
  title,
  fieldName,
  modelType,
  watch,
  setValue,
  onUseModel,
  onSaveModel,
  placeholder,
}: {
  title: string;
  fieldName: keyof EmergencyFormData;
  modelType: string;
  watch: ReturnType<typeof useForm<EmergencyFormData>>['watch'];
  setValue: ReturnType<typeof useForm<EmergencyFormData>>['setValue'];
  onUseModel: (type: string) => void;
  onSaveModel: (type: string, content: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="bg-white dark:bg-[#1e2028] rounded-lg border border-slate-200 dark:border-gray-700 p-4">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-gray-100">{title}</h2>
        <div className="flex gap-2">
          <button type="button" onClick={() => onUseModel(modelType)}
            className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors">
            Usar modelo
          </button>
          <button type="button" onClick={() => onSaveModel(modelType, watch(fieldName) as string)}
            className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors">
            Salvar modelo
          </button>
        </div>
      </div>
      <RichTextEditor
        value={watch(fieldName) as string}
        onChange={(v) => setValue(fieldName as any, v)}
        placeholder={placeholder}
      />
    </div>
  );
}

export function EmergencyConsultation({ patientId, patientData, onRefresh, appointmentId }: AttendanceScreenProps) {
  const { toast } = useToast();
  const { record, isLoading, saveRecord } = useMedicalRecord(patientId, appointmentId);
  const { register, handleSubmit, watch, setValue, formState: { isSubmitting } } =
    useForm<EmergencyFormData>({
      defaultValues: {
        acompanhantes: '', alergias: '', internacoes: '',
        antecedentes_mae: '', antecedentes_pai: '', estuda_turno: '',
        medicacoes_em_uso: '', motivo_consulta: '',
        ja_teve_quadro: null, ronca_coriza_tosse: null, alimentacao_mingal: null,
        cafe_almoco_janta: '', marca_produtos_banho: '', evacua_consistencia: '',
        diurese_sinequia_fimose: null, exposicao_tela: '',
      },
    });

  const [modelModalOpen, setModelModalOpen] = useState(false);
  const [modelModalType, setModelModalType] = useState('');
  const [currentModelContent, setCurrentModelContent] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const currentDate = format(new Date(), "EEEE, d 'de' MMM. 'de' yyyy", { locale: ptBR });

  useEffect(() => {
    if (record?.emergency_consultation) {
      const d = record.emergency_consultation;
      setValue('acompanhantes', d.acompanhantes || '');
      setValue('alergias', d.alergias || '');
      setValue('internacoes', d.internacoes || '');
      setValue('antecedentes_mae', d.antecedentes_mae || '');
      setValue('antecedentes_pai', d.antecedentes_pai || '');
      setValue('estuda_turno', d.estuda_turno || '');
      setValue('medicacoes_em_uso', d.medicacoes_em_uso || '');
      setValue('motivo_consulta', d.motivo_consulta || '');
      setValue('ja_teve_quadro', d.ja_teve_quadro || null);
      setValue('ronca_coriza_tosse', d.ronca_coriza_tosse || null);
      setValue('alimentacao_mingal', d.alimentacao_mingal || null);
      setValue('cafe_almoco_janta', d.cafe_almoco_janta || '');
      setValue('marca_produtos_banho', d.marca_produtos_banho || '');
      setValue('evacua_consistencia', d.evacua_consistencia || '');
      setValue('diurese_sinequia_fimose', d.diurese_sinequia_fimose || null);
      setValue('exposicao_tela', d.exposicao_tela || '');
    }
  }, [record, setValue]);

  const handleUseModel = (type: string) => { setModelModalType(type); setCurrentModelContent(''); setModelModalOpen(true); };
  const handleSaveModel = (type: string, content: string) => { setModelModalType(type); setCurrentModelContent(content); setModelModalOpen(true); };

  const handleModelSelect = (content: string) => {
    if (modelModalType === 'emergency_medicacoes') setValue('medicacoes_em_uso', content);
    else if (modelModalType === 'emergency_motivo') setValue('motivo_consulta', content);
    else if (modelModalType === 'emergency_refeicoes') setValue('cafe_almoco_janta', content);
  };

  const onSubmit = async (data: EmergencyFormData) => {
    try {
      const emergency: EmergencyConsultationData = {
        acompanhantes: data.acompanhantes || null,
        alergias: data.alergias || null,
        internacoes: data.internacoes || null,
        antecedentes_mae: data.antecedentes_mae || null,
        antecedentes_pai: data.antecedentes_pai || null,
        estuda_turno: data.estuda_turno || null,
        medicacoes_em_uso: data.medicacoes_em_uso || null,
        motivo_consulta: data.motivo_consulta || null,
        ja_teve_quadro: data.ja_teve_quadro || null,
        ronca_coriza_tosse: data.ronca_coriza_tosse || null,
        alimentacao_mingal: data.alimentacao_mingal || null,
        cafe_almoco_janta: data.cafe_almoco_janta || null,
        marca_produtos_banho: data.marca_produtos_banho || null,
        evacua_consistencia: data.evacua_consistencia || null,
        diurese_sinequia_fimose: data.diurese_sinequia_fimose || null,
        exposicao_tela: data.exposicao_tela || null,
      };

      await saveRecord({ emergency_consultation: emergency });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Erro ao salvar consulta de emergência:', error);
      toast.toast.error('Erro ao salvar o formulário. Tente novamente.');
    }
  };

  if (isLoading) {
    return <div className="p-6"><div className="text-center text-slate-500 dark:text-gray-400">Carregando...</div></div>;
  }

  return (
    <div className="p-4 pb-20">
      {/* Header */}
      <div className="mb-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-slate-800 dark:text-gray-100">CONSULTA DE EMERGÊNCIA</h1>
        <span className="text-xs text-slate-600 dark:text-gray-400 uppercase">{currentDate}</span>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">

        {/* Campos de texto iniciais */}
        <div className="bg-white dark:bg-[#1e2028] rounded-lg border border-slate-200 dark:border-gray-700 p-4 space-y-3">
          {[
            { name: 'acompanhantes' as const, label: 'ACOMPANHANTES?' },
            { name: 'alergias' as const, label: 'ALERGIAS?' },
            { name: 'internacoes' as const, label: 'INTERNAÇÕES?' },
            { name: 'antecedentes_mae' as const, label: 'ANTECEDENTES MAE' },
            { name: 'antecedentes_pai' as const, label: 'ANTECEDENTES PAI' },
            { name: 'estuda_turno' as const, label: 'ESTUDA? TURNO?' },
          ].map(({ name, label }) => (
            <div key={name}>
              <label className={labelClass}>{label}</label>
              <input type="text" {...register(name)} className={inputClass} />
            </div>
          ))}
        </div>

        {/* FAZENDO USO DE QUAIS MEDICAÇÕES? (rich text) */}
        <RichBlock
          title="FAZENDO USO DE QUAIS MEDICAÇÕES?"
          fieldName="medicacoes_em_uso"
          modelType="emergency_medicacoes"
          watch={watch}
          setValue={setValue}
          onUseModel={handleUseModel}
          onSaveModel={handleSaveModel}
          placeholder="Liste as medicações em uso..."
        />

        {/* MOTIVO DE CONSULTA? (rich text) */}
        <RichBlock
          title="MOTIVO DE CONSULTA?"
          fieldName="motivo_consulta"
          modelType="emergency_motivo"
          watch={watch}
          setValue={setValue}
          onUseModel={handleUseModel}
          onSaveModel={handleSaveModel}
          placeholder="Descreva o motivo da consulta..."
        />

        {/* Radios e campos complementares */}
        <div className="bg-white dark:bg-[#1e2028] rounded-lg border border-slate-200 dark:border-gray-700 p-4 space-y-3">
          <RadioSimNao label="JÁ TEVE ESSE QUADRO ANTES?" name="ja_teve_quadro" register={register} />
          <RadioSimNao label="RONCA? CORIZA SEMPRE? TOSSE NOITE? MUDA COM FATOR AMBIENTAL?" name="ronca_coriza_tosse" register={register} />
          <RadioSimNao label="ALIMENTAÇÃO/MINGAL/INDUSTRIALIZADOS" name="alimentacao_mingal" register={register} />
        </div>

        {/* CAFÉ/ALMOÇO/JANTA (rich text) */}
        <RichBlock
          title="CAFÉ/ALMOÇO/JANTA"
          fieldName="cafe_almoco_janta"
          modelType="emergency_refeicoes"
          watch={watch}
          setValue={setValue}
          onUseModel={handleUseModel}
          onSaveModel={handleSaveModel}
          placeholder="Descreva as refeições do dia..."
        />

        {/* Campos finais */}
        <div className="bg-white dark:bg-[#1e2028] rounded-lg border border-slate-200 dark:border-gray-700 p-4 space-y-3">
          <div>
            <label className={labelClass}>QUAL MARCA DOS PRODUTOS QUE USA NO BANHO?</label>
            <input type="text" {...register('marca_produtos_banho')} className={inputClass} />
          </div>

          <div>
            <label className={labelClass}>EVACUA QUANTAS VEZES? CONSISTÊNCIA?</label>
            <input type="text" {...register('evacua_consistencia')} className={inputClass} />
          </div>

          <RadioSimNao label="DIURESE? SINEQUIA? FIMOSE?" name="diurese_sinequia_fimose" register={register} />

          <div>
            <label className={labelClass}>EXPOSIÇÃO DE TELA</label>
            <input type="text" {...register('exposicao_tela')} className={inputClass} placeholder="Ex: 1h por dia, celular..." />
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
