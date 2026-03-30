'use client';

import { useEffect, useState } from 'react';
import { createSchemaClient } from '@/lib/supabase/schemaClient';
import { useToast } from '@/contexts/ToastContext';
import {
  X, Ban, Edit2, FileText, CalendarDays, Clock, Stethoscope, User, Phone,
  Save, Trash2, Info, Wallet
} from 'lucide-react';
import { formatDateToDisplay, formatDateToISO, formatCurrency, parseCurrency } from '@/app/agenda/utils/agendaUtils';
import { getValidNextStatuses, isValidTransition } from '@/config/scheduling/statusTransitions';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { effectiveAmount } from '@/utils/discountUtils';

const supabase = createSchemaClient('atendimento');

type AtendimentoAppointment = {
  id: number;
  date: string;
  time: string | null;
  patient_id?: number | null;
  doctor_id: number | null;
  doctor_name?: string;
  type?: string | null;
  status: string;
  notes?: string | null;
  parent_name?: string | null;
  mother_name?: string | null;
  father_name?: string | null;
  parent_phone?: string | null;
  consultation_value?: number | null;
  patient_name?: string | null;
  patient_phone?: string | null;
  patient_sex?: 'M' | 'F' | null;
  total_amount?: number;
  amount_paid?: number;
  discount_type?: '%' | 'R$' | null;
  discount_value?: number | null;
  discount_amount?: number | null;
};

type Props = {
  selectedAppointment: AtendimentoAppointment;
  setSelectedAppointment: (app: AtendimentoAppointment | null) => void;
  doctors: Array<{ id: number; name: string }>;
  onSaveSuccess: () => void;
};

const initialEditForm = {
  patient_name: '',
  mother_name: '',
  father_name: '',
  parent_phone: '',
  patient_sex: '' as 'M' | 'F' | '',
  notes: '',
  date: '',
  dateDisplay: '',
  time: '',
  doctor_id: null as number | null,
  status: 'scheduled' as string,
  type: '' as string,
  totalAmount: '',
  paidAmount: ''
};

