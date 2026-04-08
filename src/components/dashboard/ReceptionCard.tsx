'use client';

import { Appointment } from '@/types/medical';
import {
  Clock, Megaphone, MapPin, Tv,
  DoorOpen, CheckCircle, Undo2, Loader2,
  DollarSign, Wallet, Ticket, ArrowRight,
  Star, UserCheck, User,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { formatAppointmentTime } from '@/utils/dateUtils';
import { calculateTimeInService, isLongRunningAppointment } from '@/utils/appointmentSafety';
import { effectiveAmount } from '@/utils/discountUtils';

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
  onCallOnTV?: () => void;
  buttonLabel?: string;
  selectable?: boolean;
  isSelected?: boolean;
  columnContext?: 'guiche' | 'doctor' | null;
  isDragOverlay?: boolean;
  sourceModule?: 'pediatria' | 'atendimento';
}

/** Gera as iniciais do paciente para o avatar */
function getInitials(name: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/** Cores do avatar baseadas no hash do nome */
const AVATAR_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-rose-500',
  'bg-amber-500', 'bg-cyan-500', 'bg-pink-500', 'bg-teal-500',
  'bg-indigo-500', 'bg-orange-500',
];

function getAvatarColor(name: string | null): string {
  if (!name) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ----- Botão de ação reutilizável (declarado fora do render) -----
const ACTION_VARIANTS: Record<string, string> = {
  primary: 'bg-blue-500 hover:bg-blue-600 text-white shadow-sm shadow-blue-500/20',
  secondary: 'bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-white/5',
  danger: 'bg-red-500 hover:bg-red-600 text-white shadow-sm shadow-red-500/20',
  ghost: 'bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400',
  cyan: 'bg-cyan-500 hover:bg-cyan-600 text-white shadow-sm shadow-cyan-500/20',
  emerald: 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm shadow-emerald-500/20',
  amber: 'bg-amber-100 dark:bg-amber-900/30 hover:bg-amber-200 dark:hover:bg-amber-800/40 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/40',
  purple: 'bg-purple-600 hover:bg-purple-700 text-white shadow-sm shadow-purple-500/20',
};

function ActionButton({ onClick, disabled, loading: isLoading, icon: Icon, label, variant = 'primary', className = '' }: {
  onClick: (e: React.MouseEvent) => void;
  disabled?: boolean;
  loading?: boolean;
  icon: React.ElementType;
  label: string;
  variant?: string;
  className?: string;
}) {
  return (
    <motion.button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(e); }}
      disabled={disabled}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors duration-150 flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed ${ACTION_VARIANTS[variant] || ACTION_VARIANTS.primary} ${className}`}
    >
      {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Icon className="w-3 h-3" />}
      {label}
    </motion.button>
  );
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
  onCallOnTV,
  buttonLabel,
  selectable = false,
  isSelected = false,
  columnContext,
  isDragOverlay = false,
  sourceModule,
}: ReceptionCardProps) {
  const formatTime = formatAppointmentTime;

  const isRetorno = appointment.appointment_type === 'retorno';
  const total = Number(appointment.total_amount || 0);
  const paid = Number(appointment.amount_paid || 0);
  const discountAmt = Number(appointment.discount_amount || 0);
  const effectiveTotal = effectiveAmount(total, discountAmt);
  const remaining = Math.max(0, effectiveTotal - paid);
  const canEnter = status !== 'waiting' || isRetorno || effectiveTotal <= 0 || remaining <= 0;

  const getCardStyles = () => {
    const base = 'border bg-white dark:bg-[#16161d] shadow-sm hover:shadow-md dark:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.5)]';
    switch (status) {
      case 'scheduled':
        return `${base} border-slate-200/80 dark:border-slate-700/40 hover:border-blue-300 dark:hover:border-blue-500/30`;
      case 'called':
        return `${base} border-amber-200/80 dark:border-amber-700/30 hover:border-amber-300 dark:hover:border-amber-500/30 ring-1 ring-amber-100 dark:ring-amber-900/20`;
      case 'waiting':
        return `${base} border-slate-200/80 dark:border-slate-700/40 hover:border-green-300 dark:hover:border-green-500/30`;
      case 'in_service': {
        const lr = isLongRunningAppointment(appointment.start_time, 2);
        const tis = calculateTimeInService(appointment.start_time);
        const hm = tis.match(/(\d+)h/);
        const h = hm ? parseInt(hm[1]) : 0;
        const vl = tis.includes('dia') || h > 2;
        if (vl) return `${base} border-red-300/80 dark:border-red-700/30 ring-1 ring-red-100 dark:ring-red-900/20`;
        if (lr) return `${base} border-amber-300/80 dark:border-amber-700/30 ring-1 ring-amber-100 dark:ring-amber-900/20`;
        return `${base} border-emerald-200/80 dark:border-emerald-700/30 hover:border-emerald-300 dark:hover:border-emerald-500/30`;
      }
      case 'waiting_payment':
        return `${base} border-purple-200/80 dark:border-purple-700/30 hover:border-purple-300 dark:hover:border-purple-500/30`;
      case 'finished':
        return `${base} border-slate-200/60 dark:border-slate-700/20 opacity-70 hover:opacity-100`;
      default:
        return `${base} border-slate-200/80 dark:border-slate-700/40`;
    }
  };

  const getFinancialBadge = () => {
    if (isRetorno) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 border border-violet-200/60 dark:border-violet-800/40">
          Retorno
        </span>
      );
    }
    if (!appointment.total_amount || appointment.total_amount <= 0) return null;
    if (remaining <= 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40">
          <CheckCircle className="w-2.5 h-2.5" /> Pago
        </span>
      );
    } else if (paid > 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/40" title={`Total: R$ ${total} | Pago: R$ ${paid}`}>
          <Wallet className="w-2.5 h-2.5" /> Falta R$ {remaining.toFixed(2)}
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/40">
          <DollarSign className="w-2.5 h-2.5" /> R$ {total.toFixed(2)}
        </span>
      );
    }
  };

  const getQueueTimeBadge = () => {
    if (status !== 'waiting') return null;
    const refTime = appointment.queue_entered_at || null;
    if (!refTime) return null;
    const tis = calculateTimeInService(refTime);
    const lr = isLongRunningAppointment(refTime, 1);
    const hm = tis.match(/(\d+)h/);
    const h = hm ? parseInt(hm[1]) : 0;
    const vl = tis.includes('dia') || h > 2;
    const label = tis;
    if (vl) return <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full border border-red-200/60 dark:border-red-800/40"><Clock className="w-2.5 h-2.5" />{label}</span>;
    if (lr) return <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-full border border-amber-200/60 dark:border-amber-800/40"><Clock className="w-2.5 h-2.5" />{label}</span>;
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-full border border-orange-200/60 dark:border-orange-800/40"><Clock className="w-2.5 h-2.5" />{label}</span>;
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
      className={`group relative rounded-xl p-3.5 transition-all duration-200 ${getCardStyles()} ${
        isDragOverlay ? 'drag-overlay-card shadow-2xl scale-[1.02] rotate-[1deg]' : ''
      } ${isSelected ? 'ring-2 ring-purple-500 dark:ring-purple-400 shadow-lg shadow-purple-500/10' : ''
      } ${onEdit || selectable ? 'cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-1 ' + (selectable ? 'focus:ring-purple-400' : 'focus:ring-blue-400 dark:focus:ring-blue-500') : ''}`}
    >
      {/* Glow animado para status especiais */}
      {status === 'in_service' && (
        <motion.div
          className="absolute inset-0 rounded-xl border-2 border-emerald-400/40 dark:border-emerald-500/30 pointer-events-none"
          animate={{ opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
      {status === 'called' && (
        <motion.div
          className="absolute inset-0 rounded-xl border-2 border-amber-400/40 dark:border-amber-500/30 pointer-events-none"
          animate={{ scale: [1, 1.01, 1], opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      {/* Top row: Avatar + Info + Badges */}
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <motion.div
          whileHover={{ scale: 1.1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          className={`w-9 h-9 rounded-lg ${getAvatarColor(appointment.patient_name)} flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm`}
        >
          {getInitials(appointment.patient_name)}
        </motion.div>

        {/* Name + Phone */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-[13px] truncate leading-tight">
              {appointment.patient_name || 'Sem nome'}
            </h3>
            {sourceModule === 'pediatria' && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 border border-pink-200/60 dark:border-pink-800/40 shrink-0 uppercase tracking-wider">
                Pedi
              </span>
            )}
          </div>
          {appointment.patient_phone && (
            <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
              {appointment.patient_phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')}
            </p>
          )}
        </div>

        {/* Right side: ticket or position */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          {ticket && (
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md flex items-center gap-1 ${
              ticket.is_priority
                ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200/60 dark:border-red-800/40'
                : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/40'
            }`}>
              <Ticket className="w-2.5 h-2.5" />
              {ticket.ticket_number}
              {ticket.is_priority && <Star className="w-2 h-2 fill-current" />}
            </span>
          )}
          {position !== undefined && !ticket && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
              position === 0 ? 'bg-rose-500 text-white shadow-sm shadow-rose-500/20' : 'bg-slate-100 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400'
            }`}>
              {position + 1}º
            </span>
          )}
        </div>
      </div>

      {/* Labels row: badges de status financeiro, tipo, tempo na fila */}
      <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
        {getFinancialBadge()}
        {getQueueTimeBadge()}
      </div>

      {/* Destino quando chamado */}
      {ticket?.service_point_name && (status === 'called' || status === 'in_service') && (
        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-900/20 px-2.5 py-1 rounded-lg mt-2 border border-cyan-200/40 dark:border-cyan-800/30">
          <ArrowRight className="w-3 h-3" /> {ticket.service_point_name}
        </div>
      )}

      {/* Info: hora + médico + tipo */}
      <div className="flex items-center gap-2 text-[10px] text-slate-400 dark:text-slate-500 mt-2.5 pt-2.5 border-t border-slate-100 dark:border-white/5">
        <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
          <Clock className="w-3 h-3 opacity-60" />
          {formatTime(appointment.start_time)}
        </span>
        {appointment.doctor_name && (
          <>
            <span className="text-slate-300 dark:text-slate-700">·</span>
            <span className="flex items-center gap-1 truncate">
              <User className="w-3 h-3 opacity-40" />
              {appointment.doctor_name}
            </span>
          </>
        )}
        <span className="text-slate-300 dark:text-slate-700">·</span>
        <span className={`font-semibold ${isRetorno ? 'text-violet-500 dark:text-violet-400' : 'text-blue-500 dark:text-blue-400'}`}>
          {isRetorno ? 'Retorno' : 'Consulta'}
        </span>
      </div>

      {/* Botões de ação */}
      <div className="flex flex-col gap-1.5 mt-3">
        {status === 'scheduled' && (
          <>
            {onGenerateTicket ? (
              <div className="flex gap-1.5">
                <ActionButton onClick={() => onGenerateTicket(false)} disabled={isUpdating} loading={isUpdating} icon={Ticket} label="Gerar Senha" variant="primary" className="flex-1" />
                <ActionButton onClick={() => onGenerateTicket(true)} disabled={isUpdating} loading={isUpdating} icon={Star} label="" variant="danger" className="!px-2" />
              </div>
            ) : (
              <div className="flex gap-1.5">
                <ActionButton onClick={() => onCall?.()} disabled={isUpdating || isCalling} loading={isCalling} icon={Megaphone} label={isCalling ? 'Chamando...' : 'Chamar'} variant="danger" />
                <ActionButton onClick={() => onCheckIn?.()} disabled={isUpdating} loading={isUpdating} icon={MapPin} label="Chegou" variant="primary" className="flex-1" />
              </div>
            )}
          </>
        )}

        {status === 'called' && (
          <div className="flex gap-1.5">
            <ActionButton onClick={() => onConfirmArrival?.()} disabled={isUpdating} loading={isUpdating} icon={CheckCircle} label="Chegou" variant="emerald" className="flex-1" />
            <ActionButton onClick={() => onRevert?.()} disabled={isUpdating} icon={Undo2} label="" variant="ghost" className="!px-2" />
          </div>
        )}

        {status === 'waiting' && (
          <>
            {columnContext === 'guiche' && onCallWithDestination ? (
              <ActionButton onClick={() => onCallWithDestination()} disabled={isUpdating} loading={isUpdating} icon={Megaphone} label="Chamar p/ Guichê" variant="cyan" className="w-full" />
            ) : columnContext === 'doctor' && onCallWithDestination ? (
              <ActionButton onClick={() => onCallWithDestination()} disabled={isUpdating} loading={isUpdating} icon={Megaphone} label="Chamar p/ Consultório" variant="emerald" className="w-full" />
            ) : (
              <>
                {!canEnter && total > 0 && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium px-1 py-0.5 bg-amber-50 dark:bg-amber-900/10 rounded-md">
                    Clique no card para registrar o pagamento.
                  </p>
                )}
                <div className="flex gap-1.5">
                  <ActionButton
                    onClick={() => onEnter?.()}
                    disabled={isUpdating || !canEnter}
                    loading={isUpdating}
                    icon={DoorOpen}
                    label="Entrar"
                    variant="emerald"
                    className="flex-1"
                  />
                  <ActionButton onClick={() => onRevert?.()} disabled={isUpdating} icon={Undo2} label="" variant="ghost" className="!px-2" />
                </div>
              </>
            )}
          </>
        )}

        {status === 'in_service' && (
          <div className="flex gap-1.5">
            {columnContext === 'guiche' && onFinishGuiche ? (
              <ActionButton onClick={() => onFinishGuiche()} disabled={isUpdating} loading={isUpdating} icon={UserCheck} label="Enviar p/ Fila Médica" variant="primary" className="flex-1" />
            ) : (
              <ActionButton onClick={() => onFinish?.()} disabled={isUpdating} loading={isUpdating} icon={CheckCircle} label="Finalizar" variant="emerald" className="flex-1" />
            )}
            {onCallOnTV && (
              <ActionButton onClick={() => onCallOnTV()} disabled={false} icon={Tv} label="" variant="amber" className="!px-2" />
            )}
            <ActionButton onClick={() => onRevert?.()} disabled={isUpdating} icon={Undo2} label="" variant="ghost" className="!px-2" />
          </div>
        )}

        {status === 'waiting_payment' && (
          <div className="flex gap-1.5">
            <ActionButton onClick={() => onFinish?.()} disabled={isUpdating} loading={isUpdating} icon={DollarSign} label={buttonLabel || 'Checkout'} variant="purple" className="flex-1" />
            <ActionButton onClick={() => onRevert?.()} disabled={isUpdating} icon={Undo2} label="" variant="ghost" className="!px-2" />
          </div>
        )}

        {status === 'finished' && (
          <div className="flex items-center gap-1.5">
            <span className="flex-1 text-[10px] text-slate-400 dark:text-slate-500 font-medium flex items-center justify-center gap-1">
              <CheckCircle className="w-3 h-3" /> Concluído
            </span>
            {onRevert && (
              <ActionButton onClick={() => onRevert()} disabled={isUpdating} loading={isUpdating} icon={Undo2} label="Reverter" variant="amber" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
