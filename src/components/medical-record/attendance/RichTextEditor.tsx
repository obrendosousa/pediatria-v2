'use client';

import React, { useRef, useEffect, useState } from 'react';
import { 
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered, Undo2, Redo2
} from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  onSaveModel?: () => void;
  onUseModel?: () => void;
  modelType?: string;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Digite aqui...',
  className = '',
  onSaveModel,
  onUseModel,
  modelType
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value]);

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    saveToHistory();
  };

  const saveToHistory = () => {
    if (editorRef.current) {
      const currentContent = editorRef.current.innerHTML;
      setHistory(prev => {
        const newHistory = prev.slice(0, historyIndex + 1);
        newHistory.push(currentContent);
        return newHistory.slice(-50); // Limita a 50 estados
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

  return (
    <div className={`border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-[#1e2028] ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 border-b border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#2a2d36] rounded-t-lg">
        <select
          className="px-2 py-1 text-xs border border-slate-200 dark:border-gray-700 rounded bg-white dark:bg-[#1e2028] text-slate-700 dark:text-gray-200 mr-1"
          defaultValue="normal"
        >
          <option value="normal">Normal</option>
          <option value="h1">Título 1</option>
          <option value="h2">Título 2</option>
          <option value="h3">Título 3</option>
        </select>

        <div className="w-px h-4 bg-slate-300 dark:bg-gray-600 mx-1" />

        <button
          type="button"
          onClick={() => execCommand('bold')}
          className="p-1.5 hover:bg-slate-200 dark:hover:bg-[#353842] rounded transition-colors"
          title="Negrito"
        >
          <Bold className="w-4 h-4 text-slate-600 dark:text-gray-400" />
        </button>

        <button
          type="button"
          onClick={() => execCommand('italic')}
          className="p-1.5 hover:bg-slate-200 dark:hover:bg-[#353842] rounded transition-colors"
          title="Itálico"
        >
          <Italic className="w-4 h-4 text-slate-600 dark:text-gray-400" />
        </button>

        <button
          type="button"
          onClick={() => execCommand('underline')}
          className="p-1.5 hover:bg-slate-200 dark:hover:bg-[#353842] rounded transition-colors"
          title="Sublinhado"
        >
          <Underline className="w-4 h-4 text-slate-600 dark:text-gray-400" />
        </button>

        <div className="w-px h-4 bg-slate-300 dark:bg-gray-600 mx-1" />

        <button
          type="button"
          onClick={() => execCommand('justifyLeft')}
          className="p-1.5 hover:bg-slate-200 dark:hover:bg-[#353842] rounded transition-colors"
          title="Alinhar à esquerda"
        >
          <AlignLeft className="w-4 h-4 text-slate-600 dark:text-gray-400" />
        </button>

        <button
          type="button"
          onClick={() => execCommand('justifyCenter')}
          className="p-1.5 hover:bg-slate-200 dark:hover:bg-[#353842] rounded transition-colors"
          title="Centralizar"
        >
          <AlignCenter className="w-4 h-4 text-slate-600 dark:text-gray-400" />
        </button>

        <button
          type="button"
          onClick={() => execCommand('justifyRight')}
          className="p-1.5 hover:bg-slate-200 dark:hover:bg-[#353842] rounded transition-colors"
          title="Alinhar à direita"
        >
          <AlignRight className="w-4 h-4 text-slate-600 dark:text-gray-400" />
        </button>

        <div className="w-px h-4 bg-slate-300 dark:bg-gray-600 mx-1" />

        <button
          type="button"
          onClick={() => execCommand('insertUnorderedList')}
          className="p-1.5 hover:bg-slate-200 dark:hover:bg-[#353842] rounded transition-colors"
          title="Lista com marcadores"
        >
          <List className="w-4 h-4 text-slate-600 dark:text-gray-400" />
        </button>

        <button
          type="button"
          onClick={() => execCommand('insertOrderedList')}
          className="p-1.5 hover:bg-slate-200 dark:hover:bg-[#353842] rounded transition-colors"
          title="Lista numerada"
        >
          <ListOrdered className="w-4 h-4 text-slate-600 dark:text-gray-400" />
        </button>

        <div className="flex-1" />

        <button
          type="button"
          onClick={handleUndo}
          disabled={historyIndex <= 0}
          className="p-1.5 hover:bg-slate-200 dark:hover:bg-[#353842] rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Desfazer"
        >
          <Undo2 className="w-4 h-4 text-slate-600 dark:text-gray-400" />
        </button>

        <button
          type="button"
          onClick={handleRedo}
          disabled={historyIndex >= history.length - 1}
          className="p-1.5 hover:bg-slate-200 dark:hover:bg-[#353842] rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Refazer"
        >
          <Redo2 className="w-4 h-4 text-slate-600 dark:text-gray-400" />
        </button>
      </div>

      {/* Editor Area */}
      <div className="relative">
        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          className="min-h-[200px] p-4 text-slate-700 dark:text-gray-200 focus:outline-none custom-scrollbar"
          style={{
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
          data-placeholder={placeholder}
        />
        <style jsx>{`
          [contenteditable][data-placeholder]:empty:before {
            content: attr(data-placeholder);
            color: #94a3b8;
            pointer-events: none;
          }
        `}</style>
      </div>

      {/* Footer com botões de modelo */}
      {(onSaveModel || onUseModel) && (
        <div className="flex justify-end gap-2 p-3 border-t border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#2a2d36] rounded-b-lg">
          {onSaveModel && (
            <button
              type="button"
              onClick={onSaveModel}
              className="px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Salvar modelo
            </button>
          )}
          {onUseModel && (
            <button
              type="button"
              onClick={onUseModel}
              className="px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Usar modelo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
