'use client';

import { Calendar } from '@/components/ui/calendar-rac';
import { CalendarDate } from '@internationalized/date';
import type { DateValue } from 'react-aria-components';

type Props = {
  currentDate: Date;
  setCurrentDate: (date: Date) => void;
};

export default function AtendimentoSidebar({ currentDate, setCurrentDate }: Props) {
  const calendarValue = new CalendarDate(
    currentDate.getFullYear(),
    currentDate.getMonth() + 1,
    currentDate.getDate()
  );

  const handleDateChange = (date: DateValue) => {
    const jsDate = new Date(date.year, date.month - 1, date.day);
    setCurrentDate(jsDate);
  };

  return (
    <div className="w-72 flex flex-col gap-4">
      <div className="bg-white dark:bg-[#111118] p-5 rounded-2xl border border-slate-100 dark:border-[#1e1e28] shadow-sm transition-colors">
        <Calendar
          aria-label="Selecionar data"
          value={calendarValue}
          onChange={handleDateChange}
          className="w-full"
        />
      </div>
    </div>
  );
}
