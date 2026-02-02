'use client';

import { Appointment } from '@/types/medical';
import ReceptionColumn from './ReceptionColumn';

interface ReceptionFlowColumnsProps {
  selectedDate: string;
  appointments: Appointment[];
  onCallAppointment?: (appointment: Appointment) => void;
  onCheckIn?: (appointment: Appointment) => void;
  onConfirmArrival?: (appointment: Appointment) => void;
  onEnter?: (appointment: Appointment) => void;
  onFinish?: (appointment: Appointment) => void;
  onRevert?: (appointment: Appointment, newStatus: string) => void;
  isUpdating?: number | null;
}

export default function ReceptionFlowColumns({
  selectedDate,
  appointments,
  onCallAppointment,
  onCheckIn,
  onConfirmArrival,
  onEnter,
  onFinish,
  onRevert,
  isUpdating
}: ReceptionFlowColumnsProps) {

  // Filtrar appointments por status relevante (incluindo finished)
  const relevantAppointments = appointments.filter(a => 
    ['scheduled', 'called', 'waiting', 'in_service', 'finished'].includes(a.status || '')
  );

  // Separar appointments por status
  const scheduled = relevantAppointments.filter(a => a.status === 'scheduled');
  const called = relevantAppointments.filter(a => a.status === 'called');
  const waiting = relevantAppointments.filter(a => a.status === 'waiting').sort((a, b) => {
    // Ordenar por ordem de chegada (timestamp de quando mudou para waiting)
    const aTime = new Date(a.start_time).getTime();
    const bTime = new Date(b.start_time).getTime();
    return aTime - bTime;
  });
  const inService = relevantAppointments.filter(a => a.status === 'in_service');
  const finished = relevantAppointments.filter(a => a.status === 'finished').sort((a, b) => {
    // Ordenar por horário de início (mais recentes primeiro)
    const aTime = new Date(a.start_time).getTime();
    const bTime = new Date(b.start_time).getTime();
    return bTime - aTime;
  });

  const handleRevert = (appointment: Appointment, newStatus: string) => {
    if (onRevert) {
      onRevert(appointment, newStatus);
    }
  };

  return (
    <div className="flex-1 flex gap-3 overflow-x-auto overflow-y-hidden custom-scrollbar pb-2">
      {/* Coluna: AGENDADOS */}
      <ReceptionColumn
        title="Agendados"
        status="scheduled"
        appointments={scheduled}
        color={{
          border: 'border-blue-200 dark:border-blue-800',
          bg: 'bg-blue-100 dark:bg-blue-900/30',
          text: 'text-blue-700 dark:text-blue-300',
          headerBg: 'bg-blue-50/50 dark:bg-blue-900/10'
        }}
        onCall={onCallAppointment}
        onCheckIn={onCheckIn}
        isUpdating={isUpdating}
      />

      {/* Coluna: CHAMADOS */}
      <ReceptionColumn
        title="Chamados"
        status="called"
        appointments={called}
        color={{
          border: 'border-amber-200 dark:border-amber-800',
          bg: 'bg-amber-100 dark:bg-amber-900/30',
          text: 'text-amber-700 dark:text-amber-300',
          headerBg: 'bg-amber-50/50 dark:bg-amber-900/10'
        }}
        onConfirmArrival={onConfirmArrival}
        onRevert={(apt) => handleRevert(apt, 'scheduled')}
        isUpdating={isUpdating}
      />

      {/* Coluna: NA FILA */}
      <ReceptionColumn
        title="Na Fila"
        status="waiting"
        appointments={waiting}
        color={{
          border: 'border-green-200 dark:border-green-800',
          bg: 'bg-green-100 dark:bg-green-900/30',
          text: 'text-green-700 dark:text-green-300',
          headerBg: 'bg-green-50/50 dark:bg-green-900/10'
        }}
        onEnter={onEnter}
        onRevert={(apt) => handleRevert(apt, 'scheduled')}
        isUpdating={isUpdating}
      />

      {/* Coluna: EM ATENDIMENTO */}
      <ReceptionColumn
        title="Em Atendimento"
        status="in_service"
        appointments={inService}
        color={{
          border: 'border-emerald-200 dark:border-emerald-800',
          bg: 'bg-emerald-100 dark:bg-emerald-900/30',
          text: 'text-emerald-700 dark:text-emerald-300',
          headerBg: 'bg-emerald-50/50 dark:bg-emerald-900/10'
        }}
        onFinish={onFinish}
        onRevert={(apt) => handleRevert(apt, 'waiting')}
        isUpdating={isUpdating}
      />

      {/* Coluna: CONCLUÍDOS */}
      <ReceptionColumn
        title="Concluídos"
        status="finished"
        appointments={finished}
        color={{
          border: 'border-slate-200 dark:border-slate-700',
          bg: 'bg-slate-100 dark:bg-slate-800/30',
          text: 'text-slate-700 dark:text-slate-300',
          headerBg: 'bg-slate-50/50 dark:bg-slate-800/10'
        }}
        isUpdating={isUpdating}
      />
    </div>
  );
}
