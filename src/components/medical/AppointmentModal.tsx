'use client';

import { useState, useEffect } from 'react';
import { X, User, Phone, Calendar, Clock, FileText, Sparkles, Loader2, Save } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { linkPatientByPhone, createBasicPatientFromAppointment } from '@/utils/patientRelations';
import { saveAppointmentDateTime } from '@/utils/dateUtils';

export interface PreScheduleData {
  patientName: string | null;
  parentName: string | null;
  phone: string | null;
  suggestedDate: string; // YYYY-MM-DD
  suggestedTime: string; // HH:MM
  reason: string;
  patientSex?: 'M' | 'F' | null; // Sexo da criança (opcional)
}

interface AppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: PreScheduleData;
  onSave?: () => void;
  chatPhone?: string;
  conversationSummary?: string; // Resumo do histórico da conversa
}

export default function AppointmentModal({
  isOpen,
  onClose,
  initialData,
  onSave,
  chatPhone,
  conversationSummary
}: AppointmentModalProps) {
  const [loading, setLoading] = useState(false);
  const [doctors, setDoctors] = useState<Array<{ id: number; name: string }>>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<number | null>(null);
  
  const [formData, setFormData] = useState({
    patientName: '',
    parentName: '',
    phone: '',
    date: '',
    dateDisplay: '', // Formato DD/MM/YYYY para exibição
    time: '',
    reason: '',
    patientSex: '' as 'M' | 'F' | ''
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

  // Carregar médicos e preencher formulário quando modal abrir
  useEffect(() => {
    if (isOpen) {
      fetchDoctors();
      
      // Preencher com dados da IA ou valores padrão
      const today = new Date().toISOString().split('T')[0];
      const defaultTime = '09:00';
      const initialDate = initialData?.suggestedDate || today;
      
      setFormData({
        patientName: initialData?.patientName || '',
        parentName: initialData?.parentName || '',
        phone: chatPhone || initialData?.phone || '',
        date: initialDate,
        dateDisplay: formatDateToDisplay(initialDate),
        time: initialData?.suggestedTime || defaultTime,
        reason: initialData?.reason || '',
        patientSex: ((initialData as any)?.patientSex as 'M' | 'F' | '') || ''
      });
    }
  }, [isOpen, initialData, chatPhone]);

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
        setSelectedDoctorId(data[0].id); // Seleciona o primeiro médico por padrão
      }
    } catch (err) {
      console.error('Erro ao carregar médicos:', err);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!formData.patientName.trim()) {
      alert('Por favor, preencha o nome do paciente.');
      return;
    }
    
    if (!selectedDoctorId) {
      alert('Por favor, selecione um médico.');
      return;
    }

    // Validar data antes de enviar
    if (!formData.date || formData.date.length !== 10) {
      alert('Por favor, insira uma data válida no formato DD/MM/AAAA');
      return;
    }

    // Validar se a data é válida
    const dateObj = new Date(formData.date);
    if (isNaN(dateObj.getTime())) {
      alert('Por favor, insira uma data válida.');
      return;
    }

    setLoading(true);

    try {
      const selectedDoctor = doctors.find(d => d.id === selectedDoctorId);
      if (!selectedDoctor) throw new Error('Médico não encontrado');

      // Combinar data e hora usando função utilitária para garantir timezone correto
      const start_time = saveAppointmentDateTime(formData.date, formData.time);

      // Preparar dados para inserção (remover campos vazios)
      const insertData: any = {
        doctor_id: selectedDoctorId,
        doctor_name: selectedDoctor.name,
        start_time: start_time,
        status: 'scheduled',
        patient_name: formData.patientName.trim(),
        patient_phone: formData.phone.trim() || null,
        notes: formData.reason.trim() || null
      };

      // Adicionar parent_name apenas se não estiver vazio
      if (formData.parentName.trim()) {
        insertData.parent_name = formData.parentName.trim();
      }

      // Adicionar patient_sex apenas se selecionado
      if (formData.patientSex) {
        insertData.patient_sex = formData.patientSex;
      }

      // Tentar vincular a paciente existente por telefone
      let patientId: number | null = null;
      if (formData.phone.trim()) {
        const existingPatientId = await linkPatientByPhone(formData.phone.trim());
        if (existingPatientId) {
          patientId = existingPatientId;
        }
      }

      // Se não encontrou paciente existente, criar paciente básico automaticamente
      if (!patientId) {
        const appointmentData: any = {
          patient_name: formData.patientName.trim(),
          patient_phone: formData.phone.trim() || null,
          patient_sex: formData.patientSex || null,
          parent_name: formData.parentName.trim() || null
        };
        patientId = await createBasicPatientFromAppointment(appointmentData);
      }

      // Vincular patient_id ao appointment
      if (patientId) {
        insertData.patient_id = patientId;
      }

      const { data, error } = await supabase
        .from('appointments')
        .insert(insertData)
        .select();

      if (error) {
        console.error('Erro detalhado do Supabase:', error);
        // Mensagem de erro mais amigável
        let errorMessage = 'Erro ao salvar agendamento.';
        if (error.message?.includes('parent_name')) {
          errorMessage = 'Erro: A coluna "parent_name" não existe no banco. Execute o script SQL: database/add_parent_name_to_appointments.sql';
        } else if (error.message?.includes('patient_sex')) {
          errorMessage = 'Erro: A coluna "patient_sex" não existe no banco. Execute o script SQL: database/add_patient_sex_to_appointments.sql';
        } else if (error.message) {
          errorMessage = `Erro: ${error.message}`;
        }
        alert(errorMessage);
        throw error;
      }

      if (onSave) onSave();
      onClose();
      
      // Feedback visual
      alert('Agendamento criado com sucesso!');
    } catch (error: any) {
      console.error('Erro ao salvar agendamento:', error);
      // Não mostrar alert duplicado se já foi mostrado acima
      if (!error.message?.includes('parent_name') && !error.message?.includes('patient_sex')) {
        alert('Erro ao salvar agendamento: ' + (error.message || 'Tente novamente.'));
      }
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[140] flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white dark:bg-[#1e2028] rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#2a2d36] flex justify-between items-center">
          <h3 className="font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <Sparkles className="text-pink-600 dark:text-pink-400" size={20}/>
            Agendar Paciente (IA)
          </h3>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition-colors"
          >
            <X size={20} className="text-gray-400 dark:text-gray-500"/>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
          
          {/* Nome do Paciente */}
          <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">
              Nome do Paciente *
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
              <input
                type="text"
                value={formData.patientName}
                onChange={e => setFormData({...formData, patientName: e.target.value})}
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
                value={formData.parentName}
                onChange={e => setFormData({...formData, parentName: e.target.value})}
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
                onClick={() => setFormData({...formData, patientSex: 'M'})}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all shadow-sm ${
                  formData.patientSex === 'M' 
                    ? 'bg-white text-blue-600 shadow-sm dark:bg-[#2a2d36] dark:text-blue-400' 
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
                value={formData.phone}
                onChange={e => setFormData({...formData, phone: e.target.value})}
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
            <select
              value={selectedDoctorId || ''}
              onChange={e => setSelectedDoctorId(Number(e.target.value))}
              className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-[#2a2d36] text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all"
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

          {/* Motivo/Queixa */}
          <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">
              Motivo / Queixa
            </label>
            <div className="relative">
              <FileText className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
              <textarea
                value={formData.reason}
                onChange={e => setFormData({...formData, reason: e.target.value})}
                className="w-full pl-9 pr-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-[#2a2d36] text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all resize-none"
                placeholder="Resumo dos sintomas ou motivo da consulta..."
                rows={3}
              />
            </div>
          </div>

          {/* Resumo do Atendimento (somente leitura) */}
          {conversationSummary && (
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">
                Resumo do Atendimento (Chat)
              </label>
              <div className="relative">
                <FileText className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
                <textarea
                  value={conversationSummary}
                  readOnly
                  className="w-full pl-9 pr-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-[#2a2d36]/50 text-gray-600 dark:text-gray-400 resize-none cursor-not-allowed"
                  rows={4}
                />
              </div>
            </div>
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
