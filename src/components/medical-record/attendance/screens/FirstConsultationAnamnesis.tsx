'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Save } from 'lucide-react';
import { useMedicalRecord, FirstConsultationAnamnesisData } from '@/hooks/useMedicalRecord';
import { RichTextEditor } from '../RichTextEditor';
import { ModelTemplateModal } from '../ModelTemplateModal';
import { AttendanceScreenProps } from '@/types/attendance';
import { useToast } from '@/contexts/ToastContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface FirstConsultationFormData {
  // Seção 1: Informações Pessoais
  acompanhantes: string;
  mora_onde: string;
  profissoes_pais: string;
  escola_serie_turno: string;
  como_conheceu: string;
  indicacao_de_quem: string;
  naturalidade: string;
  rede_apoio_baba: string;
  antecedentes: string;
  alergias: string;
  historico_molestia_atual: string;
  // Seção 2: Antecedentes
  internacoes: string;
  antecedentes_dos_pais: string;
  tem_irmaos: string[];
  nome_irmaos: string;
  medicamentos_em_uso: string[];
  motivo_consulta: string;
  rede_apoio_opcoes: string[];
  baby_blues: string;
  entregar_escala_edimburgo: string;
  // Seção 3: Mãe e Alimentação
  mae_sentindo_fraca: string;
  suplementacao_mae: string;
  historico_alimentar_ame_formula: string;
  dar_agua: 'sim' | 'não' | null;
  dar_cha: 'sim' | 'não' | null;
  formula_detalhes: string;
  amamentacao: string;
  // Seção 4: Adaptação e Sintomas do RN
  adaptacao_nenem: 'sim' | 'não' | null;
  solucos: 'sim' | 'não' | null;
  colicas: 'sim' | 'não' | null;
  gorfo: 'sim' | 'não' | null;
  posicao_arrotar: 'sim' | 'não' | null;
  posicao_bb_dormir: 'sim' | 'não' | null;
  tem_dado_colo: 'sim' | 'não' | null;
  faz_banho_sol: 'sim' | 'não' | null;
  medicacao_em_uso_bebe: string;
  vacinas_em_dia: 'sim' | 'não' | null;
  usa_chupeta: 'sim' | 'não' | null;
  // Seção 5: Higiene e Cuidados
  limpa_boca_apos_mamadas: string;
  olho_secrecao: string;
  limpa_ouvido: string;
  limpeza_coto_umbilical: string[];
  coto_umbilical_dias: string[];
  banho_rn_frequencia: string;
  usa_perfume: 'sim' | 'não' | null;
  usa_talco: 'sim' | 'não' | null;
  corte_unha: string[];
  evacuacoes_cor_disquesia: string;
  troca_fraldas_material: string[];
  qual_marca_fralda: string;
  usa_travesseiro: 'sim' | 'não' | null;
  // Seção 6: Sono e Desenvolvimento
  sonecas_dorme_aonde: string;
  sono_noite: string;
  dnpm_observa_rosto: string;
  pedir_usg_quadril: 'sim' | 'não' | null;
  fontanela: 'sim' | 'não' | null;
  crosta_lactea: string;
  // Seção 7: Orientações Finais
  que_sabao: string;
  mostrar_visao_bebe: string;
  ler_para_bebe: string;
  vacinas_2_meses: string;
  entregar_farmacinha: 'sim' | 'não' | null;
  sempre_marcar_retorno: string;
}

// Estilos reutilizáveis
const inputClass =
  'w-full px-3 py-2 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#1e2028] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all';
const labelClass = 'block text-xs font-medium text-slate-700 dark:text-gray-300 mb-1';
const sectionClass =
  'bg-white dark:bg-[#1e2028] rounded-lg border border-slate-200 dark:border-gray-700 p-4 space-y-3';

