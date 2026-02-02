// src/utils/patientRelations.ts
// Utilitários para gerenciar relacionamentos entre pacientes, telefones, appointments e chats

import { supabase } from '@/lib/supabase';
import { cleanPhone } from './formatUtils';
import { Appointment } from '@/types/medical';

export interface PatientPhone {
  id: number;
  patient_id: number;
  phone: string;
  phone_formatted: string;
  is_primary: boolean;
  is_active: boolean;
  source: string;
  created_at: string;
  updated_at: string;
}

/**
 * Busca paciente por telefone usando a tabela patient_phones
 */
export async function findPatientByPhone(phone: string): Promise<number | null> {
  if (!phone) return null;
  
  try {
    const clean = cleanPhone(phone);
    
    const { data, error } = await supabase
      .from('patient_phones')
      .select('patient_id')
      .eq('phone', clean)
      .eq('is_active', true)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (error) {
      console.error('Erro ao buscar paciente por telefone:', error);
      return null;
    }
    
    return data?.patient_id || null;
  } catch (error) {
    console.error('Erro ao buscar paciente por telefone:', error);
    return null;
  }
}

/**
 * Busca todos os números de um paciente
 */
export async function getPatientPhones(patientId: number): Promise<PatientPhone[]> {
  try {
    const { data, error } = await supabase
      .from('patient_phones')
      .select('*')
      .eq('patient_id', patientId)
      .eq('is_active', true)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Erro ao buscar números do paciente:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Erro ao buscar números do paciente:', error);
    return [];
  }
}

/**
 * Adiciona um número a um paciente
 */
