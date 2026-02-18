'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
const supabase = createClient();
import NewSlotModal from '@/components/NewSlotModal';
import { getLocalDateRange } from '@/utils/dateUtils';
import { getTimeSlots } from './utils/agendaUtils';
import AgendaHeader from './components/AgendaHeader';
import DayView from './components/DayView';
import WeekView from './components/WeekView';
import AgendaSidebar from './components/AgendaSidebar';
import AppointmentDetailModal from './components/AppointmentDetailModal';

import { useAuth } from '@/contexts/AuthContext';

export default function AgendaPage() {
  const { profile, loading: authLoading } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
  });

  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  const [appointments, setAppointments] = useState<any[]>([]);
  const [weekAppointments, setWeekAppointments] = useState<any[]>([]);
  const [doctorId, setDoctorId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<any | null>(null);
  const [doctors, setDoctors] = useState<Array<{ id: number; name: string }>>([]);
  const [modalDate, setModalDate] = useState('');
  const [modalTime, setModalTime] = useState('');

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const currentTimeSlotRef = useRef<HTMLDivElement>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  const startHour = 0;
  const endHour = 24;
  const timeSlots = getTimeSlots(startHour, endHour);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  useEffect(() => {
    if (!authLoading && profile?.doctor_id) {
      setDoctorId(profile.doctor_id);
    }
  }, [profile, authLoading]);

  useEffect(() => {
    if (!authLoading) {
      fetchData();
    }
  }, [currentDate, currentWeekStart, viewMode, doctorId, authLoading]);

  useEffect(() => {
    const updateTime = () => setCurrentTime(new Date());
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (viewMode === 'day' && scrollContainerRef.current) {
      const scrollToCurrentTime = () => {
        const today = new Date();
        const selectedDate = new Date(currentDate);
        const isToday =
          today.getFullYear() === selectedDate.getFullYear() &&
          today.getMonth() === selectedDate.getMonth() &&
          today.getDate() === selectedDate.getDate();
        if (isToday && currentTimeSlotRef.current && scrollContainerRef.current) {
          const container = scrollContainerRef.current;
          const slot = currentTimeSlotRef.current;
          const containerRect = container.getBoundingClientRect();
          const slotRect = slot.getBoundingClientRect();
          const scrollPosition = slot.offsetTop - containerRect.height / 2 + slotRect.height / 2;
          container.scrollTo({ top: Math.max(0, scrollPosition), behavior: 'smooth' });
        }
      };
      const timeout = setTimeout(scrollToCurrentTime, 300);
      return () => clearTimeout(timeout);
    }
  }, [currentDate, viewMode, currentTime, appointments]);

  useEffect(() => {
    async function fetchDoctors() {
      try {
        const { data, error } = await supabase.from('doctors').select('id, name').eq('active', true).order('name');
        if (error) throw error;
        if (data) setDoctors(data);
      } catch (err) {
        console.error('Erro ao carregar médicos:', err);
      }
    }
    fetchDoctors();
  }, []);

  async function fetchData() {
    setLoading(true);
    let dId = doctorId;

    // Se usuário é médico, forçar seu ID
    if (profile?.doctor_id) {
      dId = profile.doctor_id;
      if (doctorId !== dId) setDoctorId(dId);
    }

    if (!dId) {
      const { data: doc } = await supabase.from('doctors').select('id').limit(1).single();
      if (doc) {
        dId = doc.id;
        setDoctorId(doc.id);
      } else {
        setLoading(false);
        return;
      }
    }
    if (viewMode === 'day') {
      const startStr = currentDate.toLocaleDateString('en-CA');
      const { startOfDay, endOfDay } = getLocalDateRange(startStr);
      const { data } = await supabase
        .from('appointments')
        .select('*')
        .eq('doctor_id', dId)
        .gte('start_time', startOfDay)
        .lte('start_time', endOfDay)
        .neq('status', 'cancelled')
        .order('start_time');
      if (data) setAppointments(data);
    } else {
      const startWeekStr = currentWeekStart.toLocaleDateString('en-CA');
      const endWeek = new Date(currentWeekStart);
      endWeek.setDate(endWeek.getDate() + 6);
      const endWeekStr = endWeek.toLocaleDateString('en-CA');
      const { startOfDay: weekStart } = getLocalDateRange(startWeekStr);
      const { endOfDay: weekEnd } = getLocalDateRange(endWeekStr);
      const { data } = await supabase
        .from('appointments')
        .select('*')
        .eq('doctor_id', dId)
        .gte('start_time', weekStart)
        .lte('start_time', weekEnd)
        .neq('status', 'cancelled')
        .order('start_time');
      if (data) setWeekAppointments(data);
    }
    setLoading(false);
  }

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
    const selectedDate = new Date(currentDate);
    const isToday =
      today.getFullYear() === selectedDate.getFullYear() &&
      today.getMonth() === selectedDate.getMonth() &&
      today.getDate() === selectedDate.getDate();
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

  const getAppointmentAt = (time: string) => {
    return appointments.find(app => {
      const dateStr = app.start_time;
      if (!dateStr) return false;
      const cleanDateStr = dateStr.replace(/[+-]\d{2}:\d{2}$/, '').replace('Z', '');
      const [datePart, timePart] = cleanDateStr.split('T');
      if (!datePart || !timePart) return false;
      const [year, month, day] = datePart.split('-').map(Number);
      const [hours, minutes] = timePart.split(':').map(Number);
      const d = new Date(year, month - 1, day, hours, minutes || 0, 0);
      const appTime = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false });
      return appTime === time;
    });
  };

  const openNewSlotModal = (dateStr?: string, timeStr?: string) => {
    setModalDate(dateStr || currentDate.toLocaleDateString('en-CA'));
    setModalTime(timeStr || '');
    setIsNewModalOpen(true);
  };

  return (
    <div className="h-full flex flex-col bg-[#f8fafc] dark:bg-[#0b141a] transition-colors duration-300">
      <AgendaHeader
        viewMode={viewMode}
        setViewMode={setViewMode}
        currentDate={currentDate}
        currentWeekStart={currentWeekStart}
        weekDays={weekDays}
        changeDay={changeDay}
        changeWeek={changeWeek}
        openNewSlotModal={() => openNewSlotModal()}
      />

      <div className="flex-1 overflow-hidden flex p-6 gap-6">
        <div className="flex-1 bg-white dark:bg-[#1e2028] rounded-2xl border border-slate-100 dark:border-gray-800 shadow-sm overflow-hidden flex flex-col transition-colors">
          {viewMode === 'day' ? (
            <DayView
              timeSlots={timeSlots}
              scrollContainerRef={scrollContainerRef}
              currentTimeSlotRef={currentTimeSlotRef}
              getAppointmentAt={getAppointmentAt}
              isCurrentTimeSlot={isCurrentTimeSlot}
              setSelectedAppointment={setSelectedAppointment}
              openNewSlotModal={openNewSlotModal}
            />
          ) : (
            <WeekView
              weekDays={weekDays}
              weekAppointments={weekAppointments}
              setSelectedAppointment={setSelectedAppointment}
              openNewSlotModal={openNewSlotModal}
            />
          )}
        </div>

        {viewMode === 'day' && (
          <AgendaSidebar currentDate={currentDate} setCurrentDate={setCurrentDate} />
        )}
      </div>

      {selectedAppointment && (
        <AppointmentDetailModal
          selectedAppointment={selectedAppointment}
          setSelectedAppointment={setSelectedAppointment}
          doctors={doctors}
          setAppointments={setAppointments}
          setWeekAppointments={setWeekAppointments}
          onSaveSuccess={fetchData}
        />
      )}

      <NewSlotModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onSuccess={fetchData}
        initialDate={modalDate}
        initialTime={modalTime}
      />
    </div>
  );
}
