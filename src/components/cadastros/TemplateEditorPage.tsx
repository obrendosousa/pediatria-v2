'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus, Trash2, ClipboardList, ArrowLeft, Save, Loader2,
} from 'lucide-react';
import DataTable from '@/components/cadastros/DataTable';
import type { SortDirection } from '@/components/cadastros/DataTable';
import RichTextEditor from '@/components/cadastros/RichTextEditor';
import type { TemplateVariable } from '@/components/cadastros/RichTextEditor';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';

// --- Tipos ---

export interface TemplateRecord {
  id: string;
  name: string;
  content: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  status?: string;
}

export interface TemplateHook<T extends TemplateRecord> {
  templates: T[];
  totalCount: number;
  loading: boolean;
  saving: boolean;
  listTemplates: (
    search: string,
    page: number,
    pageSize: number,
    sort?: { key: string; direction: SortDirection },
    onlyMine?: string,
  ) => Promise<void>;
  getTemplate: (id: string) => Promise<T>;
  createTemplate: (input: { name: string; content: string }) => Promise<T>;
  updateTemplate: (id: string, input: Partial<{ name: string; content: string }>) => Promise<T>;
  deleteTemplate: (id: string) => Promise<void>;
}

// --- Variáveis padrão ---

const TEMPLATE_VARIABLES: TemplateVariable[] = [
  { key: 'PACIENTE', label: 'Paciente', description: 'Nome completo do paciente' },
  { key: 'CPF', label: 'CPF', description: 'CPF do paciente' },
  { key: 'NASCIMENTO', label: 'Nascimento', description: 'Data nascimento do paciente' },
  { key: 'RG', label: 'RG', description: 'RG do paciente' },
  { key: 'IDADE', label: 'Idade', description: 'Idade do paciente' },
  { key: 'ENDEREÇO_PACIENTE', label: 'Endereço', description: 'Endereço do paciente' },
  { key: 'DATA', label: 'Data', description: 'Data atual' },
];

// --- Styles ---

const inputClass =
  'w-full px-3 py-2.5 text-sm border border-slate-200 dark:border-[#3d3d48] rounded-xl bg-white dark:bg-[#1c1c21] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-400 disabled:opacity-50';

const labelClass =
  'text-xs font-bold text-slate-500 dark:text-[#a1a1aa] mb-1.5 ml-1 block uppercase tracking-wider';

function RequiredBadge() {
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 ml-1">
      Obrigatório
    </span>
  );
}

// ==================================================================
// Listing Page
// ==================================================================

interface TemplateListPageProps<T extends TemplateRecord> {
  hook: TemplateHook<T>;
  pageTitle: string;
  basePath: string;
  entityName: string;
  icon?: React.ReactNode;
}

