'use client';

import React, { useRef, useEffect, useState } from 'react';
import {
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered, Undo2, Redo2, Table, ImageIcon,
} from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  readOnly?: boolean;
  showToolbar?: boolean;
  onSaveModel?: () => void;
  onUseModel?: () => void;
  modelType?: string;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Digite aqui...',
  className = '',
  readOnly = false,
  showToolbar = true,
  onSaveModel,
  onUseModel,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value]);

  const execCmd = (command: string, val?: string) => {
    document.execCommand(command, false, val);
    editorRef.current?.focus();
    saveToHistory();
  };

  const saveToHistory = () => {
    if (editorRef.current) {
      const currentContent = editorRef.current.innerHTML;
      setHistory(prev => {
        const newHistory = prev.slice(0, historyIndex + 1);
        newHistory.push(currentContent);
        return newHistory.slice(-50);
      });
      setHistoryIndex(prev => Math.min(prev + 1, 49));
    }
  };

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      if (editorRef.current) {
        editorRef.current.innerHTML = history[newIndex] || '';
        onChange(history[newIndex] || '');
      }
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      if (editorRef.current) {
        editorRef.current.innerHTML = history[newIndex] || '';
        onChange(history[newIndex] || '');
      }
    }
  };

  // Heading select funcional
  const handleHeadingChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === 'normal') {
      execCmd('formatBlock', '<p>');
    } else {
      execCmd('formatBlock', `<${val}>`);
    }
    e.target.value = 'normal';
  };

  // Inserir tabela 3x3
  const insertTable = () => {
    const cellStyle = 'border:1px solid #cbd5e1;padding:6px 10px;min-width:80px;';
    const rows = Array.from({ length: 3 }, () =>
      `<tr>${Array.from({ length: 3 }, () => `<td style="${cellStyle}">&nbsp;</td>`).join('')}</tr>`
    ).join('');
    const tableHtml = `<table style="border-collapse:collapse;width:100%;margin:8px 0;">${rows}</table><p><br></p>`;
    execCmd('insertHTML', tableHtml);
  };

  // Inserir imagem por URL
  const insertImage = () => {
    const url = prompt('URL da imagem:');
    if (url) {
      execCmd('insertHTML', `<img src="${url}" style="max-width:100%;height:auto;margin:8px 0;border-radius:8px;" />`);
    }
  };

  const btnClass = 'p-1.5 hover:bg-slate-200 dark:hover:bg-[#353842] rounded transition-colors';

  return (
    <div className={`border border-slate-200 dark:border-[#3d3d48] rounded-lg bg-white dark:bg-[#08080b] ${className}`}>
      {/* Toolbar */}
      {showToolbar && !readOnly && (
        <div className="flex items-center gap-1 p-2 border-b border-slate-200 dark:border-[#3d3d48] bg-slate-50 dark:bg-[#1c1c21] rounded-t-lg flex-wrap">
          <select
            className="px-2 py-1 text-xs border border-slate-200 dark:border-[#3d3d48] rounded bg-white dark:bg-[#08080b] text-slate-700 dark:text-gray-200 mr-1 cursor-pointer"
            defaultValue="normal"
            onChange={handleHeadingChange}
          >
            <option value="normal">Normal</option>
            <option value="h1">Título 1</option>
            <option value="h2">Título 2</option>
            <option value="h3">Título 3</option>
          </select>

          <div className="w-px h-4 bg-slate-300 dark:bg-gray-600 mx-1" />

          <button type="button" onClick={() => execCmd('bold')} className={btnClass} title="Negrito">
            <Bold className="w-4 h-4 text-slate-600 dark:text-[#a1a1aa]" />
          </button>
          <button type="button" onClick={() => execCmd('italic')} className={btnClass} title="Itálico">
            <Italic className="w-4 h-4 text-slate-600 dark:text-[#a1a1aa]" />
          </button>
          <button type="button" onClick={() => execCmd('underline')} className={btnClass} title="Sublinhado">
            <Underline className="w-4 h-4 text-slate-600 dark:text-[#a1a1aa]" />
          </button>

          <div className="w-px h-4 bg-slate-300 dark:bg-gray-600 mx-1" />

          <button type="button" onClick={() => execCmd('justifyLeft')} className={btnClass} title="Alinhar à esquerda">
            <AlignLeft className="w-4 h-4 text-slate-600 dark:text-[#a1a1aa]" />
          </button>
          <button type="button" onClick={() => execCmd('justifyCenter')} className={btnClass} title="Centralizar">
            <AlignCenter className="w-4 h-4 text-slate-600 dark:text-[#a1a1aa]" />
          </button>
          <button type="button" onClick={() => execCmd('justifyRight')} className={btnClass} title="Alinhar à direita">
            <AlignRight className="w-4 h-4 text-slate-600 dark:text-[#a1a1aa]" />
          </button>

          <div className="w-px h-4 bg-slate-300 dark:bg-gray-600 mx-1" />

          <button type="button" onClick={() => execCmd('insertUnorderedList')} className={btnClass} title="Lista com marcadores">
            <List className="w-4 h-4 text-slate-600 dark:text-[#a1a1aa]" />
          </button>
          <button type="button" onClick={() => execCmd('insertOrderedList')} className={btnClass} title="Lista numerada">
            <ListOrdered className="w-4 h-4 text-slate-600 dark:text-[#a1a1aa]" />
          </button>

          <div className="w-px h-4 bg-slate-300 dark:bg-gray-600 mx-1" />

          <button type="button" onClick={insertTable} className={btnClass} title="Inserir tabela">
            <Table className="w-4 h-4 text-slate-600 dark:text-[#a1a1aa]" />
          </button>
          <button type="button" onClick={insertImage} className={btnClass} title="Inserir imagem">
            <ImageIcon className="w-4 h-4 text-slate-600 dark:text-[#a1a1aa]" />
          </button>

          <div className="flex-1" />

          <button
            type="button" onClick={handleUndo} disabled={historyIndex <= 0}
            className={`${btnClass} disabled:opacity-50 disabled:cursor-not-allowed`} title="Desfazer"
          >
            <Undo2 className="w-4 h-4 text-slate-600 dark:text-[#a1a1aa]" />
          </button>
          <button
            type="button" onClick={handleRedo} disabled={historyIndex >= history.length - 1}
            className={`${btnClass} disabled:opacity-50 disabled:cursor-not-allowed`} title="Refazer"
          >
            <Redo2 className="w-4 h-4 text-slate-600 dark:text-[#a1a1aa]" />
          </button>
        </div>
      )}

      {/* Editor Area */}
      <div className="relative">
        <div
          ref={editorRef}
          contentEditable={!readOnly}
          onInput={handleInput}
          className={`min-h-[200px] p-4 text-slate-700 dark:text-gray-200 focus:outline-none custom-scrollbar ${readOnly ? 'cursor-default bg-slate-50 dark:bg-[#16171c]' : ''}`}
          style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
          data-placeholder={placeholder}
        />
        <style dangerouslySetInnerHTML={{ __html: `
          [contenteditable][data-placeholder]:empty:before {
            content: attr(data-placeholder);
            color: #94a3b8;
            pointer-events: none;
          }
        ` }} />
      </div>

      {/* Footer com botões de modelo */}
      {(onSaveModel || onUseModel) && (
        <div className="flex justify-end gap-2 p-3 border-t border-slate-200 dark:border-[#3d3d48] bg-slate-50 dark:bg-[#1c1c21] rounded-b-lg">
          {onSaveModel && (
            <button
              type="button" onClick={onSaveModel}
              className="px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors flex items-center gap-2"
            >
              Salvar modelo
            </button>
          )}
          {onUseModel && (
            <button
              type="button" onClick={onUseModel}
              className="px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors flex items-center gap-2"
            >
              Usar modelo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
