'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { createSchemaClient } from '@/lib/supabase/schemaClient';
import { createClient } from '@/lib/supabase/client';
import { getTimeSlots } from '@/app/agenda/utils/agendaUtils';
import { useAuth } from '@/contexts/AuthContext';

import AtendimentoAgendaHeader from '@/components/atendimento/agenda/AtendimentoAgendaHeader';
import AtendimentoDayView from '@/components/atendimento/agenda/AtendimentoDayView';
import AtendimentoWeekView, { type DayBlock } from '@/components/atendimento/agenda/AtendimentoWeekView';
import AtendimentoSidebar from '@/components/atendimento/agenda/AtendimentoSidebar';
import NewAppointmentModal from '@/components/atendimento/agenda/NewAppointmentModal';
import AtendimentoDetailModal from '@/components/atendimento/agenda/AtendimentoDetailModal';

const supabase = createSchemaClient('atendimento');
const supabasePublic = createClient();

type AtendimentoAppointment = {
  id: number;
  date: string;
  time: string | null;
  patient_id?: number | null;
  doctor_id: number | null;
  doctor_name?: string;
  type?: string | null;
  status: string;
  notes?: string | null;
  parent_name?: string | null;
  parent_phone?: string | null;
  consultation_value?: number | null;
  patient_name?: string | null;
  patient_phone?: string | null;
  patient_sex?: 'M' | 'F' | null;
  total_amount?: number;
  amount_paid?: number;
};

type RawBlock = {
  doctor_id: number | null;
  title: string;
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  all_day: boolean;
  recurrence: string;
};

function mapAppointment(row: Record<string, unknown>): AtendimentoAppointment {
  const patient = row.patients as { full_name?: string; phone?: string; sex?: string } | null;
  return {
    id: row.id as number,
    date: row.date as string,
    time: row.time as string | null,
    patient_id: row.patient_id as number | null,
    doctor_id: row.doctor_id as number | null,
    doctor_name: (row.doctor_name as string) || undefined,
    type: row.type as string | null,
    status: row.status as string,
    notes: row.notes as string | null,
    parent_name: row.parent_name as string | null,
    parent_phone: row.parent_phone as string | null,
    consultation_value: row.consultation_value as number | null,
    patient_name: patient?.full_name || null,
    patient_phone: patient?.phone || null,
    patient_sex: (patient?.sex as 'M' | 'F') || null,
    total_amount: row.total_amount as number | undefined,
    amount_paid: row.amount_paid as number | undefined,
  };
}

/** Verifica se um bloco cobre uma data específica (considerando recorrência) */
function blockCoversDate(block: RawBlock, dateStr: string): boolean {
  if (dateStr < block.start_date || dateStr > block.end_date) return false;
  if (block.recurrence === 'none' || block.recurrence === 'daily') return true;
  const targetDate = new Date(dateStr + 'T12:00:00');
  const startDate = new Date(block.start_date + 'T12:00:00');
  if (block.recurrence === 'weekly') return targetDate.getDay() === startDate.getDay();
  if (block.recurrence === 'monthly') return targetDate.getDate() === startDate.getDate();
  return true;
}

