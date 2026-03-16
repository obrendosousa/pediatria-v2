'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search, ChevronUp, ChevronDown, ChevronsUpDown,
  Eye, Pencil, MoreHorizontal, Inbox,
} from 'lucide-react';

// --- Tipos ---

export interface Column<T> {
  key: keyof T & string;
  label: string;
  sortable?: boolean;
  render?: (value: T[keyof T], row: T) => React.ReactNode;
}

export interface ActionItem<T> {
  icon: 'eye' | 'edit' | 'menu';
  label?: string;
  onClick: (row: T) => void;
}

export interface MenuAction<T> {
  icon?: React.ReactNode;
  label: string;
  onClick: (row: T) => void;
  className?: string;
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
}

export type SortDirection = 'asc' | 'desc';
export type SortState = { key: string; direction: SortDirection } | null;

export interface DataTableProps<T extends { id: string }> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  searchPlaceholder?: string;
  onSearch?: (term: string) => void;
  onSort?: (key: string, direction: SortDirection) => void;
  pagination?: Pagination;
  onPageChange?: (page: number, pageSize: number) => void;
  actions?: ActionItem<T>[];
  menuActions?: MenuAction<T>[] | ((row: T) => MenuAction<T>[]);
  emptyIcon?: React.ReactNode;
  emptyMessage?: string;
}

// --- Ícones de ação ---

const ACTION_ICONS = {
  eye: Eye,
  edit: Pencil,
  menu: MoreHorizontal,
} as const;

// --- Status Badge ---

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: 'bg-green-100 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-400', label: 'ATIVO' },
  inactive: { bg: 'bg-red-100 dark:bg-red-900/20', text: 'text-red-600 dark:text-red-400', label: 'INATIVO' },
};

