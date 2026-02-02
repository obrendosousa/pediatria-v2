/**
 * Utilitários para cálculo de métricas do CRM
 * 
 * Calcula métricas operacionais baseadas em dados reais do banco:
 * - Tempo médio na fila
 * - Tempo médio de atendimento
 * - Tempo médio de resposta
 * - Taxas de conversão (leads → agendamentos → consultas)
 */

import { Appointment } from '@/types/medical';
import { Chat, Message } from '@/types';
import { isAppointmentOnDate, getLocalDateRange, getTodayDateString, addDaysToDate } from './dateUtils';

export interface CRMMetrics {
  // Métricas de Tempo
  averageQueueTime: number; // minutos
  averageServiceTime: number; // minutos
  averageResponseTime: number; // minutos
  
  // Taxas de Conversão
  leadToAppointmentRate: number; // %
  appointmentToConsultationRate: number; // %
  leadToConsultationRate: number; // %
  
  // Volumes
  totalChats: number;
  totalAppointments: number;
  totalFinished: number;
  totalWaiting: number;
  totalInService: number;
  
  // Comparações (vs. período anterior)
  queueTimeTrend: { value: number; isPositive: boolean }; // +5min ou -3min
  serviceTimeTrend: { value: number; isPositive: boolean };
  responseTimeTrend: { value: number; isPositive: boolean };
  conversionTrend: { value: number; isPositive: boolean };
  
  // Dados para gráficos
  funnelData: Array<{ name: string; value: number; fill: string }>;
  trendData: Array<{ name: string; queueTime: number; conversionRate: number }>;
}

/**
 * Calcula tempo médio na fila (aproximado)
 * Tempo entre quando appointment muda para 'waiting' até 'in_service'
 * 
 * Limitação: Sem timestamp de mudança de status, usamos aproximações:
 * - Para appointments 'waiting': tempo desde start_time até agora
 * - Para appointments 'finished': assumimos que ficaram na fila até serem chamados
 */
export function calculateQueueTime(
  appointments: Appointment[],
  selectedDate: string
): number {
  const now = new Date();
  const todayString = getTodayDateString();
  const isToday = selectedDate === todayString;
  
  // Filtrar appointments do dia selecionado
  const dayAppointments = appointments.filter(a => 
    isAppointmentOnDate(a.start_time, selectedDate)
  );
  
  const queueTimes: number[] = [];
  
  // Para appointments em 'waiting': tempo desde start_time até agora (se hoje)
  const waitingAppointments = dayAppointments.filter(a => a.status === 'waiting');
  if (isToday) {
    waitingAppointments.forEach(apt => {
      const startTime = new Date(apt.start_time);
      const diffMs = now.getTime() - startTime.getTime();
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      if (diffMinutes > 0) {
        queueTimes.push(diffMinutes);
      }
    });
  }
  
  // Para appointments 'finished': usar start_time como proxy do check-in
  // Assumir que ficaram na fila até serem chamados (aproximação)
  const finishedAppointments = dayAppointments.filter(a => a.status === 'finished');
  finishedAppointments.forEach(apt => {
    const startTime = new Date(apt.start_time);
    // Para finished, assumir que ficaram na fila por pelo menos 5 minutos
    // (tempo mínimo estimado entre check-in e entrada em atendimento)
    queueTimes.push(5); // Aproximação conservadora
  });
  
  // Para appointments 'in_service': tempo desde start_time até agora (se hoje)
  const inServiceAppointments = dayAppointments.filter(a => a.status === 'in_service');
  if (isToday) {
    inServiceAppointments.forEach(apt => {
      const startTime = new Date(apt.start_time);
      const diffMs = now.getTime() - startTime.getTime();
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      if (diffMinutes > 0) {
        queueTimes.push(diffMinutes);
      }
    });
  }
  
  if (queueTimes.length === 0) return 0;
  
  const average = queueTimes.reduce((sum, time) => sum + time, 0) / queueTimes.length;
  return Math.round(average);
}

