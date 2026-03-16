'use client';

import { useEffect, useState, useCallback } from 'react';
import { ArrowLeft, Save, Loader2, Pill } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/contexts/ToastContext';
import RichTextEditor from '@/components/cadastros/RichTextEditor';
import SidePanelSelector from '@/components/cadastros/shared/SidePanelSelector';
import type { SidePanelItem } from '@/components/cadastros/shared/SidePanelSelector';
import { useFormulas } from '@/hooks/useFormulas';
import { usePrescriptionProtocols } from '@/hooks/usePrescriptionProtocols';
import { useSubstances } from '@/hooks/useSubstances';
import { useMedications } from '@/hooks/useMedications';
import type { RecipeTemplate } from '@/types/cadastros';

// --- Tipos ---

export interface RecipeFormData {
  name: string;
  content: string;
}

interface RecipeFormProps {
  initialData?: RecipeTemplate | null;
  onSubmit: (data: RecipeFormData) => Promise<void>;
  title: string;
  subtitle: string;
}

// --- Styles ---

const inputClass =
  'w-full px-3 py-2.5 text-sm border border-slate-200 dark:border-[#252a3a] rounded-xl bg-white dark:bg-[#141722] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-400 disabled:opacity-50';

const labelClass =
  'text-xs font-bold text-slate-500 dark:text-[#828ca5] mb-1.5 ml-1 block uppercase tracking-wider';

function RequiredBadge() {
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 ml-1">
      Obrigatório
    </span>
  );
}

// --- Tabs ---

const MAIN_TABS = [
  { key: 'manipulados', label: 'Manipulados' },
  { key: 'industrializado', label: 'Industrializado' },
];

const SUB_TABS = [
  { key: 'formulas', label: 'Fórmulas' },
  { key: 'protocolos', label: 'Protocolos' },
  { key: 'substancias', label: 'Substâncias' },
];

// --- Componente ---

export default function RecipeForm({
  initialData,
  onSubmit,
  title,
  subtitle,
}: RecipeFormProps) {
  const router = useRouter();
  const { toast } = useToast();

  const { formulas, listFormulas } = useFormulas();
  const { protocols, listProtocols } = usePrescriptionProtocols();
  const { substances, listSubstances } = useSubstances();
  const { medications, listMedications } = useMedications();

  const [name, setName] = useState(initialData?.name ?? '');
  const [content, setContent] = useState(initialData?.content ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('manipulados');

  // Load side panel data
  useEffect(() => {
    listFormulas('', 0, 200).catch(() => {});
    listProtocols('', 0, 200).catch(() => {});
    listSubstances('', 0, 500).catch(() => {});
    listMedications('', 0, 200).catch(() => {});
  }, [listFormulas, listProtocols, listSubstances, listMedications]);

  // Build side panel items based on active tab
  const panelItems: SidePanelItem[] = (() => {
    if (activeTab === 'manipulados') {
      // Manipulados: formulas, protocols, substances
      return [
        ...formulas.map(f => ({ id: f.id, name: f.name, category: 'manipulados' })),
        ...protocols.map(p => ({ id: p.id, name: p.name, category: 'manipulados' })),
        ...substances.map(s => ({ id: s.id, name: s.name, category: 'manipulados' })),
      ];
    }
    // Industrializado: medications
    return medications.map(m => ({
      id: m.id,
      name: m.description,
      description: m.presentation,
      category: 'industrializado',
    }));
  })();

  const handleSelect = useCallback((item: SidePanelItem) => {
    const insertion = `<p>${item.name}</p>`;
    setContent(prev => {
      if (!prev || prev === '<p></p>') return insertion;
      return prev + insertion;
    });
  }, []);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Nome é obrigatório.';
    if (!content.trim() || content === '<p></p>') errs.content = 'Conteúdo é obrigatório.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      await onSubmit({ name: name.trim(), content });
    } catch {
      toast.error('Erro ao salvar modelo de receita.');
    } finally {
      setSaving(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, content, onSubmit, toast]);

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-[#15171e]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-[#252a3a] bg-white dark:bg-[#0d0f15]">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push('/atendimento/cadastros/modelos/receitas')}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-500 dark:text-[#828ca5]" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-slate-800 dark:text-[#e8ecf4] flex items-center gap-2">
              <Pill className="w-5 h-5 text-teal-600" />
              {title}
            </h1>
            <p className="text-xs text-slate-400 dark:text-[#565d73]">{subtitle}</p>
          </div>
        </div>
      </div>

      {/* Body - 2 columns */}
      <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex">
        {/* Left column: Form */}
        <div className="flex-1 min-w-0 overflow-y-auto p-6 custom-scrollbar">
          <div className="max-w-3xl space-y-4">
            <div className="bg-white dark:bg-[#0d0f15] rounded-2xl border border-slate-200 dark:border-[#252a3a] p-6 space-y-4">
              {/* Nome */}
              <div>
                <label className={labelClass}>
                  Nome <RequiredBadge />
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => { setName(e.target.value); setErrors(prev => { const n = { ...prev }; delete n.name; return n; }); }}
                  placeholder="Nome do modelo de receita"
                  autoFocus
                  className={`${inputClass} ${errors.name ? '!border-red-300 dark:!border-red-700 !ring-red-400' : ''}`}
                />
                {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
              </div>

              {/* Editor */}
              <div>
                <label className={labelClass}>
                  Conteúdo <RequiredBadge />
                </label>
                <RichTextEditor
                  value={content}
                  onChange={val => { setContent(val); setErrors(prev => { const n = { ...prev }; delete n.content; return n; }); }}
                  placeholder="Digite o conteúdo da receita..."
                />
                {errors.content && <p className="mt-1 text-xs text-red-500">{errors.content}</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Right column: Side panel */}
        <div className="w-80 shrink-0">
          {/* Custom tab switcher above the panel */}
          <div className="flex border-b border-slate-200 dark:border-[#252a3a] bg-white dark:bg-[#0d0f15]">
            {MAIN_TABS.map(tab => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 px-3 py-2.5 text-xs font-bold uppercase tracking-wide transition-colors ${
                  activeTab === tab.key
                    ? 'text-teal-600 dark:text-teal-400 border-b-2 border-teal-600 dark:border-teal-400'
                    : 'text-slate-400 dark:text-[#565d73] hover:text-slate-600 dark:hover:text-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <SidePanelSelector
            subTabs={activeTab === 'manipulados' ? SUB_TABS : undefined}
            items={panelItems}
            onSelect={handleSelect}
            searchPlaceholder="Buscar item..."
            emptyMessage="Nenhum item encontrado."
          />
        </div>
      </form>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-slate-200 dark:border-[#252a3a] bg-white dark:bg-[#0d0f15] flex justify-end">
        <button
          type="submit"
          disabled={saving}
          onClick={handleSubmit}
          className="flex items-center gap-2 px-6 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-lg text-sm font-bold shadow-md transition-all active:scale-95"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          SALVAR INFORMAÇÕES
        </button>
      </div>
    </div>
  );
}
