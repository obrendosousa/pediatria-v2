'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import ImageExtension from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import FontFamily from '@tiptap/extension-font-family';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Highlighter, Paintbrush, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Undo2, Redo2,
  Table as TableIcon, ImagePlus, Link2, Heading1, Heading2, Heading3,
  ChevronDown, Type,
} from 'lucide-react';

// --- Tipos ---

export interface TemplateVariable {
  key: string;
  label: string;
  description?: string;
}

export interface RichTextEditorProps {
  value?: string;
  onChange?: (html: string) => void;
  placeholder?: string;
  extended?: boolean;
  variables?: TemplateVariable[];
  className?: string;
}

// --- Constantes ---

const FONT_FAMILIES = [
  { label: 'Padrão', value: '' },
  { label: 'Arial', value: 'Arial' },
  { label: 'Times New Roman', value: 'Times New Roman' },
  { label: 'Courier New', value: 'Courier New' },
  { label: 'Georgia', value: 'Georgia' },
  { label: 'Verdana', value: 'Verdana' },
];

const FONT_SIZES = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px'];

const TEXT_COLORS = [
  '#000000', '#374151', '#dc2626', '#ea580c', '#ca8a04',
  '#16a34a', '#0d9488', '#2563eb', '#7c3aed', '#db2777',
];

// --- Botão de toolbar ---

function ToolbarButton({
  active, disabled, onClick, title, children,
}: {
  active?: boolean; disabled?: boolean; onClick: () => void; title: string; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        active
          ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300'
          : 'text-slate-500 dark:text-[#a1a1aa] hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-700 dark:hover:text-gray-200'
      } disabled:opacity-30 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  );
}

// --- Separador ---

function Divider() {
  return <div className="w-px h-5 bg-slate-200 dark:bg-gray-700 mx-0.5" />;
}

// --- Dropdown genérico ---

