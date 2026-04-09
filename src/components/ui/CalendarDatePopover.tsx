'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarDays } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar-rac';
import { CalendarDate, getLocalTimeZone, today } from '@internationalized/date';
import type { DateValue } from 'react-aria-components';

type CalendarDatePopoverProps = {
  value: string;
  onChange: (value: string) => void;
  label: string;
};

function toCalendarDate(value: string): CalendarDate {
  if (!value) {
    const now = today(getLocalTimeZone());
    return now;
  }
  try {
    const parsed = parseISO(value);
    if (Number.isNaN(parsed.getTime())) {
      const now = today(getLocalTimeZone());
      return now;
    }
    return new CalendarDate(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
  } catch {
    const now = today(getLocalTimeZone());
    return now;
  }
}

function formatDisplay(value: string): string {
  if (!value) return format(new Date(), 'dd/MM/yyyy', { locale: ptBR });
  try {
    const parsed = parseISO(value);
    if (Number.isNaN(parsed.getTime())) return format(new Date(), 'dd/MM/yyyy', { locale: ptBR });
    return format(parsed, 'dd/MM/yyyy', { locale: ptBR });
  } catch {
    return format(new Date(), 'dd/MM/yyyy', { locale: ptBR });
  }
}

export default function CalendarDatePopover({ value, onChange, label }: CalendarDatePopoverProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const calendarValue = useMemo(() => toCalendarDate(value), [value]);

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

  const handleDateChange = (date: DateValue) => {
    const year = date.year;
    const month = String(date.month).padStart(2, '0');
    const day = String(date.day).padStart(2, '0');
    onChange(`${year}-${month}-${day}`);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-[#a1a1aa]">{label}</label>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex min-w-[148px] items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50 dark:border-[#3d3d48] dark:bg-[#111b21] dark:text-gray-200 dark:hover:bg-white/5"
      >
        <span>{formatDisplay(value)}</span>
        <CalendarDays className="h-4 w-4 text-slate-500 dark:text-[#a1a1aa]" />
      </button>

      {open ? (
        <div className="absolute left-0 top-[calc(100%+8px)] z-30 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl dark:border-[#3d3d48] dark:bg-[#111b21]">
          <Calendar
            aria-label={label}
            value={calendarValue}
            onChange={handleDateChange}
            className="rounded-lg"
          />
          <button
            type="button"
            onClick={() => {
              const now = new Date();
              onChange(format(now, 'yyyy-MM-dd'));
              setOpen(false);
            }}
            className="mt-2 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-[#3d3d48] dark:text-[#d4d4d8] dark:hover:bg-white/5"
          >
            Ir para hoje
          </button>
        </div>
      ) : null}
    </div>
  );
}
