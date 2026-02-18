'use client';

import { useState, useEffect } from 'react';
import { 
  Clock, AlertCircle, CheckCircle2, 
  Settings, ChevronLeft, ChevronRight, X, Lock, Unlock,
  Plus, Trash2, Calendar as CalendarIcon, LayoutGrid, Loader2, Save,
  Briefcase, Coffee, AlertTriangle, Users, CheckCircle, XCircle
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { logAudit } from '@/lib/audit';
import { ScheduleRule } from '@/types';
import ConfirmModal from '@/components/ui/ConfirmModal';

const supabase = createClient();

// --- TIPOS ---
interface Override {
  id: number;
  override_date: string; // YYYY-MM-DD
  reason: string;
  is_available: boolean;
}

const DAYS_MAP = { 0: 'Domingo', 1: 'Segunda', 2: 'Terça', 3: 'Quarta', 4: 'Quinta', 5: 'Sexta', 6: 'Sábado' };
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

type PendingProfile = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  status: string;
  created_at: string;
};

export default function ConfiguracoesPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  // --- ESTADOS ---
  const [activeTab, setActiveTab] = useState<'geral' | 'escala' | 'calendario' | 'usuarios'>('geral');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [pendingUsers, setPendingUsers] = useState<PendingProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [actingOnId, setActingOnId] = useState<string | null>(null);
  const [confirmDeleteSlotId, setConfirmDeleteSlotId] = useState<number | null>(null);
  const [confirmRestoreDate, setConfirmRestoreDate] = useState<string | null>(null);

  // Dados
  const [duration, setDuration] = useState<number>(60);
  const [scheduleRules, setScheduleRules] = useState<ScheduleRule[]>([]);
  const [overrides, setOverrides] = useState<Override[]>([]);

  // Edição Escala
  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [newSlotStart, setNewSlotStart] = useState('08:00');
  const [newSlotEnd, setNewSlotEnd] = useState('18:00');

  // Calendário
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideType, setOverrideType] = useState<'block' | 'open'>('block');

  // --- EFEITOS ---
  useEffect(() => {
    fetchAllConfigs();
  }, []);

  useEffect(() => {
    if (isAdmin && activeTab === 'usuarios') fetchPendingUsers();
  }, [isAdmin, activeTab]);

  const fetchPendingUsers = async () => {
    setLoadingUsers(true);
    const { data } = await supabase.from('profiles').select('id, email, full_name, role, status, created_at').eq('status', 'pending').order('created_at', { ascending: false });
    setPendingUsers((data as PendingProfile[]) || []);
    setLoadingUsers(false);
  };

  const handleApproveUser = async (userId: string) => {
    const { data: { user: me } } = await supabase.auth.getUser();
    if (!me?.id) return;
    setActingOnId(userId);
    const { error } = await supabase.from('profiles').update({ status: 'approved', approved_at: new Date().toISOString(), approved_by: me.id, updated_at: new Date().toISOString() }).eq('id', userId);
    setActingOnId(null);
    if (error) showFeedback('error', 'Erro ao aprovar.');
    else {
      await logAudit({ userId: me.id, action: 'approve_user', entityType: 'user_approval', entityId: userId, details: { target_user_id: userId } });
      showFeedback('success', 'Usuário aprovado.');
      fetchPendingUsers();
    }
  };

  const handleRejectUser = async (userId: string) => {
    const { data: { user: me } } = await supabase.auth.getUser();
    if (!me?.id) return;
    setActingOnId(userId);
    const { error } = await supabase.from('profiles').update({ status: 'rejected', updated_at: new Date().toISOString() }).eq('id', userId);
    setActingOnId(null);
    if (error) showFeedback('error', 'Erro ao rejeitar.');
    else {
      await logAudit({ userId: me.id, action: 'reject_user', entityType: 'user_approval', entityId: userId, details: { target_user_id: userId } });
      showFeedback('success', 'Solicitação rejeitada.');
      fetchPendingUsers();
    }
  };

  // --- DATA FETCHING ---
  const fetchAllConfigs = async () => {
    setLoading(true);
    try {
      // 1. Duração
      const { data: docData } = await supabase.from('doctor_schedules').select('slot_duration').eq('doctor_id', 1).limit(1).maybeSingle();
      if (docData) setDuration(docData.slot_duration);

      // 2. Escala Padrão
      const { data: rulesData } = await supabase.from('doctor_schedules').select('*').eq('doctor_id', 1).order('day_of_week').order('start_time');
      setScheduleRules(rulesData || []);

      // 3. Exceções
      const { data: overData } = await supabase.from('schedule_overrides').select('*').eq('doctor_id', 1);
      setOverrides(overData || []);
    } catch (error) { 
        console.error(error); 
        showFeedback('error', 'Erro ao carregar configurações.');
    } finally { 
        setLoading(false); 
    }
  };

  const showFeedback = (type: 'success'|'error', msg: string) => {
    setFeedback({ type, message: msg });
    setTimeout(() => setFeedback(null), 3500);
  };

  // --- HANDLERS: GERAL ---
  const handleSaveDuration = async () => {
    setSaving(true);
    const { error } = await supabase.from('doctor_schedules').update({ slot_duration: duration }).eq('doctor_id', 1);
    if (!error) showFeedback('success', `Duração de ${duration}min atualizada!`);
    else showFeedback('error', 'Erro ao salvar duração.');
    setSaving(false);
  };

  // --- HANDLERS: ESCALA ---
  const handleAddSlot = async (dayOfWeek: number) => {
    if (!newSlotStart || !newSlotEnd) return;
    setSaving(true);
    
    if (newSlotStart >= newSlotEnd) {
        showFeedback('error', 'Hora final deve ser maior que inicial.');
        setSaving(false);
        return;
    }

    const { error } = await supabase.from('doctor_schedules').insert({
      doctor_id: 1,
      day_of_week: dayOfWeek,
      start_time: newSlotStart,
      end_time: newSlotEnd,
      slot_duration: duration
    });
    
    if (error) {
        showFeedback('error', 'Erro ao adicionar horário.');
    } else {
        await fetchAllConfigs();
        setEditingDay(null);
        showFeedback('success', 'Turno adicionado à escala.');
    }
    setSaving(false);
  };

  const handleDeleteSlotClick = (id: number) => {
    setConfirmDeleteSlotId(id);
  };

  const handleDeleteSlotConfirm = async () => {
    const id = confirmDeleteSlotId;
    if (id == null) return;
    setConfirmDeleteSlotId(null);
    await supabase.from('doctor_schedules').delete().eq('id', id);
    showFeedback('success', 'Horário removido.');
    fetchAllConfigs();
  };

  // --- HANDLERS: CALENDÁRIO ---
  const handleDayClick = (day: number) => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const dateObj = new Date(year, month, day);
    const dateStr = dateObj.toLocaleDateString('en-CA'); // YYYY-MM-DD

    setSelectedDate(dateStr);
    setOverrideReason('');
    
    const existing = overrides.find(o => o.override_date === dateStr);
    if (existing) {
       setOverrideType(existing.is_available ? 'open' : 'block');
       setOverrideReason(existing.reason || '');
    } else {
       // Sugestão Inteligente
       const dayOfWeek = dateObj.getDay(); 
       const isWorkDay = scheduleRules.some(r => r.day_of_week === dayOfWeek);
       setOverrideType(isWorkDay ? 'block' : 'open');
    }
    setModalOpen(true);
  };

  const handleSaveOverride = async () => {
    if (!selectedDate) return;
    setSaving(true);
    const isAvailable = overrideType === 'open';
    
    // Remove anterior se existir (Upsert manual)
    await supabase.from('schedule_overrides').delete().eq('doctor_id', 1).eq('override_date', selectedDate);
    
    const { error } = await supabase.from('schedule_overrides').insert({
      doctor_id: 1,
      override_date: selectedDate,
      reason: overrideReason,
      is_available: isAvailable,
      start_time: '00:00', end_time: '23:59'
    });

    if (error) showFeedback('error', 'Erro ao salvar exceção.');
    else {
      showFeedback('success', 'Agenda atualizada para o dia!');
      setModalOpen(false);
      fetchAllConfigs();
    }
    setSaving(false);
  };

  const handleDeleteOverrideClick = () => {
     if (!selectedDate) return;
     setConfirmRestoreDate(selectedDate);
  };

  const handleDeleteOverrideConfirm = async () => {
     const date = confirmRestoreDate;
     if (!date) return;
     setConfirmRestoreDate(null);
     await supabase.from('schedule_overrides').delete().eq('doctor_id', 1).eq('override_date', date);
     showFeedback('success', 'Dia restaurado ao padrão.');
     setModalOpen(false);
     fetchAllConfigs();
  };

  // --- HELPERS DE RENDERIZAÇÃO ---

  const TabButton = ({ id, label, icon: Icon }: any) => (
    <button 
        onClick={() => setActiveTab(id)} 
        className={`relative flex items-center gap-2 px-6 py-4 text-sm font-medium transition-all duration-300 ${
            activeTab === id 
            ? 'text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/20' 
            : 'text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-200 hover:bg-slate-50 dark:hover:bg-white/5'
        }`}
    >
        <Icon size={18} className={activeTab === id ? "text-blue-600 dark:text-blue-400" : "text-slate-400 dark:text-gray-500"} />
        {label}
        {activeTab === id && (
            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 dark:bg-blue-400 rounded-t-full"></span>
        )}
    </button>
  );

  const renderCalendarGrid = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay(); 
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const days = [];
    
    // Vazios (dias do mês anterior)
    for (let i = 0; i < firstDay; i++) {
        days.push(<div key={`empty-${i}`} className="h-[130px] bg-slate-50/30 dark:bg-[#1e2028] border-b border-r border-slate-100 dark:border-gray-800"></div>);
    }

    // Dias do mês atual
    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(year, month, d);
      const dateStr = dateObj.toLocaleDateString('en-CA');
      const dayOfWeek = dateObj.getDay();
      const isToday = new Date().toLocaleDateString('en-CA') === dateStr;
      
      const override = overrides.find(o => o.override_date === dateStr);
      const workRules = scheduleRules.filter(r => r.day_of_week === dayOfWeek);
      const isWorkDay = workRules.length > 0;

      // Definição de Estilo do Card
      let bgClass = 'bg-white dark:bg-[#202c33] hover:bg-slate-50 dark:hover:bg-[#2a2d36]';
      let content = null;

      // 1. PRIORIDADE: EXCEÇÕES (Feriados, Bloqueios ou Extras)
      if (override) {
         if (!override.is_available) {
             // Bloqueado
             bgClass = 'bg-red-50/40 dark:bg-red-900/10 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors ring-inset ring-1 ring-red-100 dark:ring-red-900/30';
             content = (
                <div className="mt-2 space-y-1 animate-in fade-in zoom-in-95">
                    <div className="px-2 py-1 rounded-md bg-white dark:bg-[#1e2028] border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 text-xs font-bold shadow-sm flex items-center gap-1.5 w-fit">
                        <Lock size={10} strokeWidth={3} /> Bloqueado
                    </div>
                    {override.reason && (
                        <p className="text-[10px] font-medium text-red-400 dark:text-red-300 pl-1 truncate" title={override.reason}>{override.reason}</p>
                    )}
                </div>
             );
         } else {
             // Extra (Atendimento em dia de folga)
             bgClass = 'bg-emerald-50/40 dark:bg-emerald-900/10 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors ring-inset ring-1 ring-emerald-100 dark:ring-emerald-900/30';
             content = (
                <div className="mt-2 space-y-1 animate-in fade-in zoom-in-95">
                    <div className="px-2 py-1 rounded-md bg-white dark:bg-[#1e2028] border border-emerald-100 dark:border-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold shadow-sm flex items-center gap-1.5 w-fit">
                        <Unlock size={10} strokeWidth={3} /> Extra
                    </div>
                    {override.reason && (
                        <p className="text-[10px] font-medium text-emerald-500 dark:text-emerald-300 pl-1 truncate" title={override.reason}>{override.reason}</p>
                    )}
                </div>
             );
         }
      } 
      // 2. DIA DE ATENDIMENTO PADRÃO
      else if (isWorkDay) {
         content = (
             <div className="mt-2 space-y-1">
                 {/* Substituído as bolinhas por um resumo textual limpo */}
                 {workRules.map((rule, idx) => (
                     <div key={idx} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-gray-300 bg-slate-50 dark:bg-[#1e2028] px-1.5 py-0.5 rounded border border-slate-100 dark:border-gray-700 w-fit">
                         <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                         <span className="font-medium">{rule.start_time.slice(0,5)} - {rule.end_time.slice(0,5)}</span>
                     </div>
                 ))}
             </div>
         );
      } 
      // 3. FOLGA PADRÃO
      else {
         bgClass = 'bg-slate-50/50 dark:bg-[#1e2028]/50 hover:bg-slate-100/50 dark:hover:bg-[#2a2d36]/50 text-slate-300 dark:text-gray-600';
         content = (
            <div className="mt-auto mb-2 flex justify-center opacity-30">
                <Coffee size={16} />
            </div>
         );
      }

      days.push(
        <div 
          key={d} 
          onClick={() => handleDayClick(d)}
          className={`h-[130px] p-3 border-b border-r border-slate-100 dark:border-gray-800 cursor-pointer relative group flex flex-col items-start transition-all ${bgClass}`}
        >
          <div className="flex justify-between w-full items-start mb-1">
              <span className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-bold transition-all ${isToday ? 'bg-blue-600 text-white shadow-md shadow-blue-200 dark:shadow-none scale-110' : 'text-slate-700 dark:text-gray-300'}`}>
                {d}
              </span>
          </div>
          
          <div className="w-full flex-1">
             {content}
          </div>
        </div>
      );
    }
    return days;
  };

  if (loading) return (
    <div className="h-full flex flex-col items-center justify-center bg-slate-50 dark:bg-[#0b141a]">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4"/>
        <p className="text-slate-500 dark:text-gray-400 font-medium">Sincronizando agenda...</p>
    </div>
  );

  return (
    <div className="flex-1 h-full bg-[#f8fafc] dark:bg-[#0b141a] overflow-y-auto custom-scrollbar transition-colors duration-300">
      <div className="max-w-7xl mx-auto p-6 lg:p-8">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
            <div>
                <h1 className="text-3xl font-bold text-slate-800 dark:text-gray-100 flex items-center gap-3">
                    <Settings className="w-8 h-8 text-blue-600" />
                    Configuração de Agenda
                </h1>
                <p className="text-slate-500 dark:text-gray-400 mt-1">Defina sua disponibilidade padrão e exceções.</p>
            </div>
            
            {/* Status Geral */}
            <div className="flex gap-4">
                <div className="bg-white dark:bg-[#1e2028] px-4 py-2 rounded-xl border border-slate-200 dark:border-gray-700 shadow-sm flex items-center gap-3 transition-colors">
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400"><Clock size={16}/></div>
                    <div>
                        <p className="text-[10px] text-slate-400 dark:text-gray-500 font-bold uppercase">Duração Slot</p>
                        <p className="text-sm font-bold text-slate-700 dark:text-gray-200">{duration} min</p>
                    </div>
                </div>
            </div>
        </div>

        {/* CONTAINER PRINCIPAL */}
        <div className="bg-white dark:bg-[#1e2028] rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-200 dark:border-gray-800 overflow-hidden flex flex-col min-h-[600px] transition-colors">
            
            {/* ABAS */}
            <div className="flex border-b border-slate-100 dark:border-gray-800 bg-white dark:bg-[#1e2028] px-4">
                <TabButton id="geral" label="Geral" icon={Settings} />
                <TabButton id="escala" label="Escala Semanal" icon={LayoutGrid} />
                <TabButton id="calendario" label="Calendário Mensal" icon={CalendarIcon} />
                {isAdmin && <TabButton id="usuarios" label="Usuários pendentes" icon={Users} />}
            </div>

            {/* CONTEÚDO */}
            <div className="p-0 bg-slate-50/50 dark:bg-[#0b141a]/50 flex-1">
                
                {/* 1. ABA GERAL */}
                {activeTab === 'geral' && (
                    <div className="max-w-2xl mx-auto py-12 px-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="bg-white dark:bg-[#202c33] p-8 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-sm transition-colors">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-gray-100 mb-2 flex items-center gap-2">
                                <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400"/> Tempo de Consulta
                            </h3>
                            <p className="text-slate-500 dark:text-gray-400 text-sm mb-8 leading-relaxed">
                                Defina a duração padrão dos seus atendimentos. A IA usará este valor para calcular slots livres.
                            </p>

                            <div className="flex gap-4 items-center">
                                <select 
                                    value={duration} 
                                    onChange={(e) => setDuration(Number(e.target.value))} 
                                    className="flex-1 bg-slate-50 dark:bg-[#1e2028] border border-slate-300 dark:border-gray-600 text-slate-900 dark:text-gray-100 text-sm rounded-xl focus:ring-blue-500 focus:border-blue-500 block p-4 font-medium transition-shadow outline-none"
                                >
                                    <option value={15}>15 minutos (Rápido)</option>
                                    <option value={30}>30 minutos (Padrão)</option>
                                    <option value={45}>45 minutos</option>
                                    <option value={60}>1 hora (Completo)</option>
                                    <option value={90}>1 hora e 30 min</option>
                                </select>
                                <button 
                                    onClick={handleSaveDuration} 
                                    disabled={saving}
                                    className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-blue-200 dark:shadow-none active:scale-95 flex items-center gap-2"
                                >
                                    {saving ? <Loader2 className="animate-spin w-4 h-4"/> : <Save className="w-4 h-4"/>}
                                    Salvar
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. ABA ESCALA SEMANAL */}
                {activeTab === 'escala' && (
                    <div className="p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {[1,2,3,4,5,6].map(day => {
                                const dayRules = scheduleRules.filter(r => r.day_of_week === day);
                                const isEditing = editingDay === day;
                                const hasRules = dayRules.length > 0;

                                return (
                                    <div key={day} className={`group rounded-2xl border transition-all duration-300 flex flex-col overflow-hidden ${hasRules ? 'bg-white dark:bg-[#202c33] border-slate-200 dark:border-gray-700 shadow-sm hover:shadow-md' : 'bg-slate-50/50 dark:bg-[#1e2028]/50 border-slate-200 dark:border-gray-800 border-dashed opacity-80 hover:opacity-100'}`}>
                                        <div className={`px-5 py-4 border-b flex justify-between items-center ${hasRules ? 'bg-white dark:bg-[#202c33] border-slate-100 dark:border-gray-700' : 'bg-transparent border-slate-200 dark:border-gray-800'}`}>
                                            <span className={`font-bold flex items-center gap-2 ${hasRules ? 'text-slate-700 dark:text-gray-200' : 'text-slate-400 dark:text-gray-500'}`}>
                                                {hasRules ? <Briefcase size={16} className="text-blue-500"/> : <Coffee size={16}/>}
                                                {DAYS_MAP[day as keyof typeof DAYS_MAP]}
                                            </span>
                                            <button 
                                                onClick={() => setEditingDay(isEditing ? null : day)}
                                                className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${isEditing ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30'}`}
                                            >
                                                {isEditing ? <X size={16}/> : <Plus size={16}/>}
                                            </button>
                                        </div>
                                        
                                        <div className="p-4 flex-1 flex flex-col gap-3 relative">
                                            {/* Form de Adicionar */}
                                            {isEditing && (
                                                <div className="absolute inset-0 z-10 bg-white/95 dark:bg-[#202c33]/95 backdrop-blur-sm p-4 animate-in fade-in flex flex-col justify-center">
                                                    <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase mb-3 text-center">Novo Turno</p>
                                                    <div className="flex items-center gap-2 mb-4">
                                                        <input type="time" value={newSlotStart} onChange={e => setNewSlotStart(e.target.value)} className="w-full text-sm border-2 border-slate-200 dark:border-gray-600 rounded-lg p-2 focus:border-blue-500 bg-white dark:bg-[#1e2028] text-slate-700 dark:text-gray-200 outline-none text-center font-bold"/>
                                                        <span className="text-slate-400">-</span>
                                                        <input type="time" value={newSlotEnd} onChange={e => setNewSlotEnd(e.target.value)} className="w-full text-sm border-2 border-slate-200 dark:border-gray-600 rounded-lg p-2 focus:border-blue-500 bg-white dark:bg-[#1e2028] text-slate-700 dark:text-gray-200 outline-none text-center font-bold"/>
                                                    </div>
                                                    <button 
                                                        onClick={() => handleAddSlot(day)} 
                                                        disabled={saving}
                                                        className="w-full bg-blue-600 text-white text-xs py-3 rounded-xl font-bold hover:bg-blue-700 shadow-md transition-all"
                                                    >
                                                        Confirmar
                                                    </button>
                                                </div>
                                            )}

                                            {/* Lista */}
                                            {!hasRules && !isEditing ? (
                                                <div className="flex-1 flex flex-col items-center justify-center py-8 text-slate-300 dark:text-gray-600">
                                                    <span className="text-sm font-medium">Dia Livre</span>
                                                </div>
                                            ) : (
                                                dayRules.map(rule => (
                                                    <div key={rule.id} className="flex items-center justify-between bg-slate-50 dark:bg-[#1e2028] border border-slate-100 dark:border-gray-700 rounded-xl p-3 group/item hover:border-blue-200 dark:hover:border-blue-800 transition-colors">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-1.5 h-8 bg-blue-400 rounded-full"></div>
                                                            <div>
                                                                <span className="block text-sm font-bold text-slate-700 dark:text-gray-200">{rule.start_time.slice(0,5)} - {rule.end_time.slice(0,5)}</span>
                                                                <span className="text-[10px] text-slate-400 dark:text-gray-500 font-medium uppercase">Turno Padrão</span>
                                                            </div>
                                                        </div>
                                                        <button 
                                                            onClick={() => handleDeleteSlotClick(rule.id)} 
                                                            className="text-slate-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 p-2 opacity-0 group-hover/item:opacity-100 transition-opacity"
                                                        >
                                                            <Trash2 size={16}/>
                                                        </button>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* 4. ABA USUÁRIOS PENDENTES (só admin) */}
                {activeTab === 'usuarios' && isAdmin && (
                    <div className="p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                            <Users className="w-5 h-5 text-pink-600 dark:text-pink-400" /> Solicitações de acesso
                        </h3>
                        <p className="text-slate-500 dark:text-gray-400 text-sm mb-6">Aprove ou rejeite novos cadastros.</p>
                        {loadingUsers ? (
                            <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-pink-500" /></div>
                        ) : pendingUsers.length === 0 ? (
                            <div className="rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50/50 dark:bg-[#1e2028]/50 p-8 text-center text-slate-500 dark:text-gray-400">
                                Nenhuma solicitação pendente.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {pendingUsers.map((u) => (
                                    <div key={u.id} className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-[#202c33] p-4">
                                        <div>
                                            <p className="font-medium text-slate-800 dark:text-gray-100">{u.full_name || '—'}</p>
                                            <p className="text-sm text-slate-500 dark:text-gray-400">{u.email}</p>
                                            <p className="text-xs text-slate-400 dark:text-gray-500 mt-1">{new Date(u.created_at).toLocaleString('pt-BR')}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleApproveUser(u.id)}
                                                disabled={actingOnId === u.id}
                                                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-50"
                                            >
                                                {actingOnId === u.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                                Aprovar
                                            </button>
                                            <button
                                                onClick={() => handleRejectUser(u.id)}
                                                disabled={actingOnId === u.id}
                                                className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-medium disabled:opacity-50"
                                            >
                                                {actingOnId === u.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                                                Rejeitar
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* 3. ABA CALENDÁRIO */}
                {activeTab === 'calendario' && (
                    <div className="p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Controles do Mês */}
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-4">
                                <div className="flex bg-white dark:bg-[#202c33] rounded-xl border border-slate-200 dark:border-gray-700 p-1 shadow-sm transition-colors">
                                    <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))} className="p-2 hover:bg-slate-50 dark:hover:bg-white/10 rounded-lg text-slate-500 dark:text-gray-400"><ChevronLeft size={20}/></button>
                                    <div className="px-6 flex items-center justify-center min-w-[160px]">
                                        <span className="text-sm font-bold text-slate-800 dark:text-gray-200 capitalize">{MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}</span>
                                    </div>
                                    <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))} className="p-2 hover:bg-slate-50 dark:hover:bg-white/10 rounded-lg text-slate-500 dark:text-gray-400"><ChevronRight size={20}/></button>
                                </div>
                            </div>
                            
                            {/* Legenda */}
                            <div className="flex gap-4">
                                <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-gray-400">
                                    <div className="w-3 h-3 rounded bg-red-100 dark:bg-red-900 border border-red-200 dark:border-red-800"></div> Bloqueado
                                </div>
                                <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-gray-400">
                                    <div className="w-3 h-3 rounded bg-emerald-100 dark:bg-emerald-900 border border-emerald-200 dark:border-emerald-800"></div> Extra
                                </div>
                                <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-gray-400">
                                    <div className="w-3 h-3 rounded bg-blue-500"></div> Turno Padrão
                                </div>
                            </div>
                        </div>

                        {/* Grid */}
                        <div className="bg-white dark:bg-[#202c33] border border-slate-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm transition-colors">
                            <div className="grid grid-cols-7 border-b border-slate-200 dark:border-gray-800 bg-slate-50 dark:bg-[#1e2028]">
                                {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'].map(d => (
                                    <div key={d} className="py-3 text-center text-[11px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest">
                                        {d}
                                    </div>
                                ))}
                            </div>
                            <div className="grid grid-cols-7 divide-x divide-slate-100 dark:divide-gray-800">
                                {renderCalendarGrid()}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>

        {/* MODAL EDIÇÃO */}
        {modalOpen && (
          <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
             <div className="bg-white dark:bg-[#202c33] rounded-2xl shadow-2xl w-full max-w-md animate-in zoom-in-95 overflow-hidden ring-1 ring-slate-900/5 dark:ring-white/10 transition-colors">
                <div className="px-6 py-5 border-b border-slate-100 dark:border-gray-700 bg-slate-50/50 dark:bg-[#1e2028] flex justify-between items-center">
                   <div>
                       <h3 className="font-bold text-slate-800 dark:text-gray-100 text-lg">Gerenciar Dia</h3>
                       <p className="text-slate-500 dark:text-gray-400 text-xs font-medium mt-0.5 capitalize">{new Date(selectedDate || '').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                   </div>
                   <button onClick={() => setModalOpen(false)} className="p-2 bg-white dark:bg-[#2a2d36] rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-gray-200 border border-slate-200 dark:border-gray-600 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"><X size={18}/></button>
                </div>
                
                <div className="p-6 space-y-6">
                   <div className="grid grid-cols-2 gap-4">
                      <button 
                        onClick={() => setOverrideType('block')}
                        className={`relative p-4 rounded-xl border-2 flex flex-col items-center gap-3 transition-all ${overrideType === 'block' ? 'bg-red-50 dark:bg-red-900/20 border-red-500 text-red-700 dark:text-red-400' : 'bg-white dark:bg-[#1e2028] border-slate-100 dark:border-gray-700 text-slate-400 dark:text-gray-500 hover:border-red-200 dark:hover:border-red-800 hover:text-red-500 dark:hover:text-red-400'}`}
                      >
                         <div className={`p-3 rounded-full ${overrideType === 'block' ? 'bg-red-200 dark:bg-red-800' : 'bg-slate-100 dark:bg-gray-800'}`}>
                             <Lock size={20} />
                         </div>
                         <span className="font-bold text-sm">Bloquear Agenda</span>
                         {overrideType === 'block' && <div className="absolute top-3 right-3 w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>}
                      </button>

                      <button 
                        onClick={() => setOverrideType('open')}
                        className={`relative p-4 rounded-xl border-2 flex flex-col items-center gap-3 transition-all ${overrideType === 'open' ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-500 text-emerald-700 dark:text-emerald-400' : 'bg-white dark:bg-[#1e2028] border-slate-100 dark:border-gray-700 text-slate-400 dark:text-gray-500 hover:border-emerald-200 dark:hover:border-emerald-800 hover:text-emerald-500 dark:hover:text-emerald-400'}`}
                      >
                         <div className={`p-3 rounded-full ${overrideType === 'open' ? 'bg-emerald-200 dark:bg-emerald-800' : 'bg-slate-100 dark:bg-gray-800'}`}>
                             <Unlock size={20} />
                         </div>
                         <span className="font-bold text-sm">Liberar Extra</span>
                         {overrideType === 'open' && <div className="absolute top-3 right-3 w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>}
                      </button>
                   </div>

                   <div>
                      <label className="text-xs font-bold text-slate-500 dark:text-gray-400 uppercase mb-2 block">Motivo (Obrigatório)</label>
                      <input 
                        type="text" 
                        value={overrideReason} 
                        onChange={(e) => setOverrideReason(e.target.value)}
                        placeholder={overrideType === 'block' ? "Ex: Feriado, Médico, Congresso..." : "Ex: Plantão Sábado, Reposição..."}
                        className="w-full border border-slate-200 dark:border-gray-600 bg-white dark:bg-[#1e2028] text-slate-700 dark:text-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium placeholder:font-normal placeholder:text-slate-400 dark:placeholder:text-gray-600 transition-colors"
                      />
                   </div>

                   <div className="pt-2 flex gap-3">
                      {overrides.some(o => o.override_date === selectedDate) && (
                          <button onClick={handleDeleteOverrideClick} className="flex-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 border border-transparent hover:border-red-100 dark:hover:border-red-900/30 py-3 rounded-xl text-sm font-bold transition-all">
                              Restaurar Padrão
                          </button>
                      )}
                      <button onClick={handleSaveOverride} className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl text-sm font-bold shadow-lg shadow-blue-200 dark:shadow-none transition-all active:scale-95">
                          Confirmar Alteração
                      </button>
                   </div>
                </div>
             </div>
          </div>
        )}

        {/* FEEDBACK TOAST */}
        {feedback && (
          <div className={`fixed bottom-8 right-8 px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 text-white z-[110] animate-in slide-in-from-right-10 ${feedback.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
            {feedback.type === 'success' ? <CheckCircle2 size={24}/> : <AlertTriangle size={24}/>}
            <div>
                <p className="font-bold text-sm">{feedback.type === 'success' ? 'Sucesso' : 'Atenção'}</p>
                <p className="text-xs opacity-90">{feedback.message}</p>
            </div>
          </div>
        )}

      </div>
    </div>
    <ConfirmModal
      isOpen={confirmDeleteSlotId != null}
      onClose={() => setConfirmDeleteSlotId(null)}
      onConfirm={handleDeleteSlotConfirm}
      title="Remover horário"
      message="Tem certeza que deseja remover este horário fixo?"
      type="danger"
      confirmText="Sim, remover"
    />
    <ConfirmModal
      isOpen={confirmRestoreDate != null}
      onClose={() => setConfirmRestoreDate(null)}
      onConfirm={handleDeleteOverrideConfirm}
      title="Restaurar dia"
      message="Restaurar configuração padrão deste dia?"
      type="warning"
      confirmText="Sim, restaurar"
    />
  );
}