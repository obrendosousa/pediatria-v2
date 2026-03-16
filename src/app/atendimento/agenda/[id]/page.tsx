'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createSchemaClient } from '@/lib/supabase/schemaClient';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import StatusStepper, { type StepperStep } from '@/components/ui/StatusStepper';
import ConfirmModal from '@/components/ui/ConfirmModal';
import {
  ArrowLeft, Calendar, Clock, Stethoscope, FileText, User, Phone,
  MoreVertical, MessageCircle, Receipt, Copy, Edit2, XCircle, X,
  SlidersHorizontal, ChevronDown, ChevronUp, Video, Loader2
} from 'lucide-react';

const supabase = createSchemaClient('atendimento');

// ── Tipos ──────────────────────────────────────────────────
type AppointmentFull = {
  id: number;
  date: string;
  time: string | null;
  end_time: string | null;
  patient_id: number | null;
  doctor_id: number | null;
  type: string | null;
  status: string;
  notes: string | null;
  description: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  consultation_value: number | null;
  appointment_subtype: string | null;
  procedures: string[] | null;
  is_teleconsultation: boolean | null;
  is_squeeze: boolean | null;
  scheduled_by: string | null;
  confirmed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  patient_name?: string | null;
  patient_phone?: string | null;
  patient_sex?: string | null;
  patient_birth_date?: string | null;
  doctor_name?: string | null;
};

type StatusLogEntry = {
  id: number;
  old_status: string | null;
  new_status: string;
  changed_by: string | null;
  changed_at: string;
  notes: string | null;
};

// ── Constantes ─────────────────────────────────────────────
const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Agendado', confirmed: 'Confirmado', waiting: 'Sala de Espera',
  called: 'Chamado', in_service: 'Em Atendimento', waiting_payment: 'Aguardando Pagamento',
  finished: 'Atendido', late: 'Atrasado', no_show: 'Faltou', cancelled: 'Cancelado',
  unmarked: 'Desmarcado', not_attended: 'Nao Atendido', rescheduled: 'Reagendado', blocked: 'Bloqueio'
};

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
  confirmed: 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300',
  waiting: 'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300',
  in_service: 'bg-teal-100 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300',
  finished: 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300',
  cancelled: 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300',
  no_show: 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300',
  late: 'bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300'
};

// Steps do stepper principal
const STEPPER_STEPS: StepperStep[] = [
  { key: 'scheduled', label: 'Agendado', icon: Calendar },
  { key: 'confirmed', label: 'Confirmado', icon: FileText },
  { key: 'waiting', label: 'Sala de Espera', icon: Clock },
  { key: 'in_service', label: 'Em Atendimento', icon: Stethoscope },
  { key: 'finished', label: 'Atendido', icon: FileText }
];

