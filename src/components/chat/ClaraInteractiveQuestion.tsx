'use client';

import { useState } from 'react';
import { MessageSquareMore, Send, ChevronRight, Sparkles } from 'lucide-react';

interface Suggestion {
  label: string;
  value: string;
  is_recommended: boolean;
  description?: string;
}

interface InteractiveQuestionData {
  question_id: string;
  question: string;
  suggestions: Suggestion[];
  allow_free_text: boolean;
  free_text_placeholder?: string;
  context?: string;
}

interface Props {
  data: InteractiveQuestionData;
  onAnswer: (questionId: string, answer: string) => void;
  isAnswered?: boolean;
  selectedAnswer?: string;
}

export default function ClaraInteractiveQuestion({ data, onAnswer, isAnswered, selectedAnswer }: Props) {
  const [freeText, setFreeText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSelect = async (value: string) => {
    if (isAnswered || isSubmitting) return;
    setIsSubmitting(true);
    onAnswer(data.question_id, value);
  };

  const handleFreeTextSubmit = () => {
    if (!freeText.trim() || isAnswered || isSubmitting) return;
    setIsSubmitting(true);
    onAnswer(data.question_id, freeText.trim());
  };

  return (
    <div className="flex items-end gap-2 px-4 mb-2">
      {/* Avatar */}
      <div className="w-[30px] h-[30px] rounded-full flex-shrink-0 flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 shadow-md ring-2 ring-white dark:ring-[#0b141a]">
        <MessageSquareMore size={14} className="text-white" />
      </div>

      {/* Card da pergunta */}
      <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-white dark:bg-[#202c33] shadow-sm border border-black/5 dark:border-white/5 overflow-hidden">
        {/* Pergunta */}
        <div className="px-4 pt-3 pb-2">
          <p className="text-[14px] font-medium text-[#111b21] dark:text-[#e9edef] leading-snug">
            {data.question}
          </p>
          {data.context && (
            <p className="text-[12px] text-[#667781] dark:text-[#8696a0] mt-1 leading-snug">
              {data.context}
            </p>
          )}
        </div>

        {/* Sugestões */}
        <div className="px-3 pb-2 space-y-1.5">
          {data.suggestions.map((suggestion) => {
            const isSelected = isAnswered && selectedAnswer === suggestion.value;
            const isDisabled = isAnswered || isSubmitting;

            return (
              <button
                key={suggestion.value}
                onClick={() => handleSelect(suggestion.value)}
                disabled={isDisabled}
                className={`
                  w-full text-left rounded-xl px-3.5 py-2.5 flex items-center gap-2.5 transition-all duration-200
                  ${isSelected
                    ? 'bg-[#d9fdd3] dark:bg-[#025c4c]/60 border border-[#a8e6a0] dark:border-[#128c7e]/50'
                    : isDisabled
                      ? 'bg-black/3 dark:bg-white/3 opacity-50 cursor-not-allowed'
                      : 'bg-black/3 dark:bg-white/5 hover:bg-[#d9fdd3]/50 dark:hover:bg-[#025c4c]/30 border border-transparent hover:border-[#a8e6a0]/50 dark:hover:border-[#128c7e]/30 cursor-pointer'
                  }
                `}
              >
                {/* Indicador recomendado */}
                {suggestion.is_recommended && !isAnswered && (
                  <Sparkles size={14} className="text-amber-500 flex-shrink-0" />
                )}

                <div className="flex-1 min-w-0">
                  <span className={`text-[13px] font-medium ${isSelected ? 'text-[#025c4c] dark:text-[#d9fdd3]' : 'text-[#111b21] dark:text-[#e9edef]'}`}>
                    {suggestion.label}
                  </span>
                  {suggestion.description && (
                    <span className="text-[11px] text-[#667781] dark:text-[#8696a0] ml-1.5">
                      {suggestion.description}
                    </span>
                  )}
                </div>

                {!isDisabled && (
                  <ChevronRight size={14} className="text-[#667781] dark:text-[#8696a0] flex-shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        {/* Campo de texto livre */}
        {data.allow_free_text && !isAnswered && (
          <div className="px-3 pb-3 pt-1">
            <div className="flex items-center gap-2 rounded-xl bg-black/3 dark:bg-white/5 px-3 py-1.5">
              <input
                type="text"
                value={freeText}
                onChange={(e) => setFreeText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleFreeTextSubmit()}
                placeholder={data.free_text_placeholder || 'Ou digite sua resposta...'}
                disabled={isSubmitting}
                className="flex-1 bg-transparent text-[13px] text-[#111b21] dark:text-[#e9edef] placeholder:text-[#667781] dark:placeholder:text-[#8696a0] outline-none"
              />
              {freeText.trim() && (
                <button
                  onClick={handleFreeTextSubmit}
                  disabled={isSubmitting}
                  className="w-7 h-7 rounded-full bg-[#00a884] dark:bg-[#00a884] flex items-center justify-center flex-shrink-0 hover:bg-[#008f72] transition-colors"
                >
                  <Send size={12} className="text-white" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Estado respondido */}
        {isAnswered && selectedAnswer && (
          <div className="px-4 pb-2.5">
            <span className="text-[11px] text-[#00a884] dark:text-[#00a884] font-medium">
              ✓ Respondido
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
