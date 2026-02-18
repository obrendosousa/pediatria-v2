'use client';

import { Appointment } from '@/types/medical';
import { 
  Clock, Megaphone, MapPin, 
  DoorOpen, CheckCircle, Undo2, Loader2, 
  DollarSign, Wallet
} from 'lucide-react';
import { formatAppointmentTime } from '@/utils/dateUtils';
import { calculateTimeInService, isLongRunningAppointment } from '@/utils/appointmentSafety';

interface ReceptionCardProps {
  appointment: Appointment;
  status: 'scheduled' | 'called' | 'waiting' | 'in_service' | 'waiting_payment' | 'finished';
  position?: number;
  isUpdating?: boolean;
  isCalling?: boolean;
  onCall?: () => void;
  onCheckIn?: () => void;
  onConfirmArrival?: () => void;
  onEnter?: () => void;
  onFinish?: () => void; // Usado tanto para finalizar atendimento quanto para Checkout / Selecionar no hub
  onRevert?: () => void;
  onEdit?: () => void; // Abrir modal de edição/pagamento
  buttonLabel?: string; // Para personalizar o botão de ação (ex: "Realizar Checkout")
  /** No hub de checkout: card clicável para selecionar e destacar selecionado */
  selectable?: boolean;
  isSelected?: boolean;
}

