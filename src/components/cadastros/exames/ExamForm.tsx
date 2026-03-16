'use client';

import { useEffect, useState, useCallback } from 'react';
import { ArrowLeft, Save, Loader2, FlaskConical, Search, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/contexts/ToastContext';
import RichTextEditor from '@/components/cadastros/RichTextEditor';
import { useExamTemplates } from '@/hooks/useExamTemplates';
import type { ExamTemplate, ExamCategory } from '@/types/cadastros';

// --- Tipos ---

export interface ExamFormData {
  name: string;
  content: string;
}

interface ExamFormProps {
  initialData?: ExamTemplate | null;
  onSubmit: (data: ExamFormData) => Promise<void>;
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

// --- Componente ---

export default function ExamForm({
  initialData,
  onSubmit,
  title,
  subtitle,
}: ExamFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { listCategories, categories } = useExamTemplates();
  const [name, setName] = useState(initialData?.name ?? '');
  const [content, setContent] = useState(initialData?.content ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');

  useEffect(() => {
    listCategories().catch(() => {});
  }, [listCategories]);

  const filteredCategories = categories.filter(c =>
    c.name.toLowerCase().includes(categorySearch.toLowerCase()),
  );

  const handleInsertCategory = useCallback((cat: ExamCategory) => {
    // Append the category name as a bold line in the editor content
    const insertion = `<p><strong>${cat.name}</strong></p>`;
    setContent(prev => {
      // If content is empty or just empty paragraph, replace it
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
      toast.error('Erro ao salvar modelo de exame.');
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
            onClick={() => router.push('/atendimento/cadastros/modelos/exames')}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-500 dark:text-[#828ca5]" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-slate-800 dark:text-[#e8ecf4] flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-teal-600" />
              {title}
            </h1>
            <p className="text-xs text-slate-400 dark:text-[#565d73]">{subtitle}</p>
          </div>
        </div>
      </div>

      {/* Body - 2 columns */}
      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        <div className="max-w-6xl mx-auto flex gap-6">
          {/* Left column: Form */}
          <div className="flex-1 min-w-0 space-y-4">
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
                  placeholder="Nome do modelo de exame"
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
                  placeholder="Digite o conteúdo do modelo de exame..."
                />
                {errors.content && <p className="mt-1 text-xs text-red-500">{errors.content}</p>}
              </div>
            </div>
          </div>

          {/* Right column: Category panel */}
          <div className="w-72 shrink-0">
            <div className="bg-white dark:bg-[#0d0f15] rounded-2xl border border-slate-200 dark:border-[#252a3a] overflow-hidden sticky top-0">
              {/* Panel header */}
              <div className="px-4 py-3 border-b border-slate-200 dark:border-[#252a3a] bg-slate-50 dark:bg-[#141722]">
                <h3 className="text-sm font-extrabold text-slate-700 dark:text-gray-200 uppercase tracking-wide">
                  Tipos de pedidos
                </h3>
              </div>

              {/* Search */}
              <div className="px-4 py-3 border-b border-slate-100 dark:border-[#1e2334]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={categorySearch}
                    onChange={e => setCategorySearch(e.target.value)}
                    placeholder="Buscar categoria..."
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 dark:border-[#252a3a] rounded-lg bg-white dark:bg-[#141722] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-400"
                  />
                </div>
              </div>

              {/* Category list */}
              <div className="max-h-[calc(100vh-340px)] overflow-y-auto custom-scrollbar">
                {filteredCategories.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-slate-400 dark:text-[#565d73] text-center">
                    Nenhuma categoria encontrada.
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-100 dark:divide-gray-800">
                    {filteredCategories.map(cat => (
                      <li key={cat.id}>
                        <button
                          type="button"
                          onClick={() => handleInsertCategory(cat)}
                          className="w-full text-left px-4 py-3 text-sm text-slate-700 dark:text-gray-200 hover:bg-teal-50 dark:hover:bg-teal-900/20 hover:text-teal-700 dark:hover:text-teal-300 transition-colors flex items-center gap-2"
                        >
                          <Plus className="w-3.5 h-3.5 text-teal-500 shrink-0" />
                          <span>{cat.name}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
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
