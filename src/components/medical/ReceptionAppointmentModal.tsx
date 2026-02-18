'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
const supabase = createClient();
import { Appointment } from '@/types/medical';
import {
  X, Edit2, FileText, CalendarDays, Clock, Stethoscope, User, Phone,
  Save, Wallet, Info, Loader2
} from 'lucide-react';
import { saveAppointmentDateTime } from '@/utils/dateUtils';
import { formatDateToDisplay, formatDateToISO, formatCurrency, parseCurrency } from '@/app/agenda/utils/agendaUtils';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import { CanonicalPaymentSplit, normalizePaymentSplits } from '@/lib/finance';
import { createFinancialTransaction } from '@/lib/financialTransactions';

const initialForm = {
  patient_name: '',
  patient_phone: '',
  parent_name: '',
  notes: '',
  date: '',
  dateDisplay: '',
  time: '',
  doctor_id: null as number | null,
  totalAmount: '',
  paidAmount: ''
};

type ReceptionAppointmentModalProps = {
  isOpen: boolean;
  appointment: Appointment | null;
  onClose: () => void;
  onSave: (updated: Appointment) => void;
};

export default function ReceptionAppointmentModal({
  isOpen,
  appointment,
  onClose,
  onSave
}: ReceptionAppointmentModalProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [doctors, setDoctors] = useState<Array<{ id: number; name: string }>>([]);
  const [form, setForm] = useState(initialForm);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [paymentMode, setPaymentMode] = useState<'pix' | 'cash' | 'credit_card' | 'debit_card' | 'mixed'>('pix');
  const [pendingAmount, setPendingAmount] = useState('');
  const [mixedPayments, setMixedPayments] = useState({
    pix: '',
    cash: '',
    credit_card: '',
    debit_card: ''
  });

  useEffect(() => {
    if (isOpen) {
      (async () => {
        const { data } = await supabase.from('doctors').select('id, name').eq('active', true).order('name');
        if (data) setDoctors(data);
      })();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && appointment) {
      const dateStr = appointment.start_time;
      const clean = dateStr ? dateStr.replace(/[+-]\d{2}:\d{2}$/, '').replace('Z', '') : '';
      const [datePart, timePart] = clean.split('T');
      setForm({
        patient_name: appointment.patient_name || '',
        patient_phone: appointment.patient_phone || '',
        parent_name: appointment.parent_name || '',
        notes: appointment.anamnesis || appointment.notes || '',
        date: datePart || '',
        dateDisplay: datePart ? formatDateToDisplay(datePart) : '',
        time: timePart ? timePart.substring(0, 5) : '',
        doctor_id: appointment.doctor_id ?? null,
        totalAmount: appointment.total_amount != null ? formatCurrency(appointment.total_amount) : '',
        paidAmount: appointment.amount_paid != null ? formatCurrency(appointment.amount_paid) : ''
      });
      setPendingAmount('');
      setPaymentMode('pix');
      setMixedPayments({
        pix: '',
        cash: '',
        credit_card: '',
        debit_card: ''
      });
      setIsEditing(false);
    }
  }, [isOpen, appointment]);

  const formatMoneyInput = (value: string) => {
    const raw = value.replace(/\D/g, '');
    if (!raw) return '';
    const amount = Number(raw) / 100;
    return amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleDateInput = (value: string) => {
    const numbers = value.replace(/\D/g, '').slice(0, 8);
    let formatted = '';
    if (numbers.length > 0) formatted = numbers.slice(0, 2);
    if (numbers.length > 2) formatted += '/' + numbers.slice(2, 4);
    if (numbers.length > 4) formatted += '/' + numbers.slice(4, 8);
    setForm(prev => ({ ...prev, dateDisplay: formatted, date: formatDateToISO(formatted) }));
  };

  const handleMoneyInput = (field: 'totalAmount' | 'paidAmount', value: string) => {
    const formatted = formatMoneyInput(value);
    if (!formatted) {
      setForm(prev => ({ ...prev, [field]: '' }));
      return;
    }
    setForm(prev => ({ ...prev, [field]: formatted }));
  };

  /** Salva apenas o pagamento (valor pago) sem alterar outros dados */
  const handleSavePaymentOnly = async () => {
    if (!appointment) return;
    const totalNum = Number(appointment.total_amount ?? 0);
    const alreadyPaid = Number(appointment.amount_paid ?? 0);
    const paymentAmount = parseCurrency(pendingAmount);
    const remainingBeforePayment = Math.max(0, totalNum - alreadyPaid);

    if (totalNum <= 0) {
      toast.error('Defina o valor total do agendamento antes de registrar o pagamento.');
      return;
    }
    if (paymentAmount <= 0) {
      toast.error('Informe o valor desta entrada.');
      return;
    }
    if (paymentAmount > remainingBeforePayment) {
      toast.error('O valor informado é maior que o saldo pendente.');
      return;
    }

    const mixedEntries = [
      { method: 'pix', amount: parseCurrency(mixedPayments.pix) },
      { method: 'cash', amount: parseCurrency(mixedPayments.cash) },
      { method: 'credit_card', amount: parseCurrency(mixedPayments.credit_card) },
      { method: 'debit_card', amount: parseCurrency(mixedPayments.debit_card) }
    ].filter((entry) => entry.amount > 0);

    let splits: CanonicalPaymentSplit[];
    try {
      splits = normalizePaymentSplits(
        paymentAmount,
        paymentMode !== 'mixed' ? paymentMode : null,
        paymentMode === 'mixed' ? mixedEntries : undefined
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Formas de pagamento inválidas.';
      toast.error(message);
      return;
    }

    setSaving(true);
    try {
      await createFinancialTransaction(supabase, {
        amount: paymentAmount,
        origin: 'atendimento',
        createdBy: user?.id ?? null,
        appointmentId: appointment.id,
        payments: splits
      });

      const updatedAmountPaid = alreadyPaid + paymentAmount;
      const { error } = await supabase
        .from('appointments')
        .update({ amount_paid: updatedAmountPaid })
        .eq('id', appointment.id);
      if (error) throw error;

      const updated: Appointment = {
        ...appointment,
        amount_paid: updatedAmountPaid,
        total_amount: totalNum
      };
      onSave(updated);
      setPendingAmount('');
      setMixedPayments({
        pix: '',
        cash: '',
        credit_card: '',
        debit_card: ''
      });
      if (updatedAmountPaid >= totalNum) onClose();
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Tente novamente.';
      toast.error('Erro ao salvar: ' + message);
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!appointment) return;
    if (!form.date || form.date.length !== 10) {
      toast.error('Informe uma data válida (DD/MM/AAAA).');
      return;
    }
    if (!form.time) {
      toast.error('Informe o horário.');
      return;
    }
    if (!form.doctor_id) {
      toast.error('Selecione o médico.');
      return;
    }
    setSaving(true);
    try {
      const doctor = doctors.find(d => d.id === form.doctor_id);
      if (!doctor) throw new Error('Médico não encontrado');
      const start_time = saveAppointmentDateTime(form.date, form.time);
      const totalNum = parseCurrency(form.totalAmount);
      const paidNum = parseCurrency(form.paidAmount);
      const { error } = await supabase
        .from('appointments')
        .update({
          patient_name: form.patient_name || null,
          patient_phone: form.patient_phone || null,
          parent_name: form.parent_name || null,
          notes: form.notes || null,
          anamnesis: form.notes || null,
          start_time,
          doctor_id: form.doctor_id,
          doctor_name: doctor.name,
          total_amount: totalNum,
          amount_paid: paidNum
        })
        .eq('id', appointment.id);
      if (error) throw error;
      const updated: Appointment = {
        ...appointment,
        patient_name: form.patient_name || null,
        patient_phone: form.patient_phone || null,
        parent_name: form.parent_name || null,
        notes: form.notes || null,
        anamnesis: form.notes || null,
        start_time,
        doctor_id: form.doctor_id,
        doctor_name: doctor.name,
        total_amount: totalNum,
        amount_paid: paidNum
      };
      onSave(updated);
      onClose();
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Tente novamente.';
      toast.error('Erro ao salvar: ' + message);
    } finally {
      setSaving(false);
    }
  };

  if (!appointment) return null;

  const totalDisplay = appointment.total_amount ?? 0;
  const paidDisplay = appointment.amount_paid ?? 0;
  const remainingDisplay = Math.max(0, totalDisplay - paidDisplay);
  const pendingAmountValue = parseCurrency(pendingAmount);
  const remainingAfterCurrentInput = Math.max(0, remainingDisplay - pendingAmountValue);
  const editTotal = parseCurrency(form.totalAmount);
  const editPaid = parseCurrency(form.paidAmount);
  const editRemaining = Math.max(0, editTotal - editPaid);

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-[#202c33] w-full max-w-lg rounded-2xl shadow-lg border border-slate-200 dark:border-gray-700 overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-gray-700 flex justify-between items-center bg-rose-50/50 dark:bg-rose-900/10">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-rose-100 dark:bg-rose-900/20 text-rose-500 dark:text-rose-400">
              <Info size={16} />
            </div>
            <h3 className="text-base font-semibold text-slate-700 dark:text-gray-200">
              {isEditing ? 'Editar agendamento e pagamento' : 'Detalhes do agendamento'}
            </h3>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 hover:bg-white/60 dark:hover:bg-white/10 rounded-lg transition-colors">
            <X size={18} className="text-slate-400 dark:text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {/* Bloco de pagamento pendente no topo — sempre visível e editável */}
          {remainingDisplay > 0 && totalDisplay > 0 && !isEditing && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 space-y-3">
              <p className="text-xs font-bold text-amber-800 dark:text-amber-200 uppercase flex items-center gap-1.5">
                <Wallet size={14} />
                Pagamento pendente — registre o valor pago
              </p>
              <div className="grid grid-cols-3 gap-2 items-end text-center">
                <div>
                  <label className="text-[10px] text-slate-500 dark:text-gray-400 uppercase block mb-1">Total</label>
                  <p className="text-sm font-bold text-slate-700 dark:text-gray-200">
                    R$ {totalDisplay.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <label className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-semibold block mb-1">Entrada desta vez (R$)</label>
                  <input
                    type="text"
                    value={pendingAmount}
                    onChange={e => setPendingAmount(formatMoneyInput(e.target.value))}
                    placeholder="0,00"
                    className="w-full text-sm font-bold border border-emerald-200 dark:border-emerald-700 rounded-lg px-2 py-2 bg-white dark:bg-[#2a2d36] text-emerald-700 dark:text-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 dark:text-gray-400 uppercase block mb-1">Falta</label>
                  <p className={`text-sm font-bold ${remainingAfterCurrentInput > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    R$ {remainingAfterCurrentInput.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-[10px] uppercase font-semibold text-slate-500 dark:text-gray-400">Forma de pagamento</p>
                <div className="grid grid-cols-5 gap-1.5">
                  {[
                    { key: 'pix', label: 'Pix' },
                    { key: 'cash', label: 'Dinheiro' },
                    { key: 'credit_card', label: 'Crédito' },
                    { key: 'debit_card', label: 'Débito' },
                    { key: 'mixed', label: 'Misto' }
                  ].map((method) => (
                    <button
                      key={method.key}
                      type="button"
                      onClick={() => setPaymentMode(method.key as typeof paymentMode)}
                      className={`rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition-colors ${
                        paymentMode === method.key
                          ? 'border-emerald-500 bg-emerald-100/70 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5'
                      }`}
                    >
                      {method.label}
                    </button>
                  ))}
                </div>
                {paymentMode === 'mixed' && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] uppercase text-slate-500 dark:text-gray-400">Pix</label>
                      <input
                        type="text"
                        value={mixedPayments.pix}
                        onChange={(e) => setMixedPayments((prev) => ({ ...prev, pix: formatMoneyInput(e.target.value) }))}
                        placeholder="0,00"
                        className="w-full rounded-lg border border-slate-200 dark:border-gray-700 px-2 py-1.5 text-xs bg-white dark:bg-[#2a2d36] text-slate-700 dark:text-gray-200"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase text-slate-500 dark:text-gray-400">Dinheiro</label>
                      <input
                        type="text"
                        value={mixedPayments.cash}
                        onChange={(e) => setMixedPayments((prev) => ({ ...prev, cash: formatMoneyInput(e.target.value) }))}
                        placeholder="0,00"
                        className="w-full rounded-lg border border-slate-200 dark:border-gray-700 px-2 py-1.5 text-xs bg-white dark:bg-[#2a2d36] text-slate-700 dark:text-gray-200"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase text-slate-500 dark:text-gray-400">Crédito</label>
                      <input
                        type="text"
                        value={mixedPayments.credit_card}
                        onChange={(e) => setMixedPayments((prev) => ({ ...prev, credit_card: formatMoneyInput(e.target.value) }))}
                        placeholder="0,00"
                        className="w-full rounded-lg border border-slate-200 dark:border-gray-700 px-2 py-1.5 text-xs bg-white dark:bg-[#2a2d36] text-slate-700 dark:text-gray-200"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase text-slate-500 dark:text-gray-400">Débito</label>
                      <input
                        type="text"
                        value={mixedPayments.debit_card}
                        onChange={(e) => setMixedPayments((prev) => ({ ...prev, debit_card: formatMoneyInput(e.target.value) }))}
                        placeholder="0,00"
                        className="w-full rounded-lg border border-slate-200 dark:border-gray-700 px-2 py-1.5 text-xs bg-white dark:bg-[#2a2d36] text-slate-700 dark:text-gray-200"
                      />
                    </div>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={handleSavePaymentOnly}
                disabled={saving}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-2.5 rounded-lg text-sm font-bold shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Salvar pagamento
              </button>
            </div>
          )}

          {/* Paciente */}
          <div className="flex items-center gap-3 pb-4 border-b border-slate-200 dark:border-gray-700">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center font-semibold text-lg bg-rose-100 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400">
              {isEditing ? <Edit2 size={18} /> : (appointment.patient_name?.charAt(0) || 'P')}
            </div>
            <div className="flex-1">
              {isEditing ? (
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-500 dark:text-gray-400 uppercase">Nome do paciente</label>
                  <input
                    type="text"
                    className="w-full text-sm font-medium text-slate-800 dark:text-gray-100 border border-slate-200 dark:border-gray-600 rounded-lg px-3 py-1.5 focus:border-rose-400 focus:ring-1 focus:ring-rose-400/20 outline-none bg-white dark:bg-[#2a2d36]"
                    value={form.patient_name}
                    onChange={e => setForm(prev => ({ ...prev, patient_name: e.target.value }))}
                    placeholder="Nome do paciente"
                  />
                </div>
              ) : (
                <h4 className="text-base font-semibold text-slate-800 dark:text-gray-100">
                  {appointment.patient_name || 'Sem nome'}
                </h4>
              )}
            </div>
          </div>

          {/* Data e hora */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-slate-50 dark:bg-[#1a1f28] rounded-lg border border-slate-200 dark:border-gray-700">
              <div className="flex items-center gap-1.5 mb-1.5">
                <CalendarDays size={14} className="text-rose-500 dark:text-rose-400" />
                <span className="text-[10px] font-semibold text-slate-500 dark:text-gray-400 uppercase">Data</span>
              </div>
              {isEditing ? (
                <input
                  type="text"
                  value={form.dateDisplay}
                  onChange={e => handleDateInput(e.target.value)}
                  placeholder="DD/MM/AAAA"
                  maxLength={10}
                  className="w-full text-sm font-semibold text-slate-700 dark:text-gray-200 border border-slate-200 dark:border-gray-600 rounded-md px-2 py-1.5 focus:border-rose-400 focus:ring-1 focus:ring-rose-400/20 outline-none bg-white dark:bg-[#2a2d36]"
                />
              ) : (
                <p className="text-sm font-semibold text-slate-700 dark:text-gray-200">
                  {new Date(appointment.start_time).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              )}
            </div>
            <div className="p-3 bg-slate-50 dark:bg-[#1a1f28] rounded-lg border border-slate-200 dark:border-gray-700">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Clock size={14} className="text-rose-500 dark:text-rose-400" />
                <span className="text-[10px] font-semibold text-slate-500 dark:text-gray-400 uppercase">Horário</span>
              </div>
              {isEditing ? (
                <input
                  type="time"
                  value={form.time}
                  onChange={e => setForm(prev => ({ ...prev, time: e.target.value }))}
                  className="w-full text-sm font-semibold text-slate-700 dark:text-gray-200 border border-slate-200 dark:border-gray-600 rounded-md px-2 py-1.5 focus:border-rose-400 focus:ring-1 focus:ring-rose-400/20 outline-none bg-white dark:bg-[#2a2d36]"
                />
              ) : (
                <p className="text-sm font-semibold text-slate-700 dark:text-gray-200">
                  {(() => {
                    const clean = appointment.start_time ? appointment.start_time.replace(/[+-]\d{2}:\d{2}$/, '').replace('Z', '') : '';
                    const [datePart, timePart] = clean.split('T');
                    if (datePart && timePart) {
                      const [y, m, d] = datePart.split('-').map(Number);
                      const [h, min] = timePart.split(':').map(Number);
                      const dLocal = new Date(y, m - 1, d, h, min || 0, 0);
                      return dLocal.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false });
                    }
                    return '--:--';
                  })()}
                </p>
              )}
            </div>
          </div>

          {/* Médico */}
          <div className="flex items-center gap-2.5 p-2.5 bg-slate-50 dark:bg-[#1a1f28] rounded-lg border border-slate-200 dark:border-gray-700">
            <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/20 text-indigo-500 dark:text-indigo-400 rounded-md">
              <Stethoscope size={14} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-slate-500 dark:text-gray-400 uppercase">Médico</p>
              {isEditing ? (
                <select
                  value={form.doctor_id ?? ''}
                  onChange={e => setForm(prev => ({ ...prev, doctor_id: e.target.value ? Number(e.target.value) : null }))}
                  className="w-full text-sm text-slate-700 dark:text-gray-200 font-medium border border-slate-200 dark:border-gray-600 rounded-md px-2 py-1.5 focus:border-rose-400 focus:ring-1 focus:ring-rose-400/20 outline-none bg-white dark:bg-[#2a2d36]"
                >
                  <option value="">Selecione...</option>
                  {doctors.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              ) : (
                <p className="text-sm text-slate-700 dark:text-gray-200 font-medium truncate">{appointment.doctor_name || 'Não informado'}</p>
              )}
            </div>
          </div>

          {/* Responsável e WhatsApp */}
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 p-2.5 bg-slate-50 dark:bg-[#1a1f28] rounded-lg border border-slate-200 dark:border-gray-700">
              <div className="p-1.5 bg-purple-100 dark:bg-purple-900/20 text-purple-500 dark:text-purple-400 rounded-md"><User size={14} /></div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold text-slate-500 dark:text-gray-400 uppercase">Responsável</p>
                {isEditing ? (
                  <input
                    type="text"
                    value={form.parent_name}
                    onChange={e => setForm(prev => ({ ...prev, parent_name: e.target.value }))}
                    placeholder="Nome do responsável"
                    className="w-full text-sm text-slate-700 dark:text-gray-200 font-medium border border-slate-200 dark:border-gray-600 rounded-md px-2 py-1.5 focus:border-rose-400 focus:ring-1 focus:ring-rose-400/20 outline-none bg-white dark:bg-[#2a2d36]"
                  />
                ) : (
                  <p className="text-sm text-slate-700 dark:text-gray-200 font-medium truncate">{appointment.parent_name || 'Não informado'}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2.5 p-2.5 bg-slate-50 dark:bg-[#1a1f28] rounded-lg border border-slate-200 dark:border-gray-700">
              <div className="p-1.5 bg-green-100 dark:bg-green-900/20 text-green-500 dark:text-green-400 rounded-md"><Phone size={14} /></div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold text-slate-500 dark:text-gray-400 uppercase">WhatsApp</p>
                {isEditing ? (
                  <input
                    type="text"
                    value={form.patient_phone}
                    onChange={e => setForm(prev => ({ ...prev, patient_phone: e.target.value }))}
                    placeholder="(00) 00000-0000"
                    className="w-full text-sm font-medium text-slate-700 dark:text-gray-200 border border-slate-200 dark:border-gray-600 rounded-md px-2 py-1.5 focus:border-rose-400 focus:ring-1 focus:ring-rose-400/20 outline-none bg-white dark:bg-[#2a2d36]"
                  />
                ) : (
                  <p className="text-sm text-slate-700 dark:text-gray-200 font-medium">
                    {appointment.patient_phone ? appointment.patient_phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3') : 'Não informado'}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Bloco financeiro — destaque na recepção */}
          <div className="bg-amber-50 dark:bg-amber-900/10 p-3 rounded-xl border border-amber-200 dark:border-amber-800/50">
            <h5 className="text-xs font-bold text-amber-800 dark:text-amber-200 uppercase mb-2 flex items-center gap-1">
              <Wallet size={12} /> Pagamento
            </h5>
            {isEditing ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-500 dark:text-gray-400 uppercase">Total (R$)</label>
                  <input
                    type="text"
                    value={form.totalAmount}
                    onChange={e => handleMoneyInput('totalAmount', e.target.value)}
                    className="w-full text-sm font-bold border border-slate-200 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-[#2a2d36] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-amber-400"
                    placeholder="0,00"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-semibold">Valor pago (R$)</label>
                  <input
                    type="text"
                    value={form.paidAmount}
                    onChange={e => handleMoneyInput('paidAmount', e.target.value)}
                    className="w-full text-sm font-bold border border-emerald-200 dark:border-emerald-800 rounded px-2 py-1.5 bg-emerald-50 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-300 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                    placeholder="0,00"
                  />
                </div>
                <div className="col-span-2 text-right text-xs font-bold text-slate-600 dark:text-gray-300 border-t border-amber-200 dark:border-amber-800 pt-2 mt-1">
                  Restante: <span className={editRemaining > 0 ? 'text-rose-500 dark:text-rose-400 text-sm' : 'text-emerald-600 dark:text-emerald-400 text-sm'}>
                    R$ {editRemaining.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex justify-between items-center bg-white dark:bg-black/20 p-2.5 rounded-lg border border-amber-200/50 dark:border-amber-800/30">
                <div>
                  <p className="text-[10px] text-slate-500 dark:text-gray-400 uppercase font-semibold">Total</p>
                  <p className="text-sm font-bold text-slate-700 dark:text-gray-200">R$ {totalDisplay.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 uppercase font-semibold">Pago</p>
                  <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">R$ {paidDisplay.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-500 dark:text-gray-400 uppercase font-semibold">Falta</p>
                  <p className={`text-sm font-black ${remainingDisplay > 0 ? 'text-rose-500 dark:text-rose-400' : 'text-slate-400 dark:text-gray-500'}`}>
                    R$ {remainingDisplay.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            )}
            {!isEditing && remainingDisplay > 0 && totalDisplay > 0 && (
              <p className="text-[10px] text-amber-700 dark:text-amber-300 mt-2 font-semibold">
                Registre o pagamento para liberar a entrada do paciente na consulta.
              </p>
            )}
          </div>

          {/* Observações */}
          <div className="p-3 bg-slate-50 dark:bg-[#1a1f28] rounded-lg border border-slate-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <FileText size={14} className="text-slate-500 dark:text-gray-400" />
              <p className="text-[10px] font-semibold text-slate-500 dark:text-gray-400 uppercase">Observações</p>
            </div>
            {isEditing ? (
              <textarea
                className="w-full p-2.5 text-sm text-slate-700 dark:text-gray-200 border border-slate-200 dark:border-gray-600 rounded-lg focus:border-rose-400 focus:ring-1 focus:ring-rose-400/20 outline-none bg-white dark:bg-[#2a2d36] min-h-[60px] resize-y"
                value={form.notes}
                onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Anotações..."
              />
            ) : (
              <p className="text-xs text-slate-600 dark:text-gray-300 leading-relaxed">
                {appointment.anamnesis || appointment.notes || 'Nenhuma observação.'}
              </p>
            )}
          </div>
        </div>

        {/* Rodapé */}
        <div className="p-4 bg-slate-50/50 dark:bg-[#1e2028] border-t border-slate-200 dark:border-gray-700 flex gap-2">
          {isEditing ? (
            <>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="flex-1 bg-white dark:bg-[#2a2d36] border border-slate-300 dark:border-gray-600 text-slate-600 dark:text-gray-300 py-2 rounded-lg text-xs font-semibold hover:bg-slate-50 dark:hover:bg-white/10 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-rose-500 hover:bg-rose-600 text-white py-2 rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Salvar
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="flex-1 bg-rose-500 hover:bg-rose-600 text-white py-2 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
              >
                <Edit2 size={14} /> Editar e registrar pagamento
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-white dark:bg-[#2a2d36] border border-slate-300 dark:border-gray-600 text-slate-600 dark:text-gray-300 py-2 rounded-lg text-xs font-semibold hover:bg-slate-50 dark:hover:bg-white/10 transition-colors"
              >
                Fechar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
