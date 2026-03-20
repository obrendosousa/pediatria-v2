'use client';

import { Appointment } from '@/types/medical';
import {
  Clock, Megaphone, MapPin,
  DoorOpen, CheckCircle, Undo2, Loader2,
  DollarSign, Wallet, Ticket, ArrowRight,
  Star, UserCheck,
} from 'lucide-react';
import { formatAppointmentTime } from '@/utils/dateUtils';
import { calculateTimeInService, isLongRunningAppointment } from '@/utils/appointmentSafety';

export interface TicketInfo {
  ticket_number: string;
  is_priority: boolean;
  service_point_name?: string;
}

interface ReceptionCardProps {
  appointment: Appointment;
  status: 'scheduled' | 'called' | 'waiting' | 'in_service' | 'waiting_payment' | 'finished';
  position?: number;
  isUpdating?: boolean;
  isCalling?: boolean;
  ticket?: TicketInfo;
  onCall?: () => void;
  onCheckIn?: () => void;
  onConfirmArrival?: () => void;
  onEnter?: () => void;
  onFinish?: () => void;
  onRevert?: () => void;
  onEdit?: () => void;
  onGenerateTicket?: (isPriority: boolean) => void;
  onCallWithDestination?: () => void;
  onFinishGuiche?: () => void;
  buttonLabel?: string;
  selectable?: boolean;
  isSelected?: boolean;
  columnContext?: 'guiche' | 'doctor' | null;
  isDragOverlay?: boolean;
}

