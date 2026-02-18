'use client';

import { Calendar, ChevronLeft, ChevronRight, List, Grid, Plus } from 'lucide-react';

type AgendaHeaderProps = {
  viewMode: 'day' | 'week';
  setViewMode: (m: 'day' | 'week') => void;
  currentDate: Date;
  currentWeekStart: Date;
  weekDays: Date[];
  changeDay: (days: number) => void;
  changeWeek: (weeks: number) => void;
  openNewSlotModal: () => void;
};

export default function AgendaHeader({
  viewMode,
  setViewMode,
  currentDate,
  currentWeekStart,
  weekDays,
  changeDay,
  changeWeek,
  openNewSlotModal
}: AgendaHeaderProps) {
  return (
    <div className="h-16 px-6 flex items-center justify-between bg-white dark:bg-[#1e2028] border-b border-slate-100 dark:border-gray-800 shadow-sm z-20 transition-colors">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-300 rounded-lg shadow-sm">
          <Calendar className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-base font-bold text-slate-800 dark:text-gray-100 leading-none">Agenda da Dra.</h1>
          <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">Visão Geral da Unidade</p>
        </div>
      </div>

      <div className="flex items-center bg-slate-50 dark:bg-[#2a2d36] rounded-lg p-1 border border-slate-200 dark:border-gray-700">
        <button onClick={() => viewMode === 'day' ? changeDay(-1) : changeWeek(-1)} className="p-1.5 hover:bg-white dark:hover:bg-white/10 rounded-md text-slate-400 dark:text-gray-400 transition-all"><ChevronLeft className="w-4 h-4"/></button>
        <span className="px-4 text-sm font-bold text-slate-700 dark:text-gray-200 min-w-[180px] text-center capitalize">
          {viewMode === 'day'
            ? currentDate.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'long' })
            : `${currentWeekStart.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })} - ${weekDays[6].toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}`
          }
        </span>
        <button onClick={() => viewMode === 'day' ? changeDay(1) : changeWeek(1)} className="p-1.5 hover:bg-white dark:hover:bg-white/10 rounded-md text-slate-400 dark:text-gray-400 transition-all"><ChevronRight className="w-4 h-4"/></button>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex bg-slate-100 dark:bg-[#2a2d36] p-1 rounded-lg">
          <button onClick={() => setViewMode('day')} className={`p-1.5 rounded-md transition-all flex items-center gap-2 px-3 text-xs font-bold ${viewMode === 'day' ? 'bg-white dark:bg-gray-600 shadow text-slate-800 dark:text-white' : 'text-slate-400 dark:text-gray-500'}`}><List className="w-3.5 h-3.5" /> Dia</button>
          <button onClick={() => setViewMode('week')} className={`p-1.5 rounded-md transition-all flex items-center gap-2 px-3 text-xs font-bold ${viewMode === 'week' ? 'bg-white dark:bg-gray-600 shadow text-slate-800 dark:text-white' : 'text-slate-400 dark:text-gray-500'}`}><Grid className="w-3.5 h-3.5" /> Semana</button>
        </div>
        <button onClick={openNewSlotModal} className="flex items-center gap-2 bg-rose-500 hover:bg-rose-600 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md active:scale-95 transition-all"><Plus className="w-4 h-4" /> Novo Agendamento</button>
      </div>
    </div>
  );
}
