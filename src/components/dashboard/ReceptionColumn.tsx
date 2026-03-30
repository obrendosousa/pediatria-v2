'use client';

import { Appointment } from '@/types/medical';
import ReceptionCard, { TicketInfo } from './ReceptionCard';
import { Users } from 'lucide-react';
import { useDroppable, useDraggable } from '@dnd-kit/core';

/** Wrapper interno que torna cada card arrastável */
function DraggableCardWrapper({
  id,
  data,
  disabled,
  children,
}: {
  id: string;
  data: Record<string, unknown>;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data,
    disabled,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`transition-all duration-200 ${isDragging ? 'opacity-20 scale-[0.96] pointer-events-none' : 'cursor-grab active:cursor-grabbing'}`}
      style={{ touchAction: 'none' }}
    >
      {children}
    </div>
  );
}

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
  /** ID único da coluna para drag-and-drop */
  columnId?: string;
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
  /** ID do card que acabou de ser solto nesta coluna (para animação) */
  justDroppedId?: number | null;
}

export default function ReceptionColumn({
  title,
  status,
  appointments,
  color,
  columnId,
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
  justDroppedId,
}: ReceptionColumnProps) {
  const isSelectMode = selectedAppointmentId !== undefined && onSelectAppointment != null;
  const droppableId = columnId || `col-${status}`;
  const { isOver, setNodeRef: setDropRef } = useDroppable({ id: droppableId });

  return (
    <div
      ref={setDropRef}
      className={`flex flex-col overflow-hidden transition-all duration-200 bg-white dark:bg-gradient-to-b dark:from-[#1a1a22] dark:to-[#111116] rounded-xl border border-slate-200 dark:border-[#2a2a35] shadow-sm ${
        isOver ? 'kanban-column-drag-over scale-[1.01]' : ''
      } ${isSelectMode ? 'min-w-0' : 'flex-1 min-w-[180px]'}`}
    >
      {/* Header */}
      <div className={`p-3 border-b ${color.border} ${color.headerBg} flex justify-between items-center`}>
        <h3 className={`font-semibold text-xs ${color.text} flex items-center gap-2 tracking-wide uppercase`}>
          {title}
        </h3>
        <span className={`${color.bg} ${color.text} text-[10px] px-2.5 py-0.5 rounded-full font-bold min-w-[22px] text-center`}>
          {appointments.length}
        </span>
      </div>

      {/* Lista de cards */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
        {appointments.length === 0 ? (
          <div className={`text-center p-6 text-slate-400 dark:text-gray-600 flex flex-col items-center gap-1.5 transition-opacity duration-200 ${isOver ? 'opacity-100' : 'opacity-50'}`}>
            <Users className="w-6 h-6 stroke-1" />
            <p className="text-xs">{isOver ? 'Solte aqui' : 'Nenhum paciente'}</p>
          </div>
        ) : (
          appointments.map((apt, idx) => (
            <DraggableCardWrapper
              key={apt.id}
              id={`card-${apt.id}`}
              data={{ appointment: apt, status, columnId: droppableId }}
              disabled={false}
            >
              <div className={justDroppedId === apt.id ? 'card-drop-enter' : ''}>
                <ReceptionCard
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
              </div>
            </DraggableCardWrapper>
          ))
        )}
      </div>
    </div>
  );
}
