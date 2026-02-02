// src/utils/automationUtils.ts
import { differenceInMonths, differenceInDays, parseISO, isValid, addDays, startOfDay, isSameDay } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { Patient } from '@/types/patient';
import { AutomationRule, MedicalCheckout } from '@/types';
import { Appointment } from '@/types/medical';

/**
 * Calcula idade em meses a partir da data de nascimento
 */
export function calculateAgeInMonths(birthDate: string | Date | undefined | null): number {
  if (!birthDate) return 0;
  
  const birth = typeof birthDate === 'string' ? parseISO(birthDate) : birthDate;
  if (!isValid(birth)) return 0;
  
  const today = new Date();
  return differenceInMonths(today, birth);
}

/**
 * Verifica se um paciente completou exatamente X meses hoje
 */
export function hasReachedMilestoneToday(birthDate: string | Date | undefined | null, targetMonths: number): boolean {
  if (!birthDate) return false;
  
  const birth = typeof birthDate === 'string' ? parseISO(birthDate) : birthDate;
  if (!isValid(birth)) return false;
  
  const today = startOfDay(new Date());
  const targetDate = new Date(birth);
  targetDate.setMonth(targetDate.getMonth() + targetMonths);
  const targetDateStart = startOfDay(targetDate);
  
  // Verifica se a data alvo é hoje
  return isSameDay(today, targetDateStart);
}

/**
 * Busca pacientes que completaram um marco de idade hoje
 */
export async function getPatientsReachingMilestone(ageMonths: number): Promise<Patient[]> {
  try {
    // Buscar pacientes que têm prontuário (medical_records)
    const { data: records, error: recordsError } = await supabase
      .from('medical_records')
      .select('patient_id')
      .not('patient_id', 'is', null);
    
    if (recordsError) {
      console.error('[automationUtils] Erro ao buscar prontuários:', recordsError);
      return [];
    }
    
    if (!records || records.length === 0) {
      return [];
    }
    
    const patientIds = [...new Set(records.map(r => r.patient_id).filter(Boolean))];
    
    // Buscar pacientes com esses IDs
    const { data: patients, error: patientsError } = await supabase
      .from('patients')
      .select('*')
      .in('id', patientIds)
      .not('birth_date', 'is', null)
      .not('phone', 'is', null);
    
    if (patientsError) {
      console.error('[automationUtils] Erro ao buscar pacientes:', patientsError);
      return [];
    }
    
    if (!patients) return [];
    
    // Filtrar pacientes que completaram o marco hoje
    const eligiblePatients = patients.filter(patient => {
      if (!patient.birth_date) return false;
      return hasReachedMilestoneToday(patient.birth_date, ageMonths);
    });
    
    return eligiblePatients as Patient[];
  } catch (error) {
    console.error('[automationUtils] Erro ao buscar pacientes:', error);
    return [];
  }
}

/**
 * Verifica se deve enviar lembrete de consulta
 * (apenas se agendamento foi feito com mais de 1 dia de antecedência)
 */
export function shouldSendAppointmentReminder(appointment: Appointment): boolean {
  if (!appointment.start_time || !appointment.created_at) {
    return false;
  }
  
  try {
    const appointmentDate = parseISO(appointment.start_time);
    const createdDate = parseISO(appointment.created_at);
    
    if (!isValid(appointmentDate) || !isValid(createdDate)) {
      return false;
    }
    
    // Verificar se a consulta é amanhã
    const tomorrow = startOfDay(addDays(new Date(), 1));
    const appointmentDay = startOfDay(appointmentDate);
    
    if (!isSameDay(tomorrow, appointmentDay)) {
      return false; // Não é amanhã
    }
    
    // Verificar se foi agendado com mais de 1 dia de antecedência
    const daysBetween = differenceInDays(appointmentDate, createdDate);
    return daysBetween >= 1;
  } catch (error) {
    console.error('[automationUtils] Erro ao verificar lembrete de consulta:', error);
    return false;
  }
}

/**
 * Busca consultas que precisam de lembrete (amanhã)
 */
