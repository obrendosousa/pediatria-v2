'use client';

import { Ban, Plus, DollarSign } from 'lucide-react';
import { getCardColorClasses } from '@/app/agenda/utils/agendaUtils';

type AtendimentoAppointment = {
  id: number;
  date: string;
  time: string | null;
  status: string;
  notes?: string | null;
  patient_name?: string | null;
  patient_phone?: string | null;
  patient_sex?: 'M' | 'F' | null;
  parent_phone?: string | null;
  consultation_value?: number | null;
  total_amount?: number;
  amount_paid?: number;
};

export type DayBlock = {
  title: string;
  start_time: string | null;
  end_time: string | null;
  all_day: boolean;
};

type Props = {
  weekDays: Date[];
  weekAppointments: AtendimentoAppointment[];
  dayBlocks?: Record<string, DayBlock[]>;
  setSelectedAppointment: (app: AtendimentoAppointment) => void;
  openNewSlotModal: (dateStr?: string) => void;
};

function getAppointmentsForDay(day: Date, apps: AtendimentoAppointment[]) {
  const dateStr = day.toLocaleDateString('en-CA');
  return apps.filter(a => a.date === dateStr);
}

export default function AtendimentoWeekView({ weekDays, weekAppointments, dayBlocks, setSelectedAppointment, openNewSlotModal }: Props) {
  return (
    <div className="h-full flex overflow-x-auto custom-scrollbar">
      <div className="flex-1 grid grid-cols-7 min-w-[1600px] divide-x divide-slate-100 dark:divide-gray-800">
        {weekDays.map((day) => {
          const dateStr = day.toLocaleDateString('en-CA');
          const dayApps = getAppointmentsForDay(day, weekAppointments);
          const isToday = day.toDateString() === new Date().toDateString();
          return (
            <div key={dateStr} className={`flex flex-col h-full transition-colors ${isToday ? 'bg-blue-50/10 dark:bg-blue-900/5' : 'bg-white dark:bg-[#111118]'}`}>
              <div className={`text-center p-3 border-b ${isToday ? 'border-blue-200 dark:border-blue-900/30 bg-blue-50/50 dark:bg-blue-900/10' : 'border-slate-100 dark:border-[#1e1e28]'}`}>
                <span className={`text-[10px] font-extrabold uppercase block mb-1 tracking-wider ${isToday ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-[#71717a]'}`}>{day.toLocaleDateString('pt-BR', { weekday: 'short' })}</span>
                <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-lg font-bold ${isToday ? 'bg-blue-600 text-white shadow-md' : 'text-slate-700 dark:text-[#a1a1aa]'}`}>{day.getDate()}</div>
              </div>
              <div className="flex-1 p-2 space-y-2 overflow-y-auto custom-scrollbar">
                {/* Bloqueios do dia */}
                {(dayBlocks?.[dateStr] || []).map((block, idx) => (
                  <div key={`block-${idx}`} className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-[#252530] flex items-center gap-1.5 text-slate-400 dark:text-[#71717a]">
                    <Ban className="w-3 h-3 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold truncate">{block.title}</p>
                      <p className="text-[9px]">{block.all_day ? 'Dia inteiro' : `${block.start_time?.slice(0, 5) || ''} — ${block.end_time?.slice(0, 5) || ''}`}</p>
                    </div>
                  </div>
                ))}
                {dayApps.map(app => {
                  const time = app.time ? app.time.substring(0, 5) : '00:00';
                  const total = app.consultation_value ?? app.total_amount ?? 0;
                  const paid = app.amount_paid ?? 0;
                  const remaining = total - paid;
                  const isBlocked = app.status === 'blocked';
                  const colors = getCardColorClasses(app);
                  return (
                    <div
                      key={app.id}
                      onClick={() => setSelectedAppointment(app)}
                      className={`p-3 rounded-xl border text-left shadow-sm hover:shadow-md transition-all cursor-pointer group relative overflow-hidden border-l-4
                        ${isBlocked
                          ? 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900/30 border-l-red-400 dark:border-l-red-500'
                          : `${colors.bg} ${colors.border} ${colors.borderL} ${colors.hover}`
                        }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] font-bold text-slate-500 dark:text-[#a1a1aa] bg-slate-50 dark:bg-black/20 px-1 rounded">{time}</span>
                        {isBlocked && <Ban className="w-3 h-3 text-red-400"/>}
                      </div>
                      <p className={`text-xs font-bold leading-tight truncate ${colors.text}`}>
                        {isBlocked ? 'Bloqueio' : (app.patient_name || 'Agendado')}
                      </p>
                      {!isBlocked && (app.patient_phone || app.parent_phone) && (
                        <p className="text-[10px] text-slate-500 dark:text-[#a1a1aa] truncate mt-0.5">
                          {(app.patient_phone || app.parent_phone)!.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')}
                        </p>
                      )}
                      {total > 0 && (
                        <div className="flex flex-col gap-1 mt-1 pt-1 border-t border-slate-200/50 dark:border-[#252530]/50">
                          {remaining <= 0 ? (
                            <span className="inline-flex w-fit items-center gap-1 text-[10px] bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded-md font-bold">
                              <DollarSign size={10}/> Pago
                            </span>
                          ) : (
                            <span className="inline-flex w-fit items-center gap-1 text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded-md font-bold">
                              <DollarSign size={10}/> Falta R$ {remaining.toFixed(0)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                <button onClick={() => openNewSlotModal(dateStr)} className="w-full py-2 border border-dashed border-slate-200 dark:border-[#252530] rounded-lg text-slate-300 dark:text-gray-600 hover:text-blue-500 dark:hover:text-blue-400 hover:border-blue-300 dark:hover:border-blue-500/50 transition-all flex items-center justify-center"><Plus className="w-4 h-4" /></button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
