'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { createSchemaClient } from '@/lib/supabase/schemaClient';
import { getTimeSlots } from '@/app/agenda/utils/agendaUtils';
import { useAuth } from '@/contexts/AuthContext';

import AtendimentoAgendaHeader from '@/components/atendimento/agenda/AtendimentoAgendaHeader';
import AtendimentoDayView from '@/components/atendimento/agenda/AtendimentoDayView';
import AtendimentoWeekView from '@/components/atendimento/agenda/AtendimentoWeekView';
import AtendimentoSidebar from '@/components/atendimento/agenda/AtendimentoSidebar';
import NewAppointmentModal from '@/components/atendimento/agenda/NewAppointmentModal';
import AtendimentoDetailModal from '@/components/atendimento/agenda/AtendimentoDetailModal';

const supabase = createSchemaClient('atendimento');

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

function mapAppointment(row: Record<string, unknown>): AtendimentoAppointment {
  const patient = row.patients as { full_name?: string; phone?: string; sex?: string } | null;
  return {
    id: row.id as number,
    date: row.date as string,
    time: row.time as string | null,
    patient_id: row.patient_id as number | null,
    doctor_id: row.doctor_id as number | null,
    type: row.type as string | null,
    status: row.status as string,
    notes: row.notes as string | null,
    parent_name: row.parent_name as string | null,
    parent_phone: row.parent_phone as string | null,
    consultation_value: row.consultation_value as number | null,
    patient_name: patient?.full_name || null,
    patient_phone: patient?.phone || null,
    patient_sex: (patient?.sex as 'M' | 'F') || null,
  };
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

  // Carregar médicos (tabela public.doctors via cross-schema)
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('doctors').select('id, name').eq('active', true).order('name');
      if (data) setDoctors(data);
    })();
  }, []);

  // Buscar agendamentos — lógica inline no effect para evitar set-state-in-effect
  useEffect(() => {
    if (authLoading) return;

    let cancelled = false;
    const selectQuery = '*, patients:patient_id(full_name, phone, sex)';

    (async () => {
      if (viewMode === 'day') {
        const dateStr = currentDate.toLocaleDateString('en-CA');
        let query = supabase
          .from('appointments')
          .select(selectQuery)
          .eq('date', dateStr)
          .neq('status', 'cancelled')
          .order('time');
        if (effectiveDoctorId) query = query.eq('doctor_id', effectiveDoctorId);
        const { data } = await query;
        if (!cancelled && data) setAppointments(data.map(mapAppointment));
      } else {
        const startStr = currentWeekStart.toLocaleDateString('en-CA');
        const endWeek = new Date(currentWeekStart);
        endWeek.setDate(endWeek.getDate() + 6);
        const endStr = endWeek.toLocaleDateString('en-CA');
        let query = supabase
          .from('appointments')
          .select(selectQuery)
          .gte('date', startStr)
          .lte('date', endStr)
          .neq('status', 'cancelled')
          .order('date')
          .order('time');
        if (effectiveDoctorId) query = query.eq('doctor_id', effectiveDoctorId);
        const { data } = await query;
        if (!cancelled && data) setWeekAppointments(data.map(mapAppointment));
      }
    })();

    return () => { cancelled = true; };
  }, [currentDate, currentWeekStart, viewMode, effectiveDoctorId, authLoading, refreshKey]);

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
        <div className="flex-1 bg-white dark:bg-[#1e2028] rounded-2xl border border-slate-100 dark:border-gray-800 shadow-sm overflow-hidden flex flex-col transition-colors">
          {viewMode === 'day' ? (
            <AtendimentoDayView
              timeSlots={timeSlots}
              scrollContainerRef={scrollContainerRef}
              currentTimeSlotRef={currentTimeSlotRef}
              getAppointmentsAt={getAppointmentsAt}
              isCurrentTimeSlot={isCurrentTimeSlot}
              setSelectedAppointment={handleSelectAppointment}
              openNewSlotModal={openNewSlotModal}
            />
          ) : (
            <AtendimentoWeekView
              weekDays={weekDays}
              weekAppointments={weekAppointments}
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
