'use client';

import { useState } from 'react';
import {
  Calendar,
  Brain,
  Database,
  CheckCircle2,
  AlertTriangle,
  Shield,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Loader2,
  FileSearch,
} from 'lucide-react';
import type { ElementType } from 'react';

export interface ProgressEvent {
  type: 'temporal' | 'classify' | 'memory' | 'query_start' | 'query_result' | 'validation' | 'spot_check' | 'research_step' | 'retry' | 'error';
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
  status: 'active' | 'done' | 'error';
}

interface Props {
  events: ProgressEvent[];
  isActive: boolean;
}

const ICON_MAP: Record<ProgressEvent['type'], ElementType> = {
  temporal: Calendar,
  classify: Brain,
  memory: Brain,
  query_start: Database,
  query_result: CheckCircle2,
  validation: Shield,
  spot_check: Shield,
  research_step: FileSearch,
  retry: AlertTriangle,
  error: AlertTriangle,
};

const COLOR_MAP: Record<ProgressEvent['type'], string> = {
  temporal: 'text-blue-500',
  classify: 'text-violet-500',
  memory: 'text-indigo-500',
  query_start: 'text-emerald-500',
  query_result: 'text-green-500',
  validation: 'text-green-600',
  spot_check: 'text-amber-500',
  research_step: 'text-pink-500',
  retry: 'text-amber-500',
  error: 'text-red-500',
};

export default function ClaraProgressPanel({ events, isActive }: Props) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (events.length === 0) return null;

  const lastActive = events.filter(e => e.status === 'active').pop();
  const doneCount = events.filter(e => e.status === 'done').length;

  return (
    <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-100 dark:border-violet-800 rounded-xl overflow-hidden max-w-[88%]">
      {/* Header — sempre visível */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-violet-100/50 dark:hover:bg-violet-800/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isActive ? (
            <Loader2 size={12} className="animate-spin text-violet-500" />
          ) : (
            <CheckCircle2 size={12} className="text-green-500" />
          )}
          <span className="text-[11px] font-medium text-violet-600 dark:text-violet-300">
            {isActive
              ? lastActive?.content || 'Clara está trabalhando...'
              : `${doneCount} etapa${doneCount !== 1 ? 's' : ''} concluída${doneCount !== 1 ? 's' : ''}`}
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp size={12} className="text-violet-400" />
        ) : (
          <ChevronDown size={12} className="text-violet-400" />
        )}
      </button>

      {/* Lista de etapas — colapsável */}
      {isExpanded && (
        <div className="px-3 pb-2 space-y-1 border-t border-violet-100 dark:border-violet-800 pt-1.5">
          {events.map((event, i) => {
            const Icon = ICON_MAP[event.type] || BarChart3;
            const color = COLOR_MAP[event.type] || 'text-gray-500';

            return (
              <div key={i} className="flex items-center gap-2">
                {event.status === 'active' ? (
                  <Loader2 size={10} className={`animate-spin ${color} shrink-0`} />
                ) : event.status === 'error' ? (
                  <AlertTriangle size={10} className="text-red-500 shrink-0" />
                ) : (
                  <Icon size={10} className={`${color} shrink-0`} />
                )}
                <span
                  className={`text-[10.5px] leading-tight ${
                    event.status === 'active'
                      ? 'text-violet-600 dark:text-violet-300 font-medium'
                      : event.status === 'error'
                        ? 'text-red-500'
                        : 'text-violet-400 dark:text-violet-500'
                  }`}
                >
                  {event.content}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
