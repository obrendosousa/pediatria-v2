'use client';

import { useState, useRef, useCallback } from 'react';
import { Plus, GripVertical, Trash2, AlertCircle, X, ChevronDown, ChevronUp } from 'lucide-react';
import type { AnamnesisQuestionType } from '@/types/cadastros';

// --- Tipos ---

export interface QuestionItem {
  id: string;
  question: string;
  type: AnamnesisQuestionType;
  options: string[];
}

export interface QuestionnaireBuilderProps {
  questions: QuestionItem[];
  onAdd: (question: QuestionItem) => void;
  onRemove: (id: string) => void;
  onReorder: (questions: QuestionItem[]) => void;
  onUpdate?: (id: string, data: Partial<QuestionItem>) => void;
}

// --- Constantes ---

const QUESTION_TYPES: { value: AnamnesisQuestionType; label: string; needsOptions: boolean }[] = [
  { value: 'text', label: 'Texto', needsOptions: false },
  { value: 'checkbox', label: 'Caixa de seleção', needsOptions: true },
  { value: 'gestational_calculator', label: 'Calculadora gestacional', needsOptions: false },
  { value: 'multiple_choice', label: 'Múltipla escolha', needsOptions: true },
];

const TYPE_NEEDS_OPTIONS = (type: AnamnesisQuestionType) =>
  type === 'checkbox' || type === 'multiple_choice';

