import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
const supabase = createClient();

export interface RoutineConsultationData {
  caregivers_name?: string | null;
  companion_location?: string | null;
  support_network?: string | null;
  school_info?: string | null;
  siblings_info?: string | null;
  allergies_interactions?: string | null;
  consultation_reason?: string | null;
  breathing_info?: string | null;
  medications?: string | null;
  breastfeeding_formula?: string | null;
  vaccines_up_to_date?: 'sim' | 'não' | null;
  delayed_vaccine?: string | null;
  uses_pacifier?: string | null;
  nose_wash?: string | null;
  skin_products?: string | null;
  dental_info?: string | null;
  gastrointestinal?: string | null;
  genitourinary?: string | null;
  nervous_system?: string | null;
  screen_exposure?: string | null;
  sleep_info?: string | null;
  monthly_milestones?: 'sim' | 'não' | null;
  exam_results?: string | null;
  print_development_guide?: 'sim' | 'não' | null;
}

export interface AdolescentConsultationData {
  companions?: string | null;                    // ACOMPANHANTES
  lives_where?: string | null;                  // MORA ONDE
  birthplace?: string | null;                   // NATURALIDADE
  school_turn_consultation_reason?: string | null; // ESCOLA/TURNO/MOTIVO CONSULTA?
  parents_antecedents?: string | null;          // ANTECEDENTES DOS PAIS
  personal_antecedents?: string | null;         // ANTECEDENTES PESSOAIS
  allergies?: string | null;                    // ALERGIAS ?
  hospitalizations?: string | null;             // INTERNAÇÕES
  vision_headache_problems?: string | null;      // PROBLEMAS DE VISTA? CEFALEIA?
  consultation_reason?: string | null;           // MOTIVO DE CONSULTA? (rich text)
  feels_anxious?: 'sim' | 'não' | null;          // SE SENTE ANSIOSO
}

export interface ExamResultsData {
  ultrasound?: string | null;                    // ULTRASSOM
  xray?: string | null;                          // RAIO X
  laboratory_observations?: string | null;       // LABORATORIAS/ OBSERVAÇÕES (rich text)
  leukocytes?: string | null;                    // LEUCOCITOS
  eosinophils?: string | null;                   // EOSINOFILOS
  platelets?: string | null;                     // PLAQUETAS
  urea_creatinine?: string | null;                // UREIA/ CREATININA
  tgo_tgp?: string | null;                       // TGO/TGP
  vitamins?: string | null;                      // VITD, VITC, VIT B12 E ZINCO
  ferritin_pcr?: string | null;                  // FERRITINA/ PCR ULTRASSENSIVEL
  tsh_t4?: string | null;                        // TSH E T4 TOTAL
  eas_uroculture_epf?: string | null;            // EAS/ UROCULTURA / EPF
  blood_typing?: string | null;                  // TIPAGEM SANGUINEA
  electrolytes?: string | null;                  // SODIO/ POTASSIO/ CALCIO
  glucose_insulin?: string | null;               // GLICEMIA JEJUM/ HB GLICADA/ INSULINA
  lipidogram?: string | null;                    // LIPIDOGRAMA
  karyotype?: string | null;                     // CARIOTIPO
}

export interface DiagnosticHypothesisData {
  observations?: string | null;                  // OBSERVAÇÕES (rich text)
}

export interface EmergencyConsultationData {
  acompanhantes?: string | null;
  alergias?: string | null;
  internacoes?: string | null;
  antecedentes_mae?: string | null;
  antecedentes_pai?: string | null;
  estuda_turno?: string | null;
  medicacoes_em_uso?: string | null;        // rich text
  motivo_consulta?: string | null;          // rich text
  ja_teve_quadro?: 'sim' | 'não' | null;
  ronca_coriza_tosse?: 'sim' | 'não' | null;
  alimentacao_mingal?: 'sim' | 'não' | null;
  cafe_almoco_janta?: string | null;        // rich text
  marca_produtos_banho?: string | null;
  evacua_consistencia?: string | null;
  diurese_sinequia_fimose?: 'sim' | 'não' | null;
  exposicao_tela?: string | null;
}

export interface FollowUpData {
  retorno?: string | null;      // rich text
  fez_exames?: 'sim' | 'não' | null;
  condutas?: string | null;     // rich text
}

