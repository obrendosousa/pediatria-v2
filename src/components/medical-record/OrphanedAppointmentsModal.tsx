'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
const supabase = createClient();
import { Appointment } from '@/types/medical';
import { X, AlertTriangle, CheckCircle2, Clock, User, Calendar } from 'lucide-react';
import { formatAppointmentTime, parseAppointmentDate } from '@/utils/dateUtils';
import { useToast } from '@/contexts/ToastContext';
import ConfirmModal from '@/components/ui/ConfirmModal';

interface OrphanedAppointmentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointments: Appointment[];
  onFinalize: (appointmentId: number) => Promise<void>;
  onRefresh: () => void;
}

export default function OrphanedAppointmentsModal({
  isOpen,
  onClose,
  appointments,
  onFinalize,
  onRefresh
}: OrphanedAppointmentsModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState<number | null>(null);
  const [dontShowToday, setDontShowToday] = useState(false);
  const [confirmCancelId, setConfirmCancelId] = useState<number | null>(null);

  if (!isOpen) return null;

  const calculateTimeInService = (startTime: string): string => {
    const start = new Date(startTime);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffHours > 24) {
      const days = Math.floor(diffHours / 24);
      return `${days} dia${days > 1 ? 's' : ''} e ${diffHours % 24}h`;
    }
    
    return `${diffHours}h ${diffMinutes}min`;
  };

  const handleFinalize = async (appointmentId: number) => {
    setLoading(appointmentId);
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'finished', finished_at: new Date().toISOString() })
        .eq('id', appointmentId);

      if (error) throw error;

      await onFinalize(appointmentId);
      onRefresh();
      
      // Se não houver mais atendimentos órfãos, fechar modal
      const remaining = appointments.filter(a => a.id !== appointmentId);
      if (remaining.length === 0) {
        if (dontShowToday) {
          localStorage.setItem('orphanedAppointmentsAlertDate', new Date().toDateString());
        }
        onClose();
      }
    } catch (error: any) {
      console.error('Erro ao finalizar atendimento:', error);
      toast.toast.error('Erro ao finalizar atendimento: ' + (error.message || 'Tente novamente.'));
    } finally {
      setLoading(null);
    }
  };

  const handleRevertToWaiting = async (appointmentId: number) => {
    setLoading(appointmentId);
    try {
      const { error } = await supabase
        .from('appointments')
        .update({
          status: 'waiting',
          queue_entered_at: new Date().toISOString(),
          in_service_at: null,
          finished_at: null,
        })
        .eq('id', appointmentId);

      if (error) throw error;

      onRefresh();
      
      // Se não houver mais atendimentos órfãos, fechar modal
      const remaining = appointments.filter(a => a.id !== appointmentId);
      if (remaining.length === 0) {
        if (dontShowToday) {
          localStorage.setItem('orphanedAppointmentsAlertDate', new Date().toDateString());
        }
        onClose();
      }
    } catch (error: any) {
      console.error('Erro ao reverter atendimento:', error);
      toast.toast.error('Erro ao reverter atendimento: ' + (error.message || 'Tente novamente.'));
    } finally {
      setLoading(null);
    }
  };

  const handleCancelClick = (appointmentId: number) => {
    setConfirmCancelId(appointmentId);
  };

  const handleCancelConfirm = async () => {
    const appointmentId = confirmCancelId;
    if (appointmentId == null) return;
    setConfirmCancelId(null);
    setLoading(appointmentId);
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', appointmentId);

      if (error) throw error;

      onRefresh();
      
      const remaining = appointments.filter(a => a.id !== appointmentId);
      if (remaining.length === 0) {
        if (dontShowToday) {
          localStorage.setItem('orphanedAppointmentsAlertDate', new Date().toDateString());
        }
        onClose();
      }
    } catch (error: any) {
      console.error('Erro ao cancelar atendimento:', error);
      toast.toast.error('Erro ao cancelar atendimento: ' + (error.message || 'Tente novamente.'));
    } finally {
      setLoading(null);
    }
  };

  const handleClose = () => {
    if (dontShowToday) {
      localStorage.setItem('orphanedAppointmentsAlertDate', new Date().toDateString());
    }
    onClose();
  };

  return (
    <>
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#1e2028] rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-gray-100">
                Atendimentos Pendentes
              </h2>
              <p className="text-sm text-slate-500 dark:text-gray-400">
                {appointments.length} atendimento{appointments.length > 1 ? 's' : ''} não finalizado{appointments.length > 1 ? 's' : ''} de dias anteriores
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-[#2a2d36] rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {appointments.map((apt) => {
            const appointmentDate = parseAppointmentDate(apt.start_time);
            const timeInService = calculateTimeInService(apt.start_time);
            const isLongTime = timeInService.includes('dia');

            return (
              <div
                key={apt.id}
                className="border border-slate-200 dark:border-gray-700 rounded-xl p-4 bg-slate-50/50 dark:bg-[#111b21]"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <User className="w-4 h-4 text-slate-500 dark:text-gray-400" />
                      <h3 className="font-bold text-slate-800 dark:text-gray-100">
                        {apt.patient_name || 'Sem nome'}
                      </h3>
                      {isLongTime && (
                        <span className="px-2 py-0.5 text-xs font-bold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded">
                          URGENTE
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-slate-600 dark:text-gray-400">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4" />
                        <span>{appointmentDate || 'Data não disponível'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4" />
                        <span>{formatAppointmentTime(apt.start_time)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        <span className="font-semibold">Em atendimento há: {timeInService}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => handleFinalize(apt.id)}
                    disabled={loading === apt.id}
                    className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading === apt.id ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Finalizando...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Finalizar
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleRevertToWaiting(apt.id)}
                    disabled={loading === apt.id}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    Reverter para Fila
                  </button>
                  <button
                    onClick={() => handleCancelClick(apt.id)}
                    disabled={loading === apt.id}
                    className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-gray-200 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-200 dark:border-gray-800 bg-slate-50/50 dark:bg-[#111b21]">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={dontShowToday}
              onChange={(e) => setDontShowToday(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 dark:border-gray-600 text-amber-600 focus:ring-amber-500"
            />
            <span className="text-sm text-slate-600 dark:text-gray-400">
              Não mostrar novamente hoje
            </span>
          </label>
          <button
            onClick={handleClose}
            className="mt-4 w-full px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-gray-200 font-medium rounded-lg transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
    <ConfirmModal
      isOpen={confirmCancelId != null}
      onClose={() => setConfirmCancelId(null)}
      onConfirm={handleCancelConfirm}
      title="Cancelar atendimento"
      message="Deseja realmente cancelar este atendimento?"
      type="danger"
      confirmText="Sim, cancelar"
    />
    </>
  );
}
