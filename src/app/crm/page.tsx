'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
const supabase = createClient();
import { Chat, Patient } from '@/types';
import { 
  LayoutList, Users, DollarSign,
  BarChart3, Calendar, 
  ChevronLeft, ChevronRight, UserPlus, MessageSquare, X
} from 'lucide-react';

// Importamos a Janela de Chat
import ChatWindow from '@/components/ChatWindow';
// Importamos o novo layout de fluxo de recepção
import ReceptionFlowColumns from '@/components/dashboard/ReceptionFlowColumns';
import ReceptionAppointmentModal from '@/components/medical/ReceptionAppointmentModal';
import ReceptionCheckoutModal from '@/components/medical/ReceptionCheckoutModal';
import { Appointment } from '@/types/medical';
import ConfirmModal from '@/components/ui/ConfirmModal';
import CallMessageModal from '@/components/crm/CallMessageModal';
import NewSlotModal from '@/components/NewSlotModal';
import { getLocalDateRange, getTodayDateString, addDaysToDate } from '@/utils/dateUtils';
import { useToast } from '@/contexts/ToastContext';
import type { CRMMetricsPayload } from '@/lib/crm/metrics';
import CRMMetricsDashboard from '@/components/crm/CRMMetricsDashboard';

const TABS = [
  { id: 'reception', label: 'Recepção (Fila)', icon: Users },
  { id: 'analytics', label: 'Gestão & Métricas', icon: BarChart3 },
];

// Colunas adaptadas para Dark Mode
const COLUMNS = [
  { id: 'new', title: 'Novos Contatos', color: 'bg-blue-500', border: 'border-blue-100 dark:border-blue-900/30', bg: 'bg-blue-50/50 dark:bg-blue-900/10', text: 'text-blue-700 dark:text-blue-300' },
  { id: 'em_triagem', title: 'Em Triagem', color: 'bg-purple-500', border: 'border-purple-100 dark:border-purple-900/30', bg: 'bg-purple-50/50 dark:bg-purple-900/10', text: 'text-purple-700 dark:text-purple-300' },
  { id: 'agendando', title: 'Agendando', color: 'bg-rose-500', border: 'border-rose-100 dark:border-rose-900/30', bg: 'bg-rose-50/50 dark:bg-rose-900/10', text: 'text-rose-700 dark:text-rose-300' },
  { id: 'fila_espera', title: 'Na Fila de Espera', color: 'bg-emerald-500', border: 'border-emerald-100 dark:border-emerald-900/30', bg: 'bg-emerald-50/50 dark:bg-emerald-900/10', text: 'text-emerald-700 dark:text-emerald-300' },
];

