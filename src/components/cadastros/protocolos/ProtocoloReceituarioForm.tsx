'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, ClipboardList, Search, ChevronRight } from 'lucide-react';
import RichTextEditor from '@/components/cadastros/RichTextEditor';
import { createSchemaClient } from '@/lib/supabase/schemaClient';
import { useDebounce } from '@/hooks/useDebounce';
import type { PrescriptionProtocol, RecordStatus } from '@/types/cadastros';

const supabase = createSchemaClient('atendimento');

type MainTab = 'manipulados' | 'industrializado';
type SubTab = 'formulas' | 'protocolos' | 'substancias';

interface PanelItem {
  id: string;
  name: string;
}

export interface ProtocoloFormData {
  name: string;
  content: string;
  status: RecordStatus;
}

export interface ProtocoloReceituarioFormProps {
  title: string;
  subtitle: string;
  initialData?: PrescriptionProtocol | null;
  onSubmit: (data: ProtocoloFormData) => Promise<void>;
}

export default function ProtocoloReceituarioForm({
  title,
  subtitle,
  initialData,
  onSubmit,
}: ProtocoloReceituarioFormProps) {
  const router = useRouter();

  // Form state
  const [name, setName] = useState(initialData?.name ?? '');
  const [content, setContent] = useState(initialData?.content ?? '');
  const [status, setStatus] = useState<RecordStatus>(initialData?.status ?? 'active');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Side panel state
  const [mainTab, setMainTab] = useState<MainTab>('manipulados');
  const [subTab, setSubTab] = useState<SubTab>('formulas');
  const [panelSearch, setPanelSearch] = useState('');
  const [panelItems, setPanelItems] = useState<PanelItem[]>([]);
  const [panelLoading, setPanelLoading] = useState(false);
  const debouncedSearch = useDebounce(panelSearch, 350);

  // Fetch panel items when tab/subtab/search changes
  useEffect(() => {
    let cancelled = false;

    async function fetchItems() {
      setPanelLoading(true);
      try {
        const search = debouncedSearch.trim();

        if (mainTab === 'industrializado') {
          let q = supabase
            .from('medications')
            .select('id, description')
            .limit(50);
          if (search) q = q.ilike('description', `%${search}%`);
          const { data } = await q.order('description', { ascending: true });
          if (!cancelled) {
            setPanelItems((data || []).map((m: { id: string; description: string }) => ({ id: m.id, name: m.description })));
          }
        } else {
          if (subTab === 'formulas') {
            let q = supabase
              .from('formulas')
              .select('id, name')
              .eq('status', 'active')
              .limit(50);
            if (search) q = q.ilike('name', `%${search}%`);
            const { data } = await q.order('name', { ascending: true });
            if (!cancelled) {
              setPanelItems((data || []).map((i: { id: string; name: string }) => ({ id: i.id, name: i.name })));
            }
          } else if (subTab === 'protocolos') {
            let q = supabase
              .from('prescription_protocols')
              .select('id, name')
              .eq('status', 'active')
              .limit(50);
            if (search) q = q.ilike('name', `%${search}%`);
            const { data } = await q.order('name', { ascending: true });
            if (!cancelled) {
              setPanelItems((data || []).map((i: { id: string; name: string }) => ({ id: i.id, name: i.name })));
            }
          } else {
            let q = supabase
              .from('substances')
              .select('id, name')
              .limit(50);
            if (search) q = q.ilike('name', `%${search}%`);
            const { data } = await q.order('name', { ascending: true });
            if (!cancelled) {
              setPanelItems((data || []).map((i: { id: string; name: string }) => ({ id: i.id, name: i.name })));
            }
          }
        }
      } finally {
        if (!cancelled) setPanelLoading(false);
      }
    }

    fetchItems();
    return () => { cancelled = true; };
  }, [mainTab, subTab, debouncedSearch]);

  const handleItemSelect = useCallback((item: PanelItem) => {
    setContent(prev => {
      const para = `<p>${item.name}</p>`;
      return prev ? prev + para : para;
    });
  }, []);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Nome é obrigatório.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      await onSubmit({ name: name.trim(), content, status });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-[#15171e]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-[#252a3a] bg-white dark:bg-[#0d0f15]">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors text-slate-500 dark:text-[#828ca5]"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-teal-600" />
            <div>
              <h1 className="text-lg font-bold text-slate-800 dark:text-[#e8ecf4]">{title}</h1>
              <p className="text-xs text-slate-400 dark:text-[#565d73]">{subtitle}</p>
            </div>
          </div>
        </div>
        <button
          type="submit"
          form="protocolo-receituario-form"
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-bold shadow-md transition-all active:scale-95 disabled:opacity-60"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          SALVAR INFORMAÇÕES
        </button>
      </div>

      {/* Body */}
      <form
        id="protocolo-receituario-form"
        onSubmit={handleSubmit}
        className="flex flex-1 overflow-hidden"
      >
        {/* Left column */}
        <div className="flex-1 flex flex-col overflow-y-auto p-6 gap-5">
          {/* Informações do protocolo */}
          <div className="bg-white dark:bg-[#0d0f15] rounded-xl border border-slate-200 dark:border-[#252a3a] p-5">
            <p className="text-xs font-bold text-slate-400 dark:text-[#565d73] uppercase tracking-wide mb-4">
              INFORMAÇÕES DO PROTOCOLO
            </p>
            <div className="flex flex-col gap-4">
              {/* Nome */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-[#a0a8be] mb-1">
                  Nome <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => { setName(e.target.value); setErrors(prev => ({ ...prev, name: '' })); }}
                  placeholder="Nome do protocolo"
                  className={`w-full px-3 py-2 border rounded-lg text-sm bg-white dark:bg-[#141722] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-400 ${
                    errors.name
                      ? 'border-red-400 dark:border-red-500'
                      : 'border-slate-200 dark:border-[#252a3a]'
                  }`}
                />
                {errors.name && (
                  <p className="mt-1 text-xs text-red-500">{errors.name}</p>
                )}
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-[#a0a8be] mb-1">
                  Status
                </label>
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value as RecordStatus)}
                  className="w-48 px-3 py-2 border border-slate-200 dark:border-[#252a3a] rounded-lg text-sm bg-white dark:bg-[#141722] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-400"
                >
                  <option value="active">Ativo</option>
                  <option value="inactive">Inativo</option>
                </select>
              </div>
            </div>
          </div>

          {/* Editor de conteúdo */}
          <div className="bg-white dark:bg-[#0d0f15] rounded-xl border border-slate-200 dark:border-[#252a3a] p-5 flex flex-col gap-3">
            <p className="text-xs font-bold text-slate-400 dark:text-[#565d73] uppercase tracking-wide">
              CONTEÚDO
            </p>
            <RichTextEditor
              value={content}
              onChange={setContent}
              placeholder="Escreva o conteúdo do protocolo ou clique nos itens do painel à direita para inserir..."
            />
          </div>
        </div>

        {/* Right column — Side Panel */}
        <div className="w-80 flex-shrink-0 flex flex-col border-l border-slate-200 dark:border-[#252a3a] bg-white dark:bg-[#0d0f15] overflow-hidden">
          {/* Main tabs */}
          <div className="flex border-b border-slate-200 dark:border-[#252a3a]">
            {(['manipulados', 'industrializado'] as MainTab[]).map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => { setMainTab(tab); setPanelSearch(''); }}
                className={`flex-1 px-3 py-2.5 text-xs font-bold uppercase tracking-wide transition-colors ${
                  mainTab === tab
                    ? 'text-teal-600 dark:text-teal-400 border-b-2 border-teal-600 dark:border-teal-400'
                    : 'text-slate-400 dark:text-[#565d73] hover:text-slate-600 dark:hover:text-gray-300'
                }`}
              >
                {tab === 'manipulados' ? 'MANIPULADOS' : 'INDUSTRIALIZADO'}
              </button>
            ))}
          </div>

          {/* Sub tabs — only for manipulados */}
          {mainTab === 'manipulados' && (
            <div className="flex gap-1 px-3 py-2 border-b border-slate-100 dark:border-[#1e2334]">
              {(['formulas', 'protocolos', 'substancias'] as SubTab[]).map(st => (
                <button
                  key={st}
                  type="button"
                  onClick={() => { setSubTab(st); setPanelSearch(''); }}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors ${
                    subTab === st
                      ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300'
                      : 'text-slate-400 dark:text-[#565d73] hover:bg-slate-100 dark:hover:bg-white/5'
                  }`}
                >
                  {st === 'formulas' ? 'FÓRMULAS' : st === 'protocolos' ? 'PROTOCOLOS' : 'SUBSTÂNCIAS'}
                </button>
              ))}
            </div>
          )}

          {/* Search */}
          <div className="px-3 py-2 border-b border-slate-100 dark:border-[#1e2334]">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={panelSearch}
                onChange={e => setPanelSearch(e.target.value)}
                placeholder="Buscar..."
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 dark:border-[#252a3a] rounded-lg bg-white dark:bg-[#141722] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-400"
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
              <p className="text-xs text-slate-400 dark:text-[#565d73] text-center py-6 px-3">
                Nenhum item encontrado.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-gray-800">
                {panelItems.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleItemSelect(item)}
                    className="w-full text-left px-4 py-2.5 flex items-center gap-2 hover:bg-teal-50 dark:hover:bg-teal-900/10 transition-colors group"
                  >
                    <p className="flex-1 text-sm text-slate-700 dark:text-gray-200 truncate group-hover:text-teal-700 dark:group-hover:text-teal-300 transition-colors">
                      {item.name}
                    </p>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-gray-600 group-hover:text-teal-500 transition-colors shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
