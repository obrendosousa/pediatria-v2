'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { createSchemaClient } from '@/lib/supabase/schemaClient';
import { useToast } from '@/contexts/ToastContext';
import {
  X, Search, User, Calendar, Clock, Stethoscope, FileText, Video,
  Save, Loader2, ChevronDown, Plus, Check, ClipboardList, CalendarClock,
  Phone, History
} from 'lucide-react';

const supabaseAtendimento = createSchemaClient('atendimento');

// ── Tipos ──────────────────────────────────────────────────
type PatientOption = {
  id: number;
  full_name: string;
  phone: string | null;
  sex: string | null;
  birth_date: string | null;
};

type DoctorOption = { id: number; name: string };

type ProcedureOption = {
  id: number;
  code: string;
  name: string;
  category: string | null;
};

type AnamnesisTemplate = {
  id: number;
  title: string;
  category: string | null;
};

type FormData = {
  patient_id: number | null;
  doctor_id: number | null;
  date: string;
  dateDisplay: string;
  time_start: string;
  time_end: string;
  appointment_subtype: 'orcamento' | 'simples';
  procedures: ProcedureOption[];
  anamnesis_template_id: number | null;
  is_squeeze: boolean;
  is_teleconsultation: boolean;
  auto_confirm: boolean;
  generate_budget: boolean;
  description: string;
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialDate?: string;
  initialTime?: string;
}

// ── Helpers ────────────────────────────────────────────────
function calcAge(birthDate: string): string {
  const birth = new Date(birthDate + 'T00:00:00');
  const today = new Date();
  let years = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) years--;
  if (years < 1) {
    let months = (today.getFullYear() - birth.getFullYear()) * 12 + today.getMonth() - birth.getMonth();
    if (today.getDate() < birth.getDate()) months--;
    return `${Math.max(0, months)} mes${months !== 1 ? 'es' : ''}`;
  }
  return `${years} ano${years !== 1 ? 's' : ''}`;
}