export interface FirstConsultationAnamnesisData {
  // Seção 1: Informações Pessoais
  acompanhantes?: string | null;
  mora_onde?: string | null;
  profissoes_pais?: string | null;
  escola_serie_turno?: string | null;
  como_conheceu?: string | null;
  indicacao_de_quem?: string | null;
  naturalidade?: string | null;
  rede_apoio_baba?: string | null;
  antecedentes?: string | null;
  alergias?: string | null;
  historico_molestia_atual?: string | null;         // rich text
  // Seção 2: Antecedentes
  internacoes?: string | null;
  antecedentes_dos_pais?: string | null;            // rich text
  tem_irmaos?: string[] | null;                     // checkboxes: ['1','2','3']
  nome_irmaos?: string | null;
  medicamentos_em_uso?: string[] | null;            // checkboxes: vitamina_d, ferro, polivitaminico, redoxon
  motivo_consulta?: string | null;                  // rich text
  rede_apoio_opcoes?: string[] | null;              // checkboxes: avos_maternos, avos_paternos, baba, outros
  baby_blues?: string | null;
  entregar_escala_edimburgo?: string | null;
  // Seção 3: Mãe e Alimentação
  mae_sentindo_fraca?: string | null;
  suplementacao_mae?: string | null;
  historico_alimentar_ame_formula?: string | null;
  dar_agua?: 'sim' | 'não' | null;
  dar_cha?: 'sim' | 'não' | null;
  formula_detalhes?: string | null;
  amamentacao?: string | null;                      // rich text
  // Seção 4: Adaptação e Sintomas do RN
  adaptacao_nenem?: 'sim' | 'não' | null;
  solucos?: 'sim' | 'não' | null;
  colicas?: 'sim' | 'não' | null;
  gorfo?: 'sim' | 'não' | null;
  posicao_arrotar?: 'sim' | 'não' | null;
  posicao_bb_dormir?: 'sim' | 'não' | null;
  tem_dado_colo?: 'sim' | 'não' | null;
  faz_banho_sol?: 'sim' | 'não' | null;
  medicacao_em_uso_bebe?: string | null;
  vacinas_em_dia?: 'sim' | 'não' | null;
  usa_chupeta?: 'sim' | 'não' | null;
  // Seção 5: Higiene e Cuidados
  limpa_boca_apos_mamadas?: string | null;
  olho_secrecao?: string | null;
  limpa_ouvido?: string | null;
  limpeza_coto_umbilical?: string[] | null;         // checkboxes: alcool_70, agua_sabao
  coto_umbilical_dias?: string[] | null;            // checkboxes: <10dias, >10dias
  banho_rn_frequencia?: string | null;              // dropdown
  usa_perfume?: 'sim' | 'não' | null;
  usa_talco?: 'sim' | 'não' | null;
  corte_unha?: string[] | null;                     // checkboxes: redondo, quadrado
  evacuacoes_cor_disquesia?: string | null;
  troca_fraldas_material?: string[] | null;         // checkboxes: lenco_umedecido, agua_morna
  qual_marca_fralda?: string | null;
  usa_travesseiro?: 'sim' | 'não' | null;
  // Seção 6: Sono e Desenvolvimento
  sonecas_dorme_aonde?: string | null;
  sono_noite?: string | null;
  dnpm_observa_rosto?: string | null;
  pedir_usg_quadril?: 'sim' | 'não' | null;
  fontanela?: 'sim' | 'não' | null;
  crosta_lactea?: string | null;
  // Seção 7: Orientações Finais
  que_sabao?: string | null;
  mostrar_visao_bebe?: string | null;
  ler_para_bebe?: string | null;
  vacinas_2_meses?: string | null;
  entregar_farmacinha?: 'sim' | 'não' | null;
  sempre_marcar_retorno?: string | null;
}

