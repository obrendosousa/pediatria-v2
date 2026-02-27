'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Save } from 'lucide-react';
import { useMedicalRecord, FoodHistoryData } from '@/hooks/useMedicalRecord';
import { RichTextEditor } from '../RichTextEditor';
import { AttendanceScreenProps } from '@/types/attendance';
import { useToast } from '@/contexts/ToastContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface FoodHistoryFormData {
  // Campos de texto
  leite_materno_exclusivo: string;
  formula_infantil: string;
  idade_introducao_alimentar: string;
  dificuldade_introducao: string;
  mingau_industrializado: string;
  refeicoes_diarias: string;
  alimento_nao_aceita: string;
  textura_quantidade: string;
  local_comida: string;
  // Campos radio (Sim/Não)
  aceitou_introducao: 'sim' | 'não' | null;
  aceita_suco: 'sim' | 'não' | null;
  aceita_sopa: 'sim' | 'não' | null;
  aceita_agua: 'sim' | 'não' | null;
  aceita_frutas: 'sim' | 'não' | null;
  aceita_legumes: 'sim' | 'não' | null;
  aceita_proteinas: 'sim' | 'não' | null;
  aceita_carboidratos: 'sim' | 'não' | null;
  aceita_ovo_peixe: 'sim' | 'não' | null;
}

// Componente reutilizável para campos radio Sim/Não
function RadioSimNao({
  label,
  name,
  register,
}: {
  label: string;
  name: keyof FoodHistoryFormData;
  register: ReturnType<typeof useForm<FoodHistoryFormData>>['register'];
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-2">
        {label}
      </label>
      <div className="flex gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            {...register(name)}
            value="sim"
            className="w-4 h-4 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-slate-700 dark:text-gray-300">Sim</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            {...register(name)}
            value="não"
            className="w-4 h-4 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-slate-700 dark:text-gray-300">Não</span>
        </label>
      </div>
    </div>
  );
}

