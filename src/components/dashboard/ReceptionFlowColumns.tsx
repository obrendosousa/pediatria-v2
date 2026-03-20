'use client';

import { Appointment } from '@/types/medical';
import ReceptionColumn from './ReceptionColumn';
import CheckoutDetailPanel from '@/components/medical/CheckoutDetailPanel';
import type { TicketInfo } from './ReceptionCard';

interface ReceptionFlowColumnsProps {
  selectedDate: string;
  appointments: Appointment[];
  onCallAppointment?: (appointment: Appointment) => void;
  onCheckIn?: (appointment: Appointment) => void;
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
  onCallAppointment,
  onCheckIn,
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
    <div className="flex-1 flex gap-2 overflow-x-auto overflow-y-hidden custom-scrollbar pb-2">

      {activeTab === 'flow' && variant === 'pediatria' && (
        <>
          {/* Pediatria: 1. Agendado */}
          <ReceptionColumn
            title="Agendado"
            status="scheduled"
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
            ticketMap={ticketMap}
          />

          {/* Pediatria: 2. Confirmado */}
          <ReceptionColumn
            title="Confirmado"
            status="scheduled"
            appointments={relevantAppointments.filter(a => a.status === 'confirmed')}
            color={{
              border: 'border-cyan-200 dark:border-cyan-800/50',
              bg: 'bg-cyan-100 dark:bg-cyan-900/40',
              text: 'text-cyan-700 dark:text-cyan-300',
              headerBg: 'bg-cyan-50/50 dark:bg-cyan-900/30'
            }}
            onCall={onCallAppointment}
            onCheckIn={onCheckIn}
            onRevert={(apt) => handleRevert(apt, 'scheduled')}
            onEditAppointment={onEditAppointment}
            isUpdating={isUpdating}
            callingAppointmentId={callingAppointmentId}
            ticketMap={ticketMap}
          />

          {/* Pediatria: 3. Fila */}
          <ReceptionColumn
            title="Fila"
            status="waiting"
            appointments={relevantAppointments.filter(a =>
              a.status === 'waiting' || a.status === 'called'
            ).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())}
            color={{
              border: 'border-amber-200 dark:border-amber-800/50',
              bg: 'bg-amber-100 dark:bg-amber-900/40',
              text: 'text-amber-700 dark:text-amber-300',
              headerBg: 'bg-amber-50/50 dark:bg-amber-900/30'
            }}
            onEnter={onEnter}
            onRevert={(apt) => handleRevert(apt, 'scheduled')}
            onEditAppointment={onEditAppointment}
            isUpdating={isUpdating}
            callingAppointmentId={callingAppointmentId}
            ticketMap={ticketMap}
          />

          {/* Pediatria: 4. Atendimento */}
          <ReceptionColumn
            title="Atendimento"
            status="in_service"
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
            ticketMap={ticketMap}
          />

          {/* Pediatria: 5. Concluído */}
          <ReceptionColumn
            title="Concluído"
            status="finished"
            appointments={finished}
            color={{
              border: 'border-slate-200 dark:border-slate-700/50',
              bg: 'bg-slate-100 dark:bg-slate-800/40',
              text: 'text-slate-700 dark:text-slate-300',
              headerBg: 'bg-slate-50/50 dark:bg-slate-800/25'
            }}
            onEditAppointment={onEditAppointment}
            isUpdating={isUpdating}
            callingAppointmentId={callingAppointmentId}
            ticketMap={ticketMap}
          />
        </>
      )}

      {activeTab === 'flow' && variant === 'atendimento' && (
        <>
          {/* 1. Agendados */}
          <ReceptionColumn
            title="Agendados"
            status="scheduled"
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
          />

          {/* 2. Fila Guiche */}
          <ReceptionColumn
            title="Fila Guiche"
            status="waiting"
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
          />

          {/* 3. No Guiche */}
          <ReceptionColumn
            title="No Guiche"
            status="in_service"
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
          />

          {/* 4. Fila Medico */}
          <ReceptionColumn
            title="Fila Medico"
            status="waiting"
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
          />

          {/* 5. Em Atendimento */}
          <ReceptionColumn
            title="Em Atendimento"
            status="in_service"
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
          />

          {/* 6. Concluidos */}
          <ReceptionColumn
            title="Concluidos"
            status="finished"
            appointments={finished}
            color={{
              border: 'border-slate-200 dark:border-slate-700/50',
              bg: 'bg-slate-100 dark:bg-slate-800/40',
              text: 'text-slate-700 dark:text-slate-300',
              headerBg: 'bg-slate-50/50 dark:bg-slate-800/25'
            }}
            onEditAppointment={onEditAppointment}
            isUpdating={isUpdating}
            callingAppointmentId={callingAppointmentId}
            ticketMap={ticketMap}
          />
        </>
      )}

      {activeTab === 'checkout' && (
        <div className="flex-1 flex gap-4 min-w-0 overflow-hidden">
          <div className="w-[30%] min-w-[280px] max-w-[380px] flex flex-col gap-3 overflow-hidden shrink-0">
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
  );
}