export async function addPhoneToPatient(
  patientId: number,
  phone: string,
  source: string = 'manual',
  isPrimary: boolean = false
): Promise<number | null> {
  try {
    const clean = cleanPhone(phone);
    
    if (!clean || clean.length < 10) {
      throw new Error('Telefone inválido');
    }
    
    // Se for principal, desmarcar outros como principais
    if (isPrimary) {
      await supabase
        .from('patient_phones')
        .update({ is_primary: false })
        .eq('patient_id', patientId);
    }
    
    const { data, error } = await supabase
      .rpc('add_phone_to_patient', {
        p_patient_id: patientId,
        p_phone: phone,
        p_source: source,
        p_is_primary: isPrimary
      })
      .single();
    
    if (error) {
      console.error('Erro ao adicionar número ao paciente:', error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Erro ao adicionar número ao paciente:', error);
    return null;
  }
}

/**
 * Remove um número de um paciente (marca como inativo)
 */
export async function removePhoneFromPatient(
  patientId: number,
  phone: string
): Promise<boolean> {
  try {
    const clean = cleanPhone(phone);
    
    const { error } = await supabase
      .rpc('remove_phone_from_patient', {
        p_patient_id: patientId,
        p_phone: phone
      });
    
    if (error) {
      console.error('Erro ao remover número do paciente:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Erro ao remover número do paciente:', error);
    return false;
  }
}

/**
 * Define um número como principal
 */
export async function setPrimaryPhone(
  patientId: number,
  phoneId: number
): Promise<boolean> {
  try {
    // Desmarcar todos como principais
    await supabase
      .from('patient_phones')
      .update({ is_primary: false })
      .eq('patient_id', patientId);
    
    // Marcar o selecionado como principal
    const { error } = await supabase
      .from('patient_phones')
      .update({ is_primary: true })
      .eq('id', phoneId)
      .eq('patient_id', patientId);
    
    if (error) {
      console.error('Erro ao definir número principal:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Erro ao definir número principal:', error);
    return false;
  }
}

/**
 * Vincula um appointment a um paciente
 */
export async function linkAppointmentToPatient(
  appointmentId: number,
  patientId: number
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('appointments')
      .update({ patient_id: patientId })
      .eq('id', appointmentId);
    
    if (error) {
      console.error('Erro ao vincular appointment ao paciente:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Erro ao vincular appointment ao paciente:', error);
    return false;
  }
}

/**
 * Vincula um chat a um paciente
 */
export async function linkChatToPatient(
  chatId: number,
  patientId: number
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('chats')
      .update({ patient_id: patientId })
      .eq('id', chatId);
    
    if (error) {
      console.error('Erro ao vincular chat ao paciente:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Erro ao vincular chat ao paciente:', error);
    return false;
  }
}

/**
 * Cria um paciente básico a partir das informações de um appointment
 * Usa dados mínimos disponíveis no appointment para criar o cadastro inicial
 * 
 * @param appointment Appointment com informações do paciente
 * @returns ID do paciente criado ou null em caso de erro
 */
export async function createBasicPatientFromAppointment(
  appointment: Appointment
): Promise<number | null> {
  try {
    // Validar que temos pelo menos o nome do paciente
    if (!appointment.patient_name || !appointment.patient_name.trim()) {
      console.error('Não é possível criar paciente sem nome');
      return null;
    }

    // Preparar dados básicos do paciente
    // Usar data de nascimento padrão (2000-01-01) que pode ser editada depois
    const patientPayload: any = {
      name: appointment.patient_name.trim(),
      birth_date: '2000-01-01', // Data padrão, será editada depois
      phone: appointment.patient_phone ? cleanPhone(appointment.patient_phone) : null,
      biological_sex: appointment.patient_sex || 'F', // Padrão feminino se não especificado
      active: true,
      receive_sms_alerts: true,
      nationality: 'Brasileira',
      use_social_name: false,
      is_deceased: false,
      // Campos opcionais deixados como null
      cpf: null,
      rg: null,
      email: null,
      address_zip: null,
      address_street: null,
      address_number: null,
      address_complement: null,
      address_neighborhood: null,
      address_city: null,
      address_state: null,
      naturality_city: null,
      ethnicity: null,
      marital_status: null,
      profession: null,
      how_found_us: 'Agendamento'
    };

    // Adicionar parent_name como familiar se disponível
    if (appointment.parent_name && appointment.parent_name.trim()) {
      patientPayload.family_members = [{
        name: appointment.parent_name.trim(),
        relationship: 'Responsável',
        phone: null
      }];
    }

    // Inserir paciente no banco
    const { data: newPatient, error: patientError } = await supabase
      .from('patients')
      .insert(patientPayload)
      .select()
      .single();

    if (patientError) {
      console.error('Erro ao criar paciente básico:', patientError);
      return null;
    }

    if (!newPatient || !newPatient.id) {
      console.error('Paciente criado mas sem ID retornado');
      return null;
    }

    // Se o paciente tem telefone, o trigger do banco já deve ter adicionado à patient_phones
    // Mas vamos garantir que está vinculado corretamente
    if (appointment.patient_phone) {
      const clean = cleanPhone(appointment.patient_phone);
      // Verificar se já foi adicionado pelo trigger
      const { data: existingPhone } = await supabase
        .from('patient_phones')
        .select('id')
        .eq('patient_id', newPatient.id)
        .eq('phone', clean)
        .maybeSingle();

      // Se não existe, adicionar manualmente
      if (!existingPhone) {
        await supabase
          .from('patient_phones')
          .insert({
            patient_id: newPatient.id,
            phone: clean,
            phone_formatted: appointment.patient_phone,
            is_primary: true,
            is_active: true,
            source: 'appointment_creation'
          });
      }
    }

    return newPatient.id;
  } catch (error) {
    console.error('Erro ao criar paciente básico a partir de appointment:', error);
    return null;
  }
}

/**
 * Busca appointments de um paciente
 */
export async function getPatientAppointments(patientId: number): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('patient_id', patientId)
      .order('start_time', { ascending: false });
    
    if (error) {
      console.error('Erro ao buscar appointments do paciente:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Erro ao buscar appointments do paciente:', error);
    return [];
  }
}

/**
 * Busca chats de um paciente
 */
export async function getPatientChats(patientId: number): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('chats')
      .select('*')
      .eq('patient_id', patientId)
      .order('last_interaction_at', { ascending: false });
    
    if (error) {
      console.error('Erro ao buscar chats do paciente:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Erro ao buscar chats do paciente:', error);
    return [];
  }
}

/**
 * Busca ou cria vínculo por telefone usando função RPC
 */
export async function linkPatientByPhone(
  phone: string,
  patientId?: number
): Promise<number | null> {
  try {
    const { data, error } = await supabase
      .rpc('link_patient_by_phone', {
        p_phone: phone,
        p_patient_id: patientId || null
      })
      .single();
    
    if (error) {
      console.error('Erro ao vincular paciente por telefone:', error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Erro ao vincular paciente por telefone:', error);
    return null;
  }
}
