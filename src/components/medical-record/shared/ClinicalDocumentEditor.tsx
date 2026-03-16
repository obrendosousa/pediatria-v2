'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { RichTextEditor } from '@/components/medical-record/attendance/RichTextEditor';
import {
  ArrowLeft, Loader2, ToggleLeft, ToggleRight, BookOpen,
  Eye, Printer, ChevronDown, Variable,
} from 'lucide-react';
import { createSchemaClient } from '@/lib/supabase/schemaClient';

const supabase = createSchemaClient('atendimento');

// ── Tipos ────────────────────────────────────────────────────

export type DocumentTemplate = {
  id: number;
  title: string;
  content: string | null;
};

export interface ClinicalDocumentEditorProps {
  // Conteúdo
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  showToolbar?: boolean;
  readOnly?: boolean;

  // Toggles opcionais
  showSignature?: boolean;
  showDateToggle?: boolean;

  // Templates
  templateType?: string;

  // Ações
  onSave?: () => void;
  onCancel?: () => void;
  saving?: boolean;

  // Título (opcional — evoluções não usam)
  showTitle?: boolean;
  title?: string;
  onTitleChange?: (v: string) => void;
  titlePlaceholder?: string;

  // Variáveis automáticas
  variables?: Record<string, string>;

  // Labels customizáveis
  headerLabel?: string;
  saveLabel?: string;
}

// ── Variáveis disponíveis ────────────────────────────────────

const AVAILABLE_VARIABLES = [
  { key: 'paciente_nome', label: 'Nome do paciente' },
  { key: 'paciente_idade', label: 'Idade do paciente' },
  { key: 'profissional_nome', label: 'Nome do profissional' },
  { key: 'data_atual', label: 'Data atual' },
];

function replaceVariables(html: string, variables: Record<string, string>): string {
  let result = html;
  for (const [key, val] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val);
  }
  return result;
}

// ── Componente Principal ─────────────────────────────────────

