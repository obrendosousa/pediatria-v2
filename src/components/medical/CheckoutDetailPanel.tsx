'use client';

import { useState } from 'react';
import { Loader2, User, CheckCircle2, Clock } from 'lucide-react';
import { useCheckoutPanel } from '@/hooks/useCheckoutPanel';
import { useToast } from '@/contexts/ToastContext';
import CheckoutDocumentsSection from './checkout/CheckoutDocumentsSection';
import CheckoutReturnSection from './checkout/CheckoutReturnSection';
import CheckoutChargeSummary from './checkout/CheckoutChargeSummary';
import CheckoutLojinhaSection from './checkout/CheckoutLojinhaSection';
import CheckoutFinalizeFooter from './checkout/CheckoutFinalizeFooter';

interface CheckoutDetailPanelProps {
  appointmentId: number | null;
  onSuccess?: () => void;
  onScheduleReturn?: (data: { suggestedDate: string; patientId?: number; patientName?: string; parentName?: string; phone?: string; patientSex?: 'M' | 'F'; doctorId?: number; appointmentType?: string; birthDate?: string; guardians?: Array<{ name: string; relationship: string; phone?: string }>; checkoutId?: number }) => void;
  onEditReturn?: (appointmentId: number) => void;
  onViewReturn?: (date: string) => void;
  refreshKey?: number;
}

function calculateAge(birthDate: string): string {
  const birth = new Date(birthDate);
  const now = new Date();
  const years = now.getFullYear() - birth.getFullYear();
  const months = now.getMonth() - birth.getMonth();
  if (years < 1) return `${Math.max(0, months + (years * 12))} meses`;
  if (years < 3) {
    const totalMonths = years * 12 + months;
    return `${Math.floor(totalMonths / 12)}a ${totalMonths % 12}m`;
  }
  return `${years} anos`;
}

