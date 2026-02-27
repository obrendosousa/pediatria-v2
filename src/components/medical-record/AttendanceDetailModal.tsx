// src/components/medical-record/AttendanceDetailModal.tsx

import React from 'react';
import {
  X, User, Calendar, FileText, Activity, Clipboard,
  Stethoscope, Syringe, HeartPulse, Shield, Baby, Book,
  Paperclip, FileSignature, Pill, TestTube, ArrowRight,
  Printer, Image as ImageIcon, Video, File
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useExamRequests } from '@/hooks/useExamRequests';
import { usePrescriptions } from '@/hooks/usePrescriptions';
import { useDocuments } from '@/hooks/useDocuments';
import { useAttachments, isImage, isVideo, isPdf } from '@/hooks/useAttachments';
import { supabase } from '@/lib/supabase';
import { printRequest } from './attendance/screens/ExamsAndProcedures';
import { printPrescription } from './attendance/screens/Prescriptions';
import { printDocument } from './attendance/screens/DocumentsAndCertificates';
import { MedicalRecord } from '@/types/medical';

interface AttendanceDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: any | null; // Using any to access all the 15 screen types fetched via useMedicalRecord
  doctorName?: string;
  externalPatientData?: any;
}

// Helper para exibir campos individuais
const Field = ({ label, value, isHtml = false }: { label: string, value: any, isHtml?: boolean }) => {
  if (value === null || value === undefined || value === '') return null;
  if (Array.isArray(value) && value.length === 0) return null;

  const displayValue = Array.isArray(value) ? value.join(', ') : String(value);
  if (!displayValue || displayValue === 'undefined') return null;

  const fmtValue = displayValue.toLowerCase() === 'sim' ? 'Sim' : displayValue.toLowerCase() === 'não' ? 'Não' : displayValue;

  return (
    <div className="bg-white dark:bg-[#2a2d36] border border-slate-200 dark:border-gray-700 rounded-xl p-4 transition-all hover:border-blue-200 dark:hover:border-blue-800">
      <p className="text-xs font-bold text-slate-400 uppercase mb-2">
        {label}
      </p>
      {isHtml ? (
        <div
          className="text-sm text-slate-700 dark:text-gray-200 prose dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: fmtValue }}
        />
      ) : (
        <p className="text-sm text-slate-700 dark:text-gray-200">{fmtValue}</p>
      )}
    </div>
  );
};

// Seção Collapsible para agrupar as telas
const Section = ({ title, icon: Icon, children, isEmpty }: { title: string, icon: any, children: React.ReactNode, isEmpty?: boolean }) => {
  const [isOpen, setIsOpen] = React.useState(true);

  if (isEmpty) return null;

  return (
    <div className="border border-slate-200 dark:border-gray-700 rounded-xl overflow-hidden mb-6 bg-slate-50 dark:bg-[#2a2d36]/50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-white dark:bg-[#2a2d36] hover:bg-slate-50 dark:hover:bg-gray-800 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg shadow-sm border border-blue-100 dark:border-blue-800">
            <Icon className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-gray-100 uppercase">{title}</h3>
        </div>
        <div className={`transform transition-transform ${isOpen ? 'rotate-90' : ''}`}>
          <ArrowRight className="w-5 h-5 text-slate-400" />
        </div>
      </button>

      {isOpen && (
        <div className="p-4 border-t border-slate-200 dark:border-gray-700 bg-slate-50/50 dark:bg-[#2a2d36]/20">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {children}
          </div>
        </div>
      )}
    </div>
  );
};

