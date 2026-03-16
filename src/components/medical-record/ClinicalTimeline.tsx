// src/components/medical-record/ClinicalTimeline.tsx

'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  FileText, Activity, Pill, Award, ClipboardCheck, TestTube,
  FlaskConical, File, User, Clock, ChevronDown, ChevronUp,
  Search, Stethoscope, Printer, Copy, Filter
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  useClinicalTimeline,
  type TimelineEntry,
  type TimelineEntryType,
} from '@/hooks/atendimento/useClinicalTimeline';

// ── Configuração de tipos ────────────────────────────────────

interface TypeConfig {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  dotColor: string;
  icon: React.ElementType;
}

const TYPE_CONFIG: Record<TimelineEntryType, TypeConfig> = {
  anamnese: {
    label: 'Anamnese',
    color: 'text-blue-700 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    borderColor: 'border-blue-200 dark:border-blue-800',
    dotColor: 'bg-blue-500',
    icon: FileText,
  },
  evolucao: {
    label: 'Evolução',
    color: 'text-emerald-700 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-900/20',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
    dotColor: 'bg-emerald-500',
    icon: Activity,
  },
  receita: {
    label: 'Receita',
    color: 'text-purple-700 dark:text-purple-400',
    bgColor: 'bg-purple-50 dark:bg-purple-900/20',
    borderColor: 'border-purple-200 dark:border-purple-800',
    dotColor: 'bg-purple-500',
    icon: Pill,
  },
  atestado: {
    label: 'Atestado',
    color: 'text-orange-700 dark:text-orange-400',
    bgColor: 'bg-orange-50 dark:bg-orange-900/20',
    borderColor: 'border-orange-200 dark:border-orange-800',
    dotColor: 'bg-orange-500',
    icon: Award,
  },
  laudo: {
    label: 'Laudo',
    color: 'text-red-700 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    borderColor: 'border-red-200 dark:border-red-800',
    dotColor: 'bg-red-500',
    icon: ClipboardCheck,
  },
  exame_pedido: {
    label: 'Pedido de Exame',
    color: 'text-cyan-700 dark:text-cyan-400',
    bgColor: 'bg-cyan-50 dark:bg-cyan-900/20',
    borderColor: 'border-cyan-200 dark:border-cyan-800',
    dotColor: 'bg-cyan-500',
    icon: TestTube,
  },
  exame_resultado: {
    label: 'Resultado de Exame',
    color: 'text-teal-700 dark:text-teal-400',
    bgColor: 'bg-teal-50 dark:bg-teal-900/20',
    borderColor: 'border-teal-200 dark:border-teal-800',
    dotColor: 'bg-teal-500',
    icon: FlaskConical,
  },
  documento: {
    label: 'Documento',
    color: 'text-slate-700 dark:text-slate-400',
    bgColor: 'bg-slate-50 dark:bg-slate-800/50',
    borderColor: 'border-slate-200 dark:border-slate-700',
    dotColor: 'bg-slate-500',
    icon: File,
  },
};

const ALL_TYPES: TimelineEntryType[] = [
  'anamnese', 'evolucao', 'receita', 'atestado', 'laudo',
  'exame_pedido', 'exame_resultado', 'documento',
];

// ── Props ────────────────────────────────────────────────────

interface ClinicalTimelineProps {
  patientId: number;
  refreshTrigger: number;
  patientData?: unknown;
}

// ── Componente Principal ─────────────────────────────────────

