'use client';

import React from 'react';
import { RichTextEditor } from '@/components/medical-record/attendance/RichTextEditor';
import {
  ArrowLeft, Loader2, ToggleLeft, ToggleRight, BookOpen
} from 'lucide-react';

// ── Tipos ────────────────────────────────────────────────────

export type DocumentTemplate = {
  id: number;
  title: string;
  content: string | null;
};

export interface ClinicalDocumentEditorProps {
  // Cabeçalho
  mode: 'create' | 'edit';
  createLabel: string;
  editLabel: string;
  onBack: () => void;

  // Campo título (opcional — evoluções não usam)
  showTitle?: boolean;
  title?: string;
  onTitleChange?: (v: string) => void;
  titlePlaceholder?: string;

  // Toggle assinar digitalmente
  digitalSignature: boolean;
  onDigitalSignatureChange: (v: boolean) => void;

  // Toggle mostrar data
  showDate: boolean;
  onShowDateChange: (v: boolean) => void;
  date: string;
  onDateChange: (v: string) => void;
  dateLabel?: string;

  // Editor de conteúdo
  content: string;
  onContentChange: (v: string) => void;
  contentPlaceholder?: string;

  // Painel de modelos
  templates: DocumentTemplate[];
  onSelectTemplate: (t: DocumentTemplate) => void;
  templatePanelTitle?: string;

  // Ações
  saving: boolean;
  onSave: () => void;
  saveIcon?: React.ElementType;
}

// ── Componente Principal ─────────────────────────────────────

export function ClinicalDocumentEditor({
  mode,
  createLabel,
  editLabel,
  onBack,
  showTitle = false,
  title = '',
  onTitleChange,
  titlePlaceholder = 'Título do documento',
  digitalSignature,
  onDigitalSignatureChange,
  showDate,
  onShowDateChange,
  date,
  onDateChange,
  dateLabel = 'Data',
  content,
  onContentChange,
  contentPlaceholder = 'Digite o conteúdo...',
  templates,
  onSelectTemplate,
  templatePanelTitle = 'Modelos',
  saving,
  onSave,
  saveIcon: SaveIcon,
}: ClinicalDocumentEditorProps) {
  return (
    <div className="p-6 space-y-4">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-500" />
        </button>
        <h2 className="text-lg font-bold text-slate-800 dark:text-[#fafafa]">
          {mode === 'create' ? createLabel : editLabel}
        </h2>
      </div>

      {/* Título (opcional) + Toggles + Data */}
      <div className="flex items-end gap-6 flex-wrap">
        {showTitle && onTitleChange && (
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-bold text-slate-600 dark:text-[#a1a1aa] mb-1 block">Título</label>
            <input
              type="text"
              value={title}
              onChange={e => onTitleChange(e.target.value)}
              placeholder={titlePlaceholder}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-[#3d3d48] rounded-lg bg-white dark:bg-[#1c1c21] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
        )}

        <button
          type="button"
          onClick={() => onDigitalSignatureChange(!digitalSignature)}
          className="flex items-center gap-2 text-sm text-slate-600 dark:text-[#a1a1aa] hover:text-slate-800 dark:hover:text-gray-200 transition-colors"
        >
          {digitalSignature
            ? <ToggleRight className="w-6 h-6 text-blue-500" />
            : <ToggleLeft className="w-6 h-6 text-slate-400" />
          }
          <span className="text-xs font-bold">Assinar digitalmente</span>
        </button>

        <button
          type="button"
          onClick={() => onShowDateChange(!showDate)}
          className="flex items-center gap-2 text-sm text-slate-600 dark:text-[#a1a1aa] hover:text-slate-800 dark:hover:text-gray-200 transition-colors"
        >
          {showDate
            ? <ToggleRight className="w-6 h-6 text-blue-500" />
            : <ToggleLeft className="w-6 h-6 text-slate-400" />
          }
          <span className="text-xs font-bold">Mostrar data</span>
        </button>

        {showDate && (
          <div>
            <label className="text-xs font-bold text-slate-600 dark:text-[#a1a1aa] mb-1 block">{dateLabel}</label>
            <input
              type="date"
              value={date}
              onChange={e => onDateChange(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 dark:border-[#3d3d48] rounded-lg bg-white dark:bg-[#1c1c21] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
        )}
      </div>

      {/* Editor + Painel de modelos */}
      <div className="flex gap-4">
        <div className="flex-1 min-w-0">
          <label className="text-xs font-bold text-slate-600 dark:text-[#a1a1aa] mb-1 block">Conteúdo</label>
          <RichTextEditor
            value={content}
            onChange={onContentChange}
            placeholder={contentPlaceholder}
            className="min-h-[400px]"
          />
        </div>

        <DocumentTemplatePanel
          templates={templates}
          onSelect={onSelectTemplate}
          title={templatePanelTitle}
        />
      </div>

      {/* Botões */}
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={onSave}
          disabled={saving}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-md transition-all active:scale-95"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : SaveIcon ? <SaveIcon className="w-4 h-4" /> : null}
          SALVAR
        </button>
        <button
          onClick={onBack}
          className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-600 dark:text-[#a1a1aa] bg-slate-100 dark:bg-[#1c1c21] hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
        >
          CANCELAR
        </button>
      </div>
    </div>
  );
}

// ── Painel Lateral de Modelos (reutilizável) ─────────────────

function DocumentTemplatePanel({ templates, onSelect, title }: {
  templates: DocumentTemplate[];
  onSelect: (t: DocumentTemplate) => void;
  title: string;
}) {
  if (templates.length === 0) {
    return (
      <div className="w-64 shrink-0 bg-slate-50 dark:bg-[#16171c] rounded-xl border border-slate-200 dark:border-[#3d3d48] p-4">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="w-4 h-4 text-slate-400" />
          <h3 className="text-xs font-extrabold text-slate-500 dark:text-[#a1a1aa] uppercase">{title}</h3>
        </div>
        <p className="text-xs text-slate-400 dark:text-[#71717a] text-center py-6">
          Nenhum modelo cadastrado.
        </p>
      </div>
    );
  }

  return (
    <div className="w-64 shrink-0 bg-slate-50 dark:bg-[#16171c] rounded-xl border border-slate-200 dark:border-[#3d3d48] p-4 overflow-y-auto max-h-[500px]">
      <div className="flex items-center gap-2 mb-3">
        <BookOpen className="w-4 h-4 text-slate-400" />
        <h3 className="text-xs font-extrabold text-slate-500 dark:text-[#a1a1aa] uppercase">{title}</h3>
      </div>
      <div className="space-y-2">
        {templates.map(tmpl => (
          <button
            key={tmpl.id}
            onClick={() => onSelect(tmpl)}
            className="w-full text-left p-3 rounded-lg bg-white dark:bg-[#08080b] border border-slate-200 dark:border-[#3d3d48] hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-sm transition-all group"
          >
            <p className="text-xs font-bold text-slate-700 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate">
              {tmpl.title}
            </p>
            {tmpl.content && (
              <p className="text-[10px] text-slate-400 dark:text-[#71717a] mt-1 line-clamp-2" dangerouslySetInnerHTML={{ __html: tmpl.content.replace(/<[^>]*>/g, ' ').slice(0, 80) }} />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
