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
    <div className="h-16 px-6 flex items-center justify-between bg-white dark:bg-[#111118] border-b border-slate-100 dark:border-[#1e1e28] shadow-sm z-20 transition-colors">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 rounded-lg shadow-sm">
          <Calendar className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-base font-bold text-slate-800 dark:text-[#fafafa] leading-none">Agenda</h1>
          <p className="text-xs text-slate-500 dark:text-[#a1a1aa] mt-0.5">Atendimento Geral</p>
        </div>
      </div>

      {/* Seletor de profissional */}
      <select
        value={doctorId ?? ''}
        onChange={e => setDoctorId(e.target.value ? Number(e.target.value) : null)}
        className="text-xs font-medium border border-slate-200 dark:border-[#252530] rounded-lg px-3 py-1.5 bg-white dark:bg-[#1a1a22] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-400"
      >
        <option value="">Todos profissionais</option>
        {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
      </select>

      <div className="flex items-center bg-slate-50 dark:bg-[#1a1a22] rounded-lg p-1 border border-slate-200 dark:border-[#252530]">
        <button onClick={() => viewMode === 'day' ? changeDay(-1) : changeWeek(-1)} className="p-1.5 hover:bg-white dark:hover:bg-white/10 rounded-md text-slate-400 dark:text-[#a1a1aa] transition-all"><ChevronLeft className="w-4 h-4"/></button>
        <span className="px-4 text-sm font-bold text-slate-700 dark:text-gray-200 min-w-[180px] text-center capitalize">
          {viewMode === 'day'
            ? currentDate.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'long' })
            : `${currentWeekStart.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })} - ${weekDays[6].toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}`
          }
        </span>
        <button onClick={() => viewMode === 'day' ? changeDay(1) : changeWeek(1)} className="p-1.5 hover:bg-white dark:hover:bg-white/10 rounded-md text-slate-400 dark:text-[#a1a1aa] transition-all"><ChevronRight className="w-4 h-4"/></button>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex bg-slate-100 dark:bg-[#1a1a22] p-1 rounded-lg">
          <button onClick={() => setViewMode('day')} className={`p-1.5 rounded-md transition-all flex items-center gap-2 px-3 text-xs font-bold ${viewMode === 'day' ? 'bg-white dark:bg-gray-600 shadow text-slate-800 dark:text-white' : 'text-slate-400 dark:text-[#71717a]'}`}><List className="w-3.5 h-3.5" /> Dia</button>
          <button onClick={() => setViewMode('week')} className={`p-1.5 rounded-md transition-all flex items-center gap-2 px-3 text-xs font-bold ${viewMode === 'week' ? 'bg-white dark:bg-gray-600 shadow text-slate-800 dark:text-white' : 'text-slate-400 dark:text-[#71717a]'}`}><Grid className="w-3.5 h-3.5" /> Semana</button>
        </div>
        <Link href="/atendimento/agenda/gerenciar" className="flex items-center gap-2 bg-slate-100 dark:bg-[#1a1a22] hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-gray-200 px-3 py-2 rounded-lg text-xs font-bold transition-colors"><ClipboardList className="w-3.5 h-3.5" /> Gerenciar</Link>
        <Link href="/atendimento/agenda/bloqueios" className="flex items-center gap-2 bg-slate-100 dark:bg-[#1a1a22] hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-gray-200 px-3 py-2 rounded-lg text-xs font-bold transition-colors"><Ban className="w-3.5 h-3.5" /> Bloqueios</Link>
        <button onClick={openNewSlotModal} className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md active:scale-95 transition-all"><Plus className="w-4 h-4" /> Novo Agendamento</button>
      </div>
    </div>
  );
}
