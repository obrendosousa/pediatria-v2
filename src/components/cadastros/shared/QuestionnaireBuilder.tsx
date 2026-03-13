'use client';

import { useState, useRef, useCallback } from 'react';
import { Plus, GripVertical, Trash2, AlertCircle } from 'lucide-react';
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

const QUESTION_TYPES: { value: AnamnesisQuestionType; label: string }[] = [
  { value: 'text', label: 'Texto' },
  { value: 'checkbox', label: 'Caixa de seleção' },
  { value: 'gestational_calculator', label: 'Calculadora gestacional' },
  { value: 'multiple_choice', label: 'Múltipla escolha' },
];

function generateId(): string {
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
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
  const [error, setError] = useState('');

  // Drag state
  const dragIndex = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleAdd = useCallback(() => {
    if (!newQuestion.trim()) {
      setError('Digite a pergunta.');
      return;
    }
    setError('');
    onAdd({
      id: generateId(),
      question: newQuestion.trim(),
      type: newType,
      options: [],
    });
    setNewQuestion('');
    setNewType('text');
  }, [newQuestion, newType, onAdd]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  }, [handleAdd]);

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

  const inputClass = 'w-full px-3 py-2 text-sm border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-[#2a2d36] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-400';

  return (
    <div className="space-y-4">
      {/* Formulário de nova pergunta */}
      <div className="bg-slate-50 dark:bg-[#2a2d36] rounded-xl border border-slate-200 dark:border-gray-700 p-4 space-y-3">
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
            {error && (
              <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {error}
              </p>
            )}
          </div>

          <select
            value={newType}
            onChange={e => setNewType(e.target.value as AnamnesisQuestionType)}
            className="px-3 py-2 text-sm border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-[#2a2d36] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-400 w-48"
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
      </div>

      {/* Tabela de perguntas */}
      {questions.length === 0 ? (
        <p className="text-sm text-slate-400 dark:text-gray-500 text-center py-8">
          Nenhuma pergunta adicionada. Use o formulário acima para começar.
        </p>
      ) : (
        <div className="bg-white dark:bg-[#1e2028] rounded-xl border border-slate-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-[#2a2d36] border-b border-slate-200 dark:border-gray-700">
                <th className="px-2 py-3 w-8" />
                <th className="px-4 py-3 text-xs font-extrabold text-slate-500 dark:text-gray-400 uppercase">#</th>
                <th className="px-4 py-3 text-xs font-extrabold text-slate-500 dark:text-gray-400 uppercase">Pergunta</th>
                <th className="px-4 py-3 text-xs font-extrabold text-slate-500 dark:text-gray-400 uppercase w-48">Tipo</th>
                <th className="px-4 py-3 text-xs font-extrabold text-slate-500 dark:text-gray-400 uppercase text-right w-16">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
              {questions.map((q, idx) => (
                <tr
                  key={q.id}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={e => handleDragOver(e, idx)}
                  onDrop={() => handleDrop(idx)}
                  onDragEnd={resetDrag}
                  className={`transition-colors ${
                    dragOverIndex === idx
                      ? 'bg-teal-50 dark:bg-teal-900/20'
                      : 'hover:bg-slate-50 dark:hover:bg-white/5'
                  }`}
                >
                  <td className="px-2 py-3">
                    <GripVertical className="w-4 h-4 text-slate-300 dark:text-gray-600 cursor-grab active:cursor-grabbing" />
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400 dark:text-gray-500 font-mono">{idx + 1}</td>
                  <td className="px-4 py-3">
                    {onUpdate ? (
                      <input
                        type="text"
                        value={q.question}
                        onChange={e => onUpdate(q.id, { question: e.target.value })}
                        className="w-full bg-transparent text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-teal-400 rounded px-1 -mx-1"
                      />
                    ) : (
                      <span className="text-slate-700 dark:text-gray-200">{q.question}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {onUpdate ? (
                      <select
                        value={q.type}
                        onChange={e => onUpdate(q.id, { type: e.target.value as AnamnesisQuestionType })}
                        className="text-xs border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-[#2a2d36] text-slate-600 dark:text-gray-300 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-teal-400"
                      >
                        {QUESTION_TYPES.map(t => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-gray-400 rounded font-medium">
                        {QUESTION_TYPES.find(t => t.value === q.type)?.label ?? q.type}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => onRemove(q.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      title="Remover pergunta"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {questions.length > 0 && (
        <p className="text-xs text-slate-400 dark:text-gray-500">
          Arraste as linhas para reordenar. {questions.length} pergunta{questions.length !== 1 ? 's' : ''}.
        </p>
      )}
    </div>
  );
}