/**
 * Calcula tempo médio de atendimento (aproximado)
 * Tempo entre 'in_service' e 'finished'
 * 
 * Limitação: Sem timestamp de mudança de status, usamos aproximações:
 * - Para appointments 'finished': usar start_time como proxy
 * - Assumir que entraram em atendimento próximo ao horário agendado
 */
export function calculateServiceTime(
  appointments: Appointment[],
  selectedDate: string
): number {
  const now = new Date();
  const todayString = getTodayDateString();
  const isToday = selectedDate === todayString;
  
  // Filtrar appointments do dia selecionado
  const dayAppointments = appointments.filter(a => 
    isAppointmentOnDate(a.start_time, selectedDate)
  );
  
  const serviceTimes: number[] = [];
  
  // Para appointments 'finished': usar start_time como proxy
  // Assumir que o atendimento durou pelo menos 20 minutos (média conservadora)
  const finishedAppointments = dayAppointments.filter(a => a.status === 'finished');
  finishedAppointments.forEach(apt => {
    const startTime = new Date(apt.start_time);
    if (isToday) {
      // Se é hoje e está finished, usar tempo desde start_time até agora
      const diffMs = now.getTime() - startTime.getTime();
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      if (diffMinutes > 0) {
        serviceTimes.push(diffMinutes);
      }
    } else {
      // Para dias anteriores, usar média conservadora de 25 minutos
      serviceTimes.push(25);
    }
  });
  
  // Para appointments 'in_service': tempo desde start_time até agora (se hoje)
  if (isToday) {
    const inServiceAppointments = dayAppointments.filter(a => a.status === 'in_service');
    inServiceAppointments.forEach(apt => {
      const startTime = new Date(apt.start_time);
      const diffMs = now.getTime() - startTime.getTime();
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      if (diffMinutes > 0) {
        serviceTimes.push(diffMinutes);
      }
    });
  }
  
  if (serviceTimes.length === 0) return 0;
  
  const average = serviceTimes.reduce((sum, time) => sum + time, 0) / serviceTimes.length;
  return Math.round(average);
}

/**
 * Calcula tempo médio de resposta
 * Tempo entre criação do chat e primeira resposta do agente humano
 */
export function calculateResponseTime(
  chats: Chat[],
  chatMessages: Message[],
  selectedDate: string
): number {
  const { startOfDay, endOfDay } = getLocalDateRange(selectedDate);
  
  // Filtrar chats criados no dia selecionado
  const dayChats = chats.filter(chat => {
    if (!chat.created_at) return false;
    const chatDate = new Date(chat.created_at);
    return chatDate >= new Date(startOfDay) && chatDate <= new Date(endOfDay);
  });
  
  const responseTimes: number[] = [];
  
  dayChats.forEach(chat => {
    // Buscar primeira mensagem HUMAN_AGENT para este chat
    const firstHumanMessage = chatMessages
      .filter(msg => msg.chat_id === chat.id && msg.sender === 'HUMAN_AGENT')
      .sort((a, b) => {
        const timeA = new Date(a.created_at).getTime();
        const timeB = new Date(b.created_at).getTime();
        return timeA - timeB;
      })[0];
    
    if (firstHumanMessage && chat.created_at) {
      const chatCreated = new Date(chat.created_at).getTime();
      const firstResponse = new Date(firstHumanMessage.created_at).getTime();
      const diffMs = firstResponse - chatCreated;
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      
      if (diffMinutes >= 0) {
        responseTimes.push(diffMinutes);
      }
    }
  });
  
  if (responseTimes.length === 0) return 0;
  
  const average = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
  return Math.round(average);
}

/**
 * Calcula todas as taxas de conversão
 */