function formatDateDisplay(iso: string): string {
  if (!iso || iso.length !== 10) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function parseDateDisplay(display: string): string {
  const nums = display.replace(/\D/g, '');
  if (nums.length !== 8) return '';
  return `${nums.slice(4, 8)}-${nums.slice(2, 4)}-${nums.slice(0, 2)}`;
}

function maskDate(value: string): string {
  const nums = value.replace(/\D/g, '').slice(0, 8);
  let out = nums.slice(0, 2);
  if (nums.length > 2) out += '/' + nums.slice(2, 4);
  if (nums.length > 4) out += '/' + nums.slice(4, 8);
  return out;
}

// ── Componente principal ───────────────────────────────────
export default function NewAppointmentModal({ isOpen, onClose, onSuccess, initialDate, initialTime }: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  // Listas auxiliares
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [anamnesisTemplates, setAnamnesisTemplates] = useState<AnamnesisTemplate[]>([]);

  // Busca de paciente
  const [patientSearch, setPatientSearch] = useState('');
  const [patientResults, setPatientResults] = useState<PatientOption[]>([]);
  const [patientLoading, setPatientLoading] = useState(false);
  const [patientDropdownOpen, setPatientDropdownOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<PatientOption | null>(null);
  const patientRef = useRef<HTMLDivElement>(null);

  // Busca de procedimentos
  const [procSearch, setProcSearch] = useState('');
  const [procResults, setProcResults] = useState<ProcedureOption[]>([]);
  const [procLoading, setProcLoading] = useState(false);
  const [procDropdownOpen, setProcDropdownOpen] = useState(false);
  const procRef = useRef<HTMLDivElement>(null);

  const { control, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      patient_id: null,
      doctor_id: null,
      date: '',
      dateDisplay: '',
      time_start: '',
      time_end: '',
      appointment_subtype: 'simples',
      procedures: [],
      anamnesis_template_id: null,
      is_squeeze: false,
      is_teleconsultation: false,
      auto_confirm: false,
      generate_budget: false,
      description: ''
    }
  });

  const watchedProcedures = watch('procedures');
  const watchedSubtype = watch('appointment_subtype');

  // ── Inicialização ao abrir ─────────────────────────────
  useEffect(() => {
    if (!isOpen) return;

    (async () => {
      const [doctorsRes, templatesRes] = await Promise.all([
        supabaseAtendimento.from('doctors').select('id, name').eq('active', true).order('name'),
        supabaseAtendimento.from('clinical_templates').select('id, title, category').eq('template_type', 'anamnese').order('title')
      ]);
      if (doctorsRes.data) setDoctors(doctorsRes.data);
      if (templatesRes.data) setAnamnesisTemplates(templatesRes.data);
    })();

    const today = new Date().toISOString().split('T')[0];
    const dateValue = initialDate || today;
    reset({
      patient_id: null,
      doctor_id: null,
      date: dateValue,
      dateDisplay: formatDateDisplay(dateValue),
      time_start: initialTime || '09:00',
      time_end: '',
      appointment_subtype: 'simples',
      procedures: [],
      anamnesis_template_id: null,
      is_squeeze: false,
      is_teleconsultation: false,
      auto_confirm: false,
      generate_budget: false,
      description: ''
    });
    setSelectedPatient(null);
    setPatientSearch('');
    setProcSearch('');
  }, [isOpen, initialDate, initialTime, reset]);

  // ── Busca de pacientes (debounce) ──────────────────────
  useEffect(() => {
    const trimmed = patientSearch.trim();
    if (!trimmed || trimmed.length < 2) {
      setPatientResults([]);
      return;
    }
    setPatientLoading(true);
    const t = setTimeout(async () => {
      const { data } = await supabaseAtendimento
        .from('patients')
        .select('id, full_name, phone, sex, birth_date')
        .or(`full_name.ilike.%${trimmed}%,phone.ilike.%${trimmed}%`)
        .order('full_name')
        .limit(15);
      setPatientResults(data || []);
      setPatientLoading(false);
      setPatientDropdownOpen(true);
    }, 300);
    return () => clearTimeout(t);
  }, [patientSearch]);

  // ── Busca de procedimentos TUSS (debounce) ─────────────
  useEffect(() => {
    const trimmed = procSearch.trim();
    if (!trimmed || trimmed.length < 2) {
      setProcResults([]);
      return;
    }
    setProcLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/tuss/search?q=${encodeURIComponent(trimmed)}&limit=15`);
        const data = await res.json();
        setProcResults(Array.isArray(data) ? data : []);
      } catch {
        setProcResults([]);
      }
      setProcLoading(false);
      setProcDropdownOpen(true);
    }, 300);
    return () => clearTimeout(t);
  }, [procSearch]);

  // ── Click outside para fechar dropdowns ────────────────
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (patientRef.current && !patientRef.current.contains(e.target as Node)) setPatientDropdownOpen(false);
      if (procRef.current && !procRef.current.contains(e.target as Node)) setProcDropdownOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Seleção de paciente ────────────────────────────────
  const handleSelectPatient = useCallback((p: PatientOption) => {
    setSelectedPatient(p);
    setValue('patient_id', p.id);
    setPatientSearch('');
    setPatientDropdownOpen(false);
  }, [setValue]);

  const handleClearPatient = useCallback(() => {
    setSelectedPatient(null);
    setValue('patient_id', null);
    setPatientSearch('');
  }, [setValue]);

  // ── Adicionar/remover procedimento ─────────────────────
  const addProcedure = useCallback((proc: ProcedureOption) => {
    const current = watchedProcedures || [];
    if (current.some(p => p.id === proc.id)) return;
    setValue('procedures', [...current, proc]);
    setProcSearch('');
    setProcDropdownOpen(false);
  }, [watchedProcedures, setValue]);

  const removeProcedure = useCallback((id: number) => {
    const current = watchedProcedures || [];
    setValue('procedures', current.filter(p => p.id !== id));
  }, [watchedProcedures, setValue]);

  // ── Submit ─────────────────────────────────────────────
  const onSubmit = async (data: FormData) => {
    if (!data.patient_id) { toast.error('Selecione um paciente.'); return; }
    if (!data.doctor_id) { toast.error('Selecione um profissional.'); return; }
    if (!data.date || data.date.length !== 10) { toast.error('Data invalida.'); return; }
    if (!data.time_start) { toast.error('Informe o horario inicial.'); return; }

    setSaving(true);
    try {
      const status = data.auto_confirm ? 'confirmed' : 'scheduled';
      const procedureNames = (data.procedures || []).map(p => `${p.code} - ${p.name}`);

      const insertData: Record<string, unknown> = {
        patient_id: data.patient_id,
        doctor_id: data.doctor_id,
        date: data.date,
        time: data.time_start,
        end_time: data.time_end || null,
        status,
        appointment_subtype: data.appointment_subtype,
        procedures: procedureNames.length > 0 ? procedureNames : null,
        send_anamnesis: data.anamnesis_template_id ? true : false,
        is_squeeze: data.is_squeeze,
        is_teleconsultation: data.is_teleconsultation,
        auto_confirm: data.auto_confirm,
        generate_budget: data.generate_budget,
        description: data.description.trim() || null,
        notes: data.description.trim() || null,
      };

      const { error } = await supabaseAtendimento.from('appointments').insert(insertData);
      if (error) throw error;

      toast.success('Agendamento criado com sucesso!');
      onSuccess();
      onClose();
    } catch (err: unknown) {
      console.error('Erro ao criar agendamento:', err);
      toast.error('Erro ao salvar: ' + (err instanceof Error ? err.message : 'Tente novamente.'));
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white dark:bg-[#1e2028] rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#2a2d36] flex justify-between items-center shrink-0">
          <h3 className="font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <Calendar className="text-teal-600 dark:text-teal-400" size={20}/>
            Novo Agendamento
          </h3>
          <button type="button" onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition-colors">
            <X size={20} className="text-gray-400 dark:text-gray-500"/>
          </button>
        </div>

        {/* Body: Form + Sidebar */}
        <div className="flex-1 overflow-hidden flex">
          {/* Formulário principal */}
          <form onSubmit={handleSubmit(onSubmit)} id="new-appointment-form" className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-5">

            {/* ── Paciente (busca) ── */}
            <div ref={patientRef} className="relative">
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Paciente *</label>
              {selectedPatient ? (
                <div className="flex items-center gap-3 p-3 bg-teal-50 dark:bg-teal-900/10 border border-teal-200 dark:border-teal-800/30 rounded-lg">
                  <div className="w-9 h-9 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center text-teal-600 dark:text-teal-400 font-bold text-sm">
                    {selectedPatient.full_name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 dark:text-gray-100 truncate">{selectedPatient.full_name}</p>
                    <p className="text-xs text-slate-500 dark:text-gray-400">
                      {[selectedPatient.phone, selectedPatient.birth_date ? calcAge(selectedPatient.birth_date) : null].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <button type="button" onClick={handleClearPatient} className="p-1.5 hover:bg-teal-100 dark:hover:bg-teal-800/30 rounded-md text-slate-400 hover:text-slate-600 transition-colors">
                    <X size={16}/>
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
                    <input
                      type="text"
                      value={patientSearch}
                      onChange={e => setPatientSearch(e.target.value)}
                      onFocus={() => patientSearch.trim().length >= 2 && setPatientDropdownOpen(true)}
                      placeholder="Buscar paciente por nome ou telefone..."
                      className="w-full pl-9 pr-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-[#2a2d36] text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all placeholder:text-slate-400"
                    />
                  </div>
                  {patientDropdownOpen && (
                    <div className="absolute z-50 mt-1 w-full max-h-56 overflow-y-auto bg-white dark:bg-[#1e2028] border border-slate-200 dark:border-gray-700 rounded-lg shadow-lg custom-scrollbar">
                      {patientLoading ? (
                        <div className="p-4 text-center text-sm text-slate-500 dark:text-gray-400">Buscando...</div>
                      ) : patientResults.length === 0 ? (
                        <div className="p-4 text-center text-sm text-slate-500 dark:text-gray-400">Nenhum paciente encontrado.</div>
                      ) : (
                        patientResults.map(p => (
                          <button key={p.id} type="button" onClick={() => handleSelectPatient(p)} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors border-b border-slate-100 dark:border-gray-800 last:border-0 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-[#2a2d36] flex items-center justify-center text-slate-500 dark:text-gray-400 shrink-0">
                              <User className="w-4 h-4"/>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm text-slate-800 dark:text-gray-200 truncate">{p.full_name}</p>
                              <p className="text-xs text-slate-500 dark:text-gray-400 truncate">{[p.phone, p.birth_date ? calcAge(p.birth_date) : null].filter(Boolean).join(' · ')}</p>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </>
              )}
              {errors.patient_id && <p className="text-xs text-red-500 mt-1">Selecione um paciente</p>}
            </div>

            {/* ── Profissional ── */}
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Profissional *</label>
              <Controller
                name="doctor_id"
                control={control}
                rules={{ required: true }}
                render={({ field }) => (
                  <div className="relative">
                    <Stethoscope className="w-4 h-4 text-gray-400 absolute left-3 top-3"/>
                    <select
                      value={field.value ?? ''}
                      onChange={e => field.onChange(e.target.value ? Number(e.target.value) : null)}
                      className="w-full pl-9 pr-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-[#2a2d36] text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all appearance-none"
                    >
                      <option value="">Selecione o profissional...</option>
                      {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                    <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-3 pointer-events-none"/>
                  </div>
                )}
              />
            </div>

            {/* ── Data + Hora Inicial + Hora Final ── */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Data *</label>
                <Controller
                  name="dateDisplay"
                  control={control}
                  rules={{ required: true }}
                  render={({ field }) => (
                    <div className="relative">
                      <Calendar className="w-4 h-4 text-gray-400 absolute left-3 top-3"/>
                      <input
                        type="text"
                        value={field.value}
                        onChange={e => {
                          const masked = maskDate(e.target.value);
                          field.onChange(masked);
                          const iso = parseDateDisplay(masked);
                          if (iso) setValue('date', iso);
                        }}
                        placeholder="DD/MM/AAAA"
                        maxLength={10}
                        className="w-full pl-9 pr-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-[#2a2d36] text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                      />
                    </div>
                  )}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Hora Inicial *</label>
                <Controller
                  name="time_start"
                  control={control}
                  rules={{ required: true }}
                  render={({ field }) => (
                    <div className="relative">
                      <Clock className="w-4 h-4 text-gray-400 absolute left-3 top-3"/>
                      <input type="time" {...field} className="w-full pl-9 pr-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-[#2a2d36] text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"/>
                    </div>
                  )}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Hora Final</label>
                <Controller
                  name="time_end"
                  control={control}
                  render={({ field }) => (
                    <div className="relative">
                      <Clock className="w-4 h-4 text-gray-400 absolute left-3 top-3"/>
                      <input type="time" {...field} className="w-full pl-9 pr-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-[#2a2d36] text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"/>
                    </div>
                  )}
                />
              </div>
            </div>

            {/* ── Tipo de Agendamento (Radio) ── */}
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Tipo de Agendamento</label>
              <Controller
                name="appointment_subtype"
                control={control}
                render={({ field }) => (
                  <div className="flex gap-3">
                    {[
                      { value: 'simples', label: 'Simples', icon: CalendarClock },
                      { value: 'orcamento', label: 'Orcamento', icon: ClipboardList }
                    ].map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => field.onChange(opt.value)}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border text-sm font-semibold transition-all ${
                          field.value === opt.value
                            ? 'bg-teal-50 dark:bg-teal-900/20 border-teal-300 dark:border-teal-700 text-teal-700 dark:text-teal-300 shadow-sm'
                            : 'border-gray-200 dark:border-gray-700 text-slate-500 dark:text-gray-400 hover:border-slate-300'
                        }`}
                      >
                        <opt.icon size={16}/>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              />
            </div>

            {/* ── Procedimentos (multi-select com busca) ── */}
            <div ref={procRef} className="relative">
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Procedimentos *</label>
              {/* Tags dos procedimentos selecionados */}
              {watchedProcedures && watchedProcedures.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {watchedProcedures.map(p => (
                    <span key={p.id} className="inline-flex items-center gap-1 text-xs font-medium bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800/30 px-2 py-1 rounded-md">
                      {p.code} - {p.name}
                      <button type="button" onClick={() => removeProcedure(p.id)} className="hover:text-red-500 transition-colors ml-0.5">
                        <X size={12}/>
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
                <input
                  type="text"
                  value={procSearch}
                  onChange={e => setProcSearch(e.target.value)}
                  onFocus={() => procSearch.trim().length >= 2 && setProcDropdownOpen(true)}
                  placeholder="Buscar procedimento por codigo ou nome..."
                  className="w-full pl-9 pr-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-[#2a2d36] text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all placeholder:text-slate-400"
                />
              </div>
              {procDropdownOpen && (
                <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto bg-white dark:bg-[#1e2028] border border-slate-200 dark:border-gray-700 rounded-lg shadow-lg custom-scrollbar">
                  {procLoading ? (
                    <div className="p-4 text-center text-sm text-slate-500">Buscando...</div>
                  ) : procResults.length === 0 ? (
                    <div className="p-4 text-center text-sm text-slate-500">Nenhum procedimento encontrado.</div>
                  ) : (
                    procResults.map(proc => {
                      const isSelected = (watchedProcedures || []).some(p => p.id === proc.id);
                      return (
                        <button
                          key={proc.id}
                          type="button"
                          onClick={() => addProcedure(proc)}
                          disabled={isSelected}
                          className={`w-full text-left px-4 py-2.5 border-b border-slate-100 dark:border-gray-800 last:border-0 flex items-center gap-3 transition-colors ${
                            isSelected ? 'bg-teal-50/50 dark:bg-teal-900/10 cursor-default' : 'hover:bg-slate-50 dark:hover:bg-white/5'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-slate-800 dark:text-gray-200">
                              <span className="font-mono text-teal-600 dark:text-teal-400 mr-2">{proc.code}</span>
                              {proc.name}
                            </p>
                            {proc.category && <p className="text-[10px] text-slate-400">{proc.category}</p>}
                          </div>
                          {isSelected && <Check size={14} className="text-teal-500 shrink-0"/>}
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* ── Enviar Anamnese ── */}
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Enviar Anamnese(s)</label>
              <Controller
                name="anamnesis_template_id"
                control={control}
                render={({ field }) => (
                  <div className="relative">
                    <FileText className="w-4 h-4 text-gray-400 absolute left-3 top-3"/>
                    <select
                      value={field.value ?? ''}
                      onChange={e => field.onChange(e.target.value ? Number(e.target.value) : null)}
                      className="w-full pl-9 pr-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-[#2a2d36] text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all appearance-none"
                    >
                      <option value="">Nenhuma anamnese</option>
                      {anamnesisTemplates.map(t => (
                        <option key={t.id} value={t.id}>{t.title}{t.category ? ` (${t.category})` : ''}</option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-3 pointer-events-none"/>
                  </div>
                )}
              />
            </div>

            {/* ── Checkboxes ── */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { name: 'is_squeeze' as const, label: 'Encaixar horario', desc: 'Ignora conflito de horario', icon: Plus },
                { name: 'is_teleconsultation' as const, label: 'Teleconsulta', desc: 'Consulta por video', icon: Video },
                { name: 'auto_confirm' as const, label: 'Agendar como confirmado', desc: 'Status inicial = confirmado', icon: Check },
                { name: 'generate_budget' as const, label: 'Gerar orcamento', desc: 'Cria orcamento ao salvar', icon: ClipboardList }
              ].map(cb => (
                <Controller
                  key={cb.name}
                  name={cb.name}
                  control={control}
                  render={({ field }) => (
                    <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      field.value
                        ? 'bg-teal-50/50 dark:bg-teal-900/10 border-teal-200 dark:border-teal-800/30'
                        : 'border-gray-200 dark:border-gray-700 hover:border-slate-300'
                    }`}>
                      <input
                        type="checkbox"
                        checked={field.value}
                        onChange={e => field.onChange(e.target.checked)}
                        className="mt-0.5 w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500 focus:ring-offset-0"
                      />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <cb.icon size={13} className={field.value ? 'text-teal-600 dark:text-teal-400' : 'text-slate-400'}/>
                          <span className={`text-xs font-bold ${field.value ? 'text-teal-700 dark:text-teal-300' : 'text-slate-600 dark:text-gray-300'}`}>{cb.label}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 dark:text-gray-500 mt-0.5">{cb.desc}</p>
                      </div>
                    </label>
                  )}
                />
              ))}
            </div>

            {/* ── Descricao ── */}
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Descricao / Observacoes</label>
              <Controller
                name="description"
                control={control}
                render={({ field }) => (
                  <textarea
                    {...field}
                    rows={3}
                    placeholder="Observacoes sobre o agendamento..."
                    className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-[#2a2d36] text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all resize-none placeholder:text-slate-400"
                  />
                )}
              />
            </div>
          </form>

          {/* ── Sidebar do paciente ── */}
          {selectedPatient && (
            <div className="w-64 border-l border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#2a2d36]/50 p-5 overflow-y-auto custom-scrollbar shrink-0">
              <div className="flex flex-col items-center text-center mb-5">
                <div className="w-16 h-16 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center text-teal-600 dark:text-teal-400 font-bold text-xl mb-3">
                  {selectedPatient.full_name.charAt(0)}
                </div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-gray-100">{selectedPatient.full_name}</h4>
                {selectedPatient.birth_date && (
                  <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">{calcAge(selectedPatient.birth_date)}</p>
                )}
                {selectedPatient.phone && (
                  <p className="text-xs text-slate-500 dark:text-gray-400 flex items-center gap-1 mt-1">
                    <Phone size={10}/> {selectedPatient.phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')}
                  </p>
                )}
                {selectedPatient.sex && (
                  <span className={`mt-2 text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md ${
                    selectedPatient.sex === 'M'
                      ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                      : 'bg-pink-100 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400'
                  }`}>
                    {selectedPatient.sex === 'M' ? 'Masculino' : 'Feminino'}
                  </span>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider">Links Rapidos</p>
                {[
                  { label: 'Prontuario', icon: FileText, href: `/atendimento/prontuario/${selectedPatient.id}` },
                  { label: 'Ver cadastro', icon: User, href: `/atendimento/pacientes/${selectedPatient.id}` },
                  { label: 'Historico de agendamentos', icon: History, href: `/atendimento/agenda/historico/${selectedPatient.id}` }
                ].map(link => (
                  <a
                    key={link.label}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-white dark:hover:bg-white/5 text-slate-600 dark:text-gray-300 transition-colors group"
                  >
                    <div className="p-1.5 rounded-md bg-teal-50 dark:bg-teal-900/20 text-teal-500 dark:text-teal-400 group-hover:bg-teal-100">
                      <link.icon size={14}/>
                    </div>
                    <span className="text-xs font-medium">{link.label}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#2a2d36] flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-400 dark:text-gray-500">
            {watchedSubtype === 'orcamento' && <span className="text-amber-600 dark:text-amber-400 font-semibold">Agendamento tipo orcamento</span>}
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg text-sm font-bold transition-colors">
              Cancelar
            </button>
            <button
              type="submit"
              form="new-appointment-form"
              disabled={saving}
              className="px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-bold shadow-lg flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              {saving ? <><Loader2 size={16} className="animate-spin"/> Salvando...</> : <><Save size={16}/> Salvar Informacoes</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