export interface FoodHistoryData {
  // Campos de texto
  leite_materno_exclusivo?: string | null;       // LEITE MATERNO / ATÉ QUE IDADE EXCLUSIVO?
  formula_infantil?: string | null;              // FÓRMULA INFANTIL / QUAL / COMO DILUIU?
  idade_introducao_alimentar?: string | null;    // INTRODUÇÃO ALIMENTAR / QUE IDADE?
  dificuldade_introducao?: string | null;        // QUAL MAIOR DIFICULDADE / INTRODUÇÃO ALIMENTAR? (rich text)
  mingau_industrializado?: string | null;        // MINGAL INDUSTRIALIZADOS?
  refeicoes_diarias?: string | null;             // CAFÉ, ALMOÇO, LANCHE E JANTA? (rich text)
  alimento_nao_aceita?: string | null;           // ALGUM ALIMENTO QUE NÃO ACEITA?
  textura_quantidade?: string | null;            // TEXTURA DA COMIDA, QUANTIDADE?
  local_comida?: string | null;                  // LOCAL DA COMIDA?
  // Campos radio (Sim/Não)
  aceitou_introducao?: 'sim' | 'não' | null;    // ACEITAÇÃO INTRODUÇÃO ALIMENTAR?
  aceita_suco?: 'sim' | 'não' | null;           // SUCO?
  aceita_sopa?: 'sim' | 'não' | null;           // SOPA?
  aceita_agua?: 'sim' | 'não' | null;           // ACEITA ÁGUA?
  aceita_frutas?: 'sim' | 'não' | null;         // ACEITA FRUTAS?
  aceita_legumes?: 'sim' | 'não' | null;        // ACEITA LEGUMES E VERDURAS?
  aceita_proteinas?: 'sim' | 'não' | null;      // ACEITAS PROTEÍNAS, CARNES?
  aceita_carboidratos?: 'sim' | 'não' | null;   // ACEITA ARROZ, MACARRÃO, FEIJÃO?
  aceita_ovo_peixe?: 'sim' | 'não' | null;      // ACEITA OVO E PEIXE?
}

export interface MedicalRecordData {
  id?: number;
  appointment_id?: number | null;
  patient_id: number;
  doctor_id?: number | null;
  chief_complaint?: string | null;
  hda?: string | null;
  antecedents?: string | null;
  physical_exam?: string | null;
  diagnosis?: string | null;
  conducts?: string | null;
  vitals?: {
    weight?: number;
    height?: number;
    imc?: number;
    pe?: number;
  };
  prescription?: any[];
  routine_consultation?: RoutineConsultationData | null;
  adolescent_consultation?: AdolescentConsultationData | null;
  exam_results_data?: ExamResultsData | null;
  diagnostic_hypothesis_data?: DiagnosticHypothesisData | null;
  food_history?: FoodHistoryData | null;
  first_consultation_anamnesis?: FirstConsultationAnamnesisData | null;
  follow_up_data?: FollowUpData | null;
  emergency_consultation?: EmergencyConsultationData | null;
  started_at?: string | null;
  finished_at?: string | null;
  status?: 'draft' | 'signed';
  created_at?: string;
}

