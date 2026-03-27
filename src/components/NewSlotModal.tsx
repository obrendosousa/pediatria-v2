'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
const supabase = createClient();
import { X, User, Ban, FileText, Phone, Calendar, Clock, Stethoscope, Loader2, Save, Wallet, Cake, Percent, Tag } from 'lucide-react';
import { computeDiscountAmount, effectiveAmount, type DiscountType } from '@/utils/discountUtils';
import { saveAppointmentDateTime } from '@/utils/dateUtils';
import { linkPatientByPhone, createBasicPatientFromAppointment } from '@/utils/patientRelations';
import { useToast } from '@/contexts/ToastContext';
import PatientSearchSelect, { type PatientSearchOption } from '@/components/PatientSearchSelect';
import type { Appointment } from '@/types/medical';

interface InitialPatientData {
  patientId?: number;
  patientName?: string;
  parentName?: string;
  phone?: string;
  patientSex?: 'M' | 'F';
  doctorId?: number;
  appointmentType?: string;
}

interface NewSlotModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialDate?: string;
  initialTime?: string;
  initialPatient?: InitialPatientData | null;
}

export default function NewSlotModal({ isOpen, onClose, onSuccess, initialDate, initialTime, initialPatient }: NewSlotModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [slotType, setSlotType] = useState<'booked' | 'blocked'>('booked');

  // Estado interno para médicos
  const [doctors, setDoctors] = useState<Array<{ id: number; name: string }>>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<number | null>(null);

  // Paciente existente selecionado (agenda)
  const [selectedPatient, setSelectedPatient] = useState<PatientSearchOption | null>(null);

  const [formData, setFormData] = useState({
    date: '',
    dateDisplay: '', // Formato DD/MM/YYYY para exibição
    time: '',
    patient_name: '',
    mother_name: '',
    father_name: '',
    patient_phone: '',
    patient_sex: '' as 'M' | 'F' | '',
    birthDateDisplay: '',
    birthDate: '', // YYYY-MM-DD
    appointment_type: '' as 'consulta' | 'retorno' | '',
    notes: '',
    // Novos campos financeiros
    totalAmount: '',
    paidAmount: '',
    // Desconto
    discountType: '%' as DiscountType,
    discountValue: ''
  });
  const [showDiscount, setShowDiscount] = useState(false);

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

  // Função para converter YYYY-MM-DD para DD/MM/YYYY
  const formatDateToDisplay = (dateStr: string): string => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  // Função para converter DD/MM/YYYY para YYYY-MM-DD
  const formatDateToISO = (dateStr: string): string => {
    if (!dateStr) return '';
    // Remove caracteres não numéricos
    const cleaned = dateStr.replace(/\D/g, '');
    if (cleaned.length !== 8) return '';
    const day = cleaned.substring(0, 2);
    const month = cleaned.substring(2, 4);
    const year = cleaned.substring(4, 8);
    return `${year}-${month}-${day}`;
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

  useEffect(() => {
    if (isOpen) {
      fetchDoctors().then(() => {
        if (initialPatient?.doctorId) {
          setSelectedDoctorId(initialPatient.doctorId);
        }
      });
      const today = new Date().toISOString().split('T')[0];
      const defaultTime = '09:00';
      const initialDateValue = initialDate || today;

      setFormData(prev => ({
        ...prev,
        date: initialDateValue,
        dateDisplay: formatDateToDisplay(initialDateValue),
        time: initialTime || defaultTime,
        patient_name: initialPatient?.patientName || '',
        mother_name: initialPatient?.parentName || '',
        father_name: '',
        patient_phone: initialPatient?.phone || '',
        patient_sex: initialPatient?.patientSex || '',
        birthDateDisplay: '',
        birthDate: '',
        appointment_type: (initialPatient?.appointmentType as 'consulta' | 'retorno' | '') || '',
        notes: '',
        totalAmount: '',
        paidAmount: '',
        discountType: '%' as DiscountType,
        discountValue: ''
      }));
      setShowDiscount(false);
      setSelectedPatient(null);
      setSlotType('booked');
    }
  }, [isOpen, initialDate, initialTime, initialPatient]);

  async function fetchDoctors() {
    try {
      const { data, error } = await supabase
        .from('doctors')
        .select('id, name')
        .eq('active', true)
        .order('name');

      if (error) throw error;

      if (data && data.length > 0) {
        setDoctors(data);
        setSelectedDoctorId(data[0].id);
      }
    } catch (err) {
      console.error('Erro ao carregar médicos:', err);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validar data antes de enviar (para ambos os tipos)
    if (!formData.date || formData.date.length !== 10) {
      toast.error('Por favor, insira uma data válida no formato DD/MM/AAAA');
      return;
    }

    if (slotType === 'booked') {
      if (!formData.patient_name.trim()) {
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

      if (!formData.appointment_type) {
        toast.error('Selecione se é consulta ou retorno.');
        return;
      }

      const totalVal = parseCurrency(formData.totalAmount);
      const discVal = Number(formData.discountValue.replace(',', '.')) || 0;
      const discAmt = computeDiscountAmount(totalVal, formData.discountType, discVal);
      const finalVal = effectiveAmount(totalVal, discAmt);
      if (formData.appointment_type === 'consulta' && finalVal <= 0 && totalVal <= 0) {
        toast.error('Informe o valor da consulta.');
        return;
      }
    } else {
      if (!formData.notes.trim()) {
        toast.error('Por favor, informe o motivo do bloqueio.');
        return;
      }
    }

    setLoading(true);

    try {
      // Garantir que há um médico selecionado
      const doctorIdToUse = selectedDoctorId || doctors[0]?.id;
      const selectedDoctor = doctors.find(d => d.id === doctorIdToUse);

      if (!selectedDoctor) {
        toast.error('Médico não encontrado. Por favor, verifique se há médicos cadastrados.');
        setLoading(false);
        return;
      }

      // Usar função utilitária para garantir timezone correto
      const start_time = saveAppointmentDateTime(formData.date, formData.time);

      // Preparar dados para inserção
      const insertData: Record<string, unknown> = {
        doctor_id: doctorIdToUse,
        doctor_name: selectedDoctor.name,
        start_time: start_time,
        status: slotType === 'booked' ? 'scheduled' : 'blocked',
        notes: formData.notes.trim() || null
      };

      if (slotType === 'booked') {
        insertData.patient_name = formData.patient_name.trim();
        insertData.patient_phone = formData.patient_phone.trim() || null;
        insertData.appointment_type = formData.appointment_type;
        insertData.patient_birth_date = formData.birthDate || null;

        // Inserir dados financeiros (com desconto)
        const totalAmountNum = parseCurrency(formData.totalAmount);
        const discountVal = Number(formData.discountValue.replace(',', '.')) || 0;
        const discountAmt = computeDiscountAmount(totalAmountNum, formData.discountType, discountVal);
        insertData.total_amount = totalAmountNum;
        insertData.amount_paid = 0;
        insertData.discount_type = formData.discountType;
        insertData.discount_value = discountVal;
        insertData.discount_amount = discountAmt;

        if (formData.mother_name.trim()) {
          insertData.mother_name = formData.mother_name.trim();
        }
        if (formData.father_name.trim()) {
          insertData.father_name = formData.father_name.trim();
        }
        if (formData.mother_name.trim() || formData.father_name.trim()) {
          insertData.parent_name = formData.mother_name.trim() || formData.father_name.trim();
        }

        if (formData.patient_sex) {
          insertData.patient_sex = formData.patient_sex;
        }

        let patientId: number | null = selectedPatient ? selectedPatient.id : (initialPatient?.patientId || null);
        if (!patientId) {
          // Tentar vincular a paciente existente por telefone
          if (formData.patient_phone.trim()) {
            patientId = await linkPatientByPhone(formData.patient_phone.trim());
          }
          // Se não encontrou paciente existente, criar paciente básico automaticamente
          if (!patientId) {
            const appointmentData: Partial<Appointment> = {
              patient_name: formData.patient_name.trim(),
              patient_phone: formData.patient_phone.trim() || null,
              patient_sex: formData.patient_sex || null,
              mother_name: formData.mother_name.trim() || null,
              father_name: formData.father_name.trim() || null,
              parent_name: formData.mother_name.trim() || formData.father_name.trim() || null,
              patient_birth_date: formData.birthDate || null
            };
            patientId = await createBasicPatientFromAppointment(appointmentData as Appointment);
          }
        }
        if (patientId) {
          insertData.patient_id = patientId;
        }
      }

      const { error } = await supabase
        .from('appointments')
        .insert(insertData);

      if (error) throw error;

      onSuccess();
      onClose();
      toast.success(slotType === 'booked' ? 'Agendamento criado com sucesso!' : 'Horário bloqueado com sucesso!');
    } catch (error: unknown) {
      console.error('Erro ao salvar:', error);
      toast.error('Erro ao salvar: ' + ((error instanceof Error ? error.message : '') || 'Tente novamente.'));
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white dark:bg-[#08080b] rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-[#3d3d48] bg-gray-50 dark:bg-[#1c1c21] flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h3 className="font-bold text-gray-800 dark:text-[#fafafa] flex items-center gap-2">
              <Calendar className="text-pink-600 dark:text-pink-400" size={20}/>
              {slotType === 'booked' ? 'Agendar Paciente' : 'Bloquear Horário'}
            </h3>
            <div className="flex gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setSlotType('booked')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                  slotType === 'booked'
                    ? 'bg-white text-pink-600 shadow-sm dark:bg-[#1c1c21] dark:text-pink-400'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                }`}
              >
                <User size={14}/> Agendar
              </button>
              <button
                type="button"
                onClick={() => setSlotType('blocked')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                  slotType === 'blocked'
                    ? 'bg-white text-red-600 shadow-sm dark:bg-[#1c1c21] dark:text-red-400'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                }`}
              >
                <Ban size={14}/> Bloquear
              </button>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition-colors"
          >
            <X size={20} className="text-gray-400 dark:text-[#71717a]"/>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
          {slotType === 'booked' ? (
            <>
              {/* Buscar paciente existente */}
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-[#a1a1aa] uppercase mb-1">
                  Paciente existente (opcional)
                </label>
                <PatientSearchSelect
                  selectedPatient={selectedPatient}
                  onSelect={(p) => {
                    setSelectedPatient(p);
                    if (p) {
                      setFormData(prev => ({
                        ...prev,
                        patient_name: p.name,
                        patient_phone: p.phone || '',
                        patient_sex: (p.biological_sex || '') as 'M' | 'F' | '',
                        mother_name: p.mother_name || '',
                        father_name: p.father_name || '',
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
                    value={formData.patient_name}
                    onChange={e => setFormData({...formData, patient_name: e.target.value})}
                    className="w-full pl-9 pr-3 py-2.5 border border-gray-200 dark:border-[#3d3d48] rounded-lg bg-white dark:bg-[#1c1c21] text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all"
                    placeholder="Nome da criança"
                    required
                  />
                </div>
              </div>

              {/* Nome da Mãe e Nome do Pai */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-[#a1a1aa] uppercase mb-1">
                    Nome da Mãe
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
                    <input
                      type="text"
                      value={formData.mother_name}
                      onChange={e => setFormData({...formData, mother_name: e.target.value})}
                      className="w-full pl-9 pr-3 py-2.5 border border-gray-200 dark:border-[#3d3d48] rounded-lg bg-white dark:bg-[#1c1c21] text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all"
                      placeholder="Nome da mãe"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-[#a1a1aa] uppercase mb-1">
                    Nome do Pai
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
                    <input
                      type="text"
                      value={formData.father_name}
                      onChange={e => setFormData({...formData, father_name: e.target.value})}
                      className="w-full pl-9 pr-3 py-2.5 border border-gray-200 dark:border-[#3d3d48] rounded-lg bg-white dark:bg-[#1c1c21] text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all"
                      placeholder="Nome do pai"
                    />
                  </div>
                </div>
              </div>

              {/* Sexo da Criança */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-[#a1a1aa] uppercase mb-1">
                    Sexo da Criança
                  </label>
                  <div className="flex gap-0 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setFormData({...formData, patient_sex: 'M'})}
                      className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all shadow-sm ${
                        formData.patient_sex === 'M'
                          ? 'bg-white text-blue-600 shadow-sm dark:bg-[#1c1c21] dark:text-blue-400'
                          : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                      }`}
                    >
                      Masculino
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({...formData, patient_sex: 'F'})}
                      className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all shadow-sm ${
                        formData.patient_sex === 'F'
                          ? 'bg-white text-pink-600 shadow-sm dark:bg-[#1c1c21] dark:text-pink-400'
                          : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                      }`}
                    >
                      Feminino
                    </button>
                  </div>
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
                    value={formData.patient_phone}
                    onChange={e => setFormData({...formData, patient_phone: e.target.value})}
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
                <div className="relative">
                  <Stethoscope className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
                  <select
                    value={selectedDoctorId || ''}
                    onChange={e => setSelectedDoctorId(Number(e.target.value))}
                    className="w-full pl-9 pr-3 py-2.5 border border-gray-200 dark:border-[#3d3d48] rounded-lg bg-white dark:bg-[#1c1c21] text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all"
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
              </div>

              {/* Tipo de atendimento */}
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-[#a1a1aa] uppercase mb-1">
                  Tipo de Atendimento *
                </label>
                <select
                  value={formData.appointment_type}
                  onChange={e => setFormData({ ...formData, appointment_type: e.target.value as 'consulta' | 'retorno' | '' })}
                  className="w-full px-3 py-2.5 border border-gray-200 dark:border-[#3d3d48] rounded-lg bg-white dark:bg-[#1c1c21] text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all"
                  required
                >
                  <option value="">Selecione...</option>
                  <option value="consulta">Consulta</option>
                  <option value="retorno">Retorno</option>
                </select>
              </div>

              {/* --- NOVO BLOCO FINANCEIRO --- */}
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
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => setShowDiscount(true)}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors"
                    >
                      <Tag size={14} /> Desconto
                    </button>
                  </div>
                ) : (
                  <div className="col-span-full space-y-3 bg-orange-50/50 dark:bg-orange-900/10 p-3 rounded-lg border border-orange-200 dark:border-orange-800/50">
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
                      {/* Seletor % / R$ */}
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
                      {/* Valor do desconto */}
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
                    {/* Resumo do desconto */}
                    {(() => {
                      const tNum = parseCurrency(formData.totalAmount);
                      const dVal = Number(formData.discountValue.replace(',', '.')) || 0;
                      const dAmt = computeDiscountAmount(tNum, formData.discountType, dVal);
                      const fAmt = effectiveAmount(tNum, dAmt);
                      if (dAmt > 0 && tNum > 0) {
                        return (
                          <div className="flex justify-between items-center pt-2 border-t border-orange-200 dark:border-orange-800/50">
                            <span className="text-xs text-orange-600 dark:text-orange-400 font-semibold">
                              Desconto: -R$ {dAmt.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                            <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                              Final: R$ {fAmt.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        );
                      }
                      return null;
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
                    value={formData.notes}
                    onChange={e => setFormData({...formData, notes: e.target.value})}
                    className="w-full pl-9 pr-3 py-2.5 border border-gray-200 dark:border-[#3d3d48] rounded-lg bg-white dark:bg-[#1c1c21] text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all resize-none"
                    placeholder="Resumo dos sintomas ou motivo da consulta..."
                    rows={3}
                  />
                </div>
              </div>
            </>
          ) : (
            // BLOQUEIO DE HORÁRIO (Mantido sem alterações)
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-[#a1a1aa] uppercase mb-1">
                    Data * (DD/MM/AAAA)
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
                    <input
                      type="text"
                      value={formData.dateDisplay}
                      onChange={e => handleDateMaskedInput(e.target.value, 'dateDisplay', 'date')}
                      placeholder="DD/MM/AAAA"
                      maxLength={10}
                      className="w-full pl-9 pr-3 py-2.5 border border-gray-200 dark:border-[#3d3d48] rounded-lg bg-white dark:bg-[#1c1c21] text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
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
                      className="w-full pl-9 pr-3 py-2.5 border border-gray-200 dark:border-[#3d3d48] rounded-lg bg-white dark:bg-[#1c1c21] text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
                      required
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-red-500 dark:text-red-400 uppercase mb-1">
                  Motivo do Bloqueio *
                </label>
                <div className="relative">
                  <Ban className="w-4 h-4 text-red-400 absolute left-3 top-3.5" />
                  <textarea
                    placeholder="Ex: Almoço, Reunião, Pessoal..."
                    value={formData.notes}
                    onChange={e => setFormData({...formData, notes: e.target.value})}
                    className="w-full pl-9 pr-3 py-2.5 border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10 rounded-lg text-sm text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all h-32 resize-none"
                    required
                  />
                </div>
              </div>
            </>
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
            className={`px-6 py-2 text-white rounded-lg text-sm font-bold shadow-lg flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              slotType === 'booked'
                ? 'bg-pink-600 hover:bg-pink-700'
                : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin"/>
                Salvando...
              </>
            ) : (
              <>
                <Save size={16}/>
                {slotType === 'booked' ? 'Salvar Agendamento' : 'Bloquear Horário'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