/** Gera set de time slots bloqueados para um dia */
function buildBlockedSlots(blocks: RawBlock[], dateStr: string, doctorId: number | null, allSlots: string[]): Set<string> {
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

/** Gera mapa de bloqueios por dia para a semana */
function buildWeekBlocks(blocks: RawBlock[], weekDays: Date[], doctorId: number | null): Record<string, DayBlock[]> {
  const map: Record<string, DayBlock[]> = {};
  for (const day of weekDays) {
    const dateStr = day.toLocaleDateString('en-CA');
    const dayBlocks: DayBlock[] = [];
    for (const block of blocks) {
      if (doctorId && block.doctor_id && block.doctor_id !== doctorId) continue;
      if (!blockCoversDate(block, dateStr)) continue;
      dayBlocks.push({ title: block.title, start_time: block.start_time, end_time: block.end_time, all_day: block.all_day });
    }
    if (dayBlocks.length > 0) map[dateStr] = dayBlocks;
  }
  return map;
}

export default function AtendimentoAgendaPage() {
  const { profile, loading: authLoading } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.getFullYear(), d.getMonth(), diff);
  });

  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  const [appointments, setAppointments] = useState<AtendimentoAppointment[]>([]);
  const [weekAppointments, setWeekAppointments] = useState<AtendimentoAppointment[]>([]);
  const [rawBlocks, setRawBlocks] = useState<RawBlock[]>([]);
  const [doctorId, setDoctorId] = useState<number | null>(null);
  const [doctors, setDoctors] = useState<Array<{ id: number; name: string }>>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<AtendimentoAppointment | null>(null);
  const [modalDate, setModalDate] = useState('');
  const [modalTime, setModalTime] = useState('');

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const currentTimeSlotRef = useRef<HTMLDivElement>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  const timeSlots = getTimeSlots(0, 24);

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() + i);
    return d;
  }), [currentWeekStart]);

  // Derivar doctor_id efetivo sem useEffect (evita cascading render)
  const effectiveDoctorId = (!authLoading && profile?.doctor_id) ? profile.doctor_id : doctorId;

  // Carregar médicos (doctors + professionals com agenda)
  useEffect(() => {
    (async () => {
      // 1. Carregar doctors existentes (tabela public.doctors)
      const { data: doctorsData } = await supabasePublic.from('doctors').select('id, name, professional_id').eq('active', true).order('name');
      const list: Array<{ id: number; name: string }> = doctorsData || [];

      // 2. Carregar profissionais com agenda que ainda não estão linkados
      const linkedIds = new Set((doctorsData || []).map((d: Record<string, unknown>) => d.professional_id).filter(Boolean));
      const { data: profsData } = await supabase.from('professionals').select('id, name').eq('has_schedule', true).eq('status', 'active');

      if (profsData) {
        for (const prof of profsData) {
          if (!linkedIds.has(prof.id)) {
            // Profissional com agenda mas sem doctor vinculado — mostrar na lista
            // Usa hash numérico negativo para não colidir com doctors.id (bigint)
            list.push({ id: -(list.length + 1000), name: prof.name });
          }
        }
      }

      setDoctors(list);
    })();
  }, []);

  // Buscar agendamentos + bloqueios
  useEffect(() => {
    if (authLoading) return;

    let cancelled = false;
    const selectQuery = '*, patients:patient_id(full_name, phone, sex)';

    (async () => {
      // Determinar range de datas
      let startStr: string;
      let endStr: string;
      if (viewMode === 'day') {
        startStr = currentDate.toLocaleDateString('en-CA');
        endStr = startStr;
      } else {
        startStr = currentWeekStart.toLocaleDateString('en-CA');
        const endWeek = new Date(currentWeekStart);
        endWeek.setDate(endWeek.getDate() + 6);
        endStr = endWeek.toLocaleDateString('en-CA');
      }

      // Fetch paralelo: agendamentos + bloqueios
      const appointmentPromise = (async () => {
        let query = supabase.from('appointments').select(selectQuery);
        if (viewMode === 'day') {
          query = query.eq('date', startStr).neq('status', 'cancelled').order('time');
        } else {
          query = query.gte('date', startStr).lte('date', endStr).neq('status', 'cancelled').order('date').order('time');
        }
        if (effectiveDoctorId) query = query.eq('doctor_id', effectiveDoctorId);
        return query;
      })();

      const blocksPromise = supabase
        .from('schedule_blocks')
        .select('doctor_id, title, start_date, end_date, start_time, end_time, all_day, recurrence')
        .lte('start_date', endStr)
        .gte('end_date', startStr);

      const [apptResult, blocksResult] = await Promise.all([appointmentPromise, blocksPromise]);

      if (cancelled) return;

      if (apptResult.data) {
        if (viewMode === 'day') setAppointments(apptResult.data.map(mapAppointment));
        else setWeekAppointments(apptResult.data.map(mapAppointment));
      }

      if (blocksResult.data) setRawBlocks(blocksResult.data as RawBlock[]);
    })();

    return () => { cancelled = true; };
  }, [currentDate, currentWeekStart, viewMode, effectiveDoctorId, authLoading, refreshKey]);

  // Derivar dados de bloqueio a partir de rawBlocks (sem setState em effect)
  const dayBlockedSlots = useMemo(() => {
    if (viewMode !== 'day') return new Set<string>();
    const dateStr = currentDate.toLocaleDateString('en-CA');
    return buildBlockedSlots(rawBlocks, dateStr, effectiveDoctorId, timeSlots);
  }, [rawBlocks, currentDate, effectiveDoctorId, viewMode, timeSlots]);

  const weekDayBlocksMap = useMemo(() => {
    if (viewMode !== 'week') return {};
    return buildWeekBlocks(rawBlocks, weekDays, effectiveDoctorId);
  }, [rawBlocks, weekDays, effectiveDoctorId, viewMode]);

  const triggerRefresh = useCallback(() => setRefreshKey(k => k + 1), []);

  // Atualizar relógio a cada minuto
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Scroll automático para horário atual na DayView
  useEffect(() => {
    if (viewMode === 'day' && scrollContainerRef.current) {
      const timeout = setTimeout(() => {
        const today = new Date();
        const isToday =
          today.getFullYear() === currentDate.getFullYear() &&
          today.getMonth() === currentDate.getMonth() &&
          today.getDate() === currentDate.getDate();
        if (isToday && currentTimeSlotRef.current && scrollContainerRef.current) {
          const container = scrollContainerRef.current;
          const slot = currentTimeSlotRef.current;
          const containerRect = container.getBoundingClientRect();
          const slotRect = slot.getBoundingClientRect();
          const scrollPosition = slot.offsetTop - containerRect.height / 2 + slotRect.height / 2;
          container.scrollTo({ top: Math.max(0, scrollPosition), behavior: 'smooth' });
        }
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [currentDate, viewMode, currentTime, appointments]);

  const changeDay = (days: number) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + days);
    setCurrentDate(newDate);
  };

  const changeWeek = (weeks: number) => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() + weeks * 7);
    setCurrentWeekStart(newDate);
  };

  const isCurrentTimeSlot = (time: string): boolean => {
    const today = new Date();
    const isToday =
      today.getFullYear() === currentDate.getFullYear() &&
      today.getMonth() === currentDate.getMonth() &&
      today.getDate() === currentDate.getDate();
    if (!isToday) return false;
    const [hours, minutes] = time.split(':').map(Number);
    const currentHours = currentTime.getHours();
    const currentMinutes = currentTime.getMinutes();
    if (hours === currentHours) {
      if (minutes === 0 && currentMinutes < 30) return true;
      if (minutes === 30 && currentMinutes >= 30) return true;
    }
    return false;
  };

  const isSlotBlocked = useCallback((time: string): boolean => {
    return dayBlockedSlots.has(time);
  }, [dayBlockedSlots]);

  const getAppointmentsAt = (time: string): AtendimentoAppointment[] => {
    return appointments.filter(app => {
      if (!app.time) return false;
      return app.time.substring(0, 5) === time;
    });
  };

  const openNewSlotModal = (dateStr?: string, timeStr?: string) => {
    setModalDate(dateStr || currentDate.toLocaleDateString('en-CA'));
    setModalTime(timeStr || '');
    setIsNewModalOpen(true);
  };

  // Wrapper para compatibilidade de tipo entre componentes e estado local
  const handleSelectAppointment = useCallback((app: Record<string, unknown>) => {
    setSelectedAppointment(app as AtendimentoAppointment);
  }, []);

  return (
    <div className="h-full flex flex-col bg-[#f8fafc] dark:bg-[#0b141a] transition-colors duration-300">
      <AtendimentoAgendaHeader
        viewMode={viewMode}
        setViewMode={setViewMode}
        currentDate={currentDate}
        currentWeekStart={currentWeekStart}
        weekDays={weekDays}
        changeDay={changeDay}
        changeWeek={changeWeek}
        openNewSlotModal={() => openNewSlotModal()}
        doctors={doctors}
        doctorId={effectiveDoctorId}
        setDoctorId={setDoctorId}
      />

      <div className="flex-1 overflow-hidden flex p-6 gap-6">
        <div className="flex-1 bg-white dark:bg-[#0a0a0c] rounded-2xl border border-slate-100 dark:border-[#27272a] shadow-sm overflow-hidden flex flex-col transition-colors">
          {viewMode === 'day' ? (
            <AtendimentoDayView
              timeSlots={timeSlots}
              scrollContainerRef={scrollContainerRef}
              currentTimeSlotRef={currentTimeSlotRef}
              getAppointmentsAt={getAppointmentsAt}
              isCurrentTimeSlot={isCurrentTimeSlot}
              isSlotBlocked={isSlotBlocked}
              setSelectedAppointment={handleSelectAppointment}
              openNewSlotModal={openNewSlotModal}
            />
          ) : (
            <AtendimentoWeekView
              weekDays={weekDays}
              weekAppointments={weekAppointments}
              dayBlocks={weekDayBlocksMap}
              setSelectedAppointment={handleSelectAppointment}
              openNewSlotModal={openNewSlotModal}
            />
          )}
        </div>

        {viewMode === 'day' && (
          <AtendimentoSidebar currentDate={currentDate} setCurrentDate={setCurrentDate} />
        )}
      </div>

      {selectedAppointment && (
        <AtendimentoDetailModal
          selectedAppointment={selectedAppointment}
          setSelectedAppointment={setSelectedAppointment}
          doctors={doctors}
          onSaveSuccess={triggerRefresh}
        />
      )}

      <NewAppointmentModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onSuccess={triggerRefresh}
        initialDate={modalDate}
        initialTime={modalTime}
      />
    </div>
  );
}
