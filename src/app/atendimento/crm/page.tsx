'use client';

import { useEffect, useState, useCallback } from 'react';
import { createSchemaClient } from '@/lib/supabase/schemaClient';
import { createClient } from '@/lib/supabase/client';
import { Appointment } from '@/types/medical';
import type { ServicePoint } from '@/types/queue';
import type { TicketInfo } from '@/components/dashboard/ReceptionCard';
import {
  LayoutList, Users, DollarSign,
  ChevronLeft, ChevronRight, UserPlus, Calendar,
  Stethoscope, ChevronDown, X, MapPin, Megaphone, Loader2
} from 'lucide-react';

import ReceptionFlowColumns from '@/components/dashboard/ReceptionFlowColumns';
import AtendimentoDetailModal from '@/components/atendimento/agenda/AtendimentoDetailModal';
import AtendimentoNewSlotModal from '@/components/atendimento/agenda/AtendimentoNewSlotModal';
import CallMessageModal from '@/components/crm/CallMessageModal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { getTodayDateString, addDaysToDate } from '@/utils/dateUtils';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import { useQueueTickets } from '@/hooks/useQueueTickets';
import { useServicePoints } from '@/hooks/useServicePoints';

const supabase = createSchemaClient('atendimento');
const supabasePublic = createClient();

// Tipo local para appointments do schema atendimento (date + time separados)
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


  appointment_subtype?: string | null;
  procedures?: string[] | null;
  is_squeeze?: boolean;
  is_teleconsultation?: boolean;
  queue_stage?: 'reception' | 'doctor' | null;
  current_ticket_id?: number | null;
};

type DoctorOption = { id: number; name: string; color?: string };

/** Converte appointment do schema atendimento para o tipo Appointment usado pelo ReceptionFlowColumns */
function toReceptionAppointment(apt: AtendimentoAppointment): Appointment {
  const startTime = apt.date && apt.time
    ? `${apt.date}T${apt.time}:00`
    : apt.date
      ? `${apt.date}T00:00:00`
      : new Date().toISOString();

  return {
    id: apt.id,
    start_time: startTime,
    patient_name: apt.patient_name || null,
    patient_phone: apt.patient_phone || null,
    patient_id: apt.patient_id ?? null,
    parent_name: apt.parent_name || null,
    patient_sex: apt.patient_sex || null,
    doctor_name: apt.doctor_name || null,
    doctor_id: apt.doctor_id ?? null,
    type: apt.type || null,
    status: apt.status,
    notes: apt.notes || null,
    total_amount: apt.total_amount,
    amount_paid: apt.amount_paid,
    appointment_subtype: apt.appointment_subtype || null,
    procedures: apt.procedures || null,
    is_squeeze: apt.is_squeeze,
    is_teleconsultation: apt.is_teleconsultation,
    queue_stage: apt.queue_stage || null,
    current_ticket_id: apt.current_ticket_id ?? null,
  } as Appointment;
}