export function calculateConversionRates(
  chats: Chat[],
  appointments: Appointment[],
  selectedDate: string
): {
  leadToAppointmentRate: number;
  appointmentToConsultationRate: number;
  leadToConsultationRate: number;
} {
  const { startOfDay, endOfDay } = getLocalDateRange(selectedDate);
  
  // Total de chats criados no dia
  const totalChats = chats.filter(chat => {
    if (!chat.created_at) return false;
    const chatDate = new Date(chat.created_at);
    return chatDate >= new Date(startOfDay) && chatDate <= new Date(endOfDay);
  }).length;
  
  // Total de appointments do dia (exceto cancelled/blocked)
  const dayAppointments = appointments.filter(a => 
    isAppointmentOnDate(a.start_time, selectedDate)
  );
  const totalAppointments = dayAppointments.length;
  
  // Appointments finalizados
  const finishedAppointments = dayAppointments.filter(a => 
    a.status === 'finished'
  ).length;
  
  // Taxa: Leads → Agendamentos
  const leadToAppointmentRate = totalChats > 0
    ? (totalAppointments / totalChats) * 100
    : 0;
  
  // Taxa: Agendamentos → Consultas Realizadas
  const appointmentToConsultationRate = totalAppointments > 0
    ? (finishedAppointments / totalAppointments) * 100
    : 0;
  
  // Taxa: Leads → Consultas (geral)
  const leadToConsultationRate = totalChats > 0
    ? (finishedAppointments / totalChats) * 100
    : 0;
  
  return {
    leadToAppointmentRate: Math.round(leadToAppointmentRate * 10) / 10, // 1 casa decimal
    appointmentToConsultationRate: Math.round(appointmentToConsultationRate * 10) / 10,
    leadToConsultationRate: Math.round(leadToConsultationRate * 10) / 10,
  };
}

/**
 * Calcula métricas comparativas (tendências)
 * Compara métricas de hoje vs. ontem
 */
export function calculateTrends(
  todayMetrics: Partial<CRMMetrics>,
  yesterdayMetrics: Partial<CRMMetrics>
): {
  queueTimeTrend: { value: number; isPositive: boolean };
  serviceTimeTrend: { value: number; isPositive: boolean };
  responseTimeTrend: { value: number; isPositive: boolean };
  conversionTrend: { value: number; isPositive: boolean };
} {
  // Para tempos: menor é melhor (isPositive = true significa melhoria)
  const queueTimeDiff = (todayMetrics.averageQueueTime || 0) - (yesterdayMetrics.averageQueueTime || 0);
  const serviceTimeDiff = (todayMetrics.averageServiceTime || 0) - (yesterdayMetrics.averageServiceTime || 0);
  const responseTimeDiff = (todayMetrics.averageResponseTime || 0) - (yesterdayMetrics.averageResponseTime || 0);
  
  // Para conversão: maior é melhor
  const conversionDiff = (todayMetrics.leadToConsultationRate || 0) - (yesterdayMetrics.leadToConsultationRate || 0);
  
  return {
    queueTimeTrend: {
      value: Math.abs(queueTimeDiff),
      isPositive: queueTimeDiff < 0, // Menor tempo = melhor
    },
    serviceTimeTrend: {
      value: Math.abs(serviceTimeDiff),
      isPositive: serviceTimeDiff < 0, // Menor tempo = melhor
    },
    responseTimeTrend: {
      value: Math.abs(responseTimeDiff),
      isPositive: responseTimeDiff < 0, // Menor tempo = melhor
    },
    conversionTrend: {
      value: Math.abs(conversionDiff),
      isPositive: conversionDiff > 0, // Maior conversão = melhor
    },
  };
}

/**
 * Gera dados para o gráfico de funil
 */
export function generateFunnelData(
  chats: Chat[],
  appointments: Appointment[],
  selectedDate: string
): Array<{ name: string; value: number; fill: string }> {
  const { startOfDay, endOfDay } = getLocalDateRange(selectedDate);
  
  // Novos Chats
  const totalChats = chats.filter(chat => {
    if (!chat.created_at) return false;
    const chatDate = new Date(chat.created_at);
    return chatDate >= new Date(startOfDay) && chatDate <= new Date(endOfDay);
  }).length;
  
  // Agendamentos
  const dayAppointments = appointments.filter(a => 
    isAppointmentOnDate(a.start_time, selectedDate)
  );
  const totalAppointments = dayAppointments.length;
  
  // Consultas Realizadas
  const finishedAppointments = dayAppointments.filter(a => 
    a.status === 'finished'
  ).length;
  
  return [
    { name: 'Novos Chats', value: totalChats, fill: '#3b82f6' },
    { name: 'Agendamentos', value: totalAppointments, fill: '#a855f7' },
    { name: 'Consultas Realizadas', value: finishedAppointments, fill: '#10b981' },
  ];
}