export default function CRMPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('reception');
  const [chats, setChats] = useState<Chat[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  // Usar função utilitária para obter data atual no timezone local
  const [selectedDate, setSelectedDate] = useState(getTodayDateString());
  const [hideFinished, setHideFinished] = useState(true);
  
  // Estado para armazenar as métricas calculadas via API server-side
  const [crmMetrics, setCrmMetrics] = useState<CRMMetricsPayload | null>(null);
  const [crmMetricsLoading, setCrmMetricsLoading] = useState(false);
  const [crmMetricsError, setCrmMetricsError] = useState<string | null>(null);
  const [analyticsGranularity, setAnalyticsGranularity] = useState<'day' | 'month' | 'custom'>('day');
  const [analyticsDate, setAnalyticsDate] = useState(getTodayDateString());
  const [analyticsStartDate, setAnalyticsStartDate] = useState(getTodayDateString());
  const [analyticsEndDate, setAnalyticsEndDate] = useState(getTodayDateString());

  // Estados do Chat Lateral
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Drag & Drop
  const [draggedChatId, setDraggedChatId] = useState<number | null>(null);
  const dragItem = useRef<any>(null);
  const dragOverItem = useRef<any>(null);
  
  // Modais
  const [callingChat, setCallingChat] = useState<Chat | null>(null);
  const [callingAppointment, setCallingAppointment] = useState<Appointment | null>(null);
  const [isNewSlotModalOpen, setIsNewSlotModalOpen] = useState(false);
  
  // Forms
  const [callMessage, setCallMessage] = useState("Olá! Sua vez chegou. Por favor, dirija-se ao consultório.");
  
  // Appointments para recepção
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [calledAppointmentId, setCalledAppointmentId] = useState<number | null>(null);
  const [sendingCallAppointmentId, setSendingCallAppointmentId] = useState<number | null>(null);
  const [isUpdating, setIsUpdating] = useState<number | null>(null);
  const [isSendingCall, setIsSendingCall] = useState(false);
  const [selectedAppointmentForEdit, setSelectedAppointmentForEdit] = useState<Appointment | null>(null);
  const [receptionFlowTab, setReceptionFlowTab] = useState<'flow' | 'checkout'>('flow');
  const [receptionCheckoutAppointmentId, setReceptionCheckoutAppointmentId] = useState<number | null>(null);
  /** Hub checkout: paciente selecionado no painel de fechamento (lista 30% + painel 70%) */
  const [selectedCheckoutAppointmentId, setSelectedCheckoutAppointmentId] = useState<number | null>(null);
  /** Data sugerida ao abrir "Agendar agora" a partir do painel de checkout */
  const [newSlotInitialDate, setNewSlotInitialDate] = useState<string | null>(null);

  // Modal de confirmação
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

  useEffect(() => { 
    fetchData();
    
    // Realtime para atualizar cards automaticamente
    const channel = supabase
      .channel('crm_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chats' }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
        fetchData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedDate]);

  useEffect(() => {
    if (activeTab !== 'analytics') return;
    fetchCrmMetrics();
  }, [activeTab, analyticsGranularity, analyticsDate, analyticsStartDate, analyticsEndDate]);

  async function fetchData() {
    setLoading(true);
    
    // 1. Busca os Chats (Mantém para o Kanban/Lista)
    const { data: chatsData } = await supabase.from('chats')
        .select('*')
        .neq('status', 'DELETED')
        .order('last_interaction_at', { ascending: false }); 
    
    // 2. Busca Pacientes
    const { data: patientsData } = await supabase.from('patients').select('*');
    
    // 3. Busca Appointments do dia para recepção (usando função utilitária de timezone)
    const { startOfDay, endOfDay } = getLocalDateRange(selectedDate);
    const { data: appointmentsData } = await supabase
      .from('appointments')
      .select('*')
      .gte('start_time', startOfDay)
      .lte('start_time', endOfDay)
      .neq('status', 'cancelled')
      .neq('status', 'blocked')
      .order('start_time', { ascending: true });
    
    // 4. Log para debug: verificar quantos appointments foram retornados
    if (appointmentsData) {
      console.log('[DEBUG] Appointments carregados no CRM:', {
        total: appointmentsData.length,
        byStatus: appointmentsData.reduce((acc: any, apt: any) => {
          acc[apt.status || 'unknown'] = (acc[apt.status || 'unknown'] || 0) + 1;
          return acc;
        }, {}),
        byPatient: appointmentsData.reduce((acc: any, apt: any) => {
          const pid = apt.patient_id || 'null';
          acc[pid] = (acc[pid] || 0) + 1;
          return acc;
        }, {})
      });
    }
    
    if (chatsData) setChats(chatsData as Chat[]);
    if (patientsData) setPatients(patientsData);
    if (appointmentsData) setAppointments(appointmentsData as Appointment[]);
    setLoading(false);
  }

  async function fetchCrmMetrics() {
    setCrmMetricsLoading(true);
    setCrmMetricsError(null);
    try {
      const params = new URLSearchParams({
        granularity: analyticsGranularity,
      });
      if (analyticsGranularity === 'custom') {
        params.set('startDate', analyticsStartDate);
        params.set('endDate', analyticsEndDate);
      } else {
        params.set('date', analyticsDate);
      }
      const response = await fetch(`/api/crm/metrics?${params.toString()}`, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Falha ao carregar métricas (${response.status})`);
      }
      const metrics = (await response.json()) as CRMMetricsPayload;
      setCrmMetrics(metrics);
    } catch (error) {
      console.error('Erro ao calcular métricas do CRM:', error);
      setCrmMetricsError(error instanceof Error ? error.message : 'Erro inesperado');
    } finally {
      setCrmMetricsLoading(false);
    }
  }

  const getChatPatients = (chatId: number) => patients.filter(p => p.chat_id === chatId);

  const getDisplayName = (chat: Chat) => {
    const linkedPatients = getChatPatients(chat.id);
    if (linkedPatients.length > 0) return linkedPatients[0].name;
    if (chat.contact_name) return chat.contact_name;
    return chat.phone;
  };

  // --- AÇÕES DO SISTEMA ---
  const handleCardClick = (chat: Chat) => {
    setActiveChat(chat);
    setIsChatOpen(true);
  };

  const handleQuickSendToReception = async (chat: Chat, e: React.MouseEvent) => {
      e.stopPropagation();
      const maxOrder = Math.max(...chats.filter(c => c.appointment_date === selectedDate).map(c => c.queue_order || 0), 0);
      const nowTime = new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
      
      const updated = chats.map(c => c.id === chat.id ? { 
          ...c, stage: 'fila_espera', reception_status: 'waiting', 
          appointment_date: selectedDate, appointment_time: c.appointment_time || nowTime, 
          queue_order: maxOrder + 1 
      } : c);
      setChats(updated as any);

      await supabase.from('chats').update({ 
          stage: 'fila_espera', reception_status: 'waiting', 
          appointment_date: selectedDate, appointment_time: chat.appointment_time || nowTime, 
          queue_order: maxOrder + 1 
      }).eq('id', chat.id);
  };

  const handleDropPipeline = async (e: React.DragEvent, targetStage: string) => { 
      e.preventDefault(); 
      if (!draggedChatId) return; 
      
      const updated = chats.map(c => c.id === draggedChatId ? { ...c, stage: targetStage as any } : c); 
      setChats(updated); 
      
      await supabase.from('chats').update({ stage: targetStage }).eq('id', draggedChatId); 
      setDraggedChatId(null); 
  };

  const handleSortStart = (e: React.DragEvent, position: number) => { dragItem.current = position; };
  const handleSortEnter = (e: React.DragEvent, position: number) => { dragOverItem.current = position; const listCopy = [...chats]; const dragItemContent = listCopy[dragItem.current]; listCopy.splice(dragItem.current, 1); listCopy.splice(dragOverItem.current, 0, dragItemContent); dragItem.current = position; setChats(listCopy); };
  const handleSortEnd = async () => { dragItem.current = null; dragOverItem.current = null; const receptionList = chats.filter(c => c.appointment_date === selectedDate && (!c.reception_status || c.reception_status === 'waiting')); const updates = receptionList.map((chat, index) => ({ id: chat.id, queue_order: index + 1 })); for (const update of updates) { await supabase.from('chats').update({ queue_order: update.queue_order }).eq('id', update.id); } };

  const updateReceptionStatus = async (chatId: number, status: string) => { 
      const updated = chats.map(c => c.id === chatId ? { ...c, reception_status: status as any } : c); 
      setChats(updated); 
      await supabase.from('chats').update({ reception_status: status }).eq('id', chatId); 
  };

  const handleSendCallMessage = async (message: string, audioBlob?: Blob) => { 
      if (!callingChat) return; 
      
      setIsSendingCall(true);
      try {
        // Se houver áudio, enviar como mídia
        if (audioBlob) {
          // Upload do áudio
          const fileName = `${callingChat.id}_${Date.now()}_audio.webm`;
          const { error: uploadError } = await supabase.storage
            .from('midia')
            .upload(`uploads/${fileName}`, audioBlob, { contentType: 'audio/webm', upsert: true });
          
          if (uploadError) throw uploadError;
          
          const { data: { publicUrl } } = supabase.storage.from('midia').getPublicUrl(`uploads/${fileName}`);
          
          // Salvar mensagem no banco
          const { data: dbMsg } = await supabase.from('chat_messages').insert({
            chat_id: callingChat.id,
            sender: 'HUMAN_AGENT',
            message_text: message || 'Áudio',
            message_type: 'audio',
            media_url: publicUrl
          }).select().single();
          
          // Enviar via API
          await fetch('/api/whatsapp/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chatId: callingChat.id,
              phone: callingChat.phone,
              message: message || '',
              type: 'audio',
              mediaUrl: publicUrl,
              dbMessageId: dbMsg?.id
            })
          });
        } else {
          // Enviar mensagem de texto
          await supabase.from('chat_messages').insert({ 
            chat_id: callingChat.id, 
            sender: 'HUMAN_AGENT', 
            message_text: message, 
            message_type: 'text' 
          });
          
          // Enviar via API
          await fetch('/api/whatsapp/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chatId: callingChat.id,
              phone: callingChat.phone,
              message: message,
              type: 'text'
            })
          });
        }
        
        await updateReceptionStatus(callingChat.id, 'called'); 
        setCallingChat(null);
      } catch (error: any) {
        console.error('Erro ao enviar mensagem:', error);
        toast.error('Erro ao enviar mensagem: ' + (error.message || 'Tente novamente.'));
      } finally {
        setIsSendingCall(false);
      }
  };

  // Função para enviar mensagem WhatsApp para appointment
  const handleSendAppointmentCall = async (message: string, audioBlob?: Blob) => {
    const appointment = callingAppointment;
    if (!appointment || !appointment.patient_phone || isSendingCall || sendingCallAppointmentId != null) return;

    // Fecha o modal imediatamente para liberar a recepção enquanto envia em segundo plano
    setCallingAppointment(null);
    setSendingCallAppointmentId(appointment.id);
    setIsSendingCall(true);

    try {
      const cleanPhone = appointment.patient_phone.replace(/\D/g, '');
      
      // Buscar ou criar chat
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
      
      // Se houver áudio, enviar como mídia
      if (audioBlob) {
        // Upload do áudio
        const fileName = `${chatId}_${Date.now()}_audio.webm`;
        const { error: uploadError } = await supabase.storage
          .from('midia')
          .upload(`uploads/${fileName}`, audioBlob, { contentType: 'audio/webm', upsert: true });
        
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage.from('midia').getPublicUrl(`uploads/${fileName}`);
        
        // Salvar mensagem no banco
        const { data: dbMsg } = await supabase.from('chat_messages').insert({
          chat_id: chatId,
          sender: 'HUMAN_AGENT',
          message_text: message || 'Áudio',
          message_type: 'audio',
          media_url: publicUrl
        }).select().single();
        
        // Enviar via API
        const response = await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatId: chatId,
            phone: cleanPhone,
            message: message || '',
            type: 'audio',
            mediaUrl: publicUrl,
            dbMessageId: dbMsg?.id
          })
        });
        
        if (!response.ok) {
          throw new Error('Erro ao enviar mensagem via WhatsApp');
        }
      } else {
        // Enviar mensagem de texto via API
        const response = await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatId: chatId,
            phone: cleanPhone,
            message: message,
            type: 'text'
          })
        });
        
        if (!response.ok) {
          throw new Error('Erro ao enviar mensagem via WhatsApp');
        }
      }
      
      // Mudar status para 'called' após enviar mensagem
      const { error: updateError } = await supabase
        .from('appointments')
        .update({ status: 'called' })
        .eq('id', appointment.id);
      
      if (updateError) {
        console.error('Erro ao atualizar status:', updateError);
        throw updateError;
      }
      
      // Atualizar dados após envio finalizado
      setCalledAppointmentId(null);
      fetchData();
    } catch (error: any) {
      console.error('Erro ao enviar mensagem:', error);
      toast.error('Erro ao enviar mensagem: ' + (error.message || 'Tente novamente.'));
    } finally {
      setSendingCallAppointmentId(null);
      setIsSendingCall(false);
    }
  };
  

  // Confirma entrada na recepção sem redirecionar automaticamente.
  // O prontuário ficará disponível no painel médico quando a doutora abrir.
  const handleConfirmEntry = async (appointment: Appointment) => {
    try {
      toast.success(`Entrada confirmada para ${appointment.patient_name || 'paciente'}.`);
    } catch (error: any) {
      console.error('Erro ao confirmar entrada:', error);
      toast.error('Erro ao confirmar entrada: ' + (error.message || 'Tente novamente.'));
    }
  };

  // Usar função utilitária para adicionar/subtrair dias mantendo timezone local
  const changeDate = (days: number) => {
    setSelectedDate(addDaysToDate(selectedDate, days));
  };

  const receptionChats = chats.filter(c => c.appointment_date === selectedDate);
  const waitingList = receptionChats.filter(c => !c.reception_status || c.reception_status === 'waiting');
  const calledPatient = receptionChats.find(c => c.reception_status === 'called');
  const inServicePatient = receptionChats.find(c => c.reception_status === 'in_service');

  const getChatsForColumn = (columnId: string) => {
      return chats.filter(c => {
          if ((c.stage || 'new') !== columnId) return false;
          if (hideFinished && columnId === 'fila_espera' && c.reception_status === 'finished') return false; 
          return true;
      });
  };

  return (
    <div className="h-full flex flex-col bg-[#f8fafc] dark:bg-[#0b141a] relative overflow-hidden transition-colors duration-300">
      
      {/* HEADER */}
      <div className={`px-6 py-5 z-10 border-b border-slate-100 dark:border-gray-800 bg-white/50 dark:bg-[#1e2028]/80 backdrop-blur-sm transition-all duration-300 ${isChatOpen ? 'mr-[400px]' : ''}`}>
        <div className="flex justify-between items-center mb-4">
            <h1 className="text-xl font-bold text-slate-800 dark:text-gray-100 flex items-center gap-2">
                <div className="p-2 bg-rose-500 text-white rounded-lg shadow-lg shadow-rose-200 dark:shadow-none"><LayoutList className="w-5 h-5" /></div>
                Central de Controle
            </h1>
            <div className="flex bg-slate-100/80 dark:bg-[#111b21] p-1 rounded-xl shadow-inner border border-transparent dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => { setActiveTab('reception'); setReceptionFlowTab('flow'); }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                    activeTab === 'reception' && receptionFlowTab === 'flow'
                      ? 'bg-white dark:bg-[#2a2d36] text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-slate-500 dark:text-gray-500 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-white/50 dark:hover:bg-white/5'
                  }`}
                >
                  <Users className="w-4 h-4" /> Recepção (Fila)
                </button>
                <button
                  type="button"
                  onClick={() => { setActiveTab('reception'); setReceptionFlowTab('checkout'); }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                    activeTab === 'reception' && receptionFlowTab === 'checkout'
                      ? 'bg-white dark:bg-[#2a2d36] text-purple-600 dark:text-purple-400 shadow-sm'
                      : 'text-slate-500 dark:text-gray-500 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-white/50 dark:hover:bg-white/5'
                  }`}
                >
                  <DollarSign className="w-4 h-4" /> Checkout / Finalização
                </button>
                {TABS.filter(t => t.id === 'analytics').map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === tab.id ? 'bg-white dark:bg-[#2a2d36] text-rose-600 dark:text-rose-400 shadow-sm' : 'text-slate-500 dark:text-gray-500 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-white/50 dark:hover:bg-white/5'}`}>
                    <tab.icon className="w-4 h-4" /> {tab.label}
                  </button>
                ))}
            </div>
        </div>
      </div>

      {/* ÁREA PRINCIPAL */}
      <div className={`flex-1 overflow-hidden relative z-10 transition-all duration-300 ${isChatOpen ? 'mr-[400px]' : ''}`}>
        
        {/* === ABA 1: RECEPÇÃO (FILA) === */}
        {activeTab === 'reception' && (
            <div className="h-full flex flex-col p-6 overflow-hidden">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-4 bg-white dark:bg-[#1e2028] px-2 py-1.5 rounded-full border border-slate-200 dark:border-gray-700 shadow-sm transition-colors">
                        <button onClick={() => changeDate(-1)} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full text-slate-500 dark:text-gray-400"><ChevronLeft className="w-5 h-5"/></button>
                        <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-rose-500" /><input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="text-sm font-bold text-slate-700 dark:text-gray-200 bg-transparent outline-none uppercase" /></div>
                        <button onClick={() => changeDate(1)} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full text-slate-500 dark:text-gray-400"><ChevronRight className="w-5 h-5"/></button>
                    </div>
                    <button onClick={() => setIsNewSlotModalOpen(true)} className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-rose-200 dark:shadow-none transition-all hover:-translate-y-0.5"><UserPlus className="w-4 h-4" /> Novo Paciente</button>
                </div>

                <ReceptionFlowColumns
                  selectedDate={selectedDate}
                  appointments={appointments}
                  callingAppointmentId={sendingCallAppointmentId}
                  activeTab={receptionFlowTab}
                  onOpenCheckout={(apt) => setReceptionCheckoutAppointmentId(apt.id)}
                  selectedCheckoutAppointmentId={receptionFlowTab === 'checkout' ? selectedCheckoutAppointmentId : null}
                  onSelectCheckoutAppointment={receptionFlowTab === 'checkout' ? (apt) => setSelectedCheckoutAppointmentId(apt.id) : undefined}
                  onCheckoutSuccess={receptionFlowTab === 'checkout' ? () => { fetchData(); setSelectedCheckoutAppointmentId(null); } : undefined}
                  onScheduleReturn={receptionFlowTab === 'checkout' ? (suggestedDate) => { setNewSlotInitialDate(suggestedDate); setIsNewSlotModalOpen(true); } : undefined}
                  onEditAppointment={(apt) => setSelectedAppointmentForEdit(apt)}
                  onCallAppointment={(apt) => {
                    setCallingAppointment(apt);
                    setCalledAppointmentId(apt.id);
                  }}
                  onCheckIn={async (apt) => {
                    setIsUpdating(apt.id);
                    try {
                      const { error } = await supabase
                        .from('appointments')
                        .update({ status: 'waiting', queue_entered_at: new Date().toISOString() })
                        .eq('id', apt.id);
                      
                      if (error) throw error;
                      fetchData();
                    } catch (error: any) {
                      console.error('Erro ao fazer check-in:', error);
                      toast.error('Erro ao fazer check-in: ' + (error.message || 'Tente novamente.'));
                    } finally {
                      setIsUpdating(null);
                    }
                  }}
                  onConfirmArrival={async (apt) => {
                    setIsUpdating(apt.id);
                    try {
                      const { error } = await supabase
                        .from('appointments')
                        .update({ status: 'waiting', queue_entered_at: new Date().toISOString() })
                        .eq('id', apt.id);
                      
                      if (error) throw error;
                      
                      setCalledAppointmentId(null);
                      setCallingAppointment(null);
                      fetchData();
                    } catch (error: any) {
                      console.error('Erro ao confirmar chegada:', error);
                      toast.error('Erro ao confirmar chegada: ' + (error.message || 'Tente novamente.'));
                    } finally {
                      setIsUpdating(null);
                    }
                  }}
                  onEnter={async (apt) => {
                    setIsUpdating(apt.id);
                    try {
                      console.log('[DEBUG] Entrando em atendimento:', { 
                        appointmentId: apt.id, 
                        patientId: apt.patient_id,
                        currentStatus: apt.status 
                      });

                      // GARANTIR: Apenas 1 paciente pode estar em atendimento por vez
                      const { data: currentInServiceList, error: checkError } = await supabase
                        .from('appointments')
                        .select('*')
                        .eq('status', 'in_service')
                        .neq('id', apt.id);

                      if (checkError) {
                        console.error('Erro ao verificar atendimentos em andamento:', checkError);
                        toast.error('Erro ao verificar atendimentos. Tente novamente.');
                        setIsUpdating(null);
                        return;
                      }

                      // Se houver qualquer paciente em atendimento, pedir confirmação para finalizar
                      if (currentInServiceList && currentInServiceList.length > 0) {
                        setConfirmModal({
                          isOpen: true,
                          title: 'Finalizar atendimentos anteriores?',
                          message: `Há ${currentInServiceList.length} paciente(s) em atendimento. O sistema permite apenas 1 por vez. Deseja finalizar o(s) atendimento(s) anterior(es) e iniciar o atendimento de ${apt.patient_name || 'este paciente'}?`,
                          type: 'warning',
                          onConfirm: async () => {
                            setConfirmModal(prev => ({ ...prev, isOpen: false }));
                            const appointmentIdsToFinalize = currentInServiceList!.map((a: Appointment) => a.id);
                            const { error: finalizeError } = await supabase
                              .from('appointments')
                              .update({ status: 'finished', finished_at: new Date().toISOString() })
                              .in('id', appointmentIdsToFinalize);
                            if (finalizeError) {
                              toast.error('Erro ao finalizar atendimentos anteriores. Tente novamente.');
                              setIsUpdating(null);
                              return;
                            }
                            console.log(`[DEBUG] ${appointmentIdsToFinalize.length} atendimento(s) finalizado(s) para permitir novo atendimento`);
                            try {
                              if (!apt.patient_id) {
                                const { createBasicPatientFromAppointment } = await import('@/utils/patientRelations');
                                const newPatientId = await createBasicPatientFromAppointment(apt);
                                if (newPatientId) {
                                  const { linkAppointmentToPatient } = await import('@/utils/patientRelations');
                                  await linkAppointmentToPatient(apt.id, newPatientId);
                                }
                              }
                              const { error } = await supabase
                                .from('appointments')
                                .update({ status: 'in_service', in_service_at: new Date().toISOString() })
                                .eq('id', apt.id)
                                .select();
                              if (error) throw error;
                              await handleConfirmEntry(apt);
                              fetchData();
                            } catch (err: any) {
                              toast.error('Erro ao entrar em atendimento: ' + (err.message || 'Tente novamente.'));
                            } finally {
                              setIsUpdating(null);
                            }
                          }
                        });
                        setIsUpdating(null);
                        return;
                      }

                      // Verificar se appointment tem patient_id antes de entrar em atendimento
                      if (!apt.patient_id) {
                        // Tentar criar paciente automaticamente se não tiver
                        const { createBasicPatientFromAppointment } = await import('@/utils/patientRelations');
                        const newPatientId = await createBasicPatientFromAppointment(apt);
                        if (newPatientId) {
                          const { linkAppointmentToPatient } = await import('@/utils/patientRelations');
                          await linkAppointmentToPatient(apt.id, newPatientId);
                        }
                      }
                      
                      const { data, error } = await supabase
                        .from('appointments')
                        .update({ status: 'in_service', in_service_at: new Date().toISOString() })
                        .eq('id', apt.id)
                        .select();
                      
                      if (error) throw error;
                      
                      console.log('[DEBUG] Appointment atualizado para in_service:', { 
                        updatedCount: data?.length || 0,
                        appointmentId: apt.id 
                      });
                      
                      await handleConfirmEntry(apt);
                      
                      // Notificar médica (opcional: abrir Painel Médico em nova aba)
                      // Pode ser desabilitado se não desejar abrir automaticamente
                      // window.open(`/doctor?appointmentId=${apt.id}&patientId=${apt.patient_id}`, '_blank');
                      
                      fetchData();
                    } catch (error: any) {
                      console.error('Erro ao entrar em atendimento:', error);
                      toast.error('Erro ao entrar em atendimento: ' + (error.message || 'Tente novamente.'));
                    } finally {
                      setIsUpdating(null);
                    }
                  }}
                  onFinish={async (apt) => {
                    setIsUpdating(apt.id);
                    try {
                      console.log('[DEBUG] Finalizando appointment:', { 
                        appointmentId: apt.id, 
                        patientId: apt.patient_id,
                        currentStatus: apt.status 
                      });
                      
                      const { data, error } = await supabase
                        .from('appointments')
                        .update({ status: 'finished', finished_at: new Date().toISOString() })
                        .eq('id', apt.id)
                        .select();
                      
                      if (error) throw error;
                      
                      console.log('[DEBUG] Appointment finalizado com sucesso:', { 
                        updatedCount: data?.length || 0,
                        appointmentId: apt.id 
                      });
                      
                      fetchData();
                    } catch (error: any) {
                      console.error('Erro ao finalizar:', error);
                      toast.error('Erro ao finalizar: ' + (error.message || 'Tente novamente.'));
                    } finally {
                      setIsUpdating(null);
                    }
                  }}
                  onRevert={async (apt, newStatus) => {
                    setConfirmModal({
                      isOpen: true,
                      title: 'Reverter Status',
                      message: `Deseja reverter este paciente para "${newStatus === 'scheduled' ? 'Agendado' : 'Na Fila'}"?`,
                      type: 'warning',
                      onConfirm: async () => {
                        setIsUpdating(apt.id);
                        try {
                          console.log('[DEBUG] Revertendo appointment:', { 
                            appointmentId: apt.id, 
                            patientId: apt.patient_id,
                            currentStatus: apt.status,
                            newStatus 
                          });
                          
                          const updatePayload: Record<string, string | null> = { status: newStatus };
                          if (newStatus === 'scheduled') {
                            updatePayload.queue_entered_at = null;
                            updatePayload.in_service_at = null;
                            updatePayload.finished_at = null;
                          }
                          if (newStatus === 'waiting') {
                            updatePayload.queue_entered_at = new Date().toISOString();
                            updatePayload.in_service_at = null;
                            updatePayload.finished_at = null;
                          }

                          const { data, error } = await supabase
                            .from('appointments')
                            .update(updatePayload)
                            .eq('id', apt.id)
                            .select();
                          
                          if (error) throw error;
                          
                          console.log('[DEBUG] Appointment revertido:', { 
                            updatedCount: data?.length || 0,
                            appointmentId: apt.id 
                          });
                          
                          if (newStatus === 'scheduled' && apt.id === calledAppointmentId) {
                            setCalledAppointmentId(null);
                            setCallingAppointment(null);
                          }
                          
                          fetchData();
                        } catch (error: any) {
                          console.error('Erro ao reverter:', error);
                          toast.error('Erro ao reverter: ' + (error.message || 'Tente novamente.'));
                        } finally {
                          setIsUpdating(null);
                        }
                      }
                    });
                  }}
                  isUpdating={isUpdating}
                />
            </div>
        )}

        {/* === ABA 2: GESTÃO & MÉTRICAS === */}
        {activeTab === 'analytics' && (
          <CRMMetricsDashboard
            metrics={crmMetrics}
            loading={crmMetricsLoading}
            error={crmMetricsError}
            granularity={analyticsGranularity}
            date={analyticsDate}
            startDate={analyticsStartDate}
            endDate={analyticsEndDate}
            onGranularityChange={setAnalyticsGranularity}
            onDateChange={setAnalyticsDate}
            onStartDateChange={setAnalyticsStartDate}
            onEndDateChange={setAnalyticsEndDate}
            onRefresh={fetchCrmMetrics}
          />
        )}
      </div>

      {/* --- SIDEBAR DO CHAT --- */}
      <div className={`
        fixed inset-y-0 right-0 w-[400px] bg-white dark:bg-[#1e2028] border-l dark:border-gray-800 shadow-2xl transform transition-transform duration-300 z-50
        ${isChatOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
        <div className="h-full flex flex-col">
          <div className="bg-gray-50 dark:bg-[#2a2d36] border-b dark:border-gray-700 px-4 py-2 flex justify-between items-center shrink-0">
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <MessageSquare size={14} /> 
              Chat em Tempo Real
            </span>
            <button 
              onClick={() => { setIsChatOpen(false); setActiveChat(null); }}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-white/10"
            >
              <X size={18} />
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <ChatWindow chat={activeChat} />
          </div>
        </div>
      </div>

      {/* --- MODAIS --- */}
      <CallMessageModal
        isOpen={!!callingChat}
        onClose={() => setCallingChat(null)}
        onSend={handleSendCallMessage}
        title="Chamar Paciente"
        subtitle={callingChat ? getDisplayName(callingChat) : undefined}
        isLoading={isSendingCall}
        defaultMessage={callMessage}
      />

      <NewSlotModal
        isOpen={isNewSlotModalOpen}
        onClose={() => { setIsNewSlotModalOpen(false); setNewSlotInitialDate(null); }}
        onSuccess={fetchData}
        initialDate={newSlotInitialDate || selectedDate}
        initialTime={new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false })}
      />

      <ReceptionAppointmentModal
        isOpen={!!selectedAppointmentForEdit}
        appointment={selectedAppointmentForEdit}
        onClose={() => setSelectedAppointmentForEdit(null)}
        onSave={(updated) => {
          setAppointments(prev => prev.map(a => a.id === updated.id ? updated : a));
          fetchData();
        }}
      />

      <ReceptionCheckoutModal
        isOpen={!!receptionCheckoutAppointmentId}
        onClose={() => setReceptionCheckoutAppointmentId(null)}
        appointmentId={receptionCheckoutAppointmentId ?? 0}
        onSuccess={() => {
          setReceptionCheckoutAppointmentId(null);
          fetchData();
        }}
      />

      <CallMessageModal
        isOpen={!!callingAppointment}
        onClose={() => {
          setCallingAppointment(null);
          setCalledAppointmentId(null);
        }}
        onSend={handleSendAppointmentCall}
        title="Chamar Paciente"
        subtitle={callingAppointment?.patient_name || 'Sem nome'}
        isLoading={!!callingAppointment && sendingCallAppointmentId === callingAppointment.id}
        defaultMessage={callMessage}
      />

      {/* Modal de confirmação customizado */}
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