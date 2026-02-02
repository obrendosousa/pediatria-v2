/**
 * Utilitários para cálculo de métricas do Dashboard
 * 
 * Calcula métricas de gestão baseadas em dados reais do banco:
 * - Taxa de comparecimento
 * - Taxa de cancelamento
 * - Tempo médio de atendimento
 * - Taxa de conversão
 * - Eficiência de agendamento
 */

import { Appointment } from '@/types/medical';
import { Chat } from '@/types';
import { supabase } from '@/lib/supabase';

export interface DashboardMetrics {
  // Métricas Principais
  totalPatients: number;
  totalConsultations: number;
  attendanceRate: number; // %
  averageServiceTime: number; // minutos
  
  // Métricas Operacionais
  conversionRate: number; // %
  averageQueueTime: number; // minutos
  cancellationRate: number; // %
  schedulingEfficiency: number; // %
  
  // Demografia (mantém estrutura existente)
  demographics: {
    total: number;
    male: { count: number; percentage: number };
    female: { count: number; percentage: number };
    new: { count: number; percentage: number };
    recurring: { count: number; percentage: number };
    ageDistribution: Record<string, number>;
  };
  
  // Procedimentos
  procedures: {
    total: number;
    consultations: { count: number; percentage: number };
    returns: { count: number; percentage: number };
  };
  
  // Timeline
  timeline: {
    appointmentsByDate: Record<string, number>;
    attendanceRateByDate: Record<string, number>;
    newPatientsByDate: Record<string, number>;
  };
}

/**
 * Calcula taxa de comparecimento
 * (finished / scheduled) * 100
 */
export function calculateAttendanceRate(appointments: Appointment[]): number {
  const totalScheduled = appointments.filter(a => 
    a.status !== 'blocked' && a.status !== 'cancelled'
  ).length;
  
  const totalFinished = appointments.filter(a => 
    a.status === 'finished'
  ).length;
  
  if (totalScheduled === 0) return 0;
  
  return Math.round((totalFinished / totalScheduled) * 100);
}

/**
 * Calcula taxa de cancelamento
 * (cancelled / total) * 100
 */
export function calculateCancellationRate(appointments: Appointment[]): number {
  const total = appointments.length;
  const cancelled = appointments.filter(a => 
    a.status === 'cancelled'
  ).length;
  
  if (total === 0) return 0;
  
  return Math.round((cancelled / total) * 100);
}

/**
 * Calcula tempo médio de atendimento baseado em medical_records
 * Usa started_at e finished_at quando disponível
 */
export async function calculateAverageServiceTime(period: number): Promise<number> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - period);
  const startDateISO = startDate.toISOString();
  
  const { data: medicalRecords } = await supabase
    .from('medical_records')
    .select('started_at, finished_at')
    .gte('created_at', startDateISO)
    .not('started_at', 'is', null)
    .not('finished_at', 'is', null);
  
  if (!medicalRecords || medicalRecords.length === 0) return 0;
  
  const durations = medicalRecords
    .filter(r => r.started_at && r.finished_at)
    .map(r => {
      const start = new Date(r.started_at!).getTime();
      const finish = new Date(r.finished_at!).getTime();
      return (finish - start) / (1000 * 60); // minutos
    });
  
  if (durations.length === 0) return 0;
  
  const average = durations.reduce((sum, time) => sum + time, 0) / durations.length;
  return Math.round(average);
}

/**
 * Calcula tempo médio na fila (aproximado)
 * Similar ao CRM, mas para período específico
 */
export function calculateAverageQueueTime(appointments: Appointment[]): number {
  const now = new Date();
  const queueTimes: number[] = [];
  
  // Para appointments finished: usar aproximação conservadora
  const finishedAppointments = appointments.filter(a => a.status === 'finished');
  finishedAppointments.forEach(() => {
    queueTimes.push(5); // Aproximação: 5 minutos na fila
  });
  
  // Para appointments in_service: tempo desde start_time
  const inServiceAppointments = appointments.filter(a => a.status === 'in_service');
  inServiceAppointments.forEach(apt => {
    const startTime = new Date(apt.start_time);
    const diffMs = now.getTime() - startTime.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    if (diffMinutes > 0) {
      queueTimes.push(diffMinutes);
    }
  });
  
  if (queueTimes.length === 0) return 0;
  
  const average = queueTimes.reduce((sum, time) => sum + time, 0) / queueTimes.length;
  return Math.round(average);
}

