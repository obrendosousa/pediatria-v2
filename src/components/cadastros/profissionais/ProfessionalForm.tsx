'use client';

import { useState, useCallback, useRef } from 'react';
import {
  ArrowLeft, Save, Loader2, User, Phone, Briefcase,
  FileText, Upload, X, ChevronDown,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/contexts/ToastContext';
import AddressCepLookup, { EMPTY_ADDRESS } from '@/components/cadastros/shared/AddressCepLookup';
import type { AddressData } from '@/components/cadastros/shared/AddressCepLookup';
import MaskedInput from '@/components/cadastros/shared/MaskedInput';
import type { Professional } from '@/types/cadastros';

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

const SCHEDULE_ACCESS_OPTIONS = [
  { value: 'view_appointment', label: 'Visualizar agendamento' },
  { value: 'open_record', label: 'Abrir prontuário' },
] as const;

const UF_OPTIONS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
  'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
] as const;

// --- Tipos ---

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
  schedule_access: string;
  is_admin: boolean;
  restrict_prices: boolean;
  has_schedule: boolean;
  restrict_schedule: boolean;
  attachments: File[];
  notes: string;
}

const EMPTY_FORM: ProfessionalFormData = {
  name: '', sex: '', birth_date: '', marital_status: '',
  cpf: '', rg: '',
  address: { ...EMPTY_ADDRESS },
  email: '', phone: '', mobile: '', whatsapp: '',
  professional_type: '', specialty: '',
  registration_state: '', registration_type: '', registration_number: '',
  schedule_access: 'view_appointment',
  is_admin: false, restrict_prices: false, has_schedule: false, restrict_schedule: false,
  attachments: [],
  notes: '',
};

interface ProfessionalFormProps {
  initialData?: Professional | null;
  onSubmit: (data: ProfessionalFormData) => Promise<void>;
  title: string;
  subtitle: string;
}

// --- Helpers ---

const inputClass = 'w-full px-3 py-2.5 text-sm border border-slate-200 dark:border-gray-700 rounded-xl bg-white dark:bg-[#2a2d36] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-400 disabled:opacity-50';
const selectClass = `${inputClass} appearance-none cursor-pointer`;
const labelClass = 'text-xs font-bold text-slate-500 dark:text-gray-400 mb-1.5 ml-1 block uppercase tracking-wider';

function RequiredBadge() {
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 ml-1">
      Obrigatório
    </span>
  );
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
    schedule_access: p.schedule_access,
    is_admin: p.is_admin,
    restrict_prices: p.restrict_prices,
    has_schedule: p.has_schedule,
    restrict_schedule: p.restrict_schedule,
    attachments: [],
    notes: p.notes || '',
  };
}

// --- Componente ---

export default function ProfessionalForm({ initialData, onSubmit, title, subtitle }: ProfessionalFormProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [form, setForm] = useState<ProfessionalFormData>(
    initialData ? professionalToForm(initialData) : { ...EMPTY_FORM },
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (!form.email.trim()) errs.email = 'E-mail é obrigatório.';
    if (!form.professional_type) errs.professional_type = 'Tipo profissional é obrigatório.';
    if (!form.registration_state) errs.registration_state = 'Estado de registro é obrigatório.';
    if (!form.registration_type) errs.registration_type = 'Tipo de registro é obrigatório.';
    if (!form.registration_number.trim()) errs.registration_number = 'Registro profissional é obrigatório.';
    if (!form.schedule_access) errs.schedule_access = 'Listagem dos agendamentos é obrigatório.';
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

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-[#15171e]">
      {/* Header */}
      <div className="px-6 py-4 flex items-center gap-4 border-b border-slate-200 dark:border-gray-700 bg-white dark:bg-[#1e2028]">
        <button
          onClick={() => router.push('/atendimento/cadastros/profissionais')}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-500" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-slate-800 dark:text-gray-100 flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-teal-600" />
            {title}
          </h1>
          <p className="text-xs text-slate-400 dark:text-gray-500">{subtitle}</p>
        </div>
      </div>

      {/* Conteúdo scrollável */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* ─── Seção 1: Informações Básicas ─── */}
          <section className="bg-white dark:bg-[#1e2028] rounded-xl border border-slate-200 dark:border-gray-700 p-6 space-y-5">
            <h2 className="text-sm font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wide flex items-center gap-2">
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
          <section className="bg-white dark:bg-[#1e2028] rounded-xl border border-slate-200 dark:border-gray-700 p-6">
            <AddressCepLookup
              value={form.address}
              onChange={(addr) => update('address', addr)}
            />
          </section>

          {/* ─── Seção 3: Informações de Contato ─── */}
          <section className="bg-white dark:bg-[#1e2028] rounded-xl border border-slate-200 dark:border-gray-700 p-6 space-y-5">
            <h2 className="text-sm font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wide flex items-center gap-2">
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
          <section className="bg-white dark:bg-[#1e2028] rounded-xl border border-slate-200 dark:border-gray-700 p-6 space-y-5">
            <h2 className="text-sm font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wide flex items-center gap-2">
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
                    onChange={e => update('professional_type', e.target.value)}
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

              {/* Listagem agendamentos */}
              <div className="col-span-12 md:col-span-6">
                <label className={labelClass}>Listagem dos agendamentos <RequiredBadge /></label>
                <div className="relative">
                  <select
                    value={form.schedule_access}
                    onChange={e => update('schedule_access', e.target.value)}
                    className={`${selectClass} ${errors.schedule_access ? 'border-red-300 dark:border-red-700' : ''}`}
                  >
                    {SCHEDULE_ACCESS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
                {errors.schedule_access && <p className="mt-1 text-xs text-red-500">{errors.schedule_access}</p>}
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
                <div className="flex flex-wrap gap-6 mt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.restrict_prices}
                      onChange={e => update('restrict_prices', e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                    />
                    <span className="text-sm text-slate-700 dark:text-gray-200">Restringir preços</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.has_schedule}
                      onChange={e => update('has_schedule', e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                    />
                    <span className="text-sm text-slate-700 dark:text-gray-200">Possui agenda</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.restrict_schedule}
                      onChange={e => update('restrict_schedule', e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                    />
                    <span className="text-sm text-slate-700 dark:text-gray-200">Restringir agenda</span>
                  </label>
                </div>
              </div>
            </div>
          </section>

          {/* ─── Seção 5: Informações Complementares ─── */}
          <section className="bg-white dark:bg-[#1e2028] rounded-xl border border-slate-200 dark:border-gray-700 p-6 space-y-5">
            <h2 className="text-sm font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wide flex items-center gap-2">
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
                className="border-2 border-dashed border-slate-200 dark:border-gray-700 rounded-xl p-8 text-center cursor-pointer hover:border-teal-400 dark:hover:border-teal-600 transition-colors"
              >
                <Upload className="w-8 h-8 text-slate-300 dark:text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-slate-400 dark:text-gray-500">
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
                    <div key={i} className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-[#15171e] rounded-lg border border-slate-200 dark:border-gray-700">
                      <span className="text-sm text-slate-600 dark:text-gray-300 truncate">{file.name}</span>
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
      <div className="px-6 py-4 border-t border-slate-200 dark:border-gray-700 bg-white dark:bg-[#1e2028] flex items-center justify-end gap-3">
        <button
          onClick={() => router.push('/atendimento/cadastros/profissionais')}
          className="px-5 py-2.5 text-sm font-semibold text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors"
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
