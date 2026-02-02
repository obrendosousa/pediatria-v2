import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

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

export interface PhysicalExamData {
  general_exam?: string | null; // Rich Text - EXAME FÍSICO GERAL
  otoscopy?: string | null; // Input Simples - OTOSCOPIA
  mouth_throat_exam?: string | null; // Input Simples - EXAME BOCA E GARGANTA
  skin_mucosa_exam?: string | null; // Rich Text - EXAME DE PELE, MUCOSAS E ANEXOS
  head_neck_exam?: string | null; // Input Simples - EXAME CABEÇA E PESCOÇO
  respiratory_exam?: string | null; // Input Simples - EXAME APARELHO RESPIRATÓRIO
  abdomen_exam?: string | null; // Rich Text - EXAME DO ABDÔMEN
  nervous_system_exam?: string | null; // Rich Text - EXAME SISTEMA NERVOSO
  genitals_exam?: string | null; // Rich Text - EXAME DOS GENITAIS
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
  physical_exam_data?: PhysicalExamData | null;
  adolescent_consultation?: AdolescentConsultationData | null;
  exam_results_data?: ExamResultsData | null;
  diagnostic_hypothesis_data?: DiagnosticHypothesisData | null;
  started_at?: string | null;
  finished_at?: string | null;
  status?: 'draft' | 'signed';
  created_at?: string;
}

export function useMedicalRecord(patientId: number, appointmentId?: number | null) {
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
        // Parse physical_exam_data se for string
        if (data.physical_exam_data && typeof data.physical_exam_data === 'string') {
          data.physical_exam_data = JSON.parse(data.physical_exam_data);
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
        setRecord(data);
      } else {
        // Criar novo registro rascunho se não existir
        const newRecord: MedicalRecordData = {
          patient_id: patientId,
          appointment_id: appointmentId || null,
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
            status: 'draft',
            started_at: new Date().toISOString(),
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
            status: 'draft',
            started_at: new Date().toISOString(),
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
    saveAllData,
    reload: loadRecord,
  };
}