/**
 * Calcula taxa de conversão (Leads → Consultas)
 * Precisa de chats e appointments
 */
export function calculateConversionRate(
  chats: Chat[],
  appointments: Appointment[],
  period: number
): number {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - period);
  const startDateISO = startDate.toISOString();
  
  // Total de chats criados no período
  const totalChats = chats.filter(chat => {
    if (!chat.created_at) return false;
    return new Date(chat.created_at) >= startDate;
  }).length;
  
  // Total de consultas finalizadas no período
  const finishedAppointments = appointments.filter(a => 
    a.status === 'finished' && 
    new Date(a.start_time) >= startDate
  ).length;
  
  if (totalChats === 0) return 0;
  
  return Math.round((finishedAppointments / totalChats) * 100);
}

/**
 * Calcula eficiência de agendamento
 * (consultas realizadas / agendamentos criados) * 100
 */
export function calculateSchedulingEfficiency(appointments: Appointment[]): number {
  const totalCreated = appointments.length;
  const totalFinished = appointments.filter(a => 
    a.status === 'finished'
  ).length;
  
  if (totalCreated === 0) return 0;
  
  return Math.round((totalFinished / totalCreated) * 100);
}

/**
 * Calcula total de pacientes únicos no período
 */
export async function calculateTotalPatients(period: number): Promise<number> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - period);
  const startDateISO = startDate.toISOString();
  
  const { data: patients } = await supabase
    .from('patients')
    .select('id')
    .gte('created_at', startDateISO);
  
  return patients?.length || 0;
}

/**
 * Gera dados de timeline com taxa de comparecimento
 */
export function generateTimelineData(
  appointments: Appointment[],
  patients: any[]
): {
  appointmentsByDate: Record<string, number>;
  attendanceRateByDate: Record<string, number>;
  newPatientsByDate: Record<string, number>;
} {
  const appointmentsByDate: Record<string, number> = {};
  const attendanceRateByDate: Record<string, number> = {};
  const newPatientsByDate: Record<string, number> = {};
  
  // Agrupar appointments por data
  appointments.forEach(apt => {
    const date = new Date(apt.start_time).toLocaleDateString('pt-BR');
    appointmentsByDate[date] = (appointmentsByDate[date] || 0) + 1;
    
    // Calcular taxa de comparecimento por data
    if (!attendanceRateByDate[date]) {
      const dayAppointments = appointments.filter(a => {
        const aptDate = new Date(a.start_time).toLocaleDateString('pt-BR');
        return aptDate === date;
      });
      const scheduled = dayAppointments.filter(a => 
        a.status !== 'blocked' && a.status !== 'cancelled'
      ).length;
      const finished = dayAppointments.filter(a => 
        a.status === 'finished'
      ).length;
      attendanceRateByDate[date] = scheduled > 0 
        ? Math.round((finished / scheduled) * 100) 
        : 0;
    }
  });
  
  // Agrupar novos pacientes por data
  patients.forEach(patient => {
    if (patient.created_at) {
      const date = new Date(patient.created_at).toLocaleDateString('pt-BR');
      newPatientsByDate[date] = (newPatientsByDate[date] || 0) + 1;
    }
  });
  
  return {
    appointmentsByDate,
    attendanceRateByDate,
    newPatientsByDate,
  };
}

/**
 * Função principal para buscar e calcular todas as métricas do Dashboard
 */