function generateId(): string {
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// --- Editor de opções inline (para perguntas já adicionadas) ---

function OptionsEditor({
  options,
  onChange,
}: {
  options: string[];
  onChange: (options: string[]) => void;
}) {
  const [newOpt, setNewOpt] = useState('');

  const addOption = () => {
    const val = newOpt.trim();
    if (!val || options.includes(val)) return;
    onChange([...options, val]);
    setNewOpt('');
  };

  return (
    <div className="mt-2 ml-6 space-y-2">
      <p className="text-[10px] font-bold text-slate-400 dark:text-[#71717a] uppercase tracking-wider">
        Opções de resposta
      </p>

      {/* Tags das opções existentes */}
      {options.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {options.map((opt, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800"
            >
              {opt}
              <button
                type="button"
                onClick={() => onChange(options.filter((_, j) => j !== i))}
                className="hover:text-red-500 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input para adicionar nova opção */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newOpt}
          onChange={e => setNewOpt(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOption(); } }}
          placeholder="Adicionar opção..."
          className="flex-1 px-2.5 py-1 text-xs border border-slate-200 dark:border-[#3d3d48] rounded-lg bg-white dark:bg-[#1c1c21] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-teal-400"
        />
        <button
          type="button"
          onClick={addOption}
          disabled={!newOpt.trim()}
          className="px-2.5 py-1 text-xs font-bold bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white rounded-lg transition-colors"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>

      {options.length === 0 && (
        <p className="text-[10px] text-amber-500 dark:text-amber-400">
          Adicione pelo menos uma opção de resposta.
        </p>
      )}
    </div>
  );
}

// --- Componente ---

export default function QuestionnaireBuilder({
  questions,
  onAdd,
  onRemove,
  onReorder,
  onUpdate,
}: QuestionnaireBuilderProps) {
  const [newQuestion, setNewQuestion] = useState('');
  const [newType, setNewType] = useState<AnamnesisQuestionType>('text');
  const [newOptions, setNewOptions] = useState<string[]>([]);
  const [newOptionInput, setNewOptionInput] = useState('');
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Drag state
  const dragIndex = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleAdd = useCallback(() => {
    if (!newQuestion.trim()) {
      setError('Digite a pergunta.');
      return;
    }
    if (TYPE_NEEDS_OPTIONS(newType) && newOptions.length === 0) {
      setError('Adicione pelo menos uma opção de resposta.');
      return;
    }
    setError('');
    onAdd({
      id: generateId(),
      question: newQuestion.trim(),
      type: newType,
      options: TYPE_NEEDS_OPTIONS(newType) ? [...newOptions] : [],
    });
    setNewQuestion('');
    setNewType('text');
    setNewOptions([]);
    setNewOptionInput('');
  }, [newQuestion, newType, newOptions, onAdd]);

  const handleAddNewOption = useCallback(() => {
    const val = newOptionInput.trim();
    if (!val || newOptions.includes(val)) return;
    setNewOptions(prev => [...prev, val]);
    setNewOptionInput('');
  }, [newOptionInput, newOptions]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!TYPE_NEEDS_OPTIONS(newType)) {
        handleAdd();
      }
    }
  }, [handleAdd, newType]);

  // --- Drag and Drop ---
  const handleDragStart = (index: number) => {
    dragIndex.current = index;
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (targetIndex: number) => {
    const from = dragIndex.current;
    if (from === null || from === targetIndex) {
      resetDrag();
      return;
    }
    const reordered = [...questions];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(targetIndex, 0, moved);
    onReorder(reordered);
    resetDrag();
  };

  const resetDrag = () => {
    dragIndex.current = null;
    setDragOverIndex(null);
  };

  const inputClass = 'w-full px-3 py-2 text-sm border border-slate-200 dark:border-[#3d3d48] rounded-lg bg-white dark:bg-[#1c1c21] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-400';

  return (
    <div className="space-y-4">
      {/* Formulário de nova pergunta */}
      <div className="bg-slate-50 dark:bg-[#1c1c21] rounded-xl border border-slate-200 dark:border-[#3d3d48] p-4 space-y-3">
        <h4 className="text-sm font-bold text-slate-700 dark:text-gray-200 uppercase tracking-wide">
          Nova Pergunta
        </h4>

        <div className="flex gap-3">
          <div className="flex-1">
            <input
              type="text"
              value={newQuestion}
              onChange={e => { setNewQuestion(e.target.value); setError(''); }}
              onKeyDown={handleKeyDown}
              placeholder="Digite a pergunta..."
              className={inputClass}
            />
          </div>

          <select
            value={newType}
            onChange={e => {
              const t = e.target.value as AnamnesisQuestionType;
              setNewType(t);
              if (!TYPE_NEEDS_OPTIONS(t)) {
                setNewOptions([]);
                setNewOptionInput('');
              }
              setError('');
            }}
            className="px-3 py-2 text-sm border border-slate-200 dark:border-[#3d3d48] rounded-lg bg-white dark:bg-[#1c1c21] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-400 w-48"
          >
            {QUESTION_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleAdd}
            className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-bold transition-colors active:scale-95 shadow-sm shrink-0"
          >
            <Plus className="w-4 h-4" /> ADICIONAR
          </button>
        </div>

        {/* Editor de opções para nova pergunta */}
        {TYPE_NEEDS_OPTIONS(newType) && (
          <div className="space-y-2 pt-1">
            <p className="text-[10px] font-bold text-slate-400 dark:text-[#71717a] uppercase tracking-wider">
              Opções de resposta ({newType === 'checkbox' ? 'Caixa de seleção' : 'Múltipla escolha'})
            </p>

            {newOptions.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {newOptions.map((opt, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800"
                  >
                    {opt}
                    <button
                      type="button"
                      onClick={() => setNewOptions(prev => prev.filter((_, j) => j !== i))}
                      className="hover:text-red-500 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                value={newOptionInput}
                onChange={e => setNewOptionInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); handleAddNewOption(); }
                }}
                placeholder="Ex: Sim, Não, Às vezes..."
                className="flex-1 px-3 py-1.5 text-xs border border-slate-200 dark:border-[#3d3d48] rounded-lg bg-white dark:bg-[#1c1c21] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-teal-400"
              />
              <button
                type="button"
                onClick={handleAddNewOption}
                disabled={!newOptionInput.trim()}
                className="px-3 py-1.5 text-xs font-bold bg-slate-200 dark:bg-gray-700 hover:bg-slate-300 dark:hover:bg-gray-600 disabled:opacity-40 text-slate-700 dark:text-gray-200 rounded-lg transition-colors"
              >
                + Opção
              </button>
            </div>

            {newOptions.length === 0 && (
              <p className="text-[10px] text-amber-500 dark:text-amber-400">
                Adicione as opções que o paciente poderá selecionar.
              </p>
            )}
          </div>
        )}

        {error && (
          <p className="text-xs text-red-500 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> {error}
          </p>
        )}
      </div>

      {/* Lista de perguntas */}
      {questions.length === 0 ? (
        <p className="text-sm text-slate-400 dark:text-[#71717a] text-center py-8">
          Nenhuma pergunta adicionada. Use o formulário acima para começar.
        </p>
      ) : (
        <div className="space-y-2">
          {questions.map((q, idx) => {
            const needsOpts = TYPE_NEEDS_OPTIONS(q.type);
            const isExpanded = expandedId === q.id;

            return (
              <div
                key={q.id}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={e => handleDragOver(e, idx)}
                onDrop={() => handleDrop(idx)}
                onDragEnd={resetDrag}
                className={`bg-white dark:bg-[#08080b] rounded-xl border transition-colors ${
                  dragOverIndex === idx
                    ? 'border-teal-300 dark:border-teal-700 bg-teal-50 dark:bg-teal-900/20'
                    : 'border-slate-200 dark:border-[#3d3d48]'
                }`}
              >
                {/* Linha principal */}
                <div className="flex items-center gap-2 px-3 py-3">
                  <GripVertical className="w-4 h-4 text-slate-300 dark:text-gray-600 cursor-grab active:cursor-grabbing shrink-0" />

                  <span className="text-xs text-slate-400 dark:text-[#71717a] font-mono w-6 text-center shrink-0">
                    {idx + 1}
                  </span>

                  <div className="flex-1 min-w-0">
                    {onUpdate ? (
                      <input
                        type="text"
                        value={q.question}
                        onChange={e => onUpdate(q.id, { question: e.target.value })}
                        className="w-full bg-transparent text-sm text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-teal-400 rounded px-1 -mx-1"
                      />
                    ) : (
                      <span className="text-sm text-slate-700 dark:text-gray-200">{q.question}</span>
                    )}
                  </div>

                  {onUpdate ? (
                    <select
                      value={q.type}
                      onChange={e => {
                        const t = e.target.value as AnamnesisQuestionType;
                        onUpdate(q.id, {
                          type: t,
                          options: TYPE_NEEDS_OPTIONS(t) ? q.options : [],
                        });
                        if (TYPE_NEEDS_OPTIONS(t)) setExpandedId(q.id);
                      }}
                      className="text-xs border border-slate-200 dark:border-[#3d3d48] rounded-lg bg-white dark:bg-[#1c1c21] text-slate-600 dark:text-[#d4d4d8] px-2 py-1 focus:outline-none focus:ring-1 focus:ring-teal-400 w-44 shrink-0"
                    >
                      {QUESTION_TYPES.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-[#a1a1aa] rounded font-medium shrink-0">
                      {QUESTION_TYPES.find(t => t.value === q.type)?.label ?? q.type}
                    </span>
                  )}

                  {/* Botão expandir opções */}
                  {needsOpts && (
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : q.id)}
                      className="p-1 rounded text-slate-400 hover:text-teal-600 transition-colors shrink-0"
                      title={isExpanded ? 'Recolher opções' : 'Editar opções'}
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onRemove(q.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0"
                    title="Remover pergunta"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Badges de opções (quando recolhido) */}
                {needsOpts && !isExpanded && q.options.length > 0 && (
                  <div className="px-12 pb-2.5 flex flex-wrap gap-1">
                    {q.options.map((opt, i) => (
                      <span
                        key={i}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-[#1c1c21] text-slate-500 dark:text-[#a1a1aa]"
                      >
                        {opt}
                      </span>
                    ))}
                  </div>
                )}

                {/* Editor de opções (quando expandido) */}
                {needsOpts && isExpanded && onUpdate && (
                  <div className="px-4 pb-4 border-t border-slate-100 dark:border-[#2d2d36] pt-3">
                    <OptionsEditor
                      options={q.options}
                      onChange={opts => onUpdate(q.id, { options: opts })}
                    />
                  </div>
                )}

                {/* Aviso de opções vazias */}
                {needsOpts && q.options.length === 0 && !isExpanded && (
                  <div className="px-12 pb-2.5">
                    <p className="text-[10px] text-amber-500 dark:text-amber-400">
                      Nenhuma opção configurada — clique em &#9660; para adicionar
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {questions.length > 0 && (
        <p className="text-xs text-slate-400 dark:text-[#71717a]">
          Arraste os itens para reordenar. {questions.length} pergunta{questions.length !== 1 ? 's' : ''}.
        </p>
      )}
    </div>
  );
}
