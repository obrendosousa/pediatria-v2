'use client';

import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Appointment } from '@/types/medical';
import { PatientMedicalRecordView } from '@/components/medical-record/PatientMedicalRecordView';
import { findPatientByPhone } from '@/utils/patientUtils';
import { linkAppointmentToPatient, createBasicPatientFromAppointment } from '@/utils/patientRelations';
import { getLocalDateRange, formatAppointmentTime as formatTimeUtil, isAppointmentOnDate, getTodayDateString } from '@/utils/dateUtils';
import OrphanedAppointmentsModal from '@/components/medical-record/OrphanedAppointmentsModal';
import {
  Stethoscope, Clock, Loader2, Users,
  Phone, Calendar, UserCheck, User
} from 'lucide-react';

const supabase = createClient();

export default function AtendimentoDoctorPage() {
  const { profile } = useAuth();
  const searchParams = useSearchParams();

  const patientIdParam = useMemo(() => searchParams?.get('patientId') || null, [searchParams]);
  const appointmentIdParam = useMemo(() => searchParams?.get('appointmentId') || null, [searchParams]);

  const [loading, setLoading] = useState(true);
  const [patientId, setPatientId] = useState<number | null>(null);
  const [appointmentId, setAppointmentId] = useState<number | null>(null);
  const [currentAppointment, setCurrentAppointment] = useState<Appointment | null>(null);
  const [appointmentsList, setAppointmentsList] = useState<Appointment[]>([]);
  const [orphanedAppointments, setOrphanedAppointments] = useState<Appointment[]>([]);
  const [isOrphanedModalOpen, setIsOrphanedModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(getTodayDateString());
  const [displayDate, setDisplayDate] = useState(() => {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    return `${day}/${month}/${year}`;
  });

  const fetchAppointment = async (id: number) => {
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Erro ao buscar agendamento:', error);
    } else {
      setCurrentAppointment(data as Appointment);
    }
  };

  const checkForOrphanedAppointments = async () => {
    try {
      const today = getTodayDateString();
      const { startOfDay: todayStart } = getLocalDateRange(today);

      let orphanedQuery = supabase
        .from('appointments')
        .select('*')
        .eq('status', 'in_service')
        .lt('start_time', todayStart)
        .order('start_time', { ascending: false });

      if (profile?.doctor_id) {
        orphanedQuery = orphanedQuery.eq('doctor_id', profile.doctor_id);
      }

      const { data: orphaned, error } = await orphanedQuery;

      if (error) {
        console.error('Erro ao buscar atendimentos órfãos:', error);
        return;
      }

      if (orphaned && orphaned.length > 0) {
        const lastAlertDate = localStorage.getItem('orphanedAppointmentsAlertDate');
        const today2 = new Date().toDateString();

        if (lastAlertDate !== today2) {
          setOrphanedAppointments(orphaned as Appointment[]);
          setIsOrphanedModalOpen(true);
        }
      }
    } catch (err) {
      console.error('Erro ao verificar atendimentos órfãos:', err);
    }
  };

  const checkForInServicePatient = async (appointments?: Appointment[]) => {
    try {
      let inService: Appointment | null = null;

      if (appointments && appointments.length > 0) {
        inService = appointments.find(a => a.status === 'in_service') || null;
      }

      if (!inService) {
        let q = supabase
          .from('appointments')
          .select('*')
          .eq('status', 'in_service')
          .order('start_time', { ascending: false })
          .limit(1);

        if (profile?.doctor_id) {
          q = q.eq('doctor_id', profile.doctor_id);
        }

        const { data, error } = await q.maybeSingle();
        if (error) {
          console.error('Erro ao buscar paciente em atendimento:', error);
          return;
        }
        if (data) inService = data as Appointment;
      }

      if (inService) {
        setAppointmentId(inService.id);

        if ((inService as Record<string, unknown>).patient_id) {
          setPatientId((inService as Record<string, unknown>).patient_id as number);
          setCurrentAppointment(null);
          return;
        }

        if (inService.patient_phone) {
          const found = await findPatientByPhone(inService.patient_phone);
          if (found) {
            setPatientId(found);
            setCurrentAppointment(null);
            await linkAppointmentToPatient(inService.id, found);
          } else {
            const created = await createBasicPatientFromAppointment(inService);
            if (created) {
              await linkAppointmentToPatient(inService.id, created);
              setPatientId(created);
              setCurrentAppointment(null);
            } else {
              const retry = await findPatientByPhone(inService.patient_phone);
              if (retry) {
                setPatientId(retry);
                setCurrentAppointment(null);
                await linkAppointmentToPatient(inService.id, retry);
              } else {
                setPatientId(null);
                setCurrentAppointment(null);
              }
            }
          }
        } else {
          const created = await createBasicPatientFromAppointment(inService);
          if (created) {
            await linkAppointmentToPatient(inService.id, created);
            setPatientId(created);
            setCurrentAppointment(null);
          } else {
            setPatientId(null);
            setCurrentAppointment(null);
          }
        }
      } else {
        setPatientId(null);
        setAppointmentId(null);
        setCurrentAppointment(null);
      }
    } catch (err) {
      console.error('Erro ao verificar paciente em atendimento:', err);
    }
  };

  const fetchAppointments = async () => {
    try {
      const { startOfDay, endOfDay } = getLocalDateRange(selectedDate);

      let query = supabase
        .from('appointments')
        .select('*')
        .gte('start_time', startOfDay)
        .lte('start_time', endOfDay)
        .neq('status', 'cancelled')
        .neq('status', 'blocked')
        .order('start_time', { ascending: true });

      if (profile?.doctor_id) {
        query = query.eq('doctor_id', profile.doctor_id);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Erro ao buscar appointments:', error);
        setAppointmentsList([]);
        return;
      }

      const all = (data as Appointment[] || []).filter(apt =>
        isAppointmentOnDate(apt.start_time, selectedDate)
      );
      setAppointmentsList(all);

      let inServiceQuery = supabase
        .from('appointments')
        .select('*')
        .eq('status', 'in_service')
        .order('start_time', { ascending: false })
        .limit(1);

      if (profile?.doctor_id) {
        inServiceQuery = inServiceQuery.eq('doctor_id', profile.doctor_id);
      }

      const { data: inServiceData, error: inServiceError } = await inServiceQuery.maybeSingle();

      if (inServiceError) {
        console.error('Erro ao buscar paciente em atendimento:', inServiceError);
      }

      if (inServiceData) {
        await checkForInServicePatient([inServiceData as Appointment]);
      } else {
        setPatientId(null);
        setAppointmentId(null);
        setCurrentAppointment(null);
      }

      if (selectedDate === getTodayDateString()) {
        await checkForOrphanedAppointments();
      }
    } catch (err) {
      console.error('Erro inesperado ao buscar appointments:', err);
      setAppointmentsList([]);
    }
  };

  useEffect(() => {
    if (patientIdParam) {
      const id = parseInt(patientIdParam);
      if (!isNaN(id)) setPatientId(id);
    }
    if (appointmentIdParam) {
      const id = parseInt(appointmentIdParam);
      if (!isNaN(id)) {
        setAppointmentId(id);
        fetchAppointment(id);
      }
    }
    fetchAppointments();
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientIdParam, appointmentIdParam]);

  useEffect(() => {
    fetchAppointments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('atendimento_doctor_appointments')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'appointments'
      }, async () => {
        await fetchAppointments();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  const handleDateInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 8) value = value.slice(0, 8);
    if (value.length >= 2) value = value.slice(0, 2) + '/' + value.slice(2);
    if (value.length >= 5) value = value.slice(0, 5) + '/' + value.slice(5);
    setDisplayDate(value);
  };

  const handleDateBlur = () => {
    const [day, month, year] = displayDate.split('/');
    if (day && month && year && day.length === 2 && month.length === 2 && year.length === 4) {
      setSelectedDate(`${year}-${month}-${day}`);
    } else {
      const todayStr = getTodayDateString();
      const [y, m, d] = todayStr.split('-');
      setDisplayDate(`${d}/${m}/${y}`);
      setSelectedDate(todayStr);
    }
  };

  const formatTime = formatTimeUtil;

  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      scheduled: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
      called: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
      waiting: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
      in_service: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
    };
    return map[status] || 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300';
  };

  const getStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      scheduled: 'Agendado',
      called: 'Chamado',
      waiting: 'Na Fila',
      in_service: 'Em Atendimento',
      finished: 'Concluído',
    };
    return map[status] || status;
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-[#15171e]">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
      </div>
    );
  }

  // Fallback: create patient when we have appointment but no patient
  if (currentAppointment && !patientId) {
    (async () => {
      const newPatientId = await createBasicPatientFromAppointment(currentAppointment);
      if (newPatientId) {
        await linkAppointmentToPatient(currentAppointment.id, newPatientId);
        setPatientId(newPatientId);
        setCurrentAppointment(null);
        fetchAppointments();
      }
    })();

    return (
      <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-[#15171e]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-teal-500 mx-auto mb-4" />
          <p className="text-slate-600 dark:text-[#a1a1aa]">Criando cadastro do paciente...</p>
        </div>
      </div>
    );
  }

  const scheduled = appointmentsList.filter(a => a.status === 'scheduled');
  const called = appointmentsList.filter(a => a.status === 'called');
  const waiting = appointmentsList.filter(a => a.status === 'waiting').sort((a, b) =>
    new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );
  const inService = appointmentsList.filter(a => a.status === 'in_service');
  const finished = appointmentsList.filter(a => a.status === 'finished').sort((a, b) =>
    new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
  );

  const renderCard = (apt: Appointment, index?: number, showPosition?: boolean) => (
    <div
      key={apt.id}
      className={`p-3 rounded-lg border ${
        apt.status === 'scheduled' ? 'border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10' :
        apt.status === 'called' ? 'border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10' :
        apt.status === 'waiting' ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10' :
        apt.status === 'in_service' ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10' :
        'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/20 opacity-90'
      }`}
    >
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {showPosition && index !== undefined && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
              index === 0 ? 'bg-teal-500 text-white' : 'bg-slate-200 dark:bg-gray-600 text-slate-600 dark:text-[#d4d4d8]'
            }`}>
              {index + 1}º
            </span>
          )}
          <h4 className="font-semibold text-sm text-slate-800 dark:text-[#fafafa] truncate">
            {apt.patient_name || 'Sem nome'}
          </h4>
        </div>
        <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${getStatusBadge(apt.status || '')}`}>
          {getStatusLabel(apt.status || '')}
        </span>
      </div>
      <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-[#a1a1aa] mt-1">
        <Clock className="w-3 h-3" />
        <span>{formatTime(apt.start_time)}</span>
        {apt.doctor_name && (
          <>
            <span>·</span>
            <span className="truncate">{apt.doctor_name}</span>
          </>
        )}
      </div>
      {apt.patient_phone && (
        <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-[#a1a1aa] mt-1">
          <Phone className="w-3 h-3" />
          <span>{apt.patient_phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')}</span>
        </div>
      )}
    </div>
  );

  const renderGroup = (
    title: string,
    icon: React.ReactNode,
    items: Appointment[],
    showPosition = false
  ) => {
    if (items.length === 0) return null;
    return (
      <div className="mb-4">
        <h3 className="text-xs font-bold text-slate-500 dark:text-[#a1a1aa] uppercase mb-2 flex items-center gap-2">
          {icon}
          {title} ({items.length})
        </h3>
        <div className="space-y-2">
          {items.map((apt, i) => renderCard(apt, i, showPosition))}
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex bg-slate-50 dark:bg-[#15171e] relative overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 bg-white dark:bg-[#0a0a0c] border-r border-slate-200 dark:border-[#27272a] flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-[#27272a]">
          <div className="flex items-center gap-2 mb-3">
            <Stethoscope className="w-5 h-5 text-teal-500" />
            <h2 className="font-bold text-lg text-slate-800 dark:text-[#fafafa]">Painel Médico</h2>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-500 dark:text-[#a1a1aa]" />
            <input
              type="text"
              value={displayDate}
              onChange={handleDateInput}
              onBlur={handleDateBlur}
              placeholder="DD/MM/YYYY"
              maxLength={10}
              className="text-sm font-semibold text-slate-700 dark:text-gray-200 bg-transparent outline-none w-32"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3">
          {renderGroup('Agendados', <Clock className="w-3 h-3" />, scheduled)}
          {renderGroup('Chamados', <UserCheck className="w-3 h-3" />, called)}
          {renderGroup('Na Fila', <User className="w-3 h-3" />, waiting, true)}
          {renderGroup('Em Atendimento', <Stethoscope className="w-3 h-3" />, inService)}
          {renderGroup('Concluídos', <UserCheck className="w-3 h-3" />, finished)}

          {scheduled.length === 0 && called.length === 0 && waiting.length === 0 && inService.length === 0 && finished.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="w-12 h-12 text-slate-300 dark:text-gray-600 mb-3" />
              <p className="text-sm text-slate-500 dark:text-[#a1a1aa] font-medium">Nenhum paciente agendado</p>
              <p className="text-xs text-slate-400 dark:text-[#71717a] mt-1">Os pacientes aparecerão aqui quando forem agendados</p>
            </div>
          )}
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col bg-slate-50 dark:bg-[#15171e] relative overflow-hidden">
        {patientId ? (
          <PatientMedicalRecordView
            patientId={patientId}
            appointmentId={appointmentId}
            currentDoctorId={profile?.doctor_id}
            onRefresh={() => {
              if (appointmentId) fetchAppointment(appointmentId);
              fetchAppointments();
            }}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center max-w-md">
              <Stethoscope className="w-20 h-20 text-teal-500/50 mx-auto mb-6" />
              <h2 className="text-2xl font-bold text-slate-800 dark:text-[#fafafa] mb-2">Aguardando Prontuário</h2>
              <p className="text-slate-600 dark:text-[#a1a1aa]">
                Quando um paciente for colocado em atendimento, o prontuário aparecerá automaticamente aqui.
              </p>
              {waiting.length > 0 && (
                <div className="mt-6 p-4 bg-teal-50 dark:bg-teal-900/10 rounded-lg border border-teal-200 dark:border-teal-800">
                  <p className="text-sm font-semibold text-teal-700 dark:text-teal-300">
                    {waiting.length} paciente{waiting.length > 1 ? 's' : ''} na fila
                  </p>
                  {waiting[0] && (
                    <p className="text-xs text-teal-600 dark:text-teal-400 mt-1">
                      Próximo: {waiting[0].patient_name || 'Sem nome'}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <OrphanedAppointmentsModal
        isOpen={isOrphanedModalOpen}
        onClose={() => setIsOrphanedModalOpen(false)}
        appointments={orphanedAppointments}
        onFinalize={async (id) => {
          setOrphanedAppointments(prev => prev.filter(a => a.id !== id));
          if (id === appointmentId) {
            setPatientId(null);
            setAppointmentId(null);
            setCurrentAppointment(null);
          }
        }}
        onRefresh={fetchAppointments}
      />
    </div>
  );
}
