'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { createSchemaClient } from '@/lib/supabase/schemaClient';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/contexts/ToastContext';
import {
  X, Search, Calendar, Clock, Stethoscope, Loader2,
  ChevronDown, ClipboardList, Save, Ticket
} from 'lucide-react';

const supabaseAtendimento = createSchemaClient('atendimento');
const pubSupabase = createClient();

// ── Tipos ──────────────────────────────────────────────────
type DoctorOption = { id: number; name: string; isProfessionalOnly?: boolean; professionalUuid?: string };

type ProcedureOption = {
  id: string;
  name: string;
  procedure_type: string | null;
  duration_minutes: number | null;
  fee_value: number | null;
  total_value: number | null;
};

type ProtocolOption = {
  id: string;
  name: string;
  total_value: number;
};

// ── Helpers ────────────────────────────────────────────────
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

// ── Props ──────────────────────────────────────────────────
interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialDate?: string;
  initialTime?: string;
}

// ── Componente ─────────────────────────────────────────────
export default function SchedulingModal({ isOpen, onClose, onSuccess, initialDate, initialTime }: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Step control
  const [step, setStep] = useState<1 | 2>(1);

  // Patient data (from SimplifiedPatientForm inline)
  const [patientId, setPatientId] = useState<number | null>(null);
  const [patientCode, setPatientCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [sex, setSex] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [dateDisplayBirth, setDateDisplayBirth] = useState('');
  const [zone, setZone] = useState('');
  const [addressType, setAddressType] = useState('');
  const [addressStreet, setAddressStreet] = useState('');
  const [addressNumber, setAddressNumber] = useState('');
  const [addressNeighborhood, setAddressNeighborhood] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [cpf, setCpf] = useState('');
  const [active, setActive] = useState(true);
  const [notes, setNotes] = useState('');

  // Patient search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: number; full_name: string; phone: string | null; cpf: string | null; patient_code: string | null }[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Appointment data
  const [doctorId, setDoctorId] = useState<number | null>(null);
  const [appointmentDate, setAppointmentDate] = useState('');
  const [dateDisplay, setDateDisplay] = useState('');
  const [timeStart, setTimeStart] = useState('');
  const [timeEnd, setTimeEnd] = useState('');
  const appointmentSubtype = 'simples';
  const [selectedProcedures, setSelectedProcedures] = useState<ProcedureOption[]>([]);
  const [generateTicket, setGenerateTicket] = useState(true);

  // Profissional + procedimentos
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [selectedProfessionalUuid, setSelectedProfessionalUuid] = useState<string | null>(null);
  const [profProcedures, setProfProcedures] = useState<ProcedureOption[]>([]);
  const [globalProcedures, setGlobalProcedures] = useState<ProcedureOption[]>([]);
  const [procFilter, setProcFilter] = useState('');
  const [procLoading, setProcLoading] = useState(false);
  const [protocols, setProtocols] = useState<ProtocolOption[]>([]);

  // ── Animação ──
  useEffect(() => {
    if (isOpen) setTimeout(() => setShowModal(true), 10);
    else { setShowModal(false); setStep(1); }
  }, [isOpen]);

  // ── Init ao abrir ──
  useEffect(() => {
    if (!isOpen) return;
    // Reset
    setPatientId(null);
    setPatientCode('');
    setFullName('');
    setSex('');
    setBirthDate('');
    setDateDisplayBirth('');
    setZone('');
    setAddressType('');
    setAddressStreet('');
    setAddressNumber('');
    setAddressNeighborhood('');
    setPhone('');
    setEmail('');
    setCpf('');
    setActive(true);
    setNotes('');
    setSearchQuery('');
    setStep(1);
    setSelectedProcedures([]);
    setGenerateTicket(true);
    setProcFilter('');
    setSelectedProfessionalUuid(null);
    setDoctorId(null);
    setTimeEnd('');

    const today = new Date().toISOString().split('T')[0];
    const d = initialDate || today;
    setAppointmentDate(d);
    setDateDisplay(formatDateDisplay(d));
    setTimeStart(initialTime || '09:00');

    // Carregar doctors + protocols + procedimentos globais
    (async () => {
      const [doctorsRes, profsRes, protocolsRes, proceduresRes] = await Promise.all([
        pubSupabase.from('doctors').select('id, name, professional_id').eq('active', true).order('name'),
        supabaseAtendimento.from('professionals').select('id, name').eq('has_schedule', true).eq('status', 'active').order('name'),
        supabaseAtendimento.from('clinical_protocols').select('id, name, total_value').eq('status', 'active').order('name'),
        supabaseAtendimento.from('procedures').select('id, name, procedure_type, duration_minutes, fee_value, total_value').eq('status', 'active').order('name'),
      ]);
      const doctorsData = (doctorsRes.data || []) as { id: number; name: string; professional_id: string | null }[];
      const list: DoctorOption[] = doctorsData.map(d => ({
        id: d.id, name: d.name, professionalUuid: d.professional_id || undefined,
      }));
      if (profsRes.data) {
        const linkedIds = new Set(doctorsData.map(d => d.professional_id).filter(Boolean));
        for (const prof of profsRes.data) {
          if (!linkedIds.has(prof.id)) {
            list.push({ id: prof.id, name: prof.name, isProfessionalOnly: true, professionalUuid: prof.id });
          }
        }
      }
      setDoctors(list);
      if (protocolsRes.data) setProtocols(protocolsRes.data);
      setGlobalProcedures((proceduresRes.data || []).map((p: { id: string; name: string; procedure_type: string; duration_minutes: number; fee_value: number; total_value: number }) => ({
        id: p.id, name: p.name, procedure_type: p.procedure_type,
        duration_minutes: p.duration_minutes, fee_value: p.fee_value, total_value: p.total_value,
      })));
    })();
  }, [isOpen, initialDate, initialTime]);

  // ── Busca paciente (debounce) ──
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed || trimmed.length < 2) { setSearchResults([]); return; }
    setSearchLoading(true);
    const t = setTimeout(async () => {
      const escaped = trimmed.replace(/[%_\\]/g, '\\$&');
      const { data } = await supabaseAtendimento
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

  // Close dropdown outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setDropdownOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Carregar procedimentos do profissional ──
  useEffect(() => {
    if (!selectedProfessionalUuid) { setProfProcedures([]); return; }
    setProcLoading(true);
    (async () => {
      const { data } = await supabaseAtendimento
        .from('professional_procedures')
        .select('id, name, procedure_type, duration_minutes, value')
        .eq('professional_id', selectedProfessionalUuid)
        .eq('status', 'active')
        .order('name');
      const mapped: ProcedureOption[] = (data || []).map((p: { id: string; name: string; procedure_type: string; duration_minutes: number; value: number }) => ({
        id: p.id, name: p.name, procedure_type: p.procedure_type,
        duration_minutes: p.duration_minutes, fee_value: p.value, total_value: p.value,
      }));
      setProfProcedures(mapped);
      setProcLoading(false);
    })();
  }, [selectedProfessionalUuid]);

  // Procedimentos filtrados: profissional primeiro, depois globais (sem duplicatas)
  const filteredProcedures = useMemo(() => {
    const selectedIds = new Set(selectedProcedures.map(p => p.id));
    const profIds = new Set(profProcedures.map(p => p.id));
    const merged = [
      ...profProcedures,
      ...globalProcedures.filter(p => !profIds.has(p.id)),
    ].filter(p => !selectedIds.has(p.id));
    const q = procFilter.trim().toLowerCase();
    return q ? merged.filter(p => p.name.toLowerCase().includes(q)) : merged;
  }, [profProcedures, globalProcedures, selectedProcedures, procFilter]);

  const proceduresTotal = useMemo(() =>
    selectedProcedures.reduce((s, p) => s + (p.total_value || p.fee_value || 0), 0),
  [selectedProcedures]);

  // ── Selecionar paciente da busca ──
  const handleSelectPatient = useCallback(async (p: { id: number; full_name: string }) => {
    const { data } = await supabaseAtendimento
      .from('patients')
      .select('*')
      .eq('id', p.id)
      .single();
    if (!data) return;
    setPatientId(data.id);
    setPatientCode(data.patient_code || '');
    setFullName(data.full_name || '');
    setSex(data.sex || '');
    setBirthDate(data.birth_date || '');
    setDateDisplayBirth(data.birth_date ? formatDateDisplay(data.birth_date) : '');
    setZone(data.zone || '');
    setAddressType(data.address_type || '');
    const addr = data.address as { street?: string; number?: string; neighborhood?: string } | null;
    setAddressStreet(addr?.street || '');
    setAddressNumber(addr?.number || '');
    setAddressNeighborhood(addr?.neighborhood || '');
    setPhone(data.phone || '');
    setEmail(data.email || '');
    setCpf(data.cpf || '');
    setActive(data.active ?? true);
    setNotes(data.notes || '');
    setSearchQuery('');
    setDropdownOpen(false);
  }, []);

  const handleClearPatient = useCallback(() => {
    setPatientId(null);
    setPatientCode('');
    setFullName('');
    setSex('');
    setBirthDate('');
    setDateDisplayBirth('');
    setZone('');
    setAddressType('');
    setAddressStreet('');
    setAddressNumber('');
    setAddressNeighborhood('');
    setPhone('');
    setEmail('');
    setCpf('');
    setActive(true);
    setNotes('');
  }, []);

  // ── Aplicar protocolo ──
  const applyProtocol = useCallback(async (protocolId: string) => {
    const { data: items } = await supabaseAtendimento
      .from('clinical_protocol_items')
      .select('procedures(id, name, procedure_type, duration_minutes, fee_value, total_value)')
      .eq('protocol_id', protocolId)
      .order('sort_order');
    if (items) {
      const procs: ProcedureOption[] = (items as unknown as Array<{ procedures: ProcedureOption | null }>)
        .map(it => it.procedures)
        .filter((p): p is ProcedureOption => p !== null);
      setSelectedProcedures(procs);
    }
  }, []);

  // ── Validação e submit ──
  const handleNext = () => {
    if (!fullName.trim()) {
      toast.error('Nome do paciente é obrigatório');
      return;
    }
    setStep(2);
  };

  const handleSubmit = async () => {
    if (!fullName.trim()) { toast.error('Nome do paciente é obrigatório'); return; }
    if (!appointmentDate) { toast.error('Data é obrigatória'); return; }

    setSaving(true);
    try {
      const address = (addressStreet || addressNumber || addressNeighborhood)
        ? { street: addressStreet, number: addressNumber, neighborhood: addressNeighborhood }
        : null;

      const res = await fetch('/api/atendimento/scheduling', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient: {
            id: patientId,
            full_name: fullName,
            sex: sex || null,
            birth_date: birthDate || null,
            zone: zone || null,
            address_type: addressType || null,
            address_street: address?.street || null,
            address_number: address?.number || null,
            address_neighborhood: address?.neighborhood || null,
            phone: phone || null,
            email: email || null,
            cpf: cpf || null,
            active,
            notes: notes || null,
          },
          appointment: {
            doctor_id: doctorId,
            date: appointmentDate,
            time: timeStart,
            end_time: timeEnd || null,
            procedures: selectedProcedures.map(p => p.name),
            appointment_subtype: appointmentSubtype,
          },
          generate_ticket: generateTicket,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao criar agendamento');
      }

      toast.success(generateTicket
        ? 'Agendamento criado e senha gerada!'
        : 'Agendamento criado com sucesso!');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const inputCls = 'w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-[#252530] bg-white dark:bg-[#1a1a22] text-sm text-gray-800 dark:text-[#fafafa] placeholder-gray-400 dark:placeholder-[#71717a] focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 dark:focus:border-blue-400 outline-none transition-colors';
  const labelCls = 'block text-xs font-bold text-gray-500 dark:text-[#a1a1aa] uppercase mb-1';

  const ZONE_OPTIONS = ['Urbana', 'Rural'];
  const ADDRESS_TYPE_OPTIONS = ['Rua', 'Avenida', 'Travessa', 'Alameda', 'Praça', 'Estrada', 'Rodovia', 'Outro'];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in">
      <div className={`bg-white dark:bg-[#111118] rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh] transition-all duration-300 ${showModal ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-[#252530] bg-gray-50 dark:bg-[#1a1a22] flex justify-between items-center shrink-0">
          <h3 className="font-bold text-gray-800 dark:text-[#fafafa] flex items-center gap-2">
            <Calendar className="text-blue-600 dark:text-blue-400" size={20} />
            Novo Agendamento
            <span className="text-xs font-normal text-gray-400 ml-2">
              Etapa {step}/2 — {step === 1 ? 'Cadastro do Paciente' : 'Servico/Procedimento'}
            </span>
          </h3>
          <button type="button" onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition-colors">
            <X size={20} className="text-gray-400 dark:text-[#71717a]" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-5">

          {step === 1 && (
            <>
              {/* ── STEP 1: Cadastro do Paciente ── */}

              {/* Busca */}
              <div ref={searchRef} className="relative">
                <label className={labelCls}>Buscar Paciente Existente</label>
                {patientId ? (
                  <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/30 rounded-lg">
                    <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-sm">
                      {fullName.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <span className="text-sm font-medium text-gray-800 dark:text-[#fafafa]">
                        {patientCode && <span className="text-gray-400 mr-2">{patientCode}</span>}
                        {fullName}
                      </span>
                    </div>
                    <button type="button" onClick={handleClearPatient} className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-full transition-colors">
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

              {/* Campos do cadastro */}
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-2">
                  <label className={labelCls}>Codigo</label>
                  <input type="text" value={patientCode} disabled className={`${inputCls} bg-gray-100 dark:bg-[#252530] cursor-not-allowed`} placeholder="Auto" />
                </div>
                <div className="col-span-4">
                  <label className={labelCls}>Nome *</label>
                  <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} className={inputCls} placeholder="Nome completo" />
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Sexo</label>
                  <select value={sex} onChange={e => setSex(e.target.value)} className={inputCls}>
                    <option value="">--</option>
                    <option value="M">M</option>
                    <option value="F">F</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Data Nasc.</label>
                  <input
                    type="text"
                    value={dateDisplayBirth}
                    onChange={(e) => {
                      const masked = maskDate(e.target.value);
                      setDateDisplayBirth(masked);
                      setBirthDate(parseDateDisplay(masked));
                    }}
                    className={inputCls} placeholder="DD/MM/AAAA" maxLength={10}
                  />
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Idade</label>
                  <input type="text" value={birthDate ? calcAge(birthDate) : ''} disabled className={`${inputCls} bg-gray-100 dark:bg-[#252530] cursor-not-allowed`} />
                </div>
              </div>

              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-2">
                  <label className={labelCls}>Zona</label>
                  <select value={zone} onChange={e => setZone(e.target.value)} className={inputCls}>
                    <option value="">--</option>
                    {ZONE_OPTIONS.map(z => <option key={z} value={z}>{z}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Tipo Lograd.</label>
                  <select value={addressType} onChange={e => setAddressType(e.target.value)} className={inputCls}>
                    <option value="">--</option>
                    {ADDRESS_TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="col-span-4">
                  <label className={labelCls}>Logradouro</label>
                  <input type="text" value={addressStreet} onChange={e => setAddressStreet(e.target.value)} className={inputCls} placeholder="Nome da rua" />
                </div>
                <div className="col-span-1">
                  <label className={labelCls}>Num.</label>
                  <input type="text" value={addressNumber} onChange={e => setAddressNumber(e.target.value)} className={inputCls} placeholder="Nº" />
                </div>
                <div className="col-span-3">
                  <label className={labelCls}>Bairro</label>
                  <input type="text" value={addressNeighborhood} onChange={e => setAddressNeighborhood(e.target.value)} className={inputCls} placeholder="Bairro" />
                </div>
              </div>

              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-3">
                  <label className={labelCls}>Voz/SMS/WhatsApp</label>
                  <input type="text" value={phone} onChange={e => setPhone(e.target.value)} className={inputCls} placeholder="(99) 99999-9999" />
                </div>
                <div className="col-span-4">
                  <label className={labelCls}>Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} placeholder="email@exemplo.com" />
                </div>
                <div className="col-span-3">
                  <label className={labelCls}>CPF</label>
                  <input type="text" value={cpf} onChange={e => setCpf(e.target.value)} className={inputCls} placeholder="000.000.000-00" />
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Situacao</label>
                  <select value={active ? 'true' : 'false'} onChange={e => setActive(e.target.value === 'true')} className={inputCls}>
                    <option value="true">Ativo</option>
                    <option value="false">Inativo</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={labelCls}>Observacoes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={`${inputCls} resize-none`} placeholder="Observacoes..." />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              {/* ── STEP 2: Serviço/Procedimento ── */}

              {/* Resumo do paciente */}
              <div className="p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/30 rounded-lg flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-sm">
                  {fullName.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800 dark:text-[#fafafa]">{fullName}</p>
                  <p className="text-xs text-gray-400">{[phone, birthDate ? calcAge(birthDate) : null].filter(Boolean).join(' · ')}</p>
                </div>
                <button type="button" onClick={() => setStep(1)} className="ml-auto text-xs text-blue-600 hover:underline">Editar cadastro</button>
              </div>

              {/* Profissional */}
              <div>
                <label className={labelCls}>Profissional</label>
                <div className="relative">
                  <Stethoscope className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                  <select
                    value={doctorId ?? ''}
                    onChange={e => {
                      const val = e.target.value ? Number(e.target.value) : null;
                      setDoctorId(val);
                      const doc = val ? doctors.find(d => d.id === val) : null;
                      setSelectedProfessionalUuid(doc?.professionalUuid || null);
                      setSelectedProcedures([]);
                      setProcFilter('');
                    }}
                    className={`${inputCls} pl-9 appearance-none`}
                  >
                    <option value="">Selecione o profissional...</option>
                    {doctors.map(d => (
                      <option key={d.id} value={d.id}>{d.name}{d.isProfessionalOnly ? ' (sem vinculo medico)' : ''}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-3 pointer-events-none" />
                </div>
              </div>

              {/* Data + Hora */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Data *</label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      value={dateDisplay}
                      onChange={e => {
                        const masked = maskDate(e.target.value);
                        setDateDisplay(masked);
                        const iso = parseDateDisplay(masked);
                        if (iso) setAppointmentDate(iso);
                      }}
                      placeholder="DD/MM/AAAA" maxLength={10}
                      className={`${inputCls} pl-9`}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Hora Inicial</label>
                  <div className="relative">
                    <Clock className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                    <input type="time" value={timeStart} onChange={e => setTimeStart(e.target.value)} className={`${inputCls} pl-9`} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Hora Final</label>
                  <div className="relative">
                    <Clock className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                    <input type="time" value={timeEnd} onChange={e => setTimeEnd(e.target.value)} className={`${inputCls} pl-9`} />
                  </div>
                </div>
              </div>


              {/* Protocolo */}
              {protocols.length > 0 && (
                <div>
                  <label className={labelCls}>Protocolo Clinico</label>
                  <div className="relative">
                    <ClipboardList className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                    <select
                      onChange={e => { if (e.target.value) applyProtocol(e.target.value); e.target.value = ''; }}
                      className={`${inputCls} pl-9 appearance-none`}
                    >
                      <option value="">Aplicar protocolo...</option>
                      {protocols.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} {p.total_value > 0 ? `— ${p.total_value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` : ''}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-3 pointer-events-none" />
                  </div>
                </div>
              )}

              {/* Procedimentos */}
              <div className="space-y-3">
                <label className={labelCls}>Procedimentos</label>

                {/* Selecionados */}
                {selectedProcedures.length > 0 && (
                  <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/30 rounded-lg overflow-hidden">
                    <div className="px-3 py-2 border-b border-emerald-200 dark:border-emerald-800/30">
                      <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Selecionados</span>
                    </div>
                    <div className="divide-y divide-emerald-100 dark:divide-emerald-900/20">
                      {selectedProcedures.map(p => (
                        <div key={p.id} className="flex items-center px-3 py-2">
                          <span className="text-sm text-slate-800 dark:text-gray-200 flex-1 min-w-0 truncate">{p.name}</span>
                          <span className="text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400 ml-3 shrink-0">
                            {(p.total_value || p.fee_value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </span>
                          <button type="button" onClick={() => setSelectedProcedures(prev => prev.filter(x => x.id !== p.id))} className="ml-2 p-0.5 rounded-full text-emerald-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="px-3 py-2 border-t border-emerald-300 dark:border-emerald-800/40 bg-emerald-100/50 dark:bg-emerald-900/20 flex justify-between items-center">
                      <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">Total</span>
                      <span className="text-sm font-mono font-bold text-emerald-700 dark:text-emerald-300">
                        {proceduresTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                  </div>
                )}

                {/* Lista disponível */}
                {procLoading ? (
                  <div className="p-4 flex items-center justify-center gap-2 text-sm text-slate-500 border border-slate-200 dark:border-[#252530] rounded-lg">
                    <Loader2 size={16} className="animate-spin" /> Carregando...
                  </div>
                ) : (
                  <div className="border border-slate-200 dark:border-[#252530] rounded-lg overflow-hidden">
                    <div className="relative border-b border-slate-200 dark:border-[#252530]">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                      <input
                        type="text"
                        value={procFilter}
                        onChange={e => setProcFilter(e.target.value)}
                        placeholder="Buscar procedimento..."
                        className="w-full pl-8 pr-3 py-2 text-sm bg-slate-50 dark:bg-[#1a1a22] text-gray-700 dark:text-gray-200 focus:outline-none placeholder:text-slate-400"
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto scrollbar-visible">
                      {filteredProcedures.length === 0 ? (
                        <div className="p-3 text-center text-xs text-slate-400">
                          {procFilter ? 'Nenhum resultado' : 'Todos adicionados'}
                        </div>
                      ) : (
                        filteredProcedures.map(proc => {
                          const isFromProfessional = profProcedures.some(p => p.id === proc.id);
                          return (
                            <button
                              key={proc.id}
                              type="button"
                              onClick={() => setSelectedProcedures(prev => [...prev, proc])}
                              className="w-full text-left px-4 py-2.5 border-b border-slate-100 dark:border-[#1e1e28] last:border-0 flex items-center gap-3 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors group"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-sm text-slate-800 dark:text-gray-200">{proc.name}</p>
                                <p className="text-[10px] text-slate-400">
                                  {isFromProfessional && <span className="text-blue-500 font-medium">Do profissional · </span>}
                                  {proc.procedure_type} {proc.duration_minutes ? `· ${proc.duration_minutes}min` : ''}
                                </p>
                              </div>
                              <span className="text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
                                {(proc.total_value || proc.fee_value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </span>
                              <span className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity text-lg leading-none">+</span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Gerar senha */}
              <label className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={generateTicket}
                  onChange={e => setGenerateTicket(e.target.checked)}
                  className="w-4 h-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                />
                <Ticket size={16} className="text-amber-600" />
                <span className="text-sm text-amber-800 dark:text-amber-300 font-medium">
                  Gerar senha automaticamente
                </span>
              </label>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-[#252530] bg-gray-50 dark:bg-[#1a1a22] flex justify-between items-center shrink-0">
          {step === 2 && (
            <button type="button" onClick={() => setStep(1)} className="px-4 py-2 text-sm text-gray-600 dark:text-[#a1a1aa] hover:bg-gray-200 dark:hover:bg-white/10 rounded-lg transition-colors">
              Voltar
            </button>
          )}
          <div className="ml-auto flex gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-[#a1a1aa] hover:bg-gray-200 dark:hover:bg-white/10 rounded-lg transition-colors">
              Cancelar
            </button>
            {step === 1 ? (
              <button
                type="button"
                onClick={handleNext}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                Proximo
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Criar Agendamento
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Calc age helper
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
