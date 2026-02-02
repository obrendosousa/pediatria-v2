'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  ChevronLeft, ChevronRight, Calendar, User, Ban, Plus, 
  FileText, List, Grid, Clock, X, Phone, CalendarDays, Info, Save, Edit2, Stethoscope, Trash2
} from 'lucide-react';
import NewSlotModal from '@/components/NewSlotModal';
import { getLocalDateRange, saveAppointmentDateTime } from '@/utils/dateUtils';

export default function AgendaPage() {
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
  
  // Modais
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<any | null>(null);
  
  // Estado de Edição
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ 
    patient_name: '', 
    patient_phone: '', 
    parent_name: '',
    patient_sex: '' as 'M' | 'F' | '',
    notes: '',
    date: '',
    dateDisplay: '',
    time: '',
    doctor_id: null as number | null,
    status: 'scheduled' as string
  });
  const [doctors, setDoctors] = useState<Array<{ id: number; name: string }>>([]);
  
  const [modalDate, setModalDate] = useState('');
  const [modalTime, setModalTime] = useState('');

  // Referência para o container de scroll e hora atual
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const currentTimeSlotRef = useRef<HTMLDivElement>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Exibir todas as 24 horas do dia
  const startHour = 0;
  const endHour = 24;

  useEffect(() => {
    fetchData();
  }, [currentDate, currentWeekStart, viewMode]);

  // Atualizar hora atual a cada minuto e fazer scroll para a hora atual
  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(new Date());
    };

    // Atualizar imediatamente
    updateTime();

    // Atualizar a cada minuto
    const interval = setInterval(updateTime, 60000);

    return () => clearInterval(interval);
  }, []);

  // Scroll para hora atual quando mudar de data ou carregar
  useEffect(() => {
    if (viewMode === 'day' && scrollContainerRef.current) {
      const scrollToCurrentTime = () => {
        // Verificar se a data selecionada é hoje
        const today = new Date();
        const selectedDate = new Date(currentDate);
        const isToday = 
          today.getFullYear() === selectedDate.getFullYear() &&
          today.getMonth() === selectedDate.getMonth() &&
          today.getDate() === selectedDate.getDate();

        if (isToday && currentTimeSlotRef.current && scrollContainerRef.current) {
          const container = scrollContainerRef.current;
          const slot = currentTimeSlotRef.current;
          
          // Calcular posição do slot atual
          const containerRect = container.getBoundingClientRect();
          const slotRect = slot.getBoundingClientRect();
          const scrollPosition = 
            slot.offsetTop - 
            containerRect.height / 2 + 
            slotRect.height / 2;

          // Scroll suave para a hora atual
          container.scrollTo({
            top: Math.max(0, scrollPosition),
            behavior: 'smooth'
          });
        }
      };

      // Aguardar para garantir que o DOM está renderizado
      const timeout = setTimeout(scrollToCurrentTime, 300);
      return () => clearTimeout(timeout);
    }
  }, [currentDate, viewMode, currentTime, appointments]);

  // Função para converter YYYY-MM-DD para DD/MM/YYYY
  const formatDateToDisplay = (dateStr: string): string => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  // Função para converter DD/MM/YYYY para YYYY-MM-DD
  const formatDateToISO = (dateStr: string): string => {
    if (!dateStr) return '';
    const cleaned = dateStr.replace(/\D/g, '');
    if (cleaned.length !== 8) return '';
    const day = cleaned.substring(0, 2);
    const month = cleaned.substring(2, 4);
    const year = cleaned.substring(4, 8);
    return `${year}-${month}-${day}`;
  };

  // Função para validar e formatar data enquanto digita
  const handleDateInputChange = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    const limited = numbers.slice(0, 8);
    
    let formatted = '';
    if (limited.length > 0) {
      formatted = limited.slice(0, 2);
      if (limited.length > 2) {
        formatted += '/' + limited.slice(2, 4);
      }
      if (limited.length > 4) {
        formatted += '/' + limited.slice(4, 8);
      }
    }
    
    setEditForm(prev => ({
      ...prev,
      dateDisplay: formatted,
      date: formatDateToISO(formatted)
    }));
  };

  // Buscar médicos
  useEffect(() => {
    async function fetchDoctors() {
      try {
        const { data, error } = await supabase
          .from('doctors')
          .select('id, name')
          .eq('active', true)
          .order('name');
        
        if (error) throw error;
        if (data) setDoctors(data);
      } catch (err) {
        console.error('Erro ao carregar médicos:', err);
      }
    }
    fetchDoctors();
  }, []);

  // Sincroniza formulário de edição quando abre um agendamento
  useEffect(() => {
    if (selectedAppointment) {
        const dateStr = selectedAppointment.start_time;
        const cleanDateStr = dateStr ? dateStr.replace(/[+-]\d{2}:\d{2}$/, '').replace('Z', '') : '';
        const [datePart, timePart] = cleanDateStr.split('T');
        
        setEditForm({
            patient_name: selectedAppointment.patient_name || '',
            patient_phone: selectedAppointment.patient_phone || '',
            parent_name: selectedAppointment.parent_name || '',
            patient_sex: (selectedAppointment.patient_sex as 'M' | 'F' | '') || '',
            notes: selectedAppointment.anamnesis || selectedAppointment.notes || '',
            date: datePart || '',
            dateDisplay: datePart ? formatDateToDisplay(datePart) : '',
            time: timePart ? timePart.substring(0, 5) : '',
            doctor_id: selectedAppointment.doctor_id || null,
            status: selectedAppointment.status || 'scheduled'
        });
        setIsEditing(false); // Reseta modo de edição ao abrir
    }
  }, [selectedAppointment]);

  async function fetchData() {
    setLoading(true);
    let dId = doctorId;
    if (!dId) {
        const { data: doc } = await supabase.from('doctors').select('id').limit(1).single();
        if (doc) {
            dId = doc.id;
            setDoctorId(doc.id);
        } else { setLoading(false); return; }
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

  // Função para Salvar Edição
  const handleSaveEdit = async () => {
    if (!selectedAppointment) return;

    if (!editForm.date || editForm.date.length !== 10) {
      alert('Por favor, insira uma data válida no formato DD/MM/AAAA');
      return;
    }

    if (!editForm.time) {
      alert('Por favor, insira um horário válido');
      return;
    }

    if (!editForm.doctor_id) {
      alert('Por favor, selecione um médico');
      return;
    }

    try {
        const selectedDoctor = doctors.find(d => d.id === editForm.doctor_id);
        if (!selectedDoctor) throw new Error('Médico não encontrado');

        // Usar função utilitária para garantir timezone correto
        const start_time = saveAppointmentDateTime(editForm.date, editForm.time);

        const updateData: any = {
            patient_name: editForm.patient_name,
            patient_phone: editForm.patient_phone || null,
            notes: editForm.notes || null,
            anamnesis: editForm.notes || null,
            start_time: start_time,
            doctor_id: editForm.doctor_id,
            doctor_name: selectedDoctor.name,
            status: editForm.status
        };

        if (editForm.parent_name) {
            updateData.parent_name = editForm.parent_name;
        }

        if (editForm.patient_sex) {
            updateData.patient_sex = editForm.patient_sex;
        }

        const { error } = await supabase
            .from('appointments')
            .update(updateData)
            .eq('id', selectedAppointment.id);

        if (error) throw error;

        // Atualiza localmente para refletir na UI instantaneamente
        const updatedApp = { 
            ...selectedAppointment, 
            ...updateData,
            start_time: start_time
        };
        setSelectedAppointment(updatedApp);
        
        // Atualiza as listas principais
        setAppointments(prev => prev.map(a => a.id === updatedApp.id ? updatedApp : a));
        setWeekAppointments(prev => prev.map(a => a.id === updatedApp.id ? updatedApp : a));
        
        setIsEditing(false);
        fetchData(); // Recarrega dados para garantir sincronização
        alert('Agendamento atualizado com sucesso!');
    } catch (err: any) {
        console.error('Erro ao salvar edição:', err);
        alert('Erro ao salvar: ' + (err.message || 'Tente novamente.'));
    }
  };

  const handleDeleteAppointment = async () => {
    if (!selectedAppointment) return;

    const confirmMessage = selectedAppointment.status === 'blocked' 
      ? 'Deseja realmente remover este bloqueio?'
      : `Deseja realmente cancelar o agendamento de ${selectedAppointment.patient_name || 'este paciente'}?`;

    if (!confirm(confirmMessage)) return;

    try {
        const { error } = await supabase
            .from('appointments')
            .delete()
            .eq('id', selectedAppointment.id);

        if (error) throw error;

        // Remove das listas locais
        setAppointments(prev => prev.filter(a => a.id !== selectedAppointment.id));
        setWeekAppointments(prev => prev.filter(a => a.id !== selectedAppointment.id));
        
        // Fecha o modal
        setSelectedAppointment(null);
        alert('Agendamento cancelado com sucesso!');
        
        // Recarrega os dados para garantir sincronização
        fetchData();
    } catch (err) {
        console.error(err);
        alert('Erro ao cancelar agendamento.');
    }
  };

  const changeDay = (days: number) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + days);
    setCurrentDate(newDate);
  };

  const changeWeek = (weeks: number) => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() + (weeks * 7));
    setCurrentWeekStart(newDate);
  };

  // Gerar todos os slots de 30 minutos para as 24 horas
  const timeSlots = [];
  for (let h = startHour; h < endHour; h++) {
      timeSlots.push(`${h.toString().padStart(2, '0')}:00`);
      if (h < 23) { // Não adicionar 24:30
          timeSlots.push(`${h.toString().padStart(2, '0')}:30`);
      }
  }

  // Função para verificar se um slot é a hora atual
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

    // Verificar se está no mesmo intervalo de 30 minutos
    if (hours === currentHours) {
      if (minutes === 0 && currentMinutes < 30) return true;
      if (minutes === 30 && currentMinutes >= 30) return true;
    }

    return false;
  };

  const getAppointmentAt = (time: string) => {
      return appointments.find(app => {
          // Tratar como hora local, não UTC
          // Se start_time vem como "2026-01-22T09:00:00", criar Date local
          const dateStr = app.start_time;
          if (!dateStr) return false;
          
          // Se já tem timezone info, remover e tratar como local
          const cleanDateStr = dateStr.replace(/[+-]\d{2}:\d{2}$/, '').replace('Z', '');
          const [datePart, timePart] = cleanDateStr.split('T');
          if (!datePart || !timePart) return false;
          
          const [year, month, day] = datePart.split('-').map(Number);
          const [hours, minutes] = timePart.split(':').map(Number);
          
          // Criar data local (sem conversão de timezone)
          const d = new Date(year, month - 1, day, hours, minutes || 0, 0);
          const appTime = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false });
          return appTime === time;
      });
  };

  const getCardColorClasses = (app: any) => {
    if (app.status === 'blocked') {
      return {
        bg: 'bg-red-50 dark:bg-red-900/20',
        border: 'border-red-100 dark:border-red-500/30',
        borderL: 'border-l-red-400 dark:border-l-red-500',
        text: 'text-red-700 dark:text-red-300',
        icon: 'text-red-400',
        hover: ''
      };
    }
    if (app.patient_sex === 'M') {
      return {
        bg: 'bg-blue-50 dark:bg-blue-900/20',
        border: 'border-blue-100 dark:border-blue-500/30',
        borderL: 'border-l-blue-400 dark:border-l-blue-500',
        text: 'text-slate-700 dark:text-gray-200',
        icon: 'text-blue-500 dark:text-blue-300',
        hover: 'hover:border-blue-200 dark:hover:border-blue-500/50'
      };
    }
    if (app.patient_sex === 'F') {
      return {
        bg: 'bg-pink-50 dark:bg-pink-900/20',
        border: 'border-pink-100 dark:border-pink-500/30',
        borderL: 'border-l-pink-400 dark:border-l-pink-500',
        text: 'text-slate-700 dark:text-gray-200',
        icon: 'text-pink-500 dark:text-pink-300',
        hover: 'hover:border-pink-200 dark:hover:border-pink-500/50'
      };
    }
    return {
      bg: 'bg-indigo-50 dark:bg-indigo-900/20',
      border: 'border-indigo-100 dark:border-indigo-500/30',
      borderL: 'border-l-indigo-400 dark:border-l-indigo-500',
      text: 'text-slate-700 dark:text-gray-200',
      icon: 'text-indigo-500 dark:text-indigo-300',
      hover: 'hover:border-indigo-200 dark:hover:border-indigo-500/50'
    };
  };

  const weekDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(currentWeekStart);
      d.setDate(d.getDate() + i);
      return d;
  });

  const getAppointmentsForDay = (date: Date) => {
      const dateStr = date.toLocaleDateString('en-CA');
      return weekAppointments.filter(app => app.start_time.startsWith(dateStr));
  };

  const openNewSlotModal = (dateStr?: string, timeStr?: string) => {
      setModalDate(dateStr || currentDate.toLocaleDateString('en-CA'));
      setModalTime(timeStr || '');
      setIsNewModalOpen(true);
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const arr = [];
    for(let i=0; i<firstDay; i++) arr.push(null);
    for(let i=1; i<=days; i++) arr.push(new Date(year, month, i));
    return arr;
  };

  return (
    <div className="h-full flex flex-col bg-[#f8fafc] dark:bg-[#0b141a] transition-colors duration-300">
      {/* Header */}
      <div className="h-16 px-6 flex items-center justify-between bg-white dark:bg-[#1e2028] border-b border-slate-100 dark:border-gray-800 shadow-sm z-20 transition-colors">
        <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-300 rounded-lg shadow-sm">
                <Calendar className="w-5 h-5" />
            </div>
            <div>
                <h1 className="text-base font-bold text-slate-800 dark:text-gray-100 leading-none">Agenda da Dra.</h1>
                <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">Visão Geral da Unidade</p>
            </div>
        </div>

        <div className="flex items-center bg-slate-50 dark:bg-[#2a2d36] rounded-lg p-1 border border-slate-200 dark:border-gray-700">
            <button onClick={() => viewMode === 'day' ? changeDay(-1) : changeWeek(-1)} className="p-1.5 hover:bg-white dark:hover:bg-white/10 rounded-md text-slate-400 dark:text-gray-400 transition-all"><ChevronLeft className="w-4 h-4"/></button>
            <span className="px-4 text-sm font-bold text-slate-700 dark:text-gray-200 min-w-[180px] text-center capitalize">
                {viewMode === 'day' 
                    ? currentDate.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'long' })
                    : `${currentWeekStart.toLocaleDateString('pt-BR', {day: 'numeric', month: 'short'})} - ${weekDays[6].toLocaleDateString('pt-BR', {day: 'numeric', month: 'short'})}`
                }
            </span>
            <button onClick={() => viewMode === 'day' ? changeDay(1) : changeWeek(1)} className="p-1.5 hover:bg-white dark:hover:bg-white/10 rounded-md text-slate-400 dark:text-gray-400 transition-all"><ChevronRight className="w-4 h-4"/></button>
        </div>

        <div className="flex items-center gap-3">
            <div className="flex bg-slate-100 dark:bg-[#2a2d36] p-1 rounded-lg">
                <button onClick={() => setViewMode('day')} className={`p-1.5 rounded-md transition-all flex items-center gap-2 px-3 text-xs font-bold ${viewMode === 'day' ? 'bg-white dark:bg-gray-600 shadow text-slate-800 dark:text-white' : 'text-slate-400 dark:text-gray-500'}`}><List className="w-3.5 h-3.5" /> Dia</button>
                <button onClick={() => setViewMode('week')} className={`p-1.5 rounded-md transition-all flex items-center gap-2 px-3 text-xs font-bold ${viewMode === 'week' ? 'bg-white dark:bg-gray-600 shadow text-slate-800 dark:text-white' : 'text-slate-400 dark:text-gray-500'}`}><Grid className="w-3.5 h-3.5" /> Semana</button>
            </div>
            <button onClick={() => openNewSlotModal()} className="flex items-center gap-2 bg-rose-500 hover:bg-rose-600 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md active:scale-95 transition-all"><Plus className="w-4 h-4" /> Novo Agendamento</button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex p-6 gap-6">
        <div className="flex-1 bg-white dark:bg-[#1e2028] rounded-2xl border border-slate-100 dark:border-gray-800 shadow-sm overflow-hidden flex flex-col transition-colors">
            
            {viewMode === 'day' ? (
                <div 
                    ref={scrollContainerRef}
                    className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-3 relative"
                >
                    {timeSlots.map((time, index) => {
                        const app = getAppointmentAt(time);
                        const isBlocked = app?.status === 'blocked';
                        const isCurrent = isCurrentTimeSlot(time);
                        
                        return (
                            <div 
                                key={time} 
                                ref={isCurrent ? currentTimeSlotRef : null}
                                className="flex gap-4 group relative"
                            >
                                {/* Indicador da hora atual (agulha) - renderizado apenas no slot atual */}
                                {isCurrent && (
                                    <div className="absolute left-0 right-0 top-3.5 z-20 pointer-events-none">
                                        <div className="flex gap-4">
                                            <div className="w-14"></div>
                                            <div className="flex-1 relative">
                                                <div className="absolute left-0 top-0 w-full h-0.5 bg-rose-500 dark:bg-rose-400 shadow-lg shadow-rose-500/50"></div>
                                                <div className="absolute left-0 top-0 w-3 h-3 -translate-x-1.5 -translate-y-1.5 rounded-full bg-rose-500 dark:bg-rose-400 shadow-lg shadow-rose-500/50 border-2 border-white dark:border-[#1e2028]"></div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                
                                <div className="w-14 pt-2.5 text-right">
                                    <span className={`text-xs font-bold ${
                                        isCurrent 
                                            ? 'text-rose-600 dark:text-rose-400' 
                                            : 'text-slate-400 dark:text-gray-500'
                                    }`}>
                                        {time}
                                    </span>
                                </div>
                                <div className="flex-1 min-h-[50px] relative">
                                    <div className={`absolute top-3.5 left-0 w-full h-px ${
                                        isCurrent 
                                            ? 'bg-rose-200 dark:bg-rose-900/30' 
                                            : 'bg-slate-50 dark:bg-gray-800'
                                    }`}></div>
                                    {app ? (() => {
                                        const colors = getCardColorClasses(app);
                                        return (
                                            <div 
                                              onClick={() => setSelectedAppointment(app)}
                                              className={`relative z-10 p-3 rounded-xl border flex justify-between items-center transition-all hover:shadow-md cursor-pointer animate-fade-in-up ${colors.bg} ${colors.border} ${colors.hover}`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-2 rounded-lg bg-white dark:bg-white/10 ${colors.icon}`}>
                                                        {isBlocked ? <Ban className="w-4 h-4" /> : <User className="w-4 h-4" />}
                                                    </div>
                                                    <div>
                                                        <p className={`text-sm font-bold ${colors.text}`}>
                                                            {isBlocked ? 'Bloqueio' : (app.patient_name || 'Agendado (Sem nome)')}
                                                        </p>
                                                        {!isBlocked && (
                                                            <>
                                                                {app.parent_name && (
                                                                    <p className="text-xs text-slate-500 dark:text-gray-400">Responsável: {app.parent_name}</p>
                                                                )}
                                                                <p className="text-xs text-slate-500 dark:text-gray-400">
                                                                    {app.patient_phone ? app.patient_phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3') : 'S/ telefone'}
                                                                </p>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                                {app.notes && <div className="text-[10px] text-slate-400 dark:text-gray-500 bg-white/50 dark:bg-black/20 px-2 py-1 rounded border border-slate-100/50 dark:border-gray-700 flex items-center gap-1"><FileText className="w-3 h-3"/> Detalhes</div>}
                                            </div>
                                        );
                                    })() : (
                                        <button onClick={() => openNewSlotModal(undefined, time)} className="w-full h-full min-h-[40px] mt-1 rounded-xl border border-dashed border-transparent hover:border-rose-200 dark:hover:border-rose-700 hover:bg-rose-50 dark:hover:bg-rose-900/10 flex items-center justify-center text-rose-300 dark:text-rose-700 transition-all text-xs font-bold gap-2 opacity-0 group-hover:opacity-100"><Plus className="w-3 h-3" /> Adicionar</button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="h-full flex overflow-x-auto custom-scrollbar">
                    <div className="flex-1 grid grid-cols-7 min-w-[1000px] divide-x divide-slate-100 dark:divide-gray-800">
                        {weekDays.map((day) => {
                            const dateStr = day.toLocaleDateString('en-CA');
                            const dayApps = getAppointmentsForDay(day);
                            const isToday = day.toDateString() === new Date().toDateString();

                            return (
                                <div key={dateStr} className={`flex flex-col h-full transition-colors ${isToday ? 'bg-rose-50/10 dark:bg-rose-900/5' : 'bg-white dark:bg-[#1e2028]'}`}>
                                    <div className={`text-center p-3 border-b ${isToday ? 'border-rose-200 dark:border-rose-900/30 bg-rose-50/50 dark:bg-rose-900/10' : 'border-slate-100 dark:border-gray-800'}`}>
                                        <span className={`text-[10px] font-extrabold uppercase block mb-1 tracking-wider ${isToday ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400 dark:text-gray-500'}`}>{day.toLocaleDateString('pt-BR', { weekday: 'short' })}</span>
                                        <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-lg font-bold ${isToday ? 'bg-rose-600 text-white shadow-md' : 'text-slate-700 dark:text-gray-400'}`}>{day.getDate()}</div>
                                    </div>
                                    <div className="flex-1 p-2 space-y-2 overflow-y-auto custom-scrollbar">
                                        {dayApps.map(app => {
                                            // Tratar como hora local, não UTC
                                            const dateStr = app.start_time;
                                            const cleanDateStr = dateStr ? dateStr.replace(/[+-]\d{2}:\d{2}$/, '').replace('Z', '') : '';
                                            const [datePart, timePart] = cleanDateStr.split('T');
                                            let time = '00:00';
                                            if (datePart && timePart) {
                                                const [year, month, day] = datePart.split('-').map(Number);
                                                const [hours, minutes] = timePart.split(':').map(Number);
                                                const d = new Date(year, month - 1, day, hours, minutes || 0, 0);
                                                time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false });
                                            }
                                            const isBlocked = app.status === 'blocked';
                                            const colors = getCardColorClasses(app);
                                            return (
                                                <div 
                                                    key={app.id} 
                                                    onClick={() => setSelectedAppointment(app)}
                                                    className={`p-2.5 rounded-xl border text-left shadow-sm hover:shadow-md transition-all cursor-pointer group relative overflow-hidden border-l-4
                                                        ${isBlocked 
                                                            ? 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900/30 border-l-red-400 dark:border-l-red-500' 
                                                            : `${colors.bg} ${colors.border} ${colors.borderL} ${colors.hover}`
                                                        }`}
                                                >
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="text-[10px] font-bold text-slate-500 dark:text-gray-400 bg-slate-50 dark:bg-black/20 px-1 rounded">{time}</span>
                                                        {isBlocked && <Ban className="w-3 h-3 text-red-400"/>}
                                                    </div>
                                                    <p className={`text-xs font-bold leading-tight truncate ${colors.text}`}>
                                                        {isBlocked ? 'Bloqueio' : (app.patient_name || 'Agendado (Sem nome)')}
                                                    </p>
                                                    {!isBlocked && (
                                                        <>
                                                            {app.parent_name && (
                                                                <p className="text-[10px] text-slate-400 dark:text-gray-500 mt-0.5 truncate">Responsável: {app.parent_name}</p>
                                                            )}
                                                            <p className="text-[10px] text-slate-400 dark:text-gray-500 mt-0.5 truncate">
                                                                {app.patient_phone ? app.patient_phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3') : 'S/ telefone'}
                                                            </p>
                                                        </>
                                                    )}
                                                </div>
                                            );
                                        })}
                                        <button onClick={() => openNewSlotModal(dateStr)} className="w-full py-2 border border-dashed border-slate-200 dark:border-gray-700 rounded-lg text-slate-300 dark:text-gray-600 hover:text-rose-500 dark:hover:text-rose-400 hover:border-rose-300 dark:hover:border-rose-500/50 transition-all flex items-center justify-center"><Plus className="w-4 h-4" /></button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>

        {viewMode === 'day' && (
            <div className="w-72 flex flex-col gap-4">
                <div className="bg-white dark:bg-[#1e2028] p-5 rounded-2xl border border-slate-100 dark:border-gray-800 shadow-sm transition-colors">
                    <div className="flex justify-between items-center mb-4 px-1"><h3 className="text-sm font-bold text-slate-700 dark:text-gray-200 capitalize">{currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</h3></div>
                    <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 dark:text-gray-500 mb-2"><span>D</span><span>S</span><span>T</span><span>Q</span><span>Q</span><span>S</span><span>S</span></div>
                    <div className="grid grid-cols-7 gap-1">
                        {getDaysInMonth(currentDate).map((d, i) => {
                            if (!d) return <div key={i}></div>;
                            const isSelected = d.toDateString() === currentDate.toDateString();
                            return (
                                <button key={i} onClick={() => setCurrentDate(new Date(d))} className={`h-8 w-8 rounded-lg text-xs font-bold transition-all flex items-center justify-center ${isSelected ? 'bg-rose-500 text-white shadow-md' : 'text-slate-600 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-white/10'}`}>{d.getDate()}</button>
                            );
                        })}
                    </div>
                </div>
            </div>
        )}
      </div>

      {/* --- POPUP DE DETALHES --- */}
      {selectedAppointment && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-[#202c33] w-full max-w-lg rounded-2xl shadow-lg border border-slate-200 dark:border-gray-700 overflow-hidden animate-scale-in">
            
            {/* Header do Modal */}
            <div className={`p-4 border-b border-slate-200 dark:border-gray-700 flex justify-between items-center ${
              selectedAppointment.status === 'blocked' 
                ? 'bg-red-50/50 dark:bg-red-900/10' 
                : selectedAppointment.patient_sex === 'M'
                ? 'bg-blue-50/50 dark:bg-blue-900/10'
                : selectedAppointment.patient_sex === 'F'
                ? 'bg-pink-50/50 dark:bg-pink-900/10'
                : 'bg-indigo-50/50 dark:bg-indigo-900/10'
            }`}>
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${
                  selectedAppointment.status === 'blocked' 
                    ? 'bg-red-100 dark:bg-red-900/20 text-red-500 dark:text-red-400' 
                    : selectedAppointment.patient_sex === 'M'
                    ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-500 dark:text-blue-400'
                    : selectedAppointment.patient_sex === 'F'
                    ? 'bg-pink-100 dark:bg-pink-900/20 text-pink-500 dark:text-pink-400'
                    : 'bg-indigo-100 dark:bg-indigo-900/20 text-indigo-500 dark:text-indigo-400'
                }`}>
                  <Info size={16}/>
                </div>
                <h3 className="text-base font-semibold text-slate-700 dark:text-gray-200">
                    {isEditing ? 'Editar Agendamento' : 'Detalhes do Agendamento'}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedAppointment(null)} 
                className="p-1.5 hover:bg-white/60 dark:hover:bg-white/10 rounded-lg transition-colors"
              >
                <X size={18} className="text-slate-400 dark:text-gray-500"/>
              </button>
            </div>
            
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
              
              {/* CABEÇALHO PACIENTE */}
              <div className="flex items-center gap-3 pb-4 border-b border-slate-200 dark:border-gray-700">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-semibold text-lg ${
                  selectedAppointment.status === 'blocked' 
                    ? 'bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400' 
                    : selectedAppointment.patient_sex === 'M'
                    ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                    : selectedAppointment.patient_sex === 'F'
                    ? 'bg-pink-100 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400'
                    : 'bg-indigo-100 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-300'
                }`}>
                  {isEditing ? <Edit2 size={18}/> : (selectedAppointment.status === 'blocked' ? <Ban size={18}/> : (selectedAppointment.patient_name?.charAt(0) || 'P'))}
                </div>
                
                <div className="flex-1">
                    {isEditing ? (
                         <div className="space-y-1">
                            <label className="text-[10px] font-semibold text-slate-500 dark:text-gray-400 uppercase">Nome do Paciente</label>
                            <input 
                                type="text" 
                                className="w-full text-sm font-medium text-slate-800 dark:text-gray-100 border border-slate-200 dark:border-gray-600 rounded-lg px-3 py-1.5 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/20 outline-none bg-white dark:bg-[#2a2d36] transition-all"
                                value={editForm.patient_name}
                                onChange={(e) => setEditForm({...editForm, patient_name: e.target.value})}
                                placeholder="Digite o nome..."
                            />
                         </div>
                    ) : (
                        <>
                            <h4 className="text-base font-semibold text-slate-800 dark:text-gray-100 mb-1.5">
                                {selectedAppointment.status === 'blocked' ? 'Horário Bloqueado' : (selectedAppointment.patient_name || 'Paciente sem nome')}
                            </h4>
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md ${
                                  selectedAppointment.status === 'blocked' 
                                    ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' 
                                    : (selectedAppointment.status === 'scheduled' 
                                      ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' 
                                      : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300')
                                }`}>
                                    {selectedAppointment.status === 'blocked' ? 'BLOQUEIO' : (selectedAppointment.status === 'scheduled' ? 'AGENDADO' : selectedAppointment.status)}
                                </span>
                                {selectedAppointment.patient_sex && (
                                    <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md ${
                                        selectedAppointment.patient_sex === 'M' 
                                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' 
                                            : 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300'
                                    }`}>
                                        {selectedAppointment.patient_sex === 'M' ? 'MASCULINO' : 'FEMININO'}
                                    </span>
                                )}
                            </div>
                        </>
                    )}
                    {isEditing && (
                      <div className="space-y-2 mt-2">
                        <div>
                          <label className="text-[10px] font-semibold text-slate-500 dark:text-gray-400 uppercase">Sexo da Criança</label>
                          <div className="flex gap-0 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg mt-1">
                            <button
                              type="button"
                              onClick={() => setEditForm({...editForm, patient_sex: 'M'})}
                              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                                editForm.patient_sex === 'M' 
                                  ? 'bg-white text-blue-600 shadow-sm dark:bg-[#2a2d36] dark:text-blue-400' 
                                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                              }`}
                            >
                              Masculino
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditForm({...editForm, patient_sex: 'F'})}
                              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                                editForm.patient_sex === 'F' 
                                  ? 'bg-white text-pink-600 shadow-sm dark:bg-[#2a2d36] dark:text-pink-400' 
                                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                              }`}
                            >
                              Feminino
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-slate-500 dark:text-gray-400 uppercase">Status</label>
                          <select
                            value={editForm.status}
                            onChange={e => setEditForm({...editForm, status: e.target.value})}
                            className="w-full text-xs font-medium text-slate-700 dark:text-gray-200 border border-slate-200 dark:border-gray-600 rounded-md px-2 py-1.5 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/20 outline-none bg-white dark:bg-[#2a2d36] transition-all mt-1"
                          >
                            <option value="scheduled">Agendado</option>
                            <option value="waiting">Na Espera</option>
                            <option value="in_service">Em Atendimento</option>
                            <option value="finished">Finalizado</option>
                            <option value="blocked">Bloqueado</option>
                            <option value="cancelled">Cancelado</option>
                          </select>
                        </div>
                      </div>
                    )}
                </div>
              </div>

              {/* DATA E HORA */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 dark:bg-[#1a1f28] rounded-lg border border-slate-200 dark:border-gray-700">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <CalendarDays size={14} className="text-indigo-500 dark:text-indigo-400"/>
                    <span className="text-[10px] font-semibold text-slate-500 dark:text-gray-400 uppercase">Data</span>
                  </div>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editForm.dateDisplay}
                      onChange={e => handleDateInputChange(e.target.value)}
                      placeholder="DD/MM/AAAA"
                      maxLength={10}
                      className="w-full text-sm font-semibold text-slate-700 dark:text-gray-200 border border-slate-200 dark:border-gray-600 rounded-md px-2 py-1.5 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/20 outline-none bg-white dark:bg-[#2a2d36] transition-all"
                    />
                  ) : (
                    <p className="text-sm font-semibold text-slate-700 dark:text-gray-200">
                      {new Date(selectedAppointment.start_time).toLocaleDateString('pt-BR', { 
                        day: 'numeric', 
                        month: 'short', 
                        year: 'numeric' 
                      })}
                    </p>
                  )}
                </div>
                <div className="p-3 bg-slate-50 dark:bg-[#1a1f28] rounded-lg border border-slate-200 dark:border-gray-700">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Clock size={14} className="text-indigo-500 dark:text-indigo-400"/>
                    <span className="text-[10px] font-semibold text-slate-500 dark:text-gray-400 uppercase">Horário</span>
                  </div>
                  {isEditing ? (
                    <input
                      type="time"
                      value={editForm.time}
                      onChange={e => setEditForm({...editForm, time: e.target.value})}
                      className="w-full text-sm font-semibold text-slate-700 dark:text-gray-200 border border-slate-200 dark:border-gray-600 rounded-md px-2 py-1.5 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/20 outline-none bg-white dark:bg-[#2a2d36] transition-all"
                    />
                  ) : (
                    <p className="text-sm font-semibold text-slate-700 dark:text-gray-200">{
                      (() => {
                        const dateStr = selectedAppointment.start_time;
                        const cleanDateStr = dateStr ? dateStr.replace(/[+-]\d{2}:\d{2}$/, '').replace('Z', '') : '';
                        const [datePart, timePart] = cleanDateStr.split('T');
                        if (datePart && timePart) {
                          const [year, month, day] = datePart.split('-').map(Number);
                          const [hours, minutes] = timePart.split(':').map(Number);
                          const d = new Date(year, month - 1, day, hours, minutes || 0, 0);
                          return d.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit', hour12: false});
                        }
                        return '00:00';
                      })()
                    }</p>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                {/* MÉDICO */}
                <div className="flex items-center gap-2.5 p-2.5 bg-slate-50 dark:bg-[#1a1f28] rounded-lg border border-slate-200 dark:border-gray-700">
                  <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/20 text-indigo-500 dark:text-indigo-400 rounded-md">
                    <Stethoscope size={14}/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold text-slate-500 dark:text-gray-400 uppercase">Médico</p>
                    {isEditing ? (
                      <select
                        value={editForm.doctor_id || ''}
                        onChange={e => setEditForm({...editForm, doctor_id: Number(e.target.value)})}
                        className="w-full text-sm text-slate-700 dark:text-gray-200 font-medium border border-slate-200 dark:border-gray-600 rounded-md px-2 py-1.5 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/20 outline-none bg-white dark:bg-[#2a2d36] transition-all"
                      >
                        <option value="">Selecione...</option>
                        {doctors.map(doctor => (
                          <option key={doctor.id} value={doctor.id}>
                            {doctor.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-sm text-slate-700 dark:text-gray-200 font-medium truncate">
                        {selectedAppointment.doctor_name || 'Não informado'}
                      </p>
                    )}
                  </div>
                </div>

                {/* RESPONSÁVEL */}
                <div className="flex items-center gap-2.5 p-2.5 bg-slate-50 dark:bg-[#1a1f28] rounded-lg border border-slate-200 dark:border-gray-700">
                  <div className="p-1.5 bg-purple-100 dark:bg-purple-900/20 text-purple-500 dark:text-purple-400 rounded-md">
                    <User size={14}/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold text-slate-500 dark:text-gray-400 uppercase">Responsável</p>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editForm.parent_name}
                        onChange={e => setEditForm({...editForm, parent_name: e.target.value})}
                        placeholder="Nome do responsável"
                        className="w-full text-sm text-slate-700 dark:text-gray-200 font-medium border border-slate-200 dark:border-gray-600 rounded-md px-2 py-1.5 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/20 outline-none bg-white dark:bg-[#2a2d36] transition-all"
                      />
                    ) : (
                      <p className="text-sm text-slate-700 dark:text-gray-200 font-medium truncate">
                        {selectedAppointment.parent_name || 'Não informado'}
                      </p>
                    )}
                  </div>
                </div>

                {/* WHATSAPP */}
                <div className="flex items-center gap-2.5 p-2.5 bg-slate-50 dark:bg-[#1a1f28] rounded-lg border border-slate-200 dark:border-gray-700">
                  <div className="p-1.5 bg-green-100 dark:bg-green-900/20 text-green-500 dark:text-green-400 rounded-md">
                    <Phone size={14}/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold text-slate-500 dark:text-gray-400 uppercase">WhatsApp</p>
                    {isEditing ? (
                        <input 
                            type="text" 
                            className="w-full text-sm font-medium text-slate-700 dark:text-gray-200 border border-slate-200 dark:border-gray-600 rounded-md px-2 py-1 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/20 outline-none bg-white dark:bg-[#2a2d36] transition-all"
                            value={editForm.patient_phone}
                            onChange={(e) => setEditForm({...editForm, patient_phone: e.target.value})}
                            placeholder="Ex: (99) 99999-9999"
                        />
                    ) : (
                        <p className="text-sm text-slate-700 dark:text-gray-200 font-medium">
                            {selectedAppointment.patient_phone 
                                ? selectedAppointment.patient_phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
                                : 'Não informado'}
                        </p>
                    )}
                  </div>
                </div>
              </div>

              {/* ANAMNESE */}
              <div className="p-3 bg-indigo-50/30 dark:bg-indigo-900/5 rounded-lg border border-indigo-200/30 dark:border-indigo-800/20">
                <div className="flex items-center gap-2 mb-2">
                  <FileText size={14} className="text-indigo-500 dark:text-indigo-400"/>
                  <p className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-300 uppercase">Anamnese / Observações</p>
                </div>
                {isEditing ? (
                    <textarea 
                        className="w-full p-2.5 text-sm text-slate-700 dark:text-gray-200 border border-indigo-200 dark:border-indigo-800/30 rounded-lg focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/20 outline-none bg-white dark:bg-[#1a1f28] min-h-[80px] resize-y transition-all"
                        value={editForm.notes}
                        onChange={(e) => setEditForm({...editForm, notes: e.target.value})}
                        placeholder="Digite as observações..."
                    />
                ) : (
                    <div className="p-2.5 bg-white/60 dark:bg-[#1a1f28]/60 rounded-lg">
                        <p className="text-xs text-slate-600 dark:text-gray-300 leading-relaxed">
                            {selectedAppointment.anamnesis || selectedAppointment.notes || 'Nenhuma observação registrada.'}
                        </p>
                    </div>
                )}
              </div>
            </div>

            {/* RODAPÉ COM AÇÕES */}
            <div className="p-4 bg-slate-50/50 dark:bg-[#1e2028] border-t border-slate-200 dark:border-gray-700 flex gap-2">
              {isEditing ? (
                  <>
                    <button 
                        onClick={() => setIsEditing(false)}
                        className="flex-1 bg-white dark:bg-[#2a2d36] border border-slate-300 dark:border-gray-600 text-slate-600 dark:text-gray-300 py-2 rounded-lg text-xs font-semibold hover:bg-slate-50 dark:hover:bg-white/10 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={handleSaveEdit}
                        className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center justify-center gap-1.5"
                    >
                        <Save size={14}/> Salvar
                    </button>
                  </>
              ) : (
                  <>
                    <button 
                        onClick={handleDeleteAppointment}
                        className="px-3 bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center justify-center gap-1.5"
                    >
                        <Trash2 size={14}/> Cancelar
                    </button>
                    <button 
                        onClick={() => setIsEditing(true)}
                        className="flex-1 bg-white dark:bg-[#2a2d36] border border-slate-300 dark:border-gray-600 text-slate-600 dark:text-gray-300 py-2 rounded-lg text-xs font-semibold hover:bg-slate-50 dark:hover:bg-white/10 transition-colors flex items-center justify-center gap-1.5"
                    >
                        <Edit2 size={14}/> Editar
                    </button>
                    <button 
                        onClick={() => setSelectedAppointment(null)}
                        className="flex-1 bg-rose-500 hover:bg-rose-600 text-white py-2 rounded-lg text-xs font-semibold shadow-sm transition-colors"
                    >
                        Fechar
                    </button>
                  </>
              )}
            </div>
          </div>
        </div>
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