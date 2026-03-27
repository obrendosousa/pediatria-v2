'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
const supabase = createClient();
import { Appointment } from '@/types/medical';
import {
  X, Edit2, FileText, CalendarDays, Clock, Stethoscope, User, Phone,
  Save, Wallet, Info, Loader2, Cake, Trash2, Percent, Tag
} from 'lucide-react';
import { saveAppointmentDateTime } from '@/utils/dateUtils';
import { formatDateToDisplay, formatDateToISO, formatCurrency, parseCurrency } from '@/app/agenda/utils/agendaUtils';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import { logAudit } from '@/lib/audit';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { CanonicalPaymentSplit, normalizePaymentSplits } from '@/lib/finance';
import { createFinancialTransaction } from '@/lib/financialTransactions';
import { computeDiscountAmount, effectiveAmount, DiscountType } from '@/utils/discountUtils';
import { type FamilyMember, syncFlatColumnsFromFamilyMembers, flatFieldsToFamilyMembers } from '@/constants/guardianRelationships';
import FamilyMembersField from '@/components/shared/FamilyMembersField';

const initialForm = {
  patient_name: '',
  patient_phone: '',
  birthDateDisplay: '',
  birthDate: '', // YYYY-MM-DD
  notes: '',
  date: '',
  dateDisplay: '',
  time: '',
  doctor_id: null as number | null,
  totalAmount: '',
  paidAmount: '',
  discountType: '%' as DiscountType,
  discountValue: ''
};

type ReceptionAppointmentModalProps = {
  isOpen: boolean;
  appointment: Appointment | null;
  onClose: () => void;
  onSave: (updated: Appointment) => void;
  onDelete?: (id: number) => void;
};

