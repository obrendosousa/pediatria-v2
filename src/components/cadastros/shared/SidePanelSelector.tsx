'use client';

import { useState, useMemo } from 'react';
import { Search, ChevronRight } from 'lucide-react';

// --- Tipos ---

export interface SidePanelTab {
  key: string;
  label: string;
}

export interface SidePanelItem {
  id: string;
  name: string;
  description?: string;
  category?: string;
}

export interface SidePanelSelectorProps {
  tabs?: SidePanelTab[];
  subTabs?: SidePanelTab[];
  items: SidePanelItem[];
  onSelect: (item: SidePanelItem) => void;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyMessage?: string;
  title?: string;
  showToggle?: boolean;
  toggleLabel?: string;
  onToggleChange?: (value: boolean) => void;
}

// --- Componente ---

export default function SidePanelSelector({
  tabs,
  subTabs,
  items,
  onSelect,
  searchable = true,
  searchPlaceholder = 'Buscar...',
  emptyMessage = 'Nenhum item encontrado.',
  title,
  showToggle = false,
  toggleLabel = 'Meus modelos',
  onToggleChange,
}: SidePanelSelectorProps) {
  const [activeTab, setActiveTab] = useState(tabs?.[0]?.key ?? '');
  const [activeSubTab, setActiveSubTab] = useState(subTabs?.[0]?.key ?? '');
  const [search, setSearch] = useState('');
  const [toggleOn, setToggleOn] = useState(false);

  const filtered = useMemo(() => {
    let result = items;
    if (activeTab && tabs) {
      result = result.filter(i => i.category === activeTab || !i.category);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(i => i.name.toLowerCase().includes(q));
    }
    return result;
  }, [items, activeTab, tabs, search]);

  return (
    <div className="flex flex-col h-full border-l border-slate-200 dark:border-[#3d3d48] bg-white dark:bg-[#08080b]">
      {/* Título */}
      {title && (
        <div className="px-4 pt-4 pb-2">
          <h4 className="text-sm font-bold text-slate-700 dark:text-gray-200 uppercase tracking-wide">{title}</h4>
        </div>
      )}

      {/* Tabs */}
      {tabs && tabs.length > 0 && (
        <div className="flex border-b border-slate-200 dark:border-[#3d3d48]">
          {tabs.map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 px-3 py-2.5 text-xs font-bold uppercase tracking-wide transition-colors ${
                activeTab === tab.key
                  ? 'text-teal-600 dark:text-teal-400 border-b-2 border-teal-600 dark:border-teal-400'
                  : 'text-slate-400 dark:text-[#71717a] hover:text-slate-600 dark:hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* SubTabs */}
      {subTabs && subTabs.length > 0 && (
        <div className="flex gap-1 px-3 py-2 border-b border-slate-100 dark:border-[#2d2d36]">
          {subTabs.map(st => (
            <button
              key={st.key}
              type="button"
              onClick={() => setActiveSubTab(st.key)}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors ${
                activeSubTab === st.key
                  ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300'
                  : 'text-slate-400 dark:text-[#71717a] hover:bg-slate-100 dark:hover:bg-white/5'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      )}

      {/* Busca */}
      {searchable && (
        <div className="px-3 py-2 border-b border-slate-100 dark:border-[#2d2d36]">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 dark:border-[#3d3d48] rounded-lg bg-white dark:bg-[#1c1c21] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-400"
            />
          </div>
        </div>
      )}

      {/* Toggle */}
      {showToggle && (
        <div className="px-3 py-2 border-b border-slate-100 dark:border-[#2d2d36] flex items-center gap-2">
          <button
            type="button"
            onClick={() => { setToggleOn(v => !v); onToggleChange?.(!toggleOn); }}
            className={`relative w-8 h-4.5 rounded-full transition-colors ${
              toggleOn ? 'bg-teal-500' : 'bg-slate-300 dark:bg-gray-600'
            }`}
          >
            <span className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${
              toggleOn ? 'translate-x-4' : 'translate-x-0.5'
            }`} />
          </button>
          <span className="text-xs text-slate-500 dark:text-[#a1a1aa]">{toggleLabel}</span>
        </div>
      )}

      {/* Lista de itens */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {filtered.length === 0 ? (
          <p className="text-xs text-slate-400 dark:text-[#71717a] text-center py-6">{emptyMessage}</p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-gray-800">
            {filtered.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item)}
                className="w-full text-left px-4 py-2.5 flex items-center gap-2 hover:bg-teal-50 dark:hover:bg-teal-900/10 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700 dark:text-gray-200 truncate group-hover:text-teal-700 dark:group-hover:text-teal-300 transition-colors">
                    {item.name}
                  </p>
                  {item.description && (
                    <p className="text-xs text-slate-400 dark:text-[#71717a] truncate">{item.description}</p>
                  )}
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-gray-600 group-hover:text-teal-500 transition-colors shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
