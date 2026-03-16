'use client';

import React, { useState } from 'react';
import {
  Square, LayoutDashboard, FileText, Activity, User, ClipboardList,
  Heart, Pill, UtensilsCrossed, History, RotateCcw, AlertCircle,
  Microscope, FileCheck, FileImage, Image, ShieldAlert, TrendingUp,
  Award, ScrollText, Camera, ChevronDown, ChevronRight, NotebookPen
} from 'lucide-react';
import { AttendanceTabKey } from '@/types/attendance';

interface AttendanceSidebarProps {
  activeTab: AttendanceTabKey;
  onTabChange: (tab: AttendanceTabKey) => void;
  isConsultationActive: boolean;
  consultationDuration: number;
  onFinishConsultation: () => void;
}

// Tipos para a estrutura hierárquica do menu
type SidebarEntry =
  | { type: 'section'; label: string }
  | { type: 'item'; key: AttendanceTabKey; label: string; icon: React.ElementType }
  | { type: 'submenu'; label: string; icon: React.ElementType; children: { key: AttendanceTabKey; label: string; icon: React.ElementType }[] };

const SIDEBAR_STRUCTURE: SidebarEntry[] = [
  // ─── Consulta ───
  { type: 'section', label: 'Consulta' },
  { type: 'item', key: 'overview', label: 'Visão Geral', icon: LayoutDashboard },
  { type: 'item', key: 'routine', label: 'Consulta de Rotina', icon: FileText },
  { type: 'item', key: 'first-consultation', label: 'Anamnese', icon: History },
  { type: 'item', key: 'adolescent', label: 'Consulta Adolescente', icon: User },
  { type: 'item', key: 'follow-up', label: 'Retorno', icon: RotateCcw },
  { type: 'item', key: 'emergency', label: 'Emergência', icon: AlertCircle },

  // ─── Prontuário ───
  { type: 'section', label: 'Prontuário' },
  { type: 'item', key: 'vitals', label: 'Estatura / Peso / IMC', icon: Activity },
  { type: 'item', key: 'anamneses-list', label: 'Anamneses', icon: NotebookPen },
  { type: 'item', key: 'allergies', label: 'Alergias', icon: ShieldAlert },
  { type: 'item', key: 'evolutions', label: 'Evoluções', icon: TrendingUp },
  { type: 'item', key: 'diagnostic-hypothesis', label: 'Hipótese Diagnóstica', icon: Heart },
  { type: 'item', key: 'conducts', label: 'Condutas', icon: Pill },
  { type: 'item', key: 'food-history', label: 'Histórico Alimentar', icon: UtensilsCrossed },

  // ─── Documentos ───
  { type: 'section', label: 'Documentos' },
  { type: 'item', key: 'prescriptions', label: 'Receitas', icon: FileCheck },
  { type: 'item', key: 'certificates', label: 'Atestados', icon: Award },
  { type: 'item', key: 'reports', label: 'Laudos', icon: ScrollText },

  // ─── Exames (submenu expansível) ───
  { type: 'submenu', label: 'Exames', icon: Microscope, children: [
    { key: 'exams-procedures', label: 'Pedidos', icon: ClipboardList },
    { key: 'exam-results', label: 'Resultados', icon: FileCheck },
  ]},

  // ─── Arquivos ───
  { type: 'section', label: 'Arquivos' },
  { type: 'item', key: 'documents', label: 'Documentos / Termos', icon: FileImage },
  { type: 'item', key: 'gallery', label: 'Galeria de Imagens', icon: Camera },
  { type: 'item', key: 'images', label: 'Anexos', icon: Image },
];

