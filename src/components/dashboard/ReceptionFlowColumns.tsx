'use client';

import { useState, useCallback, useRef } from 'react';
import { Appointment } from '@/types/medical';
import ReceptionColumn from './ReceptionColumn';
import ReceptionCard from './ReceptionCard';
import CheckoutDetailPanel from '@/components/medical/CheckoutDetailPanel';
import type { TicketInfo } from './ReceptionCard';
import { useToast } from '@/contexts/ToastContext';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';

interface DragData {
  appointment: Appointment;
  status: string;
  columnId: string;
}

interface ReceptionFlowColumnsProps {
  selectedDate: string;
  appointments: Appointment[];
  /** Checkouts pendentes de dias anteriores */
  overdueCheckouts?: Appointment[];
  onCallAppointment?: (appointment: Appointment) => void;
  onCheckIn?: (appointment: Appointment) => void;
  onConfirmArrival?: (appointment: Appointment) => void;
  onEnter?: (appointment: Appointment) => void;
  onFinish?: (appointment: Appointment) => void;
  onRevert?: (appointment: Appointment, newStatus: string) => void;
  onEditAppointment?: (appointment: Appointment) => void;
  onOpenCheckout?: (appointment: Appointment) => void;
  isUpdating?: number | null;
  callingAppointmentId?: number | null;
  activeTab?: 'flow' | 'checkout';
  selectedCheckoutAppointmentId?: number | null;
  onSelectCheckoutAppointment?: (appointment: Appointment) => void;
  onCheckoutSuccess?: () => void;
  onScheduleReturn?: (data: { suggestedDate: string; patientId?: number; patientName?: string; parentName?: string; phone?: string; patientSex?: 'M' | 'F'; doctorId?: number; appointmentType?: string }) => void;
  /** Callbacks do sistema de fila */
  onGenerateTicket?: (appointment: Appointment, isPriority: boolean) => void;
  onCallWithDestination?: (appointment: Appointment) => void;
  onFinishGuiche?: (appointment: Appointment) => void;
  /** Mapa de tickets por appointment_id */
  ticketMap?: Map<number, TicketInfo>;
  /** Variante do fluxo: 'pediatria' = Agendado→Confirmado→Fila→Atendimento→Concluído; 'atendimento' = fluxo com guichê */
  variant?: 'pediatria' | 'atendimento';
}

