'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Save, Loader2, FileSignature } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { useDocumentTemplates } from '@/hooks/useDocumentTemplates';
import RichTextEditor from '@/components/cadastros/RichTextEditor';
import type { TemplateVariable } from '@/components/cadastros/RichTextEditor';
const TEMPLATE_VARIABLES: TemplateVariable[] = [
  { key: 'PACIENTE', label: 'Paciente', description: 'Nome completo do paciente' },
  { key: 'CPF', label: 'CPF', description: 'CPF do paciente' },
  { key: 'NASCIMENTO', label: 'Nascimento', description: 'Data nascimento do paciente' },
  { key: 'RG', label: 'RG', description: 'RG do paciente' },
  { key: 'IDADE', label: 'Idade', description: 'Idade do paciente' },
  { key: 'ENDEREÇO_PACIENTE', label: 'Endereço', description: 'Endereço do paciente' },
  { key: 'DATA', label: 'Data', description: 'Data atual' },
];

const inputClass =
  'w-full px-3 py-2.5 text-sm border border-slate-200 dark:border-[#252530] rounded-xl bg-white dark:bg-[#1a1a22] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50';

const labelClass =
  'text-xs font-bold text-slate-500 dark:text-[#a1a1aa] mb-1.5 ml-1 block uppercase tracking-wider';

function RequiredBadge() {
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 ml-1">
      Obrigatório
    </span>
  );
}

export default function EditarDocumentoPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { getTemplate, updateTemplate } = useDocumentTemplates();

  const [loadingData, setLoadingData] = useState(true);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const id = params.id as string;

  useEffect(() => {
    (async () => {
      try {
        const data = await getTemplate(id);
        setTitle(data.title);
        setContent(data.content);
        setIsDefault(data.is_default);
      } catch {
        toast.error('Documento não encontrado.');
        router.push('/atendimento/cadastros/documentos');
      } finally {
        setLoadingData(false);
      }
    })();
  }, [id, getTemplate, toast, router]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!title.trim()) errs.title = 'Título é obrigatório.';
    if (!content.trim() || content === '<p></p>') errs.content = 'Conteúdo é obrigatório.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      await updateTemplate(id, {
        title: title.trim(),
        content,
        is_default: isDefault,
      });
      toast.success('Documento atualizado com sucesso!');
      router.push('/atendimento/cadastros/documentos');
    } catch {
      toast.error('Erro ao salvar documento.');
    } finally {
      setSaving(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, content, isDefault, updateTemplate, id, toast, router]);

  if (loadingData) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-[#15171e]">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-[#15171e]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-[#252530] bg-white dark:bg-[#111118]">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push('/atendimento/cadastros/documentos')}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-500 dark:text-[#a1a1aa]" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-slate-800 dark:text-[#fafafa] flex items-center gap-2">
              <FileSignature className="w-5 h-5 text-blue-600" />
              Editar Documento
            </h1>
            <p className="text-xs text-slate-400 dark:text-[#71717a]">Atualize o modelo de documento</p>
          </div>
        </div>
      </div>

      {/* Body */}
      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="bg-white dark:bg-[#111118] rounded-2xl border border-slate-200 dark:border-[#252530] p-6 space-y-4">
            {/* Título */}
            <div>
              <label className={labelClass}>
                Título <RequiredBadge />
              </label>
              <input
                type="text"
                value={title}
                onChange={e => { setTitle(e.target.value); setErrors(prev => { const n = { ...prev }; delete n.title; return n; }); }}
                placeholder="Ex: Termo de consentimento"
                autoFocus
                className={`${inputClass} ${errors.title ? '!border-red-300 dark:!border-red-700 !ring-red-400' : ''}`}
              />
              {errors.title && <p className="mt-1 text-xs text-red-500">{errors.title}</p>}
            </div>

            {/* Toggle padrão */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsDefault(prev => !prev)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  isDefault ? 'bg-blue-600' : 'bg-slate-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white transition-transform shadow-sm ${
                    isDefault ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className="text-sm text-slate-700 dark:text-gray-200">
                Definir como padrão
              </span>
            </div>

            {/* Editor */}
            <div>
              <label className={labelClass}>
                Conteúdo <RequiredBadge />
              </label>
              <RichTextEditor
                value={content}
                onChange={val => { setContent(val); setErrors(prev => { const n = { ...prev }; delete n.content; return n; }); }}
                placeholder="Digite o conteúdo do documento..."
                variables={TEMPLATE_VARIABLES}
              />
              {errors.content && <p className="mt-1 text-xs text-red-500">{errors.content}</p>}
            </div>
          </div>
        </div>
      </form>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-slate-200 dark:border-[#252530] bg-white dark:bg-[#111118] flex justify-end">
        <button
          type="submit"
          disabled={saving}
          onClick={handleSubmit}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-bold shadow-md transition-all active:scale-95"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          SALVAR INFORMAÇÕES
        </button>
      </div>
    </div>
  );
}