// Componente radio Sim/Não
function RadioSimNao({
  label,
  name,
  register,
}: {
  label: string;
  name: keyof FirstConsultationFormData;
  register: ReturnType<typeof useForm<FirstConsultationFormData>>['register'];
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

// Componente checkbox group
function CheckboxGroup({
  label,
  name,
  options,
  watch,
  setValue,
}: {
  label: string;
  name: keyof FirstConsultationFormData;
  options: { value: string; label: string }[];
  watch: ReturnType<typeof useForm<FirstConsultationFormData>>['watch'];
  setValue: ReturnType<typeof useForm<FirstConsultationFormData>>['setValue'];
}) {
  const current: string[] = (watch(name) as string[]) || [];

  const toggle = (value: string) => {
    if (current.includes(value)) {
      setValue(name as any, current.filter((v) => v !== value));
    } else {
      setValue(name as any, [...current, value]);
    }
  };

  return (
    <div>
      <label className={labelClass}>{label}</label>
      <div className="flex flex-wrap gap-4">
        {options.map((opt) => (
          <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={current.includes(opt.value)}
              onChange={() => toggle(opt.value)}
              className="w-4 h-4 text-blue-600 focus:ring-blue-500 rounded"
            />
            <span className="text-sm text-slate-700 dark:text-gray-300">{opt.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export function FirstConsultationAnamnesis({ patientId, patientData, onRefresh, appointmentId }: AttendanceScreenProps) {
  const { toast } = useToast();
  const { record, isLoading, saveRecord } = useMedicalRecord(patientId, appointmentId);
  const { register, handleSubmit, watch, setValue, formState: { isSubmitting } } =
    useForm<FirstConsultationFormData>({
      defaultValues: {
        acompanhantes: '', mora_onde: '', profissoes_pais: '', escola_serie_turno: '',
        como_conheceu: '', indicacao_de_quem: '', naturalidade: '', rede_apoio_baba: '',
        antecedentes: '', alergias: '', historico_molestia_atual: '',
        internacoes: '', antecedentes_dos_pais: '', tem_irmaos: [], nome_irmaos: '',
        medicamentos_em_uso: [], motivo_consulta: '', rede_apoio_opcoes: [],
        baby_blues: '', entregar_escala_edimburgo: '',
        mae_sentindo_fraca: '', suplementacao_mae: '', historico_alimentar_ame_formula: '',
        dar_agua: null, dar_cha: null, formula_detalhes: '', amamentacao: '',
        adaptacao_nenem: null, solucos: null, colicas: null, gorfo: null,
        posicao_arrotar: null, posicao_bb_dormir: null, tem_dado_colo: null,
        faz_banho_sol: null, medicacao_em_uso_bebe: '', vacinas_em_dia: null, usa_chupeta: null,
        limpa_boca_apos_mamadas: '', olho_secrecao: '', limpa_ouvido: '',
        limpeza_coto_umbilical: [], coto_umbilical_dias: [], banho_rn_frequencia: '',
        usa_perfume: null, usa_talco: null, corte_unha: [], evacuacoes_cor_disquesia: '',
        troca_fraldas_material: [], qual_marca_fralda: '', usa_travesseiro: null,
        sonecas_dorme_aonde: '', sono_noite: '', dnpm_observa_rosto: '',
        pedir_usg_quadril: null, fontanela: null, crosta_lactea: '',
        que_sabao: '', mostrar_visao_bebe: '', ler_para_bebe: '', vacinas_2_meses: '',
        entregar_farmacinha: null, sempre_marcar_retorno: '',
      },
    });

  const [modelModalOpen, setModelModalOpen] = useState(false);
  const [modelModalType, setModelModalType] = useState<string>('');
  const [currentModelContent, setCurrentModelContent] = useState<string>('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const currentDate = format(new Date(), "EEEE, d 'de' MMM. 'de' yyyy", { locale: ptBR });

  // Carrega dados salvos ao montar
  useEffect(() => {
    if (record?.first_consultation_anamnesis) {
      const d = record.first_consultation_anamnesis;
      setValue('acompanhantes', d.acompanhantes || '');
      setValue('mora_onde', d.mora_onde || '');
      setValue('profissoes_pais', d.profissoes_pais || '');
      setValue('escola_serie_turno', d.escola_serie_turno || '');
      setValue('como_conheceu', d.como_conheceu || '');
      setValue('indicacao_de_quem', d.indicacao_de_quem || '');
      setValue('naturalidade', d.naturalidade || '');
      setValue('rede_apoio_baba', d.rede_apoio_baba || '');
      setValue('antecedentes', d.antecedentes || '');
      setValue('alergias', d.alergias || '');
      setValue('historico_molestia_atual', d.historico_molestia_atual || '');
      setValue('internacoes', d.internacoes || '');
      setValue('antecedentes_dos_pais', d.antecedentes_dos_pais || '');
      setValue('tem_irmaos', d.tem_irmaos || []);
      setValue('nome_irmaos', d.nome_irmaos || '');
      setValue('medicamentos_em_uso', d.medicamentos_em_uso || []);
      setValue('motivo_consulta', d.motivo_consulta || '');
      setValue('rede_apoio_opcoes', d.rede_apoio_opcoes || []);
      setValue('baby_blues', d.baby_blues || '');
      setValue('entregar_escala_edimburgo', d.entregar_escala_edimburgo || '');
      setValue('mae_sentindo_fraca', d.mae_sentindo_fraca || '');
      setValue('suplementacao_mae', d.suplementacao_mae || '');
      setValue('historico_alimentar_ame_formula', d.historico_alimentar_ame_formula || '');
      setValue('dar_agua', d.dar_agua || null);
      setValue('dar_cha', d.dar_cha || null);
      setValue('formula_detalhes', d.formula_detalhes || '');
      setValue('amamentacao', d.amamentacao || '');
      setValue('adaptacao_nenem', d.adaptacao_nenem || null);
      setValue('solucos', d.solucos || null);
      setValue('colicas', d.colicas || null);
      setValue('gorfo', d.gorfo || null);
      setValue('posicao_arrotar', d.posicao_arrotar || null);
      setValue('posicao_bb_dormir', d.posicao_bb_dormir || null);
      setValue('tem_dado_colo', d.tem_dado_colo || null);
      setValue('faz_banho_sol', d.faz_banho_sol || null);
      setValue('medicacao_em_uso_bebe', d.medicacao_em_uso_bebe || '');
      setValue('vacinas_em_dia', d.vacinas_em_dia || null);
      setValue('usa_chupeta', d.usa_chupeta || null);
      setValue('limpa_boca_apos_mamadas', d.limpa_boca_apos_mamadas || '');
      setValue('olho_secrecao', d.olho_secrecao || '');
      setValue('limpa_ouvido', d.limpa_ouvido || '');
      setValue('limpeza_coto_umbilical', d.limpeza_coto_umbilical || []);
      setValue('coto_umbilical_dias', d.coto_umbilical_dias || []);
      setValue('banho_rn_frequencia', d.banho_rn_frequencia || '');
      setValue('usa_perfume', d.usa_perfume || null);
      setValue('usa_talco', d.usa_talco || null);
      setValue('corte_unha', d.corte_unha || []);
      setValue('evacuacoes_cor_disquesia', d.evacuacoes_cor_disquesia || '');
      setValue('troca_fraldas_material', d.troca_fraldas_material || []);
      setValue('qual_marca_fralda', d.qual_marca_fralda || '');
      setValue('usa_travesseiro', d.usa_travesseiro || null);
      setValue('sonecas_dorme_aonde', d.sonecas_dorme_aonde || '');
      setValue('sono_noite', d.sono_noite || '');
      setValue('dnpm_observa_rosto', d.dnpm_observa_rosto || '');
      setValue('pedir_usg_quadril', d.pedir_usg_quadril || null);
      setValue('fontanela', d.fontanela || null);
      setValue('crosta_lactea', d.crosta_lactea || '');
      setValue('que_sabao', d.que_sabao || '');
      setValue('mostrar_visao_bebe', d.mostrar_visao_bebe || '');
      setValue('ler_para_bebe', d.ler_para_bebe || '');
      setValue('vacinas_2_meses', d.vacinas_2_meses || '');
      setValue('entregar_farmacinha', d.entregar_farmacinha || null);
      setValue('sempre_marcar_retorno', d.sempre_marcar_retorno || '');
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
    if (modelModalType === 'first_consultation_molestia') setValue('historico_molestia_atual', content);
    else if (modelModalType === 'first_consultation_antecedentes_pais') setValue('antecedentes_dos_pais', content);
    else if (modelModalType === 'first_consultation_motivo') setValue('motivo_consulta', content);
    else if (modelModalType === 'first_consultation_amamentacao') setValue('amamentacao', content);
  };

  const onSubmit = async (data: FirstConsultationFormData) => {
    try {
      const anamnesis: FirstConsultationAnamnesisData = {
        acompanhantes: data.acompanhantes || null,
        mora_onde: data.mora_onde || null,
        profissoes_pais: data.profissoes_pais || null,
        escola_serie_turno: data.escola_serie_turno || null,
        como_conheceu: data.como_conheceu || null,
        indicacao_de_quem: data.indicacao_de_quem || null,
        naturalidade: data.naturalidade || null,
        rede_apoio_baba: data.rede_apoio_baba || null,
        antecedentes: data.antecedentes || null,
        alergias: data.alergias || null,
        historico_molestia_atual: data.historico_molestia_atual || null,
        internacoes: data.internacoes || null,
        antecedentes_dos_pais: data.antecedentes_dos_pais || null,
        tem_irmaos: data.tem_irmaos?.length ? data.tem_irmaos : null,
        nome_irmaos: data.nome_irmaos || null,
        medicamentos_em_uso: data.medicamentos_em_uso?.length ? data.medicamentos_em_uso : null,
        motivo_consulta: data.motivo_consulta || null,
        rede_apoio_opcoes: data.rede_apoio_opcoes?.length ? data.rede_apoio_opcoes : null,
        baby_blues: data.baby_blues || null,
        entregar_escala_edimburgo: data.entregar_escala_edimburgo || null,
        mae_sentindo_fraca: data.mae_sentindo_fraca || null,
        suplementacao_mae: data.suplementacao_mae || null,
        historico_alimentar_ame_formula: data.historico_alimentar_ame_formula || null,
        dar_agua: data.dar_agua || null,
        dar_cha: data.dar_cha || null,
        formula_detalhes: data.formula_detalhes || null,
        amamentacao: data.amamentacao || null,
        adaptacao_nenem: data.adaptacao_nenem || null,
        solucos: data.solucos || null,
        colicas: data.colicas || null,
        gorfo: data.gorfo || null,
        posicao_arrotar: data.posicao_arrotar || null,
        posicao_bb_dormir: data.posicao_bb_dormir || null,
        tem_dado_colo: data.tem_dado_colo || null,
        faz_banho_sol: data.faz_banho_sol || null,
        medicacao_em_uso_bebe: data.medicacao_em_uso_bebe || null,
        vacinas_em_dia: data.vacinas_em_dia || null,
        usa_chupeta: data.usa_chupeta || null,
        limpa_boca_apos_mamadas: data.limpa_boca_apos_mamadas || null,
        olho_secrecao: data.olho_secrecao || null,
        limpa_ouvido: data.limpa_ouvido || null,
        limpeza_coto_umbilical: data.limpeza_coto_umbilical?.length ? data.limpeza_coto_umbilical : null,
        coto_umbilical_dias: data.coto_umbilical_dias?.length ? data.coto_umbilical_dias : null,
        banho_rn_frequencia: data.banho_rn_frequencia || null,
        usa_perfume: data.usa_perfume || null,
        usa_talco: data.usa_talco || null,
        corte_unha: data.corte_unha?.length ? data.corte_unha : null,
        evacuacoes_cor_disquesia: data.evacuacoes_cor_disquesia || null,
        troca_fraldas_material: data.troca_fraldas_material?.length ? data.troca_fraldas_material : null,
        qual_marca_fralda: data.qual_marca_fralda || null,
        usa_travesseiro: data.usa_travesseiro || null,
        sonecas_dorme_aonde: data.sonecas_dorme_aonde || null,
        sono_noite: data.sono_noite || null,
        dnpm_observa_rosto: data.dnpm_observa_rosto || null,
        pedir_usg_quadril: data.pedir_usg_quadril || null,
        fontanela: data.fontanela || null,
        crosta_lactea: data.crosta_lactea || null,
        que_sabao: data.que_sabao || null,
        mostrar_visao_bebe: data.mostrar_visao_bebe || null,
        ler_para_bebe: data.ler_para_bebe || null,
        vacinas_2_meses: data.vacinas_2_meses || null,
        entregar_farmacinha: data.entregar_farmacinha || null,
        sempre_marcar_retorno: data.sempre_marcar_retorno || null,
      };

      await saveRecord({ first_consultation_anamnesis: anamnesis });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Erro ao salvar anamnese da 1ª consulta:', error);
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
        <h1 className="text-xl font-bold text-slate-800 dark:text-gray-100">ANAMNESE DA 1ª CONSULTA</h1>
        <span className="text-xs text-slate-600 dark:text-gray-400 uppercase">{currentDate}</span>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">

        {/* ─── Seção 1: Informações Pessoais ─── */}
        <div className={sectionClass}>
          <h2 className="text-sm font-semibold text-slate-800 dark:text-gray-100 mb-3">Informações Pessoais</h2>

          {[
            { name: 'acompanhantes' as const, label: 'ACOMPANHANTES?' },
            { name: 'mora_onde' as const, label: 'MORA ONDE?' },
            { name: 'profissoes_pais' as const, label: 'PROFISSÕES DOS PAIS?' },
            { name: 'escola_serie_turno' as const, label: 'ESCOLA? SÉRIE? TURNO?' },
            { name: 'como_conheceu' as const, label: 'COMO NOS CONHECEU?' },
            { name: 'indicacao_de_quem' as const, label: 'INDICAÇÃO DE QUEM?' },
            { name: 'naturalidade' as const, label: 'NATURALIDADE?' },
            { name: 'rede_apoio_baba' as const, label: 'REDE DE APOIO? BABÁ?' },
            { name: 'antecedentes' as const, label: 'ANTECEDENTES?' },
            { name: 'alergias' as const, label: 'ALERGIAS?' },
          ].map(({ name, label }) => (
            <div key={name}>
              <label className={labelClass}>{label}</label>
              <input type="text" {...register(name)} className={inputClass} />
            </div>
          ))}
        </div>

        {/* HISTÓRICO MOLÉSTIA ATUAL (rich text) */}
        <div className="bg-white dark:bg-[#1e2028] rounded-lg border border-slate-200 dark:border-gray-700 p-4">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-gray-100">HISTÓRICO MOLÉSTIA ATUAL?</h2>
            <div className="flex gap-2">
              <button type="button" onClick={() => handleUseModel('first_consultation_molestia')}
                className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors">
                Usar modelo
              </button>
              <button type="button" onClick={() => handleSaveModel('first_consultation_molestia', watch('historico_molestia_atual'))}
                className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors">
                Salvar modelo
              </button>
            </div>
          </div>
          <RichTextEditor
            value={watch('historico_molestia_atual')}
            onChange={(v) => setValue('historico_molestia_atual', v)}
            placeholder="Digite o histórico da moléstia atual..."
          />
        </div>

        {/* ─── Seção 2: Antecedentes ─── */}
        <div className={sectionClass}>
          <h2 className="text-sm font-semibold text-slate-800 dark:text-gray-100 mb-3">Antecedentes</h2>

          <div>
            <label className={labelClass}>INTERNAÇÕES?</label>
            <input type="text" {...register('internacoes')} className={inputClass} />
          </div>
        </div>

        {/* ANTECEDENTES DOS PAIS (rich text) */}
        <div className="bg-white dark:bg-[#1e2028] rounded-lg border border-slate-200 dark:border-gray-700 p-4">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-gray-100">ANTECEDENTES DOS PAIS?</h2>
            <div className="flex gap-2">
              <button type="button" onClick={() => handleUseModel('first_consultation_antecedentes_pais')}
                className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors">
                Usar modelo
              </button>
              <button type="button" onClick={() => handleSaveModel('first_consultation_antecedentes_pais', watch('antecedentes_dos_pais'))}
                className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors">
                Salvar modelo
              </button>
            </div>
          </div>
          <RichTextEditor
            value={watch('antecedentes_dos_pais')}
            onChange={(v) => setValue('antecedentes_dos_pais', v)}
            placeholder="Digite os antecedentes dos pais..."
          />
        </div>

        {/* ─── Seção continuação: Irmãos, Medicamentos, Motivo ─── */}
        <div className={sectionClass}>
          <CheckboxGroup
            label="TEM IRMÃOS?"
            name="tem_irmaos"
            options={[{ value: '1', label: '1' }, { value: '2', label: '2' }, { value: '3', label: '3' }]}
            watch={watch}
            setValue={setValue}
          />

          <div>
            <label className={labelClass}>NOME DOS IRMÃOS?</label>
            <input type="text" {...register('nome_irmaos')} className={inputClass} />
          </div>

          <CheckboxGroup
            label="MEDICAMENTOS EM USO?"
            name="medicamentos_em_uso"
            options={[
              { value: 'vitamina_d', label: 'VITAMINA D' },
              { value: 'ferro', label: 'FERRO' },
              { value: 'polivitaminico', label: 'POLIVITAMINICO' },
              { value: 'redoxon', label: 'REDOXON' },
            ]}
            watch={watch}
            setValue={setValue}
          />
        </div>

        {/* MOTIVO DA CONSULTA (rich text) */}
        <div className="bg-white dark:bg-[#1e2028] rounded-lg border border-slate-200 dark:border-gray-700 p-4">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-gray-100">MOTIVO DA CONSULTA</h2>
            <div className="flex gap-2">
              <button type="button" onClick={() => handleUseModel('first_consultation_motivo')}
                className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors">
                Usar modelo
              </button>
              <button type="button" onClick={() => handleSaveModel('first_consultation_motivo', watch('motivo_consulta'))}
                className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors">
                Salvar modelo
              </button>
            </div>
          </div>
          <RichTextEditor
            value={watch('motivo_consulta')}
            onChange={(v) => setValue('motivo_consulta', v)}
            placeholder="Digite o motivo da consulta..."
          />
        </div>

        {/* ─── Rede de Apoio e Baby Blues ─── */}
        <div className={sectionClass}>
          <CheckboxGroup
            label="REDE DE APOIO"
            name="rede_apoio_opcoes"
            options={[
              { value: 'avos_maternos', label: 'AVÓS MATERNOS' },
              { value: 'avos_paternos', label: 'AVÓS PATERNOS' },
              { value: 'baba', label: 'BABÁ' },
              { value: 'outros', label: 'OUTROS' },
            ]}
            watch={watch}
            setValue={setValue}
          />

          <div>
            <label className={labelClass}>BABY BLUES</label>
            <input type="text" {...register('baby_blues')} className={inputClass} placeholder="Observações sobre baby blues..." />
          </div>

          <div>
            <label className={labelClass}>ENTREGAR ESCALA EM EDIMBURGO</label>
            <input type="text" {...register('entregar_escala_edimburgo')} className={inputClass} />
          </div>
        </div>

        {/* ─── Seção 3: Informações da Mãe e Alimentação ─── */}
        <div className={sectionClass}>
          <h2 className="text-sm font-semibold text-slate-800 dark:text-gray-100 mb-3">Informações da Mãe e Alimentação</h2>

          <div>
            <label className={labelClass}>MÃE TÁ SE SENTINDO FRACA? COMO TÁ/ PEDIR EXAMES</label>
            <input type="text" {...register('mae_sentindo_fraca')} className={inputClass} />
          </div>

          <div>
            <label className={labelClass}>SUPLEMENTAÇÃO DA MÃE? TÁ TOMANDO ALGO? OSCAL D 500 MG 12/12HRS</label>
            <input type="text" {...register('suplementacao_mae')} className={inputClass} />
          </div>

          <div>
            <label className={labelClass}>HISTÓRICO ALIMENTAR? AME? FÓRMULA?</label>
            <input type="text" {...register('historico_alimentar_ame_formula')} className={inputClass} />
          </div>

          <RadioSimNao label="DAR ÁGUA? SE USAR MAS FÓRMULAS ENTRA COM ÁGUA" name="dar_agua" register={register} />
          <RadioSimNao label="DAR CHÁ?" name="dar_cha" register={register} />

          <div>
            <label className={labelClass}>FÓRMULA: QUAL/ QUANTOS ML? COMO PREPARA? COMO LIMPEZA MAMADEIRA?</label>
            <input type="text" {...register('formula_detalhes')} className={inputClass} placeholder="Ex: NAN 1, 60ml, lavar com água quente..." />
          </div>
        </div>

        {/* AMAMENTAÇÃO (rich text) */}
        <div className="bg-white dark:bg-[#1e2028] rounded-lg border border-slate-200 dark:border-gray-700 p-4">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-gray-100">
              AMAMENTAÇÃO / BAIXA PRODUÇÃO DOMPERIDONA 30MG DIA / SE DOR FAZER MASSAGEM / BOMBINHA
            </h2>
            <div className="flex gap-2">
              <button type="button" onClick={() => handleUseModel('first_consultation_amamentacao')}
                className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors">
                Usar modelo
              </button>
              <button type="button" onClick={() => handleSaveModel('first_consultation_amamentacao', watch('amamentacao'))}
                className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors">
                Salvar modelo
              </button>
            </div>
          </div>
          <RichTextEditor
            value={watch('amamentacao')}
            onChange={(v) => setValue('amamentacao', v)}
            placeholder="Informações sobre amamentação..."
          />
        </div>

        {/* ─── Seção 4: Adaptação e Sintomas do RN ─── */}
        <div className={sectionClass}>
          <h2 className="text-sm font-semibold text-slate-800 dark:text-gray-100 mb-3">Adaptação e Sintomas do RN</h2>

          <RadioSimNao label="ADAPTAÇÃO DO NENÊ, FALA TUDO?" name="adaptacao_nenem" register={register} />
          <RadioSimNao label="SOLUÇOS" name="solucos" register={register} />
          <RadioSimNao label="CÓLICAS" name="colicas" register={register} />
          <RadioSimNao label="GORFO" name="gorfo" register={register} />
          <RadioSimNao label="POSIÇÃO ARROTAR" name="posicao_arrotar" register={register} />
          <RadioSimNao label="POSIÇÃO DE BB DORMIR" name="posicao_bb_dormir" register={register} />
          <RadioSimNao label="TEM DADO COLO, NÃO VICIA" name="tem_dado_colo" register={register} />
          <RadioSimNao label="FAZ BANHO DE SOL?" name="faz_banho_sol" register={register} />

          <div>
            <label className={labelClass}>MEDICAÇÃO EM USO? COLIDES, COLIC CALM, VITAMINA D, REDOXON?</label>
            <input type="text" {...register('medicacao_em_uso_bebe')} className={inputClass} />
          </div>

          <RadioSimNao label="VACINAS EM DIA" name="vacinas_em_dia" register={register} />
          <RadioSimNao label="USA CHUPETA? TROCAR A CADA DOIS MESES" name="usa_chupeta" register={register} />
        </div>

        {/* ─── Seção 5: Higiene e Cuidados ─── */}
        <div className={sectionClass}>
          <h2 className="text-sm font-semibold text-slate-800 dark:text-gray-100 mb-3">Higiene e Cuidados</h2>

          {[
            { name: 'limpa_boca_apos_mamadas' as const, label: 'LIMPA A BOCA APÓS AS MAMADAS?' },
            { name: 'olho_secrecao' as const, label: 'OLHO TEM SAÍDO SECREÇÃO?' },
            { name: 'limpa_ouvido' as const, label: 'LIMPA O OUVIDO COM COTONETE OU FRALDA?' },
          ].map(({ name, label }) => (
            <div key={name}>
              <label className={labelClass}>{label}</label>
              <input type="text" {...register(name)} className={inputClass} />
            </div>
          ))}

          <CheckboxGroup
            label="LIMPEZA COTO UMBILICAL"
            name="limpeza_coto_umbilical"
            options={[
              { value: 'alcool_70', label: 'ÁLCOOL 70' },
              { value: 'agua_sabao', label: 'ÁGUA E SABÃO' },
            ]}
            watch={watch}
            setValue={setValue}
          />

          <CheckboxGroup
            label="COTO UMBILICAL CAIU COM QUANTOS DIAS?"
            name="coto_umbilical_dias"
            options={[
              { value: '<10dias', label: '<10 DIAS' },
              { value: '>10dias', label: '> 10 DIAS' },
            ]}
            watch={watch}
            setValue={setValue}
          />

          <div>
            <label className={labelClass}>
              BANHO RN, NÃO PRECISA SER TODOS OS DIAS — CRITÉRIO DA FAMÍLIA, PODE DAR BANHO DE CHUVEIRO,
              IMPORTANTE COMO SEGURA O NENÊ (MOSTRA COMO), CHORA MUITO NO BANHO (COLOCA PRIMEIRO O PÉ DEPOIS PERNA), OU USA FRALDINHA
            </label>
            <select {...register('banho_rn_frequencia')}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-gray-700 rounded-md bg-white dark:bg-[#1e2028] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all">
              <option value="">Selecione</option>
              <option value="1x_dia_antes_meio_dia">1X AO DIA ANTES DE MEIO DIA</option>
              <option value="2x_dia_meio_tarde">2X AO DIA MEIO DIA E A TARDE</option>
              <option value="2x_dia_manha_noite">2X AO DIA MANHÃ E NOITE</option>
            </select>
          </div>

          <RadioSimNao label="USA PERFUME?" name="usa_perfume" register={register} />
          <RadioSimNao label="USA TALCO?" name="usa_talco" register={register} />

          <CheckboxGroup
            label="CORTE DE UNHA, ENCRAVA?"
            name="corte_unha"
            options={[
              { value: 'redondo', label: 'REDONDO' },
              { value: 'quadrado', label: 'QUADRADO' },
            ]}
            watch={watch}
            setValue={setValue}
          />

          <div>
            <label className={labelClass}>EVACUAÇÕES? COR/ DISQUESIA?</label>
            <input type="text" {...register('evacuacoes_cor_disquesia')} className={inputClass} />
          </div>

          <CheckboxGroup
            label="TROCA DE FRALDAS: LENÇO OU ALGUMA MORNA?"
            name="troca_fraldas_material"
            options={[
              { value: 'lenco_umedecido', label: 'LENÇO UMEDECIDO' },
              { value: 'agua_morna', label: 'ÁGUA MORNA' },
            ]}
            watch={watch}
            setValue={setValue}
          />

          <div>
            <label className={labelClass}>
              QUAL A MARCA DA FRALDA, TROCA DE FRALDAS QUANTAS X AO DIA? USA POMADA, QUAL QUANTIDADE COLOCA? LIMPA COM QUE?
            </label>
            <input type="text" {...register('qual_marca_fralda')} className={inputClass} />
          </div>

          <RadioSimNao label="USA TRAVESSEIRO?" name="usa_travesseiro" register={register} />
        </div>

        {/* ─── Seção 6: Sono e Desenvolvimento ─── */}
        <div className={sectionClass}>
          <h2 className="text-sm font-semibold text-slate-800 dark:text-gray-100 mb-3">Sono e Desenvolvimento</h2>

          {[
            { name: 'sonecas_dorme_aonde' as const, label: 'SONECAS/ DORME AONDE?' },
            { name: 'sono_noite' as const, label: 'SONO À NOITE, ELES PRECISAM DE MAIS ACONCHEGO POR ADAPTAÇÃO E FICAM MAIS NO PEITO' },
            { name: 'dnpm_observa_rosto' as const, label: 'DNPM — OBSERVA UM ROSTO? LATERALIZA A CABEÇA? POSTURA FLETIDA?' },
          ].map(({ name, label }) => (
            <div key={name}>
              <label className={labelClass}>{label}</label>
              <input type="text" {...register(name)} className={inputClass} />
            </div>
          ))}

          <RadioSimNao label="PEDIR USG DE QUADRIL" name="pedir_usg_quadril" register={register} />
          <RadioSimNao label="FONTANELA" name="fontanela" register={register} />

          <div>
            <label className={labelClass}>CROSTA LÁCTEA?</label>
            <input type="text" {...register('crosta_lactea')} className={inputClass} />
          </div>
        </div>

        {/* ─── Seção 7: Orientações Finais ─── */}
        <div className={sectionClass}>
          <h2 className="text-sm font-semibold text-slate-800 dark:text-gray-100 mb-3">Orientações Finais</h2>

          {[
            { name: 'que_sabao' as const, label: 'QUE SABÃO USA, QUE AMACIANTE?' },
            { name: 'mostrar_visao_bebe' as const, label: 'MOSTRAR VISÃO DO BEBÊ — FOTO RECÉM NASCIDO' },
            { name: 'ler_para_bebe' as const, label: 'LER PARA O BEBÊ?' },
            {
              name: 'vacinas_2_meses' as const,
              label: 'FALAR VACINAS DE 2 MESES E QUAIS NO PARTICULAR E EFEITO COLATERAL / MEDICAÇÃO SÓ APÓS VACINA SE FEBRE PARACETAMOL 200MG/ML',
            },
          ].map(({ name, label }) => (
            <div key={name}>
              <label className={labelClass}>{label}</label>
              <input type="text" {...register(name)} className={inputClass} />
            </div>
          ))}

          <RadioSimNao label="ENTREGAR, FARMACINHA, GUIA DO RN E DESENVOLVIMENTO" name="entregar_farmacinha" register={register} />

          <div>
            <label className={labelClass}>SEMPRE MARCAR RETORNO EM 1 SEMANA</label>
            <input type="text" {...register('sempre_marcar_retorno')} className={inputClass} placeholder="Observações sobre retorno..." />
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
        onSave={() => setModelModalOpen(false)}
        type={modelModalType}
        currentContent={currentModelContent}
      />
    </div>
  );
}
