// src/utils/appointmentSafety.ts
// Funções utilitárias para garantir segurança e integridade dos atendimentos

import { createClient } from '@/lib/supabase/client';
const supabase = createClient();
import { getTodayDateString, getLocalDateRange, addDaysToDate } from './dateUtils';

export interface AppointmentHealthCheck {
  orphanedCount: number;
  longRunningCount: number;
  orphanedAppointments: any[];
  longRunningAppointments: any[];
  issues: string[];
}

/**
 * Verifica a saúde dos atendimentos no sistema
 * Retorna informações sobre atendimentos órfãos e de longa duração
 */
export async function checkAppointmentHealth(): Promise<AppointmentHealthCheck> {
  const today = getTodayDateString();
  const { startOfDay: todayStart } = getLocalDateRange(today);
  const issues: string[] = [];

  // Buscar atendimentos órfãos (in_service de dias anteriores)
  const { data: orphaned, error: orphanedError } = await supabase
    .from('appointments')
    .select('*')
    .eq('status', 'in_service')
    .lt('start_time', todayStart)
    .order('start_time', { ascending: false });

  if (orphanedError) {
    issues.push(`Erro ao buscar atendimentos órfãos: ${orphanedError.message}`);
  }

  // Buscar atendimentos de longa duração (>4 horas)
  const fourHoursAgo = new Date();
  fourHoursAgo.setHours(fourHoursAgo.getHours() - 4);
  const fourHoursAgoISO = fourHoursAgo.toISOString();

  const { data: longRunning, error: longRunningError } = await supabase
    .from('appointments')
    .select('*')
    .eq('status', 'in_service')
    .lt('start_time', fourHoursAgoISO)
    .order('start_time', { ascending: false });

  if (longRunningError) {
    issues.push(`Erro ao buscar atendimentos de longa duração: ${longRunningError.message}`);
  }

  const orphanedAppointments = (orphaned || []);
  const longRunningAppointments = (longRunning || []).filter(apt => {
    // Filtrar apenas os que são do dia atual (não são órfãos)
    const aptDate = new Date(apt.start_time);
    const todayDate = new Date(todayStart);
    return aptDate >= todayDate;
  });

  if (orphanedAppointments.length > 0) {
    issues.push(`${orphanedAppointments.length} atendimento(s) órfão(s) encontrado(s)`);
  }

  if (longRunningAppointments.length > 0) {
    issues.push(`${longRunningAppointments.length} atendimento(s) com mais de 4 horas em andamento`);
  }

  return {
    orphanedCount: orphanedAppointments.length,
    longRunningCount: longRunningAppointments.length,
    orphanedAppointments: orphanedAppointments,
    longRunningAppointments: longRunningAppointments,
    issues
  };
}

/**
 * Finaliza automaticamente atendimentos órfãos muito antigos (>24 horas)
 * Retorna o número de atendimentos finalizados
 */
export async function finalizeOrphanedAppointments(olderThanHours: number = 24): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setHours(cutoffDate.getHours() - olderThanHours);
  const cutoffISO = cutoffDate.toISOString();

  // Buscar atendimentos órfãos muito antigos
  const { data: veryOld, error: fetchError } = await supabase
    .from('appointments')
    .select('*')
    .eq('status', 'in_service')
    .lt('start_time', cutoffISO)
    .order('start_time', { ascending: false });

  if (fetchError) {
    console.error('Erro ao buscar atendimentos órfãos antigos:', fetchError);
    throw fetchError;
  }

  if (!veryOld || veryOld.length === 0) {
    return 0;
  }

  // Finalizar todos os atendimentos encontrados
  const appointmentIds = veryOld.map(apt => apt.id);
  
  const { data, error: updateError } = await supabase
    .from('appointments')
    .update({ status: 'finished', finished_at: new Date().toISOString() })
    .in('id', appointmentIds)
    .select();

  if (updateError) {
    console.error('Erro ao finalizar atendimentos órfãos:', updateError);
    throw updateError;
  }

  console.log(`[appointmentSafety] ${data?.length || 0} atendimento(s) órfão(s) finalizado(s) automaticamente`);
  
  return data?.length || 0;
}

/**
 * Verifica se há múltiplos pacientes em atendimento simultaneamente
 * Retorna lista de appointments em in_service
 */
export async function checkMultipleInService(): Promise<any[]> {
  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .eq('status', 'in_service')
    .order('start_time', { ascending: true });

  if (error) {
    console.error('Erro ao verificar atendimentos simultâneos:', error);
    return [];
  }

  return data || [];
}

/**
 * Calcula o tempo decorrido desde que um appointment entrou em atendimento
 * Retorna string formatada (ex: "2h 30min" ou "1 dia e 5h")
 */
export function calculateTimeInService(startTime: string): string {
  const start = new Date(startTime);
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (diffHours > 24) {
    const days = Math.floor(diffHours / 24);
    return `${days} dia${days > 1 ? 's' : ''} e ${diffHours % 24}h`;
  }
  
  if (diffHours > 0) {
    return `${diffHours}h ${diffMinutes}min`;
  }
  
  return `${diffMinutes}min`;
}

/**
 * Verifica se um atendimento está há muito tempo em andamento
 * Retorna true se > thresholdHours
 */
export function isLongRunningAppointment(startTime: string, thresholdHours: number = 4): boolean {
  const start = new Date(startTime);
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  
  return diffHours > thresholdHours;
}
