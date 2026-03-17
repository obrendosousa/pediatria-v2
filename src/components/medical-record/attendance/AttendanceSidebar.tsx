'use client';

import React, { useState } from 'react';
import { Square, ChevronDown, ChevronRight } from 'lucide-react';
import { AttendanceTabKey, SidebarEntry } from '@/types/attendance';

interface AttendanceSidebarProps {
  activeTab: AttendanceTabKey;
  onTabChange: (tab: AttendanceTabKey) => void;
  isConsultationActive: boolean;
  consultationDuration: number;
  onFinishConsultation: () => void;
  sidebarItems: SidebarEntry[];
}

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
  activeTab, onTabChange, isConsultationActive, consultationDuration, onFinishConsultation,
  sidebarItems,
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
    <div className="w-64 shrink-0 bg-white dark:bg-[#08080b] border-r border-slate-200 dark:border-[#2d2d36] flex flex-col h-full">

      {/* Timer de consulta no topo */}
      {isConsultationActive && (
        <div className="p-4 border-b border-slate-200 dark:border-[#2d2d36]">
          <div className="flex flex-col items-center py-2">
            <span className="text-[10px] font-bold text-slate-400 dark:text-[#71717a] uppercase tracking-wider mb-1">
              Duração
            </span>
            <div className="text-xl font-black font-mono text-slate-700 dark:text-gray-200">
              {formatTime(consultationDuration)}
            </div>
          </div>
        </div>
      )}

      {/* Lista de itens do menu — driven pela config do módulo */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="p-2 space-y-0.5">
          {sidebarItems.map((entry, idx) => {
            // Cabeçalho de seção
            if (entry.type === 'section') {
              return (
                <div key={`section-${idx}`} className="pt-4 pb-1 px-3 first:pt-2">
                  <span className="text-[10px] font-extrabold text-slate-400 dark:text-[#71717a] uppercase tracking-wider">
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
                        : 'text-slate-600 dark:text-[#a1a1aa] hover:bg-slate-50 dark:hover:bg-[#2a2d36] hover:text-slate-800 dark:hover:text-gray-200'
                      }
                    `}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="text-sm flex-1">{entry.label}</span>
                    <Chevron className="w-3.5 h-3.5 shrink-0" />
                  </button>
                  {isOpen && (
                    <div className="ml-4 pl-3 border-l border-slate-100 dark:border-[#3d3d48] space-y-0.5 mt-0.5">
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
                                : 'text-slate-600 dark:text-[#a1a1aa] hover:bg-slate-50 dark:hover:bg-[#2a2d36] hover:text-slate-800 dark:hover:text-gray-200'
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
                    : 'text-slate-600 dark:text-[#a1a1aa] hover:bg-slate-50 dark:hover:bg-[#2a2d36] hover:text-slate-800 dark:hover:text-gray-200'
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
        <div className="p-4 border-t border-slate-200 dark:border-[#2d2d36]">
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
