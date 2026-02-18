'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { logAudit } from '@/lib/audit';
import {
  X, Ban, Edit2, FileText, CalendarDays, Clock, Stethoscope, User, Phone,
  Save, Trash2, Info, Wallet
} from 'lucide-react';
import { saveAppointmentDateTime } from '@/utils/dateUtils';
import { formatDateToDisplay, formatDateToISO, formatCurrency, parseCurrency } from '../utils/agendaUtils';
import { useToast } from '@/contexts/ToastContext';
import ConfirmModal from '@/components/ui/ConfirmModal';

const supabase = createClient();

const initialEditForm = {
  patient_name: '',
  patient_phone: '',
  parent_name: '',
  patient_sex: '' as 'M' | 'F' | '',
  notes: '',
  date: '',
  dateDisplay: '',
  time: '',
  doctor_id: null as number | null,
  status: 'scheduled' as string,
  appointment_type: '' as 'consulta' | 'retorno' | '',
  totalAmount: '',
  paidAmount: ''
};

type AppointmentDetailModalProps = {
  selectedAppointment: Appointment & {
    status: string;
    anamnesis?: string | null;
    total_amount?: number;
    amount_paid?: number;
  };
  setSelectedAppointment: (app: (Appointment & { status: string; anamnesis?: string | null; total_amount?: number; amount_paid?: number }) | null) => void;
  doctors: Array<{ id: number; name: string }>;
  setAppointments: React.Dispatch<React.SetStateAction<Array<Appointment & { status: string; anamnesis?: string | null; total_amount?: number; amount_paid?: number }>>>;
  setWeekAppointments: React.Dispatch<React.SetStateAction<Array<Appointment & { status: string; anamnesis?: string | null; total_amount?: number; amount_paid?: number }>>>;
  onSaveSuccess: () => void;
};

