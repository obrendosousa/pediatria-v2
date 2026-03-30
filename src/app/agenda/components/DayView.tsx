'use client';

import { RefObject } from 'react';
import { User, Ban, Plus, FileText, DollarSign } from 'lucide-react';
import { getCardColorClasses, formatPhoneDisplay } from '../utils/agendaUtils';
import type { Appointment } from '@/types/medical';
import { effectiveAmount } from '@/utils/discountUtils';

type DayViewProps = {
  timeSlots: string[];
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  currentTimeSlotRef: RefObject<HTMLDivElement | null>;
  getAppointmentsAt: (time: string) => Appointment[];
  isCurrentTimeSlot: (time: string) => boolean;
  setSelectedAppointment: (app: Appointment) => void;
  openNewSlotModal: (dateStr?: string, timeStr?: string) => void;
};

function AppointmentCard({ app, setSelectedAppointment }: { app: Appointment; setSelectedAppointment: (app: Appointment) => void }) {
  const isBlocked = app.status === 'blocked';
  const colors = getCardColorClasses(app);
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
            <p className="text-xs text-slate-500 dark:text-[#a1a1aa]">
              {formatPhoneDisplay(app.patient_phone)}
            </p>
          )}
        </div>
      </div>
      {!isBlocked && effectiveAmount(app.total_amount ?? 0, Number(app.discount_amount || 0)) > 0 && (
        <div className="mr-2">
          {(effectiveAmount(app.total_amount ?? 0, Number(app.discount_amount || 0)) - (app.amount_paid || 0)) <= 0 ? (
            <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
              <DollarSign size={10}/> Pago
            </span>
          ) : (
            <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
              <DollarSign size={10}/> Falta R$ {(effectiveAmount(app.total_amount ?? 0, Number(app.discount_amount || 0)) - (app.amount_paid || 0)).toFixed(0)}
            </span>
          )}
        </div>
      )}
      {app.notes && <div className="text-[10px] text-slate-400 dark:text-[#71717a] bg-white/50 dark:bg-black/20 px-2 py-1 rounded border border-slate-100/50 dark:border-[#3d3d48] flex items-center gap-1"><FileText className="w-3 h-3"/></div>}
    </div>
  );
}

export default function DayView({
  timeSlots,
  scrollContainerRef,
  currentTimeSlotRef,
  getAppointmentsAt,
  isCurrentTimeSlot,
  setSelectedAppointment,
  openNewSlotModal
}: DayViewProps) {
  return (
    <div
      ref={scrollContainerRef}
      className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-3 relative"
    >
      {timeSlots.map((time) => {
        const apps = getAppointmentsAt(time);
        const isCurrent = isCurrentTimeSlot(time);

        return (
          <div
            key={time}
            ref={isCurrent ? currentTimeSlotRef : null}
            className="flex gap-4 group relative"
          >
            {isCurrent && (
              <div className="absolute left-0 right-0 top-3.5 z-20 pointer-events-none">
                <div className="flex gap-4">
                  <div className="w-14"></div>
                  <div className="flex-1 relative">
                    <div className="absolute left-0 top-0 w-full h-0.5 bg-rose-500 dark:bg-rose-400 shadow-lg shadow-rose-500/50"></div>
                    <div className="absolute left-0 top-0 w-3 h-3 -translate-x-1.5 -translate-y-1.5 rounded-full bg-rose-500 dark:bg-rose-400 shadow-lg shadow-rose-500/50 border-2 border-white dark:border-[#141419]"></div>
                  </div>
                </div>
              </div>
            )}

            <div className="w-14 pt-2.5 text-right">
              <span className={`text-xs font-bold ${
                isCurrent ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400 dark:text-[#71717a]'
              }`}>
                {time}
              </span>
            </div>
            <div className="flex-1 min-h-[50px] relative">
              <div className={`absolute top-3.5 left-0 w-full h-px ${
                isCurrent ? 'bg-rose-200 dark:bg-rose-900/30' : 'bg-slate-50 dark:bg-[#1c1c21]'
              }`}></div>
              {apps.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {apps.map((app) => (
                    <AppointmentCard key={app.id} app={app} setSelectedAppointment={setSelectedAppointment} />
                  ))}
                </div>
              ) : (
                <button onClick={() => openNewSlotModal(undefined, time)} className="w-full h-full min-h-[40px] mt-1 rounded-xl border border-dashed border-transparent hover:border-rose-200 dark:hover:border-rose-700 hover:bg-rose-50 dark:hover:bg-rose-900/10 flex items-center justify-center text-rose-300 dark:text-rose-700 transition-all text-xs font-bold gap-2 opacity-0 group-hover:opacity-100"><Plus className="w-3 h-3" /> Adicionar</button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
