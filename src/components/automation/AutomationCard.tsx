'use client';

import { AutomationRule } from '@/types';
import { Calendar, Clock, Edit2, Trash2, Zap } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AutomationCardProps {
  automation: AutomationRule;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  stats?: {
    totalSent: number;
    lastSent?: string;
    patientsReached?: number;
  };
}

export default function AutomationCard({
  automation,
  onEdit,
  onDelete,
  onToggle,
  stats
}: AutomationCardProps) {
  const getTypeLabel = () => {
    switch (automation.type) {
      case 'milestone':
        return `Marco de ${automation.age_months} ${automation.age_months === 1 ? 'mês' : 'meses'}`;
      case 'appointment_reminder':
        return 'Lembrete de Consulta';
      case 'return_reminder':
        return 'Lembrete de Retorno';
    }
  };

  const getGradient = () => {
    switch (automation.type) {
      case 'milestone':
        return 'from-fuchsia-100 to-purple-100 dark:from-purple-900/40 dark:to-fuchsia-900/20';
      case 'appointment_reminder':
        return 'from-blue-100 to-sky-100 dark:from-blue-900/40 dark:to-sky-900/20';
      case 'return_reminder':
        return 'from-emerald-100 to-teal-100 dark:from-emerald-900/40 dark:to-teal-900/20';
    }
  };

  const getIconColor = () => {
    switch (automation.type) {
      case 'milestone': return 'text-purple-600 dark:text-purple-400';
      case 'appointment_reminder': return 'text-blue-600 dark:text-blue-400';
      case 'return_reminder': return 'text-emerald-600 dark:text-emerald-400';
    }
  };

  return (
    <div className={`group relative bg-white dark:bg-[#1e2028] border border-slate-200/60 dark:border-gray-700/60 rounded-3xl p-6 hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-black/50 hover:-translate-y-1 transition-all duration-300 overflow-hidden`}>
      {/* Decorative Gradient Background */}
      <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${getGradient()} opacity-50 blur-3xl -z-10 rounded-full translate-x-10 -translate-y-10 group-hover:scale-110 transition-transform duration-500`} />

      <div className="flex items-start justify-between mb-6 z-10 relative">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center bg-white dark:bg-[#252833] shadow-sm border border-slate-100 dark:border-gray-800 ${getIconColor()}`}>
              <Zap className="w-5 h-5 fill-current opacity-80" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-gray-100 line-clamp-1">
                {automation.name}
              </h3>
              <span className={`text-[11px] uppercase tracking-wider font-bold ${getIconColor()} opacity-80`}>
                {getTypeLabel()}
              </span>
            </div>
          </div>
          <p className="text-sm text-slate-500 dark:text-gray-400 font-medium">
            {automation.message_sequence.length} {automation.message_sequence.length === 1 ? 'mensagem' : 'mensagens'} na sequência
          </p>
        </div>

        {/* Toggle Switch */}
        <button
          onClick={onToggle}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 ${automation.active ? 'bg-rose-500' : 'bg-slate-300 dark:bg-slate-600'
            }`}
          role="switch"
          aria-checked={automation.active}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${automation.active ? 'translate-x-6' : 'translate-x-1'
              }`}
          />
        </button>
      </div>

      <div className="flex flex-col gap-2 mb-6">
        <div className="flex items-center gap-2.5 px-3 py-2.5 bg-slate-50 dark:bg-[#252833] rounded-xl border border-slate-100 dark:border-gray-800/50">
          <Clock className="w-4 h-4 text-slate-400 dark:text-gray-500" />
          <span className="text-sm font-semibold text-slate-600 dark:text-gray-300">
            Dispara às {automation.trigger_time?.substring(0, 5)}
          </span>
        </div>

        {automation.type === 'milestone' && (
          <div className="flex items-center gap-2.5 px-3 py-2.5 bg-slate-50 dark:bg-[#252833] rounded-xl border border-slate-100 dark:border-gray-800/50">
            <Calendar className="w-4 h-4 text-slate-400 dark:text-gray-500" />
            <span className="text-sm font-semibold text-slate-600 dark:text-gray-300">
              Aos {automation.age_months} {automation.age_months === 1 ? 'mês' : 'meses'} de vida
            </span>
          </div>
        )}
      </div>

      {stats && (
        <div className="grid grid-cols-2 gap-3 mb-6 p-4 bg-slate-50 dark:bg-[#252833] rounded-2xl border border-slate-100 dark:border-gray-800/50">
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-gray-500 mb-1 tracking-wider">Total Enviado</div>
            <div className="text-xl font-black text-slate-800 dark:text-gray-100">
              {stats.totalSent || 0}
            </div>
          </div>
          {stats.patientsReached !== undefined && (
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-gray-500 mb-1 tracking-wider">Alcançados</div>
              <div className="text-xl font-black text-slate-800 dark:text-gray-100">
                {stats.patientsReached}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={onEdit}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-[#1e2028] border border-slate-200 dark:border-gray-700 hover:border-slate-300 dark:hover:border-gray-600 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl text-sm font-bold text-slate-700 dark:text-gray-300 transition-colors"
        >
          <Edit2 className="w-4 h-4" />
          Editar
        </button>
        <button
          onClick={onDelete}
          className="flex items-center justify-center p-2.5 bg-white dark:bg-[#1e2028] border border-slate-200 dark:border-gray-700 hover:bg-red-50 hover:border-red-200 hover:text-red-500 dark:hover:bg-red-900/20 dark:hover:border-red-800/30 dark:hover:text-red-400 rounded-xl text-slate-400 transition-colors"
          title="Excluir"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