export default function ReceptionFlowColumns({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  selectedDate,
  appointments,
  overdueCheckouts = [],
  onCallAppointment,
  onCheckIn,
  onConfirmArrival,
  onEnter,
  onFinish,
  onRevert,
  onEditAppointment,
  onOpenCheckout,
  isUpdating,
  callingAppointmentId,
  activeTab = 'flow',
  selectedCheckoutAppointmentId = null,
  onSelectCheckoutAppointment,
  onCheckoutSuccess,
  onScheduleReturn,
  onGenerateTicket,
  onCallWithDestination,
  onFinishGuiche,
  ticketMap,
  variant = 'atendimento',
}: ReceptionFlowColumnsProps) {
  const { toast } = useToast();

  // ---- Drag & Drop state ----
  const [activeDragData, setActiveDragData] = useState<DragData | null>(null);
  const [justDroppedId, setJustDroppedId] = useState<number | null>(null);
  const dropTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current as DragData | undefined;
    if (data) setActiveDragData(data);
  }, []);

  const handleDragCancel = useCallback(() => {
    setActiveDragData(null);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveDragData(null);
    const { active, over } = event;
    if (!over || !active.data.current) return;

    const { appointment, columnId: fromCol } = active.data.current as DragData;
    const toCol = over.id as string;
    if (fromCol === toCol) return;

    // Animação de entrada
    setJustDroppedId(appointment.id);
    if (dropTimerRef.current) clearTimeout(dropTimerRef.current);
    dropTimerRef.current = setTimeout(() => setJustDroppedId(null), 400);

    if (variant === 'pediatria') {
      handlePediatriaDrop(appointment, fromCol, toCol);
    } else {
      handleAtendimentoDrop(appointment, fromCol, toCol);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant, onCallAppointment, onConfirmArrival, onEnter, onFinish, onRevert, onCallWithDestination, onFinishGuiche]);

  /** Verifica se o paciente tem pagamento pendente (total > 0 e restante > 0). Retorno não cobra. */
  const hasPendingPayment = (apt: Appointment) => {
    if (apt.appointment_type === 'retorno') return false;
    const total = Number(apt.total_amount || 0);
    const paid = Number(apt.amount_paid || 0);
    return total > 0 && (total - paid) > 0;
  };

  const handlePediatriaDrop = (apt: Appointment, from: string, to: string) => {
    // Bloquear entrada em atendimento se houver pagamento pendente
    if (to === 'ped-in_service' && hasPendingPayment(apt)) {
      const remaining = Number(apt.total_amount || 0) - Number(apt.amount_paid || 0);
      toast.error(`Pagamento pendente de R$ ${remaining.toFixed(2)}. Registre o pagamento antes de iniciar o atendimento.`);
      return;
    }

    // Forward
    if (from === 'ped-scheduled' && to === 'ped-called') onCallAppointment?.(apt);
    else if (from === 'ped-scheduled' && to === 'ped-waiting') onCheckIn?.(apt);
    else if (from === 'ped-called' && to === 'ped-waiting') onConfirmArrival?.(apt);
    else if (from === 'ped-waiting' && to === 'ped-in_service') onEnter?.(apt);
    else if (from === 'ped-in_service' && to === 'ped-finished') onFinish?.(apt);
    // Backward
    else if (from === 'ped-called' && to === 'ped-scheduled') onRevert?.(apt, 'scheduled');
    else if (from === 'ped-waiting' && to === 'ped-scheduled') onRevert?.(apt, 'scheduled');
    else if (from === 'ped-waiting' && to === 'ped-called') onRevert?.(apt, 'scheduled');
    else if (from === 'ped-in_service' && to === 'ped-waiting') onRevert?.(apt, 'waiting');
    else if (from === 'ped-in_service' && to === 'ped-called') onRevert?.(apt, 'waiting');
    // Backward from finished (dados financeiros e consulta preservados)
    else if (from === 'ped-finished' && to === 'ped-in_service') onRevert?.(apt, 'in_service');
    else if (from === 'ped-finished' && to === 'ped-waiting') onRevert?.(apt, 'waiting');
    else if (from === 'ped-finished' && to === 'ped-scheduled') onRevert?.(apt, 'scheduled');
  };

  const handleAtendimentoDrop = (apt: Appointment, from: string, to: string) => {
    // Bloquear entrada em atendimento se houver pagamento pendente
    if (to === 'atd-em-atendimento' && hasPendingPayment(apt)) {
      const remaining = Number(apt.total_amount || 0) - Number(apt.amount_paid || 0);
      toast.error(`Pagamento pendente de R$ ${remaining.toFixed(2)}. Registre o pagamento antes de iniciar o atendimento.`);
      return;
    }

    // Forward
    if (from === 'atd-scheduled' && to === 'atd-fila-guiche') onCheckIn?.(apt);
    else if (from === 'atd-fila-guiche' && to === 'atd-no-guiche') onCallWithDestination?.(apt);
    else if (from === 'atd-no-guiche' && to === 'atd-fila-medico') onFinishGuiche?.(apt);
    else if (from === 'atd-fila-medico' && to === 'atd-em-atendimento') onEnter?.(apt);
    else if (from === 'atd-em-atendimento' && to === 'atd-concluidos') onFinish?.(apt);
    // Backward
    else if (from === 'atd-fila-guiche' && to === 'atd-scheduled') onRevert?.(apt, 'scheduled');
    else if (from === 'atd-no-guiche' && to === 'atd-fila-guiche') onRevert?.(apt, 'waiting');
    else if (from === 'atd-fila-medico' && to === 'atd-no-guiche') onRevert?.(apt, 'waiting');
    else if (from === 'atd-em-atendimento' && to === 'atd-fila-medico') onRevert?.(apt, 'waiting');
    // Backward from finished (dados financeiros e consulta preservados)
    else if (from === 'atd-concluidos' && to === 'atd-em-atendimento') onRevert?.(apt, 'in_service');
    else if (from === 'atd-concluidos' && to === 'atd-fila-medico') onRevert?.(apt, 'waiting');
    else if (from === 'atd-concluidos' && to === 'atd-scheduled') onRevert?.(apt, 'scheduled');
  };

  // ---- Data filtering ----
  const relevantAppointments = appointments.filter(a =>
    ['scheduled', 'confirmed', 'called', 'waiting', 'in_service', 'waiting_payment', 'finished'].includes(a.status || '')
  );

  // Agendados (sem senha ainda)
  const scheduled = relevantAppointments.filter(a =>
    (a.status === 'scheduled' || a.status === 'confirmed') && !a.queue_stage
  );

  // Fila Guiche: waiting + queue_stage='reception'
  const receptionWaiting = relevantAppointments.filter(a =>
    a.status === 'waiting' && a.queue_stage === 'reception'
  ).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  // No Guiche: called ou in_service + queue_stage='reception'
  const atGuiche = relevantAppointments.filter(a =>
    (a.status === 'called' || a.status === 'in_service') && a.queue_stage === 'reception'
  );

  // Fila Medico: waiting + queue_stage='doctor'
  const doctorWaiting = relevantAppointments.filter(a =>
    a.status === 'waiting' && a.queue_stage === 'doctor'
  ).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  // Em Atendimento: in_service + queue_stage='doctor' OU sem queue_stage (legado)
  const inService = relevantAppointments.filter(a =>
    a.status === 'in_service' && (a.queue_stage === 'doctor' || !a.queue_stage)
  );

  // Legado: waiting/called sem queue_stage (fluxo antigo)
  const legacyWaiting = relevantAppointments.filter(a =>
    a.status === 'waiting' && !a.queue_stage
  ).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  const legacyCalled = relevantAppointments.filter(a =>
    a.status === 'called' && !a.queue_stage
  );
  // Called no doctor stage
  const doctorCalled = relevantAppointments.filter(a =>
    a.status === 'called' && a.queue_stage === 'doctor'
  );

  const waitingPayment = relevantAppointments.filter(a => a.status === 'waiting_payment');
  const finished = relevantAppointments.filter(a => a.status === 'finished').sort((a, b) =>
    new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
  );

  // Merge doctor called + in_service
  const doctorActive = [...doctorCalled, ...inService];

  // Merge legacy into appropriate columns
  const filaGuicheAll = receptionWaiting;
  const filaMedicoAll = [...doctorWaiting, ...legacyWaiting];
  const emAtendimentoAll = [...doctorActive, ...legacyCalled];

  const handleRevert = (appointment: Appointment, newStatus: string) => {
    if (onRevert) onRevert(appointment, newStatus);
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex-1 flex gap-3 overflow-x-auto overflow-y-hidden custom-scrollbar pb-2">

        {activeTab === 'flow' && variant === 'pediatria' && (
          <>
            {/* Pediatria: 1. Agendados */}
            <ReceptionColumn
              title="Agendados"
              status="scheduled"
              columnId="ped-scheduled"
              appointments={relevantAppointments.filter(a => a.status === 'scheduled')}
              color={{
                border: 'border-blue-200 dark:border-blue-800/50',
                bg: 'bg-blue-100 dark:bg-blue-900/40',
                text: 'text-blue-700 dark:text-blue-300',
                headerBg: 'bg-blue-50/50 dark:bg-blue-900/30'
              }}
              onCall={onCallAppointment}
              onCheckIn={onCheckIn}
              onEditAppointment={onEditAppointment}
              isUpdating={isUpdating}
              callingAppointmentId={callingAppointmentId}
              justDroppedId={justDroppedId}
            />

            {/* Pediatria: 2. Chamados */}
            <ReceptionColumn
              title="Chamados"
              status="called"
              columnId="ped-called"
              appointments={relevantAppointments.filter(a => a.status === 'called')}
              color={{
                border: 'border-amber-200 dark:border-amber-800/50',
                bg: 'bg-amber-100 dark:bg-amber-900/40',
                text: 'text-amber-700 dark:text-amber-300',
                headerBg: 'bg-amber-50/50 dark:bg-amber-900/30'
              }}
              onConfirmArrival={onConfirmArrival}
              onRevert={(apt) => handleRevert(apt, 'scheduled')}
              onEditAppointment={onEditAppointment}
              isUpdating={isUpdating}
              callingAppointmentId={callingAppointmentId}
              justDroppedId={justDroppedId}
            />

            {/* Pediatria: 3. Na Fila */}
            <ReceptionColumn
              title="Na Fila"
              status="waiting"
              columnId="ped-waiting"
              appointments={relevantAppointments.filter(a => a.status === 'waiting').sort((a, b) =>
                new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
              )}
              color={{
                border: 'border-green-200 dark:border-green-800/50',
                bg: 'bg-green-100 dark:bg-green-900/40',
                text: 'text-green-700 dark:text-green-300',
                headerBg: 'bg-green-50/50 dark:bg-green-900/30'
              }}
              onEnter={onEnter}
              onRevert={(apt) => handleRevert(apt, 'scheduled')}
              onEditAppointment={onEditAppointment}
              isUpdating={isUpdating}
              callingAppointmentId={callingAppointmentId}
              justDroppedId={justDroppedId}
            />

            {/* Pediatria: 4. Em Atendimento */}
            <ReceptionColumn
              title="Em Atendimento"
              status="in_service"
              columnId="ped-in_service"
              appointments={relevantAppointments.filter(a => a.status === 'in_service')}
              color={{
                border: 'border-emerald-200 dark:border-emerald-800/50',
                bg: 'bg-emerald-100 dark:bg-emerald-900/40',
                text: 'text-emerald-700 dark:text-emerald-300',
                headerBg: 'bg-emerald-50/50 dark:bg-emerald-900/30'
              }}
              onFinish={onFinish}
              onRevert={(apt) => handleRevert(apt, 'waiting')}
              onEditAppointment={onEditAppointment}
              isUpdating={isUpdating}
              callingAppointmentId={callingAppointmentId}
              justDroppedId={justDroppedId}
            />

            {/* Pediatria: 5. Concluídos */}
            <ReceptionColumn
              title="Concluídos"
              status="finished"
              columnId="ped-finished"
              appointments={finished}
              color={{
                border: 'border-slate-200 dark:border-slate-700/50',
                bg: 'bg-slate-100 dark:bg-slate-800/40',
                text: 'text-slate-700 dark:text-slate-300',
                headerBg: 'bg-slate-50/50 dark:bg-slate-800/25'
              }}
              onRevert={(apt) => handleRevert(apt, 'in_service')}
              onEditAppointment={onEditAppointment}
              isUpdating={isUpdating}
              callingAppointmentId={callingAppointmentId}
              justDroppedId={justDroppedId}
            />
          </>
        )}

        {activeTab === 'flow' && variant === 'atendimento' && (
          <>
            {/* 1. Agendados */}
            <ReceptionColumn
              title="Agendados"
              status="scheduled"
              columnId="atd-scheduled"
              appointments={scheduled}
              color={{
                border: 'border-blue-200 dark:border-blue-800/50',
                bg: 'bg-blue-100 dark:bg-blue-900/40',
                text: 'text-blue-700 dark:text-blue-300',
                headerBg: 'bg-blue-50/50 dark:bg-blue-900/30'
              }}
              onCall={onCallAppointment}
              onCheckIn={onCheckIn}
              onGenerateTicket={onGenerateTicket}
              onEditAppointment={onEditAppointment}
              isUpdating={isUpdating}
              callingAppointmentId={callingAppointmentId}
              ticketMap={ticketMap}
              justDroppedId={justDroppedId}
            />

            {/* 2. Fila Guiche */}
            <ReceptionColumn
              title="Fila Guiche"
              status="waiting"
              columnId="atd-fila-guiche"
              appointments={filaGuicheAll}
              color={{
                border: 'border-cyan-200 dark:border-cyan-800/50',
                bg: 'bg-cyan-100 dark:bg-cyan-900/40',
                text: 'text-cyan-700 dark:text-cyan-300',
                headerBg: 'bg-cyan-50/50 dark:bg-cyan-900/30'
              }}
              onCallWithDestination={onCallWithDestination}
              onRevert={(apt) => handleRevert(apt, 'scheduled')}
              onEditAppointment={onEditAppointment}
              isUpdating={isUpdating}
              callingAppointmentId={callingAppointmentId}
              ticketMap={ticketMap}
              columnContext="guiche"
              justDroppedId={justDroppedId}
            />

            {/* 3. No Guiche */}
            <ReceptionColumn
              title="No Guiche"
              status="in_service"
              columnId="atd-no-guiche"
              appointments={atGuiche}
              color={{
                border: 'border-teal-200 dark:border-teal-800/50',
                bg: 'bg-teal-100 dark:bg-teal-900/40',
                text: 'text-teal-700 dark:text-teal-300',
                headerBg: 'bg-teal-50/50 dark:bg-teal-900/30'
              }}
              onFinishGuiche={onFinishGuiche}
              onRevert={(apt) => handleRevert(apt, 'waiting')}
              onEditAppointment={onEditAppointment}
              isUpdating={isUpdating}
              callingAppointmentId={callingAppointmentId}
              ticketMap={ticketMap}
              columnContext="guiche"
              justDroppedId={justDroppedId}
            />

            {/* 4. Fila Medico */}
            <ReceptionColumn
              title="Fila Medico"
              status="waiting"
              columnId="atd-fila-medico"
              appointments={filaMedicoAll}
              color={{
                border: 'border-green-200 dark:border-green-800/50',
                bg: 'bg-green-100 dark:bg-green-900/40',
                text: 'text-green-700 dark:text-green-300',
                headerBg: 'bg-green-50/50 dark:bg-green-900/30'
              }}
              onCallWithDestination={onCallWithDestination}
              onEnter={onEnter}
              onRevert={(apt) => handleRevert(apt, 'scheduled')}
              onEditAppointment={onEditAppointment}
              isUpdating={isUpdating}
              callingAppointmentId={callingAppointmentId}
              ticketMap={ticketMap}
              columnContext="doctor"
              justDroppedId={justDroppedId}
            />

            {/* 5. Em Atendimento */}
            <ReceptionColumn
              title="Em Atendimento"
              status="in_service"
              columnId="atd-em-atendimento"
              appointments={emAtendimentoAll}
              color={{
                border: 'border-emerald-200 dark:border-emerald-800/50',
                bg: 'bg-emerald-100 dark:bg-emerald-900/40',
                text: 'text-emerald-700 dark:text-emerald-300',
                headerBg: 'bg-emerald-50/50 dark:bg-emerald-900/30'
              }}
              onFinish={onFinish}
              onRevert={(apt) => handleRevert(apt, 'waiting')}
              onEditAppointment={onEditAppointment}
              isUpdating={isUpdating}
              callingAppointmentId={callingAppointmentId}
              ticketMap={ticketMap}
              columnContext="doctor"
              justDroppedId={justDroppedId}
            />

            {/* 6. Concluidos */}
            <ReceptionColumn
              title="Concluidos"
              status="finished"
              columnId="atd-concluidos"
              appointments={finished}
              color={{
                border: 'border-slate-200 dark:border-slate-700/50',
                bg: 'bg-slate-100 dark:bg-slate-800/40',
                text: 'text-slate-700 dark:text-slate-300',
                headerBg: 'bg-slate-50/50 dark:bg-slate-800/25'
              }}
              onRevert={(apt) => handleRevert(apt, 'in_service')}
              onEditAppointment={onEditAppointment}
              isUpdating={isUpdating}
              callingAppointmentId={callingAppointmentId}
              ticketMap={ticketMap}
              justDroppedId={justDroppedId}
            />
          </>
        )}

        {activeTab === 'checkout' && (
          <div className="flex-1 flex gap-4 min-w-0 overflow-hidden">
            <div className="w-[30%] min-w-[280px] max-w-[380px] flex flex-col gap-3 overflow-y-auto custom-scrollbar shrink-0">
              {/* Alerta de checkouts pendentes de dias anteriores */}
              {overdueCheckouts.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-xl p-3 space-y-2">
                  <p className="text-xs font-bold text-amber-800 dark:text-amber-200 uppercase flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2"><span className="animate-ping absolute inset-0 rounded-full bg-amber-400 opacity-75" /><span className="relative rounded-full h-2 w-2 bg-amber-500" /></span>
                    {overdueCheckouts.length} pendente{overdueCheckouts.length > 1 ? 's' : ''} de dias anteriores
                  </p>
                  {overdueCheckouts.map((apt) => {
                    const dateStr = new Date(apt.start_time).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                    return (
                      <button
                        key={apt.id}
                        type="button"
                        onClick={() => {
                          if (onSelectCheckoutAppointment) onSelectCheckoutAppointment(apt);
                          else if (onOpenCheckout) onOpenCheckout(apt);
                        }}
                        className={`w-full text-left p-2.5 rounded-lg border transition-all ${
                          selectedCheckoutAppointmentId === apt.id
                            ? 'border-amber-500 bg-amber-100 dark:bg-amber-900/40 ring-2 ring-amber-400'
                            : 'border-amber-200 dark:border-amber-800 bg-white dark:bg-[#131316] hover:border-amber-400'
                        }`}
                      >
                        <p className="text-sm font-semibold text-slate-800 dark:text-[#fafafa] truncate">{apt.patient_name || 'Sem nome'}</p>
                        <p className="text-[10px] text-amber-700 dark:text-amber-300 font-bold mt-0.5">
                          {dateStr} &bull; {apt.doctor_name || 'Sem médico'}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
              <ReceptionColumn
                title="Checkout / Pagamento"
                status="waiting_payment"
                appointments={waitingPayment}
                color={{
                  border: 'border-purple-200 dark:border-purple-800',
                  bg: 'bg-purple-100 dark:bg-purple-900/30',
                  text: 'text-purple-700 dark:text-purple-300',
                  headerBg: 'bg-purple-50/50 dark:bg-purple-900/10'
                }}
                onFinish={onSelectCheckoutAppointment ?? onOpenCheckout}
                onRevert={(apt) => handleRevert(apt, 'in_service')}
                onEditAppointment={onEditAppointment}
                isUpdating={isUpdating}
                callingAppointmentId={callingAppointmentId}
                buttonLabel="Abrir"
                selectedAppointmentId={selectedCheckoutAppointmentId ?? undefined}
                onSelectAppointment={onSelectCheckoutAppointment}
                ticketMap={ticketMap}
              />
              <ReceptionColumn
                title="Concluidos do Dia"
                status="finished"
                appointments={finished}
                color={{
                  border: 'border-slate-200 dark:border-slate-700',
                  bg: 'bg-slate-100 dark:bg-slate-800/30',
                  text: 'text-slate-700 dark:text-slate-300',
                  headerBg: 'bg-slate-50/50 dark:bg-slate-800/10'
                }}
                onEditAppointment={onEditAppointment}
                isUpdating={isUpdating}
                callingAppointmentId={callingAppointmentId}
                ticketMap={ticketMap}
              />
            </div>
            <div className="flex-1 min-w-0 overflow-hidden">
              <CheckoutDetailPanel
                appointmentId={selectedCheckoutAppointmentId ?? null}
                onSuccess={onCheckoutSuccess}
                onScheduleReturn={onScheduleReturn}
              />
            </div>
          </div>
        )}
      </div>

      {/* Overlay flutuante durante o arrasto */}
      <DragOverlay
        dropAnimation={{
          duration: 280,
          easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
        }}
      >
        {activeDragData ? (
          <div className="drag-overlay-card pointer-events-none">
            <ReceptionCard
              appointment={activeDragData.appointment}
              status={activeDragData.status as 'scheduled' | 'called' | 'waiting' | 'in_service' | 'waiting_payment' | 'finished'}
              isDragOverlay
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
