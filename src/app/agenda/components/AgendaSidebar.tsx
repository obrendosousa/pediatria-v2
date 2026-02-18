'use client';

import { getDaysInMonth } from '../utils/agendaUtils';

type AgendaSidebarProps = {
  currentDate: Date;
  setCurrentDate: (date: Date) => void;
};

export default function AgendaSidebar({ currentDate, setCurrentDate }: AgendaSidebarProps) {
  const daysInMonth = getDaysInMonth(currentDate);

  return (
    <div className="w-72 flex flex-col gap-4">
      <div className="bg-white dark:bg-[#1e2028] p-5 rounded-2xl border border-slate-100 dark:border-gray-800 shadow-sm transition-colors">
        <div className="flex justify-between items-center mb-4 px-1">
          <h3 className="text-sm font-bold text-slate-700 dark:text-gray-200 capitalize">
            {currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
          </h3>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 dark:text-gray-500 mb-2">
          <span>D</span><span>S</span><span>T</span><span>Q</span><span>Q</span><span>S</span><span>S</span>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {daysInMonth.map((d, i) => {
            if (!d) return <div key={i}></div>;
            const isSelected = d.toDateString() === currentDate.toDateString();
            return (
              <button
                key={i}
                onClick={() => setCurrentDate(new Date(d))}
                className={`h-8 w-8 rounded-lg text-xs font-bold transition-all flex items-center justify-center ${isSelected ? 'bg-rose-500 text-white shadow-md' : 'text-slate-600 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-white/10'}`}
              >
                {d.getDate()}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
