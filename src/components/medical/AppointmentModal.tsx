'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  X, User, Phone, Calendar, Clock, FileText, Sparkles, Loader2, Save,
  Wallet, Cake, Percent, Tag
} from 'lucide-react';
import { computeDiscountAmount, effectiveAmount, type DiscountType } from '@/utils/discountUtils';
import { createClient } from '@/lib/supabase/client';
const supabase = createClient();
import { linkPatientByPhone, createBasicPatientFromAppointment } from '@/utils/patientRelations';
import { saveAppointmentDateTime } from '@/utils/dateUtils';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import PatientSearchSelect, { type PatientSearchOption } from '@/components/PatientSearchSelect';
import type { Appointment } from '@/types/medical';
import { type FamilyMember, syncFlatColumnsFromFamilyMembers, flatFieldsToFamilyMembers } from '@/constants/guardianRelationships';
import FamilyMembersField from '@/components/shared/FamilyMembersField';

export interface PreScheduleData {
  patientName: string | null;
  motherName: string | null;
  fatherName: string | null;
  phone: string | null;
  birthDate?: string | null; // YYYY-MM-DD
  address?: string | null;
  suggestedDate: string; // YYYY-MM-DD
  suggestedTime: string; // HH:MM
  reason: string;
  patientSex?: 'M' | 'F' | null;
  appointmentType?: 'consulta' | 'retorno' | null;
  guardians?: FamilyMember[];
}

interface AppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: PreScheduleData;
  onSave?: () => void;
  chatPhone?: string;
  chatId?: number;
  conversationSummary?: string;
}