export default function ReceptionCard({
  appointment,
  status,
  position,
  isUpdating = false,
  isCalling = false,
  ticket,
  onCall,
  onCheckIn,
  onConfirmArrival,
  onEnter,
  onFinish,
  onRevert,
  onEdit,
  onGenerateTicket,
  onCallWithDestination,
  onFinishGuiche,
  buttonLabel,
  selectable = false,
  isSelected = false,
  columnContext,
  isDragOverlay = false,
}: ReceptionCardProps) {
  const formatTime = formatAppointmentTime;

  const isRetorno = appointment.appointment_type === 'retorno';
  const total = Number(appointment.total_amount || 0);
  const paid = Number(appointment.amount_paid || 0);
  const remaining = total - paid;
  const canEnter = status !== 'waiting' || isRetorno || total <= 0 || remaining <= 0;

  const getCardStyles = () => {
    const base3d = 'dark:shadow-[0_4px_12px_-2px_rgba(0,0,0,0.7),0_1px_0_0_rgba(255,255,255,0.04)_inset] dark:border-t dark:border-t-white/[0.06]';
    switch (status) {
      case 'scheduled':
        return `${base3d} border-blue-200 dark:border-blue-500/15 bg-blue-50/50 dark:bg-[#141419]`;
      case 'called':
        return `${base3d} border-amber-200 dark:border-amber-500/15 bg-amber-50/50 dark:bg-[#141419]`;
      case 'waiting':
        return `${base3d} border-green-200 dark:border-green-500/15 bg-green-50/50 dark:bg-[#141419]`;
      case 'in_service': {
        const lr = isLongRunningAppointment(appointment.start_time, 2);
        const tis = calculateTimeInService(appointment.start_time);
        const hm = tis.match(/(\d+)h/);
        const h = hm ? parseInt(hm[1]) : 0;
        const vl = tis.includes('dia') || h > 2;
        if (vl) return `${base3d} border-red-200 dark:border-red-500/15 bg-red-50/50 dark:bg-[#141419]`;
        if (lr) return `${base3d} border-amber-200 dark:border-amber-500/15 bg-amber-50/50 dark:bg-[#141419]`;
        return `${base3d} border-emerald-200 dark:border-emerald-500/15 bg-emerald-50/50 dark:bg-[#141419]`;
      }
      case 'waiting_payment':
        return `${base3d} border-purple-200 dark:border-purple-500/15 bg-purple-50/50 dark:bg-[#141419]`;
      case 'finished':
        return `${base3d} border-slate-200 dark:border-slate-600/10 bg-slate-50/50 dark:bg-[#111115] opacity-75`;
      default:
        return `${base3d} border-slate-200 dark:border-slate-600/10 bg-white dark:bg-[#141419]`;
    }
  };

  const getFinancialBadge = () => {
    if (!appointment.total_amount || appointment.total_amount <= 0) return null;
    if (remaining <= 0) {
      return (
        <div className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
          <CheckCircle className="w-3 h-3" /> Pago
        </div>
      );
    } else if (paid > 0) {
      return (
        <div className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800" title={`Total: R$ ${total} | Pago: R$ ${paid}`}>
          <Wallet className="w-3 h-3" /> Falta R$ {remaining.toFixed(2)}
        </div>
      );
    } else {
      return (
        <div className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
          <DollarSign className="w-3 h-3" /> R$ {total.toFixed(2)}
        </div>
      );
    }
  };

  const getTimeInServiceBadge = () => {
    if (status !== 'in_service') return null;
    const tis = calculateTimeInService(appointment.start_time);
    const lr = isLongRunningAppointment(appointment.start_time, 2);
    const hm = tis.match(/(\d+)h/);
    const h = hm ? parseInt(hm[1]) : 0;
    const vl = tis.includes('dia') || h > 2;
    if (vl) return <span className="px-2 py-0.5 text-[10px] font-bold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded">{tis}</span>;
    if (lr) return <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded">{tis}</span>;
    return null;
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (selectable && onFinish) { e.stopPropagation(); onFinish(); return; }
    if (onEdit && !selectable) { e.stopPropagation(); onEdit(); }
  };

  return (
    <div
      role={onEdit || selectable ? 'button' : undefined}
      tabIndex={onEdit || selectable ? 0 : undefined}
      onClick={onEdit || selectable ? handleCardClick : undefined}
      onKeyDown={onEdit || selectable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (selectable) onFinish?.(); else onEdit?.(); } } : undefined}
      className={`p-3 rounded-lg border transition-all ${getCardStyles()} ${
        isDragOverlay ? 'drag-overlay-card' : ''
      } ${isSelected ? 'ring-2 ring-purple-500 dark:ring-purple-400 shadow-md' : ''
      } ${onEdit || selectable ? 'cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-1 ' + (selectable ? 'hover:ring-2 hover:ring-purple-300 dark:hover:ring-purple-600/50 focus:ring-purple-400' : 'hover:ring-2 hover:ring-rose-300 dark:hover:ring-rose-600/50 focus:ring-rose-400 dark:focus:ring-rose-500') : ''}`}
    >
      {/* Header: nome + badges */}
      <div className="flex items-start justify-between mb-1.5">
        <div className="flex-1 min-w-0 mr-2">
          <h3 className="font-semibold text-slate-800 dark:text-[#fafafa] text-sm truncate">
            {appointment.patient_name || 'Sem nome'}
          </h3>
          {appointment.patient_phone && (
            <p className="text-[10px] text-slate-500 dark:text-[#a1a1aa] truncate mt-0.5">
              {appointment.patient_phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          {ticket && (
            <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded flex items-center gap-1 ${
              ticket.is_priority
                ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
                : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
            }`}>
              <Ticket className="w-3 h-3" />
              {ticket.ticket_number}
              {ticket.is_priority && <Star className="w-2.5 h-2.5 fill-current" />}
            </span>
          )}
          {position !== undefined && !ticket && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
              position === 0 ? 'bg-rose-500 text-white' : 'bg-slate-200 dark:bg-gray-600 text-slate-600 dark:text-[#d4d4d8]'
            }`}>
              {position + 1}o
            </span>
          )}
          {getFinancialBadge()}
        </div>
        {status === 'called' && (
          <span className="ml-1 text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded">
            Aguardando
          </span>
        )}
        {getTimeInServiceBadge()}
      </div>

      {/* Destino quando chamado */}
      {ticket?.service_point_name && (status === 'called' || status === 'in_service') && (
        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-900/20 px-2 py-1 rounded mb-1.5">
          <ArrowRight className="w-3 h-3" /> {ticket.service_point_name}
        </div>
      )}

      {/* Info: hora + médico + tipo */}
      <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-[#a1a1aa] mb-2">
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
        <span>•</span>
        <span className={`font-bold ${isRetorno ? 'text-purple-600 dark:text-purple-400' : 'text-blue-600 dark:text-blue-400'}`}>
          {isRetorno ? 'Retorno' : 'Consulta'}
        </span>
      </div>

      {/* Botões de ação */}
      <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-200/50 dark:border-white/5">
        {status === 'scheduled' && (
          <>
            {onGenerateTicket ? (
              <div className="flex gap-1.5">
                <button type="button" onClick={(e) => { e.stopPropagation(); onGenerateTicket(false); }} disabled={isUpdating}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-2.5 py-1.5 rounded-md text-[10px] font-semibold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50">
                  {isUpdating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Ticket className="w-3 h-3" />} Gerar Senha
                </button>
                <button type="button" onClick={(e) => { e.stopPropagation(); onGenerateTicket(true); }} disabled={isUpdating}
                  className="bg-red-500 hover:bg-red-600 text-white px-2 py-1.5 rounded-md text-[10px] font-semibold transition-all flex items-center justify-center gap-1 disabled:opacity-50" title="Prioridade">
                  <Star className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="flex gap-1.5">
                <button type="button" onClick={(e) => { e.stopPropagation(); onCall?.(); }} disabled={isUpdating || isCalling}
                  className="bg-rose-500 hover:bg-rose-600 text-white px-2.5 py-1.5 rounded-md text-[10px] font-semibold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50">
                  {isCalling ? <Loader2 className="w-3 h-3 animate-spin" /> : <Megaphone className="w-3 h-3" />}
                  {isCalling ? 'Chamando...' : 'Chamar'}
                </button>
                <button type="button" onClick={(e) => { e.stopPropagation(); onCheckIn?.(); }} disabled={isUpdating}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-2.5 py-1.5 rounded-md text-[10px] font-semibold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50">
                  {isUpdating ? <Loader2 className="w-3 h-3 animate-spin" /> : <MapPin className="w-3 h-3" />} Chegou
                </button>
              </div>
            )}
          </>
        )}

        {status === 'called' && (
          <div className="flex gap-1.5">
            <button type="button" onClick={(e) => { e.stopPropagation(); onConfirmArrival?.(); }} disabled={isUpdating}
              className="flex-1 bg-green-500 hover:bg-green-600 text-white px-2.5 py-1.5 rounded-md text-[10px] font-semibold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50">
              {isUpdating ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />} Chegou
            </button>
            <button type="button" onClick={(e) => { e.stopPropagation(); onRevert?.(); }} disabled={isUpdating}
              className="bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-400 px-2 py-1.5 rounded-md text-[10px] font-semibold transition-all flex items-center justify-center disabled:opacity-50 dark:border dark:border-white/5" title="Reverter">
              <Undo2 className="w-3 h-3" />
            </button>
          </div>
        )}

        {status === 'waiting' && (
          <>
            {columnContext === 'guiche' && onCallWithDestination ? (
              <button type="button" onClick={(e) => { e.stopPropagation(); onCallWithDestination(); }} disabled={isUpdating}
                className="w-full bg-cyan-500 hover:bg-cyan-600 text-white px-2.5 py-1.5 rounded-md text-[10px] font-semibold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50">
                {isUpdating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Megaphone className="w-3 h-3" />} Chamar p/ Guiche
              </button>
            ) : columnContext === 'doctor' && onCallWithDestination ? (
              <button type="button" onClick={(e) => { e.stopPropagation(); onCallWithDestination(); }} disabled={isUpdating}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white px-2.5 py-1.5 rounded-md text-[10px] font-semibold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50">
                {isUpdating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Megaphone className="w-3 h-3" />} Chamar p/ Consultorio
              </button>
            ) : (
              <>
                {!canEnter && total > 0 && (
                  <p className="text-[10px] text-amber-700 dark:text-amber-300 font-semibold px-1 py-0.5">
                    Clique no card para registrar o pagamento.
                  </p>
                )}
                <div className="flex gap-1.5">
                  <button type="button" onClick={(e) => { e.stopPropagation(); onEnter?.(); }} disabled={isUpdating || !canEnter}
                    title={!canEnter && total > 0 ? 'Registre o pagamento para liberar a entrada' : undefined}
                    className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white px-2.5 py-1.5 rounded-md text-[10px] font-semibold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed">
                    {isUpdating ? <Loader2 className="w-3 h-3 animate-spin" /> : <DoorOpen className="w-3 h-3" />} Entrar
                  </button>
                  <button type="button" onClick={(e) => { e.stopPropagation(); onRevert?.(); }} disabled={isUpdating}
                    className="bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-400 px-2 py-1.5 rounded-md text-[10px] font-semibold transition-all flex items-center justify-center disabled:opacity-50 dark:border dark:border-white/5" title="Reverter">
                    <Undo2 className="w-3 h-3" />
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {status === 'in_service' && (
          <div className="flex gap-1.5">
            {columnContext === 'guiche' && onFinishGuiche ? (
              <button type="button" onClick={(e) => { e.stopPropagation(); onFinishGuiche(); }} disabled={isUpdating}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-2.5 py-1.5 rounded-md text-[10px] font-semibold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50">
                {isUpdating ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserCheck className="w-3 h-3" />} Enviar p/ Fila Medica
              </button>
            ) : (
              <button type="button" onClick={(e) => { e.stopPropagation(); onFinish?.(); }} disabled={isUpdating}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white px-2.5 py-1.5 rounded-md text-[10px] font-semibold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50">
                {isUpdating ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />} Finalizar
              </button>
            )}
            <button type="button" onClick={(e) => { e.stopPropagation(); onRevert?.(); }} disabled={isUpdating}
              className="bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-400 px-2 py-1.5 rounded-md text-[10px] font-semibold transition-all flex items-center justify-center disabled:opacity-50 dark:border dark:border-white/5" title="Reverter">
              <Undo2 className="w-3 h-3" />
            </button>
          </div>
        )}

        {status === 'waiting_payment' && (
          <div className="flex gap-1.5">
            <button type="button" onClick={(e) => { e.stopPropagation(); onFinish?.(); }} disabled={isUpdating}
              className="flex-1 bg-purple-600 hover:bg-purple-700 text-white px-2.5 py-1.5 rounded-md text-[10px] font-semibold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 shadow-sm">
              {isUpdating ? <Loader2 className="w-3 h-3 animate-spin" /> : <DollarSign className="w-3 h-3" />} {buttonLabel || 'Checkout'}
            </button>
            <button type="button" onClick={(e) => { e.stopPropagation(); onRevert?.(); }} disabled={isUpdating}
              className="bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-400 px-2 py-1.5 rounded-md text-[10px] font-semibold transition-all flex items-center justify-center disabled:opacity-50 dark:border dark:border-white/5" title="Voltar p/ Atend.">
              <Undo2 className="w-3 h-3" />
            </button>
          </div>
        )}

        {status === 'finished' && (
          <div className="text-center py-0.5">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold flex items-center justify-center gap-1">
              <CheckCircle className="w-3 h-3" /> Concluido
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
