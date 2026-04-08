'use client';

import { Appointment } from '@/types/medical';
import ReceptionCard, { TicketInfo } from './ReceptionCard';
import { Users, Inbox } from 'lucide-react';
import { motion } from 'framer-motion';
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

/** Configuração visual por coluna */
const COLUMN_THEMES: Record<string, {
  icon: string;
  gradient: string;
  headerBg: string;
  countBg: string;
  countText: string;
  borderAccent: string;
  dropGlow: string;
  emptyIcon: string;
}> = {
  'scheduled': {
    icon: '📋',
    gradient: 'from-blue-500/10 to-blue-600/5 dark:from-blue-500/8 dark:to-blue-600/3',
    headerBg: 'bg-gradient-to-r from-blue-50 to-blue-100/50 dark:from-blue-950/40 dark:to-blue-900/20',
    countBg: 'bg-blue-500',
    countText: 'text-white',
    borderAccent: 'border-blue-200/60 dark:border-blue-500/20',
    dropGlow: 'ring-2 ring-blue-400/40 bg-blue-50/30 dark:bg-blue-500/5',
    emptyIcon: 'text-blue-300 dark:text-blue-700',
  },
  'waiting-reception': {
    icon: '🎫',
    gradient: 'from-cyan-500/10 to-cyan-600/5 dark:from-cyan-500/8 dark:to-cyan-600/3',
    headerBg: 'bg-gradient-to-r from-cyan-50 to-cyan-100/50 dark:from-cyan-950/40 dark:to-cyan-900/20',
    countBg: 'bg-cyan-500',
    countText: 'text-white',
    borderAccent: 'border-cyan-200/60 dark:border-cyan-500/20',
    dropGlow: 'ring-2 ring-cyan-400/40 bg-cyan-50/30 dark:bg-cyan-500/5',
    emptyIcon: 'text-cyan-300 dark:text-cyan-700',
  },
  'in_service-guiche': {
    icon: '🪟',
    gradient: 'from-teal-500/10 to-teal-600/5 dark:from-teal-500/8 dark:to-teal-600/3',
    headerBg: 'bg-gradient-to-r from-teal-50 to-teal-100/50 dark:from-teal-950/40 dark:to-teal-900/20',
    countBg: 'bg-teal-500',
    countText: 'text-white',
    borderAccent: 'border-teal-200/60 dark:border-teal-500/20',
    dropGlow: 'ring-2 ring-teal-400/40 bg-teal-50/30 dark:bg-teal-500/5',
    emptyIcon: 'text-teal-300 dark:text-teal-700',
  },
  'waiting-doctor': {
    icon: '⏳',
    gradient: 'from-green-500/10 to-green-600/5 dark:from-green-500/8 dark:to-green-600/3',
    headerBg: 'bg-gradient-to-r from-green-50 to-green-100/50 dark:from-green-950/40 dark:to-green-900/20',
    countBg: 'bg-green-500',
    countText: 'text-white',
    borderAccent: 'border-green-200/60 dark:border-green-500/20',
    dropGlow: 'ring-2 ring-green-400/40 bg-green-50/30 dark:bg-green-500/5',
    emptyIcon: 'text-green-300 dark:text-green-700',
  },
  'in_service': {
    icon: '🩺',
    gradient: 'from-emerald-500/10 to-emerald-600/5 dark:from-emerald-500/8 dark:to-emerald-600/3',
    headerBg: 'bg-gradient-to-r from-emerald-50 to-emerald-100/50 dark:from-emerald-950/40 dark:to-emerald-900/20',
    countBg: 'bg-emerald-500',
    countText: 'text-white',
    borderAccent: 'border-emerald-200/60 dark:border-emerald-500/20',
    dropGlow: 'ring-2 ring-emerald-400/40 bg-emerald-50/30 dark:bg-emerald-500/5',
    emptyIcon: 'text-emerald-300 dark:text-emerald-700',
  },
  'finished': {
    icon: '✅',
    gradient: 'from-slate-500/5 to-slate-600/3 dark:from-slate-500/5 dark:to-slate-600/2',
    headerBg: 'bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-slate-900/40 dark:to-slate-800/20',
    countBg: 'bg-slate-500',
    countText: 'text-white',
    borderAccent: 'border-slate-200/60 dark:border-slate-600/20',
    dropGlow: 'ring-2 ring-slate-400/40 bg-slate-50/30 dark:bg-slate-500/5',
    emptyIcon: 'text-slate-300 dark:text-slate-700',
  },
  'called': {
    icon: '📣',
    gradient: 'from-amber-500/10 to-amber-600/5 dark:from-amber-500/8 dark:to-amber-600/3',
    headerBg: 'bg-gradient-to-r from-amber-50 to-amber-100/50 dark:from-amber-950/40 dark:to-amber-900/20',
    countBg: 'bg-amber-500',
    countText: 'text-white',
    borderAccent: 'border-amber-200/60 dark:border-amber-500/20',
    dropGlow: 'ring-2 ring-amber-400/40 bg-amber-50/30 dark:bg-amber-500/5',
    emptyIcon: 'text-amber-300 dark:text-amber-700',
  },
  'waiting': {
    icon: '⏳',
    gradient: 'from-green-500/10 to-green-600/5 dark:from-green-500/8 dark:to-green-600/3',
    headerBg: 'bg-gradient-to-r from-green-50 to-green-100/50 dark:from-green-950/40 dark:to-green-900/20',
    countBg: 'bg-green-500',
    countText: 'text-white',
    borderAccent: 'border-green-200/60 dark:border-green-500/20',
    dropGlow: 'ring-2 ring-green-400/40 bg-green-50/30 dark:bg-green-500/5',
    emptyIcon: 'text-green-300 dark:text-green-700',
  },
  'waiting_payment': {
    icon: '💳',
    gradient: 'from-purple-500/10 to-purple-600/5 dark:from-purple-500/8 dark:to-purple-600/3',
    headerBg: 'bg-gradient-to-r from-purple-50 to-purple-100/50 dark:from-purple-950/40 dark:to-purple-900/20',
    countBg: 'bg-purple-500',
    countText: 'text-white',
    borderAccent: 'border-purple-200/60 dark:border-purple-500/20',
    dropGlow: 'ring-2 ring-purple-400/40 bg-purple-50/30 dark:bg-purple-500/5',
    emptyIcon: 'text-purple-300 dark:text-purple-700',
  },
};