export function TemplateListPage<T extends TemplateRecord>({
  hook,
  pageTitle,
  basePath,
  entityName,
  icon,
}: TemplateListPageProps<T>) {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const { templates, totalCount, loading, listTemplates, deleteTemplate } = hook;

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [sort, setSort] = useState<{ key: string; direction: SortDirection } | undefined>();
  const [onlyMine, setOnlyMine] = useState(false);

  const fetch = useCallback(() => {
    listTemplates(
      searchTerm,
      page,
      pageSize,
      sort,
      onlyMine ? user?.id : undefined,
    ).catch(() => {
      toast.error(`Erro ao buscar ${entityName}.`);
    });
  }, [listTemplates, searchTerm, page, pageSize, sort, onlyMine, user?.id, toast, entityName]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const handleDelete = useCallback(async (row: T) => {
    if (!confirm(`Deseja excluir "${row.name}"?`)) return;
    try {
      await deleteTemplate(row.id);
      toast.success('Modelo excluído.');
      fetch();
    } catch {
      toast.error('Erro ao excluir modelo.');
    }
  }, [deleteTemplate, toast, fetch]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-[#3d3d48] bg-white dark:bg-[#08080b]">
        <div className="flex items-center gap-2">
          {icon || <ClipboardList className="w-5 h-5 text-teal-600" />}
          <h1 className="text-lg font-bold text-slate-800 dark:text-[#fafafa]">{pageTitle}</h1>
        </div>
        <div className="flex items-center gap-3">
          {/* Toggle Meus Modelos */}
          <button
            type="button"
            onClick={() => { setOnlyMine(prev => !prev); setPage(0); }}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
              onlyMine
                ? 'bg-teal-50 dark:bg-teal-900/20 border-teal-300 dark:border-teal-700 text-teal-700 dark:text-teal-300'
                : 'bg-white dark:bg-[#1c1c21] border-slate-200 dark:border-[#3d3d48] text-slate-600 dark:text-[#a1a1aa] hover:bg-slate-50 dark:hover:bg-white/5'
            }`}
          >
            <span className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              onlyMine ? 'bg-teal-600' : 'bg-slate-300 dark:bg-gray-600'
            }`}>
              <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform shadow-sm ${
                onlyMine ? 'translate-x-[18px]' : 'translate-x-[3px]'
              }`} />
            </span>
            Meus modelos
          </button>

          <button
            onClick={() => router.push(`${basePath}/criar`)}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-bold shadow-md transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            ADICIONAR MODELO
          </button>
        </div>
      </div>

      {/* Table */}
      <DataTable<T & { id: string; status?: string }>
        columns={[
          { key: 'name' as keyof T & string, label: 'Nome', sortable: true },
          {
            key: 'created_at' as keyof T & string,
            label: 'Data',
            sortable: true,
            render: (value) => {
              if (!value) return '—';
              return new Date(String(value)).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              });
            },
          },
        ]}
        data={templates as (T & { id: string; status?: string })[]}
        loading={loading}
        searchPlaceholder={`Buscar ${entityName}...`}
        onSearch={(term) => { setSearchTerm(term); setPage(0); }}
        onSort={(key, direction) => setSort({ key, direction })}
        pagination={{ page, pageSize, total: totalCount }}
        onPageChange={(p, size) => { setPage(p); setPageSize(size); }}
        actions={[
          { icon: 'eye', label: 'Visualizar', onClick: (row) => router.push(`${basePath}/${row.id}`) },
          { icon: 'edit', label: 'Editar', onClick: (row) => router.push(`${basePath}/${row.id}`) },
        ]}
        menuActions={(row) => [
          {
            icon: <Trash2 className="w-4 h-4" />,
            label: 'Excluir',
            onClick: () => handleDelete(row),
            className: 'text-red-500 dark:text-red-400',
          },
        ]}
        emptyMessage={`Nenhum modelo de ${entityName} cadastrado.`}
      />
    </div>
  );
}

// ==================================================================
// Form Page (create / edit)
// ==================================================================

interface TemplateFormPageProps {
  initialData?: TemplateRecord | null;
  onSubmit: (data: { name: string; content: string }) => Promise<void>;
  title: string;
  subtitle: string;
  backPath: string;
  icon?: React.ReactNode;
  extended?: boolean;
  hideVariables?: boolean;
}

export function TemplateFormPage({
  initialData,
  onSubmit,
  title,
  subtitle,
  backPath,
  icon,
  extended = false,
  hideVariables = false,
}: TemplateFormPageProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [name, setName] = useState(initialData?.name ?? '');
  const [content, setContent] = useState(initialData?.content ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

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
      toast.error('Erro ao salvar modelo.');
    } finally {
      setSaving(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, content, onSubmit, toast]);

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-[#15171e]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-[#3d3d48] bg-white dark:bg-[#08080b]">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push(backPath)}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-500 dark:text-[#a1a1aa]" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-slate-800 dark:text-[#fafafa] flex items-center gap-2">
              {icon || <ClipboardList className="w-5 h-5 text-teal-600" />}
              {title}
            </h1>
            <p className="text-xs text-slate-400 dark:text-[#71717a]">{subtitle}</p>
          </div>
        </div>
      </div>

      {/* Body */}
      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="bg-white dark:bg-[#08080b] rounded-2xl border border-slate-200 dark:border-[#3d3d48] p-6 space-y-4">
            {/* Nome */}
            <div>
              <label className={labelClass}>
                Nome <RequiredBadge />
              </label>
              <input
                type="text"
                value={name}
                onChange={e => { setName(e.target.value); setErrors(prev => { const n = { ...prev }; delete n.name; return n; }); }}
                placeholder="Nome do modelo"
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
                placeholder="Digite o conteúdo do modelo..."
                extended={extended}
                variables={hideVariables ? undefined : TEMPLATE_VARIABLES}
              />
              {errors.content && <p className="mt-1 text-xs text-red-500">{errors.content}</p>}
            </div>
          </div>
        </div>
      </form>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-slate-200 dark:border-[#3d3d48] bg-white dark:bg-[#08080b] flex justify-end">
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