export default function ReceptionCard({
  appointment,
  status,
  position,
  isUpdating = false,
  isCalling = false,
  onCall,
  onCheckIn,
  onConfirmArrival,
  onEnter,
  onFinish,
  onRevert,
  onEdit,
  buttonLabel,
  selectable = false,
  isSelected = false
}: ReceptionCardProps) {
  const formatTime = formatAppointmentTime;

  // Bloquear "Entrar" se houver valor a pagar (total > 0 e restante > 0)
  const total = Number(appointment.total_amount || 0);
  const paid = Number(appointment.amount_paid || 0);
  const remaining = total - paid;
  const canEnter = status !== 'waiting' || total <= 0 || remaining <= 0;

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
      case 'waiting_payment': // Novo Status de Checkout
        return 'border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-900/20';
      case 'finished':
        return 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/20 opacity-75';
      default:
        return 'border-slate-200 dark:border-slate-700 bg-white dark:bg-[#202c33]';
    }
  };

  // Calcular status financeiro para exibir badge
  const getFinancialBadge = () => {
    // Se não tem valor definido, não mostra nada
    if (!appointment.total_amount || appointment.total_amount <= 0) return null;

    const total = Number(appointment.total_amount);
    const paid = Number(appointment.amount_paid || 0);
    const remaining = total - paid;

    if (remaining <= 0) {
      // Totalmente Pago
      return (
        <div className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
          <CheckCircle className="w-3 h-3" />
          Pago
        </div>
      );
    } else if (paid > 0) {
      // Parcialmente Pago (Entrada)
      return (
        <div className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800" title={`Total: R$ ${total} | Pago: R$ ${paid}`}>
          <Wallet className="w-3 h-3" />
          Falta R$ {remaining.toFixed(2)}
        </div>
      );
    } else {
      // Nada pago ainda
      return (
        <div className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
          <DollarSign className="w-3 h-3" />
          R$ {total.toFixed(2)}
        </div>
      );
    }
  };

  // Calcular tempo em atendimento para mostrar badge de demora
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

  const handleCardClick = (e: React.MouseEvent) => {
    if (selectable && onFinish) {
      e.stopPropagation();
      onFinish();
    }
    if (onEdit && !selectable) {
      e.stopPropagation();
      onEdit();
    }
  };

  return (
    <div
      role={onEdit || selectable ? 'button' : undefined}
      tabIndex={onEdit || selectable ? 0 : undefined}
      onClick={onEdit || selectable ? handleCardClick : undefined}
      onKeyDown={onEdit || selectable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (selectable) onFinish?.(); else onEdit?.(); } } : undefined}
      className={`p-3 rounded-lg border transition-all ${getCardStyles()} ${
        isSelected ? 'ring-2 ring-purple-500 dark:ring-purple-400 shadow-md' : ''
      } ${onEdit || selectable ? 'cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-1 ' + (selectable ? 'hover:ring-2 hover:ring-purple-300 dark:hover:ring-purple-600/50 focus:ring-purple-400' : 'hover:ring-2 hover:ring-rose-300 dark:hover:ring-rose-600/50 focus:ring-rose-400 dark:focus:ring-rose-500') : ''}`}
    >
      {/* Header compacto */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0 mr-2">
          <h3 className="font-semibold text-slate-800 dark:text-gray-100 text-sm truncate">
            {appointment.patient_name || 'Sem nome'}
          </h3>
          {appointment.patient_phone && (
            <p className="text-[10px] text-slate-500 dark:text-gray-400 truncate mt-0.5">
              {appointment.patient_phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')}
            </p>
          )}
        </div>
        
        <div className="flex flex-col items-end gap-1">
          {position !== undefined && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
              position === 0 
                ? 'bg-rose-500 text-white' 
                : 'bg-slate-200 dark:bg-gray-600 text-slate-600 dark:text-gray-300'
            }`}>
              {position + 1}º
            </span>
          )}
          {/* Badge Financeiro */}
          {getFinancialBadge()}
        </div>

        {status === 'called' && (
          <span className="ml-1 text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded">
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
              type="button"
              onClick={(e) => { e.stopPropagation(); onCall?.(); }}
              disabled={isUpdating || isCalling}
              className="w-full bg-rose-500 hover:bg-rose-600 text-white px-2.5 py-1.5 rounded-md text-[10px] font-semibold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {isCalling ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Megaphone className="w-3 h-3" />
              )}
              {isCalling ? 'Chamando...' : 'Chamar'}
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onCheckIn?.(); }}
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
              type="button"
              onClick={(e) => { e.stopPropagation(); onConfirmArrival?.(); }}
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
              type="button"
              onClick={(e) => { e.stopPropagation(); onRevert?.(); }}
              disabled={isUpdating}
              className="w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 px-2.5 py-1.5 rounded-md text-[10px] font-semibold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Undo2 className="w-3 h-3" /> Reverter
            </button>
          </>
        )}

        {status === 'waiting' && (
          <>
            {!canEnter && total > 0 && (
              <p className="text-[10px] text-amber-700 dark:text-amber-300 font-semibold px-1 py-0.5">
                Clique no card para registrar o pagamento e liberar a entrada.
              </p>
            )}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onEnter?.(); }}
              disabled={isUpdating || !canEnter}
              title={!canEnter && total > 0 ? 'Registre o pagamento para liberar a entrada' : undefined}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white px-2.5 py-1.5 rounded-md text-[10px] font-semibold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUpdating ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <DoorOpen className="w-3 h-3" />
              )}
              Entrar
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRevert?.(); }}
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
              type="button"
              onClick={(e) => { e.stopPropagation(); onFinish?.(); }}
              disabled={isUpdating}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white px-2.5 py-1.5 rounded-md text-[10px] font-semibold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {isUpdating ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <CheckCircle className="w-3 h-3" />
              )}
              Finalizar Atendimento
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRevert?.(); }}
              disabled={isUpdating}
              className="w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 px-2.5 py-1.5 rounded-md text-[10px] font-semibold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Undo2 className="w-3 h-3" /> Reverter
            </button>
          </>
        )}

        {/* --- NOVO STATUS: WAITING PAYMENT (Checkout Secretária) --- */}
        {status === 'waiting_payment' && (
          <>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onFinish?.(); }}
              disabled={isUpdating}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white px-2.5 py-1.5 rounded-md text-[10px] font-semibold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 shadow-sm"
            >
              {isUpdating ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <DollarSign className="w-3 h-3" />
              )}
              {buttonLabel || 'Receber / Checkout'}
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRevert?.(); }}
              disabled={isUpdating}
              className="w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 px-2.5 py-1.5 rounded-md text-[10px] font-semibold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Undo2 className="w-3 h-3" /> Voltar p/ Atend.
            </button>
          </>
        )}

        {status === 'finished' && (
          <div className="text-center py-1">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold flex items-center justify-center gap-1">
              <CheckCircle className="w-3 h-3" />
              Concluído
            </span>
          </div>
        )}
      </div>
    </div>
  );
}