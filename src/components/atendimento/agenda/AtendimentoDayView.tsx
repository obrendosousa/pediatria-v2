'use client';

import { RefObject } from 'react';
import { User, Ban, Plus, FileText, DollarSign } from 'lucide-react';
import { getCardColorClasses } from '@/app/agenda/utils/agendaUtils';

type AtendimentoAppointment = {
  id: number;
  date: string;
  time: string | null;
  patient_id?: number | null;
  doctor_id: number | null;
  doctor_name?: string;
  status: string;
  notes?: string | null;
  parent_name?: string | null;
  parent_phone?: string | null;
  consultation_value?: number | null;
  patient_name?: string | null;
  patient_phone?: string | null;
  patient_sex?: 'M' | 'F' | null;
  total_amount?: number;
  amount_paid?: number;
};

type Props = {
  timeSlots: string[];
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  currentTimeSlotRef: RefObject<HTMLDivElement | null>;
  getAppointmentsAt: (time: string) => AtendimentoAppointment[];
  isCurrentTimeSlot: (time: string) => boolean;
  setSelectedAppointment: (app: AtendimentoAppointment) => void;
  openNewSlotModal: (dateStr?: string, timeStr?: string) => void;
};

function AppointmentCard({ app, setSelectedAppointment }: { app: AtendimentoAppointment; setSelectedAppointment: (a: AtendimentoAppointment) => void }) {
  const isBlocked = app.status === 'blocked';
  const colors = getCardColorClasses(app);
  const total = app.consultation_value ?? app.total_amount ?? 0;
  const paid = app.amount_paid ?? 0;
  return (
    <div
      onClick={() => setSelectedAppointment(app)}
      className={`relative z-10 p-3 rounded-xl border flex justify-between items-center transition-all hover:shadow-md cursor-pointer animate-fade-in-up ${colors.bg} ${colors.border} ${colors.hover}`}
    >
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg bg-white dark:bg-white/10 ${colors.icon}`}>
          {isBlocked ? <Ban className="w-4 h-4" /> : <User className="w-4 h-4" />}
        </div>
        <div>
          <p className={`text-sm font-bold ${colors.text}`}>
            {isBlocked ? 'Bloqueio' : (app.patient_name || 'Agendado')}
          </p>
          {!isBlocked && (
            <p className="text-xs text-slate-500 dark:text-gray-400">
              {(app.patient_phone || app.parent_phone) ? (app.patient_phone || app.parent_phone)!.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3') : 'S/ telefone'}
            </p>
          )}
        </div>
      </div>
      {!isBlocked && total > 0 && (
        <div className="mr-2">
          {(total - paid) <= 0 ? (
            <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
              <DollarSign size={10}/> Pago
            </span>
          ) : (
            <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
              <DollarSign size={10}/> Falta R$ {(total - paid).toFixed(0)}
            </span>
          )}
        </div>
      )}
      {app.notes && <div className="text-[10px] text-slate-400 dark:text-gray-500 bg-white/50 dark:bg-black/20 px-2 py-1 rounded border border-slate-100/50 dark:border-gray-700 flex items-center gap-1"><FileText className="w-3 h-3"/></div>}
    </div>
  );
}

export default function AtendimentoDayView({
  timeSlots, scrollContainerRef, currentTimeSlotRef,
  getAppointmentsAt, isCurrentTimeSlot, setSelectedAppointment, openNewSlotModal
}: Props) {
  return (
    <div ref={scrollContainerRef} className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-3 relative">
      {timeSlots.map((time) => {
        const apps = getAppointmentsAt(time);
        const isCurrent = isCurrentTimeSlot(time);
        return (
          <div key={time} ref={isCurrent ? currentTimeSlotRef : null} className="flex gap-4 group relative">
            {isCurrent && (
              <div className="absolute left-0 right-0 top-3.5 z-20 pointer-events-none">
                <div className="flex gap-4">
                  <div className="w-14"></div>
                  <div className="flex-1 relative">
                    <div className="absolute left-0 top-0 w-full h-0.5 bg-teal-500 dark:bg-teal-400 shadow-lg shadow-teal-500/50"></div>
                    <div className="absolute left-0 top-0 w-3 h-3 -translate-x-1.5 -translate-y-1.5 rounded-full bg-teal-500 dark:bg-teal-400 shadow-lg shadow-teal-500/50 border-2 border-white dark:border-[#1e2028]"></div>
                  </div>
                </div>
              </div>
            )}
            <div className="w-14 pt-2.5 text-right">
              <span className={`text-xs font-bold ${isCurrent ? 'text-teal-600 dark:text-teal-400' : 'text-slate-400 dark:text-gray-500'}`}>
                {time}
              </span>
            </div>
            <div className="flex-1 min-h-[50px] relative">
              <div className={`absolute top-3.5 left-0 w-full h-px ${isCurrent ? 'bg-teal-200 dark:bg-teal-900/30' : 'bg-slate-50 dark:bg-gray-800'}`}></div>
              {apps.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {apps.map((app) => (
                    <AppointmentCard key={app.id} app={app} setSelectedAppointment={setSelectedAppointment} />
                  ))}
                </div>
              ) : (
                <button onClick={() => openNewSlotModal(undefined, time)} className="w-full h-full min-h-[40px] mt-1 rounded-xl border border-dashed border-transparent hover:border-teal-200 dark:hover:border-teal-700 hover:bg-teal-50 dark:hover:bg-teal-900/10 flex items-center justify-center text-teal-300 dark:text-teal-700 transition-all text-xs font-bold gap-2 opacity-0 group-hover:opacity-100"><Plus className="w-3 h-3" /> Adicionar</button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