export function ClinicalDocumentEditor({
  value,
  onChange,
  placeholder = 'Digite o conteúdo...',
  showToolbar = true,
  readOnly = false,
  showSignature = false,
  showDateToggle = false,
  templateType,
  onSave,
  onCancel,
  saving = false,
  showTitle = false,
  title = '',
  onTitleChange,
  titlePlaceholder = 'Título do documento',
  variables,
  headerLabel,
  saveLabel = 'SALVAR',
}: ClinicalDocumentEditorProps) {
  // Estados internos
  const [digitalSignature, setDigitalSignature] = useState(false);
  const [showDate, setShowDate] = useState(false);
  const [docDate, setDocDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [previewMode, setPreviewMode] = useState(false);
  const [varDropdownOpen, setVarDropdownOpen] = useState(false);

  // Carregar templates quando templateType é fornecido
  useEffect(() => {
    if (!templateType) return;
    (async () => {
      const { data } = await supabase
        .from('clinical_templates')
        .select('id, title, content')
        .eq('template_type', templateType)
        .order('title');
      if (data) setTemplates(data as DocumentTemplate[]);
    })();
  }, [templateType]);

  const handleSelectTemplate = useCallback((t: DocumentTemplate) => {
    if (t.content) onChange(t.content);
  }, [onChange]);

  // Inserir variável no editor
  const insertVariable = (key: string) => {
    // Inserir no cursor via execCommand
    document.execCommand('insertText', false, `{{${key}}}`);
    setVarDropdownOpen(false);
  };

  // Preview com variáveis substituídas
  const previewHtml = variables ? replaceVariables(value, variables) : value;

  // Imprimir
  const handlePrint = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    const titleText = showTitle && title ? `<h1 style="font-size:18px;margin-bottom:12px;">${title}</h1>` : '';
    const dateText = showDate ? `<p style="font-size:12px;color:#666;margin-bottom:16px;">Data: ${docDate.split('-').reverse().join('/')}</p>` : '';
    const signatureText = digitalSignature ? '<p style="margin-top:40px;border-top:1px solid #ccc;padding-top:8px;font-size:12px;">Assinado digitalmente</p>' : '';
    win.document.write(`<!DOCTYPE html><html><head><title>Impressão</title><style>
      body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; font-size: 14px; line-height: 1.6; color: #333; }
      table { border-collapse: collapse; width: 100%; } td, th { border: 1px solid #ccc; padding: 6px 10px; }
      img { max-width: 100%; }
    </style></head><body>${titleText}${dateText}${previewHtml}${signatureText}</body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 300);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      {(headerLabel || onCancel) && (
        <div className="flex items-center gap-3">
          {onCancel && (
            <button onClick={onCancel} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-500" />
            </button>
          )}
          {headerLabel && (
            <h2 className="text-lg font-bold text-slate-800 dark:text-[#fafafa]">{headerLabel}</h2>
          )}
        </div>
      )}

      {/* Título + Toggles + Variáveis + Preview */}
      <div className="flex items-end gap-4 flex-wrap">
        {showTitle && onTitleChange && (
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-bold text-slate-600 dark:text-[#a1a1aa] mb-1 block">Título</label>
            <input
              type="text"
              value={title}
              onChange={e => onTitleChange(e.target.value)}
              placeholder={titlePlaceholder}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-[#2e2e33] rounded-lg bg-white dark:bg-[#18181b] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
        )}

        {showSignature && (
          <button
            type="button"
            onClick={() => setDigitalSignature(prev => !prev)}
            className="flex items-center gap-2 text-sm text-slate-600 dark:text-[#a1a1aa] hover:text-slate-800 dark:hover:text-gray-200 transition-colors"
          >
            {digitalSignature
              ? <ToggleRight className="w-6 h-6 text-blue-500" />
              : <ToggleLeft className="w-6 h-6 text-slate-400" />
            }
            <span className="text-xs font-bold">Assinar digitalmente</span>
          </button>
        )}

        {showDateToggle && (
          <>
            <button
              type="button"
              onClick={() => setShowDate(prev => !prev)}
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
                <label className="text-xs font-bold text-slate-600 dark:text-[#a1a1aa] mb-1 block">Data</label>
                <input
                  type="date"
                  value={docDate}
                  onChange={e => setDocDate(e.target.value)}
                  className="px-3 py-2 text-sm border border-slate-200 dark:border-[#2e2e33] rounded-lg bg-white dark:bg-[#18181b] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            )}
          </>
        )}

        {/* Botão inserir variável */}
        {variables && !readOnly && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setVarDropdownOpen(prev => !prev)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
            >
              <Variable className="w-3.5 h-3.5" />
              Variável
              <ChevronDown className="w-3 h-3" />
            </button>
            {varDropdownOpen && (
              <div className="absolute z-50 mt-1 w-52 bg-white dark:bg-[#18181b] border border-slate-200 dark:border-[#2e2e33] rounded-lg shadow-xl py-1">
                {AVAILABLE_VARIABLES.map(v => (
                  <button
                    key={v.key}
                    onClick={() => insertVariable(v.key)}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                  >
                    <span className="font-mono text-purple-600 dark:text-purple-400">{`{{${v.key}}}`}</span>
                    <span className="text-slate-400 ml-2">{v.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Botão preview */}
        {!readOnly && (
          <button
            type="button"
            onClick={() => setPreviewMode(prev => !prev)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-colors ${
              previewMode
                ? 'bg-blue-600 text-white'
                : 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            Preview
          </button>
        )}

        {/* Botão imprimir */}
        <button
          type="button"
          onClick={handlePrint}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-600 dark:text-[#a1a1aa] bg-slate-100 dark:bg-[#18181b] rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
        >
          <Printer className="w-3.5 h-3.5" />
          Imprimir
        </button>
      </div>

      {/* Editor + Painel de modelos */}
      <div className="flex gap-4">
        <div className="flex-1 min-w-0">
          {previewMode ? (
            // Preview mode — renderiza HTML com variáveis substituídas
            <div className="border border-slate-200 dark:border-[#2e2e33] rounded-lg bg-white dark:bg-[#0a0a0c] min-h-[400px] p-8 shadow-inner">
              <div className="max-w-[700px] mx-auto bg-white dark:bg-[#0a0a0c] border border-slate-100 dark:border-[#27272a] rounded-lg p-8 shadow-sm"
                style={{ minHeight: '500px', fontFamily: 'Arial, sans-serif', fontSize: '14px', lineHeight: '1.6' }}
              >
                {showTitle && title && (
                  <h1 className="text-lg font-bold text-slate-800 dark:text-[#fafafa] mb-3">{title}</h1>
                )}
                {showDate && (
                  <p className="text-xs text-slate-400 mb-4">Data: {docDate.split('-').reverse().join('/')}</p>
                )}
                <div
                  className="prose prose-sm dark:prose-invert max-w-none text-slate-700 dark:text-gray-200"
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
                {digitalSignature && (
                  <p className="mt-10 pt-2 border-t border-slate-200 dark:border-[#2e2e33] text-xs text-slate-400">
                    Assinado digitalmente
                  </p>
                )}
              </div>
            </div>
          ) : (
            <RichTextEditor
              value={value}
              onChange={onChange}
              placeholder={placeholder}
              readOnly={readOnly}
              showToolbar={showToolbar}
              className="min-h-[400px]"
            />
          )}
        </div>

        {/* Painel de modelos (quando templateType fornecido) */}
        {templateType && templates.length > 0 && !readOnly && (
          <DocumentTemplatePanel
            templates={templates}
            onSelect={handleSelectTemplate}
            title="Modelos"
          />
        )}
        {templateType && templates.length === 0 && !readOnly && (
          <DocumentTemplatePanel
            templates={[]}
            onSelect={handleSelectTemplate}
            title="Modelos"
          />
        )}
      </div>

      {/* Botões de ação */}
      {(onSave || onCancel) && !readOnly && (
        <div className="flex items-center gap-3 pt-2">
          {onSave && (
            <button
              onClick={onSave}
              disabled={saving}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-md transition-all active:scale-95"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saveLabel}
            </button>
          )}
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-600 dark:text-[#a1a1aa] bg-slate-100 dark:bg-[#18181b] hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
            >
              CANCELAR
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Painel Lateral de Modelos ─────────────────────────────────

function DocumentTemplatePanel({ templates, onSelect, title }: {
  templates: DocumentTemplate[];
  onSelect: (t: DocumentTemplate) => void;
  title: string;
}) {
  if (templates.length === 0) {
    return (
      <div className="w-64 shrink-0 bg-slate-50 dark:bg-[#16171c] rounded-xl border border-slate-200 dark:border-[#2e2e33] p-4">
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
    <div className="w-64 shrink-0 bg-slate-50 dark:bg-[#16171c] rounded-xl border border-slate-200 dark:border-[#2e2e33] p-4 overflow-y-auto max-h-[500px]">
      <div className="flex items-center gap-2 mb-3">
        <BookOpen className="w-4 h-4 text-slate-400" />
        <h3 className="text-xs font-extrabold text-slate-500 dark:text-[#a1a1aa] uppercase">{title}</h3>
      </div>
      <div className="space-y-2">
        {templates.map(tmpl => (
          <button
            key={tmpl.id}
            onClick={() => onSelect(tmpl)}
            className="w-full text-left p-3 rounded-lg bg-white dark:bg-[#0a0a0c] border border-slate-200 dark:border-[#2e2e33] hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-sm transition-all group"
          >
            <p className="text-xs font-bold text-slate-700 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate">
              {tmpl.title}
            </p>
            {tmpl.content && (
              <p className="text-[10px] text-slate-400 dark:text-[#71717a] mt-1 line-clamp-2">
                {tmpl.content.replace(/<[^>]*>/g, ' ').slice(0, 80)}
              </p>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
