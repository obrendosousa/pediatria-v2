'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Shield, Search, ChevronRight, X, DollarSign } from 'lucide-react';
import { createSchemaClient } from '@/lib/supabase/schemaClient';
import { useDebounce } from '@/hooks/useDebounce';
import type { ClinicalProtocol, RecordStatus } from '@/types/cadastros';
import type { ProtocolItemWithDetails } from '@/hooks/useClinicalProtocols';

const supabase = createSchemaClient('atendimento');

type PanelMainTab = 'injetaveis' | 'outros';
type PanelSubTab = 'consultas' | 'exames' | 'outros';

interface PanelProcedure {
  id: string;
  name: string;
  procedure_type: string;
  total_value: number;
}

const TYPE_LABELS: Record<string, string> = {
  injectable: 'Injetável',
  consultation: 'Consulta',
  exam: 'Exame',
  other: 'Outro',
};

const TYPE_COLORS: Record<string, string> = {
  injectable: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  consultation: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  exam: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  other: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export interface ProtocoloClinicoFormData {
  name: string;
  description: string;
  total_value: number;
  status: RecordStatus;
}

export interface ProtocoloClinicoFormProps {
  title: string;
  subtitle: string;
  initialData?: ClinicalProtocol | null;
  initialItems?: ProtocolItemWithDetails[];
  onSubmit: (
    data: ProtocoloClinicoFormData,
    items: { procedure_id: string; sort_order: number }[]
  ) => Promise<void>;
}

export default function ProtocoloClinicoForm({
  title,
  subtitle,
  initialData,
  initialItems = [],
  onSubmit,
}: ProtocoloClinicoFormProps) {
  const router = useRouter();

  // Form state
  const [name, setName] = useState(initialData?.name ?? '');
  const [description, setDescription] = useState(initialData?.description ?? '');
  const [status, setStatus] = useState<RecordStatus>(initialData?.status ?? 'active');
  const [items, setItems] = useState<ProtocolItemWithDetails[]>(initialItems);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState('');

  const totalValue = items.reduce((sum, item) => sum + item.total_value, 0);

  // Side panel state
  const [panelMainTab, setPanelMainTab] = useState<PanelMainTab>('injetaveis');
  const [panelSubTab, setPanelSubTab] = useState<PanelSubTab>('consultas');
  const [panelSearch, setPanelSearch] = useState('');
  const [panelItems, setPanelItems] = useState<PanelProcedure[]>([]);
  const [panelLoading, setPanelLoading] = useState(false);

  const debouncedSearch = useDebounce(panelSearch, 350);

  useEffect(() => {
    let cancelled = false;

    async function fetchPanelItems() {
      setPanelLoading(true);
      try {
        const search = debouncedSearch.trim();

        const types =
          panelMainTab === 'injetaveis'
            ? ['injectable']
            : panelSubTab === 'consultas'
            ? ['consultation']
            : panelSubTab === 'exames'
            ? ['exam']
            : ['other'];

        let q = supabase
          .from('procedures')
          .select('id, name, procedure_type, total_value')
          .eq('status', 'active')
          .in('procedure_type', types)
          .limit(50);

        if (search) q = q.ilike('name', `%${search}%`);

        const { data } = await q.order('name', { ascending: true });
        if (!cancelled) setPanelItems((data as PanelProcedure[]) || []);
      } finally {
        if (!cancelled) setPanelLoading(false);
      }
    }

    fetchPanelItems();
    return () => { cancelled = true; };
  }, [panelMainTab, panelSubTab, debouncedSearch]);

  const handleAddItem = useCallback((proc: PanelProcedure) => {
    setItems(prev => {
      if (prev.some(i => i.procedure_id === proc.id)) return prev;
      return [
        ...prev,
        {
          procedure_id: proc.id,
          procedure_name: proc.name,
          procedure_type: proc.procedure_type,
          total_value: proc.total_value,
          sort_order: prev.length,
        },
      ];
    });
  }, []);

  const handleRemoveItem = useCallback((procedureId: string) => {
    setItems(prev => prev.filter(i => i.procedure_id !== procedureId));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setNameError('Nome é obrigatório.');
      return;
    }
    setSaving(true);
    try {
      await onSubmit(
        { name: name.trim(), description: description.trim(), total_value: totalValue, status },
        items.map((item, idx) => ({ procedure_id: item.procedure_id, sort_order: idx })),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-[#15171e]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-gray-700 bg-white dark:bg-[#1e2028]">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors text-slate-500 dark:text-gray-400"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-teal-600" />
            <div>
              <h1 className="text-lg font-bold text-slate-800 dark:text-gray-100">{title}</h1>
              <p className="text-xs text-slate-400 dark:text-gray-500">{subtitle}</p>
            </div>
          </div>
        </div>
        <button
          type="submit"
          form="protocolo-clinico-form"
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-bold shadow-md transition-all active:scale-95 disabled:opacity-60"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          SALVAR INFORMAÇÕES
        </button>
      </div>

      {/* Body */}
      <form
        id="protocolo-clinico-form"
        onSubmit={handleSubmit}
        className="flex flex-1 overflow-hidden"
      >
        {/* Left column */}
        <div className="flex-1 flex flex-col overflow-y-auto p-6 gap-5">
          {/* Informações */}
          <div className="bg-white dark:bg-[#1e2028] rounded-xl border border-slate-200 dark:border-gray-700 p-5">
            <p className="text-xs font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wide mb-4">
              INFORMAÇÕES DO PROTOCOLO
            </p>
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">
                  Nome <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => { setName(e.target.value); setNameError(''); }}
                  placeholder="Nome do protocolo"
                  className={`w-full px-3 py-2 border rounded-lg text-sm bg-white dark:bg-[#2a2d36] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-400 ${
                    nameError ? 'border-red-400 dark:border-red-500' : 'border-slate-200 dark:border-gray-700'
                  }`}
                />
                {nameError && <p className="mt-1 text-xs text-red-500">{nameError}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">
                  Descrição
                </label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Descrição do protocolo..."
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-[#2a2d36] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">
                  Status
                </label>
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value as RecordStatus)}
                  className="w-48 px-3 py-2 border border-slate-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-[#2a2d36] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-400"
                >
                  <option value="active">Ativo</option>
                  <option value="inactive">Inativo</option>
                </select>
              </div>
            </div>
          </div>

          {/* Procedimentos selecionados */}
          <div className="bg-white dark:bg-[#1e2028] rounded-xl border border-slate-200 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wide">
                PROCEDIMENTOS DO PROTOCOLO
              </p>
              {items.length > 0 && (
                <span className="text-xs text-slate-400 dark:text-gray-500">
                  {items.length} procedimento{items.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {items.length === 0 ? (
              <p className="text-sm text-slate-400 dark:text-gray-500 text-center py-8">
                Clique em um procedimento no painel à direita para adicioná-lo ao protocolo.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {items.map((item, idx) => (
                  <div
                    key={item.procedure_id}
                    className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-[#2a2d36] rounded-lg border border-slate-100 dark:border-gray-800 group"
                  >
                    <span className="text-xs text-slate-400 dark:text-gray-500 font-mono w-5 text-right shrink-0">
                      {idx + 1}.
                    </span>
                    <p className="flex-1 text-sm font-medium text-slate-700 dark:text-gray-200 truncate">
                      {item.procedure_name}
                    </p>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${TYPE_COLORS[item.procedure_type] ?? TYPE_COLORS.other}`}>
                      {TYPE_LABELS[item.procedure_type] ?? item.procedure_type}
                    </span>
                    <span className="text-xs font-mono text-slate-500 dark:text-gray-400 shrink-0">
                      {formatCurrency(item.total_value)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.procedure_id)}
                      className="p-1 rounded opacity-0 group-hover:opacity-100 text-slate-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                {/* Total */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-gray-700 mt-1">
                  <DollarSign className="w-4 h-4 text-teal-600" />
                  <span className="text-sm text-slate-500 dark:text-gray-400">Valor total:</span>
                  <span className="text-base font-bold text-teal-700 dark:text-teal-400">
                    {formatCurrency(totalValue)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right column — Side Panel */}
        <div className="w-80 flex-shrink-0 flex flex-col border-l border-slate-200 dark:border-gray-700 bg-white dark:bg-[#1e2028] overflow-hidden">
          {/* Main tabs */}
          <div className="flex border-b border-slate-200 dark:border-gray-700">
            {(['injetaveis', 'outros'] as PanelMainTab[]).map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => { setPanelMainTab(tab); setPanelSearch(''); }}
                className={`flex-1 px-3 py-2.5 text-xs font-bold uppercase tracking-wide transition-colors ${
                  panelMainTab === tab
                    ? 'text-teal-600 dark:text-teal-400 border-b-2 border-teal-600 dark:border-teal-400'
                    : 'text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-300'
                }`}
              >
                {tab === 'injetaveis' ? 'INJETÁVEIS' : 'OUTROS'}
              </button>
            ))}
          </div>

          {/* Sub tabs — only for OUTROS */}
          {panelMainTab === 'outros' && (
            <div className="flex gap-1 px-3 py-2 border-b border-slate-100 dark:border-gray-800">
              {(['consultas', 'exames', 'outros'] as PanelSubTab[]).map(st => (
                <button
                  key={st}
                  type="button"
                  onClick={() => { setPanelSubTab(st); setPanelSearch(''); }}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors ${
                    panelSubTab === st
                      ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300'
                      : 'text-slate-400 dark:text-gray-500 hover:bg-slate-100 dark:hover:bg-white/5'
                  }`}
                >
                  {st === 'consultas' ? 'CONSULTAS' : st === 'exames' ? 'EXAMES' : 'OUTROS'}
                </button>
              ))}
            </div>
          )}

          {/* Search */}
          <div className="px-3 py-2 border-b border-slate-100 dark:border-gray-800">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={panelSearch}
                onChange={e => setPanelSearch(e.target.value)}
                placeholder="Buscar procedimento..."
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-[#2a2d36] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-400"
              />
            </div>
          </div>

          {/* Items list */}
          <div className="flex-1 overflow-y-auto">
            {panelLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 text-teal-500 animate-spin" />
              </div>
            ) : panelItems.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-gray-500 text-center py-6 px-3">
                Nenhum procedimento encontrado.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-gray-800">
                {panelItems.map(proc => {
                  const isAdded = items.some(i => i.procedure_id === proc.id);
                  return (
                    <button
                      key={proc.id}
                      type="button"
                      onClick={() => handleAddItem(proc)}
                      disabled={isAdded}
                      className={`w-full text-left px-4 py-2.5 flex items-center gap-2 transition-colors group ${
                        isAdded
                          ? 'opacity-40 cursor-not-allowed'
                          : 'hover:bg-teal-50 dark:hover:bg-teal-900/10'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm truncate transition-colors ${
                          isAdded
                            ? 'text-slate-400 dark:text-gray-500'
                            : 'text-slate-700 dark:text-gray-200 group-hover:text-teal-700 dark:group-hover:text-teal-300'
                        }`}>
                          {proc.name}
                        </p>
                        <p className="text-xs text-slate-400 dark:text-gray-500 font-mono">
                          {formatCurrency(proc.total_value)}
                        </p>
                      </div>
                      {isAdded ? (
                        <span className="text-xs text-teal-600 dark:text-teal-400 font-bold shrink-0">✓</span>
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-gray-600 group-hover:text-teal-500 transition-colors shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
