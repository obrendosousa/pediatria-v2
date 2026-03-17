'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { ProntuarioTabKey, ProntuarioSidebarEntry } from '@/types/prontuario';

interface ProntuarioSidebarProps {
  activeTab: ProntuarioTabKey;
  onTabChange: (tab: ProntuarioTabKey) => void;
  sidebarItems: ProntuarioSidebarEntry[];
}

export function ProntuarioSidebar({ activeTab, onTabChange, sidebarItems }: ProntuarioSidebarProps) {
  const [expandedSubmenus, setExpandedSubmenus] = useState<Set<string>>(new Set());

  const toggleSubmenu = (label: string) => {
    setExpandedSubmenus(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const isChildActive = (children: { key: ProntuarioTabKey }[]) =>
    children.some(c => c.key === activeTab);

  return (
    <div className="w-60 shrink-0 bg-[#fafbfc] dark:bg-[#0c0c0e] border-r border-slate-200/80 dark:border-[#1a1a1f] flex flex-col h-full">

      {/* Menu items */}
      <div className="flex-1 overflow-y-auto custom-scrollbar py-3">
        <div className="px-2 space-y-0.5">
          {sidebarItems.map((entry, idx) => {
            // ── Section header ──
            if (entry.type === 'section') {
              return (
                <div key={`section-${idx}`} className="pt-5 pb-1.5 px-3 first:pt-1">
                  <span className="text-[10px] font-semibold text-slate-400/80 dark:text-[#52525b] uppercase tracking-[0.08em]">
                    {entry.label}
                  </span>
                </div>
              );
            }

            // ── Submenu (Exames) ──
            if (entry.type === 'submenu') {
              const isOpen = expandedSubmenus.has(entry.label) || isChildActive(entry.children);
              const Icon = entry.icon;
              const Chevron = isOpen ? ChevronDown : ChevronRight;
              return (
                <div key={`submenu-${idx}`}>
                  <button
                    onClick={() => toggleSubmenu(entry.label)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-all duration-150 flex items-center gap-2.5 cursor-pointer ${
                      isChildActive(entry.children)
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-slate-500 dark:text-[#71717a] hover:bg-slate-100 dark:hover:bg-white/[0.04] hover:text-slate-700 dark:hover:text-[#a1a1aa]'
                    }`}
                  >
                    <Icon className="w-[18px] h-[18px] shrink-0 opacity-70" />
                    <span className="text-[13px] font-medium flex-1">{entry.label}</span>
                    <Chevron className="w-3.5 h-3.5 shrink-0 opacity-50" />
                  </button>
                  {isOpen && (
                    <div className="ml-[18px] pl-3 border-l border-slate-200 dark:border-[#1e1e24] space-y-0.5 mt-0.5 mb-1">
                      {entry.children.map(child => {
                        const isActive = activeTab === child.key;
                        const ChildIcon = child.icon;
                        return (
                          <button
                            key={child.key}
                            onClick={() => onTabChange(child.key)}
                            className={`w-full text-left px-3 py-1.5 rounded-md transition-all duration-150 flex items-center gap-2.5 cursor-pointer ${
                              isActive
                                ? 'bg-blue-500/10 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                : 'text-slate-500 dark:text-[#71717a] hover:bg-slate-100 dark:hover:bg-white/[0.04] hover:text-slate-700 dark:hover:text-[#a1a1aa]'
                            }`}
                          >
                            <ChildIcon className="w-[15px] h-[15px] shrink-0 opacity-70" />
                            <span className="text-xs font-medium truncate">{child.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            // ── Normal item ──
            const isActive = activeTab === entry.key;
            const Icon = entry.icon;
            return (
              <button
                key={entry.key}
                onClick={() => onTabChange(entry.key)}
                className={`relative w-full text-left px-3 py-2 rounded-lg transition-all duration-150 flex items-center gap-2.5 cursor-pointer ${
                  isActive
                    ? 'bg-blue-500/10 dark:bg-blue-500/8 text-blue-600 dark:text-blue-400'
                    : 'text-slate-500 dark:text-[#71717a] hover:bg-slate-100 dark:hover:bg-white/[0.04] hover:text-slate-700 dark:hover:text-[#a1a1aa]'
                }`}
              >
                {/* Active indicator */}
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-blue-500 rounded-r-full" />
                )}
                <Icon className={`w-[18px] h-[18px] shrink-0 ${isActive ? 'opacity-100' : 'opacity-60'}`} />
                <span className={`text-[13px] truncate ${isActive ? 'font-semibold' : 'font-medium'}`}>{entry.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
