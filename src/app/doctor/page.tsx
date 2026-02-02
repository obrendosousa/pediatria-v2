'use client';

import { useEffect, useState, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Appointment } from '@/types/medical';
import { PatientMedicalRecordView } from '@/components/medical-record/PatientMedicalRecordView';
import { findPatientByPhone } from '@/utils/patientUtils';
import { linkAppointmentToPatient, createBasicPatientFromAppointment } from '@/utils/patientRelations';
import { getLocalDateRange, formatAppointmentTime as formatTimeUtil, isAppointmentOnDate, getTodayDateString } from '@/utils/dateUtils';
import OrphanedAppointmentsModal from '@/components/medical-record/OrphanedAppointmentsModal';
import { 
  Stethoscope, Clock, Loader2, AlertCircle, Users, 
  Phone, Calendar, UserCheck, User
} from 'lucide-react';

export default function DoctorPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // Criar versão serializável dos searchParams para evitar erros do React DevTools
  const searchParamsString = useMemo(() => searchParams?.toString() || '', [searchParams]);
  const patientIdParam = useMemo(() => searchParams?.get('patientId') || null, [searchParams]);
  const appointmentIdParam = useMemo(() => searchParams?.get('appointmentId') || null, [searchParams]);
  
  const [loading, setLoading] = useState(true);
  const [patientId, setPatientId] = useState<number | null>(null);
  const [appointmentId, setAppointmentId] = useState<number | null>(null);
  const [currentAppointment, setCurrentAppointment] = useState<Appointment | null>(null);
  const [appointmentsList, setAppointmentsList] = useState<Appointment[]>([]);
  const [orphanedAppointments, setOrphanedAppointments] = useState<Appointment[]>([]);
  const [isOrphanedModalOpen, setIsOrphanedModalOpen] = useState(false);
  // Usar função utilitária para obter data atual no timezone local
  const [selectedDate, setSelectedDate] = useState(getTodayDateString());
  const [displayDate, setDisplayDate] = useState(() => {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    return `${day}/${month}/${year}`;
  });

  useEffect(() => {
    if (patientIdParam) {
      const id = parseInt(patientIdParam);
      if (!isNaN(id)) {
        setPatientId(id);
      }
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
  }, [selectedDate]);

  // Realtime subscription para atualizar quando status mudar
  // PRIORIDADE: Atualizar imediatamente quando um paciente entrar em atendimento
  useEffect(() => {
    const channel = supabase
      .channel('doctor_appointments')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'appointments'
      }, async (payload) => {
        console.log('[DoctorPage] Mudança detectada em appointment:', payload);
        // Se a mudança for para in_service, atualizar imediatamente
        if (payload.new && (payload.new as any).status === 'in_service') {
          console.log('[DoctorPage] Paciente entrou em atendimento, atualizando prontuário...');
        }
        // Atualizar sempre que houver mudança
        await fetchAppointments();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedDate]);

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

  const fetchAppointments = async () => {
    try {
      // PRIORIDADE: Primeiro buscar o paciente em atendimento (in_service) de QUALQUER data
      const { data: inServiceData, error: inServiceError } = await supabase
        .from('appointments')
        .select('*')
        .eq('status', 'in_service')
        .order('start_time', { ascending: false })
        .limit(1); // Apenas 1 paciente pode estar em atendimento

      if (inServiceError) {
        console.error('Erro ao buscar paciente em atendimento:', inServiceError);
      }

      // Se houver paciente em atendimento, priorizar exibir seu prontuário
      if (inServiceData && inServiceData.length > 0) {
        const inServiceAppointment = inServiceData[0] as Appointment;
        setAppointmentsList([inServiceAppointment]);
        await checkForInServicePatient([inServiceAppointment]);
        
        // Verificar atendimentos órfãos apenas se estiver visualizando o dia atual
        if (selectedDate === getTodayDateString()) {
          await checkForOrphanedAppointments();
        }
        return; // Não precisa buscar outros appointments se já temos um em atendimento
      }

      // Se não houver paciente em atendimento, buscar appointments do dia selecionado
      const { startOfDay, endOfDay } = getLocalDateRange(selectedDate);

      const { data: todayData, error: todayError } = await supabase
        .from('appointments')
        .select('*')
        .gte('start_time', startOfDay)
        .lte('start_time', endOfDay)
        .in('status', ['scheduled', 'called', 'waiting'])
        .order('start_time', { ascending: true });

      if (todayError) {
        console.error('Erro ao buscar appointments:', todayError);
        setAppointmentsList([]);
        return;
      }

      const todayAppointments = (todayData as Appointment[] || []);
      
      // Filtrar por data local usando função utilitária para garantir consistência
      const appointments = todayAppointments.filter(apt => 
        isAppointmentOnDate(apt.start_time, selectedDate)
      );
      
      setAppointmentsList(appointments);
      
      // Não há paciente em atendimento, limpar estados
      setPatientId(null);
      setAppointmentId(null);
      setCurrentAppointment(null);
      
      // Verificar atendimentos órfãos apenas se estiver visualizando o dia atual
      if (selectedDate === getTodayDateString()) {
        await checkForOrphanedAppointments();
      }
    } catch (err) {
      console.error('Erro inesperado ao buscar appointments:', err);
      setAppointmentsList([]);
    }
  };
  
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Se for formato DD/MM/YYYY, converter para YYYY-MM-DD
    if (value.includes('/')) {
      const [day, month, year] = value.split('/');
      if (day && month && year) {
        const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        setSelectedDate(isoDate);
        setDisplayDate(value);
      }
    } else {
      // Se for formato YYYY-MM-DD (input nativo)
      setSelectedDate(value);
      const [year, month, day] = value.split('-');
      setDisplayDate(`${day}/${month}/${year}`);
    }
  };
  
  const handleDateBlur = () => {
    // Validar e formatar data ao sair do campo
    const [day, month, year] = displayDate.split('/');
    if (day && month && year && day.length === 2 && month.length === 2 && year.length === 4) {
      const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      setSelectedDate(isoDate);
    } else {
      // Se inválido, resetar para data atual usando função utilitária
      const todayStr = getTodayDateString();
      const [year, month, day] = todayStr.split('-');
      setDisplayDate(`${day}/${month}/${year}`);
      setSelectedDate(todayStr);
    }
  };
  
  const handleDateInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, ''); // Remove tudo que não é dígito
    
    // Limitar a 8 dígitos (DDMMYYYY)
    if (value.length > 8) {
      value = value.slice(0, 8);
    }
    
    // Formatar como DD/MM/YYYY
    if (value.length >= 2) {
      value = value.slice(0, 2) + '/' + value.slice(2);
    }
    if (value.length >= 5) {
      value = value.slice(0, 5) + '/' + value.slice(5);
    }
    
    setDisplayDate(value);
  };

  const checkForOrphanedAppointments = async () => {
    try {
      const today = getTodayDateString();
      const { startOfDay: todayStart } = getLocalDateRange(today);
      
      // Buscar appointments em in_service de dias anteriores
      const { data: orphaned, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('status', 'in_service')
        .lt('start_time', todayStart)
        .order('start_time', { ascending: false });

      if (error) {
        console.error('Erro ao buscar atendimentos órfãos:', error);
        return;
      }

      if (orphaned && orphaned.length > 0) {
        // Verificar se o usuário já foi alertado hoje (localStorage)
        const lastAlertDate = localStorage.getItem('orphanedAppointmentsAlertDate');
        const today = new Date().toDateString();
        
        if (lastAlertDate !== today) {
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
      // Se não recebeu appointments, buscar diretamente do banco (prioridade máxima)
      let inService: Appointment | null = null;
      
      if (appointments && appointments.length > 0) {
        inService = appointments.find(a => a.status === 'in_service') || null;
      }
      
      // Se não encontrou nos appointments fornecidos, buscar diretamente do banco
      if (!inService) {
        const { data: inServiceData, error } = await supabase
          .from('appointments')
          .select('*')
          .eq('status', 'in_service')
          .order('start_time', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (error) {
          console.error('Erro ao buscar paciente em atendimento:', error);
          return;
        }
        
        if (inServiceData) {
          inService = inServiceData as Appointment;
        }
      }
      
      if (inService) {
        setAppointmentId(inService.id);
        
        // Primeiro, verificar se o appointment já tem patient_id
        if ((inService as any).patient_id) {
          setPatientId((inService as any).patient_id);
          setCurrentAppointment(null);
          return;
        }
        
        // Se não tem patient_id, buscar por telefone ou criar automaticamente
        if (inService.patient_phone) {
          const patientIdFound = await findPatientByPhone(inService.patient_phone);
          
          if (patientIdFound) {
            // Paciente encontrado - pular direto para prontuário
            setPatientId(patientIdFound);
            setCurrentAppointment(null);
            // Vincular appointment ao paciente encontrado
            await linkAppointmentToPatient(inService.id, patientIdFound);
          } else {
            // Paciente não cadastrado - criar automaticamente
            const newPatientId = await createBasicPatientFromAppointment(inService);
            if (newPatientId) {
              // Vincular appointment ao paciente criado
              await linkAppointmentToPatient(inService.id, newPatientId);
              setPatientId(newPatientId);
              setCurrentAppointment(null);
            } else {
              // Se falhou ao criar, ainda assim mostrar prontuário (pode ter sido criado pelo trigger)
              // Tentar buscar novamente
              const patientIdRetry = await findPatientByPhone(inService.patient_phone);
              if (patientIdRetry) {
                setPatientId(patientIdRetry);
                setCurrentAppointment(null);
                await linkAppointmentToPatient(inService.id, patientIdRetry);
              } else {
                // Último recurso: mostrar mensagem de erro
                console.error('Não foi possível criar paciente automaticamente');
                setPatientId(null);
                setCurrentAppointment(null);
              }
            }
          }
        } else {
          // Sem telefone - criar paciente básico apenas com nome
          const newPatientId = await createBasicPatientFromAppointment(inService);
          if (newPatientId) {
            await linkAppointmentToPatient(inService.id, newPatientId);
            setPatientId(newPatientId);
            setCurrentAppointment(null);
          } else {
            console.error('Não foi possível criar paciente sem telefone');
            setPatientId(null);
            setCurrentAppointment(null);
          }
        }
      } else {
        // Não há paciente em atendimento
        setPatientId(null);
        setAppointmentId(null);
        setCurrentAppointment(null);
      }
    } catch (err) {
      console.error('Erro ao verificar paciente em atendimento:', err);
    }
  };

  // Usar função utilitária para formatação de horário
  const formatTime = formatTimeUtil;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300';
      case 'called':
        return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300';
      case 'waiting':
        return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
      case 'in_service':
        return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300';
      default:
        return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'Agendado';
      case 'called':
        return 'Chamado';
      case 'waiting':
        return 'Na Fila';
      case 'in_service':
        return 'Em Atendimento';
      default:
        return status;
    }
  };


  // Se há paciente em atendimento, mostrar prontuário com menu lateral
  if (patientId) {
    const scheduled = appointmentsList.filter(a => a.status === 'scheduled');
    const called = appointmentsList.filter(a => a.status === 'called');
    const waiting = appointmentsList.filter(a => a.status === 'waiting').sort((a, b) => {
      const aTime = new Date(a.start_time).getTime();
      const bTime = new Date(b.start_time).getTime();
      return aTime - bTime;
    });

    return (
      <div className="h-full flex bg-[#f8fafc] dark:bg-[#0b141a] relative overflow-hidden">
        {/* Lista Lateral - mantém visível */}
        <div className="w-80 bg-white dark:bg-[#1e2028] border-r border-slate-200 dark:border-gray-800 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-slate-200 dark:border-gray-800">
            <div className="flex items-center gap-2 mb-3">
              <Stethoscope className="w-5 h-5 text-rose-500" />
              <h2 className="font-bold text-lg text-slate-800 dark:text-gray-100">
                Painel Médico
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-500 dark:text-gray-400" />
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
          {/* Lista de Pacientes */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3">
            {scheduled.length > 0 && (
              <div className="mb-4">
                <h3 className="text-xs font-bold text-slate-500 dark:text-gray-400 uppercase mb-2 flex items-center gap-2">
                  <Clock className="w-3 h-3" />
                  Agendados ({scheduled.length})
                </h3>
                <div className="space-y-2">
                  {scheduled.map((apt) => (
                    <div
                      key={apt.id}
                      className="p-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10"
                    >
                      <div className="flex items-start justify-between mb-1">
                        <h4 className="font-semibold text-sm text-slate-800 dark:text-gray-100 truncate">
                          {apt.patient_name || 'Sem nome'}
                        </h4>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${getStatusBadge(apt.status || '')}`}>
                          {getStatusLabel(apt.status || '')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-gray-400 mt-1">
                        <Clock className="w-3 h-3" />
                        <span>{formatTime(apt.start_time)}</span>
                        {apt.doctor_name && (
                          <>
                            <span>•</span>
                            <span className="truncate">{apt.doctor_name}</span>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {called.length > 0 && (
              <div className="mb-4">
                <h3 className="text-xs font-bold text-slate-500 dark:text-gray-400 uppercase mb-2 flex items-center gap-2">
                  <UserCheck className="w-3 h-3" />
                  Chamados ({called.length})
                </h3>
                <div className="space-y-2">
                  {called.map((apt) => (
                    <div
                      key={apt.id}
                      className="p-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10"
                    >
                      <div className="flex items-start justify-between mb-1">
                        <h4 className="font-semibold text-sm text-slate-800 dark:text-gray-100 truncate">
                          {apt.patient_name || 'Sem nome'}
                        </h4>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${getStatusBadge(apt.status || '')}`}>
                          {getStatusLabel(apt.status || '')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-gray-400 mt-1">
                        <Clock className="w-3 h-3" />
                        <span>{formatTime(apt.start_time)}</span>
                        {apt.doctor_name && (
                          <>
                            <span>•</span>
                            <span className="truncate">{apt.doctor_name}</span>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {waiting.length > 0 && (
              <div className="mb-4">
                <h3 className="text-xs font-bold text-slate-500 dark:text-gray-400 uppercase mb-2 flex items-center gap-2">
                  <User className="w-3 h-3" />
                  Na Fila ({waiting.length})
                </h3>
                <div className="space-y-2">
                  {waiting.map((apt, index) => (
                    <div
                      key={apt.id}
                      className="p-3 rounded-lg border border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10"
                    >
                      <div className="flex items-start justify-between mb-1">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            index === 0 
                              ? 'bg-rose-500 text-white' 
                              : 'bg-slate-200 dark:bg-gray-600 text-slate-600 dark:text-gray-300'
                          }`}>
                            {index + 1}º
                          </span>
                          <h4 className="font-semibold text-sm text-slate-800 dark:text-gray-100 truncate">
                            {apt.patient_name || 'Sem nome'}
                          </h4>
                        </div>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${getStatusBadge(apt.status || '')}`}>
                          {getStatusLabel(apt.status || '')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-gray-400 mt-1">
                        <Clock className="w-3 h-3" />
                        <span>{formatTime(apt.start_time)}</span>
                        {apt.doctor_name && (
                          <>
                            <span>•</span>
                            <span className="truncate">{apt.doctor_name}</span>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Área Principal - Prontuário */}
        <div className="flex-1 flex flex-col bg-[#f8fafc] dark:bg-[#0b141a] relative overflow-hidden">
          <PatientMedicalRecordView 
            patientId={patientId}
            appointmentId={appointmentId}
            onRefresh={() => {
              if (appointmentId) {
                fetchAppointment(appointmentId);
              }
              fetchAppointments();
            }}
            // Não passar onBack para remover o botão de voltar no Painel Médico
          />
        </div>
      </div>
    );
  }

  // Se há appointment mas não há patientId, tentar criar automaticamente
  // (Isso não deveria acontecer, mas é um fallback de segurança)
  if (currentAppointment && !patientId) {
    // Criar paciente automaticamente como fallback
    (async () => {
      const newPatientId = await createBasicPatientFromAppointment(currentAppointment);
      if (newPatientId) {
        await linkAppointmentToPatient(currentAppointment.id, newPatientId);
        setPatientId(newPatientId);
        setCurrentAppointment(null);
        fetchAppointments();
      }
    })();
    
    // Mostrar loading enquanto cria
    return (
      <div className="h-full flex items-center justify-center bg-[#f8fafc] dark:bg-[#0b141a]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-rose-500 mx-auto mb-4" />
          <p className="text-slate-600 dark:text-gray-400">Criando cadastro do paciente...</p>
        </div>
      </div>
    );
  }

  // Painel de espera com lista lateral
  const scheduled = appointmentsList.filter(a => a.status === 'scheduled');
  const called = appointmentsList.filter(a => a.status === 'called');
  const waiting = appointmentsList.filter(a => a.status === 'waiting').sort((a, b) => {
    const aTime = new Date(a.start_time).getTime();
    const bTime = new Date(b.start_time).getTime();
    return aTime - bTime;
  });

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-[#f8fafc] dark:bg-[#0b141a]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-rose-500 mx-auto mb-4" />
          <p className="text-slate-600 dark:text-gray-400">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex bg-[#f8fafc] dark:bg-[#0b141a] relative overflow-hidden">
      {/* Lista Lateral */}
      <div className="w-80 bg-white dark:bg-[#1e2028] border-r border-slate-200 dark:border-gray-800 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-gray-800">
          <div className="flex items-center gap-2 mb-3">
            <Stethoscope className="w-5 h-5 text-rose-500" />
            <h2 className="font-bold text-lg text-slate-800 dark:text-gray-100">
              Painel Médico
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-500 dark:text-gray-400" />
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

        {/* Lista de Pacientes */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3">
          {/* Agendados */}
          {scheduled.length > 0 && (
            <div className="mb-4">
              <h3 className="text-xs font-bold text-slate-500 dark:text-gray-400 uppercase mb-2 flex items-center gap-2">
                <Clock className="w-3 h-3" />
                Agendados ({scheduled.length})
              </h3>
              <div className="space-y-2">
                {scheduled.map((apt) => (
                  <div
                    key={apt.id}
                    className="p-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10 hover:bg-blue-100/50 dark:hover:bg-blue-900/20 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-1">
                      <h4 className="font-semibold text-sm text-slate-800 dark:text-gray-100 truncate">
                        {apt.patient_name || 'Sem nome'}
                      </h4>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${getStatusBadge(apt.status || '')}`}>
                        {getStatusLabel(apt.status || '')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-gray-400 mt-1">
                      <Clock className="w-3 h-3" />
                      <span>{formatTime(apt.start_time)}</span>
                      {apt.doctor_name && (
                        <>
                          <span>•</span>
                          <span className="truncate">{apt.doctor_name}</span>
                        </>
                      )}
                    </div>
                    {apt.patient_phone && (
                      <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-gray-400 mt-1">
                        <Phone className="w-3 h-3" />
                        <span>{apt.patient_phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Chamados */}
          {called.length > 0 && (
            <div className="mb-4">
              <h3 className="text-xs font-bold text-slate-500 dark:text-gray-400 uppercase mb-2 flex items-center gap-2">
                <UserCheck className="w-3 h-3" />
                Chamados ({called.length})
              </h3>
              <div className="space-y-2">
                {called.map((apt) => (
                  <div
                    key={apt.id}
                    className="p-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10 hover:bg-amber-100/50 dark:hover:bg-amber-900/20 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-1">
                      <h4 className="font-semibold text-sm text-slate-800 dark:text-gray-100 truncate">
                        {apt.patient_name || 'Sem nome'}
                      </h4>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${getStatusBadge(apt.status || '')}`}>
                        {getStatusLabel(apt.status || '')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-gray-400 mt-1">
                      <Clock className="w-3 h-3" />
                      <span>{formatTime(apt.start_time)}</span>
                      {apt.doctor_name && (
                        <>
                          <span>•</span>
                          <span className="truncate">{apt.doctor_name}</span>
                        </>
                      )}
                    </div>
                    {apt.patient_phone && (
                      <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-gray-400 mt-1">
                        <Phone className="w-3 h-3" />
                        <span>{apt.patient_phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Na Fila */}
          {waiting.length > 0 && (
            <div className="mb-4">
              <h3 className="text-xs font-bold text-slate-500 dark:text-gray-400 uppercase mb-2 flex items-center gap-2">
                <User className="w-3 h-3" />
                Na Fila ({waiting.length})
              </h3>
              <div className="space-y-2">
                {waiting.map((apt, index) => (
                  <div
                    key={apt.id}
                    className="p-3 rounded-lg border border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10 hover:bg-green-100/50 dark:hover:bg-green-900/20 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          index === 0 
                            ? 'bg-rose-500 text-white' 
                            : 'bg-slate-200 dark:bg-gray-600 text-slate-600 dark:text-gray-300'
                        }`}>
                          {index + 1}º
                        </span>
                        <h4 className="font-semibold text-sm text-slate-800 dark:text-gray-100 truncate">
                          {apt.patient_name || 'Sem nome'}
                        </h4>
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${getStatusBadge(apt.status || '')}`}>
                        {getStatusLabel(apt.status || '')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-gray-400 mt-1">
                      <Clock className="w-3 h-3" />
                      <span>{formatTime(apt.start_time)}</span>
                      {apt.doctor_name && (
                        <>
                          <span>•</span>
                          <span className="truncate">{apt.doctor_name}</span>
                        </>
                      )}
                    </div>
                    {apt.patient_phone && (
                      <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-gray-400 mt-1">
                        <Phone className="w-3 h-3" />
                        <span>{apt.patient_phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {scheduled.length === 0 && called.length === 0 && waiting.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="w-12 h-12 text-slate-300 dark:text-gray-600 mb-3" />
              <p className="text-sm text-slate-500 dark:text-gray-400 font-medium">
                Nenhum paciente agendado
              </p>
              <p className="text-xs text-slate-400 dark:text-gray-500 mt-1">
                Os pacientes aparecerão aqui quando forem agendados
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Área Principal - Painel de Espera */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <Stethoscope className="w-20 h-20 text-rose-500/50 mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-slate-800 dark:text-gray-100 mb-2">
            Aguardando Prontuário
          </h2>
          <p className="text-slate-600 dark:text-gray-400">
            Quando um paciente for colocado em atendimento, o prontuário aparecerá automaticamente aqui.
          </p>
          {waiting.length > 0 && (
            <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/10 rounded-lg border border-green-200 dark:border-green-800">
              <p className="text-sm font-semibold text-green-700 dark:text-green-300">
                {waiting.length} paciente{waiting.length > 1 ? 's' : ''} na fila
              </p>
              {waiting[0] && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                  Próximo: {waiting[0].patient_name || 'Sem nome'}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Atendimentos Órfãos */}
      <OrphanedAppointmentsModal
        isOpen={isOrphanedModalOpen}
        onClose={() => setIsOrphanedModalOpen(false)}
        appointments={orphanedAppointments}
        onFinalize={async (appointmentId) => {
          // Remover da lista de órfãos
          setOrphanedAppointments(prev => prev.filter(a => a.id !== appointmentId));
          // Se era o paciente atual, limpar estados
          if (appointmentId === appointmentId) {
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
