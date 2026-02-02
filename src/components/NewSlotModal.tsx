'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { X, User, Ban, FileText, Phone, Calendar, Clock, Stethoscope, Loader2, Save } from 'lucide-react';
import { saveAppointmentDateTime } from '@/utils/dateUtils';
import { linkPatientByPhone, createBasicPatientFromAppointment } from '@/utils/patientRelations';

interface NewSlotModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialDate?: string;
  initialTime?: string;
}

export default function NewSlotModal({ isOpen, onClose, onSuccess, initialDate, initialTime }: NewSlotModalProps) {
  const [loading, setLoading] = useState(false);
  const [slotType, setSlotType] = useState<'booked' | 'blocked'>('booked');
  
  // Estado interno para médicos
  const [doctors, setDoctors] = useState<Array<{ id: number; name: string }>>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    date: '',
    dateDisplay: '', // Formato DD/MM/YYYY para exibição
    time: '',
    patient_name: '',
    parent_name: '',
    patient_phone: '',
    patient_sex: '' as 'M' | 'F' | '',
    notes: ''
  });

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

  // Função para validar e formatar data enquanto digita
  const handleDateInputChange = (value: string) => {
    // Remove tudo que não é número
    const numbers = value.replace(/\D/g, '');
    
    // Limita a 8 dígitos
    const limited = numbers.slice(0, 8);
    
    // Formata com barras
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
    
    setFormData(prev => ({
      ...prev,
      dateDisplay: formatted,
      date: formatDateToISO(formatted)
    }));
  };

  useEffect(() => {
    if (isOpen) {
      fetchDoctors();
      const today = new Date().toISOString().split('T')[0];
      const defaultTime = '09:00';
      const initialDateValue = initialDate || today;
      
      setFormData(prev => ({
        ...prev,
        date: initialDateValue,
        dateDisplay: formatDateToDisplay(initialDateValue),
        time: initialTime || defaultTime,
        patient_name: '',
        parent_name: '',
        patient_phone: '',
        patient_sex: '',
        notes: ''
      }));
      setSlotType('booked');
    }
  }, [isOpen, initialDate, initialTime]);

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
      alert('Por favor, insira uma data válida no formato DD/MM/AAAA');
      return;
    }

    if (slotType === 'booked') {
      if (!formData.patient_name.trim()) {
        alert('Por favor, preencha o nome do paciente.');
        return;
      }
      
      if (!selectedDoctorId) {
        alert('Por favor, selecione um médico.');
        return;
      }
    } else {
      if (!formData.notes.trim()) {
        alert('Por favor, informe o motivo do bloqueio.');
        return;
      }
    }

    setLoading(true);

    try {
      // Garantir que há um médico selecionado
      const doctorIdToUse = selectedDoctorId || doctors[0]?.id;
      const selectedDoctor = doctors.find(d => d.id === doctorIdToUse);
      
      if (!selectedDoctor) {
        throw new Error('Médico não encontrado. Por favor, verifique se há médicos cadastrados.');
      }

      // Usar função utilitária para garantir timezone correto
      const start_time = saveAppointmentDateTime(formData.date, formData.time);

      // Preparar dados para inserção
      const insertData: any = {
        doctor_id: doctorIdToUse,
        doctor_name: selectedDoctor.name,
        start_time: start_time,
        status: slotType === 'booked' ? 'scheduled' : 'blocked',
        notes: formData.notes.trim() || null
      };

      let patientId: number | null = null;

      if (slotType === 'booked') {
        insertData.patient_name = formData.patient_name.trim();
        insertData.patient_phone = formData.patient_phone.trim() || null;
        
        if (formData.parent_name.trim()) {
          insertData.parent_name = formData.parent_name.trim();
        }
        
        if (formData.patient_sex) {
          insertData.patient_sex = formData.patient_sex;
        }

        // Tentar vincular a paciente existente por telefone
        if (formData.patient_phone.trim()) {
          patientId = await linkPatientByPhone(formData.patient_phone.trim());
        }

        // Se não encontrou paciente existente, criar paciente básico automaticamente
        if (!patientId) {
          const appointmentData: any = {
            patient_name: formData.patient_name.trim(),
            patient_phone: formData.patient_phone.trim() || null,
            patient_sex: formData.patient_sex || null,
            parent_name: formData.parent_name.trim() || null
          };
          patientId = await createBasicPatientFromAppointment(appointmentData);
        }

        // Vincular patient_id ao appointment
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
      alert(slotType === 'booked' ? 'Agendamento criado com sucesso!' : 'Horário bloqueado com sucesso!');
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      alert('Erro ao salvar: ' + (error.message || 'Tente novamente.'));
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white dark:bg-[#1e2028] rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#2a2d36] flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h3 className="font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
              <Calendar className="text-pink-600 dark:text-pink-400" size={20}/>
              {slotType === 'booked' ? 'Agendar Paciente' : 'Bloquear Horário'}
            </h3>
            <div className="flex gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setSlotType('booked')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                  slotType === 'booked'
                    ? 'bg-white text-pink-600 shadow-sm dark:bg-[#2a2d36] dark:text-pink-400'
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
                    ? 'bg-white text-red-600 shadow-sm dark:bg-[#2a2d36] dark:text-red-400'
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
            <X size={20} className="text-gray-400 dark:text-gray-500"/>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
          {slotType === 'booked' ? (
            <>
              {/* Nome do Paciente */}
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">
                  Nome do Paciente *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
                  <input
                    type="text"
                    value={formData.patient_name}
                    onChange={e => setFormData({...formData, patient_name: e.target.value})}
                    className="w-full pl-9 pr-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-[#2a2d36] text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all"
                    placeholder="Nome da criança"
                    required
                  />
                </div>
              </div>

              {/* Nome do Responsável */}
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">
                  Nome do Responsável
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
                  <input
                    type="text"
                    value={formData.parent_name}
                    onChange={e => setFormData({...formData, parent_name: e.target.value})}
                    className="w-full pl-9 pr-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-[#2a2d36] text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all"
                    placeholder="Nome do pai/mãe/responsável"
                  />
                </div>
              </div>

              {/* Sexo da Criança */}
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">
                  Sexo da Criança
                </label>
                <div className="flex gap-0 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, patient_sex: 'M'})}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all shadow-sm ${
                      formData.patient_sex === 'M' 
                        ? 'bg-white text-blue-600 shadow-sm dark:bg-[#2a2d36] dark:text-blue-400' 
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                    }`}
                  >
                    Masculino
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, patient_sex: 'F'})}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all shadow-sm ${
                      formData.patient_sex === 'F' 
                        ? 'bg-white text-pink-600 shadow-sm dark:bg-[#2a2d36] dark:text-pink-400' 
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                    }`}
                  >
                    Feminino
                  </button>
                </div>
              </div>

              {/* Telefone */}
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">
                  Telefone / WhatsApp
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
                  <input
                    type="text"
                    value={formData.patient_phone}
                    onChange={e => setFormData({...formData, patient_phone: e.target.value})}
                    className="w-full pl-9 pr-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-[#2a2d36] text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all"
                    placeholder="11999999999"
                  />
                </div>
              </div>

              {/* Data e Hora */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">
                    Data da Consulta * (DD/MM/AAAA)
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
                    <input
                      type="text"
                      value={formData.dateDisplay}
                      onChange={e => handleDateInputChange(e.target.value)}
                      placeholder="DD/MM/AAAA"
                      maxLength={10}
                      className="w-full pl-9 pr-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-[#2a2d36] text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">
                    Horário *
                  </label>
                  <div className="relative">
                    <Clock className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
                    <input
                      type="time"
                      value={formData.time}
                      onChange={e => setFormData({...formData, time: e.target.value})}
                      className="w-full pl-9 pr-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-[#2a2d36] text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Médico */}
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">
                  Médico *
                </label>
                <div className="relative">
                  <Stethoscope className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
                  <select
                    value={selectedDoctorId || ''}
                    onChange={e => setSelectedDoctorId(Number(e.target.value))}
                    className="w-full pl-9 pr-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-[#2a2d36] text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all"
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

              {/* Motivo/Queixa */}
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">
                  Motivo / Queixa
                </label>
                <div className="relative">
                  <FileText className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
                  <textarea
                    value={formData.notes}
                    onChange={e => setFormData({...formData, notes: e.target.value})}
                    className="w-full pl-9 pr-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-[#2a2d36] text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all resize-none"
                    placeholder="Resumo dos sintomas ou motivo da consulta..."
                    rows={3}
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Data e Hora para Bloqueio */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">
                    Data * (DD/MM/AAAA)
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
                    <input
                      type="text"
                      value={formData.dateDisplay}
                      onChange={e => handleDateInputChange(e.target.value)}
                      placeholder="DD/MM/AAAA"
                      maxLength={10}
                      className="w-full pl-9 pr-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-[#2a2d36] text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">
                    Horário *
                  </label>
                  <div className="relative">
                    <Clock className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
                    <input
                      type="time"
                      value={formData.time}
                      onChange={e => setFormData({...formData, time: e.target.value})}
                      className="w-full pl-9 pr-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-[#2a2d36] text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
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
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#2a2d36] flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg text-sm font-bold transition-colors"
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