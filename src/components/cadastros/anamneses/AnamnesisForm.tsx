'use client';

import { useState, useCallback } from 'react';
import { ArrowLeft, Save, Loader2, ClipboardList } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/contexts/ToastContext';
import QuestionnaireBuilder from '@/components/cadastros/shared/QuestionnaireBuilder';
import type { QuestionItem } from '@/components/cadastros/shared/QuestionnaireBuilder';
import type { AnamnesisTemplate, AnamnesisQuestion } from '@/types/cadastros';

// --- Tipos ---

export interface AnamnesisFormData {
  title: string;
  allow_send_on_scheduling: boolean;
  questions: QuestionItem[];
}

interface AnamnesisFormProps {
  initialData?: AnamnesisTemplate | null;
  initialQuestions?: AnamnesisQuestion[];
  onSubmit: (data: AnamnesisFormData) => Promise<void>;
  title: string;
  subtitle: string;
}

// --- Helpers ---

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

function templateToForm(
  tpl: AnamnesisTemplate,
  questions: AnamnesisQuestion[],
): AnamnesisFormData {
  return {
    title: tpl.title,
    allow_send_on_scheduling: tpl.allow_send_on_scheduling,
    questions: questions.map(q => ({
      id: q.id,
      question: q.question,
      type: q.type,
      options: (q.options as string[]) || [],
    })),
  };
}

// --- Componente ---

export default function AnamnesisForm({
  initialData,
  initialQuestions,
  onSubmit,
  title,
  subtitle,
}: AnamnesisFormProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [form, setForm] = useState<AnamnesisFormData>(
    initialData && initialQuestions
      ? templateToForm(initialData, initialQuestions)
      : { title: '', allow_send_on_scheduling: false, questions: [] },
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.title.trim()) errs.title = 'Título é obrigatório.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      await onSubmit(form);
    } catch {
      toast.error('Erro ao salvar modelo de anamnese.');
    } finally {
      setSaving(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, onSubmit, toast]);

  const handleAddQuestion = useCallback((question: QuestionItem) => {
    setForm(prev => ({ ...prev, questions: [...prev.questions, question] }));
  }, []);

  const handleRemoveQuestion = useCallback((id: string) => {
    setForm(prev => ({ ...prev, questions: prev.questions.filter(q => q.id !== id) }));
  }, []);

  const handleReorderQuestions = useCallback((questions: QuestionItem[]) => {
    setForm(prev => ({ ...prev, questions }));
  }, []);

  const handleUpdateQuestion = useCallback((id: string, data: Partial<QuestionItem>) => {
    setForm(prev => ({
      ...prev,
      questions: prev.questions.map(q => (q.id === id ? { ...q, ...data } : q)),
    }));
  }, []);

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-[#15171e]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-[#252a3a] bg-white dark:bg-[#0d0f15]">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push('/atendimento/cadastros/modelos/anamneses')}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-500 dark:text-[#828ca5]" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-slate-800 dark:text-[#e8ecf4] flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-teal-600" />
              {title}
            </h1>
            <p className="text-xs text-slate-400 dark:text-[#565d73]">{subtitle}</p>
          </div>
        </div>
      </div>

      {/* Body */}
      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Título */}
          <div className="bg-white dark:bg-[#0d0f15] rounded-2xl border border-slate-200 dark:border-[#252a3a] p-6">
            <h3 className="text-sm font-extrabold text-slate-700 dark:text-gray-200 uppercase tracking-wide mb-4 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-teal-500" />
              Informações do Modelo
            </h3>

            <div className="space-y-4">
              <div>
                <label className={labelClass}>
                  Título <RequiredBadge />
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => {
                    setForm(prev => ({ ...prev, title: e.target.value }));
                    setErrors(prev => { const n = { ...prev }; delete n.title; return n; });
                  }}
                  placeholder="Ex: Anamnese primeira consulta"
                  autoFocus
                  className={`${inputClass} ${errors.title ? '!border-red-300 dark:!border-red-700 !ring-red-400' : ''}`}
                />
                {errors.title && <p className="mt-1 text-xs text-red-500">{errors.title}</p>}
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, allow_send_on_scheduling: !prev.allow_send_on_scheduling }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    form.allow_send_on_scheduling ? 'bg-teal-600' : 'bg-slate-300 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white transition-transform shadow-sm ${
                      form.allow_send_on_scheduling ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                <span className="text-sm text-slate-700 dark:text-gray-200">
                  Permitir Envio ao Realizar Agendamento
                </span>
              </div>
            </div>
          </div>

          {/* Questionário */}
          <div className="bg-white dark:bg-[#0d0f15] rounded-2xl border border-slate-200 dark:border-[#252a3a] p-6">
            <h3 className="text-sm font-extrabold text-slate-700 dark:text-gray-200 uppercase tracking-wide mb-4">
              Questionário
            </h3>

            <QuestionnaireBuilder
              questions={form.questions}
              onAdd={handleAddQuestion}
              onRemove={handleRemoveQuestion}
              onReorder={handleReorderQuestions}
              onUpdate={handleUpdateQuestion}
            />
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
