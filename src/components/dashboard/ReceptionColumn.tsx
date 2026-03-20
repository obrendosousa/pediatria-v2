'use client';

import { Appointment } from '@/types/medical';
import ReceptionCard, { TicketInfo } from './ReceptionCard';
import { Users } from 'lucide-react';

interface ReceptionColumnProps {
  title: string;
  status: 'scheduled' | 'called' | 'waiting' | 'in_service' | 'waiting_payment' | 'finished';
  appointments: Appointment[];
  color: {
    border: string;
    bg: string;
    text: string;
    headerBg: string;
  };
  onCall?: (appointment: Appointment) => void;
  onCheckIn?: (appointment: Appointment) => void;
  onConfirmArrival?: (appointment: Appointment) => void;
  onEnter?: (appointment: Appointment) => void;
  onFinish?: (appointment: Appointment) => void;
  onRevert?: (appointment: Appointment) => void;
  onEditAppointment?: (appointment: Appointment) => void;
  onGenerateTicket?: (appointment: Appointment, isPriority: boolean) => void;
  onCallWithDestination?: (appointment: Appointment) => void;
  onFinishGuiche?: (appointment: Appointment) => void;
  buttonLabel?: string;
  isUpdating?: number | null;
  callingAppointmentId?: number | null;
  selectedAppointmentId?: number | null;
  onSelectAppointment?: (appointment: Appointment) => void;
  /** Mapa de ticket info por appointment_id */
  ticketMap?: Map<number, TicketInfo>;
  /** Contexto de coluna para acoes customizadas */
  columnContext?: 'guiche' | 'doctor' | null;
}

export default function ReceptionColumn({
  title,
  status,
  appointments,
  color,
  onCall,
  onCheckIn,
  onConfirmArrival,
  onEnter,
  onFinish,
  onRevert,
  onEditAppointment,
  onGenerateTicket,
  onCallWithDestination,
  onFinishGuiche,
  buttonLabel,
  isUpdating,
  callingAppointmentId,
  selectedAppointmentId,
  onSelectAppointment,
  ticketMap,
  columnContext,
}: ReceptionColumnProps) {
  const isSelectMode = selectedAppointmentId !== undefined && onSelectAppointment != null;
  return (
    <div className={`flex flex-col overflow-hidden transition-colors bg-white dark:bg-[#0e0e12] rounded-xl border border-slate-200 dark:border-[#2d2d36] shadow-sm ${isSelectMode ? 'min-w-0' : 'flex-1 min-w-[180px]'}`}>
      {/* Header */}
      <div className={`p-3 border-b ${color.border} ${color.headerBg} flex justify-between items-center`}>
        <h3 className={`font-semibold text-xs ${color.text} flex items-center gap-2`}>
          {title}
        </h3>
        <span className={`${color.bg} ${color.text} text-[10px] px-2 py-0.5 rounded-full font-bold`}>
          {appointments.length}
        </span>
      </div>

      {/* Lista de cards */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
        {appointments.length === 0 ? (
          <div className="text-center p-6 text-slate-400 dark:text-gray-600 opacity-50 flex flex-col items-center gap-1.5">
            <Users className="w-6 h-6 stroke-1" />
            <p className="text-xs">Nenhum paciente</p>
          </div>
        ) : (
          appointments.map((apt, idx) => (
            <ReceptionCard
              key={apt.id}
              appointment={apt}
              status={status}
              position={status === 'waiting' ? idx : undefined}
              isUpdating={isUpdating === apt.id}
              isCalling={callingAppointmentId === apt.id}
              ticket={ticketMap?.get(apt.id)}
              columnContext={columnContext}
              onCall={onCall ? () => onCall(apt) : undefined}
              onCheckIn={onCheckIn ? () => onCheckIn(apt) : undefined}
              onConfirmArrival={onConfirmArrival ? () => onConfirmArrival(apt) : undefined}
              onEnter={onEnter ? () => onEnter(apt) : undefined}
              onFinish={onFinish ? () => onFinish(apt) : undefined}
              onRevert={onRevert ? () => onRevert(apt) : undefined}
              onEdit={onEditAppointment ? () => onEditAppointment(apt) : undefined}
              onGenerateTicket={onGenerateTicket ? (isPriority) => onGenerateTicket(apt, isPriority) : undefined}
              onCallWithDestination={onCallWithDestination ? () => onCallWithDestination(apt) : undefined}
              onFinishGuiche={onFinishGuiche ? () => onFinishGuiche(apt) : undefined}
              buttonLabel={buttonLabel}
              selectable={isSelectMode}
              isSelected={isSelectMode && selectedAppointmentId === apt.id}
            />
          ))
        )}
      </div>
    </div>
  );
}
