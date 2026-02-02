'use client';

import { Appointment } from '@/types/medical';
import { 
  Clock, Stethoscope, Phone, Megaphone, MapPin, 
  DoorOpen, CheckCircle, Undo2, Loader2, Timer
} from 'lucide-react';
import { formatAppointmentTime } from '@/utils/dateUtils';
import { calculateTimeInService, isLongRunningAppointment } from '@/utils/appointmentSafety';

interface ReceptionCardProps {
  appointment: Appointment;
  status: 'scheduled' | 'called' | 'waiting' | 'in_service' | 'finished';
  position?: number;
  isUpdating?: boolean;
  onCall?: () => void;
  onCheckIn?: () => void;
  onConfirmArrival?: () => void;
  onEnter?: () => void;
  onFinish?: () => void;
  onRevert?: () => void;
}

export default function ReceptionCard({
  appointment,
  status,
  position,
  isUpdating = false,
  onCall,
  onCheckIn,
  onConfirmArrival,
  onEnter,
  onFinish,
  onRevert
}: ReceptionCardProps) {
  // Usar função utilitária para formatação de horário
  const formatTime = formatAppointmentTime;

  const getCardStyles = () => {
    switch (status) {
      case 'scheduled':
        return 'border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10';
      case 'called':
        return 'border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/20';
      case 'waiting':
        return 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10';
      case 'in_service':
        // Verificar se está há muito tempo em atendimento
        const isLongRunning = isLongRunningAppointment(appointment.start_time, 2); // >2h
        const timeInService = calculateTimeInService(appointment.start_time);
        const hoursMatch = timeInService.match(/(\d+)h/);
        const hours = hoursMatch ? parseInt(hoursMatch[1]) : 0;
        const isVeryLong = timeInService.includes('dia') || hours > 2;
        
        if (isVeryLong) {
          return 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10';
        } else if (isLongRunning) {
          return 'border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/20';
        }
        return 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/20';
      case 'finished':
        return 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/20 opacity-75';
      default:
        return 'border-slate-200 dark:border-slate-700 bg-white dark:bg-[#202c33]';
    }
  };

  // Calcular tempo em atendimento para mostrar badge
  const getTimeInServiceBadge = () => {
    if (status !== 'in_service') return null;
    
    const timeInService = calculateTimeInService(appointment.start_time);
    const isLongRunning = isLongRunningAppointment(appointment.start_time, 2); // >2h
    const hoursMatch = timeInService.match(/(\d+)h/);
    const hours = hoursMatch ? parseInt(hoursMatch[1]) : 0;
    const isVeryLong = timeInService.includes('dia') || hours > 2;
    
    if (isVeryLong) {
      return (
        <span className="px-2 py-0.5 text-[10px] font-bold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded">
          {timeInService}
        </span>
      );
    } else if (isLongRunning) {
      return (
        <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded">
          {timeInService}
        </span>
      );
    }
    
    return null;
  };

  return (
    <div className={`p-3 rounded-lg border transition-all ${getCardStyles()}`}>
      {/* Header compacto */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-800 dark:text-gray-100 text-sm truncate">
            {appointment.patient_name || 'Sem nome'}
          </h3>
          {appointment.patient_phone && (
            <p className="text-[10px] text-slate-500 dark:text-gray-400 truncate mt-0.5">
              {appointment.patient_phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')}
            </p>
          )}
        </div>
        {position !== undefined && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
            position === 0 
              ? 'bg-rose-500 text-white' 
              : 'bg-slate-200 dark:bg-gray-600 text-slate-600 dark:text-gray-300'
          }`}>
            {position + 1}º
          </span>
        )}
        {status === 'called' && (
          <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded">
            Aguardando
          </span>
        )}
        {getTimeInServiceBadge()}
      </div>

      {/* Informações compactas */}
      <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-gray-400 mb-2">
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {formatTime(appointment.start_time)}
        </span>
        {appointment.doctor_name && (
          <>
            <span>•</span>
            <span className="truncate">{appointment.doctor_name}</span>
          </>
        )}
      </div>

      {/* Botões de ação compactos */}
      <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-200/50 dark:border-gray-700/50">
        {status === 'scheduled' && (
          <>
            <button
              onClick={onCall}
              disabled={isUpdating}
              className="w-full bg-rose-500 hover:bg-rose-600 text-white px-2.5 py-1.5 rounded-md text-[10px] font-semibold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Megaphone className="w-3 h-3" /> Chamar
            </button>
            <button
              onClick={onCheckIn}
              disabled={isUpdating}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white px-2.5 py-1.5 rounded-md text-[10px] font-semibold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {isUpdating ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <MapPin className="w-3 h-3" />
              )}
              Check-in
            </button>
          </>
        )}

        {status === 'called' && (
          <>
            <button
              onClick={onConfirmArrival}
              disabled={isUpdating}
              className="w-full bg-green-500 hover:bg-green-600 text-white px-2.5 py-1.5 rounded-md text-[10px] font-semibold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {isUpdating ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <CheckCircle className="w-3 h-3" />
              )}
              Chegou
            </button>
            <button
              onClick={onRevert}
              disabled={isUpdating}
              className="w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 px-2.5 py-1.5 rounded-md text-[10px] font-semibold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Undo2 className="w-3 h-3" /> Reverter
            </button>
          </>
        )}

        {status === 'waiting' && (
          <>
            <button
              onClick={onEnter}
              disabled={isUpdating}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white px-2.5 py-1.5 rounded-md text-[10px] font-semibold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {isUpdating ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <DoorOpen className="w-3 h-3" />
              )}
              Entrar
            </button>
            <button
              onClick={onRevert}
              disabled={isUpdating}
              className="w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 px-2.5 py-1.5 rounded-md text-[10px] font-semibold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Undo2 className="w-3 h-3" /> Reverter
            </button>
          </>
        )}

        {status === 'in_service' && (
          <>
            <button
              onClick={onFinish}
              disabled={isUpdating}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white px-2.5 py-1.5 rounded-md text-[10px] font-semibold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {isUpdating ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <CheckCircle className="w-3 h-3" />
              )}
              Finalizar
            </button>
            <button
              onClick={onRevert}
              disabled={isUpdating}
              className="w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 px-2.5 py-1.5 rounded-md text-[10px] font-semibold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Undo2 className="w-3 h-3" /> Reverter
            </button>
          </>
        )}

        {status === 'finished' && (
          <div className="text-center py-1">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold flex items-center justify-center gap-1">
              <CheckCircle className="w-3 h-3" />
              Atendimento Concluído
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
