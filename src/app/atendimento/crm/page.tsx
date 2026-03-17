'use client';

import { useEffect, useState, useCallback } from 'react';
import { createSchemaClient } from '@/lib/supabase/schemaClient';
import { createClient } from '@/lib/supabase/client';
import { Appointment } from '@/types/medical';
import {
  LayoutList, Users, DollarSign,
  ChevronLeft, ChevronRight, UserPlus, Calendar,
  Stethoscope, ChevronDown
} from 'lucide-react';

import ReceptionFlowColumns from '@/components/dashboard/ReceptionFlowColumns';
import AtendimentoDetailModal from '@/components/atendimento/agenda/AtendimentoDetailModal';
import AtendimentoNewSlotModal from '@/components/atendimento/agenda/AtendimentoNewSlotModal';
import CallMessageModal from '@/components/crm/CallMessageModal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { getTodayDateString, addDaysToDate } from '@/utils/dateUtils';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';

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
  queue_entered_at?: string | null;
  in_service_at?: string | null;
  finished_at?: string | null;
  appointment_subtype?: string | null;
  procedures?: string[] | null;
  is_squeeze?: boolean;
  is_teleconsultation?: boolean;
};

type DoctorOption = { id: number; name: string; color?: string };

/** Converte appointment do schema atendimento para o tipo Appointment usado pelo ReceptionFlowColumns */
function toReceptionAppointment(apt: AtendimentoAppointment): Appointment {
  // Gerar um start_time sintético para compatibilidade com componentes existentes
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
    queue_entered_at: apt.queue_entered_at || null,
    in_service_at: apt.in_service_at || null,
    finished_at: apt.finished_at || null,
    appointment_subtype: apt.appointment_subtype || null,
    procedures: apt.procedures || null,
    is_squeeze: apt.is_squeeze,
    is_teleconsultation: apt.is_teleconsultation,
  } as Appointment;
}

