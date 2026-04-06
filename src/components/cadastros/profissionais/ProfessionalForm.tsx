'use client';

import { useState, useCallback, useRef } from 'react';
import {
  ArrowLeft, Save, Loader2, User, Phone, Briefcase,
  FileText, Upload, X, ChevronDown, Plus, Trash2,
  Stethoscope, DollarSign, Clock, Percent,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/contexts/ToastContext';
import AddressCepLookup, { EMPTY_ADDRESS } from '@/components/cadastros/shared/AddressCepLookup';
import type { AddressData } from '@/components/cadastros/shared/AddressCepLookup';
import MaskedInput from '@/components/cadastros/shared/MaskedInput';
import type { Professional, ProcedureType, SplitType } from '@/types/cadastros';

// --- Constantes ---

const PROFESSIONAL_TYPES = [
  'Biomédico', 'Educador físico', 'Enfermeiro(a)', 'Esteticista',
  'Farmacêutico', 'Fisioterapeuta', 'Fonoaudiólogo', 'Médico(a)',
  'Nutricionista', 'Odontólogo', 'Outros', 'Profissional externo',
  'Psicólogo', 'Técnico em enfermagem', 'Terapeuta',
] as const;

const REGISTRATION_TYPES = [
  'CRBM', 'COREN', 'CRF', 'CREFITO', 'CREFONO/CRFa', 'CRM',
  'CRN', 'CRO', 'CRP', 'Outros (O)', 'Reg.Col.Med',
] as const;

const SEX_OPTIONS = [
  { value: 'M', label: 'Masculino' },
  { value: 'F', label: 'Feminino' },
] as const;

const MARITAL_STATUS_OPTIONS = [
  { value: 'single', label: 'Solteiro(a)' },
  { value: 'married', label: 'Casado(a)' },
  { value: 'divorced', label: 'Divorciado(a)' },
  { value: 'widowed', label: 'Viúvo(a)' },
  { value: 'other', label: 'Outro' },
] as const;

const UF_OPTIONS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
  'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
] as const;

const PROCEDURE_TYPE_OPTIONS: { value: ProcedureType; label: string }[] = [
  { value: 'consultation', label: 'Consultas' },
  { value: 'exam', label: 'Exames' },
  { value: 'injectable', label: 'Injetáveis' },
  { value: 'other', label: 'Outros' },
];

const PROCEDURE_TYPE_COLORS: Record<string, string> = {
  consultation: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  exam: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  injectable: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  other: 'bg-slate-100 text-slate-600 dark:bg-slate-700/40 dark:text-slate-300',
};

const PROCEDURE_TYPE_LABELS: Record<string, string> = {
  consultation: 'Consultas',
  exam: 'Exames',
  injectable: 'Injetáveis',
  other: 'Outros',
};

// --- Tipos ---

export interface ProcedureItem {
  id: string;
  name: string;
  procedure_type: ProcedureType;
  custom_type: string;
  duration_minutes: number;
  value: number;
  split_type: SplitType;
  split_value: number;
}

export interface ProfessionalFormData {
  name: string;
  sex: string;
  birth_date: string;
  marital_status: string;
  cpf: string;
  rg: string;
  address: AddressData;
  email: string;
  phone: string;
  mobile: string;
  whatsapp: string;
  professional_type: string;
  specialty: string;
  registration_state: string;
  registration_type: string;
  registration_number: string;
  is_admin: boolean;
  restrict_prices: boolean;
  has_schedule: boolean;
  restrict_schedule: boolean;
  attachments: File[];
  notes: string;
  create_login: boolean;
  procedures: ProcedureItem[];
}

const EMPTY_FORM: ProfessionalFormData = {
  name: '', sex: '', birth_date: '', marital_status: '',
  cpf: '', rg: '',
  address: { ...EMPTY_ADDRESS },
  email: '', phone: '', mobile: '', whatsapp: '',
  professional_type: '', specialty: '',
  registration_state: '', registration_type: '', registration_number: '',
  is_admin: false, restrict_prices: false, has_schedule: false, restrict_schedule: false,
  attachments: [],
  notes: '',
  create_login: false,
  procedures: [],
};

interface ProfessionalFormProps {
  initialData?: Professional | null;
  onSubmit: (data: ProfessionalFormData) => Promise<void>;
  title: string;
  subtitle: string;
  showCreateLogin?: boolean;
  showProcedures?: boolean;
  hideHeader?: boolean;
}

// --- Helpers ---