export function FoodHistory({ patientId, patientData, onRefresh, appointmentId }: AttendanceScreenProps) {
  const { toast } = useToast();
  const { record, isLoading, saveRecord } = useMedicalRecord(patientId, appointmentId);
  const { register, handleSubmit, watch, setValue, formState: { isSubmitting } } = useForm<FoodHistoryFormData>({
    defaultValues: {
      leite_materno_exclusivo: '',
      formula_infantil: '',
      idade_introducao_alimentar: '',
      dificuldade_introducao: '',
      mingau_industrializado: '',
      refeicoes_diarias: '',
      alimento_nao_aceita: '',
      textura_quantidade: '',
      local_comida: '',
      aceitou_introducao: null,
      aceita_suco: null,
      aceita_sopa: null,
      aceita_agua: null,
      aceita_frutas: null,
      aceita_legumes: null,
      aceita_proteinas: null,
      aceita_carboidratos: null,
      aceita_ovo_peixe: null,
    },
  });

  const [saveSuccess, setSaveSuccess] = useState(false);

  const currentDate = format(new Date(), "EEEE, d 'de' MMM. 'de' yyyy", { locale: ptBR });

  // Carrega dados salvos ao montar o componente
  useEffect(() => {
    if (record?.food_history) {
      const d = record.food_history;
      setValue('leite_materno_exclusivo', d.leite_materno_exclusivo || '');
      setValue('formula_infantil', d.formula_infantil || '');
      setValue('idade_introducao_alimentar', d.idade_introducao_alimentar || '');
      setValue('dificuldade_introducao', d.dificuldade_introducao || '');
      setValue('mingau_industrializado', d.mingau_industrializado || '');
      setValue('refeicoes_diarias', d.refeicoes_diarias || '');
      setValue('alimento_nao_aceita', d.alimento_nao_aceita || '');
      setValue('textura_quantidade', d.textura_quantidade || '');
      setValue('local_comida', d.local_comida || '');
      setValue('aceitou_introducao', d.aceitou_introducao || null);
      setValue('aceita_suco', d.aceita_suco || null);
      setValue('aceita_sopa', d.aceita_sopa || null);
      setValue('aceita_agua', d.aceita_agua || null);
      setValue('aceita_frutas', d.aceita_frutas || null);
      setValue('aceita_legumes', d.aceita_legumes || null);
      setValue('aceita_proteinas', d.aceita_proteinas || null);
      setValue('aceita_carboidratos', d.aceita_carboidratos || null);
      setValue('aceita_ovo_peixe', d.aceita_ovo_peixe || null);
    }
  }, [record, setValue]);

  const onSubmit = async (data: FoodHistoryFormData) => {
    try {
      const foodHistory: FoodHistoryData = {
        leite_materno_exclusivo: data.leite_materno_exclusivo || null,
        formula_infantil: data.formula_infantil || null,
        idade_introducao_alimentar: data.idade_introducao_alimentar || null,
        dificuldade_introducao: data.dificuldade_introducao || null,
        mingau_industrializado: data.mingau_industrializado || null,
        refeicoes_diarias: data.refeicoes_diarias || null,
        alimento_nao_aceita: data.alimento_nao_aceita || null,
        textura_quantidade: data.textura_quantidade || null,
        local_comida: data.local_comida || null,
        aceitou_introducao: data.aceitou_introducao || null,
        aceita_suco: data.aceita_suco || null,
        aceita_sopa: data.aceita_sopa || null,
        aceita_agua: data.aceita_agua || null,
        aceita_frutas: data.aceita_frutas || null,
        aceita_legumes: data.aceita_legumes || null,
        aceita_proteinas: data.aceita_proteinas || null,
        aceita_carboidratos: data.aceita_carboidratos || null,
        aceita_ovo_peixe: data.aceita_ovo_peixe || null,
      };

      await saveRecord({ food_history: foodHistory });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);

      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Erro ao salvar histórico alimentar:', error);
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
        <h1 className="text-xl font-bold text-slate-800 dark:text-gray-100">HISTÓRICO ALIMENTAR</h1>
        <span className="text-xs text-slate-600 dark:text-gray-400 uppercase">{currentDate}</span>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">

        {/* Seção: Amamentação e Introdução Alimentar */}
        <div className="bg-white dark:bg-[#1e2028] rounded-lg border border-slate-200 dark:border-gray-700 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-gray-100 mb-3">Amamentação e Introdução Alimentar</h2>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-1">
              LEITE MATERNO / ATÉ QUE IDADE EXCLUSIVO?
            </label>
            <input
              type="text"
              {...register('leite_materno_exclusivo')}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#1e2028] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              placeholder="Ex: Exclusivo até 6 meses..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-1">
              FÓRMULA INFANTIL / QUAL / COMO DILUIU?
            </label>
            <input
              type="text"
              {...register('formula_infantil')}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#1e2028] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              placeholder="Ex: NAN 1, 1 medida para 30ml..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-1">
              INTRODUÇÃO ALIMENTAR / QUE IDADE?
            </label>
            <input
              type="text"
              {...register('idade_introducao_alimentar')}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#1e2028] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              placeholder="Ex: 6 meses..."
            />
          </div>

          <RadioSimNao
            label="ACEITAÇÃO INTRODUÇÃO ALIMENTAR?"
            name="aceitou_introducao"
            register={register}
          />

          <RadioSimNao
            label="SUCO?"
            name="aceita_suco"
            register={register}
          />

          <RadioSimNao
            label="SOPA?"
            name="aceita_sopa"
            register={register}
          />

          <RadioSimNao
            label="ACEITA ÁGUA?"
            name="aceita_agua"
            register={register}
          />
        </div>

        {/* Seção: Maior Dificuldade (Rich Text) */}
        <div className="bg-white dark:bg-[#1e2028] rounded-lg border border-slate-200 dark:border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-gray-100 mb-2">
            QUAL MAIOR DIFICULDADE / INTRODUÇÃO ALIMENTAR?
          </h2>
          <RichTextEditor
            value={watch('dificuldade_introducao')}
            onChange={(value) => setValue('dificuldade_introducao', value)}
            placeholder="Descreva as dificuldades na introdução alimentar..."
          />
        </div>

        {/* Seção: Aceitação de Alimentos */}
        <div className="bg-white dark:bg-[#1e2028] rounded-lg border border-slate-200 dark:border-gray-700 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-gray-100 mb-3">Aceitação de Alimentos</h2>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-1">
              MINGAL INDUSTRIALIZADOS?
            </label>
            <input
              type="text"
              {...register('mingau_industrializado')}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#1e2028] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              placeholder="Ex: Mucilon, Nestum..."
            />
          </div>

          <RadioSimNao
            label="ACEITA FRUTAS?"
            name="aceita_frutas"
            register={register}
          />

          <RadioSimNao
            label="ACEITA LEGUMES E VERDURAS?"
            name="aceita_legumes"
            register={register}
          />

          <RadioSimNao
            label="ACEITAS PROTEÍNAS, CARNES?"
            name="aceita_proteinas"
            register={register}
          />

          <RadioSimNao
            label="ACEITA ARROZ, MACARRÃO, FEIJÃO?"
            name="aceita_carboidratos"
            register={register}
          />

          <RadioSimNao
            label="ACEITA OVO E PEIXE?"
            name="aceita_ovo_peixe"
            register={register}
          />
        </div>

        {/* Seção: Refeições Diárias (Rich Text) */}
        <div className="bg-white dark:bg-[#1e2028] rounded-lg border border-slate-200 dark:border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-gray-100 mb-2">
            CAFÉ, ALMOÇO, LANCHE E JANTA?
          </h2>
          <RichTextEditor
            value={watch('refeicoes_diarias')}
            onChange={(value) => setValue('refeicoes_diarias', value)}
            placeholder="Descreva as refeições do dia..."
          />
        </div>

        {/* Seção: Detalhes Complementares */}
        <div className="bg-white dark:bg-[#1e2028] rounded-lg border border-slate-200 dark:border-gray-700 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-gray-100 mb-3">Detalhes Complementares</h2>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-1">
              ALGUM ALIMENTO QUE NÃO ACEITA?
            </label>
            <input
              type="text"
              {...register('alimento_nao_aceita')}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#1e2028] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              placeholder="Ex: Tomate, brócolis..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-1">
              TEXTURA DA COMIDA, QUANTIDADE?
            </label>
            <input
              type="text"
              {...register('textura_quantidade')}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#1e2028] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              placeholder="Ex: Amassado, aprox. 150ml por refeição..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-1">
              LOCAL DA COMIDA?
            </label>
            <input
              type="text"
              {...register('local_comida')}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#1e2028] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              placeholder="Ex: Cadeirão, no colo, mesa da família..."
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
    </div>
  );
}
