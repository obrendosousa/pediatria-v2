/**
 * Versão server-side das funções de automação.
 * Usa supabaseAdmin (service role) em vez do browser client.
 */
import { differenceInMonths, differenceInDays, parseISO, isValid, addDays, startOfDay, isSameDay } from 'date-fns';
import { getSupabaseAdminClient } from '@/lib/automation/adapters/supabaseAdmin';
import type { Patient } from '@/types/patient';
import type { Appointment } from '@/types/medical';
import type { MedicalCheckout } from '@/types';
import type { SupabaseClient } from '@supabase/supabase-js';

function getAdmin(): SupabaseClient {
  return getSupabaseAdminClient();
}

export function calculateAgeInMonths(birthDate: string | Date | undefined | null): number {
  if (!birthDate) return 0;
  const birth = typeof birthDate === 'string' ? parseISO(birthDate) : birthDate;
  if (!isValid(birth)) return 0;
  return differenceInMonths(new Date(), birth);
}

export function hasReachedMilestoneToday(birthDate: string | Date | undefined | null, targetMonths: number): boolean {
  if (!birthDate) return false;
  const birth = typeof birthDate === 'string' ? parseISO(birthDate) : birthDate;
  if (!isValid(birth)) return false;

  const today = startOfDay(new Date());
  const targetDate = new Date(birth);
  targetDate.setMonth(targetDate.getMonth() + targetMonths);
  return isSameDay(today, startOfDay(targetDate));
}

export async function getPatientsReachingMilestone(ageMonths: number): Promise<Patient[]> {
  const supabase = getAdmin();
  try {
    const { data: records, error: recordsError } = await supabase
      .from('medical_records')
      .select('patient_id')
      .not('patient_id', 'is', null);

    if (recordsError) {
      console.error('[automationUtilsServer] Erro ao buscar prontuários:', recordsError);
      return [];
    }
    if (!records || records.length === 0) return [];

    const patientIds = [...new Set(
      (records as Array<{ patient_id: number | null }>)
        .map(r => r.patient_id)
        .filter((id): id is number => id !== null)
    )];

    const { data: patients, error: patientsError } = await supabase
      .from('patients')
      .select('*')
      .in('id', patientIds)
      .not('birth_date', 'is', null)
      .not('phone', 'is', null);

    if (patientsError) {
      console.error('[automationUtilsServer] Erro ao buscar pacientes:', patientsError);
      return [];
    }
    if (!patients) return [];

    return (patients as unknown as Patient[]).filter(patient => {
      if (!patient.birth_date) return false;
      return hasReachedMilestoneToday(patient.birth_date, ageMonths);
    });
  } catch (error) {
    console.error('[automationUtilsServer] Erro ao buscar pacientes:', error);
    return [];
  }
}

export async function getAppointmentsNeedingReminder(): Promise<Appointment[]> {
  const supabase = getAdmin();
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
      console.error('[automationUtilsServer] Erro ao buscar consultas:', error);
      return [];
    }
    if (!appointments) return [];

    return (appointments as unknown as Appointment[]).filter(apt => {
      if (!apt.patient_id || !apt.patient_phone) return false;
      if (!apt.start_time || !apt.created_at) return false;
      const appointmentDate = parseISO(apt.start_time);
      const createdDate = parseISO(apt.created_at);
      if (!isValid(appointmentDate) || !isValid(createdDate)) return false;
      const tomorrowCheck = startOfDay(addDays(new Date(), 1));
      if (!isSameDay(tomorrowCheck, startOfDay(appointmentDate))) return false;
      return differenceInDays(appointmentDate, createdDate) >= 1;
    });
  } catch (error) {
    console.error('[automationUtilsServer] Erro ao buscar consultas:', error);
    return [];
  }
}

export async function getReturnsNeedingReminder(): Promise<MedicalCheckout[]> {
  const supabase = getAdmin();
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
      console.error('[automationUtilsServer] Erro ao buscar retornos:', error);
      return [];
    }
    if (!checkouts) return [];

    return (checkouts as unknown as MedicalCheckout[]).filter(checkout => {
      if (!checkout.return_date) return false;
      const returnDate = parseISO(checkout.return_date);
      if (!isValid(returnDate)) return false;
      const tomorrowCheck = startOfDay(addDays(new Date(), 1));
      return isSameDay(tomorrowCheck, startOfDay(returnDate));
    });
  } catch (error) {
    console.error('[automationUtilsServer] Erro ao buscar retornos:', error);
    return [];
  }
}

export async function hasSentMilestoneAutomation(
  automationRuleId: number,
  patientId: number,
  milestoneAge: number
): Promise<boolean> {
  const supabase = getAdmin();
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
      console.error('[automationUtilsServer] Erro ao verificar histórico:', error);
      return false;
    }
    return !!data;
  } catch (error) {
    console.error('[automationUtilsServer] Erro ao verificar histórico:', error);
    return false;
  }
}

export async function recordAutomationSent(
  automationRuleId: number,
  patientId: number,
  milestoneAge?: number
): Promise<boolean> {
  const supabase = getAdmin();
  try {
    const { error } = await supabase
      .from('automation_sent_history')
      .insert({
        automation_rule_id: automationRuleId,
        patient_id: patientId,
        milestone_age: milestoneAge || null,
      });

    if (error) {
      console.error('[automationUtilsServer] Erro ao registrar histórico:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('[automationUtilsServer] Erro ao registrar histórico:', error);
    return false;
  }
}

export async function getPatientWithRelations(patientId: number): Promise<Patient | null> {
  const supabase = getAdmin();
  try {
    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .eq('id', patientId)
      .maybeSingle();

    if (error) {
      console.error('[automationUtilsServer] Erro ao buscar paciente:', error);
      return null;
    }
    return data as Patient | null;
  } catch (error) {
    console.error('[automationUtilsServer] Erro ao buscar paciente:', error);
    return null;
  }
}