export async function fetchDashboardMetrics(period: number): Promise<DashboardMetrics> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - period);
  const startDateISO = startDate.toISOString();
  
  // Buscar dados do banco
  const [appointmentsResult, patientsResult, chatsResult, medicalRecordsResult] = await Promise.all([
    supabase
      .from('appointments')
      .select('*')
      .gte('start_time', startDateISO)
      .order('start_time', { ascending: false }),
    supabase
      .from('patients')
      .select('id, name, birth_date, created_at, biological_sex')
      .gte('created_at', startDateISO),
    supabase
      .from('chats')
      .select('*')
      .neq('status', 'DELETED')
      .order('created_at', { ascending: false }),
    supabase
      .from('medical_records')
      .select('*')
      .gte('created_at', startDateISO),
  ]);
  
  const appointments = (appointmentsResult.data || []) as Appointment[];
  const patients = patientsResult.data || [];
  const chats = (chatsResult.data || []) as Chat[];
  const medicalRecords = medicalRecordsResult.data || [];
  
  // Calcular métricas principais
  const totalPatients = await calculateTotalPatients(period);
  const totalConsultations = appointments.filter(a => a.status === 'finished').length;
  const attendanceRate = calculateAttendanceRate(appointments);
  const averageServiceTime = await calculateAverageServiceTime(period);
  
  // Calcular métricas operacionais
  const conversionRate = calculateConversionRate(chats, appointments, period);
  const averageQueueTime = calculateAverageQueueTime(appointments);
  const cancellationRate = calculateCancellationRate(appointments);
  const schedulingEfficiency = calculateSchedulingEfficiency(appointments);
  
  // Calcular demografia
  const totalPatientsCount = patients.length;
  const maleCount = patients.filter(p => 
    p.biological_sex === 'M' || p.biological_sex === 'MALE'
  ).length;
  const femaleCount = patients.filter(p => 
    p.biological_sex === 'F' || p.biological_sex === 'FEMALE'
  ).length;
  
  const newPatients = patients.filter(p => {
    const createdAt = new Date(p.created_at);
    return createdAt >= startDate;
  }).length;
  const recurringPatients = totalPatientsCount - newPatients;
  
  // Distribuição etária
  const ageGroups: Record<string, number> = {};
  patients.forEach(p => {
    if (p.birth_date) {
      const birth = new Date(p.birth_date);
      const age = Math.floor((new Date().getTime() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      const group = Math.floor(age / 4) * 4; // Grupos de 4 anos
      ageGroups[group] = (ageGroups[group] || 0) + 1;
    }
  });
  
  // Procedimentos
  const consultations = medicalRecords.filter(r => 
    !r.diagnosis || !r.diagnosis.toLowerCase().includes('retorno')
  ).length;
  const returns = medicalRecords.filter(r => 
    r.diagnosis?.toLowerCase().includes('retorno')
  ).length;
  const totalProcedures = medicalRecords.length;
  
  // Timeline
  const timeline = generateTimelineData(appointments, patients);
  
  return {
    totalPatients,
    totalConsultations,
    attendanceRate,
    averageServiceTime,
    conversionRate,
    averageQueueTime,
    cancellationRate,
    schedulingEfficiency,
    demographics: {
      total: totalPatientsCount,
      male: { 
        count: maleCount, 
        percentage: totalPatientsCount > 0 ? Math.round((maleCount / totalPatientsCount) * 100) : 0 
      },
      female: { 
        count: femaleCount, 
        percentage: totalPatientsCount > 0 ? Math.round((femaleCount / totalPatientsCount) * 100) : 0 
      },
      new: { 
        count: newPatients, 
        percentage: totalPatientsCount > 0 ? Math.round((newPatients / totalPatientsCount) * 100) : 0 
      },
      recurring: { 
        count: recurringPatients, 
        percentage: totalPatientsCount > 0 ? Math.round((recurringPatients / totalPatientsCount) * 100) : 0 
      },
      ageDistribution: ageGroups,
    },
    procedures: {
      total: totalProcedures,
      consultations: { 
        count: consultations, 
        percentage: totalProcedures > 0 ? Math.round((consultations / totalProcedures) * 100) : 0 
      },
      returns: { 
        count: returns, 
        percentage: totalProcedures > 0 ? Math.round((returns / totalProcedures) * 100) : 0 
      },
    },
    timeline,
  };
}