export default function AppointmentDetailModal({
  selectedAppointment,
  setSelectedAppointment,
  doctors,
  setAppointments,
  setWeekAppointments,
  onSaveSuccess
}: AppointmentDetailModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(initialEditForm);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);

  useEffect(() => {
    if (selectedAppointment) {
      const dateStr = selectedAppointment.start_time;
      const cleanDateStr = dateStr ? dateStr.replace(/[+-]\d{2}:\d{2}$/, '').replace('Z', '') : '';
      const [datePart, timePart] = cleanDateStr.split('T');
      setEditForm({
        patient_name: selectedAppointment.patient_name || '',
        patient_phone: selectedAppointment.patient_phone || '',
        parent_name: selectedAppointment.parent_name || '',
        patient_sex: (selectedAppointment.patient_sex as 'M' | 'F' | '') || '',
        notes: selectedAppointment.anamnesis || selectedAppointment.notes || '',
        date: datePart || '',
        dateDisplay: datePart ? formatDateToDisplay(datePart) : '',
        time: timePart ? timePart.substring(0, 5) : '',
        doctor_id: selectedAppointment.doctor_id || null,
        status: selectedAppointment.status || 'scheduled',
        appointment_type: selectedAppointment.appointment_type || '',
        totalAmount: selectedAppointment.total_amount ? formatCurrency(selectedAppointment.total_amount) : '',
        paidAmount: selectedAppointment.amount_paid ? formatCurrency(selectedAppointment.amount_paid) : ''
      });
      setIsEditing(false);
    }
  }, [selectedAppointment]);

  const handleDateInputChange = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    const limited = numbers.slice(0, 8);
    let formatted = '';
    if (limited.length > 0) {
      formatted = limited.slice(0, 2);
      if (limited.length > 2) formatted += '/' + limited.slice(2, 4);
      if (limited.length > 4) formatted += '/' + limited.slice(4, 8);
    }
    setEditForm(prev => ({
      ...prev,
      dateDisplay: formatted,
      date: formatDateToISO(formatted)
    }));
  };

  const handleMoneyInput = (field: 'totalAmount' | 'paidAmount', value: string) => {
    const rawValue = value.replace(/\D/g, '');
    if (!rawValue) {
      setEditForm(prev => ({ ...prev, [field]: '' }));
      return;
    }
    const amount = Number(rawValue) / 100;
    setEditForm(prev => ({ ...prev, [field]: amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }));
  };

  const handleSaveEdit = async () => {
    if (!selectedAppointment) return;
    if (!editForm.date || editForm.date.length !== 10) {
      toast.error('Por favor, insira uma data válida no formato DD/MM/AAAA');
      return;
    }
    if (!editForm.time) {
      toast.error('Por favor, insira um horário válido');
      return;
    }
    if (!editForm.doctor_id) {
      toast.error('Por favor, selecione um médico');
      return;
    }
    try {
      const selectedDoctor = doctors.find(d => d.id === editForm.doctor_id);
      if (!selectedDoctor) throw new Error('Médico não encontrado');
      const start_time = saveAppointmentDateTime(editForm.date, editForm.time);
      const totalNum = parseCurrency(editForm.totalAmount);
      const paidNum = parseCurrency(editForm.paidAmount);
      const updateData: Record<string, unknown> = {
        patient_name: editForm.patient_name,
        patient_phone: editForm.patient_phone || null,
        notes: editForm.notes || null,
        anamnesis: editForm.notes || null,
        start_time,
        doctor_id: editForm.doctor_id,
        doctor_name: selectedDoctor.name,
        status: editForm.status,
        appointment_type: editForm.appointment_type || null,
        total_amount: totalNum,
        amount_paid: paidNum
      };
      if (editForm.parent_name) updateData.parent_name = editForm.parent_name;
      if (editForm.patient_sex) updateData.patient_sex = editForm.patient_sex;
      const { error } = await supabase.from('appointments').update(updateData).eq('id', selectedAppointment.id);
      if (error) throw error;
      if (user?.id) await logAudit({ userId: user.id, action: 'update', entityType: 'appointment', entityId: String(selectedAppointment.id), details: { patient_name: editForm.patient_name } });
      const updatedApp = { ...selectedAppointment, ...updateData, start_time };
      setSelectedAppointment(updatedApp);
      setAppointments(prev => prev.map(a => a.id === updatedApp.id ? updatedApp : a));
      setWeekAppointments(prev => prev.map(a => a.id === updatedApp.id ? updatedApp : a));
      setIsEditing(false);
      onSaveSuccess();
      toast.success('Agendamento atualizado com sucesso!');
    } catch (err: unknown) {
      console.error('Erro ao salvar edição:', err);
      toast.error('Erro ao salvar: ' + ((err instanceof Error ? err.message : '') || 'Tente novamente.'));
    }
  };

  const handleDeleteAppointmentClick = () => {
    setConfirmCancelOpen(true);
  };

  const handleDeleteAppointmentConfirm = async () => {
    if (!selectedAppointment) return;
    setConfirmCancelOpen(false);
    try {
      const { error } = await supabase.from('appointments').delete().eq('id', selectedAppointment.id);
      if (error) throw error;
      if (user?.id) await logAudit({ userId: user.id, action: 'delete', entityType: 'appointment', entityId: String(selectedAppointment.id), details: { patient_name: selectedAppointment.patient_name } });
      setAppointments(prev => prev.filter(a => a.id !== selectedAppointment.id));
      setWeekAppointments(prev => prev.filter(a => a.id !== selectedAppointment.id));
      setSelectedAppointment(null);
      toast.success('Agendamento cancelado com sucesso!');
      onSaveSuccess();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao cancelar agendamento.');
    }
  };

  const totalDisplay = selectedAppointment?.total_amount || 0;
  const paidDisplay = selectedAppointment?.amount_paid || 0;
  const remainingDisplay = Math.max(0, totalDisplay - paidDisplay);
  const editTotalNum = parseCurrency(editForm.totalAmount);
  const editPaidNum = parseCurrency(editForm.paidAmount);
  const editRemaining = Math.max(0, editTotalNum - editPaidNum);

  return (
    <>
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-[#202c33] w-full max-w-lg rounded-2xl shadow-lg border border-slate-200 dark:border-gray-700 overflow-hidden animate-scale-in">
        <div className={`p-4 border-b border-slate-200 dark:border-gray-700 flex justify-between items-center ${
          selectedAppointment.status === 'blocked' ? 'bg-red-50/50 dark:bg-red-900/10'
            : selectedAppointment.patient_sex === 'M' ? 'bg-blue-50/50 dark:bg-blue-900/10'
            : selectedAppointment.patient_sex === 'F' ? 'bg-pink-50/50 dark:bg-pink-900/10'
            : 'bg-indigo-50/50 dark:bg-indigo-900/10'
        }`}>
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg ${
              selectedAppointment.status === 'blocked' ? 'bg-red-100 dark:bg-red-900/20 text-red-500 dark:text-red-400'
                : selectedAppointment.patient_sex === 'M' ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-500 dark:text-blue-400'
                : selectedAppointment.patient_sex === 'F' ? 'bg-pink-100 dark:bg-pink-900/20 text-pink-500 dark:text-pink-400'
                : 'bg-indigo-100 dark:bg-indigo-900/20 text-indigo-500 dark:text-indigo-400'
            }`}>
              <Info size={16}/>
            </div>
            <h3 className="text-base font-semibold text-slate-700 dark:text-gray-200">
              {isEditing ? 'Editar Agendamento' : 'Detalhes do Agendamento'}
            </h3>
          </div>
          <button onClick={() => setSelectedAppointment(null)} className="p-1.5 hover:bg-white/60 dark:hover:bg-white/10 rounded-lg transition-colors">
            <X size={18} className="text-slate-400 dark:text-gray-500"/>
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-200 dark:border-gray-700">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-semibold text-lg ${
              selectedAppointment.status === 'blocked' ? 'bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                : selectedAppointment.patient_sex === 'M' ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                : selectedAppointment.patient_sex === 'F' ? 'bg-pink-100 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400'
                : 'bg-indigo-100 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-300'
            }`}>
              {isEditing ? <Edit2 size={18}/> : (selectedAppointment.status === 'blocked' ? <Ban size={18}/> : (selectedAppointment.patient_name?.charAt(0) || 'P'))}
            </div>
            <div className="flex-1">
              {isEditing ? (
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-500 dark:text-gray-400 uppercase">Nome do Paciente</label>
                  <input type="text" className="w-full text-sm font-medium text-slate-800 dark:text-gray-100 border border-slate-200 dark:border-gray-600 rounded-lg px-3 py-1.5 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/20 outline-none bg-white dark:bg-[#2a2d36] transition-all" value={editForm.patient_name} onChange={(e) => setEditForm({ ...editForm, patient_name: e.target.value })} placeholder="Digite o nome..." />
                </div>
              ) : (
                <>
                  <h4 className="text-base font-semibold text-slate-800 dark:text-gray-100 mb-1.5">
                    {selectedAppointment.status === 'blocked' ? 'Horário Bloqueado' : (selectedAppointment.patient_name || 'Paciente sem nome')}
                  </h4>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md ${
                      selectedAppointment.status === 'blocked' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                        : selectedAppointment.status === 'scheduled' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                        : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    }`}>
                      {selectedAppointment.status === 'blocked' ? 'BLOQUEIO' : (selectedAppointment.status === 'scheduled' ? 'AGENDADO' : selectedAppointment.status)}
                    </span>
                    {selectedAppointment.patient_sex && (
                      <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md ${
                        selectedAppointment.patient_sex === 'M' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300'
                      }`}>
                        {selectedAppointment.patient_sex === 'M' ? 'MASCULINO' : 'FEMININO'}
                      </span>
                    )}
                  </div>
                </>
              )}
              {isEditing && (
                <div className="space-y-2 mt-2">
                  <div>
                    <label className="text-[10px] font-semibold text-slate-500 dark:text-gray-400 uppercase">Sexo da Criança</label>
                    <div className="flex gap-0 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg mt-1">
                      <button type="button" onClick={() => setEditForm({ ...editForm, patient_sex: 'M' })} className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${editForm.patient_sex === 'M' ? 'bg-white text-blue-600 shadow-sm dark:bg-[#2a2d36] dark:text-blue-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>Masculino</button>
                      <button type="button" onClick={() => setEditForm({ ...editForm, patient_sex: 'F' })} className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${editForm.patient_sex === 'F' ? 'bg-white text-pink-600 shadow-sm dark:bg-[#2a2d36] dark:text-pink-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>Feminino</button>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-slate-500 dark:text-gray-400 uppercase">Status</label>
                    <select value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })} className="w-full text-xs font-medium text-slate-700 dark:text-gray-200 border border-slate-200 dark:border-gray-600 rounded-md px-2 py-1.5 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/20 outline-none bg-white dark:bg-[#2a2d36] transition-all mt-1">
                      <option value="scheduled">Agendado</option><option value="waiting">Na Espera</option><option value="in_service">Em Atendimento</option><option value="finished">Finalizado</option><option value="blocked">Bloqueado</option><option value="cancelled">Cancelado</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-slate-500 dark:text-gray-400 uppercase">Tipo</label>
                    <select
                      value={editForm.appointment_type}
                      onChange={e => setEditForm({ ...editForm, appointment_type: e.target.value as 'consulta' | 'retorno' | '' })}
                      className="w-full text-xs font-medium text-slate-700 dark:text-gray-200 border border-slate-200 dark:border-gray-600 rounded-md px-2 py-1.5 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/20 outline-none bg-white dark:bg-[#2a2d36] transition-all mt-1"
                    >
                      <option value="">Não definido</option>
                      <option value="consulta">Consulta</option>
                      <option value="retorno">Retorno</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-slate-50 dark:bg-[#1a1f28] rounded-lg border border-slate-200 dark:border-gray-700">
              <div className="flex items-center gap-1.5 mb-1.5"><CalendarDays size={14} className="text-indigo-500 dark:text-indigo-400"/><span className="text-[10px] font-semibold text-slate-500 dark:text-gray-400 uppercase">Data</span></div>
              {isEditing ? (
                <input type="text" value={editForm.dateDisplay} onChange={e => handleDateInputChange(e.target.value)} placeholder="DD/MM/AAAA" maxLength={10} className="w-full text-sm font-semibold text-slate-700 dark:text-gray-200 border border-slate-200 dark:border-gray-600 rounded-md px-2 py-1.5 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/20 outline-none bg-white dark:bg-[#2a2d36] transition-all" />
              ) : (
                <p className="text-sm font-semibold text-slate-700 dark:text-gray-200">{new Date(selectedAppointment.start_time).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
              )}
            </div>
            <div className="p-3 bg-slate-50 dark:bg-[#1a1f28] rounded-lg border border-slate-200 dark:border-gray-700">
              <div className="flex items-center gap-1.5 mb-1.5"><Clock size={14} className="text-indigo-500 dark:text-indigo-400"/><span className="text-[10px] font-semibold text-slate-500 dark:text-gray-400 uppercase">Horário</span></div>
              {isEditing ? (
                <input type="time" value={editForm.time} onChange={e => setEditForm({ ...editForm, time: e.target.value })} className="w-full text-sm font-semibold text-slate-700 dark:text-gray-200 border border-slate-200 dark:border-gray-600 rounded-md px-2 py-1.5 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/20 outline-none bg-white dark:bg-[#2a2d36] transition-all" />
              ) : (
                <p className="text-sm font-semibold text-slate-700 dark:text-gray-200">
                  {(() => {
                    const dateStr = selectedAppointment.start_time;
                    const cleanDateStr = dateStr ? dateStr.replace(/[+-]\d{2}:\d{2}$/, '').replace('Z', '') : '';
                    const [datePart, timePart] = cleanDateStr.split('T');
                    if (datePart && timePart) {
                      const [y, m, d] = datePart.split('-').map(Number);
                      const [hours, minutes] = timePart.split(':').map(Number);
                      const dLocal = new Date(y, m - 1, d, hours, minutes || 0, 0);
                      return dLocal.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false });
                    }
                    return '00:00';
                  })()}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2.5 p-2.5 bg-slate-50 dark:bg-[#1a1f28] rounded-lg border border-slate-200 dark:border-gray-700">
              <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/20 text-indigo-500 dark:text-indigo-400 rounded-md"><Stethoscope size={14}/></div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold text-slate-500 dark:text-gray-400 uppercase">Médico</p>
                {isEditing ? (
                  <select value={editForm.doctor_id || ''} onChange={e => setEditForm({ ...editForm, doctor_id: Number(e.target.value) })} className="w-full text-sm text-slate-700 dark:text-gray-200 font-medium border border-slate-200 dark:border-gray-600 rounded-md px-2 py-1.5 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/20 outline-none bg-white dark:bg-[#2a2d36] transition-all">
                    <option value="">Selecione...</option>
                    {doctors.map(doctor => (<option key={doctor.id} value={doctor.id}>{doctor.name}</option>))}
                  </select>
                ) : (
                  <p className="text-sm text-slate-700 dark:text-gray-200 font-medium truncate">{selectedAppointment.doctor_name || 'Não informado'}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2.5 p-2.5 bg-slate-50 dark:bg-[#1a1f28] rounded-lg border border-slate-200 dark:border-gray-700">
              <div className="p-1.5 bg-purple-100 dark:bg-purple-900/20 text-purple-500 dark:text-purple-400 rounded-md"><User size={14}/></div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold text-slate-500 dark:text-gray-400 uppercase">Responsável</p>
                {isEditing ? (
                  <input type="text" value={editForm.parent_name} onChange={e => setEditForm({ ...editForm, parent_name: e.target.value })} placeholder="Nome do responsável" className="w-full text-sm text-slate-700 dark:text-gray-200 font-medium border border-slate-200 dark:border-gray-600 rounded-md px-2 py-1.5 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/20 outline-none bg-white dark:bg-[#2a2d36] transition-all" />
                ) : (
                  <p className="text-sm text-slate-700 dark:text-gray-200 font-medium truncate">{selectedAppointment.parent_name || 'Não informado'}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2.5 p-2.5 bg-slate-50 dark:bg-[#1a1f28] rounded-lg border border-slate-200 dark:border-gray-700">
              <div className="p-1.5 bg-green-100 dark:bg-green-900/20 text-green-500 dark:text-green-400 rounded-md"><Phone size={14}/></div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold text-slate-500 dark:text-gray-400 uppercase">WhatsApp</p>
                {isEditing ? (
                  <input type="text" className="w-full text-sm font-medium text-slate-700 dark:text-gray-200 border border-slate-200 dark:border-gray-600 rounded-md px-2 py-1 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/20 outline-none bg-white dark:bg-[#2a2d36] transition-all" value={editForm.patient_phone} onChange={(e) => setEditForm({ ...editForm, patient_phone: e.target.value })} placeholder="Ex: (99) 99999-9999" />
                ) : (
                  <p className="text-sm text-slate-700 dark:text-gray-200 font-medium">{selectedAppointment.patient_phone ? selectedAppointment.patient_phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3') : 'Não informado'}</p>
                )}
              </div>
            </div>
          </div>

          {selectedAppointment.status !== 'blocked' && (
            <div className="bg-slate-50 dark:bg-[#1a1f28] p-3 rounded-xl border border-slate-200 dark:border-gray-700">
              <h5 className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1"><Wallet size={12}/> Financeiro</h5>
              {isEditing ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase">Total (R$)</label>
                    <input type="text" value={editForm.totalAmount} onChange={e => handleMoneyInput('totalAmount', e.target.value)} className="w-full text-sm font-bold border border-slate-200 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-[#2a2d36] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase">Pago (R$)</label>
                    <input type="text" value={editForm.paidAmount} onChange={e => handleMoneyInput('paidAmount', e.target.value)} className="w-full text-sm font-bold border border-emerald-200 dark:border-emerald-800 rounded px-2 py-1 bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400" />
                  </div>
                  <div className="col-span-2 text-right text-xs font-bold text-slate-500 dark:text-gray-400 border-t border-slate-200 dark:border-gray-700 pt-2 mt-1">
                    Restante a pagar: <span className={editRemaining > 0 ? 'text-rose-500 dark:text-rose-400 text-sm' : 'text-emerald-500 dark:text-emerald-400 text-sm'}>R$ {editRemaining.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              ) : (
                <div className="flex justify-between items-center bg-white dark:bg-black/20 p-2.5 rounded-lg border border-slate-100 dark:border-gray-700">
                  <div><p className="text-[10px] text-slate-400 uppercase font-semibold">Valor Total</p><p className="text-sm font-bold text-slate-700 dark:text-gray-200">R$ {totalDisplay.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
                  <div className="text-right"><p className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70 uppercase font-semibold">Valor Pago</p><p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">R$ {paidDisplay.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
                  <div className="text-right pl-4 border-l border-slate-100 dark:border-gray-700 ml-4"><p className="text-[10px] text-slate-400 uppercase font-semibold">Falta</p><p className={`text-sm font-black ${remainingDisplay > 0 ? 'text-rose-500 dark:text-rose-400' : 'text-slate-400 dark:text-gray-500'}`}>R$ {remainingDisplay.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
                </div>
              )}
            </div>
          )}

          <div className="p-3 bg-indigo-50/30 dark:bg-indigo-900/5 rounded-lg border border-indigo-200/30 dark:border-indigo-800/20">
            <div className="flex items-center gap-2 mb-2"><FileText size={14} className="text-indigo-500 dark:text-indigo-400"/><p className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-300 uppercase">Anamnese / Observações</p></div>
            {isEditing ? (
              <textarea className="w-full p-2.5 text-sm text-slate-700 dark:text-gray-200 border border-indigo-200 dark:border-indigo-800/30 rounded-lg focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/20 outline-none bg-white dark:bg-[#1a1f28] min-h-[80px] resize-y transition-all" value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} placeholder="Digite as observações..." />
            ) : (
              <div className="p-2.5 bg-white/60 dark:bg-[#1a1f28]/60 rounded-lg">
                <p className="text-xs text-slate-600 dark:text-gray-300 leading-relaxed">{selectedAppointment.anamnesis || selectedAppointment.notes || 'Nenhuma observação registrada.'}</p>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 bg-slate-50/50 dark:bg-[#1e2028] border-t border-slate-200 dark:border-gray-700 flex gap-2">
          {isEditing ? (
            <>
              <button onClick={() => setIsEditing(false)} className="flex-1 bg-white dark:bg-[#2a2d36] border border-slate-300 dark:border-gray-600 text-slate-600 dark:text-gray-300 py-2 rounded-lg text-xs font-semibold hover:bg-slate-50 dark:hover:bg-white/10 transition-colors">Cancelar</button>
              <button onClick={handleSaveEdit} className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center justify-center gap-1.5"><Save size={14}/> Salvar</button>
            </>
          ) : (
            <>
              <button onClick={handleDeleteAppointmentClick} className="px-3 bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center justify-center gap-1.5"><Trash2 size={14}/> Cancelar</button>
              <button onClick={() => setIsEditing(true)} className="flex-1 bg-white dark:bg-[#2a2d36] border border-slate-300 dark:border-gray-600 text-slate-600 dark:text-gray-300 py-2 rounded-lg text-xs font-semibold hover:bg-slate-50 dark:hover:bg-white/10 transition-colors flex items-center justify-center gap-1.5"><Edit2 size={14}/> Editar</button>
              <button onClick={() => setSelectedAppointment(null)} className="flex-1 bg-rose-500 hover:bg-rose-600 text-white py-2 rounded-lg text-xs font-semibold shadow-sm transition-colors">Fechar</button>
            </>
          )}
        </div>
      </div>
    </div>
    <ConfirmModal
      isOpen={confirmCancelOpen}
      onClose={() => setConfirmCancelOpen(false)}
      onConfirm={handleDeleteAppointmentConfirm}
      title={selectedAppointment?.status === 'blocked' ? 'Remover bloqueio' : 'Cancelar agendamento'}
      message={selectedAppointment ? (selectedAppointment.status === 'blocked'
        ? 'Deseja realmente remover este bloqueio?'
        : `Deseja realmente cancelar o agendamento de ${selectedAppointment.patient_name || 'este paciente'}?`) : ''}
      type="danger"
      confirmText="Sim"
    />
    </>
  );
}
