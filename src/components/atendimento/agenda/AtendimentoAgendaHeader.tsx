'use client';

import Link from 'next/link';
import { Calendar, ChevronLeft, ChevronRight, List, Grid, Plus, ClipboardList, Ban } from 'lucide-react';

type Props = {
  viewMode: 'day' | 'week';
  setViewMode: (m: 'day' | 'week') => void;
  currentDate: Date;
  currentWeekStart: Date;
  weekDays: Date[];
  changeDay: (days: number) => void;
  changeWeek: (weeks: number) => void;
  openNewSlotModal: () => void;
  doctors: Array<{ id: number; name: string }>;
  doctorId: number | null;
  setDoctorId: (id: number | null) => void;
};

export default function AtendimentoAgendaHeader({
  viewMode, setViewMode, currentDate, currentWeekStart, weekDays,
  changeDay, changeWeek, openNewSlotModal, doctors, doctorId, setDoctorId
}: Props) {
  return (
    <div className="h-16 px-6 flex items-center justify-between bg-white dark:bg-[#1e2028] border-b border-slate-100 dark:border-gray-800 shadow-sm z-20 transition-colors">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-300 rounded-lg shadow-sm">
          <Calendar className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-base font-bold text-slate-800 dark:text-gray-100 leading-none">Agenda</h1>
          <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">Atendimento Geral</p>
        </div>
      </div>

      {/* Seletor de profissional */}
      <select
        value={doctorId ?? ''}
        onChange={e => setDoctorId(e.target.value ? Number(e.target.value) : null)}
        className="text-xs font-medium border border-slate-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-[#2a2d36] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-teal-400"
      >
        <option value="">Todos profissionais</option>
        {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
      </select>

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
        <Link href="/atendimento/agenda/gerenciar" className="flex items-center gap-2 bg-slate-100 dark:bg-[#2a2d36] hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-gray-200 px-3 py-2 rounded-lg text-xs font-bold transition-colors"><ClipboardList className="w-3.5 h-3.5" /> Gerenciar</Link>
        <Link href="/atendimento/agenda/bloqueios" className="flex items-center gap-2 bg-slate-100 dark:bg-[#2a2d36] hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-gray-200 px-3 py-2 rounded-lg text-xs font-bold transition-colors"><Ban className="w-3.5 h-3.5" /> Bloqueios</Link>
        <button onClick={openNewSlotModal} className="flex items-center gap-2 bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md active:scale-95 transition-all"><Plus className="w-4 h-4" /> Novo Agendamento</button>
      </div>
    </div>
  );
}
