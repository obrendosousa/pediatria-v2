'use client';

import { RefObject } from 'react';
import { User, Ban, Plus, FileText, DollarSign, Clock } from 'lucide-react';
import { getCardColorClasses, formatPhoneDisplay } from '../utils/agendaUtils';
import { formatAppointmentTime } from '@/utils/dateUtils';
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
  appointments: Appointment[];
};

function CompactAppointmentCard({ app, setSelectedAppointment }: { app: Appointment; setSelectedAppointment: (app: Appointment) => void }) {
  const isBlocked = app.status === 'blocked';
  const colors = getCardColorClasses(app);
  const time = formatAppointmentTime(app.start_time);

  return (
    <div
      onClick={() => setSelectedAppointment(app)}
      className={`relative z-10 px-4 py-2.5 rounded-xl border flex justify-between items-center transition-all hover:shadow-md cursor-pointer animate-fade-in-up ${colors.bg} ${colors.border} ${colors.hover}`}
    >
      <div className="flex items-center gap-3">
        <div className="flex flex-col items-center justify-center min-w-[40px]">
          <span className={`text-xs font-bold ${colors.text}`}>{time}</span>
        </div>
        <div className="w-px h-8 bg-slate-200 dark:bg-[#3d3d48]" />
        <div className={`p-1.5 rounded-lg bg-white dark:bg-white/10 ${colors.icon}`}>
          {isBlocked ? <Ban className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
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
      <div className="flex items-center gap-2">
        {app.notes && (
          <div className="text-[10px] text-slate-400 dark:text-[#71717a] bg-white/50 dark:bg-black/20 px-2 py-1 rounded border border-slate-100/50 dark:border-[#3d3d48] flex items-center gap-1">
            <FileText className="w-3 h-3" />
          </div>
        )}
        {!isBlocked && effectiveAmount(app.total_amount ?? 0, Number(app.discount_amount || 0)) > 0 && (
          <div>
            {(effectiveAmount(app.total_amount ?? 0, Number(app.discount_amount || 0)) - (app.amount_paid || 0)) <= 0 ? (
              <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                <DollarSign size={10} /> Pago
              </span>
            ) : (
              <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                <DollarSign size={10} /> Falta R$ {(effectiveAmount(app.total_amount ?? 0, Number(app.discount_amount || 0)) - (app.amount_paid || 0)).toFixed(0)}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TimeGap({ fromTime, toTime }: { fromTime: string; toTime: string }) {
  const [fH, fM] = fromTime.split(':').map(Number);
  const [tH, tM] = toTime.split(':').map(Number);
  const diffMinutes = (tH * 60 + tM) - (fH * 60 + fM);

  if (diffMinutes <= 30) return null;

  const hours = Math.floor(diffMinutes / 60);
  const mins = diffMinutes % 60;
  const label = hours > 0
    ? `${hours}h${mins > 0 ? `${mins}min` : ''} livre`
    : `${mins}min livre`;

  return (
    <div className="flex items-center gap-3 px-4 py-1">
      <div className="flex-1 border-t border-dashed border-slate-200 dark:border-[#2d2d36]" />
      <span className="text-[10px] text-slate-400 dark:text-[#71717a] font-medium flex items-center gap-1">
        <Clock className="w-3 h-3" />
        {label}
      </span>
      <div className="flex-1 border-t border-dashed border-slate-200 dark:border-[#2d2d36]" />
    </div>
  );
}

export default function DayView({
  scrollContainerRef,
  currentTimeSlotRef,
  setSelectedAppointment,
  openNewSlotModal,
  appointments,
}: DayViewProps) {
  // Sort appointments by start_time
  const sorted = [...appointments].sort((a, b) => {
    const timeA = formatAppointmentTime(a.start_time);
    const timeB = formatAppointmentTime(b.start_time);
    return timeA.localeCompare(timeB);
  });

  const now = new Date();
  const currentTimeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  // Find if current time is near an appointment for the ref
  const currentIdx = sorted.findIndex(app => {
    const t = formatAppointmentTime(app.start_time);
    return t >= currentTimeStr;
  });

  if (sorted.length === 0) {
    return (
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto custom-scrollbar p-6 flex flex-col items-center justify-center"
      >
        <div className="text-center space-y-3">
          <div className="w-16 h-16 bg-slate-50 dark:bg-[#1c1c21] rounded-2xl flex items-center justify-center mx-auto">
            <Clock className="w-7 h-7 text-slate-300 dark:text-[#71717a]" />
          </div>
          <p className="text-slate-400 dark:text-[#71717a] text-sm font-medium">Nenhum agendamento para hoje</p>
          <button
            onClick={() => openNewSlotModal()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white text-sm font-bold rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" /> Novo Agendamento
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={scrollContainerRef}
      className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6"
    >
      <div className="space-y-1.5">
        {sorted.map((app, idx) => {
          const appTime = formatAppointmentTime(app.start_time);
          const prevTime = idx > 0 ? formatAppointmentTime(sorted[idx - 1].start_time) : null;
          const isCurrentRef = idx === currentIdx;

          return (
            <div key={app.id} ref={isCurrentRef ? currentTimeSlotRef : null}>
              {prevTime && <TimeGap fromTime={prevTime} toTime={appTime} />}
              <CompactAppointmentCard
                app={app}
                setSelectedAppointment={setSelectedAppointment}
              />
            </div>
          );
        })}
      </div>

      {/* Quick add button at the bottom */}
      <div className="mt-4 flex justify-center">
        <button
          onClick={() => openNewSlotModal()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-dashed border-slate-200 dark:border-[#3d3d48] hover:border-rose-300 dark:hover:border-rose-700 hover:bg-rose-50 dark:hover:bg-rose-900/10 text-slate-400 dark:text-[#71717a] hover:text-rose-500 dark:hover:text-rose-400 transition-all text-xs font-bold"
        >
          <Plus className="w-3.5 h-3.5" /> Adicionar agendamento
        </button>
      </div>
    </div>
  );
}