function StatusBadge({ value }: { value: string }) {
  const cfg = STATUS_STYLES[value] ?? { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-600 dark:text-[#a1a1aa]', label: value.toUpperCase() };
  return (
    <span className={`px-2 py-0.5 text-xs font-bold rounded ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
}

// --- Skeleton ---

function SkeletonRows({ columns, rows }: { columns: number; rows: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="border-b border-slate-100 dark:border-[#27272a]">
          {Array.from({ length: columns }).map((_, c) => (
            <td key={c} className="px-4 py-3">
              <div className="h-4 bg-slate-200 dark:bg-gray-700 rounded animate-pulse" style={{ width: `${55 + Math.random() * 35}%` }} />
            </td>
          ))}
          <td className="px-4 py-3">
            <div className="h-4 w-16 bg-slate-200 dark:bg-gray-700 rounded animate-pulse ml-auto" />
          </td>
        </tr>
      ))}
    </>
  );
}

// --- Componente principal ---

export default function DataTable<T extends { id: string; status?: string }>({
  columns,
  data,
  loading = false,
  searchPlaceholder = 'Buscar...',
  onSearch,
  onSort,
  pagination,
  onPageChange,
  actions,
  menuActions,
  emptyIcon,
  emptyMessage = 'Nenhum item cadastrado.',
}: DataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortState>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);

  const menuButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce de busca
  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      onSearch?.(value);
      if (onPageChange && pagination) onPageChange(0, pagination.pageSize);
    }, 300);
  };

  // Sort
  const handleSort = (key: string) => {
    let direction: SortDirection = 'asc';
    if (sort?.key === key && sort.direction === 'asc') direction = 'desc';
    const next: SortState = sort?.key === key && sort.direction === 'desc' ? null : { key, direction };
    setSort(next);
    if (next) onSort?.(next.key, next.direction);
  };

  // Menu dropdown
  const toggleMenu = useCallback((id: string) => {
    if (menuOpenId === id) { setMenuOpenId(null); return; }
    const el = menuButtonRefs.current[id];
    if (el) {
      const rect = el.getBoundingClientRect();
      setMenuPosition({ top: rect.bottom + 4, left: rect.right - 180 });
    }
    setMenuOpenId(id);
  }, [menuOpenId]);

  useEffect(() => {
    if (menuOpenId === null) return;
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setMenuOpenId(null);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpenId]);

  // Paginação
  const pageSize = pagination?.pageSize ?? 10;
  const total = pagination?.total ?? data.length;
  const page = pagination?.page ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const showingFrom = total === 0 ? 0 : page * pageSize + 1;
  const showingTo = Math.min((page + 1) * pageSize, total);

  const handlePageSizeChange = (newSize: number) => {
    onPageChange?.(0, newSize);
  };

  // Resolve menu actions para a row
  const getMenuActions = (row: T): MenuAction<T>[] => {
    if (!menuActions) return [];
    return typeof menuActions === 'function' ? menuActions(row) : menuActions;
  };

  const hasActions = actions && actions.length > 0;
  const hasMenuActions = !!menuActions;

  // Renderiza valor da célula
  const renderCell = (col: Column<T>, row: T) => {
    const value = row[col.key];
    if (col.render) return col.render(value, row);
    if (col.key === 'status' && typeof value === 'string') return <StatusBadge value={value} />;
    if (value === null || value === undefined) return <span className="text-slate-300 dark:text-gray-600">—</span>;
    return String(value);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Barra de busca + pageSize */}
      <div className="px-6 py-3 flex flex-wrap items-center gap-3 border-b border-slate-100 dark:border-[#27272a]">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => handleSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 dark:border-[#2e2e33] rounded-lg bg-white dark:bg-[#18181b] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-400"
          />
        </div>

        {pagination && (
          <select
            value={pageSize}
            onChange={e => handlePageSizeChange(Number(e.target.value))}
            className="px-2 py-1.5 text-xs border border-slate-200 dark:border-[#2e2e33] rounded-lg bg-white dark:bg-[#18181b] text-slate-600 dark:text-[#d4d4d8] focus:outline-none focus:ring-2 focus:ring-teal-400"
          >
            <option value={10}>10 / página</option>
            <option value={25}>25 / página</option>
            <option value={50}>50 / página</option>
          </select>
        )}
      </div>

      {/* Tabela */}
      <div className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar">
        {loading ? (
          <div className="bg-white dark:bg-[#0a0a0c] rounded-xl border border-slate-200 dark:border-[#2e2e33] overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-[#18181b] border-b border-slate-200 dark:border-[#2e2e33]">
                  {columns.map(col => (
                    <th key={col.key} className="px-4 py-3 text-xs font-extrabold text-slate-500 dark:text-[#a1a1aa] uppercase">
                      {col.label}
                    </th>
                  ))}
                  {(hasActions || hasMenuActions) && (
                    <th className="px-4 py-3 text-xs font-extrabold text-slate-500 dark:text-[#a1a1aa] uppercase text-right">Opções</th>
                  )}
                </tr>
              </thead>
              <tbody>
                <SkeletonRows columns={columns.length} rows={pageSize > 10 ? 10 : pageSize} />
              </tbody>
            </table>
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-16">
            {emptyIcon || <Inbox className="w-12 h-12 text-slate-300 dark:text-gray-600 mx-auto mb-3" />}
            <p className="text-sm text-slate-400 dark:text-[#71717a]">
              {search ? `Nenhum resultado para "${search}".` : emptyMessage}
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-[#0a0a0c] rounded-xl border border-slate-200 dark:border-[#2e2e33] overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-[#18181b] border-b border-slate-200 dark:border-[#2e2e33]">
                  {columns.map(col => (
                    <th
                      key={col.key}
                      onClick={() => col.sortable && handleSort(col.key)}
                      className={`px-4 py-3 text-xs font-extrabold text-slate-500 dark:text-[#a1a1aa] uppercase ${
                        col.sortable ? 'cursor-pointer select-none hover:text-teal-600 dark:hover:text-teal-400 transition-colors' : ''
                      }`}
                    >
                      <span className="flex items-center gap-1">
                        {col.label}
                        {col.sortable && (
                          sort?.key === col.key ? (
                            sort.direction === 'asc'
                              ? <ChevronUp className="w-3.5 h-3.5 text-teal-500" />
                              : <ChevronDown className="w-3.5 h-3.5 text-teal-500" />
                          ) : (
                            <ChevronsUpDown className="w-3.5 h-3.5 opacity-30" />
                          )
                        )}
                      </span>
                    </th>
                  ))}
                  {(hasActions || hasMenuActions) && (
                    <th className="px-4 py-3 text-xs font-extrabold text-slate-500 dark:text-[#a1a1aa] uppercase text-right">Opções</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                {data.map(row => {
                  const rowMenuActions = getMenuActions(row);

                  return (
                    <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                      {columns.map(col => (
                        <td key={col.key} className="px-4 py-3 text-slate-700 dark:text-gray-200">
                          {renderCell(col, row)}
                        </td>
                      ))}
                      {(hasActions || hasMenuActions) && (
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {actions?.filter(a => a.icon !== 'menu').map((action, i) => {
                              const Icon = ACTION_ICONS[action.icon];
                              return (
                                <button
                                  key={i}
                                  onClick={() => action.onClick(row)}
                                  title={action.label}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors"
                                >
                                  <Icon className="w-4 h-4" />
                                </button>
                              );
                            })}
                            {(rowMenuActions.length > 0 || actions?.some(a => a.icon === 'menu')) && (
                              <button
                                ref={(el) => { menuButtonRefs.current[row.id] = el; }}
                                onClick={() => {
                                  const menuAction = actions?.find(a => a.icon === 'menu');
                                  if (menuAction && rowMenuActions.length === 0) {
                                    menuAction.onClick(row);
                                  } else {
                                    toggleMenu(row.id);
                                  }
                                }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                              >
                                <MoreHorizontal className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Paginação */}
      {pagination && totalPages > 1 && (
        <div className="px-6 py-3 border-t border-slate-200 dark:border-[#2e2e33] flex items-center justify-between text-xs text-slate-500 dark:text-[#a1a1aa]">
          <span>Mostrando {showingFrom} até {showingTo} de {total}</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange?.(Math.max(0, page - 1), pageSize)}
              disabled={page === 0}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#2e2e33] disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
            >
              Anterior
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const start = Math.max(0, Math.min(page - 2, totalPages - 5));
              const pageNum = start + i;
              if (pageNum >= totalPages) return null;
              return (
                <button
                  key={pageNum}
                  onClick={() => onPageChange?.(pageNum, pageSize)}
                  className={`px-3 py-1.5 rounded-lg border transition-colors ${
                    page === pageNum
                      ? 'bg-teal-600 text-white border-teal-600'
                      : 'border-slate-200 dark:border-[#2e2e33] hover:bg-slate-50 dark:hover:bg-white/5'
                  }`}
                >
                  {pageNum + 1}
                </button>
              );
            })}
            <button
              onClick={() => onPageChange?.(Math.min(totalPages - 1, page + 1), pageSize)}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#2e2e33] disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
            >
              Próximo
            </button>
          </div>
        </div>
      )}

      {/* Dropdown menu flutuante */}
      {menuOpenId !== null && menuPosition && (
        <div
          ref={dropdownRef}
          className="fixed z-50 w-44 bg-white dark:bg-[#18181b] rounded-xl shadow-xl border border-slate-200 dark:border-[#2e2e33] py-1 animate-in fade-in-0 zoom-in-95"
          style={{ top: menuPosition.top, left: menuPosition.left }}
        >
          {(() => {
            const row = data.find(r => r.id === menuOpenId);
            if (!row) return null;
            const rowMenuActions = getMenuActions(row);
            return rowMenuActions.map((action, i) => (
              <button
                key={i}
                onClick={() => { action.onClick(row); setMenuOpenId(null); }}
                className={`flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-white/5 transition-colors ${
                  action.className ?? 'text-slate-700 dark:text-gray-200'
                }`}
              >
                {action.icon}
                {action.label}
              </button>
            ));
          })()}
        </div>
      )}
    </div>
  );
}
