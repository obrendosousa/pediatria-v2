'use client';

import { AutomationRule } from '@/types';
import { Calendar, Clock, Users, CheckCircle2, XCircle, Edit2, Trash2, Zap } from 'lucide-react';
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

  const getTypeColor = () => {
    switch (automation.type) {
      case 'milestone':
        return 'bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-900/30';
      case 'appointment_reminder':
        return 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-900/30';
      case 'return_reminder':
        return 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/30';
    }
  };

  return (
    <div className="bg-white dark:bg-[#1e2028] border border-slate-200 dark:border-gray-700 rounded-2xl p-6 hover:shadow-lg transition-all">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Zap className={`w-5 h-5 ${automation.active ? 'text-rose-500' : 'text-slate-400'}`} />
            <h3 className="text-lg font-bold text-slate-800 dark:text-gray-100">
              {automation.name}
            </h3>
            <span className={`px-2 py-0.5 rounded text-xs font-bold border ${getTypeColor()}`}>
              {getTypeLabel()}
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-gray-400">
            {automation.message_sequence.length} {automation.message_sequence.length === 1 ? 'mensagem' : 'mensagens'} na sequência
          </p>
        </div>
        
        {/* Status Toggle */}
        <button
          onClick={onToggle}
          className={`p-2 rounded-lg transition-colors ${
            automation.active
              ? 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
              : 'bg-slate-100 dark:bg-[#2a2d36] text-slate-400 dark:text-gray-500'
          }`}
          title={automation.active ? 'Desativar' : 'Ativar'}
        >
          {automation.active ? (
            <CheckCircle2 className="w-5 h-5" />
          ) : (
            <XCircle className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* Informações */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-gray-400">
          <Clock className="w-4 h-4" />
          <span>Dispara às {automation.trigger_time}</span>
        </div>
        
        {automation.type === 'milestone' && (
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-gray-400">
            <Calendar className="w-4 h-4" />
            <span>Quando paciente completa {automation.age_months} {automation.age_months === 1 ? 'mês' : 'meses'}</span>
          </div>
        )}
      </div>

      {/* Estatísticas */}
      {stats && (
        <div className="grid grid-cols-3 gap-3 mb-4 p-3 bg-slate-50 dark:bg-[#2a2d36] rounded-lg">
          <div>
            <div className="text-xs text-slate-500 dark:text-gray-500 mb-1">Total Enviado</div>
            <div className="text-lg font-bold text-slate-800 dark:text-gray-100">
              {stats.totalSent || 0}
            </div>
          </div>
          {stats.patientsReached !== undefined && (
            <div>
              <div className="text-xs text-slate-500 dark:text-gray-500 mb-1">Pacientes</div>
              <div className="text-lg font-bold text-slate-800 dark:text-gray-100">
                {stats.patientsReached}
              </div>
            </div>
          )}
          {stats.lastSent && (
            <div>
              <div className="text-xs text-slate-500 dark:text-gray-500 mb-1">Último Envio</div>
              <div className="text-sm font-medium text-slate-700 dark:text-gray-300">
                {format(new Date(stats.lastSent), 'dd/MM/yyyy', { locale: ptBR })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Ações */}
      <div className="flex items-center gap-2 pt-4 border-t border-slate-200 dark:border-gray-700">
        <button
          onClick={onEdit}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 dark:bg-[#2a2d36] hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg text-sm font-medium text-slate-700 dark:text-gray-300 transition-colors"
        >
          <Edit2 className="w-4 h-4" />
          Editar
        </button>
        <button
          onClick={onDelete}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Excluir
        </button>
      </div>
    </div>
  );
}
