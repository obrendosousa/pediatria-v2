'use client';

import { useEffect, useState } from 'react';
import { createSchemaClient } from '@/lib/supabase/schemaClient';
import { X, User, Ban, FileText, Phone, Calendar, Clock, Stethoscope, Loader2, Save, Wallet, Cake } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { isValidISODate, checkTimeConflict, checkBlockConflict } from '@/utils/scheduling/validation';

const supabase = createSchemaClient('atendimento');

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialDate?: string;
  initialTime?: string;
}

export default function AtendimentoNewSlotModal({ isOpen, onClose, onSuccess, initialDate, initialTime }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [slotType, setSlotType] = useState<'booked' | 'blocked'>('booked');
  const [doctors, setDoctors] = useState<Array<{ id: number; name: string }>>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    date: '',
    dateDisplay: '',
    time: '',
    patient_name: '',
    mother_name: '',
    father_name: '',
    parent_phone: '',
    patient_sex: '' as 'M' | 'F' | '',
    birthDateDisplay: '',
    birthDate: '',
    type: '' as 'consulta' | 'retorno' | '',
    notes: '',
    totalAmount: '',
    paidAmount: ''
  });

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
    if (!rawValue) { setFormData(prev => ({ ...prev, [field]: '' })); return; }
    setFormData(prev => ({ ...prev, [field]: formatCurrency(rawValue) }));
  };

  const formatDateToDisplay = (dateStr: string): string => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  const formatDateToISO = (dateStr: string): string => {
    if (!dateStr) return '';
    const cleaned = dateStr.replace(/\D/g, '');
    if (cleaned.length !== 8) return '';
    return `${cleaned.substring(4, 8)}-${cleaned.substring(2, 4)}-${cleaned.substring(0, 2)}`;
  };

  const handleDateMaskedInput = (value: string, displayField: 'dateDisplay' | 'birthDateDisplay', isoField: 'date' | 'birthDate') => {
    const numbers = value.replace(/\D/g, '');
    const limited = numbers.slice(0, 8);
    let formatted = '';
    if (limited.length > 0) {
      formatted = limited.slice(0, 2);
      if (limited.length > 2) formatted += '/' + limited.slice(2, 4);
      if (limited.length > 4) formatted += '/' + limited.slice(4, 8);
    }
    setFormData(prev => ({ ...prev, [displayField]: formatted, [isoField]: formatDateToISO(formatted) }));
  };

  useEffect(() => {
    if (isOpen) {
      (async () => {
        const { data } = await supabase.from('doctors').select('id, name').eq('active', true).order('name');
        if (data && data.length > 0) {
          setDoctors(data);
          setSelectedDoctorId(prev => prev ?? data[0].id);
        }
      })();
      const today = new Date().toISOString().split('T')[0];
      const initialDateValue = initialDate || today;
      setFormData({
        date: initialDateValue,
        dateDisplay: formatDateToDisplay(initialDateValue),
        time: initialTime || '09:00',
        patient_name: '', mother_name: '', father_name: '', parent_phone: '',
        patient_sex: '', birthDateDisplay: '', birthDate: '',
        type: '', notes: '', totalAmount: '', paidAmount: ''
      });
      setSlotType('booked');
    }
  }, [isOpen, initialDate, initialTime]);

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!formData.date || formData.date.length !== 10) { toast.error('Insira uma data valida (DD/MM/AAAA)'); return; }
    if (!isValidISODate(formData.date)) { toast.error('Data invalida (dia/mes incorreto).'); return; }

    if (slotType === 'booked') {
      if (!formData.patient_name.trim()) { toast.error('Preencha o nome do paciente.'); return; }
      if (!selectedDoctorId) { toast.error('Selecione um profissional.'); return; }
      if (!formData.type) { toast.error('Selecione o tipo de atendimento.'); return; }
      if (parseCurrency(formData.totalAmount) <= 0) { toast.error('Informe o valor da consulta.'); return; }
    } else {
      if (!formData.notes.trim()) { toast.error('Informe o motivo do bloqueio.'); return; }
    }

    // Verificar conflitos de horário e bloqueios (apenas para agendamentos)
    if (slotType === 'booked') {
      const doctorIdCheck = selectedDoctorId || doctors[0]?.id;
      if (doctorIdCheck && formData.time) {
        const [conflictResult, blockResult] = await Promise.all([
          checkTimeConflict(supabase, doctorIdCheck, formData.date, formData.time),
          checkBlockConflict(supabase, doctorIdCheck, formData.date, formData.time),
        ]);
        if (conflictResult.hasConflict) {
          const names = conflictResult.conflicts.map(c => c.patient_name || 'Paciente').join(', ');
          toast.error(`Conflito: o profissional ja possui agendamento neste horario (${names}).`);
          return;
        }
        if (blockResult.isBlocked) {
          toast.error(`Horario bloqueado: ${blockResult.blockTitle || 'Bloqueio ativo'}.`);
          return;
        }
      }
    }

    setLoading(true);
    try {
      const doctorIdToUse = selectedDoctorId || doctors[0]?.id;
      if (!doctorIdToUse) { toast.error('Nenhum profissional encontrado.'); setLoading(false); return; }

      const insertData: Record<string, unknown> = {
        doctor_id: doctorIdToUse,
        date: formData.date,
        time: formData.time || null,
        status: slotType === 'booked' ? 'scheduled' : 'blocked',
        notes: formData.notes.trim() || null
      };

      if (slotType === 'booked') {
        // Buscar ou criar paciente na tabela atendimento.patients
        let patientId: number | null = null;
        const { data: existingPatient } = await supabase
          .from('patients')
          .select('id')
          .eq('full_name', formData.patient_name.trim())
          .limit(1)
          .maybeSingle();

        if (existingPatient) {
          patientId = existingPatient.id;
        } else {
          const { data: newPatient } = await supabase
            .from('patients')
            .insert({
              full_name: formData.patient_name.trim(),
              phone: formData.parent_phone.trim() || null,
              birth_date: formData.birthDate || null,
              sex: formData.patient_sex || null
            })
            .select('id')
            .single();
          if (newPatient) patientId = newPatient.id;
        }

        if (patientId) insertData.patient_id = patientId;
        insertData.type = formData.type;
        insertData.mother_name = formData.mother_name.trim() || null;
        insertData.father_name = formData.father_name.trim() || null;
        insertData.parent_name = formData.mother_name.trim() || formData.father_name.trim() || null;
        insertData.parent_phone = formData.parent_phone.trim() || null;
        insertData.consultation_value = parseCurrency(formData.totalAmount) || null;
      }

      const { error } = await supabase.from('appointments').insert(insertData);
      if (error) throw error;

      onSuccess();
      onClose();
      toast.success(slotType === 'booked' ? 'Agendamento criado!' : 'Horario bloqueado!');
    } catch (error: unknown) {
      console.error('Erro ao salvar:', error);
      const pgCode = (error as { code?: string })?.code;
      if (pgCode === '23505') {
        toast.error('Este horário já está ocupado para este profissional. Escolha outro horário.');
      } else {
        toast.error('Erro ao salvar: ' + (error instanceof Error ? error.message : 'Tente novamente.'));
      }
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white dark:bg-[#111118] rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-gray-200 dark:border-[#252530] bg-gray-50 dark:bg-[#1a1a22] flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h3 className="font-bold text-gray-800 dark:text-[#fafafa] flex items-center gap-2">
              <Calendar className="text-blue-600 dark:text-blue-400" size={20}/>
              {slotType === 'booked' ? 'Agendar Paciente' : 'Bloquear Horario'}
            </h3>
            <div className="flex gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
              <button type="button" onClick={() => setSlotType('booked')} className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${slotType === 'booked' ? 'bg-white text-blue-600 shadow-sm dark:bg-[#1a1a22] dark:text-blue-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>
                <User size={14}/> Agendar
              </button>
              <button type="button" onClick={() => setSlotType('blocked')} className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${slotType === 'blocked' ? 'bg-white text-red-600 shadow-sm dark:bg-[#1a1a22] dark:text-red-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>
                <Ban size={14}/> Bloquear
              </button>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition-colors">
            <X size={20} className="text-gray-400 dark:text-[#71717a]"/>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
          {slotType === 'booked' ? (
            <>
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-[#a1a1aa] uppercase mb-1">Nome do Paciente *</label>
                <div className="relative">
                  <User className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
                  <input type="text" value={formData.patient_name} onChange={e => setFormData({...formData, patient_name: e.target.value})} className="w-full pl-9 pr-3 py-2.5 border border-gray-200 dark:border-[#252530] rounded-lg bg-white dark:bg-[#1a1a22] text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" placeholder="Nome do paciente" required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-purple-600 dark:text-purple-400 uppercase mb-1">Nome da Mae</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-purple-400 absolute left-3 top-3.5" />
                    <input type="text" value={formData.mother_name} onChange={e => setFormData({...formData, mother_name: e.target.value})} className="w-full pl-9 pr-3 py-2.5 border border-purple-200 dark:border-purple-800/30 rounded-lg bg-white dark:bg-[#1a1a22] text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all" placeholder="Nome da mae" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-blue-600 dark:text-blue-400 uppercase mb-1">Nome do Pai</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-blue-400 absolute left-3 top-3.5" />
                    <input type="text" value={formData.father_name} onChange={e => setFormData({...formData, father_name: e.target.value})} className="w-full pl-9 pr-3 py-2.5 border border-blue-200 dark:border-blue-800/30 rounded-lg bg-white dark:bg-[#1a1a22] text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" placeholder="Nome do pai" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-[#a1a1aa] uppercase mb-1">Sexo</label>
                  <div className="flex gap-0 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                    <button type="button" onClick={() => setFormData({...formData, patient_sex: 'M'})} className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all shadow-sm ${formData.patient_sex === 'M' ? 'bg-white text-blue-600 shadow-sm dark:bg-[#1a1a22] dark:text-blue-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>Masculino</button>
                    <button type="button" onClick={() => setFormData({...formData, patient_sex: 'F'})} className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all shadow-sm ${formData.patient_sex === 'F' ? 'bg-white text-pink-600 shadow-sm dark:bg-[#1a1a22] dark:text-pink-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>Feminino</button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-[#a1a1aa] uppercase mb-1">Data de Nascimento (DD/MM/AAAA)</label>
                <div className="relative">
                  <Cake className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
                  <input type="text" value={formData.birthDateDisplay} onChange={e => handleDateMaskedInput(e.target.value, 'birthDateDisplay', 'birthDate')} placeholder="DD/MM/AAAA" maxLength={10} className="w-full pl-9 pr-3 py-2.5 border border-gray-200 dark:border-[#252530] rounded-lg bg-white dark:bg-[#1a1a22] text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-[#a1a1aa] uppercase mb-1">Telefone / WhatsApp</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
                  <input type="text" value={formData.parent_phone} onChange={e => setFormData({...formData, parent_phone: e.target.value})} className="w-full pl-9 pr-3 py-2.5 border border-gray-200 dark:border-[#252530] rounded-lg bg-white dark:bg-[#1a1a22] text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" placeholder="11999999999" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-[#a1a1aa] uppercase mb-1">Data * (DD/MM/AAAA)</label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
                    <input type="text" value={formData.dateDisplay} onChange={e => handleDateMaskedInput(e.target.value, 'dateDisplay', 'date')} placeholder="DD/MM/AAAA" maxLength={10} className="w-full pl-9 pr-3 py-2.5 border border-gray-200 dark:border-[#252530] rounded-lg bg-white dark:bg-[#1a1a22] text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" required />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-[#a1a1aa] uppercase mb-1">Horario *</label>
                  <div className="relative">
                    <Clock className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
                    <input type="time" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} className="w-full pl-9 pr-3 py-2.5 border border-gray-200 dark:border-[#252530] rounded-lg bg-white dark:bg-[#1a1a22] text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" required />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-[#a1a1aa] uppercase mb-1">Profissional *</label>
                <div className="relative">
                  <Stethoscope className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
                  <select value={selectedDoctorId || ''} onChange={e => setSelectedDoctorId(Number(e.target.value))} className="w-full pl-9 pr-3 py-2.5 border border-gray-200 dark:border-[#252530] rounded-lg bg-white dark:bg-[#1a1a22] text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" required>
                    {doctors.length === 0 ? <option value="">Carregando...</option> : doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-[#a1a1aa] uppercase mb-1">Tipo de Atendimento *</label>
                <select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value as 'consulta' | 'retorno' | '' })} className="w-full px-3 py-2.5 border border-gray-200 dark:border-[#252530] rounded-lg bg-white dark:bg-[#1a1a22] text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" required>
                  <option value="">Selecione...</option>
                  <option value="consulta">Consulta</option>
                  <option value="retorno">Retorno</option>
                </select>
              </div>

              <div className="bg-slate-50 dark:bg-[#1a1a22]/50 p-4 rounded-xl border border-slate-200 dark:border-[#252530] space-y-4">
                <h4 className="text-sm font-bold text-slate-700 dark:text-[#d4d4d8] flex items-center gap-2"><Wallet className="w-4 h-4 text-emerald-500" /> Financeiro</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-[#a1a1aa] uppercase mb-1">Valor Total (R$)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-gray-500 dark:text-[#a1a1aa] font-bold text-sm">R$</span>
                      <input type="text" value={formData.totalAmount} onChange={e => handleMoneyInput('totalAmount', e.target.value)} className="w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-[#252530] rounded-lg bg-white dark:bg-[#1a1a22] text-gray-700 dark:text-gray-200 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" placeholder="0,00" />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-[#a1a1aa] uppercase mb-1">Observacoes</label>
                <div className="relative">
                  <FileText className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
                  <textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full pl-9 pr-3 py-2.5 border border-gray-200 dark:border-[#252530] rounded-lg bg-white dark:bg-[#1a1a22] text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none" placeholder="Observacoes..." rows={3} />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-[#a1a1aa] uppercase mb-1">Data * (DD/MM/AAAA)</label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
                    <input type="text" value={formData.dateDisplay} onChange={e => handleDateMaskedInput(e.target.value, 'dateDisplay', 'date')} placeholder="DD/MM/AAAA" maxLength={10} className="w-full pl-9 pr-3 py-2.5 border border-gray-200 dark:border-[#252530] rounded-lg bg-white dark:bg-[#1a1a22] text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all" required />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-[#a1a1aa] uppercase mb-1">Horario *</label>
                  <div className="relative">
                    <Clock className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
                    <input type="time" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} className="w-full pl-9 pr-3 py-2.5 border border-gray-200 dark:border-[#252530] rounded-lg bg-white dark:bg-[#1a1a22] text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all" required />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-red-500 dark:text-red-400 uppercase mb-1">Motivo do Bloqueio *</label>
                <div className="relative">
                  <Ban className="w-4 h-4 text-red-400 absolute left-3 top-3.5" />
                  <textarea placeholder="Ex: Almoco, Reuniao..." value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full pl-9 pr-3 py-2.5 border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10 rounded-lg text-sm text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all h-32 resize-none" required />
                </div>
              </div>
            </>
          )}
        </form>

        <div className="p-4 border-t border-gray-200 dark:border-[#252530] bg-gray-50 dark:bg-[#1a1a22] flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-gray-500 dark:text-[#a1a1aa] hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg text-sm font-bold transition-colors">Cancelar</button>
          <button onClick={() => handleSubmit()} disabled={loading} className={`px-6 py-2 text-white rounded-lg text-sm font-bold shadow-lg flex items-center gap-2 transition-colors disabled:opacity-50 ${slotType === 'booked' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'}`}>
            {loading ? <><Loader2 size={16} className="animate-spin"/> Salvando...</> : <><Save size={16}/> {slotType === 'booked' ? 'Salvar' : 'Bloquear'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}
