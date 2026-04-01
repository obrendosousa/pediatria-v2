'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Search, User, Save, Loader2, X } from 'lucide-react';
import { createSchemaClient } from '@/lib/supabase/schemaClient';
import { useToast } from '@/contexts/ToastContext';
import {
  simplifiedPatientSchema,
  type SimplifiedPatientFormData,
} from '@/schemas/simplifiedPatientSchema';
import type { AtendimentoPatient } from '@/types/atendimento-patient';

const supabase = createSchemaClient('atendimento');

// ── Helpers ──────────────────────────────────────────────────
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

function maskDate(value: string): string {
  const nums = value.replace(/\D/g, '').slice(0, 8);
  let out = nums.slice(0, 2);
  if (nums.length > 2) out += '/' + nums.slice(2, 4);
  if (nums.length > 4) out += '/' + nums.slice(4, 8);
  return out;
}

function parseDateDisplay(display: string): string {
  const nums = display.replace(/\D/g, '');
  if (nums.length !== 8) return '';
  return `${nums.slice(4, 8)}-${nums.slice(2, 4)}-${nums.slice(0, 2)}`;
}

function formatDateDisplay(iso: string): string {
  if (!iso || iso.length !== 10) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

type PatientSearchResult = {
  id: number;
  full_name: string;
  phone: string | null;
  cpf: string | null;
  patient_code: string | null;
};

// ── Props ────────────────────────────────────────────────────
interface SimplifiedPatientFormProps {
  patientId?: number | null;
  onPatientSaved?: (patientId: number, patientName: string) => void;
  embedded?: boolean;
  showSaveButton?: boolean;
}

// ── Componente ───────────────────────────────────────────────
export default function SimplifiedPatientForm({
  patientId,
  onPatientSaved,
  embedded = false,
  showSaveButton = true,
}: SimplifiedPatientFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [patientCode, setPatientCode] = useState('');
  const [dateDisplay, setDateDisplay] = useState('');
  const [loadedPatientId, setLoadedPatientId] = useState<number | null>(patientId || null);

  // Busca de paciente
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PatientSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<SimplifiedPatientFormData>({
    resolver: zodResolver(simplifiedPatientSchema),
    defaultValues: {
      full_name: '',
      sex: undefined,
      birth_date: '',
      zone: '',
      address_type: '',
      address_street: '',
      address_number: '',
      address_neighborhood: '',
      phone: '',
      email: '',
      cpf: '',
      active: true,
      notes: '',
    },
  });

  const watchBirthDate = watch('birth_date');

  // ── Busca de paciente existente (debounce) ──
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed || trimmed.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    const t = setTimeout(async () => {
      const escaped = trimmed.replace(/[%_\\]/g, '\\$&');
      const { data } = await supabase
        .from('patients')
        .select('id, full_name, phone, cpf, patient_code')
        .or(`full_name.ilike.%${escaped}%,phone.ilike.%${escaped}%,cpf.ilike.%${escaped}%`)
        .order('full_name')
        .limit(10);
      setSearchResults(data || []);
      setSearchLoading(false);
      setDropdownOpen(true);
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setDropdownOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Carregar paciente (por ID ou seleção) ──
  const loadPatient = useCallback(async (id: number) => {
    const { data: p } = await supabase
      .from('patients')
      .select('*')
      .eq('id', id)
      .single();
    if (!p) return;
    const patient = p as AtendimentoPatient;
    setLoadedPatientId(patient.id);
    setPatientCode(patient.patient_code || '');

    setValue('full_name', patient.full_name || '');
    setValue('sex', patient.sex || undefined);
    setValue('birth_date', patient.birth_date || '');
    setDateDisplay(patient.birth_date ? formatDateDisplay(patient.birth_date) : '');
    setValue('zone', patient.zone || '');
    setValue('address_type', patient.address_type || '');

    const addr = patient.address;
    if (addr) {
      setValue('address_street', addr.street || '');
      setValue('address_number', addr.number || '');
      setValue('address_neighborhood', addr.neighborhood || '');
    }

    setValue('phone', patient.phone || '');
    setValue('email', patient.email || '');
    setValue('cpf', patient.cpf || '');
    setValue('active', patient.active ?? true);
    setValue('notes', patient.notes || '');
  }, [setValue]);

  // Carregar se patientId passado como prop
  useEffect(() => {
    if (patientId) loadPatient(patientId);
  }, [patientId, loadPatient]);

  // Selecionar paciente da busca
  const handleSelectPatient = useCallback((p: PatientSearchResult) => {
    loadPatient(p.id);
    setSearchQuery('');
    setDropdownOpen(false);
  }, [loadPatient]);

  // Limpar seleção
  const handleClearPatient = useCallback(() => {
    setLoadedPatientId(null);
    setPatientCode('');
    setDateDisplay('');
    reset();
  }, [reset]);

  // ── Submit ──
  const onSubmit = async (data: SimplifiedPatientFormData) => {
    setIsSubmitting(true);
    try {
      const address = (data.address_street || data.address_number || data.address_neighborhood)
        ? {
            street: data.address_street || '',
            number: data.address_number || '',
            neighborhood: data.address_neighborhood || '',
          }
        : null;

      const payload: Record<string, unknown> = {
        full_name: data.full_name,
        sex: data.sex || null,
        birth_date: data.birth_date || null,
        zone: data.zone || null,
        address_type: data.address_type || null,
        address,
        phone: data.phone || null,
        email: data.email || null,
        cpf: data.cpf || null,
        active: data.active ?? true,
        notes: data.notes || null,
      };

      let savedId = loadedPatientId;

      if (loadedPatientId) {
        const { error } = await supabase
          .from('patients')
          .update(payload)
          .eq('id', loadedPatientId);
        if (error) throw error;
        toast.success('Paciente atualizado!');
      } else {
        const { data: inserted, error } = await supabase
          .from('patients')
          .insert(payload)
          .select('id, patient_code')
          .single();
        if (error) throw error;
        savedId = inserted.id;
        setLoadedPatientId(inserted.id);
        setPatientCode(inserted.patient_code || '');
        toast.success('Paciente cadastrado!');
      }

      if (savedId && onPatientSaved) {
        onPatientSaved(savedId, data.full_name);
      }
    } catch (err: unknown) {
      console.error('Erro ao salvar paciente:', err);
      const pgCode = (err as { code?: string })?.code;
      if (pgCode === '23505') {
        toast.error('CPF ja cadastrado para outro paciente.');
      } else {
        toast.error('Erro ao salvar: ' + (err instanceof Error ? err.message : 'Tente novamente.'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Expose submit para uso externo (embedded mode) ──
  const triggerSubmit = handleSubmit(onSubmit);

  // Attach ref ao form para embedded access
  const formRef = useRef<HTMLFormElement>(null);

  const inputCls = 'w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-[#252530] bg-white dark:bg-[#1a1a22] text-sm text-gray-800 dark:text-[#fafafa] placeholder-gray-400 dark:placeholder-[#71717a] focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 dark:focus:border-blue-400 outline-none transition-colors';
  const labelCls = 'block text-xs font-bold text-gray-500 dark:text-[#a1a1aa] uppercase mb-1';
  const errorCls = 'text-xs text-red-500 mt-0.5';

  const ZONE_OPTIONS = ['Urbana', 'Rural'];
  const ADDRESS_TYPE_OPTIONS = ['Rua', 'Avenida', 'Travessa', 'Alameda', 'Praça', 'Estrada', 'Rodovia', 'Outro'];

  return (
    <form
      ref={formRef}
      onSubmit={triggerSubmit}
      className={embedded ? 'space-y-4' : 'space-y-4 p-6'}
    >
      {/* ── Busca de paciente existente ── */}
      <div ref={searchRef} className="relative">
        <label className={labelCls}>Buscar Paciente Existente</label>
        {loadedPatientId ? (
          <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/30 rounded-lg">
            <User size={16} className="text-blue-600 dark:text-blue-400" />
            <div className="flex-1">
              <span className="text-sm font-medium text-gray-800 dark:text-[#fafafa]">
                {patientCode && <span className="text-gray-400 mr-2">{patientCode}</span>}
                {watch('full_name')}
              </span>
            </div>
            <button
              type="button"
              onClick={handleClearPatient}
              className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-full transition-colors"
            >
              <X size={14} className="text-red-500" />
            </button>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nome, telefone ou CPF..."
                className={`${inputCls} pl-9`}
              />
              {searchLoading && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />}
            </div>
            {dropdownOpen && searchResults.length > 0 && (
              <div className="absolute z-50 mt-1 w-full bg-white dark:bg-[#111118] border border-gray-200 dark:border-[#252530] rounded-lg shadow-xl max-h-48 overflow-y-auto">
                {searchResults.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectPatient(p)}
                    className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-white/5 border-b border-gray-100 dark:border-[#252530] last:border-0"
                  >
                    <span className="text-sm font-medium text-gray-800 dark:text-[#fafafa]">{p.full_name}</span>
                    <span className="text-xs text-gray-400 dark:text-[#71717a] ml-2">
                      {p.patient_code && `${p.patient_code} | `}
                      {p.phone || ''} {p.cpf ? `| CPF: ${p.cpf}` : ''}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="border-t border-gray-200 dark:border-[#252530] pt-4" />

      {/* ── Identificação ── */}
      <div className="grid grid-cols-12 gap-3">
        {/* Código */}
        <div className="col-span-2">
          <label className={labelCls}>Codigo</label>
          <input
            type="text"
            value={patientCode}
            disabled
            className={`${inputCls} bg-gray-100 dark:bg-[#252530] cursor-not-allowed`}
            placeholder="Auto"
          />
        </div>

        {/* Nome */}
        <div className="col-span-4">
          <label className={labelCls}>Nome *</label>
          <input {...register('full_name')} className={inputCls} placeholder="Nome completo" />
          {errors.full_name && <p className={errorCls}>{errors.full_name.message}</p>}
        </div>

        {/* Sexo */}
        <div className="col-span-2">
          <label className={labelCls}>Sexo</label>
          <select {...register('sex')} className={inputCls}>
            <option value="">--</option>
            <option value="M">M</option>
            <option value="F">F</option>
          </select>
        </div>

        {/* Data Nascimento */}
        <div className="col-span-2">
          <label className={labelCls}>Data Nasc.</label>
          <input
            type="text"
            value={dateDisplay}
            onChange={(e) => {
              const masked = maskDate(e.target.value);
              setDateDisplay(masked);
              const iso = parseDateDisplay(masked);
              setValue('birth_date', iso);
            }}
            className={inputCls}
            placeholder="DD/MM/AAAA"
            maxLength={10}
          />
        </div>

        {/* Idade */}
        <div className="col-span-2">
          <label className={labelCls}>Idade</label>
          <input
            type="text"
            value={watchBirthDate ? calcAge(watchBirthDate) : ''}
            disabled
            className={`${inputCls} bg-gray-100 dark:bg-[#252530] cursor-not-allowed`}
          />
        </div>
      </div>

      {/* ── Endereço ── */}
      <div className="grid grid-cols-12 gap-3">
        {/* Zona */}
        <div className="col-span-2">
          <label className={labelCls}>Zona</label>
          <select {...register('zone')} className={inputCls}>
            <option value="">--</option>
            {ZONE_OPTIONS.map(z => <option key={z} value={z}>{z}</option>)}
          </select>
        </div>

        {/* Tipo Logradouro */}
        <div className="col-span-2">
          <label className={labelCls}>Tipo Lograd.</label>
          <select {...register('address_type')} className={inputCls}>
            <option value="">--</option>
            {ADDRESS_TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {/* Logradouro */}
        <div className="col-span-4">
          <label className={labelCls}>Logradouro</label>
          <input {...register('address_street')} className={inputCls} placeholder="Nome da rua" />
        </div>

        {/* Número */}
        <div className="col-span-1">
          <label className={labelCls}>Num.</label>
          <input {...register('address_number')} className={inputCls} placeholder="Nº" />
        </div>

        {/* Bairro */}
        <div className="col-span-3">
          <label className={labelCls}>Bairro</label>
          <input {...register('address_neighborhood')} className={inputCls} placeholder="Bairro" />
        </div>
      </div>

      {/* ── Contato + Documentos ── */}
      <div className="grid grid-cols-12 gap-3">
        {/* Telefone */}
        <div className="col-span-3">
          <label className={labelCls}>Voz/SMS/WhatsApp</label>
          <input {...register('phone')} className={inputCls} placeholder="(99) 99999-9999" />
          {errors.phone && <p className={errorCls}>{errors.phone.message}</p>}
        </div>

        {/* Email */}
        <div className="col-span-4">
          <label className={labelCls}>Email</label>
          <input {...register('email')} type="email" className={inputCls} placeholder="email@exemplo.com" />
          {errors.email && <p className={errorCls}>{errors.email.message}</p>}
        </div>

        {/* CPF */}
        <div className="col-span-3">
          <label className={labelCls}>CPF</label>
          <input {...register('cpf')} className={inputCls} placeholder="000.000.000-00" />
        </div>

        {/* Situação */}
        <div className="col-span-2">
          <label className={labelCls}>Situacao</label>
          <select
            value={watch('active') ? 'true' : 'false'}
            onChange={(e) => setValue('active', e.target.value === 'true')}
            className={inputCls}
          >
            <option value="true">Ativo</option>
            <option value="false">Inativo</option>
          </select>
        </div>
      </div>

      {/* ── Observações ── */}
      <div>
        <label className={labelCls}>Observacoes</label>
        <textarea
          {...register('notes')}
          rows={3}
          className={`${inputCls} resize-none`}
          placeholder="Observacoes sobre o paciente..."
        />
      </div>

      {/* ── Botão Salvar ── */}
      {showSaveButton && (
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {loadedPatientId ? 'Atualizar Cadastro' : 'Cadastrar Paciente'}
          </button>
        </div>
      )}
    </form>
  );
}

// Export para uso externo do submit (embedded mode)
export type SimplifiedPatientFormRef = {
  submit: () => Promise<void>;
};