export default function AtendimentoCRMPage() {
  const { toast } = useToast();
  useAuth();

  // Tabs
  const [receptionFlowTab, setReceptionFlowTab] = useState<'flow' | 'checkout'>('flow');

  // Data
  const [selectedDate, setSelectedDate] = useState(getTodayDateString());
  const [rawAppointments, setRawAppointments] = useState<AtendimentoAppointment[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtro de médico
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<number | null>(null); // null = Todos
  const [isDoctorDropdownOpen, setIsDoctorDropdownOpen] = useState(false);

  // Appointments convertidos
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  // Ações
  const [isUpdating, setIsUpdating] = useState<number | null>(null);
  const [sendingCallAppointmentId, setSendingCallAppointmentId] = useState<number | null>(null);
  const [isSendingCall, setIsSendingCall] = useState(false);

  // Modais
  const [callingAppointment, setCallingAppointment] = useState<Appointment | null>(null);
  const [selectedAppointmentForEdit, setSelectedAppointmentForEdit] = useState<AtendimentoAppointment | null>(null);
  const [isNewSlotModalOpen, setIsNewSlotModalOpen] = useState(false);
  const [selectedCheckoutAppointmentId, setSelectedCheckoutAppointmentId] = useState<number | null>(null);
  const [callMessage] = useState("Olá! Sua vez chegou. Por favor, dirija-se ao consultório.");

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

  // Carregar lista de médicos
  useEffect(() => {
    (async () => {
      // 1. Doctors da tabela public.doctors
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

      // 2. Profissionais com agenda que não estão linkados como doctors
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
  }, []);

  // Fetch appointments
  const fetchData = useCallback(async () => {
    setLoading(true);
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

    const { data } = await query;
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
          queue_entered_at: row.queue_entered_at as string | null,
          in_service_at: row.in_service_at as string | null,
          finished_at: row.finished_at as string | null,
          appointment_subtype: row.appointment_subtype as string | null,
          procedures: row.procedures as string[] | null,
          is_squeeze: row.is_squeeze as boolean | undefined,
          is_teleconsultation: row.is_teleconsultation as boolean | undefined,
        };
      });
      setRawAppointments(mapped);
      setAppointments(mapped.map(toReceptionAppointment));
    }
    setLoading(false);
  }, [selectedDate, selectedDoctorId, doctors]);

  // Carregar dados ao mudar data, médico, etc.
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('atendimento_crm_updates')
      .on('postgres_changes', { event: '*', schema: 'atendimento', table: 'appointments' }, () => {
        fetchData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  // Navegação de data
  const changeDate = (days: number) => {
    setSelectedDate(addDaysToDate(selectedDate, days));
  };

  // --- Ações sobre appointments ---
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

      // Buscar ou criar chat no schema atendimento
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

      // Enviar mensagem
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

      // Mudar status para chamado
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

  const handleCheckIn = async (apt: Appointment) => {
    setIsUpdating(apt.id);
    try {
      await updateAppointmentStatus(apt.id, { status: 'waiting', queue_entered_at: new Date().toISOString() });
      fetchData();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Tente novamente.';
      toast.error('Erro ao fazer check-in: ' + msg);
    } finally {
      setIsUpdating(null);
    }
  };

  const handleConfirmArrival = async (apt: Appointment) => {
    setIsUpdating(apt.id);
    try {
      await updateAppointmentStatus(apt.id, { status: 'waiting', queue_entered_at: new Date().toISOString() });
      fetchData();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Tente novamente.';
      toast.error('Erro ao confirmar chegada: ' + msg);
    } finally {
      setIsUpdating(null);
    }
  };

  const handleEnter = async (apt: Appointment) => {
    setIsUpdating(apt.id);
    try {
      // Verificar se outro paciente está em atendimento pelo mesmo médico
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
              .update({ status: 'finished', finished_at: new Date().toISOString() })
              .in('id', ids);

            await updateAppointmentStatus(apt.id, { status: 'in_service', in_service_at: new Date().toISOString() });
            toast.success(`Entrada confirmada para ${apt.patient_name || 'paciente'}.`);
            fetchData();
          }
        });
        setIsUpdating(null);
        return;
      }

      await updateAppointmentStatus(apt.id, { status: 'in_service', in_service_at: new Date().toISOString() });
      toast.success(`Entrada confirmada para ${apt.patient_name || 'paciente'}.`);
      fetchData();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Tente novamente.';
      toast.error('Erro ao entrar em atendimento: ' + msg);
    } finally {
      setIsUpdating(null);
    }
  };

  const handleFinish = async (apt: Appointment) => {
    setIsUpdating(apt.id);
    try {
      await updateAppointmentStatus(apt.id, { status: 'finished', finished_at: new Date().toISOString() });
      fetchData();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Tente novamente.';
      toast.error('Erro ao finalizar: ' + msg);
    } finally {
      setIsUpdating(null);
    }
  };

  const handleRevert = async (apt: Appointment, newStatus: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Reverter Status',
      message: `Deseja reverter este paciente para "${newStatus === 'scheduled' ? 'Agendado' : newStatus === 'waiting' ? 'Na Fila' : 'Em Atendimento'}"?`,
      type: 'warning',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        setIsUpdating(apt.id);
        try {
          const updates: Record<string, string | null> = { status: newStatus };
          if (newStatus === 'scheduled') {
            updates.queue_entered_at = null;
            updates.in_service_at = null;
            updates.finished_at = null;
          }
          if (newStatus === 'waiting') {
            updates.queue_entered_at = new Date().toISOString();
            updates.in_service_at = null;
            updates.finished_at = null;
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

  // Médico selecionado
  const selectedDoctor = doctors.find(d => d.id === selectedDoctorId);
  const selectedDoctorLabel = selectedDoctor ? selectedDoctor.name : 'Todos os Médicos';

  // Contadores por status
  const statusCounts = appointments.reduce((acc, a) => {
    acc[a.status] = (acc[a.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

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

      {/* ÁREA PRINCIPAL */}
      <div className="flex-1 overflow-hidden relative z-10 transition-all duration-300">
        <div className="h-full flex flex-col p-6 overflow-hidden">
          {/* Toolbar: Data + Filtro Médico + Novo Paciente */}
          <div className="flex justify-between items-center mb-6 gap-4 flex-wrap">
            {/* Navegação de Data */}
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

            {/* Filtro de Médico */}
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
                      {/* Opção "Todos" */}
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

                      {/* Lista de médicos */}
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

            {/* Contadores rápidos */}
            <div className="hidden md:flex items-center gap-3 text-xs font-medium">
              <span className="flex items-center gap-1 px-2.5 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-full">
                Agendados: {statusCounts['scheduled'] || 0}
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

            {/* Botão Novo Paciente */}
            {receptionFlowTab !== 'checkout' && (
              <button
                onClick={() => setIsNewSlotModalOpen(true)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-blue-200 dark:shadow-none transition-all hover:-translate-y-0.5"
              >
                <UserPlus className="w-4 h-4" /> Novo Paciente
              </button>
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
              onConfirmArrival={handleConfirmArrival}
              onEnter={handleEnter}
              onFinish={handleFinish}
              onRevert={handleRevert}
              isUpdating={isUpdating}
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
    </div>
  );
}