export async function getAppointmentsNeedingReminder(): Promise<Appointment[]> {
  try {
    const tomorrow = startOfDay(addDays(new Date(), 1));
    const tomorrowEnd = addDays(tomorrow, 1);
    
    const { data: appointments, error } = await supabase
      .from('appointments')
      .select('*')
      .gte('start_time', tomorrow.toISOString())
      .lt('start_time', tomorrowEnd.toISOString())
      .in('status', ['scheduled', 'confirmed', 'waiting']);
    
    if (error) {
      console.error('[automationUtils] Erro ao buscar consultas:', error);
      return [];
    }
    
    if (!appointments) return [];
    
    // Filtrar apenas as que têm patient_id, telefone e devem receber lembrete
    return appointments.filter(apt => {
      return apt.patient_id && apt.patient_phone && shouldSendAppointmentReminder(apt);
    }) as Appointment[];
  } catch (error) {
    console.error('[automationUtils] Erro ao buscar consultas:', error);
    return [];
  }
}

/**
 * Verifica se deve enviar lembrete de retorno
 */
export function shouldSendReturnReminder(checkout: MedicalCheckout): boolean {
  if (!checkout.return_date) {
    return false;
  }
  
  try {
    const returnDate = parseISO(checkout.return_date);
    if (!isValid(returnDate)) {
      return false;
    }
    
    // Verificar se o retorno é amanhã
    const tomorrow = startOfDay(addDays(new Date(), 1));
    const returnDay = startOfDay(returnDate);
    
    return isSameDay(tomorrow, returnDay);
  } catch (error) {
    console.error('[automationUtils] Erro ao verificar lembrete de retorno:', error);
    return false;
  }
}

/**
 * Busca retornos que precisam de lembrete (amanhã)
 */
export async function getReturnsNeedingReminder(): Promise<MedicalCheckout[]> {
  try {
    const tomorrow = startOfDay(addDays(new Date(), 1));
    const tomorrowEnd = addDays(tomorrow, 1);
    
    const { data: checkouts, error } = await supabase
      .from('medical_checkouts')
      .select('*')
      .gte('return_date', tomorrow.toISOString().split('T')[0])
      .lt('return_date', tomorrowEnd.toISOString().split('T')[0])
      .not('patient_id', 'is', null);
    
    if (error) {
      console.error('[automationUtils] Erro ao buscar retornos:', error);
      return [];
    }
    
    if (!checkouts) return [];
    
    // Filtrar apenas os que devem receber lembrete
    return checkouts.filter(shouldSendReturnReminder) as MedicalCheckout[];
  } catch (error) {
    console.error('[automationUtils] Erro ao buscar retornos:', error);
    return [];
  }
}

/**
 * Verifica se já foi enviada automação para um paciente em um marco específico
 */
export async function hasSentMilestoneAutomation(
  automationRuleId: number,
  patientId: number,
  milestoneAge: number
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('automation_sent_history')
      .select('id')
      .eq('automation_rule_id', automationRuleId)
      .eq('patient_id', patientId)
      .eq('milestone_age', milestoneAge)
      .limit(1)
      .maybeSingle();
    
    if (error) {
      console.error('[automationUtils] Erro ao verificar histórico:', error);
      return false;
    }
    
    return !!data;
  } catch (error) {
    console.error('[automationUtils] Erro ao verificar histórico:', error);
    return false;
  }
}

/**
 * Registra envio de automação no histórico
 */
export async function recordAutomationSent(
  automationRuleId: number,
  patientId: number,
  milestoneAge?: number
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('automation_sent_history')
      .insert({
        automation_rule_id: automationRuleId,
        patient_id: patientId,
        milestone_age: milestoneAge || null,
      });
    
    if (error) {
      console.error('[automationUtils] Erro ao registrar histórico:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('[automationUtils] Erro ao registrar histórico:', error);
    return false;
  }
}

/**
 * Busca paciente completo com dados relacionados
 */
export async function getPatientWithRelations(patientId: number): Promise<Patient | null> {
  try {
    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .eq('id', patientId)
      .maybeSingle();
    
    if (error) {
      console.error('[automationUtils] Erro ao buscar paciente:', error);
      return null;
    }
    
    return data as Patient | null;
  } catch (error) {
    console.error('[automationUtils] Erro ao buscar paciente:', error);
    return null;
  }
}
