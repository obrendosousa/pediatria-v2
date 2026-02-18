'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';

type CalendarDatePopoverProps = {
  value: string;
  onChange: (value: string) => void;
  label: string;
};

function toDate(value: string): Date {
  if (!value) return new Date();
  const parsed = parseISO(value);
  if (Number.isNaN(parsed.getTime())) return new Date();
  return parsed;
}

export default function CalendarDatePopover({ value, onChange, label }: CalendarDatePopoverProps) {
  const [open, setOpen] = useState(false);
  const [displayMonth, setDisplayMonth] = useState<Date>(startOfMonth(toDate(value)));
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedDate = useMemo(() => toDate(value), [value]);
  const today = useMemo(() => new Date(), []);

  useEffect(() => {
    setDisplayMonth(startOfMonth(selectedDate));
  }, [selectedDate]);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const monthStart = startOfMonth(displayMonth);
  const monthEnd = endOfMonth(displayMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  return (
    <div ref={containerRef} className="relative">
      <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-gray-400">{label}</label>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex min-w-[148px] items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50 dark:border-gray-700 dark:bg-[#111b21] dark:text-gray-200 dark:hover:bg-white/5"
      >
        <span>{format(selectedDate, 'dd/MM/yyyy', { locale: ptBR })}</span>
        <CalendarDays className="h-4 w-4 text-slate-500 dark:text-gray-400" />
      </button>

      {open ? (
        <div className="absolute left-0 top-[calc(100%+8px)] z-30 w-[290px] rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl dark:border-gray-700 dark:bg-[#111b21]">
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setDisplayMonth((prev) => addMonths(prev, -1))}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-gray-400 dark:hover:bg-white/5"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="text-sm font-bold text-slate-800 dark:text-gray-100">
              {format(displayMonth, "MMMM 'de' yyyy", { locale: ptBR })}
            </p>
            <button
              type="button"
              onClick={() => setDisplayMonth((prev) => addMonths(prev, 1))}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-gray-400 dark:hover:bg-white/5"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-slate-400 dark:text-gray-500">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>

          <div className="mt-2 grid grid-cols-7 gap-1">
            {days.map((day) => {
              const active = isSameDay(day, selectedDate);
              const inMonth = isSameMonth(day, displayMonth);
              const isToday = isSameDay(day, today);
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => {
                    onChange(format(day, 'yyyy-MM-dd'));
                    setOpen(false);
                  }}
                  className={[
                    'h-8 rounded-lg text-xs font-semibold transition-colors',
                    inMonth
                      ? 'text-slate-700 hover:bg-slate-100 dark:text-gray-200 dark:hover:bg-white/10'
                      : 'text-slate-300 hover:bg-slate-50 dark:text-gray-600 dark:hover:bg-white/5',
                    active
                      ? 'bg-rose-600 text-white hover:bg-rose-600 dark:bg-rose-500 dark:text-white'
                      : '',
                    isToday && !active ? 'ring-1 ring-slate-300 dark:ring-gray-600' : '',
                  ].join(' ')}
                >
                  {format(day, 'd')}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              const now = new Date();
              onChange(format(now, 'yyyy-MM-dd'));
              setDisplayMonth(startOfMonth(now));
            }}
            className="mt-3 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
          >
            Ir para hoje
          </button>
        </div>
      ) : null}
    </div>
  );
}
