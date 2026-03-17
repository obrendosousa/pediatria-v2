import type { SupabaseClient } from '@supabase/supabase-js';

// ── Tipos ──────────────────────────────────────────────────

export type RawBlock = {
  doctor_id: number | null;
  title: string;
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  all_day: boolean;
  recurrence: string;
};

export type ConflictResult = {
  hasConflict: boolean;
  conflicts: Array<{ id: number; time: string; patient_name: string | null }>;
};

export type BlockResult = {
  isBlocked: boolean;
  blockTitle: string | null;
};

// ── Validações de data/hora ────────────────────────────────

/** Valida se string YYYY-MM-DD é uma data real (rejeita 32/13, etc) */
export function isValidISODate(dateStr: string): boolean {
  if (!dateStr || dateStr.length !== 10) return false;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return false;
  const [y, m, d] = parts.map(Number);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return false;
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

/** Valida que end > start para HH:MM. Retorna true se end é vazio/null (campo opcional) */
export function isEndTimeAfterStartTime(start: string, end: string | null | undefined): boolean {
  if (!end || end.trim() === '') return true;
  return end > start;
}

/** Valida end_date >= start_date para YYYY-MM-DD */
export function isEndDateAfterStartDate(start: string, end: string): boolean {
  return end >= start;
}

// ── Detecção de conflito de horário ────────────────────────

/**
 * Consulta appointments para mesmo doctor_id + date com horário sobreposto.
 * Exclui status='cancelled' e opcionalmente um appointmentId (para edição).
 * Sem end_time, assume janela de 30min a partir do time.
 */
export async function checkTimeConflict(
  supabase: SupabaseClient,
  doctorId: number,
  date: string,
  timeStart: string,
  timeEnd?: string | null,
  excludeAppointmentId?: number
): Promise<ConflictResult> {
  const effectiveEnd = timeEnd || incrementTime(timeStart, 30);

  let query = supabase
    .from('appointments')
    .select('id, time, end_time, patients:patient_id(full_name)')
    .eq('doctor_id', doctorId)
    .eq('date', date)
    .neq('status', 'cancelled');

  if (excludeAppointmentId) {
    query = query.neq('id', excludeAppointmentId);
  }

  const { data, error } = await query;
  if (error || !data) return { hasConflict: false, conflicts: [] };

  const conflicts: ConflictResult['conflicts'] = [];

  for (const appt of data) {
    const apptStart = (appt.time as string)?.slice(0, 5);
    if (!apptStart) continue;

    const apptEnd = (appt.end_time as string)?.slice(0, 5) || incrementTime(apptStart, 30);
    const newStart = timeStart.slice(0, 5);
    const newEnd = effectiveEnd.slice(0, 5);

    // Overlap: apptStart < newEnd AND apptEnd > newStart
    if (apptStart < newEnd && apptEnd > newStart) {
      const patient = appt.patients as { full_name?: string } | null;
      conflicts.push({
        id: appt.id as number,
        time: apptStart,
        patient_name: patient?.full_name || null,
      });
    }
  }

  return { hasConflict: conflicts.length > 0, conflicts };
}

// ── Detecção de conflito com bloqueios ─────────────────────

/**
 * Consulta schedule_blocks e verifica se o horário está bloqueado
 * considerando recorrência.
 */
export async function checkBlockConflict(
  supabase: SupabaseClient,
  doctorId: number | null,
  date: string,
  timeStart: string
): Promise<BlockResult> {
  // Busca bloqueios que cobrem a data (range amplo)
  const { data: blocks, error } = await supabase
    .from('schedule_blocks')
    .select('*')
    .lte('start_date', date)
    .gte('end_date', date);

  if (error || !blocks || blocks.length === 0) {
    return { isBlocked: false, blockTitle: null };
  }

  const slot = timeStart.slice(0, 5);

  for (const block of blocks) {
    // Filtrar por doctor: bloqueio global (null) se aplica a todos
    if (doctorId && block.doctor_id && block.doctor_id !== doctorId) continue;

    if (!blockCoversDate(block as RawBlock, date)) continue;

    // Bloqueio de dia inteiro
    if (block.all_day) {
      return { isBlocked: true, blockTitle: block.title };
    }

    // Bloqueio com horário específico
    if (block.start_time && block.end_time) {
      const st = block.start_time.slice(0, 5);
      const et = block.end_time.slice(0, 5);
      if (slot >= st && slot < et) {
        return { isBlocked: true, blockTitle: block.title };
      }
    }
  }

  return { isBlocked: false, blockTitle: null };
}

// ── Lógica de bloqueios (extraída de page.tsx) ─────────────

/** Verifica se um bloco cobre uma data específica (considerando recorrência) */
export function blockCoversDate(block: RawBlock, dateStr: string): boolean {
  if (dateStr < block.start_date || dateStr > block.end_date) return false;
  if (block.recurrence === 'none' || block.recurrence === 'daily') return true;
  const targetDate = new Date(dateStr + 'T12:00:00');
  const startDate = new Date(block.start_date + 'T12:00:00');
  if (block.recurrence === 'weekly') return targetDate.getDay() === startDate.getDay();
  if (block.recurrence === 'monthly') return targetDate.getDate() === startDate.getDate();
  return true;
}

/** Gera set de time slots bloqueados para um dia */
export function buildBlockedSlots(
  blocks: RawBlock[],
  dateStr: string,
  doctorId: number | null,
  allSlots: string[]
): Set<string> {
  const blocked = new Set<string>();
  for (const block of blocks) {
    if (doctorId && block.doctor_id && block.doctor_id !== doctorId) continue;
    if (!blockCoversDate(block, dateStr)) continue;
    if (block.all_day) {
      allSlots.forEach(s => blocked.add(s));
    } else if (block.start_time && block.end_time) {
      const st = block.start_time.slice(0, 5);
      const et = block.end_time.slice(0, 5);
      allSlots.forEach(s => { if (s >= st && s < et) blocked.add(s); });
    }
  }
  return blocked;
}

// ── Helpers internos ───────────────────────────────────────

/** Incrementa um horário HH:MM em N minutos */
function incrementTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const totalMin = h * 60 + m + minutes;
  const newH = Math.floor(totalMin / 60) % 24;
  const newM = totalMin % 60;
  return `${newH.toString().padStart(2, '0')}:${newM.toString().padStart(2, '0')}`;
}
