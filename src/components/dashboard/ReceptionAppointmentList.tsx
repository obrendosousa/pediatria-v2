'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Appointment } from '@/types/medical';
import { getLocalDateRange, formatAppointmentTime } from '@/utils/dateUtils';
import { 
  Clock, MessageCircle, MapPin, Megaphone, Loader2, 
  User, Stethoscope, Phone, GripVertical, Undo2
} from 'lucide-react';

interface ReceptionAppointmentListProps {
  selectedDate: string;
  onCallAppointment?: (appointment: Appointment) => void;
  onCheckIn?: (appointment: Appointment) => void;
  onRevertStatus?: (appointment: Appointment, newStatus: string) => void;
  calledAppointmentId?: number | null;
}

export default function ReceptionAppointmentList({ 
  selectedDate, 
  onCallAppointment,
  onCheckIn,
  onRevertStatus,
  calledAppointmentId 
}: ReceptionAppointmentListProps) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState<number | null>(null);

  const fetchAppointments = async () => {
    setLoading(true);
    // Usar função utilitária para garantir timezone correto
    const { startOfDay, endOfDay } = getLocalDateRange(selectedDate);
    
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .gte('start_time', startOfDay)
      .lte('start_time', endOfDay)
      .in('status', ['scheduled', 'waiting'])
      .neq('status', 'cancelled')
      .neq('status', 'blocked')
      .order('start_time', { ascending: true });

    if (error) {
      console.error('Erro ao buscar agendamentos:', error);
    } else {
      setAppointments((data as Appointment[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAppointments();
    
    const channel = supabase
      .channel('reception_appointments')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'appointments' 
      }, () => {
        fetchAppointments();
      })
      .subscribe();

    return () => { 
      supabase.removeChannel(channel); 
    };
  }, [selectedDate]);

  // Usar função utilitária para formatação de horário
  const formatTime = formatAppointmentTime;

  const handleCheckIn = async (appointment: Appointment) => {
    if (appointment.status === 'waiting') return; // Já está na fila
    
    setIsUpdating(appointment.id);
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'waiting' })
        .eq('id', appointment.id);

      if (error) throw error;
      
      if (onCheckIn) onCheckIn(appointment);
      fetchAppointments();
    } catch (error: any) {
      console.error('Erro ao fazer check-in:', error);
      alert('Erro ao fazer check-in: ' + (error.message || 'Tente novamente.'));
    } finally {
      setIsUpdating(null);
    }
  };

  const handleRevertStatus = async (appointment: Appointment, newStatus: string) => {
    if (!confirm(`Deseja reverter o status deste paciente para "${newStatus === 'scheduled' ? 'Agendado' : 'Na Espera'}"?`)) {
      return;
    }
    
    setIsUpdating(appointment.id);
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: newStatus })
        .eq('id', appointment.id);

      if (error) throw error;
      
      if (onRevertStatus) onRevertStatus(appointment, newStatus);
      fetchAppointments();
    } catch (error: any) {
      console.error('Erro ao reverter status:', error);
      alert('Erro ao reverter status: ' + (error.message || 'Tente novamente.'));
    } finally {
      setIsUpdating(null);
    }
  };

  if (loading) {
    return (
      <div className="text-center p-10 text-slate-400 dark:text-gray-500">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
        Carregando...
      </div>
    );
  }

  const scheduledAppointments = appointments.filter(a => a.status === 'scheduled');
  const waitingAppointments = appointments.filter(a => a.status === 'waiting');

  return (
    <div className="space-y-3">
      {/* Agendados (ainda não chegaram) */}
      {scheduledAppointments.map((apt) => {
        const isCalled = calledAppointmentId === apt.id;
        return (
          <div
            key={apt.id}
            className={`bg-white dark:bg-[#202c33] p-4 rounded-2xl border shadow-sm transition-all group relative ${
              isCalled 
                ? 'border-amber-300 dark:border-amber-700 shadow-md ring-2 ring-amber-200 dark:ring-amber-800/50 bg-amber-50/50 dark:bg-amber-900/20' 
                : 'border-slate-100 dark:border-gray-700 hover:border-rose-200'
            }`}
          >
            {isCalled && (
              <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-bold shadow-sm animate-pulse">
                !
              </div>
            )}
            <div className="flex items-start gap-3 mb-3">
              <div className="p-2 bg-slate-50 dark:bg-white/5 rounded-xl text-slate-400 group-hover:text-rose-400 transition-colors">
                <Clock className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div>
                  <p className="font-bold text-slate-800 dark:text-gray-200 text-base flex items-center gap-2">
                    {apt.patient_name || 'Sem nome'}
                  </p>
                  {apt.patient_phone && (
                    <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5 truncate">
                      {apt.patient_phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-slate-500 dark:text-gray-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatTime(apt.start_time)}
                    </span>
                    {apt.doctor_name && (
                      <span className="text-[10px] text-slate-500 dark:text-gray-400 flex items-center gap-1">
                        <Stethoscope className="w-3 h-3" />
                        {apt.doctor_name}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-slate-50 dark:border-gray-700 pt-3 gap-2">
              <button
                onClick={() => onCallAppointment && onCallAppointment(apt)}
                className="flex-1 bg-rose-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-rose-600 shadow-md shadow-rose-200 dark:shadow-none flex items-center justify-center gap-1.5 transition-transform active:scale-95"
              >
                <Megaphone className="w-3 h-3" /> CHAMAR
              </button>
              <button
                onClick={() => handleCheckIn(apt)}
                disabled={isUpdating === apt.id || apt.status === 'waiting'}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUpdating === apt.id ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <MapPin size={12} />
                )}
                Check-in
              </button>
            </div>
            {isCalled && (
              <div className="mt-2 pt-2 border-t border-amber-200 dark:border-amber-800">
                <button
                  onClick={() => handleRevertStatus(apt, 'scheduled')}
                  disabled={isUpdating === apt.id}
                  className="w-full bg-amber-100 dark:bg-amber-900/30 hover:bg-amber-200 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300 px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUpdating === apt.id ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <>
                      <Undo2 size={12} /> Desfazer Chamada
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* Na Espera (já fizeram check-in) */}
      {waitingAppointments.map((apt, idx) => (
        <div
          key={apt.id}
          className={`bg-white dark:bg-[#202c33] p-4 rounded-2xl border shadow-sm transition-all group cursor-grab active:cursor-grabbing relative ${
            idx === 0 
              ? 'border-rose-300 dark:border-rose-700 shadow-md ring-1 ring-rose-100 dark:ring-rose-900/50' 
              : 'border-slate-100 dark:border-gray-700 hover:border-rose-200'
          }`}
        >
          <div className={`absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow-sm ${
            idx === 0 
              ? 'bg-rose-500 text-white animate-pulse' 
              : 'bg-slate-200 dark:bg-gray-600 text-slate-500 dark:text-gray-300'
          }`}>
            {idx + 1}º
          </div>
          <div className="flex items-start gap-3 mb-3">
            <div className="p-2 bg-slate-50 dark:bg-white/5 rounded-xl text-slate-400 group-hover:text-rose-400 transition-colors">
              <GripVertical className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div>
                <p className="font-bold text-slate-800 dark:text-gray-200 text-base flex items-center gap-2">
                  {apt.patient_name || 'Sem nome'}
                </p>
                {apt.patient_phone && (
                  <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5 truncate">
                    {apt.patient_phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-slate-500 dark:text-gray-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTime(apt.start_time)}
                  </span>
                  {apt.doctor_name && (
                    <span className="text-[10px] text-slate-500 dark:text-gray-400 flex items-center gap-1">
                      <Stethoscope className="w-3 h-3" />
                      {apt.doctor_name}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-slate-50 dark:border-gray-700 pt-3 gap-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-gray-400 bg-slate-50 dark:bg-white/5 px-2 py-1 rounded-lg">
              <Clock className="w-3.5 h-3.5" />
              <span className="font-bold">{formatTime(apt.start_time)}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleRevertStatus(apt, 'scheduled')}
                disabled={isUpdating === apt.id}
                className="bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Reverter para Agendado"
              >
                {isUpdating === apt.id ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Undo2 size={12} />
                )}
              </button>
              <button
                onClick={() => onCallAppointment && onCallAppointment(apt)}
                className="bg-rose-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-rose-600 shadow-md shadow-rose-200 dark:shadow-none flex items-center gap-1.5 transition-transform active:scale-95"
              >
                <Megaphone className="w-3 h-3" /> CHAMAR
              </button>
            </div>
          </div>
        </div>
      ))}

      {appointments.length === 0 && (
        <div className="text-center p-10 text-slate-400 dark:text-gray-600 opacity-60 flex flex-col items-center gap-2">
          <User className="w-8 h-8 stroke-1"/>
          <p>Nenhum agendamento para hoje.</p>
        </div>
      )}
    </div>
  );
}