function ToolbarDropdown({
  label, icon, children,
}: {
  label: string; icon: React.ReactNode; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        title={label}
        className="flex items-center gap-0.5 p-1.5 rounded text-slate-500 dark:text-[#a1a1aa] hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-700 dark:hover:text-gray-200 transition-colors"
      >
        {icon}
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div
          className="absolute top-full left-0 mt-1 z-50 bg-white dark:bg-[#18181b] border border-slate-200 dark:border-[#2e2e33] rounded-xl shadow-xl py-1 min-w-[160px] animate-in fade-in-0 zoom-in-95"
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

// --- Componente principal ---

export default function RichTextEditor({
  value = '',
  onChange,
  placeholder = 'Digite aqui...',
  extended = false,
  variables,
  className = '',
}: RichTextEditorProps) {
  const isInternalUpdate = useRef(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const colorRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      TextStyle,
      Color,
      FontFamily,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      Placeholder.configure({ placeholder }),
      ...(extended ? [
        ImageExtension.configure({ inline: false, allowBase64: true }),
        Link.configure({ openOnClick: false, autolink: true }),
      ] : []),
    ],
    content: value,
    onUpdate: ({ editor: ed }) => {
      isInternalUpdate.current = true;
      onChange?.(ed.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none px-4 py-3 min-h-[200px] focus:outline-none',
      },
    },
  });

  // Sync valor externo
  useEffect(() => {
    if (!editor) return;
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false;
      return;
    }
    const current = editor.getHTML();
    if (value !== current) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value, editor]);

  // Color picker click-outside
  useEffect(() => {
    if (!colorPickerOpen) return;
    function close(e: MouseEvent) {
      if (colorRef.current && !colorRef.current.contains(e.target as Node)) setColorPickerOpen(false);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [colorPickerOpen]);

  // Inserir variável
  const insertVariable = useCallback((key: string) => {
    editor?.commands.insertContent(`{${key}}`);
  }, [editor]);

  // Inserir imagem
  const insertImage = useCallback(() => {
    const url = window.prompt('URL da imagem:');
    if (url && editor) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  }, [editor]);

  // Inserir link
  const insertLink = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes('link').href ?? '';
    const url = window.prompt('URL do link:', prev);
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
  }, [editor]);

  // Inserir tabela
  const insertTable = useCallback(() => {
    editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }, [editor]);

  // Aplicar tamanho de fonte via CSS span
  const setFontSize = useCallback((size: string) => {
    if (!editor) return;
    editor.chain().focus().setMark('textStyle', { fontSize: size } as Record<string, string>).run();
  }, [editor]);

  if (!editor) return null;

  return (
    <div className={`border border-slate-200 dark:border-[#2e2e33] rounded-xl overflow-hidden bg-white dark:bg-[#0a0a0c] ${className}`}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-slate-200 dark:border-[#2e2e33] bg-slate-50 dark:bg-[#18181b]">

        {/* Fonte */}
        <ToolbarDropdown label="Fonte" icon={<Type className="w-4 h-4" />}>
          {FONT_FAMILIES.map(f => (
            <button
              key={f.value}
              type="button"
              onClick={() => f.value ? editor.chain().focus().setFontFamily(f.value).run() : editor.chain().focus().unsetFontFamily().run()}
              className="block w-full text-left px-3 py-1.5 text-sm text-slate-700 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-white/5"
              style={f.value ? { fontFamily: f.value } : undefined}
            >
              {f.label}
            </button>
          ))}
        </ToolbarDropdown>

        {/* Tamanho da fonte */}
        <ToolbarDropdown label="Tamanho" icon={<span className="text-xs font-bold w-4 text-center">A</span>}>
          {FONT_SIZES.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setFontSize(s)}
              className="block w-full text-left px-3 py-1.5 text-sm text-slate-700 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-white/5"
            >
              {s}
            </button>
          ))}
        </ToolbarDropdown>

        <Divider />

        {/* Headings */}
        <ToolbarButton
          active={editor.isActive('heading', { level: 1 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          title="Título 1"
        >
          <Heading1 className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('heading', { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          title="Título 2"
        >
          <Heading2 className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('heading', { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          title="Título 3"
        >
          <Heading3 className="w-4 h-4" />
        </ToolbarButton>

        <Divider />

        {/* Formatação */}
        <ToolbarButton
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Negrito"
        >
          <Bold className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Itálico"
        >
          <Italic className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Sublinhado"
        >
          <UnderlineIcon className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('strike')}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title="Tachado"
        >
          <Strikethrough className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('highlight')}
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          title="Realce"
        >
          <Highlighter className="w-4 h-4" />
        </ToolbarButton>

        {/* Cor do texto */}
        <div ref={colorRef} className="relative">
          <button
            type="button"
            onClick={() => setColorPickerOpen(o => !o)}
            title="Cor do texto"
            className="p-1.5 rounded text-slate-500 dark:text-[#a1a1aa] hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
          >
            <Paintbrush className="w-4 h-4" />
          </button>
          {colorPickerOpen && (
            <div className="absolute top-full left-0 mt-1 z-50 bg-white dark:bg-[#18181b] border border-slate-200 dark:border-[#2e2e33] rounded-xl shadow-xl p-2 grid grid-cols-5 gap-1 animate-in fade-in-0 zoom-in-95">
              {TEXT_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => { editor.chain().focus().setColor(c).run(); setColorPickerOpen(false); }}
                  className="w-6 h-6 rounded-full border border-slate-200 dark:border-gray-600 hover:scale-110 transition-transform"
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
              <button
                type="button"
                onClick={() => { editor.chain().focus().unsetColor().run(); setColorPickerOpen(false); }}
                className="col-span-5 mt-1 text-xs text-slate-500 dark:text-[#a1a1aa] hover:text-teal-600 py-1"
              >
                Remover cor
              </button>
            </div>
          )}
        </div>

        <Divider />

        {/* Alinhamento */}
        <ToolbarButton
          active={editor.isActive({ textAlign: 'left' })}
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          title="Alinhar à esquerda"
        >
          <AlignLeft className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive({ textAlign: 'center' })}
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          title="Centralizar"
        >
          <AlignCenter className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive({ textAlign: 'right' })}
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          title="Alinhar à direita"
        >
          <AlignRight className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive({ textAlign: 'justify' })}
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
          title="Justificar"
        >
          <AlignJustify className="w-4 h-4" />
        </ToolbarButton>

        <Divider />

        {/* Listas */}
        <ToolbarButton
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Lista"
        >
          <List className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Lista numerada"
        >
          <ListOrdered className="w-4 h-4" />
        </ToolbarButton>

        <Divider />

        {/* Tabela */}
        <ToolbarButton onClick={insertTable} title="Inserir tabela">
          <TableIcon className="w-4 h-4" />
        </ToolbarButton>

        {/* Extensões (imagem + link) */}
        {extended && (
          <>
            <ToolbarButton onClick={insertImage} title="Inserir imagem">
              <ImagePlus className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton
              active={editor.isActive('link')}
              onClick={insertLink}
              title="Inserir link"
            >
              <Link2 className="w-4 h-4" />
            </ToolbarButton>
          </>
        )}

        {/* Variáveis de template */}
        {variables && variables.length > 0 && (
          <>
            <Divider />
            <ToolbarDropdown label="Variáveis" icon={<span className="text-xs font-bold">{'{ }'}</span>}>
              {variables.map(v => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => insertVariable(v.key)}
                  className="block w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-white/5"
                >
                  <span className="text-sm font-medium text-teal-600 dark:text-teal-400">{`{${v.key}}`}</span>
                  <span className="block text-xs text-slate-400 dark:text-[#71717a]">{v.description ?? v.label}</span>
                </button>
              ))}
            </ToolbarDropdown>
          </>
        )}

        <div className="flex-1" />

        {/* Undo / Redo */}
        <ToolbarButton
          disabled={!editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
          title="Desfazer"
        >
          <Undo2 className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          disabled={!editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
          title="Refazer"
        >
          <Redo2 className="w-4 h-4" />
        </ToolbarButton>
      </div>

      {/* Editor */}
      <EditorContent editor={editor} />
    </div>
  );
}