export default function AtendimentoCRMPage() {
  const { toast } = useToast();
  useAuth();

  // Hooks de fila
  const { generateTicket, callTicket, completeTicket, fetchTodayTickets, tickets } = useQueueTickets();
  const { servicePoints, listServicePoints } = useServicePoints();

  // Tabs
  const [receptionFlowTab, setReceptionFlowTab] = useState<'flow' | 'checkout'>('flow');

  // Data
  const [selectedDate, setSelectedDate] = useState(getTodayDateString());
  const [rawAppointments, setRawAppointments] = useState<AtendimentoAppointment[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtro de medico
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<number | null>(null);
  const [isDoctorDropdownOpen, setIsDoctorDropdownOpen] = useState(false);

  // Appointments convertidos
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  // Acoes
  const [isUpdating, setIsUpdating] = useState<number | null>(null);
  const [sendingCallAppointmentId, setSendingCallAppointmentId] = useState<number | null>(null);
  const [isSendingCall, setIsSendingCall] = useState(false);

  // Modais
  const [callingAppointment, setCallingAppointment] = useState<Appointment | null>(null);
  const [selectedAppointmentForEdit, setSelectedAppointmentForEdit] = useState<AtendimentoAppointment | null>(null);
  const [isNewSlotModalOpen, setIsNewSlotModalOpen] = useState(false);
  const [selectedCheckoutAppointmentId, setSelectedCheckoutAppointmentId] = useState<number | null>(null);
  const [callMessage] = useState("Olá! Sua vez chegou. Por favor, dirija-se ao consultório.");

  // Chamada manual na TV
  const [isManualCallOpen, setIsManualCallOpen] = useState(false);
  const [manualCallText, setManualCallText] = useState('');
  const [isManualCallSending, setIsManualCallSending] = useState(false);
  const [manualCallServicePoint, setManualCallServicePoint] = useState<import('@/types/queue').ServicePoint | null>(null);

  // Modal seletor de ponto de atendimento
  const [servicePointSelector, setServicePointSelector] = useState<{
    isOpen: boolean;
    appointment: Appointment | null;
    filterType: 'guiche' | 'consultorio';
  }>({ isOpen: false, appointment: null, filterType: 'guiche' });

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type?: 'danger' | 'warning' | 'info' | 'success';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'warning',
    onConfirm: () => {}
  });

  // Mapa de ticket info por appointment_id (para exibir badge no card)
  const ticketMap = new Map<number, TicketInfo>();
  for (const tk of tickets) {
    if (tk.status === 'cancelled' || tk.status === 'completed') continue;
    const spName = tk.service_point?.name;
    ticketMap.set(tk.appointment_id, {
      ticket_number: tk.ticket_number,
      is_priority: tk.is_priority,
      service_point_name: spName || undefined,
    });
  }

  // Carregar lista de medicos + pontos de atendimento
  useEffect(() => {
    (async () => {
      const { data: doctorsData } = await supabasePublic
        .from('doctors')
        .select('id, name, color, professional_id')
        .eq('active', true)
        .order('name');
      const list: DoctorOption[] = (doctorsData || []).map((d: Record<string, unknown>) => ({
        id: d.id as number,
        name: d.name as string,
        color: (d.color as string) || undefined,
      }));

      const linkedIds = new Set((doctorsData || []).map((d: Record<string, unknown>) => d.professional_id).filter(Boolean));
      const { data: profsData } = await supabase
        .from('professionals')
        .select('id, name')
        .eq('has_schedule', true)
        .eq('status', 'active');

      if (profsData) {
        for (const prof of profsData) {
          if (!linkedIds.has(prof.id)) {
            list.push({ id: -(list.length + 1000), name: prof.name });
          }
        }
      }

      setDoctors(list);
    })();
    listServicePoints();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch appointments
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const selectQuery = '*, patients:patient_id(full_name, phone, sex)';
      let query = supabase
        .from('appointments')
        .select(selectQuery)
        .eq('date', selectedDate)
        .neq('status', 'cancelled')
        .neq('status', 'blocked')
        .order('time', { ascending: true });

      if (selectedDoctorId) {
        query = query.eq('doctor_id', selectedDoctorId);
      }

      const { data, error } = await query;
      if (error) {
        console.error('[CRM] fetchData error:', error);
        return;
      }
      if (data) {
        const rows = data as Array<Record<string, unknown>>;
        const mapped: AtendimentoAppointment[] = rows.map((row) => {
          const patient = row.patients as { full_name?: string; phone?: string; sex?: string } | null;
          const doctor = doctors.find(d => d.id === row.doctor_id);
          return {
            id: row.id as number,
            date: row.date as string,
            time: row.time as string | null,
            patient_id: row.patient_id as number | null,
            doctor_id: row.doctor_id as number | null,
            doctor_name: doctor?.name || (row.doctor_name as string) || undefined,
            type: row.type as string | null,
            status: row.status as string,
            notes: row.notes as string | null,
            parent_name: row.parent_name as string | null,
            parent_phone: row.parent_phone as string | null,
            consultation_value: row.consultation_value as number | null,
            patient_name: patient?.full_name || (row.patient_name as string) || null,
            patient_phone: patient?.phone || (row.patient_phone as string) || null,
            patient_sex: (patient?.sex as 'M' | 'F') || (row.patient_sex as 'M' | 'F') || null,
            total_amount: row.total_amount as number | undefined,
            amount_paid: row.amount_paid as number | undefined,
            appointment_subtype: row.appointment_subtype as string | null,
            procedures: row.procedures as string[] | null,
            is_squeeze: row.is_squeeze as boolean | undefined,
            is_teleconsultation: row.is_teleconsultation as boolean | undefined,
            queue_stage: row.queue_stage as 'reception' | 'doctor' | null,
            current_ticket_id: row.current_ticket_id as number | null,
          };
        });
        setRawAppointments(mapped);
        setAppointments(mapped.map(toReceptionAppointment));
      }
    } catch (err) {
      console.error('[CRM] fetchData catch:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, selectedDoctorId, doctors]);

  // Carregar dados ao mudar data, medico, etc.
  useEffect(() => {
    fetchData();
    fetchTodayTickets();
  }, [fetchData, fetchTodayTickets]);

  // Realtime subscription (appointments + queue_tickets)
  useEffect(() => {
    const channel = supabase
      .channel('atendimento_crm_updates')
      .on('postgres_changes', { event: '*', schema: 'atendimento', table: 'appointments' }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'atendimento', table: 'queue_tickets' }, () => {
        fetchTodayTickets();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchData, fetchTodayTickets]);

  // Navegacao de data
  const changeDate = (days: number) => {
    setSelectedDate(addDaysToDate(selectedDate, days));
  };

  // --- Acoes sobre appointments ---
  const updateAppointmentStatus = async (aptId: number, updates: Record<string, string | null>) => {
    const { error } = await supabase
      .from('appointments')
      .update(updates)
      .eq('id', aptId);
    if (error) throw error;
  };

  const handleCallAppointment = (apt: Appointment) => {
    setCallingAppointment(apt);
  };

  const handleSendAppointmentCall = async (message: string, audioBlob?: Blob) => {
    const appointment = callingAppointment;
    if (!appointment || !appointment.patient_phone || isSendingCall) return;

    setCallingAppointment(null);
    setSendingCallAppointmentId(appointment.id);
    setIsSendingCall(true);

    try {
      const cleanPhone = appointment.patient_phone.replace(/\D/g, '');

      const { data: existingChat } = await supabase
        .from('chats')
        .select('id')
        .eq('phone', cleanPhone)
        .maybeSingle();

      let chatId: number;
      if (existingChat) {
        chatId = existingChat.id;
      } else {
        const { data: newChat } = await supabase
          .from('chats')
          .insert({
            phone: cleanPhone,
            contact_name: appointment.patient_name || cleanPhone,
            status: 'ACTIVE',
            created_at: new Date().toISOString(),
            last_interaction_at: new Date().toISOString()
          })
          .select()
          .single();
        if (!newChat) throw new Error('Erro ao criar chat');
        chatId = newChat.id;
      }

      if (audioBlob) {
        const fileName = `${chatId}_${Date.now()}_audio.webm`;
        const { error: uploadError } = await supabasePublic.storage
          .from('midia')
          .upload(`uploads/${fileName}`, audioBlob, { contentType: 'audio/webm', upsert: true });
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabasePublic.storage.from('midia').getPublicUrl(`uploads/${fileName}`);

        const { data: dbMsg } = await supabase.from('chat_messages').insert({
          chat_id: chatId,
          sender: 'HUMAN_AGENT',
          message_text: message || 'Áudio',
          message_type: 'audio',
          media_url: publicUrl
        }).select().single();

        await fetch('/api/atendimento/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatId, phone: cleanPhone, message: message || '',
            type: 'audio', mediaUrl: publicUrl, dbMessageId: dbMsg?.id
          })
        });
      } else {
        await supabase.from('chat_messages').insert({
          chat_id: chatId,
          sender: 'HUMAN_AGENT',
          message_text: message,
          message_type: 'text'
        });

        await fetch('/api/atendimento/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chatId, phone: cleanPhone, message, type: 'text' })
        });
      }

      await updateAppointmentStatus(appointment.id, { status: 'called' });
      fetchData();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Tente novamente.';
      console.error('Erro ao enviar mensagem:', error);
      toast.error('Erro ao enviar mensagem: ' + msg);
    } finally {
      setSendingCallAppointmentId(null);
      setIsSendingCall(false);
    }
  };

  /** Disparar chamada manual na TV (texto livre + ponto de atendimento opcional) */
  const handleManualCall = async () => {
    const text = manualCallText.trim();
    if (!text || isManualCallSending) return;
    setIsManualCallSending(true);
    try {
      const res = await fetch('/api/atendimento/queue/manual-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          servicePointName: manualCallServicePoint?.name,
          servicePointCode: manualCallServicePoint?.code,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }));
        throw new Error(err.error || 'Erro ao disparar chamada');
      }
      toast.success('Chamada enviada para a TV!');
      setManualCallText('');
      setManualCallServicePoint(null);
      setIsManualCallOpen(false);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Tente novamente.';
      toast.error('Erro na chamada manual: ' + msg);
    } finally {
      setIsManualCallSending(false);
    }
  };

  /** Gerar senha para o guiche (etapa 1 do fluxo) */
  const handleGenerateTicket = async (apt: Appointment, isPriority: boolean) => {
    setIsUpdating(apt.id);
    try {
      await generateTicket(apt.id, isPriority, 'reception');
      toast.success(`Senha gerada para ${apt.patient_name || 'paciente'}`);
      fetchData();
      fetchTodayTickets();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Tente novamente.';
      toast.error('Erro ao gerar senha: ' + msg);
    } finally {
      setIsUpdating(null);
    }
  };

  /** Abrir seletor de ponto de atendimento para chamar paciente */
  const handleCallWithDestination = (apt: Appointment) => {
    const stage = apt.queue_stage;
    const filterType = stage === 'doctor' ? 'consultorio' : 'guiche';
    setServicePointSelector({ isOpen: true, appointment: apt, filterType });
  };

  /** Confirmar chamada para ponto de atendimento selecionado */
  const handleConfirmCallToServicePoint = async (sp: ServicePoint) => {
    const apt = servicePointSelector.appointment;
    if (!apt) return;
    setServicePointSelector({ isOpen: false, appointment: null, filterType: 'guiche' });
    setIsUpdating(apt.id);
    try {
      // Buscar ticket ativo do appointment
      const activeTicket = tickets.find(
        t => t.appointment_id === apt.id && ['waiting', 'called'].includes(t.status)
      );
      if (!activeTicket) {
        toast.error('Nenhuma senha ativa encontrada para este paciente.');
        return;
      }

      await callTicket(
        activeTicket.id,
        sp.id,
        apt.patient_name || 'Paciente',
        sp.name,
        sp.code,
        apt.doctor_name || undefined,
        activeTicket.is_priority
      );
      toast.success(`${apt.patient_name || 'Paciente'} chamado para ${sp.name}`);
      fetchData();
      fetchTodayTickets();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Tente novamente.';
      toast.error('Erro ao chamar paciente: ' + msg);
    } finally {
      setIsUpdating(null);
    }
  };

  /** Finalizar guiche e enviar para fila do medico (etapa 2) */
  const handleFinishGuiche = async (apt: Appointment) => {
    setIsUpdating(apt.id);
    try {
      // Completar ticket do guiche
      const activeTicket = tickets.find(
        t => t.appointment_id === apt.id && t.queue_stage === 'reception' && ['waiting', 'called', 'in_service'].includes(t.status)
      );
      if (activeTicket) {
        await completeTicket(activeTicket.id);
      }

      // Gerar novo ticket para fila do medico
      await generateTicket(apt.id, activeTicket?.is_priority ?? false, 'doctor');
      toast.success(`${apt.patient_name || 'Paciente'} enviado para fila do médico`);
      fetchData();
      fetchTodayTickets();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Tente novamente.';
      toast.error('Erro ao finalizar guichê: ' + msg);
    } finally {
      setIsUpdating(null);
    }
  };

  const handleCheckIn = async (apt: Appointment) => {
    setIsUpdating(apt.id);
    try {
      await updateAppointmentStatus(apt.id, { status: 'waiting' });
      fetchData();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Tente novamente.';
      toast.error('Erro ao fazer check-in: ' + msg);
    } finally {
      setIsUpdating(null);
    }
  };

  const handleEnter = async (apt: Appointment) => {
    setIsUpdating(apt.id);
    try {
      // Verificar se outro paciente esta em atendimento pelo mesmo medico
      let query = supabase.from('appointments').select('*').eq('status', 'in_service').neq('id', apt.id);
      if (apt.doctor_id) {
        query = query.eq('doctor_id', apt.doctor_id);
      }
      const { data: currentInService } = await query;

      if (currentInService && currentInService.length > 0) {
        setConfirmModal({
          isOpen: true,
          title: 'Finalizar atendimentos anteriores?',
          message: `Há ${currentInService.length} paciente(s) em atendimento${apt.doctor_name ? ` com ${apt.doctor_name}` : ''}. Deseja finalizar e iniciar o atendimento de ${apt.patient_name || 'este paciente'}?`,
          type: 'warning',
          onConfirm: async () => {
            setConfirmModal(prev => ({ ...prev, isOpen: false }));
            const ids = currentInService.map((a: Record<string, unknown>) => a.id as number);
            await supabase.from('appointments')
              .update({ status: 'finished' })
              .in('id', ids);

            await updateAppointmentStatus(apt.id, { status: 'in_service' });
            toast.success(`Entrada confirmada para ${apt.patient_name || 'paciente'}.`);
            fetchData();
          }
        });
        setIsUpdating(null);
        return;
      }

      await updateAppointmentStatus(apt.id, { status: 'in_service' });
      toast.success(`Entrada confirmada para ${apt.patient_name || 'paciente'}.`);
      fetchData();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Tente novamente.';
      toast.error('Erro ao entrar em atendimento: ' + msg);
    } finally {
      setIsUpdating(null);
    }
  };

  const executeFinish = async (apt: Appointment) => {
    setIsUpdating(apt.id);
    try {
      // Completar ticket ativo se houver
      const activeTicket = tickets.find(
        t => t.appointment_id === apt.id && ['waiting', 'called', 'in_service'].includes(t.status)
      );
      if (activeTicket) {
        await completeTicket(activeTicket.id);
      }
      await updateAppointmentStatus(apt.id, { status: 'finished' });
      fetchData();
      fetchTodayTickets();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Tente novamente.';
      toast.error('Erro ao finalizar: ' + msg);
    } finally {
      setIsUpdating(null);
    }
  };

  const handleFinish = (apt: Appointment) => {
    setConfirmModal({
      isOpen: true,
      title: 'Finalizar Atendimento',
      message: `Deseja marcar o atendimento de "${apt.patient_name || 'paciente'}" como concluído? Esta ação moverá o paciente para a coluna de Concluídos.`,
      type: 'warning',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        await executeFinish(apt);
      }
    });
  };

  const handleRevert = async (apt: Appointment, newStatus: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Reverter Status',
      message: `Deseja reverter este paciente para "${newStatus === 'scheduled' ? 'Agendado' : newStatus === 'waiting' ? 'Na Fila' : newStatus === 'in_service' ? 'Em Atendimento' : newStatus}"?\n\nOs dados financeiros e de consulta não serão alterados.`,
      type: 'warning',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        setIsUpdating(apt.id);
        try {
          const updates: Record<string, string | null> = { status: newStatus };
          if (newStatus === 'scheduled') {
            updates.queue_stage = null;
          }
          await updateAppointmentStatus(apt.id, updates);
          fetchData();
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : 'Tente novamente.';
          toast.error('Erro ao reverter: ' + msg);
        } finally {
          setIsUpdating(null);
        }
      }
    });
  };

  const handleEditAppointment = (apt: Appointment) => {
    const raw = rawAppointments.find(a => a.id === apt.id);
    if (raw) setSelectedAppointmentForEdit(raw);
  };

  // Medico selecionado
  const selectedDoctor = doctors.find(d => d.id === selectedDoctorId);
  const selectedDoctorLabel = selectedDoctor ? selectedDoctor.name : 'Todos os Médicos';

  // Contadores por status
  const statusCounts = appointments.reduce((acc, a) => {
    acc[a.status] = (acc[a.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Pontos de atendimento filtrados para o modal seletor
  const filteredServicePoints = servicePoints.filter(
    sp => sp.type === servicePointSelector.filterType && sp.status === 'active'
  );

  return (
    <div className="h-full flex flex-col bg-[#f8fafc] dark:bg-[#050507] relative overflow-hidden transition-colors duration-300">

      {/* HEADER */}
      <div className="px-6 py-5 z-10 border-b border-slate-100 dark:border-[#1e1e28] bg-white/50 dark:bg-[#0e0e14]/80 backdrop-blur-sm transition-all duration-300">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-xl font-bold text-slate-800 dark:text-gray-100 flex items-center gap-2">
            <div className="p-2 bg-blue-500 text-white rounded-lg shadow-lg shadow-blue-200 dark:shadow-none">
              <LayoutList className="w-5 h-5" />
            </div>
            Central de Controle
          </h1>

          <div className="flex bg-slate-100/80 dark:bg-[#0e0e14] p-1 rounded-xl shadow-inner border border-transparent dark:border-[#1e1e28]">
            <button
              type="button"
              onClick={() => setReceptionFlowTab('flow')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                receptionFlowTab === 'flow'
                  ? 'bg-white dark:bg-[#1a1a22] text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-500 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-white/50 dark:hover:bg-white/5'
              }`}
            >
              <Users className="w-4 h-4" /> Recepção (Fila)
            </button>
            <button
              type="button"
              onClick={() => setReceptionFlowTab('checkout')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                receptionFlowTab === 'checkout'
                  ? 'bg-white dark:bg-[#1a1a22] text-purple-600 dark:text-purple-400 shadow-sm'
                  : 'text-slate-500 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-white/50 dark:hover:bg-white/5'
              }`}
            >
              <DollarSign className="w-4 h-4" /> Checkout / Finalização
            </button>
          </div>
        </div>
      </div>

      {/* AREA PRINCIPAL */}
      <div className="flex-1 overflow-hidden relative z-10 transition-all duration-300">
        <div className="h-full flex flex-col p-6 overflow-hidden">
          {/* Toolbar: Data + Filtro Medico + Novo Paciente */}
          <div className="flex justify-between items-center mb-6 gap-4 flex-wrap">
            {/* Navegacao de Data */}
            <div className="flex items-center gap-4 bg-white dark:bg-[#0e0e14] px-2 py-1.5 rounded-full border border-slate-200 dark:border-[#252530] shadow-sm transition-colors">
              <button onClick={() => changeDate(-1)} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full text-slate-500 dark:text-gray-400">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="text-sm font-bold text-slate-700 dark:text-gray-200 bg-transparent outline-none uppercase"
                />
              </div>
              <button onClick={() => changeDate(1)} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full text-slate-500 dark:text-gray-400">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Filtro de Medico */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsDoctorDropdownOpen(!isDoctorDropdownOpen)}
                className="flex items-center gap-2 bg-white dark:bg-[#0e0e14] px-4 py-2.5 rounded-xl border border-slate-200 dark:border-[#252530] shadow-sm hover:border-blue-300 dark:hover:border-blue-700 transition-all text-sm font-medium text-slate-700 dark:text-gray-200 min-w-[200px]"
              >
                <Stethoscope className="w-4 h-4 text-blue-600 shrink-0" />
                {selectedDoctor?.color && (
                  <span
                    className="w-3 h-3 rounded-full shrink-0 border border-white dark:border-[#252530]"
                    style={{ backgroundColor: selectedDoctor.color }}
                  />
                )}
                <span className="truncate flex-1 text-left">{selectedDoctorLabel}</span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isDoctorDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isDoctorDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsDoctorDropdownOpen(false)} />
                  <div className="absolute top-full left-0 mt-1 w-full min-w-[220px] bg-white dark:bg-[#1a1a22] border border-slate-200 dark:border-[#252530] rounded-xl shadow-xl z-50 overflow-hidden">
                    <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                      <button
                        type="button"
                        onClick={() => { setSelectedDoctorId(null); setIsDoctorDropdownOpen(false); }}
                        className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors text-left ${
                          selectedDoctorId === null
                            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                            : 'text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-white/5'
                        }`}
                      >
                        <Users className="w-4 h-4 text-slate-400" />
                        Todos os Médicos
                      </button>

                      <div className="border-t border-slate-100 dark:border-[#252530]" />

                      {doctors.map(doc => (
                        <button
                          key={doc.id}
                          type="button"
                          onClick={() => { setSelectedDoctorId(doc.id); setIsDoctorDropdownOpen(false); }}
                          className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors text-left ${
                            selectedDoctorId === doc.id
                              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                              : 'text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-white/5'
                          }`}
                        >
                          {doc.color ? (
                            <span
                              className="w-3 h-3 rounded-full shrink-0 border border-slate-200 dark:border-[#252530]"
                              style={{ backgroundColor: doc.color }}
                            />
                          ) : (
                            <Stethoscope className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          )}
                          <span className="truncate">{doc.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Contadores rapidos */}
            <div className="hidden md:flex items-center gap-3 text-xs font-medium">
              <span className="flex items-center gap-1 px-2.5 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-full">
                Agendados: {(statusCounts['scheduled'] || 0) + (statusCounts['confirmed'] || 0)}
              </span>
              <span className="flex items-center gap-1 px-2.5 py-1 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-full">
                Na Fila: {statusCounts['waiting'] || 0}
              </span>
              <span className="flex items-center gap-1 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 rounded-full">
                Em Atend.: {statusCounts['in_service'] || 0}
              </span>
              <span className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full">
                Concluídos: {statusCounts['finished'] || 0}
              </span>
            </div>

            {/* Botoes de acao */}
            {receptionFlowTab !== 'checkout' && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsManualCallOpen(true)}
                  className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-amber-200 dark:shadow-none transition-all hover:-translate-y-0.5"
                >
                  <Megaphone className="w-4 h-4" /> Chamar na TV
                </button>
                <button
                  onClick={() => setIsNewSlotModalOpen(true)}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-blue-200 dark:shadow-none transition-all hover:-translate-y-0.5"
                >
                  <UserPlus className="w-4 h-4" /> Novo Paciente
                </button>
              </div>
            )}
          </div>

          {/* Loading */}
          {loading && appointments.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-slate-500 dark:text-gray-400">Carregando agendamentos...</p>
              </div>
            </div>
          ) : (
            <ReceptionFlowColumns
              selectedDate={selectedDate}
              appointments={appointments}
              callingAppointmentId={sendingCallAppointmentId}
              activeTab={receptionFlowTab}
              selectedCheckoutAppointmentId={receptionFlowTab === 'checkout' ? selectedCheckoutAppointmentId : null}
              onSelectCheckoutAppointment={receptionFlowTab === 'checkout' ? (apt) => setSelectedCheckoutAppointmentId(apt.id) : undefined}
              onCheckoutSuccess={receptionFlowTab === 'checkout' ? () => { fetchData(); setSelectedCheckoutAppointmentId(null); } : undefined}
              onEditAppointment={handleEditAppointment}
              onCallAppointment={handleCallAppointment}
              onCheckIn={handleCheckIn}
              onEnter={handleEnter}
              onFinish={handleFinish}
              onRevert={handleRevert}
              isUpdating={isUpdating}
              onGenerateTicket={handleGenerateTicket}
              onCallWithDestination={handleCallWithDestination}
              onFinishGuiche={handleFinishGuiche}
              ticketMap={ticketMap}
            />
          )}
        </div>
      </div>

      {/* --- MODAIS --- */}
      <CallMessageModal
        isOpen={!!callingAppointment}
        onClose={() => setCallingAppointment(null)}
        onSend={handleSendAppointmentCall}
        title="Chamar Paciente"
        subtitle={callingAppointment?.patient_name || 'Sem nome'}
        isLoading={!!callingAppointment && sendingCallAppointmentId === callingAppointment.id}
        defaultMessage={callMessage}
      />

      <AtendimentoNewSlotModal
        isOpen={isNewSlotModalOpen}
        onClose={() => setIsNewSlotModalOpen(false)}
        onSuccess={() => { setIsNewSlotModalOpen(false); fetchData(); }}
        initialDate={selectedDate}
        initialTime={new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false })}
      />

      {selectedAppointmentForEdit && (
        <AtendimentoDetailModal
          selectedAppointment={selectedAppointmentForEdit}
          setSelectedAppointment={setSelectedAppointmentForEdit}
          doctors={doctors}
          onSaveSuccess={fetchData}
        />
      )}

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
      />

      {/* Modal Chamada Manual na TV */}
      {isManualCallOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#1a1a22] rounded-2xl shadow-2xl border border-slate-200 dark:border-[#2d2d36] w-full max-w-md mx-4 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-[#252530]">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                  <Megaphone className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-gray-100">Chamada Manual na TV</h3>
                  <p className="text-xs text-slate-500 dark:text-gray-400">Digite o texto que sera falado e exibido</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setIsManualCallOpen(false); setManualCallText(''); setManualCallServicePoint(null); }}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <textarea
                value={manualCallText}
                onChange={(e) => setManualCallText(e.target.value)}
                placeholder="Ex: Maria Silva, por favor dirija-se ao atendimento"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-[#252530] bg-slate-50 dark:bg-[#0e0e14] text-sm text-slate-800 dark:text-gray-200 placeholder:text-slate-400 dark:placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-400 resize-none"
                rows={2}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleManualCall();
                  }
                }}
              />

              {/* Seletor de posto de atendimento */}
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-gray-400 mb-2">Destino (opcional)</p>
                <div className="flex flex-wrap gap-2">
                  {servicePoints.filter(sp => sp.status === 'active').map(sp => (
                    <button
                      key={sp.id}
                      type="button"
                      onClick={() => setManualCallServicePoint(prev => prev?.id === sp.id ? null : sp)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        manualCallServicePoint?.id === sp.id
                          ? 'bg-amber-500 border-amber-500 text-white'
                          : 'border-slate-200 dark:border-[#2d2d36] text-slate-600 dark:text-gray-400 hover:border-amber-400 hover:text-amber-600 dark:hover:text-amber-400'
                      }`}
                    >
                      {sp.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setIsManualCallOpen(false); setManualCallText(''); setManualCallServicePoint(null); }}
                  className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleManualCall}
                  disabled={!manualCallText.trim() || isManualCallSending}
                  className="flex items-center gap-2 px-5 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl shadow-lg shadow-amber-200 dark:shadow-none transition-all"
                >
                  {isManualCallSending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Megaphone className="w-4 h-4" />
                  )}
                  {isManualCallSending ? 'Enviando...' : 'Chamar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Seletor de Ponto de Atendimento */}
      {servicePointSelector.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#1a1a22] rounded-2xl shadow-2xl border border-slate-200 dark:border-[#2d2d36] w-full max-w-sm mx-4 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-[#252530]">
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-gray-100">
                  Chamar para {servicePointSelector.filterType === 'guiche' ? 'Guichê' : 'Consultório'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                  {servicePointSelector.appointment?.patient_name || 'Paciente'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setServicePointSelector({ isOpen: false, appointment: null, filterType: 'guiche' })}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <div className="p-3 space-y-1.5 max-h-[300px] overflow-y-auto">
              {filteredServicePoints.length === 0 ? (
                <p className="text-center text-sm text-slate-400 dark:text-gray-500 py-6">
                  Nenhum {servicePointSelector.filterType === 'guiche' ? 'guichê' : 'consultório'} cadastrado.
                </p>
              ) : (
                filteredServicePoints.map(sp => (
                  <button
                    key={sp.id}
                    type="button"
                    onClick={() => handleConfirmCallToServicePoint(sp)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors group"
                  >
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg group-hover:bg-blue-200 dark:group-hover:bg-blue-800/40 transition-colors">
                      <MapPin className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-slate-700 dark:text-gray-200">{sp.name}</span>
                      <span className="text-xs text-slate-400 dark:text-gray-500 ml-2">{sp.code}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