/** Resolve a chave de tema baseado no status + columnContext */
function resolveThemeKey(status: string, columnContext?: 'guiche' | 'doctor' | null): string {
  if (status === 'waiting' && columnContext === 'guiche') return 'waiting-reception';
  if (status === 'in_service' && columnContext === 'guiche') return 'in_service-guiche';
  if (status === 'waiting' && columnContext === 'doctor') return 'waiting-doctor';
  return status;
}

const DEFAULT_THEME = COLUMN_THEMES['scheduled'];

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
  onCallOnTV?: (appointment: Appointment) => void;
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function ReceptionColumn({ title, status, appointments, color, columnId,
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
  onCallOnTV,
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

  const themeKey = resolveThemeKey(status, columnContext);
  const theme = COLUMN_THEMES[themeKey] || DEFAULT_THEME;

  return (
    <div
      ref={setDropRef}
      className={`flex flex-col overflow-hidden transition-all duration-300 rounded-2xl border backdrop-blur-sm ${theme.borderAccent} ${
        isOver ? `${theme.dropGlow} scale-[1.01]` : 'bg-white/80 dark:bg-[#0f0f14]/80'
      } ${isSelectMode ? 'min-w-0' : 'flex-1 min-w-[200px]'}`}
      style={{
        boxShadow: isOver
          ? '0 8px 30px -6px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.03)'
          : '0 1px 3px -1px rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.03)',
      }}
    >
      {/* Header */}
      <div className={`px-4 py-3 ${theme.headerBg} border-b ${theme.borderAccent}`}>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm" role="img" aria-label={title}>{theme.icon}</span>
            <h3 className="font-semibold text-[13px] text-slate-700 dark:text-slate-200 tracking-wide uppercase">
              {title}
            </h3>
          </div>
          <motion.span
            key={appointments.length}
            initial={{ scale: 1.4 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            className={`${theme.countBg} ${theme.countText} text-[11px] px-2.5 py-0.5 rounded-full font-bold min-w-[24px] text-center shadow-sm`}
          >
            {appointments.length}
          </motion.span>
        </div>
      </div>

      {/* Lista de cards */}
      <div className={`flex-1 overflow-y-auto p-2.5 space-y-2 custom-scrollbar bg-gradient-to-b ${theme.gradient}`}>
        {appointments.length === 0 ? (
          <motion.div
            animate={isOver ? {} : { y: [0, -3, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className={`text-center py-10 px-4 flex flex-col items-center gap-3 transition-all duration-300 ${isOver ? 'opacity-100 scale-105' : 'opacity-60'}`}
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isOver ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-slate-100 dark:bg-slate-800/50'} transition-colors duration-300`}>
              {isOver ? (
                <Inbox className="w-6 h-6 text-blue-500 dark:text-blue-400" />
              ) : (
                <Users className={`w-6 h-6 ${theme.emptyIcon}`} />
              )}
            </div>
            <div>
              <p className={`text-xs font-medium ${isOver ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-600'} transition-colors duration-300`}>
                {isOver ? 'Solte aqui' : 'Nenhum paciente'}
              </p>
              {!isOver && (
                <p className="text-[10px] text-slate-300 dark:text-slate-700 mt-0.5">
                  Arraste um card para cá
                </p>
              )}
            </div>
          </motion.div>
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
                  onCallOnTV={onCallOnTV ? () => onCallOnTV(apt) : undefined}
                  sourceModule={apt.source_module}
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