const inputClass = 'w-full px-3 py-2.5 text-sm border border-slate-200 dark:border-[#3d3d48] rounded-xl bg-white dark:bg-[#1c1c21] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-400 disabled:opacity-50';
const selectClass = `${inputClass} appearance-none cursor-pointer`;
const labelClass = 'text-xs font-bold text-slate-500 dark:text-[#a1a1aa] mb-1.5 ml-1 block uppercase tracking-wider';

function RequiredBadge() {
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 ml-1">
      Obrigatório
    </span>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function calcSplit(value: number, splitType: SplitType, splitValue: number) {
  const profissionalRecebe = splitType === 'percentage'
    ? Math.round(value * splitValue / 100 * 100) / 100
    : splitValue;
  const clinicaRetem = Math.round((value - profissionalRecebe) * 100) / 100;
  return { profissionalRecebe, clinicaRetem };
}

function professionalToForm(p: Professional): ProfessionalFormData {
  return {
    name: p.name,
    sex: p.sex || '',
    birth_date: p.birth_date || '',
    marital_status: p.marital_status || '',
    cpf: p.cpf,
    rg: p.rg || '',
    address: {
      zip_code: p.zip_code || '',
      street: p.street || '',
      state: p.state || '',
      city: p.city || '',
      neighborhood: p.neighborhood || '',
      number: p.number || '',
      complement: p.complement || '',
    },
    email: p.email,
    phone: p.phone || '',
    mobile: p.mobile || '',
    whatsapp: p.whatsapp || '',
    professional_type: p.professional_type,
    specialty: p.specialty || '',
    registration_state: p.registration_state,
    registration_type: p.registration_type,
    registration_number: p.registration_number,
    is_admin: p.is_admin,
    restrict_prices: p.restrict_prices,
    has_schedule: p.has_schedule,
    restrict_schedule: p.restrict_schedule,
    attachments: [],
    notes: p.notes || '',
    create_login: false,
    procedures: [],
  };
}

// --- Formulário inline de procedimento ---

interface ProcedureInlineFormState {
  name: string;
  procedure_type: ProcedureType;
  custom_type: string;
  duration_minutes: number;
  value: number;
  split_type: SplitType;
  split_value: number;
}

const EMPTY_PROCEDURE_FORM: ProcedureInlineFormState = {
  name: '',
  procedure_type: 'consultation',
  custom_type: '',
  duration_minutes: 30,
  value: 0,
  split_type: 'percentage',
  split_value: 0,
};

// --- Componente ---

export default function ProfessionalForm({ initialData, onSubmit, title, subtitle, showCreateLogin, showProcedures, hideHeader }: ProfessionalFormProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [form, setForm] = useState<ProfessionalFormData>(
    initialData ? professionalToForm(initialData) : { ...EMPTY_FORM },
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Procedure inline form state
  const [showProcedureForm, setShowProcedureForm] = useState(false);
  const [procForm, setProcForm] = useState<ProcedureInlineFormState>({ ...EMPTY_PROCEDURE_FORM });
  const [procErrors, setProcErrors] = useState<Record<string, string>>({});

  const update = useCallback(<K extends keyof ProfessionalFormData>(key: K, value: ProfessionalFormData[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => {
      if (prev[key]) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return prev;
    });
  }, []);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Nome é obrigatório.';
    if (!form.cpf.trim()) errs.cpf = 'CPF é obrigatório.';
    if (!form.email.trim()) {
      errs.email = 'E-mail é obrigatório.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errs.email = 'E-mail inválido.';
    }
    if (!form.professional_type) errs.professional_type = 'Tipo profissional é obrigatório.';
    if (!form.registration_state) errs.registration_state = 'Estado de registro é obrigatório.';
    if (!form.registration_type) errs.registration_type = 'Tipo de registro é obrigatório.';
    if (!form.registration_number.trim()) errs.registration_number = 'Registro profissional é obrigatório.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      toast.error('Preencha todos os campos obrigatórios.');
      return;
    }
    setSaving(true);
    try {
      await onSubmit(form);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      toast.error('Erro ao salvar: ' + msg);
    } finally {
      setSaving(false);
    }
  };

  const handleFilesDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      update('attachments', [...form.attachments, ...files]);
    }
  }, [form.attachments, update]);

  const handleFilesSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      update('attachments', [...form.attachments, ...files]);
    }
  }, [form.attachments, update]);

  const removeFile = useCallback((index: number) => {
    update('attachments', form.attachments.filter((_, i) => i !== index));
  }, [form.attachments, update]);

  // --- Procedure inline form handlers ---

  const validateProcedure = (): boolean => {
    const errs: Record<string, string> = {};
    if (!procForm.name.trim()) errs.name = 'Nome é obrigatório.';
    if (procForm.duration_minutes <= 0) errs.duration_minutes = 'Duração deve ser maior que 0.';
    if (procForm.value < 0) errs.value = 'Valor não pode ser negativo.';
    if (procForm.split_type === 'percentage' && (procForm.split_value < 0 || procForm.split_value > 100)) {
      errs.split_value = 'Porcentagem deve ser entre 0 e 100.';
    }
    if (procForm.split_type === 'fixed' && procForm.split_value < 0) {
      errs.split_value = 'Valor não pode ser negativo.';
    }
    if (procForm.split_type === 'fixed' && procForm.split_value > procForm.value) {
      errs.split_value = 'Repasse não pode ser maior que o valor cobrado.';
    }
    setProcErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const addProcedure = () => {
    if (!validateProcedure()) return;
    const newProc: ProcedureItem = {
      id: `temp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: procForm.name,
      procedure_type: procForm.procedure_type,
      custom_type: procForm.procedure_type === 'other' ? procForm.custom_type : '',
      duration_minutes: procForm.duration_minutes,
      value: procForm.value,
      split_type: procForm.split_type,
      split_value: procForm.split_value,
    };
    update('procedures', [...form.procedures, newProc]);
    setProcForm({ ...EMPTY_PROCEDURE_FORM });
    setProcErrors({});
    setShowProcedureForm(false);
  };

  const removeProcedure = (id: string) => {
    update('procedures', form.procedures.filter(p => p.id !== id));
  };

  const procPreview = calcSplit(procForm.value, procForm.split_type, procForm.split_value);

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-[#15171e]">
      {/* Header */}
      {!hideHeader && (
        <div className="px-6 py-4 flex items-center gap-4 border-b border-slate-200 dark:border-[#3d3d48] bg-white dark:bg-[#08080b]">
          <button
            onClick={() => router.push('/atendimento/cadastros/profissionais')}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-500" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-slate-800 dark:text-[#fafafa] flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-teal-600" />
              {title}
            </h1>
            <p className="text-xs text-slate-400 dark:text-[#71717a]">{subtitle}</p>
          </div>
        </div>
      )}

      {/* Conteúdo scrollável */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* ─── Seção 1: Informações Básicas ─── */}
          <section className="bg-white dark:bg-[#08080b] rounded-xl border border-slate-200 dark:border-[#3d3d48] p-6 space-y-5">
            <h2 className="text-sm font-bold text-slate-700 dark:text-[#d4d4d8] uppercase tracking-wide flex items-center gap-2">
              <User className="w-4 h-4 text-teal-500" />
              Informações Básicas
            </h2>

            <div className="grid grid-cols-12 gap-5">
              {/* Nome */}
              <div className="col-span-12 md:col-span-8">
                <label className={labelClass}>Nome <RequiredBadge /></label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => update('name', e.target.value)}
                  placeholder="Nome completo"
                  className={`${inputClass} ${errors.name ? 'border-red-300 dark:border-red-700' : ''}`}
                />
                {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
              </div>

              {/* Sexo */}
              <div className="col-span-6 md:col-span-4">
                <label className={labelClass}>Sexo</label>
                <div className="relative">
                  <select value={form.sex} onChange={e => update('sex', e.target.value)} className={selectClass}>
                    <option value="">Selecione</option>
                    {SEX_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Data de nascimento */}
              <div className="col-span-6 md:col-span-4">
                <label className={labelClass}>Data de nascimento</label>
                <input
                  type="date"
                  value={form.birth_date}
                  onChange={e => update('birth_date', e.target.value)}
                  className={inputClass}
                />
              </div>

              {/* Estado civil */}
              <div className="col-span-6 md:col-span-4">
                <label className={labelClass}>Estado civil</label>
                <div className="relative">
                  <select value={form.marital_status} onChange={e => update('marital_status', e.target.value)} className={selectClass}>
                    <option value="">Selecione</option>
                    {MARITAL_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* CPF */}
              <div className="col-span-6 md:col-span-4">
                <MaskedInput
                  mask="cpf"
                  value={form.cpf}
                  onChange={(raw) => update('cpf', raw)}
                  label="CPF"
                  required
                  error={errors.cpf}
                />
              </div>

              {/* RG */}
              <div className="col-span-12 md:col-span-4">
                <label className={labelClass}>RG</label>
                <input
                  type="text"
                  value={form.rg}
                  onChange={e => update('rg', e.target.value)}
                  placeholder="RG"
                  className={inputClass}
                />
              </div>
            </div>
          </section>

          {/* ─── Seção 2: Endereço e Localização ─── */}
          <section className="bg-white dark:bg-[#08080b] rounded-xl border border-slate-200 dark:border-[#3d3d48] p-6">
            <AddressCepLookup
              value={form.address}
              onChange={(addr) => update('address', addr)}
            />
          </section>

          {/* ─── Seção 3: Informações de Contato ─── */}
          <section className="bg-white dark:bg-[#08080b] rounded-xl border border-slate-200 dark:border-[#3d3d48] p-6 space-y-5">
            <h2 className="text-sm font-bold text-slate-700 dark:text-[#d4d4d8] uppercase tracking-wide flex items-center gap-2">
              <Phone className="w-4 h-4 text-teal-500" />
              Informações de Contato
            </h2>

            <div className="grid grid-cols-12 gap-5">
              {/* Email */}
              <div className="col-span-12 md:col-span-6">
                <label className={labelClass}>E-mail <RequiredBadge /></label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => update('email', e.target.value)}
                  placeholder="email@exemplo.com"
                  className={`${inputClass} ${errors.email ? 'border-red-300 dark:border-red-700' : ''}`}
                />
                {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
              </div>

              {/* Telefone */}
              <div className="col-span-6 md:col-span-3">
                <MaskedInput
                  mask="phone"
                  value={form.phone}
                  onChange={(raw) => update('phone', raw)}
                  label="Telefone"
                />
              </div>

              {/* Celular */}
              <div className="col-span-6 md:col-span-3">
                <MaskedInput
                  mask="mobile"
                  value={form.mobile}
                  onChange={(raw) => update('mobile', raw)}
                  label="Celular"
                />
              </div>

              {/* WhatsApp */}
              <div className="col-span-6 md:col-span-3">
                <MaskedInput
                  mask="mobile"
                  value={form.whatsapp}
                  onChange={(raw) => update('whatsapp', raw)}
                  label="WhatsApp"
                />
              </div>
            </div>
          </section>

          {/* ─── Seção 4: Informações Profissionais ─── */}
          <section className="bg-white dark:bg-[#08080b] rounded-xl border border-slate-200 dark:border-[#3d3d48] p-6 space-y-5">
            <h2 className="text-sm font-bold text-slate-700 dark:text-[#d4d4d8] uppercase tracking-wide flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-teal-500" />
              Informações Profissionais
            </h2>

            <div className="grid grid-cols-12 gap-5">
              {/* Tipo profissional */}
              <div className="col-span-12 md:col-span-6">
                <label className={labelClass}>Tipo de profissional <RequiredBadge /></label>
                <div className="relative">
                  <select
                    value={form.professional_type}
                    onChange={e => {
                      const val = e.target.value;
                      update('professional_type', val);
                      // Auto-marcar "Possui agenda" para tipos que normalmente atendem
                      const typesWithSchedule = ['Médico(a)', 'Odontólogo', 'Nutricionista', 'Psicólogo', 'Fisioterapeuta', 'Fonoaudiólogo'];
                      if (typesWithSchedule.includes(val) && !form.has_schedule) {
                        update('has_schedule', true);
                      }
                      // Auto-sugerir tipo de registro
                      const typeToRegistration: Record<string, string> = {
                        'Médico(a)': 'CRM', 'Enfermeiro(a)': 'COREN', 'Farmacêutico': 'CRF',
                        'Fisioterapeuta': 'CREFITO', 'Fonoaudiólogo': 'CREFONO/CRFa',
                        'Nutricionista': 'CRN', 'Odontólogo': 'CRO', 'Psicólogo': 'CRP',
                        'Biomédico': 'CRBM',
                      };
                      if (typeToRegistration[val] && !form.registration_type) {
                        update('registration_type', typeToRegistration[val]);
                      }
                    }}
                    className={`${selectClass} ${errors.professional_type ? 'border-red-300 dark:border-red-700' : ''}`}
                  >
                    <option value="">Selecione</option>
                    {PROFESSIONAL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
                {errors.professional_type && <p className="mt-1 text-xs text-red-500">{errors.professional_type}</p>}
              </div>

              {/* Especialidade */}
              <div className="col-span-12 md:col-span-6">
                <label className={labelClass}>Especialidade</label>
                <input
                  type="text"
                  value={form.specialty}
                  onChange={e => update('specialty', e.target.value)}
                  placeholder="Especialidade"
                  className={inputClass}
                />
              </div>

              {/* Estado de registro */}
              <div className="col-span-6 md:col-span-4">
                <label className={labelClass}>Estado de registro <RequiredBadge /></label>
                <div className="relative">
                  <select
                    value={form.registration_state}
                    onChange={e => update('registration_state', e.target.value)}
                    className={`${selectClass} ${errors.registration_state ? 'border-red-300 dark:border-red-700' : ''}`}
                  >
                    <option value="">Selecione</option>
                    {UF_OPTIONS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
                {errors.registration_state && <p className="mt-1 text-xs text-red-500">{errors.registration_state}</p>}
              </div>

              {/* Tipo de registro */}
              <div className="col-span-6 md:col-span-4">
                <label className={labelClass}>Tipo de registro <RequiredBadge /></label>
                <div className="relative">
                  <select
                    value={form.registration_type}
                    onChange={e => update('registration_type', e.target.value)}
                    className={`${selectClass} ${errors.registration_type ? 'border-red-300 dark:border-red-700' : ''}`}
                  >
                    <option value="">Selecione</option>
                    {REGISTRATION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
                {errors.registration_type && <p className="mt-1 text-xs text-red-500">{errors.registration_type}</p>}
              </div>

              {/* Registro profissional */}
              <div className="col-span-12 md:col-span-4">
                <label className={labelClass}>Registro profissional <RequiredBadge /></label>
                <input
                  type="text"
                  value={form.registration_number}
                  onChange={e => update('registration_number', e.target.value)}
                  placeholder="Número do registro"
                  className={`${inputClass} ${errors.registration_number ? 'border-red-300 dark:border-red-700' : ''}`}
                />
                {errors.registration_number && <p className="mt-1 text-xs text-red-500">{errors.registration_number}</p>}
              </div>

              {/* Admin */}
              <div className="col-span-12 md:col-span-6">
                <label className={labelClass}>Acesso de administrador <RequiredBadge /></label>
                <div className="flex items-center gap-6 mt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="is_admin"
                      checked={form.is_admin === true}
                      onChange={() => update('is_admin', true)}
                      className="w-4 h-4 text-teal-600 border-slate-300 focus:ring-teal-500"
                    />
                    <span className="text-sm text-slate-700 dark:text-gray-200">Sim</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="is_admin"
                      checked={form.is_admin === false}
                      onChange={() => update('is_admin', false)}
                      className="w-4 h-4 text-teal-600 border-slate-300 focus:ring-teal-500"
                    />
                    <span className="text-sm text-slate-700 dark:text-gray-200">Não</span>
                  </label>
                </div>
              </div>

              {/* Checkboxes */}
              <div className="col-span-12">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-1">
                  <label className="flex items-start gap-2.5 cursor-pointer p-3 rounded-lg border border-slate-100 dark:border-[#2d2d36] hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                    <input
                      type="checkbox"
                      checked={form.restrict_prices}
                      onChange={e => update('restrict_prices', e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 mt-0.5"
                    />
                    <div>
                      <span className="text-sm font-medium text-slate-700 dark:text-gray-200 block">Restringir preços</span>
                      <span className="text-[10px] text-slate-400 dark:text-[#71717a]">Impede este profissional de alterar valores de procedimentos</span>
                    </div>
                  </label>
                  <label className="flex items-start gap-2.5 cursor-pointer p-3 rounded-lg border border-slate-100 dark:border-[#2d2d36] hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                    <input
                      type="checkbox"
                      checked={form.has_schedule}
                      onChange={e => update('has_schedule', e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 mt-0.5"
                    />
                    <div>
                      <span className="text-sm font-medium text-slate-700 dark:text-gray-200 block">Possui agenda</span>
                      <span className="text-[10px] text-slate-400 dark:text-[#71717a]">Habilita este profissional para receber agendamentos de pacientes</span>
                    </div>
                  </label>
                  <label className="flex items-start gap-2.5 cursor-pointer p-3 rounded-lg border border-slate-100 dark:border-[#2d2d36] hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                    <input
                      type="checkbox"
                      checked={form.restrict_schedule}
                      onChange={e => update('restrict_schedule', e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 mt-0.5"
                    />
                    <div>
                      <span className="text-sm font-medium text-slate-700 dark:text-gray-200 block">Restringir agenda</span>
                      <span className="text-[10px] text-slate-400 dark:text-[#71717a]">Só permite visualizar seus próprios agendamentos, não os de outros profissionais</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </section>

          {/* ─── Seção 5: Acesso ao Sistema ─── */}
          {showCreateLogin && (
            <section className="bg-white dark:bg-[#08080b] rounded-xl border border-slate-200 dark:border-[#3d3d48] p-6 space-y-4">
              <h2 className="text-sm font-bold text-slate-700 dark:text-[#d4d4d8] uppercase tracking-wide flex items-center gap-2">
                <User className="w-4 h-4 text-teal-500" />
                Acesso ao Sistema
              </h2>

              <label className="flex items-start gap-3 cursor-pointer p-4 rounded-xl border border-slate-100 dark:border-[#2d2d36] hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                <div className="pt-0.5">
                  <button
                    type="button"
                    onClick={() => update('create_login', !form.create_login)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      form.create_login ? 'bg-teal-600' : 'bg-slate-300 dark:bg-gray-600'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform shadow-sm ${
                      form.create_login ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
                <div>
                  <span className="text-sm font-semibold text-slate-700 dark:text-gray-200 block">
                    Criar login de acesso
                  </span>
                  <span className="text-xs text-slate-400 dark:text-[#71717a] block mt-0.5">
                    Um login será criado automaticamente com o e-mail do profissional. A senha temporária será exibida após o cadastro para que você possa compartilhar com o profissional.
                  </span>
                  {form.create_login && !form.email.trim() && (
                    <span className="text-xs text-amber-500 mt-1 block">
                      Preencha o e-mail do profissional para criar o login.
                    </span>
                  )}
                </div>
              </label>
            </section>
          )}

          {/* ─── Seção 6: Procedimentos do Profissional ─── */}
          {showProcedures && (
            <section className="bg-white dark:bg-[#08080b] rounded-xl border border-slate-200 dark:border-[#3d3d48] p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-700 dark:text-[#d4d4d8] uppercase tracking-wide flex items-center gap-2">
                  <Stethoscope className="w-4 h-4 text-teal-500" />
                  Procedimentos do Profissional
                  <span className="text-xs font-normal text-slate-400 dark:text-[#71717a] normal-case ml-1">
                    {form.procedures.length} cadastrado{form.procedures.length !== 1 ? 's' : ''}
                  </span>
                </h2>
                {!showProcedureForm && (
                  <button
                    type="button"
                    onClick={() => { setProcForm({ ...EMPTY_PROCEDURE_FORM }); setProcErrors({}); setShowProcedureForm(true); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-md transition-all active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    ADICIONAR
                  </button>
                )}
              </div>

              {/* Lista de procedimentos adicionados */}
              {form.procedures.length > 0 && (
                <div className="space-y-2">
                  {form.procedures.map(proc => {
                    const split = calcSplit(proc.value, proc.split_type, proc.split_value);
                    return (
                      <div
                        key={proc.id}
                        className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-[#15171e] rounded-xl border border-slate-200 dark:border-[#252530]"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-semibold text-slate-800 dark:text-[#fafafa] truncate">{proc.name}</span>
                            <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${PROCEDURE_TYPE_COLORS[proc.procedure_type] || PROCEDURE_TYPE_COLORS.other}`}>
                              {proc.procedure_type === 'other' && proc.custom_type ? proc.custom_type : (PROCEDURE_TYPE_LABELS[proc.procedure_type] || proc.procedure_type)}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-[#a1a1aa]">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {proc.duration_minutes} min
                            </span>
                            <span className="flex items-center gap-1">
                              <DollarSign className="w-3 h-3" />
                              {formatCurrency(proc.value)}
                            </span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                              Profissional: {formatCurrency(split.profissionalRecebe)}
                              {proc.split_type === 'percentage' ? ` (${proc.split_value}%)` : ' (fixo)'}
                            </span>
                            <span>
                              Clinica: {formatCurrency(split.clinicaRetem)}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeProcedure(proc.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0"
                          title="Remover"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Formulário inline para adicionar procedimento */}
              {showProcedureForm && (
                <div className="bg-blue-50/50 dark:bg-blue-950/20 rounded-xl border border-blue-200 dark:border-blue-800/40 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Plus className="w-3.5 h-3.5" />
                      Novo Procedimento
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowProcedureForm(false)}
                      className="p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                    >
                      <X className="w-4 h-4 text-blue-400" />
                    </button>
                  </div>

                  {/* Nome */}
                  <div>
                    <label className={labelClass}>Nome do procedimento</label>
                    <input
                      type="text"
                      value={procForm.name}
                      onChange={e => { setProcForm(prev => ({ ...prev, name: e.target.value })); setProcErrors(prev => { const n = { ...prev }; delete n.name; return n; }); }}
                      placeholder="Ex: Consulta, Ultrassom, Vacina..."
                      className={`${inputClass} ${procErrors.name ? 'border-red-300 dark:border-red-700' : ''}`}
                    />
                    {procErrors.name && <p className="mt-1 text-xs text-red-500">{procErrors.name}</p>}
                  </div>

                  {/* Tipo + Duração */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Tipo</label>
                      <div className="relative">
                        <select
                          value={procForm.procedure_type}
                          onChange={e => setProcForm(prev => ({ ...prev, procedure_type: e.target.value as ProcedureType, custom_type: '' }))}
                          className={selectClass}
                        >
                          {PROCEDURE_TYPE_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                    <div>
                      <label className={labelClass}>Duração (minutos)</label>
                      <input
                        type="number"
                        min={1}
                        value={procForm.duration_minutes}
                        onChange={e => { setProcForm(prev => ({ ...prev, duration_minutes: Math.max(0, parseInt(e.target.value) || 0) })); setProcErrors(prev => { const n = { ...prev }; delete n.duration_minutes; return n; }); }}
                        className={`${inputClass} ${procErrors.duration_minutes ? 'border-red-300 dark:border-red-700' : ''}`}
                      />
                      {procErrors.duration_minutes && <p className="mt-1 text-xs text-red-500">{procErrors.duration_minutes}</p>}
                    </div>
                  </div>

                  {/* Tipo personalizado */}
                  {procForm.procedure_type === 'other' && (
                    <div>
                      <label className={labelClass}>Especifique o tipo</label>
                      <input
                        type="text"
                        value={procForm.custom_type}
                        onChange={e => setProcForm(prev => ({ ...prev, custom_type: e.target.value }))}
                        placeholder="Ex: Laser, Peeling, Drenagem..."
                        className={inputClass}
                      />
                    </div>
                  )}

                  {/* Valor cobrado */}
                  <div>
                    <label className={labelClass}>Valor cobrado do paciente (R$)</label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={procForm.value || ''}
                      onChange={e => { setProcForm(prev => ({ ...prev, value: parseFloat(e.target.value) || 0 })); setProcErrors(prev => { const n = { ...prev }; delete n.value; return n; }); }}
                      placeholder="0,00"
                      className={`${inputClass} ${procErrors.value ? 'border-red-300 dark:border-red-700' : ''}`}
                    />
                    {procErrors.value && <p className="mt-1 text-xs text-red-500">{procErrors.value}</p>}
                  </div>

                  {/* Tipo de repasse */}
                  <div>
                    <label className={labelClass}>Tipo de repasse</label>
                    <div className="flex gap-3 mt-1">
                      <button
                        type="button"
                        onClick={() => setProcForm(prev => ({ ...prev, split_type: 'percentage', split_value: 0 }))}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
                          procForm.split_type === 'percentage'
                            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700'
                            : 'bg-white dark:bg-[#1a1a22] text-slate-500 dark:text-[#a1a1aa] border-slate-200 dark:border-[#3d3d48] hover:border-blue-300'
                        }`}
                      >
                        <Percent className="w-4 h-4" />
                        Porcentagem
                      </button>
                      <button
                        type="button"
                        onClick={() => setProcForm(prev => ({ ...prev, split_type: 'fixed', split_value: 0 }))}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
                          procForm.split_type === 'fixed'
                            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700'
                            : 'bg-white dark:bg-[#1a1a22] text-slate-500 dark:text-[#a1a1aa] border-slate-200 dark:border-[#3d3d48] hover:border-blue-300'
                        }`}
                      >
                        <DollarSign className="w-4 h-4" />
                        Valor Fixo
                      </button>
                    </div>
                  </div>

                  {/* Valor da divisão */}
                  <div>
                    <label className={labelClass}>
                      {procForm.split_type === 'percentage' ? 'Porcentagem do profissional (%)' : 'Valor fixo do profissional (R$)'}
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={procForm.split_type === 'percentage' ? 100 : undefined}
                      step={procForm.split_type === 'percentage' ? '1' : '0.01'}
                      value={procForm.split_value || ''}
                      onChange={e => { setProcForm(prev => ({ ...prev, split_value: parseFloat(e.target.value) || 0 })); setProcErrors(prev => { const n = { ...prev }; delete n.split_value; return n; }); }}
                      placeholder={procForm.split_type === 'percentage' ? 'Ex: 50' : 'Ex: 200,00'}
                      className={`${inputClass} ${procErrors.split_value ? 'border-red-300 dark:border-red-700' : ''}`}
                    />
                    {procErrors.split_value && <p className="mt-1 text-xs text-red-500">{procErrors.split_value}</p>}
                  </div>

                  {/* Preview da divisão */}
                  {procForm.value > 0 && (
                    <div className="bg-white dark:bg-[#0e0e14] rounded-xl border border-slate-200 dark:border-[#252530] p-4">
                      <p className="text-xs font-bold text-slate-500 dark:text-[#a1a1aa] uppercase tracking-wider mb-3">Resumo da divisão</p>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="text-center">
                          <p className="text-[10px] text-slate-400 dark:text-[#71717a] uppercase mb-1">Paciente paga</p>
                          <p className="text-sm font-bold text-slate-800 dark:text-[#fafafa]">{formatCurrency(procForm.value)}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] text-slate-400 dark:text-[#71717a] uppercase mb-1">Profissional</p>
                          <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(procPreview.profissionalRecebe)}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] text-slate-400 dark:text-[#71717a] uppercase mb-1">Clinica</p>
                          <p className="text-sm font-bold text-blue-600 dark:text-blue-400">{formatCurrency(procPreview.clinicaRetem)}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Botões */}
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowProcedureForm(false)}
                      className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-[#d4d4d8] hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={addProcedure}
                      className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-500/20 transition-all active:scale-95"
                    >
                      <Plus className="w-4 h-4" />
                      ADICIONAR PROCEDIMENTO
                    </button>
                  </div>
                </div>
              )}

              {/* Empty state */}
              {form.procedures.length === 0 && !showProcedureForm && (
                <div className="flex flex-col items-center justify-center py-8 text-slate-400 dark:text-[#71717a]">
                  <Stethoscope className="w-10 h-10 mb-2 opacity-30" />
                  <p className="text-sm">Nenhum procedimento adicionado ainda.</p>
                  <p className="text-xs mt-1 text-slate-300 dark:text-[#52525b]">Opcional - você pode adicionar depois na edição do profissional.</p>
                </div>
              )}
            </section>
          )}

          {/* ─── Seção 7: Informações Complementares ─── */}
          <section className="bg-white dark:bg-[#08080b] rounded-xl border border-slate-200 dark:border-[#3d3d48] p-6 space-y-5">
            <h2 className="text-sm font-bold text-slate-700 dark:text-[#d4d4d8] uppercase tracking-wide flex items-center gap-2">
              <FileText className="w-4 h-4 text-teal-500" />
              Informações Complementares
            </h2>

            {/* Anexos - drag-drop */}
            <div>
              <label className={labelClass}>Anexos</label>
              <div
                onDragOver={e => e.preventDefault()}
                onDrop={handleFilesDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-200 dark:border-[#3d3d48] rounded-xl p-8 text-center cursor-pointer hover:border-teal-400 dark:hover:border-teal-600 transition-colors"
              >
                <Upload className="w-8 h-8 text-slate-300 dark:text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-slate-400 dark:text-[#71717a]">
                  Arraste arquivos aqui ou <span className="text-teal-600 dark:text-teal-400 font-semibold">clique para selecionar</span>
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFilesSelect}
                  className="hidden"
                />
              </div>

              {form.attachments.length > 0 && (
                <div className="mt-3 space-y-2">
                  {form.attachments.map((file, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-[#15171e] rounded-lg border border-slate-200 dark:border-[#3d3d48]">
                      <span className="text-sm text-slate-600 dark:text-[#d4d4d8] truncate">{file.name}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                        className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/10 text-red-400 hover:text-red-600 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Observações */}
            <div>
              <label className={labelClass}>Observações</label>
              <textarea
                value={form.notes}
                onChange={e => update('notes', e.target.value)}
                rows={4}
                placeholder="Observações adicionais..."
                className={`${inputClass} resize-none`}
              />
            </div>
          </section>
        </div>
      </div>

      {/* Footer fixo */}
      <div className="px-6 py-4 border-t border-slate-200 dark:border-[#3d3d48] bg-white dark:bg-[#08080b] flex items-center justify-end gap-3">
        <button
          onClick={() => router.push('/atendimento/cadastros/profissionais')}
          className="px-5 py-2.5 text-sm font-semibold text-slate-600 dark:text-[#d4d4d8] hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-lg shadow-teal-500/20 transition-all active:scale-95 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          SALVAR INFORMAÇÕES
        </button>
      </div>
    </div>
  );
}
