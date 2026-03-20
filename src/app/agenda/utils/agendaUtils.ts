/** Converte YYYY-MM-DD para DD/MM/YYYY */
export function formatDateToDisplay(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

/** Converte DD/MM/YYYY para YYYY-MM-DD */
export function formatDateToISO(dateStr: string): string {
  if (!dateStr) return '';
  const cleaned = dateStr.replace(/\D/g, '');
  if (cleaned.length !== 8) return '';
  const day = cleaned.substring(0, 2);
  const month = cleaned.substring(2, 4);
  const year = cleaned.substring(4, 8);
  return `${year}-${month}-${day}`;
}

/** Formata valor para exibição em reais (pt-BR) */
export function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? Number(value.replace(/\D/g, '')) / 100 : value;
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Converte string formatada (ex: "1.234,56") para número */
export function parseCurrency(value: string): number {
  if (!value) return 0;
  return Number(value.replace(/\./g, '').replace(',', '.'));
}

export type CardColorClasses = {
  bg: string;
  border: string;
  borderL: string;
  text: string;
  icon: string;
  hover: string;
};

export function getCardColorClasses(app: { status?: string; patient_sex?: string | null }): CardColorClasses {
  if (app.status === 'blocked') {
    return {
      bg: 'bg-red-50 dark:bg-red-900/20',
      border: 'border-red-100 dark:border-red-500/30',
      borderL: 'border-l-red-400 dark:border-l-red-500',
      text: 'text-red-700 dark:text-red-300',
      icon: 'text-red-400',
      hover: ''
    };
  }
  if (app.patient_sex === 'M') {
    return {
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      border: 'border-blue-100 dark:border-blue-500/30',
      borderL: 'border-l-blue-400 dark:border-l-blue-500',
      text: 'text-slate-700 dark:text-gray-200',
      icon: 'text-blue-500 dark:text-blue-300',
      hover: 'hover:border-blue-200 dark:hover:border-blue-500/50'
    };
  }
  if (app.patient_sex === 'F') {
    return {
      bg: 'bg-pink-50 dark:bg-pink-900/20',
      border: 'border-pink-100 dark:border-pink-500/30',
      borderL: 'border-l-pink-400 dark:border-l-pink-500',
      text: 'text-slate-700 dark:text-gray-200',
      icon: 'text-pink-500 dark:text-pink-300',
      hover: 'hover:border-pink-200 dark:hover:border-pink-500/50'
    };
  }
  return {
    bg: 'bg-indigo-50 dark:bg-indigo-900/20',
    border: 'border-indigo-100 dark:border-indigo-500/30',
    borderL: 'border-l-indigo-400 dark:border-l-indigo-500',
    text: 'text-slate-700 dark:text-gray-200',
    icon: 'text-indigo-500 dark:text-indigo-300',
    hover: 'hover:border-indigo-200 dark:hover:border-indigo-500/50'
  };
}

/** Formata telefone para exibição, suportando 10, 11 e 13 dígitos (com código de país) */
export function formatPhoneDisplay(phone: string | null | undefined): string {
  if (!phone) return 'S/ telefone';
  let digits = phone.replace(/\D/g, '');
  // Remove código de país 55 se presente
  if (digits.length >= 12 && digits.startsWith('55')) {
    digits = digits.substring(2);
  }
  if (digits.length === 11) {
    return `(${digits.substring(0, 2)}) ${digits.substring(2, 7)}-${digits.substring(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.substring(0, 2)}) ${digits.substring(2, 6)}-${digits.substring(6)}`;
  }
  return phone;
}

/** Retorna agendamentos de um dia a partir da lista semanal (com parsing de timezone local) */
export function getAppointmentsForDay<T extends { start_time?: string }>(date: Date, weekAppointments: T[]): T[] {
  const targetDateStr = date.toLocaleDateString('en-CA');
  return weekAppointments.filter(app => {
    if (!app.start_time) return false;
    // Parsear removendo timezone para tratar como hora local
    const clean = app.start_time.replace(/[+-]\d{2}:\d{2}$/, '').replace('Z', '');
    const [datePart, timePart] = clean.split('T');
    if (!datePart || !timePart) return false;
    const [y, m, d] = datePart.split('-').map(Number);
    const [h, min] = timePart.split(':').map(Number);
    const local = new Date(y, m - 1, d, h, min || 0);
    const localDateStr = local.toLocaleDateString('en-CA');
    return localDateStr === targetDateStr;
  });
}

/** Gera array de dias do mês para o minicalendário (com nulls no início) */
export function getDaysInMonth(date: Date): (Date | null)[] {
  const year = date.getFullYear();
  const month = date.getMonth();
  const days = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const arr: (Date | null)[] = [];
  for (let i = 0; i < firstDay; i++) arr.push(null);
  for (let i = 1; i <= days; i++) arr.push(new Date(year, month, i));
  return arr;
}

/** Gera slots de tempo de 30min entre startHour e endHour */
export function getTimeSlots(startHour: number, endHour: number): string[] {
  const timeSlots: string[] = [];
  for (let h = startHour; h < endHour; h++) {
    timeSlots.push(`${h.toString().padStart(2, '0')}:00`);
    timeSlots.push(`${h.toString().padStart(2, '0')}:30`);
  }
  return timeSlots;
}