export default function AppointmentModal({
  isOpen,
  onClose,
  initialData,
  onSave,
  chatPhone,
  chatId,
  conversationSummary
}: AppointmentModalProps) {
  const { toast } = useToast();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [doctors, setDoctors] = useState<Array<{ id: number; name: string }>>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<number | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<PatientSearchOption | null>(null);
  const [guardians, setGuardians] = useState<FamilyMember[]>([]);

  const [formData, setFormData] = useState({
    patientName: '',
    phone: '',
    date: '',
    dateDisplay: '', // Formato DD/MM/YYYY para exibição
    time: '',
    reason: '',
    patientSex: '' as 'M' | 'F' | '',
    birthDateDisplay: '',
    birthDate: '', // YYYY-MM-DD
    appointmentType: '' as 'consulta' | 'retorno' | '',
    // Campos Financeiros (Strings para controle de input com máscara)
    totalAmount: '',
    paidAmount: '',
    // Desconto
    discountType: '%' as DiscountType,
    discountValue: ''
  });
  const [showDiscount, setShowDiscount] = useState(false);

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

  // Funções de formatação de moeda
  const formatCurrency = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    const amount = Number(numbers) / 100;
    return amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const parseCurrency = (value: string) => {
    if (!value) return 0;
    return Number(value.replace(/\./g, '').replace(',', '.'));
  };

  const handleMoneyInput = (field: 'totalAmount' | 'paidAmount', value: string) => {
    const rawValue = value.replace(/\D/g, '');
    if (!rawValue) {
      setFormData(prev => ({ ...prev, [field]: '' }));
      return;
    }
    setFormData(prev => ({ ...prev, [field]: formatCurrency(rawValue) }));
  };

  // Função genérica para formatar DD/MM/AAAA enquanto digita
  const handleDateMaskedInput = (value: string, displayField: 'dateDisplay' | 'birthDateDisplay', isoField: 'date' | 'birthDate') => {
    const numbers = value.replace(/\D/g, '');
    const limited = numbers.slice(0, 8);
    let formatted = '';
    if (limited.length > 0) {
      formatted = limited.slice(0, 2);
      if (limited.length > 2) formatted += '/' + limited.slice(2, 4);
      if (limited.length > 4) formatted += '/' + limited.slice(4, 8);
    }
    setFormData(prev => ({
      ...prev,
      [displayField]: formatted,
      [isoField]: formatDateToISO(formatted)
    }));
  };

  const fetchDoctors = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('doctors')
        .select('id, name')
        .eq('active', true)
        .order('name');

      if (error) throw error;

      if (data && data.length > 0) {
        setDoctors(data);

        if (profile?.doctor_id) {
          const doctorUser = data.find(d => d.id === profile.doctor_id);
          if (doctorUser) {
            setSelectedDoctorId(doctorUser.id);
          } else {
            setSelectedDoctorId(data[0].id);
          }
        } else {
          setSelectedDoctorId(data[0].id);
        }
      }
    } catch (err) {
      console.error('Erro ao carregar médicos:', err);
    }
  }, [profile?.doctor_id]);

  // Carregar médicos e preencher formulário quando modal abrir
  useEffect(() => {
    if (isOpen) {
      fetchDoctors();

      const today = new Date().toISOString().split('T')[0];
      const defaultTime = '09:00';
      const initialDate = initialData?.suggestedDate || today;

      const initialBirthDate = initialData?.birthDate || '';

      // Inicializar guardians a partir de initialData (IA ou edição)
      const initialGuardians: FamilyMember[] = initialData?.guardians || flatFieldsToFamilyMembers({
        mother_name: initialData?.motherName,
        father_name: initialData?.fatherName,
      });
      setGuardians(initialGuardians);

      setFormData({
        patientName: initialData?.patientName || '',
        phone: chatPhone || initialData?.phone || '',
        date: initialDate,
        dateDisplay: formatDateToDisplay(initialDate),
        time: initialData?.suggestedTime || defaultTime,
        reason: initialData?.reason || '',
        patientSex: (initialData?.patientSex as 'M' | 'F' | '') || '',
        birthDateDisplay: initialBirthDate ? formatDateToDisplay(initialBirthDate) : '',
        birthDate: initialBirthDate,
        appointmentType: (initialData?.appointmentType as 'consulta' | 'retorno' | '') || '',
        totalAmount: '',
        paidAmount: '',
        discountType: '%' as DiscountType,
        discountValue: ''
      });
      setShowDiscount(false);
      setSelectedPatient(null);
    }
  }, [isOpen, initialData, chatPhone, fetchDoctors]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.patientName.trim()) {
      toast.error('Por favor, preencha o nome do paciente.');
      return;
    }

    if (!formData.birthDate || formData.birthDate.length !== 10) {
      toast.error('Por favor, insira a data de nascimento do paciente.');
      return;
    }

    if (!selectedDoctorId) {
      toast.error('Por favor, selecione um médico.');
      return;
    }

    if (!formData.appointmentType) {
      toast.error('Por favor, selecione se é consulta ou retorno.');
      return;
    }

    if (!formData.date || formData.date.length !== 10) {
      toast.error('Por favor, insira uma data válida no formato DD/MM/AAAA');
      return;
    }

    if (formData.appointmentType === 'consulta' && parseCurrency(formData.totalAmount) <= 0) {
      toast.error('Informe o valor da consulta.');
      return;
    }

    setLoading(true);

    try {
      const selectedDoctor = doctors.find(d => d.id === selectedDoctorId);
      if (!selectedDoctor) throw new Error('Médico não encontrado');

      const start_time = saveAppointmentDateTime(formData.date, formData.time);

      // Converter valores monetários (com desconto)
      const totalAmountNum = parseCurrency(formData.totalAmount);
      const discountVal = Number(formData.discountValue.replace(',', '.')) || 0;
      const discountAmt = computeDiscountAmount(totalAmountNum, formData.discountType, discountVal);

      // Derivar colunas flat dos guardians para backward compat
      const cleanGuardians = guardians.filter(g => g.name.trim());
      const flatCols = syncFlatColumnsFromFamilyMembers(cleanGuardians);

      const insertData: Record<string, unknown> = {
        doctor_id: selectedDoctorId,
        doctor_name: selectedDoctor.name,
        start_time: start_time,
        status: 'scheduled',
        patient_name: formData.patientName.trim(),
        patient_phone: formData.phone.trim() || null,
        notes: formData.reason.trim() || null,
        appointment_type: formData.appointmentType,
        patient_birth_date: formData.birthDate || null,
        total_amount: totalAmountNum,
        amount_paid: 0,
        discount_type: formData.discountType,
        discount_value: discountVal,
        discount_amount: discountAmt,
        guardians: cleanGuardians.length > 0 ? cleanGuardians : null,
        ...(chatId ? { chat_id: chatId } : {})
      };

      if (flatCols.mother_name) insertData.mother_name = flatCols.mother_name;
      if (flatCols.father_name) insertData.father_name = flatCols.father_name;
      if (flatCols.parent_name) insertData.parent_name = flatCols.parent_name;

      if (formData.patientSex) {
        insertData.patient_sex = formData.patientSex;
      }

      let patientId: number | null = selectedPatient ? selectedPatient.id : null;
      if (!patientId) {
        if (formData.phone.trim()) {
          const existingPatientId = await linkPatientByPhone(formData.phone.trim());
          if (existingPatientId) patientId = existingPatientId;
        }
        if (!patientId) {
          const appointmentData: Partial<Appointment> = {
            patient_name: formData.patientName.trim(),
            patient_phone: formData.phone.trim() || null,
            patient_sex: formData.patientSex || null,
            mother_name: flatCols.mother_name,
            father_name: flatCols.father_name,
            parent_name: flatCols.parent_name,
            patient_birth_date: formData.birthDate || null,
            guardians: cleanGuardians.length > 0 ? cleanGuardians : undefined
          };
          patientId = await createBasicPatientFromAppointment(appointmentData as Appointment);
        }
      }
      if (patientId) {
        insertData.patient_id = patientId;
      }

      const { error } = await supabase
        .from('appointments')
        .insert(insertData);

      if (error) {
        throw error;
      }

      if (onSave) onSave();
      onClose();
      toast.success('Agendamento criado com sucesso!');

    } catch (error: unknown) {
      console.error('Erro ao salvar agendamento:', error);
      toast.error('Erro ao salvar agendamento: ' + ((error instanceof Error ? error.message : '') || 'Tente novamente.'));
    } finally {
      setLoading(false);
    }
  }

  // Cálculos para exibição no formulário
  const totalNum = parseCurrency(formData.totalAmount);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[140] flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white dark:bg-[#08080b] rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-[#3d3d48] bg-gray-50 dark:bg-[#1c1c21] flex justify-between items-center">
          <h3 className="font-bold text-gray-800 dark:text-[#fafafa] flex items-center gap-2">
            <Sparkles className="text-pink-600 dark:text-pink-400" size={20}/>
            Agendar Paciente
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition-colors"
          >
            <X size={20} className="text-gray-400 dark:text-[#71717a]"/>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">

          {/* Paciente existente (opcional) */}
          <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-[#a1a1aa] uppercase mb-1">
              Paciente existente (opcional)
            </label>
            <PatientSearchSelect
              selectedPatient={selectedPatient}
              onSelect={(p) => {
                setSelectedPatient(p);
                if (p) {
                  // Popular guardians a partir de family_members ou colunas flat
                  if (p.family_members && p.family_members.length > 0) {
                    setGuardians(p.family_members.map(fm => ({
                      name: fm.name,
                      relationship: fm.relationship,
                      phone: fm.phone,
                    })));
                  } else {
                    setGuardians(flatFieldsToFamilyMembers({
                      mother_name: p.mother_name,
                      father_name: p.father_name,
                    }));
                  }
                  setFormData(prev => ({
                    ...prev,
                    patientName: p.name,
                    phone: p.phone || '',
                    patientSex: (p.biological_sex || '') as 'M' | 'F' | '',
                    birthDateDisplay: p.birth_date ? formatDateToDisplay(p.birth_date) : '',
                    birthDate: p.birth_date || ''
                  }));
                }
              }}
              placeholder="Buscar paciente por nome ou telefone..."
            />
          </div>

          {/* Nome do Paciente */}
          <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-[#a1a1aa] uppercase mb-1">
              Nome do Paciente *
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
              <input
                type="text"
                value={formData.patientName}
                onChange={e => setFormData({...formData, patientName: e.target.value})}
                className="w-full pl-9 pr-3 py-2.5 border border-gray-200 dark:border-[#3d3d48] rounded-lg bg-white dark:bg-[#1c1c21] text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all"
                placeholder="Nome da criança"
                required
              />
            </div>
          </div>

          {/* Responsáveis / Familiares (dinâmico) */}
          <FamilyMembersField
            mode="controlled"
            value={guardians}
            onChange={setGuardians}
            compact
          />

          {/* Sexo da Criança */}
          <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-[#a1a1aa] uppercase mb-1">
              Sexo da Criança
            </label>
            <div className="flex gap-0 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setFormData({...formData, patientSex: 'M'})}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all shadow-sm ${
                  formData.patientSex === 'M'
                    ? 'bg-white text-blue-600 shadow-sm dark:bg-[#1c1c21] dark:text-blue-400'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                }`}
              >
                Masculino
              </button>
              <button
                type="button"
                onClick={() => setFormData({...formData, patientSex: 'F'})}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all shadow-sm ${
                  formData.patientSex === 'F'
                    ? 'bg-white text-pink-600 shadow-sm dark:bg-[#1c1c21] dark:text-pink-400'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                }`}
              >
                Feminino
              </button>
            </div>
          </div>

          {/* Data de Nascimento */}
          <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-[#a1a1aa] uppercase mb-1">
              Data de Nascimento * (DD/MM/AAAA)
            </label>
            <div className="relative">
              <Cake className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
              <input
                type="text"
                value={formData.birthDateDisplay}
                onChange={e => handleDateMaskedInput(e.target.value, 'birthDateDisplay', 'birthDate')}
                placeholder="DD/MM/AAAA"
                maxLength={10}
                className="w-full pl-9 pr-3 py-2.5 border border-gray-200 dark:border-[#3d3d48] rounded-lg bg-white dark:bg-[#1c1c21] text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all"
                required
              />
            </div>
          </div>

          {/* Telefone */}
          <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-[#a1a1aa] uppercase mb-1">
              Telefone / WhatsApp
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
              <input
                type="text"
                value={formData.phone}
                onChange={e => setFormData({...formData, phone: e.target.value})}
                className="w-full pl-9 pr-3 py-2.5 border border-gray-200 dark:border-[#3d3d48] rounded-lg bg-white dark:bg-[#1c1c21] text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all"
                placeholder="11999999999"
              />
            </div>
          </div>

          {/* Data e Hora */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-[#a1a1aa] uppercase mb-1">
                Data da Consulta * (DD/MM/AAAA)
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
                <input
                  type="text"
                  value={formData.dateDisplay}
                  onChange={e => handleDateMaskedInput(e.target.value, 'dateDisplay', 'date')}
                  placeholder="DD/MM/AAAA"
                  maxLength={10}
                  className="w-full pl-9 pr-3 py-2.5 border border-gray-200 dark:border-[#3d3d48] rounded-lg bg-white dark:bg-[#1c1c21] text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-[#a1a1aa] uppercase mb-1">
                Horário *
              </label>
              <div className="relative">
                <Clock className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
                <input
                  type="time"
                  value={formData.time}
                  onChange={e => setFormData({...formData, time: e.target.value})}
                  className="w-full pl-9 pr-3 py-2.5 border border-gray-200 dark:border-[#3d3d48] rounded-lg bg-white dark:bg-[#1c1c21] text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all"
                  required
                />
              </div>
            </div>
          </div>

          {/* Médico */}
          <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-[#a1a1aa] uppercase mb-1">
              Médico *
            </label>
            <select
              value={selectedDoctorId || ''}
              onChange={e => setSelectedDoctorId(Number(e.target.value))}
              className="w-full px-3 py-2.5 border border-gray-200 dark:border-[#3d3d48] rounded-lg bg-white dark:bg-[#1c1c21] text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all"
              required
            >
              {doctors.length === 0 ? (
                <option value="">Carregando médicos...</option>
              ) : (
                doctors.map(doctor => (
                  <option key={doctor.id} value={doctor.id}>
                    {doctor.name}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Tipo de atendimento */}
          <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-[#a1a1aa] uppercase mb-1">
              Tipo de Atendimento *
            </label>
            <select
              value={formData.appointmentType}
              onChange={e => setFormData({ ...formData, appointmentType: e.target.value as 'consulta' | 'retorno' | '' })}
              className="w-full px-3 py-2.5 border border-gray-200 dark:border-[#3d3d48] rounded-lg bg-white dark:bg-[#1c1c21] text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all"
              required
            >
              <option value="">Selecione...</option>
              <option value="consulta">Consulta</option>
              <option value="retorno">Retorno</option>
            </select>
          </div>

          {/* --- BLOCO FINANCEIRO NOVO --- */}
          <div className="bg-slate-50 dark:bg-[#1c1c21]/50 p-4 rounded-xl border border-slate-200 dark:border-[#3d3d48] space-y-4">
            <h4 className="text-sm font-bold text-slate-700 dark:text-[#d4d4d8] flex items-center gap-2">
              <Wallet className="w-4 h-4 text-emerald-500" />
              Financeiro do Agendamento
            </h4>

            {/* Valor Total */}
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-[#a1a1aa] uppercase mb-1">
                Valor Total (R$)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-500 dark:text-[#a1a1aa] font-bold text-sm">R$</span>
                <input
                  type="text"
                  value={formData.totalAmount}
                  onChange={e => handleMoneyInput('totalAmount', e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-[#3d3d48] rounded-lg bg-white dark:bg-[#1c1c21] text-gray-700 dark:text-gray-200 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  placeholder="0,00"
                />
              </div>
            </div>

            {/* Botão de desconto */}
            {!showDiscount ? (
              <div>
                <button
                  type="button"
                  onClick={() => setShowDiscount(true)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors"
                >
                  <Tag size={14} /> Desconto
                </button>
              </div>
            ) : (
              <div className="space-y-3 bg-orange-50/50 dark:bg-orange-900/10 p-3 rounded-lg border border-orange-200 dark:border-orange-800/50">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-orange-700 dark:text-orange-300 uppercase flex items-center gap-1.5">
                    <Percent size={12} /> Desconto
                  </p>
                  <button
                    type="button"
                    onClick={() => { setShowDiscount(false); setFormData(prev => ({ ...prev, discountValue: '' })); }}
                    className="text-[10px] text-slate-400 hover:text-red-500 dark:hover:text-red-400 font-semibold transition-colors"
                  >
                    Remover
                  </button>
                </div>
                <div className="flex gap-2 items-end">
                  <div className="flex bg-white dark:bg-[#1c1c21] border border-orange-200 dark:border-orange-800 rounded-lg overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, discountType: '%' as DiscountType }))}
                      className={`px-3 py-1.5 text-xs font-bold transition-colors ${formData.discountType === '%' ? 'bg-orange-500 text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-orange-50 dark:hover:bg-orange-900/20'}`}
                    >
                      %
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, discountType: 'R$' as DiscountType }))}
                      className={`px-3 py-1.5 text-xs font-bold transition-colors ${formData.discountType === 'R$' ? 'bg-orange-500 text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-orange-50 dark:hover:bg-orange-900/20'}`}
                    >
                      R$
                    </button>
                  </div>
                  <div className="flex-1">
                    <input
                      type="text"
                      value={formData.discountValue}
                      onChange={e => {
                        const val = e.target.value.replace(/[^0-9.,]/g, '');
                        setFormData(prev => ({ ...prev, discountValue: val }));
                      }}
                      placeholder={formData.discountType === '%' ? 'Ex: 10' : '0,00'}
                      className="w-full px-3 py-1.5 text-sm font-bold border border-orange-200 dark:border-orange-800 rounded-lg bg-white dark:bg-[#1c1c21] text-orange-700 dark:text-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 transition-all"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Resumo — pagamento será registrado na recepção */}
            {totalNum > 0 && (
              <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-[#3d3d48]">
                {(() => {
                  const dVal = Number(formData.discountValue.replace(',', '.')) || 0;
                  const dAmt = computeDiscountAmount(totalNum, formData.discountType, dVal);
                  const fAmt = effectiveAmount(totalNum, dAmt);
                  return dAmt > 0 ? (
                    <div className="flex flex-col gap-1 w-full">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-orange-600 dark:text-orange-400 font-semibold">Desconto: -R$ {dAmt.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-500 dark:text-[#a1a1aa]">Valor a cobrar na recepção:</span>
                        <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                          R$ {fAmt.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <>
                      <span className="text-sm text-slate-500 dark:text-[#a1a1aa]">Valor a cobrar na recepção:</span>
                      <span className="text-lg font-black text-amber-600 dark:text-amber-400">
                        R$ {totalNum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Motivo/Queixa */}
          <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-[#a1a1aa] uppercase mb-1">
              Motivo / Queixa
            </label>
            <div className="relative">
              <FileText className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
              <textarea
                value={formData.reason}
                onChange={e => setFormData({...formData, reason: e.target.value})}
                className="w-full pl-9 pr-3 py-2.5 border border-gray-200 dark:border-[#3d3d48] rounded-lg bg-white dark:bg-[#1c1c21] text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all resize-none"
                placeholder="Resumo dos sintomas ou motivo da consulta..."
                rows={3}
              />
            </div>
          </div>

          {/* Resumo do Atendimento (somente leitura) */}
          {conversationSummary && (
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-[#a1a1aa] uppercase mb-1">
                Resumo do Atendimento (Chat)
              </label>
              <div className="relative">
                <FileText className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
                <textarea
                  value={conversationSummary}
                  readOnly
                  className="w-full pl-9 pr-3 py-2.5 border border-gray-200 dark:border-[#3d3d48] rounded-lg bg-gray-50 dark:bg-[#1c1c21]/50 text-gray-600 dark:text-[#a1a1aa] resize-none cursor-not-allowed"
                  rows={4}
                />
              </div>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-[#3d3d48] bg-gray-50 dark:bg-[#1c1c21] flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-500 dark:text-[#a1a1aa] hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg text-sm font-bold transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-6 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-lg text-sm font-bold shadow-lg flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin"/>
                Salvando...
              </>
            ) : (
              <>
                <Save size={16}/>
                Salvar Agendamento
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