export function AttendanceDetailModal({
  isOpen,
  onClose,
  record,
  doctorName,
  externalPatientData
}: AttendanceDetailModalProps) {

  const patientId = record?.patient_id || 0;
  const medicalRecordId = record?.id || null;

  // Buscar dados de tabelas relacionadas (Apenas se houver record ativo)
  // Buscar todos os dados
  const { requests: allExams } = useExamRequests(patientId);
  const { prescriptions: allPrescriptions } = usePrescriptions(patientId);
  const { documents: allDocuments } = useDocuments(patientId);
  const { files: allAttachments } = useAttachments(patientId);

  // Filtrar dados apenas para o atendimento atual
  const exams = React.useMemo(() =>
    medicalRecordId ? allExams.filter(e => e.medical_record_id === medicalRecordId) : [],
    [allExams, medicalRecordId]
  );

  const prescriptions = React.useMemo(() =>
    medicalRecordId ? allPrescriptions.filter(p => p.medical_record_id === medicalRecordId) : [],
    [allPrescriptions, medicalRecordId]
  );

  const documents = React.useMemo(() =>
    medicalRecordId ? allDocuments.filter(d => d.medical_record_id === medicalRecordId) : [],
    [allDocuments, medicalRecordId]
  );

  const attachments = React.useMemo(() =>
    medicalRecordId ? allAttachments.filter(a => a.medical_record_id === medicalRecordId) : [],
    [allAttachments, medicalRecordId]
  );

  const [patientData, setPatientData] = React.useState<any>(externalPatientData || {});

  React.useEffect(() => {
    async function loadPatient() {
      if (!patientId) return;

      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('id', patientId)
        .single();

      if (!error && data) {
        setPatientData(data);
      }
    }

    if (isOpen && patientId && !externalPatientData) {
      loadPatient();
    }
  }, [isOpen, patientId, externalPatientData]);

  if (!isOpen || !record) return null;

  const data = record;

  const hasFirstConsult = !!data.first_consultation_anamnesis;
  const hasRoutine = !!data.routine_consultation;
  const hasEmergency = !!data.emergency_consultation;
  const hasAdolescent = !!data.adolescent_consultation;
  const hasFood = !!data.food_history;
  const hasDiag = !!data.diagnostic_hypothesis_data;
  const hasFollowUp = !!data.follow_up_data;
  const hasResults = !!data.exam_results_data;

  // Vitals array checks
  const hasVitals = data.vitals && Object.values(data.vitals).some(v => v !== undefined && v !== null && v !== '');

  // SOAP checks
  const hasSoap = data.chief_complaint || data.hda || data.antecedents || data.physical_exam || data.diagnosis || data.conducts;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#1e2028] w-full max-w-5xl h-full max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-gray-700">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-gray-800 bg-gradient-to-r from-rose-50 to-pink-50 dark:from-[#2a2d36] dark:to-[#2a2d36]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-rose-100 dark:bg-rose-900/30 rounded-full flex items-center justify-center shadow-inner">
              <FileText className="w-6 h-6 text-rose-600 dark:text-rose-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-gray-100 tracking-tight">
                Resumo do Atendimento
              </h2>
              <p className="text-sm text-slate-500 dark:text-gray-400 flex items-center gap-2 mt-1">
                <Calendar className="w-4 h-4" />
                {data.created_at ? format(parseISO(data.created_at), "EEEE, d 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR }) : 'Data não registrada'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-200/50 dark:hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-slate-500 dark:text-slate-400" />
          </button>
        </div>

        {/* Body - Scrollable */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-2 bg-[#f8fafc] dark:bg-[#1e2028]">

          {/* Informações do Profissional */}
          <div className="bg-white dark:bg-[#2a2d36] shadow-sm rounded-xl p-4 border border-slate-200 dark:border-gray-700 mb-6">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-gray-400 font-medium uppercase tracking-wider">Profissional Responsável</p>
                <p className="text-sm font-bold text-slate-800 dark:text-gray-100">
                  Dra. Fernanda Santana
                </p>
              </div>
            </div>
          </div>

          {/* 1. SINAIS VITAIS */}
          {hasVitals && (
            <Section title="Sinais Vitais" icon={Activity}>
              <Field label="Peso (kg)" value={data.vitals?.weight} />
              <Field label="Altura (cm)" value={data.vitals?.height} />
              <Field label="IMC" value={data.vitals?.imc?.toFixed(2)} />
              <Field label="Perímetro Cefálico (cm)" value={data.vitals?.pe} />
              <Field label="Temperatura (°C)" value={data.vitals?.temp} />
              <Field label="Frequência Cardíaca (bpm)" value={data.vitals?.heartRate} />
              <Field label="Frequência Respiratória (rpm)" value={data.vitals?.respRate} />
              <Field label="Saturação (%)" value={data.vitals?.saturation} />
              {(data.vitals?.sysBP || data.vitals?.diaBP) && (
                <Field label="Pressão Arterial" value={`${data.vitals?.sysBP || '-'} / ${data.vitals?.diaBP || '-'} mmHg`} />
              )}
            </Section>
          )}

          {/* 2. ATENDIMENTO (SOAP) */}
          {hasSoap && (
            <Section title="Evolução Clínica e Conduta (Atendimento)" icon={Stethoscope}>
              <div className="col-span-1 md:col-span-2 space-y-4">
                <Field label="Queixa principal" value={data.chief_complaint} />
                <Field label="História da moléstia atual (HDA)" value={data.hda} isHtml />
                <Field label="Histórico e antecedentes" value={data.antecedents} isHtml />
                <Field label="Exame Físico" value={data.physical_exam} isHtml />
                <Field label="Diagnóstico" value={data.diagnosis} />
                <Field label="Condutas" value={data.conducts} isHtml />
              </div>
            </Section>
          )}

          {/* 3. PRIMEIRA CONSULTA */}
          {hasFirstConsult && (
            <Section title="Primeira Consulta Anamnese" icon={Baby}>
              <div className="col-span-1 md:col-span-2 font-bold text-rose-500 text-xs uppercase mt-2 mb-1 border-b border-slate-200 dark:border-gray-700 pb-1">Informações Pessoais</div>
              <Field label="Acompanhantes" value={data.first_consultation_anamnesis.acompanhantes} />
              <Field label="De onde indicaram?" value={data.first_consultation_anamnesis.indicacao_de_quem} />
              <Field label="Onde Mora" value={data.first_consultation_anamnesis.mora_onde} />
              <Field label="Naturalidade" value={data.first_consultation_anamnesis.naturalidade} />
              <Field label="Rede de Apoio / Babá" value={data.first_consultation_anamnesis.rede_apoio_baba} />
              <Field label="Profissão dos Pais" value={data.first_consultation_anamnesis.profissoes_pais} />

              <div className="col-span-1 md:col-span-2 font-bold text-rose-500 text-xs uppercase mt-4 mb-1 border-b border-slate-200 dark:border-gray-700 pb-1">Antecedentes</div>
              <div className="col-span-1 md:col-span-2"><Field label="Motivo da Consulta" value={data.first_consultation_anamnesis.motivo_consulta} isHtml /></div>
              <Field label="Alergias" value={data.first_consultation_anamnesis.alergias} />
              <Field label="História da Moléstia Atual" value={data.first_consultation_anamnesis.historico_molestia_atual} isHtml />
              <Field label="Internações" value={data.first_consultation_anamnesis.internacoes} />
              <Field label="Irmãos" value={(data.first_consultation_anamnesis.tem_irmaos || []).length > 0 ? `${(data.first_consultation_anamnesis.tem_irmaos || []).join(', ')} - ${data.first_consultation_anamnesis.nome_irmaos}` : 'Não'} />
              <Field label="Antecedentes Familiares" value={data.first_consultation_anamnesis.antecedentes_dos_pais} isHtml />
              <Field label="Rede de Apoio Familiar" value={data.first_consultation_anamnesis.rede_apoio_opcoes} />
              <Field label="Baby Blues?" value={data.first_consultation_anamnesis.baby_blues} />

              <div className="col-span-1 md:col-span-2 font-bold text-rose-500 text-xs uppercase mt-4 mb-1 border-b border-slate-200 dark:border-gray-700 pb-1">Mãe e Alimentação</div>
              <Field label="Mãe se sentindo fraca?" value={data.first_consultation_anamnesis.mae_sentindo_fraca} />
              <Field label="Amamentação" value={data.first_consultation_anamnesis.amamentacao} isHtml />
              <Field label="Fórmula (Detalhes)" value={data.first_consultation_anamnesis.formula_detalhes} />
              <Field label="Dar Chá?" value={data.first_consultation_anamnesis.dar_cha} />
              <Field label="Dar Água?" value={data.first_consultation_anamnesis.dar_agua} />

              <div className="col-span-1 md:col-span-2 font-bold text-rose-500 text-xs uppercase mt-4 mb-1 border-b border-slate-200 dark:border-gray-700 pb-1">Sintomas e Adaptação do RN</div>
              <Field label="Adaptado?" value={data.first_consultation_anamnesis.adaptacao_nenem} />
              <Field label="Cólicas?" value={data.first_consultation_anamnesis.colicas} />
              <Field label="Soluços?" value={data.first_consultation_anamnesis.solucos} />
              <Field label="Posição pra Arrotar" value={data.first_consultation_anamnesis.posicao_arrotar} />
              <Field label="Posição de Dormir" value={data.first_consultation_anamnesis.posicao_bb_dormir} />
              <Field label="Tem dado colo?" value={data.first_consultation_anamnesis.tem_dado_colo} />
              <Field label="Banho de Sol" value={data.first_consultation_anamnesis.faz_banho_sol} />
              <Field label="Vacinas em Dia?" value={data.first_consultation_anamnesis.vacinas_em_dia} />
              <Field label="Uso de Chupeta?" value={data.first_consultation_anamnesis.usa_chupeta} />
              <Field label="Medicamentos do RN" value={data.first_consultation_anamnesis.medicacao_em_uso_bebe} />

              <div className="col-span-1 md:col-span-2 font-bold text-rose-500 text-xs uppercase mt-4 mb-1 border-b border-slate-200 dark:border-gray-700 pb-1">Higiene e Cuidados</div>
              <Field label="Limpa a Boca?" value={data.first_consultation_anamnesis.limpa_boca_apos_mamadas} />
              <Field label="Secreção Olhos" value={data.first_consultation_anamnesis.olho_secrecao} />
              <Field label="Limpa Ouvido?" value={data.first_consultation_anamnesis.limpa_ouvido} />
              <Field label="Limpeza do Coto Umbilical" value={data.first_consultation_anamnesis.limpeza_coto_umbilical} />
              <Field label="Coto Dias (< ou > 10d)" value={data.first_consultation_anamnesis.coto_umbilical_dias} />
              <Field label="Frequencia do Banho" value={data.first_consultation_anamnesis.banho_rn_frequencia} />
              <Field label="Usa Perfume?" value={data.first_consultation_anamnesis.usa_perfume} />
              <Field label="Usa Talco?" value={data.first_consultation_anamnesis.usa_talco} />
              <Field label="Corte de Unhas" value={data.first_consultation_anamnesis.corte_unha} />
              <Field label="Evacuações e Aspecto" value={data.first_consultation_anamnesis.evacuacoes_cor_disquesia} />
              <Field label="Material de Troca de Fraldas" value={data.first_consultation_anamnesis.troca_fraldas_material} />
              <Field label="Marca da Fralda" value={data.first_consultation_anamnesis.qual_marca_fralda} />

              <div className="col-span-1 md:col-span-2 font-bold text-rose-500 text-xs uppercase mt-4 mb-1 border-b border-slate-200 dark:border-gray-700 pb-1">Sono e Desenvolvimento</div>
              <Field label="Sonecas / Onde dorme" value={data.first_consultation_anamnesis.sonecas_dorme_aonde} />
              <Field label="Sono a Noite" value={data.first_consultation_anamnesis.sono_noite} />
              <Field label="Observa o rosto? (DNPM)" value={data.first_consultation_anamnesis.dnpm_observa_rosto} />
              <Field label="Pedir USG do Quadril" value={data.first_consultation_anamnesis.pedir_usg_quadril} />
              <Field label="Fontanela" value={data.first_consultation_anamnesis.fontanela} />
              <Field label="Crosta láctea" value={data.first_consultation_anamnesis.crosta_lactea} />
            </Section>
          )}

          {/* 4. CONSULTA DE ROTINA */}
          {hasRoutine && (
            <Section title="Consulta de Rotina" icon={Calendar}>
              <div className="col-span-1 md:col-span-2">
                <Field label="Motivo da Consulta" value={data.routine_consultation.consultation_reason} />
              </div>
              <Field label="Cuidadores" value={data.routine_consultation.caregivers_name} />
              <Field label="Onde Fica (Rede de Apoio)" value={data.routine_consultation.support_network} />
              <Field label="Escola (Período)" value={data.routine_consultation.school_info} />
              <Field label="Alergias e Reações" value={data.routine_consultation.allergies_interactions} />
              <div className="col-span-1 md:col-span-2">
                <Field label="Rotina Respiratória / Tosses" value={data.routine_consultation.breathing_info} />
              </div>
              <Field label="Remédios de Rotina / Suplementos" value={data.routine_consultation.medications} />
              <Field label="Aleitamento / Fórmula" value={data.routine_consultation.breastfeeding_formula} />
              <div className="col-span-1 md:col-span-2 grid grid-cols-2 gap-4">
                <Field label="Vacinas em Dia?" value={data.routine_consultation.vaccines_up_to_date} />
                <Field label="Vacinas Atrasadas" value={data.routine_consultation.delayed_vaccine} />
                <Field label="Uso de Chupeta / Bico" value={data.routine_consultation.uses_pacifier} />
                <Field label="Faz lavagem nasal?" value={data.routine_consultation.nose_wash} />
              </div>
              <div className="col-span-1 md:col-span-2 grid grid-cols-2 gap-4">
                <Field label="Produtos de Pele / Sabonete" value={data.routine_consultation.skin_products} />
                <Field label="Dentista / Escovação" value={data.routine_consultation.dental_info} />
                <Field label="Transito Gastrointestinal" value={data.routine_consultation.gastrointestinal} />
                <Field label="Sistema Geniturinário" value={data.routine_consultation.genitourinary} />
              </div>
              <Field label="Desenvolvimento / Sistema Nervoso" value={data.routine_consultation.nervous_system} />
              <Field label="Exposição de Telas" value={data.routine_consultation.screen_exposure} />
              <Field label="Sono / Onde e com Quem" value={data.routine_consultation.sleep_info} />
              <Field label="Mensários/Marcos em dia?" value={data.routine_consultation.monthly_milestones} />
              <div className="col-span-1 md:col-span-2">
                <Field label="Resultados de Exames Prévios" value={data.routine_consultation.exam_results} isHtml />
              </div>
              <Field label="Imprimir Guia de Desenvolvimento" value={data.routine_consultation.print_development_guide} />
            </Section>
          )}

          {/* 5. PRONTO SOCORRO */}
          {hasEmergency && (
            <Section title="Pronto Socorro" icon={Syringe}>
              <Field label="Acompanhantes" value={data.emergency_consultation.acompanhantes} />
              <div className="col-span-1 md:col-span-2">
                <Field label="Motivo da Consulta" value={data.emergency_consultation.motivo_consulta} isHtml />
              </div>
              <div className="col-span-1 md:col-span-2">
                <Field label="Medicações em Uso" value={data.emergency_consultation.medicacoes_em_uso} isHtml />
              </div>
              <Field label="Alergias" value={data.emergency_consultation.alergias} />
              <Field label="Internações Prévias" value={data.emergency_consultation.internacoes} />
              <Field label="Antecedentes Pai" value={data.emergency_consultation.antecedentes_pai} />
              <Field label="Antecedentes Mãe" value={data.emergency_consultation.antecedentes_mae} />

              <div className="col-span-1 md:col-span-2 grid grid-cols-2 gap-4">
                <Field label="Já teve esse quadro antes?" value={data.emergency_consultation.ja_teve_quadro} />
                <Field label="Ronca / Coriza / Tosse ?" value={data.emergency_consultation.ronca_coriza_tosse} />
              </div>
              <div className="col-span-1 md:col-span-2">
                <Field label="Café, Almoço, Janta e Lanches" value={data.emergency_consultation.cafe_almoco_janta} isHtml />
              </div>
              <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="Evacuações Constipadas?" value={data.emergency_consultation.evacua_consistencia} />
                <Field label="Diureset/Sinéquia/Fimose?" value={data.emergency_consultation.diurese_sinequia_fimose} />
                <Field label="Alimentação: Mingau?" value={data.emergency_consultation.alimentacao_mingal} />
              </div>
              <Field label="Estuda?" value={data.emergency_consultation.estuda_turno} />
              <Field label="Exposição de Tela" value={data.emergency_consultation.exposicao_tela} />
              <Field label="Marca de Sabonetes/Banho" value={data.emergency_consultation.marca_produtos_banho} />
            </Section>
          )}

          {/* 6. ADOLESCENTE */}
          {hasAdolescent && (
            <Section title="Consulta Adolescente" icon={User}>
              <Field label="Acompanhantes nas Consultas" value={data.adolescent_consultation.companions} />
              <Field label="Mora Onde?" value={data.adolescent_consultation.lives_where} />
              <Field label="Naturalidade" value={data.adolescent_consultation.birthplace} />
              <Field label="Estuda (Turno e Relacionamentos)" value={data.adolescent_consultation.school_turn_consultation_reason} />
              <div className="col-span-1 md:col-span-2">
                <Field label="Motivo da Consulta" value={data.adolescent_consultation.consultation_reason} isHtml />
              </div>
              <Field label="Antecedentes dos Pais" value={data.adolescent_consultation.parents_antecedents} />
              <Field label="Histórico e Antecedentes Pessoais (Cirurgias, Traumas)" value={data.adolescent_consultation.personal_antecedents} />
              <Field label="Alergias" value={data.adolescent_consultation.allergies} />
              <Field label="Internações" value={data.adolescent_consultation.hospitalizations} />
              <Field label="Problemas de Visão ou Cefaleia" value={data.adolescent_consultation.vision_headache_problems} />
              <Field label="Sente Ansiedade ou Tristeza" value={data.adolescent_consultation.feels_anxious} />
            </Section>
          )}

          {/* 7. HISTÓRIA ALIMENTAR */}
          {hasFood && (
            <Section title="História Alimentar" icon={Book}>
              <Field label="Aleitamento Materno (Até que idade exclusivo?)" value={data.food_history.leite_materno_exclusivo} />
              <Field label="Fórmula Infantil / Qual e a diluição?" value={data.food_history.formula_infantil} />
              <div className="col-span-1 md:col-span-2">
                <Field label="Idade de Introdução Alimentar" value={data.food_history.idade_introducao_alimentar} />
              </div>
              <div className="col-span-1 md:col-span-2">
                <Field label="Dificuldades na Introdução (E Aceitação?)" value={data.food_history.dificuldade_introducao} isHtml />
              </div>
              <Field label="Mingau / Industrializados" value={data.food_history.mingau_industrializado} />
              <Field label="Alimentos Recusados" value={data.food_history.alimento_nao_aceita} />
              <Field label="Textura e Quantidade" value={data.food_history.textura_quantidade} />
              <Field label="Local das Refeições" value={data.food_history.local_comida} />
              <div className="col-span-1 md:col-span-2">
                <Field label="Recordatório: Café, Lanches, Almoço e Jantar" value={data.food_history.refeicoes_diarias} isHtml />
              </div>

              <div className="col-span-1 md:col-span-2 font-bold text-rose-500 text-xs uppercase mt-4 mb-1 border-b border-slate-200 dark:border-gray-700 pb-1">Análise de Aceitação</div>
              <div className="col-span-1 md:col-span-2 grid grid-cols-2 md:grid-cols-3 gap-4">
                <Field label="Aceitou bem a IA?" value={data.food_history.aceitou_introducao} />
                <Field label="Aceita Água?" value={data.food_history.aceita_agua} />
                <Field label="Aceita Suco?" value={data.food_history.aceita_suco} />
                <Field label="Aceita Frutas?" value={data.food_history.aceita_frutas} />
                <Field label="Aceita Sopa?" value={data.food_history.aceita_sopa} />
                <Field label="Aceita Proteínas?" value={data.food_history.aceita_proteinas} />
                <Field label="Aceita Carboidratos?" value={data.food_history.aceita_carboidratos} />
                <Field label="Aceita Legumes / Verduras?" value={data.food_history.aceita_legumes} />
                <Field label="Aceita Peixe / Ovo?" value={data.food_history.aceita_ovo_peixe} />
              </div>
            </Section>
          )}

          {/* 8. HIPÓTESE DIAGNÓSTICA */}
          {hasDiag && (
            <Section title="Hipótese Diagnóstica Adicional" icon={Clipboard}>
              <div className="col-span-1 md:col-span-2">
                <Field label="Resumo Analítico" value={data.diagnostic_hypothesis_data.observations} isHtml />
              </div>
            </Section>
          )}

          {/* 9. RETORNO */}
          {hasFollowUp && (
            <Section title="Evolução e Retorno" icon={Calendar}>
              <Field label="Foi realizado exames?" value={data.follow_up_data.fez_exames} />
              <div className="col-span-1 md:col-span-2">
                <Field label="Detalhes do Retorno" value={data.follow_up_data.retorno} isHtml />
              </div>
              <div className="col-span-1 md:col-span-2">
                <Field label="Condutas Específicas / Fechamento" value={data.follow_up_data.condutas} isHtml />
              </div>
            </Section>
          )}

          {/* 10. RESULTADOS DE EXAMES */}
          {hasResults && (
            <Section title="Análise de Resultados Laboratoriais" icon={TestTube}>
              <div className="col-span-1 md:col-span-2">
                <Field label="Observações Laboratoriais" value={data.exam_results_data.laboratory_observations} isHtml />
              </div>

              <div className="col-span-1 md:col-span-2 font-bold text-rose-500 text-xs uppercase mt-2 mb-1 border-b border-slate-200 dark:border-gray-700 pb-1">Imagens</div>
              <Field label="Ultrassom" value={data.exam_results_data.ultrasound} />
              <Field label="Raio-X (RX)" value={data.exam_results_data.xray} />

              <div className="col-span-1 md:col-span-2 font-bold text-rose-500 text-xs uppercase mt-4 mb-1 border-b border-slate-200 dark:border-gray-700 pb-1">Hemograma e Bioquímica</div>
              <Field label="Leucócitos" value={data.exam_results_data.leukocytes} />
              <Field label="Eosinófilos" value={data.exam_results_data.eosinophils} />
              <Field label="Plaquetas" value={data.exam_results_data.platelets} />
              <Field label="Ureia e Creatinina" value={data.exam_results_data.urea_creatinine} />
              <Field label="TGO / TGP" value={data.exam_results_data.tgo_tgp} />
              <Field label="Vitaminas (D, C, B12, Zinco)" value={data.exam_results_data.vitamins} />
              <Field label="Ferritina / PCR" value={data.exam_results_data.ferritin_pcr} />
              <Field label="TSH / T4 Livre" value={data.exam_results_data.tsh_t4} />
              <Field label="Glicemia / Insulina Jgj" value={data.exam_results_data.glucose_insulin} />
              <Field label="Lipidograma" value={data.exam_results_data.lipidogram} />
              <Field label="Cariótipo" value={data.exam_results_data.karyotype} />

              <div className="col-span-1 md:col-span-2 font-bold text-rose-500 text-xs uppercase mt-4 mb-1 border-b border-slate-200 dark:border-gray-700 pb-1">Urina / Fezes / Outros</div>
              <Field label="EAS / Urocultura / EPF" value={data.exam_results_data.eas_uroculture_epf} />
              <Field label="Eletrólitos (Sódio/Potássio/Cálcio)" value={data.exam_results_data.electrolytes} />
              <Field label="Tipagem Sanguínea" value={data.exam_results_data.blood_typing} />

            </Section>
          )}

          {/* 11. EXAMES E PROCEDIMENTOS */}
          <Section title="Pedidos de Exames e Procedimentos" icon={TestTube} isEmpty={exams.length === 0}>
            <div className="col-span-1 md:col-span-2 grid gap-4 grid-cols-1 md:grid-cols-2">
              {exams.map((req, i) => (
                <div key={req.id || i} className="p-4 bg-white dark:bg-[#2a2d36] border border-blue-100 dark:border-blue-900/30 rounded-xl shadow-sm relative group">
                  <div className="flex justify-between items-start mb-2 border-b border-blue-50 dark:border-blue-900/10 pb-2">
                    <p className="text-xs font-bold text-blue-600 dark:text-blue-400">
                      PEDIDO {req.request_type} - {format(parseISO(req.request_date), 'dd/MM/yyyy')}
                    </p>
                    <button
                      onClick={(e) => { e.stopPropagation(); printRequest(req, { ...patientData, doctor_name: doctorName }); }}
                      className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 p-1.5 rounded-full transition-colors"
                      title="Imprimir Pedido"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                  </div>
                  {req.clinical_indication && (
                    <div className="mb-3 bg-blue-50 dark:bg-blue-900/20 p-2 rounded text-xs text-blue-800 dark:text-blue-300 italic">
                      <strong>Indicação:</strong> {req.clinical_indication}
                    </div>
                  )}
                  <ul className="space-y-1">
                    {(req.exams || []).map((ex, j) => (
                      <li key={j} className="text-sm text-slate-700 dark:text-gray-300 flex justify-between items-center pr-2">
                        <span>{ex.code ? <span className="text-xs mr-1 bg-slate-100 dark:bg-slate-700 p-0.5 rounded font-mono text-slate-500">[{ex.code}]</span> : null}{ex.name}</span>
                        <span className="font-semibold text-slate-400">x{ex.quantity}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Section>

          {/* 12. PRESCRIÇÕES */}
          <Section title="Receituários e Prescrições" icon={Pill} isEmpty={prescriptions.length === 0}>
            <div className="col-span-1 md:col-span-2 grid gap-4 grid-cols-1 md:grid-cols-2">
              {prescriptions.map((presc, i) => (
                <div key={presc.id || i} className="p-4 bg-white dark:bg-[#2a2d36] border border-emerald-100 dark:border-emerald-900/30 rounded-xl shadow-sm relative group">
                  <div className="flex justify-between items-start mb-2 border-b border-emerald-50 dark:border-emerald-900/10 pb-2">
                    <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      RECEITUÁRIO - {presc.created_at ? format(parseISO(presc.created_at), 'dd/MM/yyyy') : 'Data Indisponível'}
                    </p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        printPrescription({
                          medications: presc.items || [],
                          exams: presc.exam_items || [],
                          vaccines: presc.vaccine_items || []
                        }, { ...patientData, doctor_name: doctorName });
                      }}
                      className="text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 p-1.5 rounded-full transition-colors"
                      title="Imprimir Receita"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                  </div>

                  {(presc.items || []).length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs text-slate-400 font-bold mb-1">MEDICAMENTOS</p>
                      <ul className="space-y-2">
                        {presc.items.map((med, j) => (
                          <li key={j} className="bg-slate-50 dark:bg-[#1e2028] p-2 rounded text-sm text-slate-700 dark:text-gray-300">
                            <div className="font-semibold">{med.name} <span className="text-slate-400 font-normal ml-1">({med.quantity} {med.unit})</span></div>
                            <div className="text-xs text-slate-500">{med.posology}</div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {(presc.vaccine_items || []).length > 0 && (
                    <div>
                      <p className="text-xs text-slate-400 font-bold mb-1 mt-3 border-t border-slate-100 dark:border-gray-700 pt-2">VACINAS</p>
                      <ul className="space-y-1">
                        {presc.vaccine_items.map((vac, j) => (
                          <li key={`vac-${j}`} className="flex justify-between items-center text-sm text-slate-700 dark:text-gray-300 bg-orange-50 dark:bg-orange-900/10 p-1.5 rounded">
                            <span>{vac.name}</span>
                            <span className="text-xs font-semibold text-orange-600 dark:text-orange-400">{vac.dose}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Section>

          {/* 13. DOCUMENTOS */}
          <Section title="Documentos e Atestados" icon={FileSignature} isEmpty={documents.length === 0}>
            <div className="col-span-1 md:col-span-2 space-y-4">
              {documents.map((doc, i) => (
                <div key={doc.id || i} className="p-4 bg-white dark:bg-[#2a2d36] border border-amber-100 dark:border-amber-900/30 rounded-xl shadow-sm relative group">
                  <div className="flex justify-between items-start mb-3 pb-2 border-b border-amber-100 dark:border-amber-900/20">
                    <p className="text-sm font-bold text-amber-700 dark:text-amber-500">
                      {doc.type}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded">
                        {format(parseISO(doc.document_date), 'dd/MM/yyyy')}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          // Injecting iframe explicitly since it requires a reference
                          let printIframe = document.getElementById('global-print-iframe') as HTMLIFrameElement;
                          if (!printIframe) {
                            printIframe = document.createElement('iframe');
                            printIframe.id = 'global-print-iframe';
                            printIframe.style.cssText = 'position:absolute;width:0;height:0;border:none;opacity:0;';
                            document.body.appendChild(printIframe);
                          }
                          // Fake ref required by printDocument 
                          const fakeRef = { current: printIframe };
                          printDocument(doc.type, doc.document_date, doc.content, fakeRef, { ...patientData, doctor_name: doctorName });
                        }}
                        className="text-amber-500 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/30 p-1.5 rounded-full transition-colors"
                        title="Imprimir Documento"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="text-sm text-slate-600 dark:text-gray-400 prose dark:prose-invert bg-slate-50 dark:bg-[#1e2028] p-3 rounded" dangerouslySetInnerHTML={{ __html: doc.content }} />
                </div>
              ))}
            </div>
          </Section>

          {/* 14. ANEXOS */}
          <Section title="Imagens e Arquivos Anexos" icon={Paperclip} isEmpty={attachments.length === 0}>
            <div className="col-span-1 md:col-span-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {attachments.map((file, i) => (
                <a
                  key={file.id || i}
                  href={file.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex flex-col items-center justify-center p-4 bg-white dark:bg-[#2a2d36] border border-slate-200 dark:border-gray-700 rounded-xl hover:border-blue-400 hover:shadow-md hover:shadow-blue-500/10 transition-all text-center h-32"
                >
                  {isImage(file.file_type) ? <ImageIcon className="w-10 h-10 text-blue-500 mb-3 group-hover:scale-110 transition-transform" /> :
                    isVideo(file.file_type) ? <Video className="w-10 h-10 text-purple-500 mb-3 group-hover:scale-110 transition-transform" /> :
                      isPdf(file.file_type) ? <FileText className="w-10 h-10 text-rose-500 mb-3 group-hover:scale-110 transition-transform" /> :
                        <File className="w-10 h-10 text-slate-400 mb-3 group-hover:scale-110 transition-transform" />}

                  <p className="text-xs font-semibold text-slate-700 dark:text-gray-300 truncate w-full px-1" title={file.file_name}>
                    {file.file_name}
                  </p>

                  <p className="text-[10px] text-slate-400 mt-1">
                    {format(parseISO(file.uploaded_at || new Date().toISOString()), 'dd/MM/yy HH:mm')}
                  </p>
                </a>
              ))}
            </div>
          </Section>

        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-gray-800 bg-white dark:bg-[#2a2d36] flex justify-end gap-3 z-10 shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.05)]">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-100 dark:bg-[#1e2028] border border-slate-200 dark:border-gray-700 text-slate-700 dark:text-gray-200 font-semibold rounded-xl hover:bg-slate-200 dark:hover:bg-gray-800 transition-all active:scale-95 shadow-sm"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
}