export default function AtendimentoDetailModal({ selectedAppointment, setSelectedAppointment, doctors, onSaveSuccess }: Props) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState(initialEditForm);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);

  const handleDateMaskedInput = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    const limited = numbers.slice(0, 8);
    let formatted = '';
    if (limited.length > 0) {
      formatted = limited.slice(0, 2);
      if (limited.length > 2) formatted += '/' + limited.slice(2, 4);
      if (limited.length > 4) formatted += '/' + limited.slice(4, 8);
    }
    setEditForm(prev => ({ ...prev, dateDisplay: formatted, date: formatDateToISO(formatted) }));
  };

  const handleMoneyInput = (field: 'totalAmount' | 'paidAmount', value: string) => {
    const rawValue = value.replace(/\D/g, '');
    if (!rawValue) { setEditForm(prev => ({ ...prev, [field]: '' })); return; }
    const amount = Number(rawValue) / 100;
    setEditForm(prev => ({ ...prev, [field]: amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }));
  };

  useEffect(() => {
    if (selectedAppointment) {
      const doctorName = doctors.find(d => d.id === selectedAppointment.doctor_id)?.name || '';
      setEditForm({
        patient_name: selectedAppointment.patient_name || '',
        mother_name: selectedAppointment.mother_name || '',
        father_name: selectedAppointment.father_name || '',
        parent_phone: selectedAppointment.parent_phone || selectedAppointment.patient_phone || '',
        patient_sex: (selectedAppointment.patient_sex as 'M' | 'F' | '') || '',
        notes: selectedAppointment.notes || '',
        date: selectedAppointment.date || '',
        dateDisplay: selectedAppointment.date ? formatDateToDisplay(selectedAppointment.date) : '',
        time: selectedAppointment.time ? selectedAppointment.time.substring(0, 5) : '',
        doctor_id: selectedAppointment.doctor_id || null,
        status: selectedAppointment.status || 'scheduled',
        type: selectedAppointment.type || '',
        totalAmount: selectedAppointment.consultation_value ? formatCurrency(selectedAppointment.consultation_value) : '',
        paidAmount: selectedAppointment.amount_paid ? formatCurrency(selectedAppointment.amount_paid) : ''
      });
      if (!selectedAppointment.doctor_name && doctorName) {
        selectedAppointment.doctor_name = doctorName;
      }
      setIsEditing(false);
    }
  }, [selectedAppointment, doctors]);

  const handleSaveEdit = async () => {
    if (!selectedAppointment || isSaving) return;
    if (!editForm.date || editForm.date.length !== 10) { toast.error('Data invalida'); return; }
    if (!editForm.doctor_id) { toast.error('Selecione um profissional'); return; }
    if (editForm.status !== selectedAppointment.status && !isValidTransition(selectedAppointment.status, editForm.status)) {
      toast.error('Transicao de status nao permitida.'); return;
    }

    setIsSaving(true);
    try {
      const updateData: Record<string, unknown> = {
        notes: editForm.notes || null,
        date: editForm.date,
        time: editForm.time || null,
        doctor_id: editForm.doctor_id,
        status: editForm.status,
        type: editForm.type || null,
        mother_name: editForm.mother_name || null,
        father_name: editForm.father_name || null,
        parent_name: editForm.mother_name || editForm.father_name || null,
        parent_phone: editForm.parent_phone || null,
        consultation_value: parseCurrency(editForm.totalAmount) || null
      };

      const { error } = await supabase.from('appointments').update(updateData).eq('id', selectedAppointment.id);
      if (error) throw error;

      setSelectedAppointment({ ...selectedAppointment, ...updateData } as AtendimentoAppointment);
      setIsEditing(false);
      onSaveSuccess();
      toast.success('Agendamento atualizado!');
    } catch (err: unknown) {
      console.error('Erro ao salvar:', err);
      toast.error('Erro ao salvar: ' + (err instanceof Error ? err.message : 'Tente novamente.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedAppointment) return;
    setConfirmCancelOpen(false);
    try {
      const { error } = await supabase.from('appointments').delete().eq('id', selectedAppointment.id);
      if (error) throw error;
      setSelectedAppointment(null);
      toast.success('Agendamento removido!');
      onSaveSuccess();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao remover agendamento.');
    }
  };

  const totalDisplay = selectedAppointment?.consultation_value ?? selectedAppointment?.total_amount ?? 0;
  const discountDisplay = selectedAppointment?.discount_amount ?? 0;
  const effectiveTotalDisplay = effectiveAmount(totalDisplay, discountDisplay);
  const paidDisplay = selectedAppointment?.amount_paid ?? 0;
  const remainingDisplay = Math.max(0, effectiveTotalDisplay - paidDisplay);
  const editTotalNum = parseCurrency(editForm.totalAmount);
  const editPaidNum = parseCurrency(editForm.paidAmount);
  const editRemaining = Math.max(0, editTotalNum - editPaidNum);

  const doctorName = doctors.find(d => d.id === selectedAppointment.doctor_id)?.name || selectedAppointment.doctor_name || 'Nao informado';
  const displayTime = selectedAppointment.time ? selectedAppointment.time.substring(0, 5) : '00:00';

  const statusLabels: Record<string, string> = {
    scheduled: 'AGENDADO', confirmed: 'CONFIRMADO', waiting: 'SALA DE ESPERA',
    called: 'CHAMADO', in_service: 'EM ATENDIMENTO', waiting_payment: 'AGUARDANDO PAGAMENTO',
    finished: 'ATENDIDO', late: 'ATRASADO', no_show: 'FALTOU', cancelled: 'CANCELADO',
    unmarked: 'DESMARCADO', not_attended: 'NAO ATENDIDO', rescheduled: 'REAGENDADO', blocked: 'BLOQUEIO'
  };

  return (
    <>
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-[#1a1a22] w-full max-w-lg rounded-2xl shadow-lg border border-slate-200 dark:border-[#252530] overflow-hidden animate-scale-in">
        <div className={`p-4 border-b border-slate-200 dark:border-[#252530] flex justify-between items-center ${
          selectedAppointment.status === 'blocked' ? 'bg-red-50/50 dark:bg-red-900/10' : 'bg-blue-50/50 dark:bg-blue-900/10'
        }`}>
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg ${selectedAppointment.status === 'blocked' ? 'bg-red-100 dark:bg-red-900/20 text-red-500' : 'bg-blue-100 dark:bg-blue-900/20 text-blue-500 dark:text-blue-400'}`}>
              <Info size={16}/>
            </div>
            <h3 className="text-base font-semibold text-slate-700 dark:text-gray-200">
              {isEditing ? 'Editar Agendamento' : 'Detalhes do Agendamento'}
            </h3>
          </div>
          <button onClick={() => setSelectedAppointment(null)} className="p-1.5 hover:bg-white/60 dark:hover:bg-white/10 rounded-lg transition-colors">
            <X size={18} className="text-slate-400 dark:text-[#71717a]"/>
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-200 dark:border-[#252530]">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-semibold text-lg ${
              selectedAppointment.status === 'blocked' ? 'bg-red-100 dark:bg-red-900/20 text-red-600' : 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
            }`}>
              {isEditing ? <Edit2 size={18}/> : (selectedAppointment.status === 'blocked' ? <Ban size={18}/> : (selectedAppointment.patient_name?.charAt(0) || 'P'))}
            </div>
            <div className="flex-1">
              {isEditing ? (
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-500 dark:text-[#a1a1aa] uppercase">Nome do Paciente</label>
                  <input type="text" className="w-full text-sm font-medium text-slate-800 dark:text-[#fafafa] border border-slate-200 dark:border-gray-600 rounded-lg px-3 py-1.5 focus:border-blue-400 focus:ring-1 focus:ring-blue-400/20 outline-none bg-white dark:bg-[#1a1a22] transition-all" value={editForm.patient_name} onChange={(e) => setEditForm({ ...editForm, patient_name: e.target.value })} />
                </div>
              ) : (
                <>
                  <h4 className="text-base font-semibold text-slate-800 dark:text-[#fafafa] mb-1.5">
                    {selectedAppointment.status === 'blocked' ? 'Horario Bloqueado' : (selectedAppointment.patient_name || 'Paciente sem nome')}
                  </h4>
                  <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md ${
                    selectedAppointment.status === 'blocked' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                      : selectedAppointment.status === 'scheduled' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : selectedAppointment.status === 'confirmed' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                      : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  }`}>
                    {statusLabels[selectedAppointment.status] || selectedAppointment.status.toUpperCase()}
                  </span>
                </>
              )}
              {isEditing && (
                <div className="space-y-2 mt-2">
                  <div>
                    <label className="text-[10px] font-semibold text-slate-500 dark:text-[#a1a1aa] uppercase">Status</label>
                    <select value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })} className="w-full text-xs font-medium text-slate-700 dark:text-gray-200 border border-slate-200 dark:border-gray-600 rounded-md px-2 py-1.5 focus:border-blue-400 focus:ring-1 focus:ring-blue-400/20 outline-none bg-white dark:bg-[#1a1a22] mt-1">
                      <option value={selectedAppointment.status}>{statusLabels[selectedAppointment.status] || selectedAppointment.status}</option>
                      {getValidNextStatuses(selectedAppointment.status).map(k => (
                        <option key={k} value={k}>{statusLabels[k] || k}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-slate-500 dark:text-[#a1a1aa] uppercase">Tipo</label>
                    <select value={editForm.type} onChange={e => setEditForm({ ...editForm, type: e.target.value })} className="w-full text-xs font-medium text-slate-700 dark:text-gray-200 border border-slate-200 dark:border-gray-600 rounded-md px-2 py-1.5 focus:border-blue-400 focus:ring-1 focus:ring-blue-400/20 outline-none bg-white dark:bg-[#1a1a22] mt-1">
                      <option value="">Nao definido</option><option value="consulta">Consulta</option><option value="retorno">Retorno</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-slate-50 dark:bg-[#1a1f28] rounded-lg border border-slate-200 dark:border-[#252530]">
              <div className="flex items-center gap-1.5 mb-1.5"><CalendarDays size={14} className="text-blue-500 dark:text-blue-400"/><span className="text-[10px] font-semibold text-slate-500 dark:text-[#a1a1aa] uppercase">Data</span></div>
              {isEditing ? (
                <input type="text" value={editForm.dateDisplay} onChange={e => handleDateMaskedInput(e.target.value)} placeholder="DD/MM/AAAA" maxLength={10} className="w-full text-sm font-semibold text-slate-700 dark:text-gray-200 border border-slate-200 dark:border-gray-600 rounded-md px-2 py-1.5 focus:border-blue-400 focus:ring-1 focus:ring-blue-400/20 outline-none bg-white dark:bg-[#1a1a22]" />
              ) : (
                <p className="text-sm font-semibold text-slate-700 dark:text-gray-200">{selectedAppointment.date ? formatDateToDisplay(selectedAppointment.date) : 'N/A'}</p>
              )}
            </div>
            <div className="p-3 bg-slate-50 dark:bg-[#1a1f28] rounded-lg border border-slate-200 dark:border-[#252530]">
              <div className="flex items-center gap-1.5 mb-1.5"><Clock size={14} className="text-blue-500 dark:text-blue-400"/><span className="text-[10px] font-semibold text-slate-500 dark:text-[#a1a1aa] uppercase">Horario</span></div>
              {isEditing ? (
                <input type="time" value={editForm.time} onChange={e => setEditForm({ ...editForm, time: e.target.value })} className="w-full text-sm font-semibold text-slate-700 dark:text-gray-200 border border-slate-200 dark:border-gray-600 rounded-md px-2 py-1.5 focus:border-blue-400 focus:ring-1 focus:ring-blue-400/20 outline-none bg-white dark:bg-[#1a1a22]" />
              ) : (
                <p className="text-sm font-semibold text-slate-700 dark:text-gray-200">{displayTime}</p>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2.5 p-2.5 bg-slate-50 dark:bg-[#1a1f28] rounded-lg border border-slate-200 dark:border-[#252530]">
              <div className="p-1.5 bg-blue-100 dark:bg-blue-900/20 text-blue-500 dark:text-blue-400 rounded-md"><Stethoscope size={14}/></div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold text-slate-500 dark:text-[#a1a1aa] uppercase">Profissional</p>
                {isEditing ? (
                  <select value={editForm.doctor_id || ''} onChange={e => setEditForm({ ...editForm, doctor_id: Number(e.target.value) })} className="w-full text-sm text-slate-700 dark:text-gray-200 font-medium border border-slate-200 dark:border-gray-600 rounded-md px-2 py-1.5 focus:border-blue-400 focus:ring-1 focus:ring-blue-400/20 outline-none bg-white dark:bg-[#1a1a22]">
                    <option value="">Selecione...</option>
                    {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                ) : (
                  <p className="text-sm text-slate-700 dark:text-gray-200 font-medium truncate">{doctorName}</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2.5 p-2.5 bg-slate-50 dark:bg-[#1a1f28] rounded-lg border border-purple-200/50 dark:border-purple-800/20">
                <div className="p-1.5 bg-purple-100 dark:bg-purple-900/20 text-purple-500 dark:text-purple-400 rounded-md"><User size={14}/></div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 uppercase">Mae</p>
                  {isEditing ? (
                    <input type="text" value={editForm.mother_name} onChange={e => setEditForm({ ...editForm, mother_name: e.target.value })} placeholder="Nome da mae" className="w-full text-sm text-slate-700 dark:text-gray-200 font-medium border border-slate-200 dark:border-gray-600 rounded-md px-2 py-1.5 focus:border-purple-400 focus:ring-1 focus:ring-purple-400/20 outline-none bg-white dark:bg-[#1a1a22]" />
                  ) : (
                    <p className="text-sm text-slate-700 dark:text-gray-200 font-medium truncate">{selectedAppointment.mother_name || 'Nao informado'}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2.5 p-2.5 bg-slate-50 dark:bg-[#1a1f28] rounded-lg border border-blue-200/50 dark:border-blue-800/20">
                <div className="p-1.5 bg-blue-100 dark:bg-blue-900/20 text-blue-500 dark:text-blue-400 rounded-md"><User size={14}/></div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase">Pai</p>
                  {isEditing ? (
                    <input type="text" value={editForm.father_name} onChange={e => setEditForm({ ...editForm, father_name: e.target.value })} placeholder="Nome do pai" className="w-full text-sm text-slate-700 dark:text-gray-200 font-medium border border-slate-200 dark:border-gray-600 rounded-md px-2 py-1.5 focus:border-blue-400 focus:ring-1 focus:ring-blue-400/20 outline-none bg-white dark:bg-[#1a1a22]" />
                  ) : (
                    <p className="text-sm text-slate-700 dark:text-gray-200 font-medium truncate">{selectedAppointment.father_name || 'Nao informado'}</p>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2.5 p-2.5 bg-slate-50 dark:bg-[#1a1f28] rounded-lg border border-slate-200 dark:border-[#252530]">
              <div className="p-1.5 bg-green-100 dark:bg-green-900/20 text-green-500 dark:text-green-400 rounded-md"><Phone size={14}/></div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold text-slate-500 dark:text-[#a1a1aa] uppercase">Telefone</p>
                {isEditing ? (
                  <input type="text" className="w-full text-sm font-medium text-slate-700 dark:text-gray-200 border border-slate-200 dark:border-gray-600 rounded-md px-2 py-1 focus:border-blue-400 focus:ring-1 focus:ring-blue-400/20 outline-none bg-white dark:bg-[#1a1a22]" value={editForm.parent_phone} onChange={(e) => setEditForm({ ...editForm, parent_phone: e.target.value })} placeholder="11999999999" />
                ) : (
                  <p className="text-sm text-slate-700 dark:text-gray-200 font-medium">{(selectedAppointment.parent_phone || selectedAppointment.patient_phone) ? (selectedAppointment.parent_phone || selectedAppointment.patient_phone)!.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3') : 'Nao informado'}</p>
                )}
              </div>
            </div>
          </div>

          {selectedAppointment.status !== 'blocked' && (
            <div className="bg-slate-50 dark:bg-[#1a1f28] p-3 rounded-xl border border-slate-200 dark:border-[#252530]">
              <h5 className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1"><Wallet size={12}/> Financeiro</h5>
              {isEditing ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase">Total (R$)</label>
                    <input type="text" value={editForm.totalAmount} onChange={e => handleMoneyInput('totalAmount', e.target.value)} className="w-full text-sm font-bold border border-slate-200 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-[#1a1a22] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase">Pago (R$)</label>
                    <input type="text" value={editForm.paidAmount} onChange={e => handleMoneyInput('paidAmount', e.target.value)} className="w-full text-sm font-bold border border-emerald-200 dark:border-emerald-800 rounded px-2 py-1 bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400" />
                  </div>
                  <div className="col-span-2 text-right text-xs font-bold text-slate-500 dark:text-[#a1a1aa] border-t border-slate-200 dark:border-[#252530] pt-2 mt-1">
                    Restante: <span className={editRemaining > 0 ? 'text-rose-500 text-sm' : 'text-emerald-500 text-sm'}>R$ {editRemaining.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              ) : (
                <div className="flex justify-between items-center bg-white dark:bg-black/20 p-2.5 rounded-lg border border-slate-100 dark:border-[#252530]">
                  <div><p className="text-[10px] text-slate-400 uppercase font-semibold">Valor Total</p><p className="text-sm font-bold text-slate-700 dark:text-gray-200">R$ {totalDisplay.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
                  <div className="text-right"><p className="text-[10px] text-emerald-600/70 uppercase font-semibold">Pago</p><p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">R$ {paidDisplay.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
                  <div className="text-right pl-4 border-l border-slate-100 dark:border-[#252530] ml-4"><p className="text-[10px] text-slate-400 uppercase font-semibold">Falta</p><p className={`text-sm font-black ${remainingDisplay > 0 ? 'text-rose-500' : 'text-slate-400'}`}>R$ {remainingDisplay.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
                </div>
              )}
            </div>
          )}

          <div className="p-3 bg-blue-50/30 dark:bg-blue-900/5 rounded-lg border border-blue-200/30 dark:border-blue-800/20">
            <div className="flex items-center gap-2 mb-2"><FileText size={14} className="text-blue-500 dark:text-blue-400"/><p className="text-[10px] font-semibold text-blue-600 dark:text-blue-300 uppercase">Observacoes</p></div>
            {isEditing ? (
              <textarea className="w-full p-2.5 text-sm text-slate-700 dark:text-gray-200 border border-blue-200 dark:border-blue-800/30 rounded-lg focus:border-blue-400 focus:ring-1 focus:ring-blue-400/20 outline-none bg-white dark:bg-[#1a1f28] min-h-[80px] resize-y" value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} placeholder="Observacoes..." />
            ) : (
              <div className="p-2.5 bg-white/60 dark:bg-[#1a1f28]/60 rounded-lg">
                <p className="text-xs text-slate-600 dark:text-[#d4d4d8] leading-relaxed">{selectedAppointment.notes || 'Nenhuma observacao registrada.'}</p>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 bg-slate-50/50 dark:bg-[#111118] border-t border-slate-200 dark:border-[#252530] flex gap-2">
          {isEditing ? (
            <>
              <button onClick={() => setIsEditing(false)} className="flex-1 bg-white dark:bg-[#1a1a22] border border-slate-300 dark:border-gray-600 text-slate-600 dark:text-[#d4d4d8] py-2 rounded-lg text-xs font-semibold hover:bg-slate-50 dark:hover:bg-white/10 transition-colors">Cancelar</button>
              <button onClick={handleSaveEdit} disabled={isSaving} className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"><Save size={14}/> {isSaving ? 'Salvando...' : 'Salvar'}</button>
            </>
          ) : (
            <>
              <button onClick={() => setConfirmCancelOpen(true)} className="px-3 bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center justify-center gap-1.5"><Trash2 size={14}/> Cancelar</button>
              <button onClick={() => setIsEditing(true)} className="flex-1 bg-white dark:bg-[#1a1a22] border border-slate-300 dark:border-gray-600 text-slate-600 dark:text-[#d4d4d8] py-2 rounded-lg text-xs font-semibold hover:bg-slate-50 dark:hover:bg-white/10 transition-colors flex items-center justify-center gap-1.5"><Edit2 size={14}/> Editar</button>
              <button onClick={() => setSelectedAppointment(null)} className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-lg text-xs font-semibold shadow-sm transition-colors">Fechar</button>
            </>
          )}
        </div>
      </div>
    </div>
    <ConfirmModal
      isOpen={confirmCancelOpen}
      onClose={() => setConfirmCancelOpen(false)}
      onConfirm={handleDeleteConfirm}
      title={selectedAppointment?.status === 'blocked' ? 'Remover bloqueio' : 'Cancelar agendamento'}
      message={selectedAppointment ? (selectedAppointment.status === 'blocked' ? 'Deseja remover este bloqueio?' : `Cancelar agendamento de ${selectedAppointment.patient_name || 'este paciente'}?`) : ''}
      type="danger"
      confirmText="Sim"
    />
    </>
  );
}
