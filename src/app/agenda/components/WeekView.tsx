'use client';

import { Ban, Plus, DollarSign } from 'lucide-react';
import { getCardColorClasses, getAppointmentsForDay } from '../utils/agendaUtils';

type WeekViewProps = {
  weekDays: Date[];
  weekAppointments: any[];
  setSelectedAppointment: (app: any) => void;
  openNewSlotModal: (dateStr?: string) => void;
};

export default function WeekView({
  weekDays,
  weekAppointments,
  setSelectedAppointment,
  openNewSlotModal
}: WeekViewProps) {
  return (
    <div className="h-full flex overflow-x-auto custom-scrollbar">
      <div className="flex-1 grid grid-cols-7 min-w-[1600px] divide-x divide-slate-100 dark:divide-gray-800">
        {weekDays.map((day) => {
          const dateStr = day.toLocaleDateString('en-CA');
          const dayApps = getAppointmentsForDay(day, weekAppointments);
          const isToday = day.toDateString() === new Date().toDateString();

          return (
            <div key={dateStr} className={`flex flex-col h-full transition-colors ${isToday ? 'bg-rose-50/10 dark:bg-rose-900/5' : 'bg-white dark:bg-[#1e2028]'}`}>
              <div className={`text-center p-3 border-b ${isToday ? 'border-rose-200 dark:border-rose-900/30 bg-rose-50/50 dark:bg-rose-900/10' : 'border-slate-100 dark:border-gray-800'}`}>
                <span className={`text-[10px] font-extrabold uppercase block mb-1 tracking-wider ${isToday ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400 dark:text-gray-500'}`}>{day.toLocaleDateString('pt-BR', { weekday: 'short' })}</span>
                <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-lg font-bold ${isToday ? 'bg-rose-600 text-white shadow-md' : 'text-slate-700 dark:text-gray-400'}`}>{day.getDate()}</div>
              </div>
              <div className="flex-1 p-2 space-y-2 overflow-y-auto custom-scrollbar">
                {dayApps.map(app => {
                  const dateStrApp = app.start_time;
                  const cleanDateStr = dateStrApp ? dateStrApp.replace(/[+-]\d{2}:\d{2}$/, '').replace('Z', '') : '';
                  const [datePart, timePart] = cleanDateStr.split('T');
                  let time = '00:00';
                  if (datePart && timePart) {
                    const [y, m, d] = datePart.split('-').map(Number);
                    const [hours, minutes] = timePart.split(':').map(Number);
                    const dLocal = new Date(y, m - 1, d, hours, minutes || 0, 0);
                    time = dLocal.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false });
                  }
                  const total = app.total_amount || 0;
                  const paid = app.amount_paid || 0;
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
                        <span className="text-[10px] font-bold text-slate-500 dark:text-gray-400 bg-slate-50 dark:bg-black/20 px-1 rounded">{time}</span>
                        {isBlocked && <Ban className="w-3 h-3 text-red-400"/>}
                      </div>
                      <p className={`text-xs font-bold leading-tight truncate ${colors.text}`}>
                        {isBlocked ? 'Bloqueio' : (app.patient_name || 'Agendado')}
                      </p>
                      {!isBlocked && app.patient_phone && (
                        <p className="text-[10px] text-slate-500 dark:text-gray-400 truncate mt-0.5">
                          {app.patient_phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')}
                        </p>
                      )}
                      {total > 0 && (
                        <div className="flex flex-col gap-1 mt-1 pt-1 border-t border-slate-200/50 dark:border-gray-700/50">
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
                <button onClick={() => openNewSlotModal(dateStr)} className="w-full py-2 border border-dashed border-slate-200 dark:border-gray-700 rounded-lg text-slate-300 dark:text-gray-600 hover:text-rose-500 dark:hover:text-rose-400 hover:border-rose-300 dark:hover:border-rose-500/50 transition-all flex items-center justify-center"><Plus className="w-4 h-4" /></button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