// ── Helpers ────────────────────────────────────────────────
function formatDate(iso: string): string {
  if (!iso) return '--';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function formatTime(time: string | null): string {
  if (!time) return '--:--';
  return time.substring(0, 5);
}

function formatDateTime(dt: string | null): string {
  if (!dt) return '--';
  const d = new Date(dt);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ── Componente principal ───────────────────────────────────
export default function AppointmentViewPage() {
  const params = useParams();
  const router = useRouter();
  const { profile } = useAuth();
  const { toast } = useToast();
  const appointmentId = Number(params.id);

  const [appointment, setAppointment] = useState<AppointmentFull | null>(null);
  const [statusLog, setStatusLog] = useState<StatusLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [newStatus, setNewStatus] = useState('');

  const fetchData = useCallback(async () => {
    if (!appointmentId) return;

    const [appRes, logRes] = await Promise.all([
      supabase
        .from('appointments')
        .select('*, patients:patient_id(full_name, phone, sex, birth_date)')
        .eq('id', appointmentId)
        .single(),
      supabase
        .from('appointment_status_log')
        .select('*')
        .eq('appointment_id', appointmentId)
        .order('changed_at', { ascending: false })
    ]);

    if (appRes.data) {
      const row = appRes.data as Record<string, unknown>;
      const patient = row.patients as { full_name?: string; phone?: string; sex?: string; birth_date?: string } | null;

      // Buscar nome do médico em public.doctors
      let doctorName: string | null = null;
      if (row.doctor_id) {
        const { data: doc } = await supabase.from('doctors').select('name').eq('id', row.doctor_id).single();
        if (doc) doctorName = doc.name;
      }

      setAppointment({
        ...row,
        patient_name: patient?.full_name || null,
        patient_phone: patient?.phone || null,
        patient_sex: patient?.sex || null,
        patient_birth_date: patient?.birth_date || null,
        doctor_name: doctorName,
      } as AppointmentFull);
    }

    if (logRes.data) setStatusLog(logRes.data);
    setLoading(false);
  }, [appointmentId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await fetchData();
      if (cancelled) return;
    })();
    return () => { cancelled = true; };
  }, [fetchData]);

  // Mapear timestamps do log para os steps do stepper
  const stepperSteps: StepperStep[] = STEPPER_STEPS.map(step => {
    const logEntry = statusLog.find(l => l.new_status === step.key);
    return {
      ...step,
      timestamp: logEntry ? formatDateTime(logEntry.changed_at) : null
    };
  });

  // ── Ações ──────────────────────────────────────────────
  const handleCancelAppointment = async () => {
    if (!appointment) return;
    setCancelling(true);
    try {
      const { error } = await supabase.from('appointments').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('id', appointment.id);
      if (error) throw error;

      await supabase.from('appointment_status_log').insert({
        appointment_id: appointment.id,
        old_status: appointment.status,
        new_status: 'cancelled',
        changed_by: profile?.full_name || 'Sistema',
        notes: 'Cancelamento manual'
      });

      toast.success('Agendamento cancelado.');
      setConfirmCancel(false);
      await fetchData();
    } catch (err: unknown) {
      toast.error('Erro ao cancelar: ' + (err instanceof Error ? err.message : 'Tente novamente.'));
    } finally {
      setCancelling(false);
    }
  };

  const handleChangeStatus = async () => {
    if (!appointment || !newStatus) return;
    try {
      const updateData: Record<string, unknown> = { status: newStatus };
      if (newStatus === 'confirmed') updateData.confirmed_at = new Date().toISOString();
      if (newStatus === 'cancelled') updateData.cancelled_at = new Date().toISOString();

      const { error } = await supabase.from('appointments').update(updateData).eq('id', appointment.id);
      if (error) throw error;

      await supabase.from('appointment_status_log').insert({
        appointment_id: appointment.id,
        old_status: appointment.status,
        new_status: newStatus,
        changed_by: profile?.full_name || 'Sistema'
      });

      toast.success(`Status alterado para ${STATUS_LABELS[newStatus] || newStatus}.`);
      setStatusModalOpen(false);
      setNewStatus('');
      await fetchData();
    } catch (err: unknown) {
      toast.error('Erro: ' + (err instanceof Error ? err.message : 'Tente novamente.'));
    }
  };

  const handleClone = async () => {
    if (!appointment) return;
    try {
      const cloneData: Record<string, unknown> = {
        patient_id: appointment.patient_id, doctor_id: appointment.doctor_id, date: appointment.date,
        time: appointment.time, end_time: appointment.end_time, type: appointment.type, status: 'scheduled',
        notes: appointment.notes, description: appointment.description, appointment_subtype: appointment.appointment_subtype,
        procedures: appointment.procedures, is_teleconsultation: appointment.is_teleconsultation,
        is_squeeze: appointment.is_squeeze, consultation_value: appointment.consultation_value,
        parent_name: appointment.parent_name, parent_phone: appointment.parent_phone,
        scheduled_by: profile?.full_name || 'Sistema'
      };
      const { data, error } = await supabase.from('appointments').insert(cloneData).select('id').single();
      if (error) throw error;
      toast.success('Agendamento clonado!');
      if (data) router.push(`/atendimento/agenda/${data.id}`);
    } catch (err: unknown) {
      toast.error('Erro ao clonar: ' + (err instanceof Error ? err.message : ''));
    }
    setMenuOpen(false);
  };

  // ── Loading / Not found ────────────────────────────────
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-teal-500 animate-spin"/>
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4">
        <p className="text-slate-500 dark:text-[#a1a1aa]">Agendamento nao encontrado.</p>
        <button onClick={() => router.push('/atendimento/agenda')} className="text-teal-600 hover:underline text-sm font-semibold">Voltar para agenda</button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#f8fafc] dark:bg-[#0b141a] transition-colors">
      {/* ── Header ── */}
      <div className="px-6 py-4 bg-white dark:bg-[#0a0a0c] border-b border-slate-100 dark:border-[#27272a] shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/atendimento/agenda')} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors">
            <ArrowLeft size={20} className="text-slate-500 dark:text-[#a1a1aa]"/>
          </button>
          <div>
            <h1 className="text-lg font-bold text-slate-800 dark:text-[#fafafa]">
              {appointment.patient_name || 'Paciente'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-[#a1a1aa]">
              Agendamento #{appointment.id} · {formatDate(appointment.date)} as {formatTime(appointment.time)}
            </p>
          </div>
          <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-md ${STATUS_COLORS[appointment.status] || 'bg-slate-100 text-slate-600'}`}>
            {STATUS_LABELS[appointment.status] || appointment.status}
          </span>
          {appointment.is_teleconsultation && (
            <span className="text-[10px] font-semibold bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-md flex items-center gap-1">
              <Video size={10}/> Teleconsulta
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* WhatsApp */}
          {(appointment.patient_phone || appointment.parent_phone) && (
            <a
              href={`https://wa.me/55${(appointment.patient_phone || appointment.parent_phone || '').replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors shadow-sm"
              title="Abrir WhatsApp"
            >
              <MessageCircle size={18}/>
            </a>
          )}

          {/* Gerar Orcamento */}
          <button className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm transition-colors">
            <Receipt size={15}/> Gerar Orcamento
          </button>

          {/* Menu 3 pontos */}
          <div className="relative">
            <button onClick={() => setMenuOpen(!menuOpen)} className="p-2.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors">
              <MoreVertical size={18} className="text-slate-500 dark:text-[#a1a1aa]"/>
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)}/>
                <div className="absolute right-0 top-full mt-1 w-52 bg-white dark:bg-[#0a0a0c] border border-slate-200 dark:border-[#2e2e33] rounded-lg shadow-xl z-50 py-1">
                  <button onClick={handleClone} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-white/5 flex items-center gap-2.5 transition-colors">
                    <Copy size={15} className="text-slate-400"/> Clonar agendamento
                  </button>
                  <button onClick={() => { setMenuOpen(false); router.push(`/atendimento/agenda`); }} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-white/5 flex items-center gap-2.5 transition-colors">
                    <Edit2 size={15} className="text-slate-400"/> Editar informacoes
                  </button>
                  <button onClick={() => { setMenuOpen(false); setConfirmCancel(true); }} className="w-full text-left px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 flex items-center gap-2.5 transition-colors">
                    <XCircle size={15}/> Cancelar agendamento
                  </button>
                  <div className="border-t border-slate-100 dark:border-[#2e2e33] my-1"/>
                  <button onClick={() => { setMenuOpen(false); setStatusModalOpen(true); }} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-white/5 flex items-center gap-2.5 transition-colors">
                    <SlidersHorizontal size={15} className="text-slate-400"/> Ajustar status
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Conteudo ── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
        {/* Stepper de status */}
        <div className="bg-white dark:bg-[#0a0a0c] rounded-2xl border border-slate-100 dark:border-[#27272a] shadow-sm p-6">
          <StatusStepper steps={stepperSteps} currentStepKey={appointment.status} accentColor="teal"/>
        </div>

        {/* Cards de detalhes */}
        <div className="grid grid-cols-2 gap-4">
          {/* Procedimentos */}
          <div className="bg-white dark:bg-[#0a0a0c] rounded-xl border border-slate-100 dark:border-[#27272a] shadow-sm p-5 col-span-2">
            <h3 className="text-xs font-bold text-slate-400 dark:text-[#71717a] uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <FileText size={14} className="text-teal-500"/> Procedimento(s)
            </h3>
            {appointment.procedures && appointment.procedures.length > 0 ? (
              <div className="space-y-2">
                {appointment.procedures.map((proc, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-[#18181b] rounded-lg border border-slate-100 dark:border-[#2e2e33]">
                    <span className="text-sm text-slate-700 dark:text-gray-200">{proc}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 dark:text-[#71717a] italic">Nenhum procedimento registrado</p>
            )}
          </div>

          {/* Data e Hora */}
          <div className="bg-white dark:bg-[#0a0a0c] rounded-xl border border-slate-100 dark:border-[#27272a] shadow-sm p-5">
            <h3 className="text-xs font-bold text-slate-400 dark:text-[#71717a] uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Calendar size={14} className="text-teal-500"/> Data e Horario
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500 dark:text-[#a1a1aa]">Data</span>
                <span className="text-sm font-semibold text-slate-800 dark:text-[#fafafa]">{formatDate(appointment.date)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500 dark:text-[#a1a1aa]">Hora Inicial</span>
                <span className="text-sm font-semibold text-slate-800 dark:text-[#fafafa]">{formatTime(appointment.time)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500 dark:text-[#a1a1aa]">Hora Final</span>
                <span className="text-sm font-semibold text-slate-800 dark:text-[#fafafa]">{formatTime(appointment.end_time)}</span>
              </div>
              {appointment.appointment_subtype && (
                <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-[#2e2e33]">
                  <span className="text-xs text-slate-500 dark:text-[#a1a1aa]">Tipo</span>
                  <span className="text-xs font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-[#d4d4d8] px-2 py-0.5 rounded">
                    {appointment.appointment_subtype === 'orcamento' ? 'Orcamento' : 'Simples'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Profissional */}
          <div className="bg-white dark:bg-[#0a0a0c] rounded-xl border border-slate-100 dark:border-[#27272a] shadow-sm p-5">
            <h3 className="text-xs font-bold text-slate-400 dark:text-[#71717a] uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Stethoscope size={14} className="text-teal-500"/> Profissional
            </h3>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-teal-100 dark:bg-teal-900/20 flex items-center justify-center text-teal-600 dark:text-teal-400 font-bold">
                {appointment.doctor_name?.charAt(0) || 'P'}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-[#fafafa]">{appointment.doctor_name || 'Nao informado'}</p>
                <p className="text-xs text-slate-400 dark:text-[#71717a]">Profissional responsavel</p>
              </div>
            </div>
          </div>

          {/* Paciente */}
          <div className="bg-white dark:bg-[#0a0a0c] rounded-xl border border-slate-100 dark:border-[#27272a] shadow-sm p-5">
            <h3 className="text-xs font-bold text-slate-400 dark:text-[#71717a] uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <User size={14} className="text-teal-500"/> Paciente
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500 dark:text-[#a1a1aa]">Nome</span>
                <span className="text-sm font-semibold text-slate-800 dark:text-[#fafafa]">{appointment.patient_name || 'Nao informado'}</span>
              </div>
              {(appointment.patient_phone || appointment.parent_phone) && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500 dark:text-[#a1a1aa]">Telefone</span>
                  <span className="text-sm text-slate-700 dark:text-gray-200 flex items-center gap-1">
                    <Phone size={12} className="text-slate-400"/>
                    {(appointment.patient_phone || appointment.parent_phone || '').replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')}
                  </span>
                </div>
              )}
              {appointment.parent_name && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500 dark:text-[#a1a1aa]">Responsavel</span>
                  <span className="text-sm text-slate-700 dark:text-gray-200">{appointment.parent_name}</span>
                </div>
              )}
            </div>
          </div>

          {/* Descricao + Info do agendamento */}
          <div className="bg-white dark:bg-[#0a0a0c] rounded-xl border border-slate-100 dark:border-[#27272a] shadow-sm p-5">
            <h3 className="text-xs font-bold text-slate-400 dark:text-[#71717a] uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <FileText size={14} className="text-teal-500"/> Informacoes
            </h3>
            <div className="space-y-3">
              <div>
                <span className="text-xs text-slate-500 dark:text-[#a1a1aa] block mb-1">Descricao</span>
                <p className="text-sm text-slate-700 dark:text-gray-200 bg-slate-50 dark:bg-[#18181b] p-3 rounded-lg border border-slate-100 dark:border-[#2e2e33] min-h-[60px]">
                  {appointment.description || appointment.notes || <span className="text-slate-400 italic">Sem descricao</span>}
                </p>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-[#2e2e33]">
                <span className="text-xs text-slate-500 dark:text-[#a1a1aa]">Responsavel pelo agendamento</span>
                <span className="text-xs font-medium text-slate-700 dark:text-gray-200">{appointment.scheduled_by || 'Sistema'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500 dark:text-[#a1a1aa]">Data de agendamento</span>
                <span className="text-xs font-medium text-slate-700 dark:text-gray-200">{formatDateTime(appointment.created_at)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Secao colapsavel: Alteracoes de status ── */}
        <div className="bg-white dark:bg-[#0a0a0c] rounded-xl border border-slate-100 dark:border-[#27272a] shadow-sm overflow-hidden">
          <button
            onClick={() => setLogOpen(!logOpen)}
            className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
          >
            <span className="text-sm font-bold text-slate-700 dark:text-gray-200 flex items-center gap-2">
              <SlidersHorizontal size={16} className="text-teal-500"/>
              Alteracoes de Status
              <span className="text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-[#a1a1aa] px-2 py-0.5 rounded-full">
                {statusLog.length}
              </span>
            </span>
            {logOpen ? <ChevronUp size={18} className="text-slate-400"/> : <ChevronDown size={18} className="text-slate-400"/>}
          </button>

          {logOpen && (
            <div className="border-t border-slate-100 dark:border-[#27272a]">
              {statusLog.length === 0 ? (
                <p className="p-5 text-sm text-slate-400 dark:text-[#71717a] text-center italic">Nenhuma alteracao registrada.</p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-gray-800">
                  {statusLog.map(entry => (
                    <div key={entry.id} className="px-5 py-3 flex items-center gap-4">
                      <div className="w-2 h-2 rounded-full bg-teal-400 shrink-0"/>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {entry.old_status && (
                            <>
                              <span className="text-xs font-medium text-slate-500 dark:text-[#a1a1aa]">
                                {STATUS_LABELS[entry.old_status] || entry.old_status}
                              </span>
                              <span className="text-xs text-slate-300 dark:text-gray-600">→</span>
                            </>
                          )}
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${STATUS_COLORS[entry.new_status] || 'bg-slate-100 text-slate-600'}`}>
                            {STATUS_LABELS[entry.new_status] || entry.new_status}
                          </span>
                          {entry.notes && (
                            <span className="text-[10px] text-slate-400 dark:text-[#71717a] italic truncate">— {entry.notes}</span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 dark:text-[#71717a] mt-0.5">
                          {formatDateTime(entry.changed_at)} · {entry.changed_by || 'Sistema'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer botoes ── */}
        <div className="flex justify-end gap-3 pb-4">
          <button
            onClick={() => setConfirmCancel(true)}
            disabled={appointment.status === 'cancelled'}
            className="px-5 py-2.5 border-2 border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded-lg text-sm font-bold hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors disabled:opacity-40 flex items-center gap-2"
          >
            <XCircle size={16}/> Cancelar Agendamento
          </button>
          <button
            onClick={() => router.push('/atendimento/agenda')}
            className="px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-bold shadow-sm transition-colors flex items-center gap-2"
          >
            <Edit2 size={16}/> Editar Informacoes
          </button>
        </div>
      </div>

      {/* ── Modals ── */}
      <ConfirmModal
        isOpen={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={handleCancelAppointment}
        title="Cancelar Agendamento"
        message={`Deseja cancelar o agendamento de ${appointment.patient_name || 'este paciente'} em ${formatDate(appointment.date)} as ${formatTime(appointment.time)}?`}
        type="danger"
        confirmText="Sim, cancelar"
        isLoading={cancelling}
      />

      {/* Modal de ajustar status */}
      {statusModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0a0a0c] rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-[#2e2e33] flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-800 dark:text-[#fafafa] flex items-center gap-2">
                <SlidersHorizontal size={16} className="text-teal-500"/> Ajustar Status
              </h3>
              <button onClick={() => setStatusModalOpen(false)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg">
                <X size={16} className="text-slate-400"/>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Novo Status</label>
                <select
                  value={newStatus}
                  onChange={e => setNewStatus(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 dark:border-[#2e2e33] rounded-lg bg-white dark:bg-[#18181b] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                >
                  <option value="">Selecione...</option>
                  {Object.entries(STATUS_LABELS).filter(([k]) => k !== appointment.status && k !== 'blocked').map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStatusModalOpen(false)} className="flex-1 px-4 py-2 border border-slate-300 dark:border-gray-600 text-slate-600 dark:text-[#d4d4d8] rounded-lg text-sm font-semibold hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                  Cancelar
                </button>
                <button onClick={handleChangeStatus} disabled={!newStatus} className="flex-1 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors disabled:opacity-40">
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