export function useMedicalRecord(patientId: number, appointmentId?: number | null, currentDoctorId?: number | null) {
  const [record, setRecord] = useState<MedicalRecordData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (patientId) {
      loadRecord();
    }
  }, [patientId, appointmentId]);

  async function loadRecord() {
    setIsLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('medical_records')
        .select('*')
        .eq('patient_id', patientId)
        .eq('status', 'draft')
        .order('created_at', { ascending: false })
        .limit(1);

      if (appointmentId) {
        query = query.eq('appointment_id', appointmentId);
      }

      const { data, error: fetchError } = await query.single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      if (data) {
        // Parse vitals se for string
        if (data.vitals && typeof data.vitals === 'string') {
          data.vitals = JSON.parse(data.vitals);
        }
        // Parse routine_consultation se for string
        if (data.routine_consultation && typeof data.routine_consultation === 'string') {
          data.routine_consultation = JSON.parse(data.routine_consultation);
        }
        // Parse adolescent_consultation se for string
        if (data.adolescent_consultation && typeof data.adolescent_consultation === 'string') {
          data.adolescent_consultation = JSON.parse(data.adolescent_consultation);
        }
        // Parse exam_results_data se for string
        if (data.exam_results_data && typeof data.exam_results_data === 'string') {
          data.exam_results_data = JSON.parse(data.exam_results_data);
        }
        // Parse diagnostic_hypothesis_data se for string
        if (data.diagnostic_hypothesis_data && typeof data.diagnostic_hypothesis_data === 'string') {
          data.diagnostic_hypothesis_data = JSON.parse(data.diagnostic_hypothesis_data);
        }
        // Parse food_history se for string
        if (data.food_history && typeof data.food_history === 'string') {
          data.food_history = JSON.parse(data.food_history);
        }
        // Parse first_consultation_anamnesis se for string
        if (data.first_consultation_anamnesis && typeof data.first_consultation_anamnesis === 'string') {
          data.first_consultation_anamnesis = JSON.parse(data.first_consultation_anamnesis);
        }
        // Parse follow_up_data se for string
        if (data.follow_up_data && typeof data.follow_up_data === 'string') {
          data.follow_up_data = JSON.parse(data.follow_up_data);
        }
        // Parse emergency_consultation se for string
        if (data.emergency_consultation && typeof data.emergency_consultation === 'string') {
          data.emergency_consultation = JSON.parse(data.emergency_consultation);
        }
        setRecord(data);
      } else {
        // Criar novo registro rascunho se não existir
        const newRecord: MedicalRecordData = {
          patient_id: patientId,
          appointment_id: appointmentId || null,
          doctor_id: currentDoctorId || null,
          status: 'draft',
          vitals: {},
        };
        setRecord(newRecord);
      }
    } catch (err: any) {
      console.error('Erro ao carregar prontuário:', err);
      setError(err.message || 'Erro ao carregar prontuário');
    } finally {
      setIsLoading(false);
    }
  }

  async function saveRecord(recordData: Partial<MedicalRecordData>) {
    try {
      if (!record?.id) {
        // Criar novo registro
        const { data, error: createError } = await supabase
          .from('medical_records')
          .insert({
            ...recordData,
            patient_id: patientId,
            appointment_id: appointmentId || null,
            doctor_id: currentDoctorId || null,
            status: 'draft',
          })
          .select()
          .single();

        if (createError) throw createError;
        setRecord(data);
        return data;
      } else {
        // Atualizar registro existente
        const { data, error: updateError } = await supabase
          .from('medical_records')
          .update(recordData)
          .eq('id', record.id)
          .select()
          .single();

        if (updateError) throw updateError;
        setRecord(data);
        return data;
      }
    } catch (err: any) {
      console.error('Erro ao salvar prontuário:', err);
      throw err;
    }
  }

  async function finishRecord() {
    if (!record?.id) {
      throw new Error('Nenhum registro para finalizar');
    }

    try {
      const { data, error: updateError } = await supabase
        .from('medical_records')
        .update({
          status: 'signed',
          finished_at: new Date().toISOString(),
        })
        .eq('id', record.id)
        .select()
        .single();

      if (updateError) throw updateError;
      setRecord(data);
      return data;
    } catch (err: any) {
      console.error('Erro ao finalizar prontuário:', err);
      throw err;
    }
  }

  /**
   * Inicia oficialmente o cronometro de atendimento.
   * Regra: started_at so pode ser gravado no clique "Iniciar Atendimento".
   */
  async function startConsultationTimer() {
    try {
      if (record?.id) {
        if (record.started_at) return record;
        const now = new Date().toISOString();
        const { data, error: updateError } = await supabase
          .from('medical_records')
          .update({ started_at: now })
          .eq('id', record.id)
          .select()
          .single();
        if (updateError) throw updateError;
        setRecord(data);
        return data;
      }

      const now = new Date().toISOString();
      const { data, error: createError } = await supabase
        .from('medical_records')
        .insert({
          patient_id: patientId,
          appointment_id: appointmentId || null,
          doctor_id: currentDoctorId || null,
          status: 'draft',
          started_at: now,
        })
        .select()
        .single();

      if (createError) throw createError;
      setRecord(data);
      return data;
    } catch (err: any) {
      console.error('Erro ao iniciar cronometro do atendimento:', err);
      throw err;
    }
  }

  // Função para salvar todos os dados de uma vez (usado antes de finalizar)
  async function saveAllData() {
    try {
      // Esta função será chamada antes de finalizar para garantir que todos os dados estão salvos
      // Os dados já devem estar no record através dos saves individuais de cada tela
      // Esta função apenas garante que o registro existe e está atualizado
      if (!record?.id) {
        // Se não existe registro, criar um básico
        const { data, error: createError } = await supabase
          .from('medical_records')
          .insert({
            patient_id: patientId,
            appointment_id: appointmentId || null,
            doctor_id: currentDoctorId || null,
            status: 'draft',
          })
          .select()
          .single();

        if (createError) throw createError;
        setRecord(data);
        return true;
      }
      return true;
    } catch (err: any) {
      console.error('Erro ao salvar todos os dados:', err);
      return false;
    }
  }

  return {
    record,
    isLoading,
    error,
    saveRecord,
    finishRecord,
    startConsultationTimer,
    saveAllData,
    reload: loadRecord,
  };
}