export function ClinicalTimeline({ patientId, refreshTrigger }: ClinicalTimelineProps) {
  const { entries, doctors, loading, fetchAll, fetchDoctors } = useClinicalTimeline(patientId);

  // Filtros
  const [filterDoctorId, setFilterDoctorId] = useState<number | null>(null);
  const [filterTypes, setFilterTypes] = useState<TimelineEntryType[]>([...ALL_TYPES]);
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Estado de expansão
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchAll();
    fetchDoctors();
  }, [patientId, refreshTrigger, fetchAll, fetchDoctors]);

  // Filtragem client-side
  const filtered = useMemo(() => {
    return entries.filter((e) => {
      // Filtro tipo
      if (!filterTypes.includes(e.type)) return false;

      // Filtro profissional
      if (filterDoctorId !== null && e.doctorId !== filterDoctorId) return false;

      // Filtro data
      if (filterDateFrom) {
        const entryDate = e.date.slice(0, 10);
        if (entryDate < filterDateFrom) return false;
      }
      if (filterDateTo) {
        const entryDate = e.date.slice(0, 10);
        if (entryDate > filterDateTo) return false;
      }

      return true;
    });
  }, [entries, filterTypes, filterDoctorId, filterDateFrom, filterDateTo]);

  // Agrupar por ano
  const groupedByYear = useMemo(() => {
    const groups: Record<number, TimelineEntry[]> = {};
    filtered.forEach((e) => {
      const year = new Date(e.date).getFullYear();
      if (!groups[year]) groups[year] = [];
      groups[year].push(e);
    });
    return groups;
  }, [filtered]);

  const years = Object.keys(groupedByYear)
    .map(Number)
    .sort((a, b) => b - a);

  // Map de doctorId -> name
  const doctorMap = useMemo(() => {
    const m: Record<number, string> = {};
    doctors.forEach((d) => { m[d.id] = d.name; });
    return m;
  }, [doctors]);

  const toggleType = (t: TimelineEntryType) => {
    setFilterTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  };

  const toggleExpand = (key: string) => {
    setExpandedId((prev) => (prev === key ? null : key));
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handlePrint = (entry: TimelineEntry) => {
    const win = window.open('', '_blank');
    if (!win) return;
    const cfg = TYPE_CONFIG[entry.type];
    const doctor = entry.doctorId ? (doctorMap[entry.doctorId] || '') : '';
    const dateStr = formatDate(entry.date);
    win.document.write(`
      <html><head><title>${entry.title}</title>
      <style>body{font-family:Arial,sans-serif;padding:40px;color:#333}
      h1{font-size:18px;margin-bottom:4px}
      .meta{color:#666;font-size:13px;margin-bottom:16px}
      .badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:bold}
      hr{border:none;border-top:1px solid #ddd;margin:16px 0}
      .content{font-size:14px;line-height:1.6}</style></head>
      <body>
        <span class="badge">${cfg.label}</span>
        <h1>${entry.title}</h1>
        <div class="meta">
          ${dateStr ? `<div>Data: ${dateStr}</div>` : ''}
          ${doctor ? `<div>Profissional: ${doctor}</div>` : ''}
        </div>
        <hr/>
        <div class="content">${entry.htmlContent || entry.preview || ''}</div>
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  // ── Loading ────────────────────────────────────────────────
  if (loading && entries.length === 0) {
    return (
      <div className="py-10 flex justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-rose-500 rounded-full animate-spin" />
      </div>
    );
  }

  // ── Vazio ──────────────────────────────────────────────────
  if (!loading && entries.length === 0) {
    return (
      <div className="text-center py-16 bg-slate-50 dark:bg-[#0d0f15]/50 rounded-3xl border-2 border-dashed border-slate-200 dark:border-[#1e2334]">
        <div className="w-16 h-16 bg-slate-100 dark:bg-[#141722] rounded-full flex items-center justify-center mx-auto mb-4">
          <Stethoscope className="w-8 h-8 text-slate-400" />
        </div>
        <h3 className="text-slate-900 dark:text-[#e8ecf4] font-bold mb-1">Nenhum registro clínico</h3>
        <p className="text-slate-500 dark:text-[#565d73] text-sm">O histórico aparecerá aqui conforme registros forem criados.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Barra de Filtros ─────────────────────────────────── */}
      <div className="bg-white dark:bg-[#0d0f15] rounded-xl border border-slate-200 dark:border-[#252a3a] p-4">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 text-sm font-bold text-slate-600 dark:text-[#a0a8be] hover:text-blue-600 transition-colors w-full"
        >
          <Filter className="w-4 h-4" />
          Filtros
          {showFilters ? <ChevronUp className="w-4 h-4 ml-auto" /> : <ChevronDown className="w-4 h-4 ml-auto" />}
          {(filterDoctorId !== null || filterTypes.length < ALL_TYPES.length || filterDateFrom || filterDateTo) && (
            <span className="ml-2 text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 rounded font-bold">ATIVO</span>
          )}
        </button>

        {showFilters && (
          <div className="mt-4 space-y-4">
            {/* Profissional + Datas */}
            <div className="flex items-end gap-4 flex-wrap">
              <div className="min-w-[200px]">
                <label className="text-xs font-bold text-slate-500 dark:text-[#828ca5] uppercase mb-1 block">Profissional</label>
                <select
                  value={filterDoctorId ?? ''}
                  onChange={(e) => setFilterDoctorId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-[#252a3a] rounded-lg bg-white dark:bg-[#141722] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="">Todos</option>
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-[#828ca5] uppercase mb-1 block">De</label>
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="px-3 py-2 text-sm border border-slate-200 dark:border-[#252a3a] rounded-lg bg-white dark:bg-[#141722] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-[#828ca5] uppercase mb-1 block">Até</label>
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className="px-3 py-2 text-sm border border-slate-200 dark:border-[#252a3a] rounded-lg bg-white dark:bg-[#141722] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <button
                onClick={() => { setFilterDoctorId(null); setFilterTypes([...ALL_TYPES]); setFilterDateFrom(''); setFilterDateTo(''); }}
                className="px-4 py-2 text-xs font-bold text-slate-500 dark:text-[#828ca5] bg-slate-100 dark:bg-[#141722] rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
              >
                LIMPAR
              </button>
            </div>

            {/* Tipos de registro */}
            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-[#828ca5] uppercase mb-2 block">Tipo de registro</label>
              <div className="flex flex-wrap gap-2">
                {ALL_TYPES.map((t) => {
                  const cfg = TYPE_CONFIG[t];
                  const active = filterTypes.includes(t);
                  return (
                    <button
                      key={t}
                      onClick={() => toggleType(t)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                        active
                          ? `${cfg.bgColor} ${cfg.color} ${cfg.borderColor}`
                          : 'bg-slate-50 dark:bg-[#141722] text-slate-400 dark:text-[#565d73] border-slate-200 dark:border-[#252a3a] opacity-50'
                      }`}
                    >
                      <cfg.icon className="w-3.5 h-3.5" />
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Contador de resultados */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs text-slate-400 dark:text-[#565d73]">
          {filtered.length} registro{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Timeline ──────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <Search className="w-10 h-10 text-slate-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-slate-400 dark:text-[#565d73]">Nenhum registro corresponde aos filtros.</p>
        </div>
      ) : (
        <div className="space-y-10 relative">
          {years.map((year) => (
            <div key={year} className="relative">
              <div className="space-y-6 relative">
                {/* Linha vertical */}
                <div className="absolute left-[18px] top-0 bottom-0 w-[2px] bg-gradient-to-b from-rose-200 via-slate-200 to-slate-100 dark:from-rose-900/30 dark:via-gray-700 dark:to-gray-800" />

                {/* Badge do ano */}
                <div className="absolute left-0 top-0 z-30 pointer-events-none">
                  <div className="bg-gradient-to-br from-rose-600 to-rose-700 dark:from-rose-500 dark:to-rose-600 text-white text-center rounded-xl px-4 py-2 shadow-xl border-[3px] border-white dark:border-[#0b141a]">
                    <div className="text-base font-bold leading-none tracking-wide">{year}</div>
                  </div>
                </div>

                {groupedByYear[year].map((entry, index) => {
                  const cfg = TYPE_CONFIG[entry.type];
                  const Icon = cfg.icon;
                  const entryKey = `${entry.type}-${entry.id}`;
                  const isExpanded = expandedId === entryKey;
                  const doctorName = entry.doctorId ? (doctorMap[entry.doctorId] || null) : null;

                  return (
                    <div key={entryKey} className={`group relative pl-16 ${index === 0 ? 'pt-16' : ''}`}>
                      {/* Ponto na timeline */}
                      <div className={`absolute left-0 flex flex-col items-center z-40 ${index === 0 ? 'top-16' : 'top-4'}`}>
                        {/* Badge dia/mês */}
                        <div className="bg-gradient-to-br from-slate-800 to-slate-700 dark:from-white dark:to-gray-50 text-white dark:text-slate-900 text-center rounded-xl px-3 py-2 mb-2 shadow-lg border-[3px] border-white dark:border-[#0b141a]">
                          <div className="text-lg font-bold leading-none">
                            {formatDay(entry.date)}
                          </div>
                          <div className="text-[10px] uppercase leading-none mt-1 font-semibold tracking-wide">
                            {formatMonth(entry.date)}
                          </div>
                        </div>

                        {/* Dot colorido do tipo */}
                        <div className={`w-9 h-9 rounded-full border-[3px] border-white dark:border-[#0b141a] shadow-lg flex items-center justify-center ${cfg.dotColor} transition-transform group-hover:scale-110`}>
                          <Icon className="w-4 h-4 text-white" />
                        </div>
                      </div>

                      {/* Card */}
                      <div
                        onClick={() => toggleExpand(entryKey)}
                        className={`bg-white dark:bg-[#0d0f15] rounded-2xl border-2 p-5 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer ${
                          isExpanded ? cfg.borderColor : 'border-slate-200 dark:border-[#1e2334]'
                        }`}
                      >
                        {/* Header do card */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              {/* Badge do tipo */}
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded ${cfg.bgColor} ${cfg.color}`}>
                                <Icon className="w-3 h-3" />
                                {cfg.label}
                              </span>
                              {entry.signed && (
                                <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded font-bold">ASSINADO</span>
                              )}
                            </div>
                            <h4 className="font-bold text-slate-800 dark:text-[#e8ecf4] text-sm truncate">
                              {entry.title}
                            </h4>
                            <div className="flex items-center gap-3 mt-1 text-xs text-slate-400 dark:text-[#565d73]">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatDate(entry.date)}
                              </span>
                              {doctorName && (
                                <span className="flex items-center gap-1">
                                  <User className="w-3 h-3" />
                                  {doctorName}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={(ev) => { ev.stopPropagation(); handleCopy(entry.preview); }}
                              title="Copiar"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(ev) => { ev.stopPropagation(); handlePrint(entry); }}
                              title="Imprimir"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                            {isExpanded
                              ? <ChevronUp className="w-4 h-4 text-slate-400" />
                              : <ChevronDown className="w-4 h-4 text-slate-400" />
                            }
                          </div>
                        </div>

                        {/* Preview (sempre visível) */}
                        {!isExpanded && entry.preview && (
                          <p className="mt-2 text-xs text-slate-500 dark:text-[#828ca5] line-clamp-2">{entry.preview}</p>
                        )}

                        {/* Conteúdo expandido */}
                        {isExpanded && (
                          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-[#1e2334]">
                            {entry.htmlContent ? (
                              <div
                                className="prose dark:prose-invert max-w-none text-sm"
                                dangerouslySetInnerHTML={{ __html: entry.htmlContent }}
                              />
                            ) : (
                              <p className="text-sm text-slate-600 dark:text-[#a0a8be] whitespace-pre-wrap">{entry.preview}</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Helpers de formatação ────────────────────────────────────

function formatDay(dateStr: string): string {
  try {
    const d = dateStr.length <= 10 ? new Date(dateStr + 'T12:00:00') : parseISO(dateStr);
    return format(d, 'd', { locale: ptBR });
  } catch {
    return '—';
  }
}

function formatMonth(dateStr: string): string {
  try {
    const d = dateStr.length <= 10 ? new Date(dateStr + 'T12:00:00') : parseISO(dateStr);
    return format(d, 'MMM', { locale: ptBR });
  } catch {
    return '';
  }
}

function formatDate(dateStr: string): string {
  try {
    const d = dateStr.length <= 10 ? new Date(dateStr + 'T12:00:00') : parseISO(dateStr);
    return format(d, "d 'de' MMMM 'de' yyyy", { locale: ptBR });
  } catch {
    return dateStr;
  }
}
