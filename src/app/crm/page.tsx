'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Chat, Patient } from '@/types';
import { 
  LayoutList, Clock, Users, 
  BarChart3, Megaphone, DoorOpen, Calendar, 
  ChevronLeft, ChevronRight, UserPlus, GripVertical, 
  TrendingUp, TrendingDown, Activity, 
  Baby, Timer, Eye, EyeOff, MessageSquare,
  MoreHorizontal, AlertCircle, X, Undo2, Loader2
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  AreaChart, Area, LineChart, Line, Cell
} from 'recharts';

// Importamos a Janela de Chat
import ChatWindow from '@/components/ChatWindow';
// Importamos o novo layout de fluxo de recepção
import ReceptionFlowColumns from '@/components/dashboard/ReceptionFlowColumns';
import { Appointment } from '@/types/medical';
import { NewPatientModal } from '@/components/medical-record/NewPatientModal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { useRouter } from 'next/navigation';
import { findOrCreatePatientByPhone } from '@/utils/patientUtils';
import CallMessageModal from '@/components/crm/CallMessageModal';
import { getLocalDateRange, getTodayDateString, addDaysToDate } from '@/utils/dateUtils';
import { fetchCRMMetrics, CRMMetrics } from '@/utils/crmMetrics';

// --- CORES & CONFIGURAÇÃO VISUAL ---
const COLORS_FUNNEL = ['#3b82f6', '#a855f7', '#f43f5e', '#10b981'];

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
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('reception');
  const [chats, setChats] = useState<Chat[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  // Usar função utilitária para obter data atual no timezone local
  const [selectedDate, setSelectedDate] = useState(getTodayDateString());
  const [hideFinished, setHideFinished] = useState(true);
  
  // Estado para armazenar as métricas calculadas
  const [crmMetrics, setCrmMetrics] = useState<CRMMetrics | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);

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
  const [isAddingManual, setIsAddingManual] = useState(false);
  
  // Forms
  const [manualForm, setManualForm] = useState({ phone: '', name: '', time: '', notes: '' });
  const [callMessage, setCallMessage] = useState("Olá! Sua vez chegou. Por favor, dirija-se ao consultório.");
  
  // Appointments para recepção
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [calledAppointmentId, setCalledAppointmentId] = useState<number | null>(null);
  const [needsPatientRegistration, setNeedsPatientRegistration] = useState(false);
  const [pendingAppointment, setPendingAppointment] = useState<Appointment | null>(null);
  const [isUpdating, setIsUpdating] = useState<number | null>(null);
  const [isSendingCall, setIsSendingCall] = useState(false);
  
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
    
    // 4. Busca Chat Messages para cálculo de tempo de resposta
    const { data: messagesData } = await supabase
      .from('chat_messages')
      .select('*')
      .order('created_at', { ascending: true });
    
    // Log para debug: verificar quantos appointments foram retornados
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
    
    // 5. Calcular métricas do CRM
    if (chatsData && appointmentsData && messagesData) {
      try {
        const metrics = await fetchCRMMetrics(
          chatsData as Chat[],
          appointmentsData as Appointment[],
          messagesData as any[],
          selectedDate
        );
        setCrmMetrics(metrics);
      } catch (error) {
        console.error('Erro ao calcular métricas do CRM:', error);
      }
    }

    if (chatsData) setChats(chatsData as Chat[]);
    if (patientsData) setPatients(patientsData);
    if (appointmentsData) setAppointments(appointmentsData as Appointment[]);
    if (messagesData) setChatMessages(messagesData);
    setLoading(false);
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
        alert('Erro ao enviar mensagem: ' + (error.message || 'Tente novamente.'));
      } finally {
        setIsSendingCall(false);
      }
  };

  // Função para enviar mensagem WhatsApp para appointment
  const handleSendAppointmentCall = async (message: string, audioBlob?: Blob) => {
    if (!callingAppointment || !callingAppointment.patient_phone || isSendingCall) return;
    
    setIsSendingCall(true);
    
    try {
      const cleanPhone = callingAppointment.patient_phone.replace(/\D/g, '');
      
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
            contact_name: callingAppointment.patient_name || cleanPhone,
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
        .eq('id', callingAppointment.id);
      
      if (updateError) {
        console.error('Erro ao atualizar status:', updateError);
        throw updateError;
      }
      
      // Fechar modal e atualizar dados
      setCallingAppointment(null);
      setCalledAppointmentId(null);
      fetchData();
    } catch (error: any) {
      console.error('Erro ao enviar mensagem:', error);
      alert('Erro ao enviar mensagem: ' + (error.message || 'Tente novamente.'));
    } finally {
      setIsSendingCall(false);
    }
  };
  

  // Função para confirmar entrada e abrir prontuário
  const handleConfirmEntry = async (appointment: Appointment) => {
    if (!appointment.patient_phone) {
      alert('Paciente não possui telefone cadastrado.');
      return;
    }
    
    try {
      // Buscar paciente por telefone
      const patientId = await findOrCreatePatientByPhone(appointment.patient_phone);
      
      if (!patientId) {
        // Paciente não existe, precisa cadastrar
        setNeedsPatientRegistration(true);
        setPendingAppointment(appointment);
        return;
      }
      
      // Paciente existe, navegar para prontuário
      router.push(`/doctor?patientId=${patientId}&appointmentId=${appointment.id}`);
    } catch (error: any) {
      console.error('Erro ao confirmar entrada:', error);
      alert('Erro ao confirmar entrada: ' + (error.message || 'Tente novamente.'));
    }
  };

  const handleAddManualPatient = async () => { 
      if (!manualForm.phone) return alert("Digite um nome."); 
      const nowTime = new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}); 
      const maxOrder = Math.max(...chats.map(c => c.queue_order || 0), 0); 
      
      const { data } = await supabase.from('chats').insert({ 
          phone: manualForm.phone, 
          contact_name: manualForm.phone, 
          stage: 'agendando', 
          reception_status: 'waiting', 
          appointment_date: selectedDate, 
          appointment_time: manualForm.time || nowTime, 
          queue_order: maxOrder + 1, 
          ai_summary: 'Paciente Manual', 
          notes: manualForm.notes, 
          last_interaction_at: new Date().toISOString() 
      }).select().single(); 
      
      if (data) { setChats([...chats, data]); setIsAddingManual(false); setManualForm({ phone: '', name: '', time: '', notes: '' }); } 
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

  // --- PREPARAÇÃO DE DADOS (MÉTRICAS REAIS) ---
  const dashboardData = useMemo(() => {
    // Se temos métricas calculadas, usamos elas
    if (crmMetrics) {
      return {
        averageQueueTime: crmMetrics.averageQueueTime,
        averageServiceTime: crmMetrics.averageServiceTime,
        averageResponseTime: crmMetrics.averageResponseTime,
        leadToConsultationRate: crmMetrics.leadToConsultationRate,
        queueTimeTrend: crmMetrics.queueTimeTrend,
        serviceTimeTrend: crmMetrics.serviceTimeTrend,
        responseTimeTrend: crmMetrics.responseTimeTrend,
        conversionTrend: crmMetrics.conversionTrend,
        funnelData: crmMetrics.funnelData,
        trendData: crmMetrics.trendData,
      };
    }

    // Senão, retornamos estrutura zerada para visualização
    return { 
      averageQueueTime: 0,
      averageServiceTime: 0,
      averageResponseTime: 0,
      leadToConsultationRate: 0,
      queueTimeTrend: { value: 0, isPositive: true },
      serviceTimeTrend: { value: 0, isPositive: true },
      responseTimeTrend: { value: 0, isPositive: true },
      conversionTrend: { value: 0, isPositive: true },
      funnelData: [
        { name: 'Novos Chats', value: 0, fill: '#3b82f6' },
        { name: 'Agendamentos', value: 0, fill: '#a855f7' },
        { name: 'Consultas Realizadas', value: 0, fill: '#10b981' },
      ], 
      trendData: [
        { name: 'Dom', queueTime: 0, conversionRate: 0 },
        { name: 'Seg', queueTime: 0, conversionRate: 0 },
        { name: 'Ter', queueTime: 0, conversionRate: 0 },
        { name: 'Qua', queueTime: 0, conversionRate: 0 },
        { name: 'Qui', queueTime: 0, conversionRate: 0 },
        { name: 'Sex', queueTime: 0, conversionRate: 0 },
        { name: 'Sáb', queueTime: 0, conversionRate: 0 },
      ],
    };
  }, [crmMetrics]);

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
                {TABS.map(tab => (
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
                    <button onClick={() => setIsAddingManual(true)} className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-rose-200 dark:shadow-none transition-all hover:-translate-y-0.5"><UserPlus className="w-4 h-4" /> Novo Paciente</button>
                </div>

                <ReceptionFlowColumns
                  selectedDate={selectedDate}
                  appointments={appointments}
                  onCallAppointment={(apt) => {
                    setCallingAppointment(apt);
                    setCalledAppointmentId(apt.id);
                  }}
                  onCheckIn={async (apt) => {
                    setIsUpdating(apt.id);
                    try {
                      const { error } = await supabase
                        .from('appointments')
                        .update({ status: 'waiting' })
                        .eq('id', apt.id);
                      
                      if (error) throw error;
                      fetchData();
                    } catch (error: any) {
                      console.error('Erro ao fazer check-in:', error);
                      alert('Erro ao fazer check-in: ' + (error.message || 'Tente novamente.'));
                    } finally {
                      setIsUpdating(null);
                    }
                  }}
                  onConfirmArrival={async (apt) => {
                    setIsUpdating(apt.id);
                    try {
                      const { error } = await supabase
                        .from('appointments')
                        .update({ status: 'waiting' })
                        .eq('id', apt.id);
                      
                      if (error) throw error;
                      
                      setCalledAppointmentId(null);
                      setCallingAppointment(null);
                      fetchData();
                    } catch (error: any) {
                      console.error('Erro ao confirmar chegada:', error);
                      alert('Erro ao confirmar chegada: ' + (error.message || 'Tente novamente.'));
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
                        alert('Erro ao verificar atendimentos. Tente novamente.');
                        setIsUpdating(null);
                        return;
                      }

                      // Se houver qualquer paciente em atendimento, finalizar automaticamente
                      if (currentInServiceList && currentInServiceList.length > 0) {
                        const currentInService = currentInServiceList[0];
                        const shouldFinalize = window.confirm(
                          `Há ${currentInServiceList.length} paciente(s) em atendimento. ` +
                          `O sistema permite apenas 1 paciente por vez. ` +
                          `Deseja finalizar o(s) atendimento(s) anterior(es) e iniciar o atendimento de ${apt.patient_name || 'este paciente'}?`
                        );
                        
                        if (!shouldFinalize) {
                          // Usuário cancelou, não prosseguir
                          setIsUpdating(null);
                          return;
                        }
                        
                        // Finalizar todos os atendimentos em andamento
                        const appointmentIdsToFinalize = currentInServiceList.map(a => a.id);
                        const { error: finalizeError } = await supabase
                          .from('appointments')
                          .update({ status: 'finished' })
                          .in('id', appointmentIdsToFinalize);
                        
                        if (finalizeError) {
                          console.error('Erro ao finalizar atendimentos anteriores:', finalizeError);
                          alert('Erro ao finalizar atendimentos anteriores. Tente novamente.');
                          setIsUpdating(null);
                          return;
                        }
                        
                        console.log(`[DEBUG] ${appointmentIdsToFinalize.length} atendimento(s) finalizado(s) para permitir novo atendimento`);
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
                        .update({ status: 'in_service' })
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
                      alert('Erro ao entrar em atendimento: ' + (error.message || 'Tente novamente.'));
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
                        .update({ status: 'finished' })
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
                      alert('Erro ao finalizar: ' + (error.message || 'Tente novamente.'));
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
                          
                          const { data, error } = await supabase
                            .from('appointments')
                            .update({ status: newStatus })
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
                          alert('Erro ao reverter: ' + (error.message || 'Tente novamente.'));
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
            <div className="h-full overflow-y-auto p-8 custom-scrollbar">
                
                {/* 1. SMART CARDS */}
                <div className="grid grid-cols-4 gap-6 mb-8 animate-fade-in-up">
                    <SmartCard 
                        title="Tempo Médio na Fila" 
                        value={`${dashboardData.averageQueueTime}min`} 
                        trendValue={dashboardData.queueTimeTrend.isPositive ? `-${dashboardData.queueTimeTrend.value}min` : `+${dashboardData.queueTimeTrend.value}min`}
                        trendLabel="vs. ontem"
                        isPositive={dashboardData.queueTimeTrend.isPositive} 
                        icon={Timer} 
                        color="blue" 
                        sparkData={dashboardData.trendData.map(d => d.queueTime)}
                    />
                    <SmartCard 
                        title="Tempo Médio de Atendimento" 
                        value={`${dashboardData.averageServiceTime}min`} 
                        trendValue={dashboardData.serviceTimeTrend.isPositive ? `-${dashboardData.serviceTimeTrend.value}min` : `+${dashboardData.serviceTimeTrend.value}min`}
                        trendLabel="vs. ontem"
                        isPositive={dashboardData.serviceTimeTrend.isPositive} 
                        icon={Clock}
                        color="emerald"
                        sparkData={dashboardData.trendData.map(d => d.queueTime)}
                    />
                    <SmartCard 
                        title="Tempo Médio de Resposta" 
                        value={`${dashboardData.averageResponseTime}min`} 
                        trendValue={dashboardData.responseTimeTrend.isPositive ? `-${dashboardData.responseTimeTrend.value}min` : `+${dashboardData.responseTimeTrend.value}min`}
                        trendLabel="vs. ontem"
                        isPositive={dashboardData.responseTimeTrend.isPositive} 
                        icon={MessageSquare} 
                        color="rose" 
                        sparkData={dashboardData.trendData.map(d => d.queueTime)}
                    />
                    <SmartCard 
                        title="Taxa de Conversão" 
                        value={`${dashboardData.leadToConsultationRate.toFixed(1)}%`} 
                        trendValue={dashboardData.conversionTrend.isPositive ? `+${dashboardData.conversionTrend.value.toFixed(1)}%` : `-${dashboardData.conversionTrend.value.toFixed(1)}%`}
                        trendLabel="vs. ontem"
                        isPositive={dashboardData.conversionTrend.isPositive} 
                        icon={TrendingUp} 
                        color="purple" 
                        sparkData={dashboardData.trendData.map(d => d.conversionRate)}
                    />
                </div>

                {/* 2. GRÁFICO DE FUNIL */}
                <div className="mb-8">
                    <div className="bg-white dark:bg-[#1e2028] p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-gray-800 flex flex-col h-[400px] transition-colors">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="font-bold text-slate-800 dark:text-gray-100 flex items-center gap-2">
                                <Activity className="w-5 h-5 text-rose-500" /> Funil de Conversão
                            </h3>
                            <button className="p-1 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg text-slate-400"><MoreHorizontal className="w-5 h-5"/></button>
                        </div>
                        <div className="flex-1 w-full">
                           <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={dashboardData.funnelData} layout="vertical" margin={{top: 20, right: 30, left: 20, bottom: 5}}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" strokeOpacity={0.2} />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={120} tick={{fontSize: 12, fill: '#94a3b8', fontWeight: 'bold'}} axisLine={false} tickLine={false} />
                                <Tooltip 
                                  cursor={{fill: '#f8fafc', opacity: 0.1}}
                                  contentStyle={{borderRadius: '12px', border: 'none', backgroundColor: '#1e293b', color: '#fff', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.3)'}}
                                />
                                <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={32}>
                                  {dashboardData.funnelData.map((entry: any, index: number) => (
                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                  ))}
                                </Bar>
                              </BarChart>
                           </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* 3. GRÁFICO DE TENDÊNCIA */}
                <div className="mb-8">
                    <div className="bg-white dark:bg-[#1e2028] p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-gray-800 h-[300px] flex flex-col transition-colors">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-slate-800 dark:text-gray-100 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-emerald-500"/> Evolução Semanal</h3>
                        </div>
                        <div className="flex-1 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={dashboardData.trendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <defs>
                                <linearGradient id="colorQueueTime" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                </linearGradient>
                                <linearGradient id="colorConversion" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                </linearGradient>
                                </defs>
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                                <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeOpacity={0.2} />
                                <Tooltip contentStyle={{borderRadius: '12px', border: 'none', backgroundColor: '#1e293b', color: '#fff', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.3)'}} />
                                <Legend />
                                <Area 
                                    yAxisId="left"
                                    type="monotone" 
                                    dataKey="queueTime" 
                                    stroke="#3b82f6" 
                                    strokeWidth={3} 
                                    fillOpacity={1} 
                                    fill="url(#colorQueueTime)" 
                                    name="Tempo na Fila (min)"
                                />
                                <Area 
                                    yAxisId="right"
                                    type="monotone" 
                                    dataKey="conversionRate" 
                                    stroke="#10b981" 
                                    strokeWidth={3} 
                                    fillOpacity={1} 
                                    fill="url(#colorConversion)" 
                                    name="Taxa de Conversão (%)"
                                />
                            </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

            </div>
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

      {isAddingManual && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-[#202c33] w-full max-w-md rounded-3xl shadow-2xl p-6 border border-transparent dark:border-gray-700">
                <h3 className="font-bold text-lg mb-4 text-slate-800 dark:text-gray-100">Adicionar Paciente Manual</h3>
                <input placeholder="Telefone ou Nome" className="w-full p-3 bg-slate-50 dark:bg-[#111b21] rounded-xl mb-3 border border-slate-200 dark:border-gray-700 text-slate-800 dark:text-gray-200 outline-none focus:border-rose-500" value={manualForm.phone} onChange={e => setManualForm({...manualForm, phone: e.target.value})} />
                <input type="time" className="w-full p-3 bg-slate-50 dark:bg-[#111b21] rounded-xl mb-3 border border-slate-200 dark:border-gray-700 text-slate-800 dark:text-gray-200 outline-none focus:border-rose-500" value={manualForm.time} onChange={e => setManualForm({...manualForm, time: e.target.value})} />
                <button onClick={handleAddManualPatient} className="w-full bg-rose-600 text-white py-3 rounded-xl font-bold hover:bg-rose-700">Adicionar à Fila</button>
                <button onClick={() => setIsAddingManual(false)} className="w-full mt-2 text-slate-400 hover:text-slate-600 dark:hover:text-gray-300 py-2 transition-colors">Cancelar</button>
            </div>
        </div>
      )}

      <CallMessageModal
        isOpen={!!callingAppointment}
        onClose={() => {
          if (!isSendingCall) {
            setCallingAppointment(null);
            setCalledAppointmentId(null);
          }
        }}
        onSend={handleSendAppointmentCall}
        title="Chamar Paciente"
        subtitle={callingAppointment?.patient_name || 'Sem nome'}
        isLoading={isSendingCall}
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

// --- COMPONENTE: SMART CARD (DARK MODE) ---
function SmartCard({ title, value, trendValue, trendLabel, isPositive, icon: Icon, color, sparkData }: any) {
    const colorMap: any = {
        blue: { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-500 dark:text-blue-300', hex: '#3b82f6' },
        emerald: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-500 dark:text-emerald-300', hex: '#10b981' },
        rose: { bg: 'bg-rose-50 dark:bg-rose-900/20', text: 'text-rose-500 dark:text-rose-300', hex: '#f43f5e' },
        purple: { bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-500 dark:text-purple-300', hex: '#a855f7' },
    };
    
    const theme = colorMap[color] || colorMap.blue;
    const chartData = sparkData ? sparkData.map((val: number, i: number) => ({ i, val })) : [];

    return (
        <div className="bg-white dark:bg-[#1e2028] p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-gray-800 hover:shadow-md transition-all relative overflow-hidden group h-[140px] flex flex-col justify-between">
            {/* Cabeçalho */}
            <div className="flex justify-between items-start z-10">
                <div>
                    <p className="text-slate-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wide mb-1">{title}</p>
                    <h3 className="text-2xl font-black text-slate-800 dark:text-gray-100">{value}</h3>
                </div>
                <div className={`p-2 rounded-xl ${theme.bg} ${theme.text}`}>
                    <Icon className="w-5 h-5" />
                </div>
            </div>

            {/* Rodapé e Sparkline */}
            <div className="flex items-end justify-between z-10 mt-2">
                <div className="flex items-center gap-2">
                    <span className={`flex items-center text-xs font-bold px-1.5 py-0.5 rounded-md ${isPositive ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400'}`}>
                        {isPositive ? <TrendingUp className="w-3 h-3 mr-1"/> : <TrendingDown className="w-3 h-3 mr-1"/>}
                        {trendValue}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-gray-500 font-medium">{trendLabel}</span>
                </div>
                
                {/* Mini Gráfico (Sparkline) */}
                <div className="w-20 h-10 absolute bottom-2 right-2 opacity-30 group-hover:opacity-100 transition-opacity">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                            <Line 
                                type="monotone" 
                                dataKey="val" 
                                stroke={theme.hex} 
                                strokeWidth={3} 
                                dot={false} 
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}