export default function ReceptionAppointmentModal({
  isOpen,
  appointment,
  onClose,
  onSave,
  onDelete
}: ReceptionAppointmentModalProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [doctors, setDoctors] = useState<Array<{ id: number; name: string }>>([]);
  const [form, setForm] = useState(initialForm);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [showDiscount, setShowDiscount] = useState(false);
  // Desconto inline (modo leitura — bloco de pagamento pendente)
  const [inlineDiscountOpen, setInlineDiscountOpen] = useState(false);
  const [inlineDiscType, setInlineDiscType] = useState<DiscountType>('%');
  const [inlineDiscValue, setInlineDiscValue] = useState('');
  const [savingDiscount, setSavingDiscount] = useState(false);
  const [paymentMode, setPaymentMode] = useState<'pix' | 'cash' | 'credit_card' | 'debit_card' | 'mixed'>('pix');
  const [pendingAmount, setPendingAmount] = useState('');
  const [mixedPayments, setMixedPayments] = useState({
    pix: '',
    cash: '',
    credit_card: '',
    debit_card: ''
  });
  // Responsáveis dinâmicos
  const [guardians, setGuardians] = useState<FamilyMember[]>([]);

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
      const dType = (appointment.discount_type as DiscountType) || '%';
      const dVal = appointment.discount_value ?? 0;

      // Popular guardians a partir do appointment
      const appointmentGuardians = Array.isArray(appointment.guardians) && appointment.guardians.length > 0
        ? appointment.guardians
        : flatFieldsToFamilyMembers({
            mother_name: appointment.mother_name,
            father_name: appointment.father_name,
          });
      setGuardians(appointmentGuardians);

      setForm({
        patient_name: appointment.patient_name || '',
        patient_phone: appointment.patient_phone || '',
        birthDateDisplay: appointment.patient_birth_date ? formatDateToDisplay(appointment.patient_birth_date) : '',
        birthDate: appointment.patient_birth_date || '',
        notes: appointment.anamnesis || appointment.notes || '',
        date: datePart || '',
        dateDisplay: datePart ? formatDateToDisplay(datePart) : '',
        time: timePart ? timePart.substring(0, 5) : '',
        doctor_id: appointment.doctor_id ?? null,
        totalAmount: appointment.total_amount != null ? formatCurrency(appointment.total_amount) : '',
        paidAmount: appointment.amount_paid != null ? formatCurrency(appointment.amount_paid) : '',
        discountType: dType,
        discountValue: dVal > 0 ? String(dVal).replace('.', ',') : ''
      });
      setShowDiscount(dVal > 0);
      setInlineDiscountOpen(false);
      setInlineDiscType(dType);
      setInlineDiscValue(dVal > 0 ? String(dVal).replace('.', ',') : '');
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

  const handleDateMaskedInput = (value: string, displayField: 'dateDisplay' | 'birthDateDisplay', isoField: 'date' | 'birthDate') => {
    const numbers = value.replace(/\D/g, '').slice(0, 8);
    let formatted = '';
    if (numbers.length > 0) formatted = numbers.slice(0, 2);
    if (numbers.length > 2) formatted += '/' + numbers.slice(2, 4);
    if (numbers.length > 4) formatted += '/' + numbers.slice(4, 8);
    setForm(prev => ({ ...prev, [displayField]: formatted, [isoField]: formatDateToISO(formatted) }));
  };

  const handleMoneyInput = (field: 'totalAmount' | 'paidAmount', value: string) => {
    const formatted = formatMoneyInput(value);
    if (!formatted) {
      setForm(prev => ({ ...prev, [field]: '' }));
      return;
    }
    setForm(prev => ({ ...prev, [field]: formatted }));
  };

  /** Salva apenas o desconto sem alterar outros dados */
  const handleSaveDiscountOnly = async () => {
    if (!appointment) return;
    const totalNum = Number(appointment.total_amount ?? 0);
    if (totalNum <= 0) {
      toast.error('Defina o valor total antes de aplicar desconto.');
      return;
    }
    const discVal = Number(String(inlineDiscValue).replace(',', '.')) || 0;
    const discAmt = computeDiscountAmount(totalNum, inlineDiscType, discVal);

    setSavingDiscount(true);
    try {
      const { error } = await supabase
        .from('appointments')
        .update({
          discount_type: inlineDiscType,
          discount_value: discVal,
          discount_amount: discAmt
        })
        .eq('id', appointment.id);
      if (error) throw error;

      const updated: Appointment = {
        ...appointment,
        discount_type: inlineDiscType,
        discount_value: discVal,
        discount_amount: discAmt
      };
      onSave(updated);
      setInlineDiscountOpen(false);
      toast.success(discAmt > 0 ? `Desconto de R$ ${discAmt.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} aplicado!` : 'Desconto removido.');
    } catch (err: unknown) {
      console.error(err);
      toast.error('Erro ao salvar desconto.');
    } finally {
      setSavingDiscount(false);
    }
  };

  /** Salva apenas o pagamento (valor pago) sem alterar outros dados */
  const handleSavePaymentOnly = async () => {
    if (!appointment) return;
    const totalNum = Number(appointment.total_amount ?? 0);
    const alreadyPaid = Number(appointment.amount_paid ?? 0);
    const paymentAmount = parseCurrency(pendingAmount);
    const discountAmt = Number(appointment.discount_amount ?? 0);
    const effectiveTotal = effectiveAmount(totalNum, discountAmt);
    const remainingBeforePayment = Math.max(0, effectiveTotal - alreadyPaid);

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
      if (updatedAmountPaid >= effectiveTotal) onClose();
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
    if (!form.birthDate || form.birthDate.length !== 10) {
      toast.error('Informe a data de nascimento do paciente.');
      return;
    }
    if (appointment.appointment_type !== 'retorno' && parseCurrency(form.totalAmount) <= 0) {
      toast.error('Informe o valor da consulta.');
      return;
    }
    setSaving(true);
    try {
      const doctor = doctors.find(d => d.id === form.doctor_id);
      if (!doctor) throw new Error('Médico não encontrado');
      const start_time = saveAppointmentDateTime(form.date, form.time);
      const totalNum = parseCurrency(form.totalAmount);

      // Calcular desconto
      const discVal = Number(String(form.discountValue).replace(',', '.')) || 0;
      const discAmt = computeDiscountAmount(totalNum, form.discountType, discVal);

      // Derivar colunas flat dos guardians para backward compat
      const cleanGuardians = guardians.filter(g => g.name.trim());
      const flatCols = syncFlatColumnsFromFamilyMembers(cleanGuardians);

      const { error } = await supabase
        .from('appointments')
        .update({
          patient_name: form.patient_name || null,
          patient_phone: form.patient_phone || null,
          mother_name: flatCols.mother_name,
          father_name: flatCols.father_name,
          parent_name: flatCols.parent_name,
          guardians: cleanGuardians.length > 0 ? cleanGuardians : null,
          patient_birth_date: form.birthDate || null,
          notes: form.notes || null,
          anamnesis: form.notes || null,
          start_time,
          doctor_id: form.doctor_id,
          doctor_name: doctor.name,
          total_amount: totalNum,
          discount_type: form.discountType,
          discount_value: discVal,
          discount_amount: discAmt
        })
        .eq('id', appointment.id);
      if (error) throw error;
      const updated: Appointment = {
        ...appointment,
        patient_name: form.patient_name || null,
        patient_phone: form.patient_phone || null,
        mother_name: flatCols.mother_name,
        father_name: flatCols.father_name,
        parent_name: flatCols.parent_name,
        guardians: cleanGuardians.length > 0 ? cleanGuardians : undefined,
        patient_birth_date: form.birthDate || null,
        notes: form.notes || null,
        anamnesis: form.notes || null,
        start_time,
        doctor_id: form.doctor_id,
        doctor_name: doctor.name,
        total_amount: totalNum,
        amount_paid: appointment.amount_paid ?? 0,
        discount_type: form.discountType,
        discount_value: discVal,
        discount_amount: discAmt
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

  const handleDeleteConfirm = async () => {
    if (!appointment) return;
    setConfirmDeleteOpen(false);
    try {
      const { error } = await supabase.from('appointments').delete().eq('id', appointment.id);
      if (error) throw error;
      if (user?.id) await logAudit({ userId: user.id, action: 'delete', entityType: 'appointment', entityId: String(appointment.id), details: { patient_name: appointment.patient_name } });
      toast.success('Agendamento excluído com sucesso!');
      onDelete?.(appointment.id);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao excluir agendamento.');
    }
  };

  if (!appointment) return null;

  const totalDisplay = appointment.total_amount ?? 0;
  const paidDisplay = appointment.amount_paid ?? 0;
  const discountDisplay = appointment.discount_amount ?? 0;
  const effectiveTotalDisplay = effectiveAmount(totalDisplay, discountDisplay);
  const remainingDisplay = Math.max(0, effectiveTotalDisplay - paidDisplay);
  const pendingAmountValue = parseCurrency(pendingAmount);
  const remainingAfterCurrentInput = Math.max(0, remainingDisplay - pendingAmountValue);

  // Cálculo em tempo real para modo edição
  const editTotalNum = parseCurrency(form.totalAmount);
  const editDiscVal = Number(String(form.discountValue).replace(',', '.')) || 0;
  const editDiscAmt = computeDiscountAmount(editTotalNum, form.discountType, editDiscVal);
  const editFinalAmount = effectiveAmount(editTotalNum, editDiscAmt);

  // Cálculo em tempo real para desconto inline (modo leitura)
  const inlineDiscVal = Number(String(inlineDiscValue).replace(',', '.')) || 0;
  const inlineDiscAmt = computeDiscountAmount(totalDisplay, inlineDiscType, inlineDiscVal);
  const inlineEffective = effectiveAmount(totalDisplay, inlineDiscAmt);
  const inlineRemaining = Math.max(0, inlineEffective - paidDisplay);

  // Dados para exibição no modo leitura
  const displayGuardians = Array.isArray(appointment.guardians) && appointment.guardians.length > 0
    ? appointment.guardians
    : flatFieldsToFamilyMembers({
        mother_name: appointment.mother_name,
        father_name: appointment.father_name,
      });

  return (
    <>
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-2 animate-fade-in">
      <div className="bg-white dark:bg-[#202c33] w-full max-w-3xl rounded-2xl shadow-lg border border-slate-200 dark:border-[#3d3d48] overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-[#3d3d48] flex justify-between items-center bg-rose-50/50 dark:bg-rose-900/10">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-rose-100 dark:bg-rose-900/20 text-rose-500 dark:text-rose-400">
              <Info size={16} />
            </div>
            <h3 className="text-base font-semibold text-slate-700 dark:text-gray-200">
              {isEditing ? 'Editar agendamento e pagamento' : 'Detalhes do agendamento'}
            </h3>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 hover:bg-white/60 dark:hover:bg-white/10 rounded-lg transition-colors">
            <X size={18} className="text-slate-400 dark:text-[#71717a]" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[calc(100vh-10rem)] overflow-y-auto custom-scrollbar">
          {/* Bloco de pagamento pendente no topo */}
          {remainingDisplay > 0 && totalDisplay > 0 && !isEditing && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 space-y-3">
              <p className="text-xs font-bold text-amber-800 dark:text-amber-200 uppercase flex items-center gap-1.5">
                <Wallet size={14} />
                Pagamento pendente — registre o valor pago
              </p>
              <div className={`grid ${discountDisplay > 0 ? 'grid-cols-4' : 'grid-cols-3'} gap-2 items-end text-center`}>
                <div>
                  <label className="text-[10px] text-slate-500 dark:text-[#a1a1aa] uppercase block mb-1">Total</label>
                  <p className="text-sm font-bold text-slate-700 dark:text-gray-200">
                    R$ {totalDisplay.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                {discountDisplay > 0 && (
                  <div>
                    <label className="text-[10px] text-orange-600 dark:text-orange-400 uppercase block mb-1">Desc.</label>
                    <p className="text-sm font-bold text-orange-600 dark:text-orange-400">
                      -R$ {discountDisplay.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                )}
                <div>
                  <label className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-semibold block mb-1">Entrada desta vez (R$)</label>
                  <input
                    type="text"
                    value={pendingAmount}
                    onChange={e => setPendingAmount(formatMoneyInput(e.target.value))}
                    placeholder="0,00"
                    className="w-full text-sm font-bold border border-emerald-200 dark:border-emerald-700 rounded-lg px-2 py-2 bg-white dark:bg-[#1c1c21] text-emerald-700 dark:text-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 dark:text-[#a1a1aa] uppercase block mb-1">Falta</label>
                  <p className={`text-sm font-bold ${remainingAfterCurrentInput > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    R$ {remainingAfterCurrentInput.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              {/* Desconto inline — direto no bloco de pagamento */}
              {!inlineDiscountOpen ? (
                <button
                  type="button"
                  onClick={() => setInlineDiscountOpen(true)}
                  className="flex items-center gap-1.5 text-[11px] font-semibold text-orange-600 dark:text-orange-400 hover:underline"
                >
                  <Percent size={12} /> {discountDisplay > 0 ? 'Editar desconto' : 'Adicionar desconto'}
                </button>
              ) : (
                <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800/40 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-orange-700 dark:text-orange-300 uppercase flex items-center gap-1">
                      <Tag size={10} /> Desconto
                    </span>
                    <button
                      type="button"
                      onClick={() => setInlineDiscountOpen(false)}
                      className="text-[10px] text-slate-400 hover:text-red-500"
                    >
                      Fechar
                    </button>
                  </div>
                  <div className="flex gap-2 items-end">
                    <div className="flex rounded-lg overflow-hidden border border-orange-200 dark:border-orange-700">
                      {(['%', 'R$'] as DiscountType[]).map(t => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setInlineDiscType(t)}
                          className={`px-3 py-1.5 text-[11px] font-bold transition-colors ${
                            inlineDiscType === t
                              ? 'bg-orange-500 text-white'
                              : 'bg-white dark:bg-[#1c1c21] text-slate-600 dark:text-[#a1a1aa]'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                    <div className="flex-1">
                      <input
                        type="text"
                        value={inlineDiscValue}
                        onChange={e => {
                          const v = e.target.value.replace(/[^0-9.,]/g, '');
                          setInlineDiscValue(v);
                        }}
                        placeholder={inlineDiscType === '%' ? 'Ex: 10' : 'Ex: 50,00'}
                        className="w-full text-sm font-bold border border-orange-200 dark:border-orange-700 rounded-lg px-2 py-1.5 bg-white dark:bg-[#1c1c21] text-orange-700 dark:text-orange-300 focus:outline-none focus:ring-1 focus:ring-orange-400"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleSaveDiscountOnly}
                      disabled={savingDiscount}
                      className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-[11px] font-bold disabled:opacity-50 flex items-center gap-1"
                    >
                      {savingDiscount ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                      Aplicar
                    </button>
                  </div>
                  {inlineDiscAmt > 0 && (
                    <div className="flex justify-between text-[11px] font-semibold pt-1 border-t border-orange-200/60 dark:border-orange-800/30">
                      <span className="text-orange-600 dark:text-orange-400">
                        Desconto: -R$ {inlineDiscAmt.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-slate-600 dark:text-slate-300">
                        Efetivo: R$ {inlineEffective.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-rose-600 dark:text-rose-400">
                        Falta: R$ {inlineRemaining.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                  {discountDisplay > 0 && (
                    <button
                      type="button"
                      onClick={() => { setInlineDiscValue(''); handleSaveDiscountOnly(); }}
                      className="text-[10px] text-red-500 hover:underline font-semibold"
                    >
                      Remover desconto
                    </button>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <p className="text-[10px] uppercase font-semibold text-slate-500 dark:text-[#a1a1aa]">Forma de pagamento</p>
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
                          : 'border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-[#3d3d48] dark:text-[#d4d4d8] dark:hover:bg-white/5'
                      }`}
                    >
                      {method.label}
                    </button>
                  ))}
                </div>
                {paymentMode === 'mixed' && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] uppercase text-slate-500 dark:text-[#a1a1aa]">Pix</label>
                      <input type="text" value={mixedPayments.pix} onChange={(e) => setMixedPayments((prev) => ({ ...prev, pix: formatMoneyInput(e.target.value) }))} placeholder="0,00" className="w-full rounded-lg border border-slate-200 dark:border-[#3d3d48] px-2 py-1.5 text-xs bg-white dark:bg-[#1c1c21] text-slate-700 dark:text-gray-200" />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase text-slate-500 dark:text-[#a1a1aa]">Dinheiro</label>
                      <input type="text" value={mixedPayments.cash} onChange={(e) => setMixedPayments((prev) => ({ ...prev, cash: formatMoneyInput(e.target.value) }))} placeholder="0,00" className="w-full rounded-lg border border-slate-200 dark:border-[#3d3d48] px-2 py-1.5 text-xs bg-white dark:bg-[#1c1c21] text-slate-700 dark:text-gray-200" />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase text-slate-500 dark:text-[#a1a1aa]">Crédito</label>
                      <input type="text" value={mixedPayments.credit_card} onChange={(e) => setMixedPayments((prev) => ({ ...prev, credit_card: formatMoneyInput(e.target.value) }))} placeholder="0,00" className="w-full rounded-lg border border-slate-200 dark:border-[#3d3d48] px-2 py-1.5 text-xs bg-white dark:bg-[#1c1c21] text-slate-700 dark:text-gray-200" />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase text-slate-500 dark:text-[#a1a1aa]">Débito</label>
                      <input type="text" value={mixedPayments.debit_card} onChange={(e) => setMixedPayments((prev) => ({ ...prev, debit_card: formatMoneyInput(e.target.value) }))} placeholder="0,00" className="w-full rounded-lg border border-slate-200 dark:border-[#3d3d48] px-2 py-1.5 text-xs bg-white dark:bg-[#1c1c21] text-slate-700 dark:text-gray-200" />
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

          {/* Paciente + Tipo lado a lado */}
          <div className="flex items-center gap-3 pb-4 border-b border-slate-200 dark:border-[#3d3d48]">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center font-semibold text-lg bg-rose-100 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400">
              {isEditing ? <Edit2 size={18} /> : (appointment.patient_name?.charAt(0) || 'P')}
            </div>
            <div className="flex-1">
              {isEditing ? (
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-500 dark:text-[#a1a1aa] uppercase">Nome do paciente</label>
                  <input
                    type="text"
                    className="w-full text-sm font-medium text-slate-800 dark:text-[#fafafa] border border-slate-200 dark:border-gray-600 rounded-lg px-3 py-1.5 focus:border-rose-400 focus:ring-1 focus:ring-rose-400/20 outline-none bg-white dark:bg-[#1c1c21]"
                    value={form.patient_name}
                    onChange={e => setForm(prev => ({ ...prev, patient_name: e.target.value }))}
                    placeholder="Nome do paciente"
                  />
                </div>
              ) : (
                <h4 className="text-base font-semibold text-slate-800 dark:text-[#fafafa]">
                  {appointment.patient_name || 'Sem nome'}
                </h4>
              )}
              {!isEditing && (
                <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 ${
                  appointment.appointment_type === 'retorno'
                    ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                    : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                }`}>
                  {appointment.appointment_type === 'retorno' ? 'Retorno' : 'Consulta'}
                </span>
              )}
            </div>
          </div>

          {/* Grid 2 colunas: dados do paciente + dados do agendamento */}
          <div className="grid grid-cols-2 gap-3">
            {/* Coluna esquerda: Data de Nascimento, Responsáveis, WhatsApp */}
            <div className="space-y-2">
              {isEditing ? (
                <div className="flex items-center gap-2.5 p-2.5 bg-slate-50 dark:bg-[#1a1f28] rounded-lg border border-slate-200 dark:border-[#3d3d48]">
                  <div className="p-1.5 bg-amber-100 dark:bg-amber-900/20 text-amber-500 dark:text-amber-400 rounded-md"><Cake size={14} /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold text-slate-500 dark:text-[#a1a1aa] uppercase">Data de Nascimento *</p>
                    <input
                      type="text"
                      value={form.birthDateDisplay}
                      onChange={e => handleDateMaskedInput(e.target.value, 'birthDateDisplay', 'birthDate')}
                      placeholder="DD/MM/AAAA"
                      maxLength={10}
                      className="w-full text-sm font-medium text-slate-700 dark:text-gray-200 border border-slate-200 dark:border-gray-600 rounded-md px-2 py-1.5 focus:border-rose-400 focus:ring-1 focus:ring-rose-400/20 outline-none bg-white dark:bg-[#1c1c21]"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2.5 p-2.5 bg-slate-50 dark:bg-[#1a1f28] rounded-lg border border-slate-200 dark:border-[#3d3d48]">
                  <div className="p-1.5 bg-amber-100 dark:bg-amber-900/20 text-amber-500 dark:text-amber-400 rounded-md"><Cake size={14} /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold text-slate-500 dark:text-[#a1a1aa] uppercase">Data de Nascimento</p>
                    <p className="text-sm text-slate-700 dark:text-gray-200 font-medium">
                      {appointment.patient_birth_date
                        ? formatDateToDisplay(appointment.patient_birth_date)
                        : 'Não informado'}
                    </p>
                  </div>
                </div>
              )}

              {/* Responsáveis — modo edição usa FamilyMembersField, modo leitura lista compacta */}
              {isEditing ? (
                <div className="p-2.5 bg-slate-50 dark:bg-[#1a1f28] rounded-lg border border-slate-200 dark:border-[#3d3d48]">
                  <FamilyMembersField
                    mode="controlled"
                    value={guardians}
                    onChange={setGuardians}
                    compact
                  />
                </div>
              ) : (
                <div className="flex items-start gap-2.5 p-2.5 bg-slate-50 dark:bg-[#1a1f28] rounded-lg border border-slate-200 dark:border-[#3d3d48]">
                  <div className="p-1.5 bg-purple-100 dark:bg-purple-900/20 text-purple-500 dark:text-purple-400 rounded-md mt-0.5"><User size={14} /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold text-slate-500 dark:text-[#a1a1aa] uppercase">Responsáveis</p>
                    {displayGuardians.length > 0 ? (
                      <div className="space-y-0.5">
                        {displayGuardians.map((g, i) => (
                          <p key={i} className="text-sm text-slate-700 dark:text-gray-200 font-medium truncate">
                            {g.name} {g.relationship && <span className="text-[10px] text-slate-400 dark:text-[#71717a]">({g.relationship})</span>}
                          </p>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-700 dark:text-gray-200 font-medium">Não informado</p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2.5 p-2.5 bg-slate-50 dark:bg-[#1a1f28] rounded-lg border border-slate-200 dark:border-[#3d3d48]">
                <div className="p-1.5 bg-green-100 dark:bg-green-900/20 text-green-500 dark:text-green-400 rounded-md"><Phone size={14} /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold text-slate-500 dark:text-[#a1a1aa] uppercase">WhatsApp</p>
                  {isEditing ? (
                    <input type="text" value={form.patient_phone} onChange={e => setForm(prev => ({ ...prev, patient_phone: e.target.value }))} placeholder="(00) 00000-0000" className="w-full text-sm font-medium text-slate-700 dark:text-gray-200 border border-slate-200 dark:border-gray-600 rounded-md px-2 py-1.5 focus:border-rose-400 focus:ring-1 focus:ring-rose-400/20 outline-none bg-white dark:bg-[#1c1c21]" />
                  ) : (
                    <p className="text-sm text-slate-700 dark:text-gray-200 font-medium">
                      {appointment.patient_phone ? appointment.patient_phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3') : 'Não informado'}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Coluna direita: Data, Hora, Médico, Observações */}
            <div className="space-y-2">
              <div className="p-2.5 bg-slate-50 dark:bg-[#1a1f28] rounded-lg border border-slate-200 dark:border-[#3d3d48]">
                <div className="flex items-center gap-1.5 mb-1">
                  <CalendarDays size={14} className="text-rose-500 dark:text-rose-400" />
                  <span className="text-[10px] font-semibold text-slate-500 dark:text-[#a1a1aa] uppercase">Data</span>
                </div>
                {isEditing ? (
                  <input type="text" value={form.dateDisplay} onChange={e => handleDateMaskedInput(e.target.value, 'dateDisplay', 'date')} placeholder="DD/MM/AAAA" maxLength={10} className="w-full text-sm font-semibold text-slate-700 dark:text-gray-200 border border-slate-200 dark:border-gray-600 rounded-md px-2 py-1.5 focus:border-rose-400 focus:ring-1 focus:ring-rose-400/20 outline-none bg-white dark:bg-[#1c1c21]" />
                ) : (
                  <p className="text-sm font-semibold text-slate-700 dark:text-gray-200">
                    {new Date(appointment.start_time).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                )}
              </div>

              <div className="p-2.5 bg-slate-50 dark:bg-[#1a1f28] rounded-lg border border-slate-200 dark:border-[#3d3d48]">
                <div className="flex items-center gap-1.5 mb-1">
                  <Clock size={14} className="text-rose-500 dark:text-rose-400" />
                  <span className="text-[10px] font-semibold text-slate-500 dark:text-[#a1a1aa] uppercase">Horário</span>
                </div>
                {isEditing ? (
                  <input type="time" value={form.time} onChange={e => setForm(prev => ({ ...prev, time: e.target.value }))} className="w-full text-sm font-semibold text-slate-700 dark:text-gray-200 border border-slate-200 dark:border-gray-600 rounded-md px-2 py-1.5 focus:border-rose-400 focus:ring-1 focus:ring-rose-400/20 outline-none bg-white dark:bg-[#1c1c21]" />
                ) : (
                  <p className="text-sm font-semibold text-slate-700 dark:text-gray-200">
                    {(() => {
                      const clean2 = appointment.start_time ? appointment.start_time.replace(/[+-]\d{2}:\d{2}$/, '').replace('Z', '') : '';
                      const [datePart2, timePart2] = clean2.split('T');
                      if (datePart2 && timePart2) {
                        const [y, m, d] = datePart2.split('-').map(Number);
                        const [h, min] = timePart2.split(':').map(Number);
                        const dLocal = new Date(y, m - 1, d, h, min || 0, 0);
                        return dLocal.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false });
                      }
                      return '--:--';
                    })()}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2.5 p-2.5 bg-slate-50 dark:bg-[#1a1f28] rounded-lg border border-slate-200 dark:border-[#3d3d48]">
                <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/20 text-indigo-500 dark:text-indigo-400 rounded-md">
                  <Stethoscope size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold text-slate-500 dark:text-[#a1a1aa] uppercase">Médico</p>
                  {isEditing ? (
                    <select value={form.doctor_id ?? ''} onChange={e => setForm(prev => ({ ...prev, doctor_id: e.target.value ? Number(e.target.value) : null }))} className="w-full text-sm text-slate-700 dark:text-gray-200 font-medium border border-slate-200 dark:border-gray-600 rounded-md px-2 py-1.5 focus:border-rose-400 focus:ring-1 focus:ring-rose-400/20 outline-none bg-white dark:bg-[#1c1c21]">
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

              {/* Observações na coluna direita */}
              <div className="p-2.5 bg-slate-50 dark:bg-[#1a1f28] rounded-lg border border-slate-200 dark:border-[#3d3d48]">
                <div className="flex items-center gap-1.5 mb-1">
                  <FileText size={14} className="text-slate-500 dark:text-[#a1a1aa]" />
                  <span className="text-[10px] font-semibold text-slate-500 dark:text-[#a1a1aa] uppercase">Observações</span>
                </div>
                {isEditing ? (
                  <textarea className="w-full p-2 text-sm text-slate-700 dark:text-gray-200 border border-slate-200 dark:border-gray-600 rounded-lg focus:border-rose-400 focus:ring-1 focus:ring-rose-400/20 outline-none bg-white dark:bg-[#1c1c21] min-h-[50px] resize-y" value={form.notes} onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))} placeholder="Anotações..." />
                ) : (
                  <p className="text-xs text-slate-600 dark:text-[#d4d4d8] leading-relaxed">
                    {appointment.anamnesis || appointment.notes || 'Nenhuma observação.'}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Bloco financeiro */}
          <div className="bg-amber-50 dark:bg-amber-900/10 p-3 rounded-xl border border-amber-200 dark:border-amber-800/50">
            <h5 className="text-xs font-bold text-amber-800 dark:text-amber-200 uppercase mb-2 flex items-center gap-1">
              <Wallet size={12} /> Pagamento
            </h5>
            {isEditing ? (
              <div className="space-y-2">
                <div>
                  <label className="text-[10px] text-slate-500 dark:text-[#a1a1aa] uppercase">Valor da consulta (R$)</label>
                  <input type="text" value={form.totalAmount} onChange={e => handleMoneyInput('totalAmount', e.target.value)} className="w-full text-sm font-bold border border-slate-200 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-[#1c1c21] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-amber-400" placeholder="0,00" />
                </div>

                {/* Desconto — modo edição */}
                {editTotalNum > 0 && (
                  <div className="space-y-2">
                    {!showDiscount ? (
                      <button
                        type="button"
                        onClick={() => setShowDiscount(true)}
                        className="flex items-center gap-1.5 text-[11px] font-semibold text-orange-600 dark:text-orange-400 hover:underline"
                      >
                        <Percent size={12} /> Adicionar desconto
                      </button>
                    ) : (
                      <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800/40 rounded-lg p-2.5 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-orange-700 dark:text-orange-300 uppercase flex items-center gap-1">
                            <Tag size={10} /> Desconto
                          </span>
                          <button
                            type="button"
                            onClick={() => { setShowDiscount(false); setForm(prev => ({ ...prev, discountValue: '' })); }}
                            className="text-[10px] text-slate-400 hover:text-red-500"
                          >
                            Remover
                          </button>
                        </div>
                        <div className="flex gap-2 items-end">
                          <div className="flex rounded-lg overflow-hidden border border-orange-200 dark:border-orange-700">
                            {(['%', 'R$'] as DiscountType[]).map(t => (
                              <button
                                key={t}
                                type="button"
                                onClick={() => setForm(prev => ({ ...prev, discountType: t }))}
                                className={`px-3 py-1.5 text-[11px] font-bold transition-colors ${
                                  form.discountType === t
                                    ? 'bg-orange-500 text-white'
                                    : 'bg-white dark:bg-[#1c1c21] text-slate-600 dark:text-[#a1a1aa]'
                                }`}
                              >
                                {t}
                              </button>
                            ))}
                          </div>
                          <div className="flex-1">
                            <input
                              type="text"
                              value={form.discountValue}
                              onChange={e => {
                                const v = e.target.value.replace(/[^0-9.,]/g, '');
                                setForm(prev => ({ ...prev, discountValue: v }));
                              }}
                              placeholder={form.discountType === '%' ? 'Ex: 10' : 'Ex: 50,00'}
                              className="w-full text-sm font-bold border border-orange-200 dark:border-orange-700 rounded-lg px-2 py-1.5 bg-white dark:bg-[#1c1c21] text-orange-700 dark:text-orange-300 focus:outline-none focus:ring-1 focus:ring-orange-400"
                            />
                          </div>
                        </div>
                        {editDiscAmt > 0 && (
                          <div className="flex justify-between text-[11px] font-semibold pt-1 border-t border-orange-200/60 dark:border-orange-800/30">
                            <span className="text-orange-600 dark:text-orange-400">
                              Desconto: -R$ {editDiscAmt.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                            <span className="text-emerald-600 dark:text-emerald-400">
                              Final: R$ {editFinalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {paidDisplay > 0 && (
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                    Pago: R$ {paidDisplay.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (registrado via pagamento)
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between items-center bg-white dark:bg-black/20 p-2.5 rounded-lg border border-amber-200/50 dark:border-amber-800/30">
                  <div>
                    <p className="text-[10px] text-slate-500 dark:text-[#a1a1aa] uppercase font-semibold">Total</p>
                    <p className="text-sm font-bold text-slate-700 dark:text-gray-200">R$ {totalDisplay.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </div>
                  {discountDisplay > 0 && (
                    <div className="text-center">
                      <p className="text-[10px] text-orange-600/80 dark:text-orange-400/80 uppercase font-semibold flex items-center gap-0.5"><Tag size={8} /> Desc.</p>
                      <p className="text-sm font-bold text-orange-600 dark:text-orange-400">-R$ {discountDisplay.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                  )}
                  <div className="text-right">
                    <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 uppercase font-semibold">Pago</p>
                    <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">R$ {paidDisplay.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-500 dark:text-[#a1a1aa] uppercase font-semibold">Falta</p>
                    <p className={`text-sm font-black ${remainingDisplay > 0 ? 'text-rose-500 dark:text-rose-400' : 'text-slate-400 dark:text-[#71717a]'}`}>
                      R$ {remainingDisplay.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </div>
            )}
            {!isEditing && remainingDisplay > 0 && totalDisplay > 0 && (
              <p className="text-[10px] text-amber-700 dark:text-amber-300 mt-2 font-semibold">
                Registre o pagamento para liberar a entrada do paciente na consulta.
              </p>
            )}
          </div>
        </div>

        {/* Rodapé */}
        <div className="p-4 bg-slate-50/50 dark:bg-[#08080b] border-t border-slate-200 dark:border-[#3d3d48] flex gap-2">
          {isEditing ? (
            <>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="flex-1 bg-white dark:bg-[#1c1c21] border border-slate-300 dark:border-gray-600 text-slate-600 dark:text-[#d4d4d8] py-2 rounded-lg text-xs font-semibold hover:bg-slate-50 dark:hover:bg-white/10 transition-colors"
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
                onClick={() => setConfirmDeleteOpen(true)}
                className="px-3 bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center justify-center gap-1.5"
              >
                <Trash2 size={14} /> Excluir
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="flex-1 bg-rose-500 hover:bg-rose-600 text-white py-2 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
              >
                <Edit2 size={14} /> Editar dados
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-white dark:bg-[#1c1c21] border border-slate-300 dark:border-gray-600 text-slate-600 dark:text-[#d4d4d8] py-2 rounded-lg text-xs font-semibold hover:bg-slate-50 dark:hover:bg-white/10 transition-colors"
              >
                Fechar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
    <ConfirmModal
      isOpen={confirmDeleteOpen}
      onClose={() => setConfirmDeleteOpen(false)}
      onConfirm={handleDeleteConfirm}
      title="Excluir agendamento"
      message={`Deseja realmente excluir o agendamento de ${appointment.patient_name || 'este paciente'}?`}
      type="danger"
      confirmText="Excluir"
    />
    </>
  );
}
