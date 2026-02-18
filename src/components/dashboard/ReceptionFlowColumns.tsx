'use client';

import { Appointment } from '@/types/medical';
import ReceptionColumn from './ReceptionColumn';
import CheckoutDetailPanel from '@/components/medical/CheckoutDetailPanel';

interface ReceptionFlowColumnsProps {
  selectedDate: string;
  appointments: Appointment[];
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
  /** Hub checkout: paciente selecionado e callbacks */
  selectedCheckoutAppointmentId?: number | null;
  onSelectCheckoutAppointment?: (appointment: Appointment) => void;
  onCheckoutSuccess?: () => void;
  onScheduleReturn?: (suggestedDate: string) => void;
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
  onEditAppointment,
  onOpenCheckout,
  isUpdating,
  callingAppointmentId,
  activeTab = 'flow',
  selectedCheckoutAppointmentId = null,
  onSelectCheckoutAppointment,
  onCheckoutSuccess,
  onScheduleReturn
}: ReceptionFlowColumnsProps) {

  const relevantAppointments = appointments.filter(a =>
    ['scheduled', 'called', 'waiting', 'in_service', 'waiting_payment', 'finished'].includes(a.status || '')
  );

  const scheduled = relevantAppointments.filter(a => a.status === 'scheduled');
  const called = relevantAppointments.filter(a => a.status === 'called');
  const waiting = relevantAppointments.filter(a => a.status === 'waiting').sort((a, b) => {
    const aTime = new Date(a.start_time).getTime();
    const bTime = new Date(b.start_time).getTime();
    return aTime - bTime;
  });
  const inService = relevantAppointments.filter(a => a.status === 'in_service');
  const waitingPayment = relevantAppointments.filter(a => a.status === 'waiting_payment');
  const finished = relevantAppointments.filter(a => a.status === 'finished').sort((a, b) => {
    const aTime = new Date(a.start_time).getTime();
    const bTime = new Date(b.start_time).getTime();
    return bTime - aTime;
  });

  const handleRevert = (appointment: Appointment, newStatus: string) => {
    if (onRevert) onRevert(appointment, newStatus);
  };

  return (
    <div className="flex-1 flex gap-3 overflow-x-auto overflow-y-hidden custom-scrollbar pb-2">

      {activeTab === 'flow' && (
        <>
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
            onEditAppointment={onEditAppointment}
            isUpdating={isUpdating}
            callingAppointmentId={callingAppointmentId}
          />
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
            onEditAppointment={onEditAppointment}
            isUpdating={isUpdating}
            callingAppointmentId={callingAppointmentId}
          />
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
            onEditAppointment={onEditAppointment}
            isUpdating={isUpdating}
            callingAppointmentId={callingAppointmentId}
          />
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
            onEditAppointment={onEditAppointment}
            isUpdating={isUpdating}
            callingAppointmentId={callingAppointmentId}
          />
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
            onEditAppointment={onEditAppointment}
            isUpdating={isUpdating}
            callingAppointmentId={callingAppointmentId}
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
            />
            <ReceptionColumn
              title="Concluídos do Dia"
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