const formatTime = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export function AttendanceSidebar({
  activeTab, onTabChange, isConsultationActive, consultationDuration, onFinishConsultation
}: AttendanceSidebarProps) {
  const [expandedSubmenus, setExpandedSubmenus] = useState<Set<string>>(new Set());

  const toggleSubmenu = (label: string) => {
    setExpandedSubmenus(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const isChildActive = (children: { key: AttendanceTabKey }[]) =>
    children.some(c => c.key === activeTab);

  return (
    <div className="w-64 shrink-0 bg-white dark:bg-[#0d0f15] border-r border-slate-200 dark:border-[#1e2334] flex flex-col h-full">

      {/* Timer de consulta no topo */}
      {isConsultationActive && (
        <div className="p-4 border-b border-slate-200 dark:border-[#1e2334]">
          <div className="flex flex-col items-center py-2">
            <span className="text-[10px] font-bold text-slate-400 dark:text-[#565d73] uppercase tracking-wider mb-1">
              Duração
            </span>
            <div className="text-xl font-black font-mono text-slate-700 dark:text-gray-200">
              {formatTime(consultationDuration)}
            </div>
          </div>
        </div>
      )}

      {/* Lista de itens do menu com seções */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="p-2 space-y-0.5">
          {SIDEBAR_STRUCTURE.map((entry, idx) => {
            // Cabeçalho de seção
            if (entry.type === 'section') {
              return (
                <div key={`section-${idx}`} className="pt-4 pb-1 px-3 first:pt-2">
                  <span className="text-[10px] font-extrabold text-slate-400 dark:text-[#565d73] uppercase tracking-wider">
                    {entry.label}
                  </span>
                </div>
              );
            }

            // Submenu expansível (Exames)
            if (entry.type === 'submenu') {
              const isOpen = expandedSubmenus.has(entry.label) || isChildActive(entry.children);
              const Icon = entry.icon;
              const Chevron = isOpen ? ChevronDown : ChevronRight;
              return (
                <div key={`submenu-${idx}`}>
                  <button
                    onClick={() => toggleSubmenu(entry.label)}
                    className={`
                      w-full text-left px-3 py-2.5 rounded-lg transition-all duration-200
                      flex items-center gap-3
                      ${isChildActive(entry.children)
                        ? 'text-blue-600 dark:text-blue-400 font-medium'
                        : 'text-slate-600 dark:text-[#828ca5] hover:bg-slate-50 dark:hover:bg-[#2a2d36] hover:text-slate-800 dark:hover:text-gray-200'
                      }
                    `}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="text-sm flex-1">{entry.label}</span>
                    <Chevron className="w-3.5 h-3.5 shrink-0" />
                  </button>
                  {isOpen && (
                    <div className="ml-4 pl-3 border-l border-slate-100 dark:border-[#252a3a] space-y-0.5 mt-0.5">
                      {entry.children.map(child => {
                        const isActive = activeTab === child.key;
                        const ChildIcon = child.icon;
                        return (
                          <button
                            key={child.key}
                            onClick={() => onTabChange(child.key)}
                            className={`
                              w-full text-left px-3 py-2 rounded-lg transition-all duration-200
                              flex items-center gap-3
                              ${isActive
                                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium'
                                : 'text-slate-600 dark:text-[#828ca5] hover:bg-slate-50 dark:hover:bg-[#2a2d36] hover:text-slate-800 dark:hover:text-gray-200'
                              }
                            `}
                          >
                            <ChildIcon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-blue-600 dark:text-blue-400' : ''}`} />
                            <span className="text-xs truncate">{child.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            // Item normal
            const isActive = activeTab === entry.key;
            const Icon = entry.icon;
            return (
              <button
                key={entry.key}
                onClick={() => onTabChange(entry.key)}
                className={`
                  w-full text-left px-3 py-2.5 rounded-lg transition-all duration-200
                  flex items-center gap-3
                  ${isActive
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium'
                    : 'text-slate-600 dark:text-[#828ca5] hover:bg-slate-50 dark:hover:bg-[#2a2d36] hover:text-slate-800 dark:hover:text-gray-200'
                  }
                `}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-600 dark:text-blue-400' : ''}`} />
                <span className="text-sm truncate">{entry.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Botão Finalizar atendimento no final */}
      {isConsultationActive && (
        <div className="p-4 border-t border-slate-200 dark:border-[#1e2334]">
          <button
            onClick={onFinishConsultation}
            className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <Square className="w-4 h-4 fill-current" />
            Finalizar atendimento
          </button>
        </div>
      )}
    </div>
  );
}
