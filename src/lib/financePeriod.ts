export type FinancePreset = 'today' | '7d' | '30d' | 'custom';

const BRAZIL_OFFSET = '-03:00';

function formatDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getBrazilTodayDate(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(new Date());
}

export function getDayBoundsISO(date: string): { startISO: string; endISO: string } {
  return {
    startISO: new Date(`${date}T00:00:00${BRAZIL_OFFSET}`).toISOString(),
    endISO: new Date(`${date}T23:59:59.999${BRAZIL_OFFSET}`).toISOString()
  };
}

export function resolveFinanceRange(params: {
  preset?: string | null;
  start?: string | null;
  end?: string | null;
}): {
  preset: FinancePreset;
  startDate: string;
  endDate: string;
  startISO: string;
  endISO: string;
} {
  const preset = (params.preset as FinancePreset | null) ?? 'today';
  const today = getBrazilTodayDate();

  let startDate = today;
  let endDate = today;

  if (preset === '7d') {
    const end = new Date(`${today}T00:00:00${BRAZIL_OFFSET}`);
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - 6);
    startDate = formatDate(start);
    endDate = formatDate(end);
  } else if (preset === '30d') {
    const end = new Date(`${today}T00:00:00${BRAZIL_OFFSET}`);
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - 29);
    startDate = formatDate(start);
    endDate = formatDate(end);
  } else if (preset === 'custom') {
    startDate = params.start || today;
    endDate = params.end || today;
  } else {
    startDate = params.start || today;
    endDate = params.end || today;
  }

  const { startISO } = getDayBoundsISO(startDate);
  const { endISO } = getDayBoundsISO(endDate);

  return {
    preset,
    startDate,
    endDate,
    startISO,
    endISO
  };
}