export default function CheckoutDetailPanel({
  appointmentId,
  onSuccess,
  onScheduleReturn,
  onEditReturn,
  onViewReturn,
  refreshKey
}: CheckoutDetailPanelProps) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const {
    loading,
    appointment,
    medicalCheckout,
    consultationDocs,
    search,
    setSearch,
    selectedItems,
    addItem,
    removeItem,
    total,
    paymentMethod,
    setPaymentMethod,
    hasNewSaleItems,
    filteredCatalog,
    handleSubmit
  } = useCheckoutPanel(appointmentId, refreshKey);

  const handleFinalize = async () => {
    setSubmitting(true);
    try {
      await handleSubmit(onSuccess);
      setSubmitting(false);
    } catch (err: unknown) {
      setSubmitting(false);
      const message = err instanceof Error ? err.message : 'Tente novamente.';
      toast.toast.error('Erro ao processar checkout: ' + message);
    }
  };

  // Empty state - no appointment selected
  if (!appointmentId) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-slate-50/50 dark:bg-[#111b21]/50 rounded-xl border-2 border-dashed border-slate-200 dark:border-[#3d3d48] p-8">
        <User className="w-16 h-16 text-slate-300 dark:text-gray-600 mb-4" />
        <p className="text-slate-500 dark:text-[#a1a1aa] font-medium text-center">
          Selecione um paciente na lista ao lado para ver o painel de fechamento.
        </p>
      </div>
    );
  }

  // Loading state
  if (loading && !appointment) {
    return (
      <div className="h-full flex items-center justify-center bg-white dark:bg-[#08080b] rounded-xl border border-slate-200 dark:border-[#3d3d48]">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  // Not found
  if (!appointment) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-slate-50/50 dark:bg-[#111b21]/50 rounded-xl border border-slate-200 dark:border-[#3d3d48] p-8">
        <p className="text-slate-500 dark:text-[#a1a1aa] text-center">Paciente nao encontrado.</p>
      </div>
    );
  }

  const doctorName = appointment.doctor_name || 'Medica';
  const returnDate = medicalCheckout?.return_date;
  const returnObs = medicalCheckout?.return_obs;
  const isFullyPaid = total <= 0 && (Number(appointment.amount_paid || 0) >= Number(appointment.total_amount || 0));
  const totalDocs = consultationDocs.prescriptions.length + consultationDocs.examRequests.length + consultationDocs.documents.length;
  const hasContent = totalDocs > 0 || returnDate || selectedItems.length > 0;
  const appointmentTypeLabel = appointment.appointment_type === 'retorno' ? 'Retorno' : 'Consulta';

  return (
    <div className="h-full flex flex-col bg-white dark:bg-[#08080b] rounded-xl border border-slate-200 dark:border-[#3d3d48] overflow-hidden">
      {/* Patient Header */}
      <div className="px-5 py-3.5 border-b border-slate-100 dark:border-[#2d2d36] bg-slate-50/50 dark:bg-[#0f0f14]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
              <span className="text-sm font-black text-purple-600 dark:text-purple-400">
                {(appointment.patient_name || 'P').charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-800 dark:text-[#fafafa] truncate">
                {appointment.patient_name || 'Paciente'}
              </p>
              <p className="text-xs text-slate-400 dark:text-[#71717a]">
                {appointment.patient_birth_date ? calculateAge(appointment.patient_birth_date) : ''}
                {appointment.patient_birth_date && doctorName ? ' • ' : ''}
                {doctorName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
              appointment.appointment_type === 'retorno'
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                : 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
            }`}>
              {appointmentTypeLabel}
            </span>
            {appointment.start_time && (
              <span className="text-[10px] text-slate-400 dark:text-[#71717a] flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {appointment.start_time.substring(11, 16)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
        {/* Empty state */}
        {!hasContent && !loading && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-300 dark:text-emerald-800 mb-3" />
            <p className="text-sm font-semibold text-slate-600 dark:text-[#d4d4d8]">Consulta sem pendencias</p>
            <p className="text-xs text-slate-400 dark:text-[#71717a] mt-1">Nenhum documento, produto ou retorno para processar.</p>
          </div>
        )}

        {/* Section A: Smart Documents */}
        <CheckoutDocumentsSection docs={consultationDocs} />

        {/* Section B: Return / Next Steps */}
        {returnDate && (
          <CheckoutReturnSection
            returnDate={returnDate}
            returnObs={returnObs}
            returnScheduledDate={medicalCheckout?.return_scheduled_date}
            doctorName={doctorName}
            onScheduleReturn={onScheduleReturn ? () => onScheduleReturn({
              suggestedDate: returnDate,
              patientId: appointment.patient_id || undefined,
              patientName: appointment.patient_name || undefined,
              parentName: appointment.parent_name || undefined,
              phone: appointment.patient_phone || undefined,
              patientSex: appointment.patient_sex || undefined,
              doctorId: appointment.doctor_id || undefined,
              appointmentType: 'retorno',
              birthDate: appointment.patient_birth_date || undefined,
              guardians: appointment.guardians || undefined,
              checkoutId: medicalCheckout?.id || undefined,
            }) : undefined}
            onEditReturn={onEditReturn && medicalCheckout?.return_appointment_id
              ? () => onEditReturn(medicalCheckout.return_appointment_id as number)
              : undefined}
            onViewReturn={onViewReturn && medicalCheckout?.return_scheduled_date
              ? () => onViewReturn(medicalCheckout.return_scheduled_date as string)
              : undefined}
          />
        )}

        {/* Section C: Charge Summary */}
        <CheckoutChargeSummary
          selectedItems={selectedItems}
          total={total}
          onAddItem={addItem}
          onRemoveItem={removeItem}
        />

        {/* Section D: Lojinha / Product Sales */}
        <CheckoutLojinhaSection
          search={search}
          onSearchChange={setSearch}
          filteredCatalog={filteredCatalog}
          onAddItem={addItem}
          hasNewSaleItems={hasNewSaleItems}
          paymentMethod={paymentMethod}
          onPaymentMethodChange={setPaymentMethod}
          doctorItems={medicalCheckout?.checkout_items || []}
        />
      </div>

      {/* Sticky Footer */}
      <CheckoutFinalizeFooter
        total={total}
        isFullyPaid={isFullyPaid}
        hasItems={selectedItems.length > 0}
        submitting={submitting}
        onFinalize={handleFinalize}
      />
    </div>
  );
}