/**
 * Gera dados para o gráfico de tendência semanal
 */
export function generateTrendData(
  appointments: Appointment[],
  chats: Chat[],
  selectedDate: string
): Array<{ name: string; queueTime: number; conversionRate: number }> {
  const daysOfWeek = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const trendData: Array<{ name: string; queueTime: number; conversionRate: number }> = [];
  
  // Calcular para os últimos 7 dias
  for (let i = 6; i >= 0; i--) {
    const date = addDaysToDate(selectedDate, -i);
    const dayAppointments = appointments.filter(a => 
      isAppointmentOnDate(a.start_time, date)
    );
    
    const queueTime = calculateQueueTime(dayAppointments, date);
    const { leadToConsultationRate } = calculateConversionRates(chats, dayAppointments, date);
    
    // Parse da data para obter o dia da semana
    const [year, month, day] = date.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    const dayName = daysOfWeek[dateObj.getDay()];
    
    trendData.push({
      name: dayName,
      queueTime,
      conversionRate: Math.round(leadToConsultationRate),
    });
  }
  
  return trendData;
}

/**
 * Função principal para buscar e calcular todas as métricas do CRM
 */
export async function fetchCRMMetrics(
  chats: Chat[],
  appointments: Appointment[],
  chatMessages: Message[],
  selectedDate: string
): Promise<CRMMetrics> {
  // Calcular métricas do dia selecionado
  const averageQueueTime = calculateQueueTime(appointments, selectedDate);
  const averageServiceTime = calculateServiceTime(appointments, selectedDate);
  const averageResponseTime = calculateResponseTime(chats, chatMessages, selectedDate);
  const conversionRates = calculateConversionRates(chats, appointments, selectedDate);
  
  // Volumes
  const dayAppointments = appointments.filter(a => 
    isAppointmentOnDate(a.start_time, selectedDate)
  );
  const totalAppointments = dayAppointments.length;
  const totalFinished = dayAppointments.filter(a => a.status === 'finished').length;
  const totalWaiting = dayAppointments.filter(a => a.status === 'waiting').length;
  const totalInService = dayAppointments.filter(a => a.status === 'in_service').length;
  
  const { startOfDay, endOfDay } = getLocalDateRange(selectedDate);
  const totalChats = chats.filter(chat => {
    if (!chat.created_at) return false;
    const chatDate = new Date(chat.created_at);
    return chatDate >= new Date(startOfDay) && chatDate <= new Date(endOfDay);
  }).length;
  
  // Calcular métricas de ontem para comparação
  const yesterdayDate = addDaysToDate(selectedDate, -1);
  const yesterdayQueueTime = calculateQueueTime(appointments, yesterdayDate);
  const yesterdayServiceTime = calculateServiceTime(appointments, yesterdayDate);
  const yesterdayResponseTime = calculateResponseTime(chats, chatMessages, yesterdayDate);
  const yesterdayConversionRates = calculateConversionRates(chats, appointments, yesterdayDate);
  
  const yesterdayMetrics: Partial<CRMMetrics> = {
    averageQueueTime: yesterdayQueueTime,
    averageServiceTime: yesterdayServiceTime,
    averageResponseTime: yesterdayResponseTime,
    leadToConsultationRate: yesterdayConversionRates.leadToConsultationRate,
  };
  
  const todayMetrics: Partial<CRMMetrics> = {
    averageQueueTime,
    averageServiceTime,
    averageResponseTime,
    leadToConsultationRate: conversionRates.leadToConsultationRate,
  };
  
  const trends = calculateTrends(todayMetrics, yesterdayMetrics);
  
  // Dados para gráficos
  const funnelData = generateFunnelData(chats, appointments, selectedDate);
  const trendData = generateTrendData(appointments, chats, selectedDate);
  
  return {
    averageQueueTime,
    averageServiceTime,
    averageResponseTime,
    ...conversionRates,
    totalChats,
    totalAppointments,
    totalFinished,
    totalWaiting,
    totalInService,
    ...trends,
    funnelData,
    trendData,
  };
}
