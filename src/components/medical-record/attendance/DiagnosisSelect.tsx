'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
const supabase = createClient();
import { useDebounce } from '@/hooks/useDebounce';

interface CID10Option {
  code: string;
  description: string;
}

interface DiagnosisSelectProps {
  value?: string | null;
  onChange: (value: string) => void;
  onAdd?: (code: string, description: string) => void;
  className?: string;
}

export function DiagnosisSelect({
  value,
  onChange,
  onAdd,
  className = ''
}: DiagnosisSelectProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [options, setOptions] = useState<CID10Option[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedOption, setSelectedOption] = useState<CID10Option | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Buscar quando o termo debounced mudar
  useEffect(() => {
    if (debouncedSearchTerm.length >= 1) {
      searchDiagnosis(debouncedSearchTerm);
    } else {
      setOptions([]);
      setIsOpen(false);
    }
  }, [debouncedSearchTerm]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function searchDiagnosis(term: string) {
    setIsLoading(true);
    setIsOpen(true);

    try {
      // Validação: não buscar se termo estiver vazio
      const trimmedTerm = term.trim();
      if (!trimmedTerm) {
        setOptions([]);
        setIsOpen(false);
        setIsLoading(false);
        return;
      }

      // Busca usando função RPC search_cid10 com busca fuzzy
      // A função retorna até 50 resultados ordenados por relevância
      const { data, error } = await supabase.rpc('search_cid10', {
        query_text: trimmedTerm
      });

      if (error) {
        console.error('Erro na consulta RPC ao Supabase:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw error;
      }

      // Converter resposta da RPC para formato CID10Option
      // A RPC já retorna code e description formatados
      const formattedData: CID10Option[] = (data || []).map((item: any) => ({
        code: item.code || '',
        description: item.description || ''
      }));

      setOptions(formattedData);
    } catch (err: any) {
      console.error('Erro ao buscar diagnóstico:', {
        error: err,
        message: err?.message || 'Erro desconhecido',
        hint: 'Verifique se a função RPC search_cid10 existe e a tabela cid_sub_categoria está populada no Supabase'
      });
      setOptions([]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleSelect(option: CID10Option) {
    const fullValue = `${option.code} - ${option.description}`;
    setSelectedOption(option);
    setSearchTerm(option.code);
    onChange(fullValue);
    setIsOpen(false);
    
    if (onAdd) {
      onAdd(option.code, option.description);
    }
  }

  function handleClear() {
    setSearchTerm('');
    setSelectedOption(null);
    onChange('');
    setIsOpen(false);
    inputRef.current?.focus();
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => {
              if (searchTerm.length >= 2) {
                setIsOpen(true);
              }
            }}
            placeholder="Comece a digitar..."
            className="w-full px-4 py-2.5 border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-[#1e2028] text-slate-700 dark:text-gray-200 placeholder:text-slate-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 dark:hover:bg-[#2a2d36] rounded transition-colors"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          )}
        </div>

        <button
          type="button"
          className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          title="Buscar"
        >
          <Search className="w-4 h-4" />
        </button>

        {onAdd && selectedOption && (
          <button
            type="button"
            onClick={() => onAdd(selectedOption.code, selectedOption.description)}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            ADICIONAR
          </button>
        )}
      </div>

      {/* Dropdown de resultados */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-[#1e2028] border border-slate-200 dark:border-gray-700 rounded-lg shadow-lg max-h-64 overflow-y-auto custom-scrollbar">
          {isLoading ? (
            <div className="p-4 text-center text-slate-500 dark:text-gray-400">
              Buscando...
            </div>
          ) : options.length > 0 ? (
            options.map((option, index) => (
              <button
                key={`${option.code}-${index}`}
                type="button"
                onClick={() => handleSelect(option)}
                className="w-full text-left px-4 py-3 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors border-b border-slate-100 dark:border-gray-800 last:border-b-0"
              >
                <div className="font-medium text-slate-900 dark:text-gray-100">
                  {option.code}
                </div>
                <div className="text-sm text-slate-600 dark:text-gray-400 mt-0.5">
                  {option.description}
                </div>
              </button>
            ))
          ) : (
            <div className="p-4">
              <div className="text-center text-slate-600 dark:text-gray-400 mb-2">
                Nenhum resultado encontrado
              </div>
              <div className="text-xs text-slate-500 dark:text-gray-500 text-center">
                {debouncedSearchTerm.length < 1 
                  ? 'Digite pelo menos 1 caractere para buscar'
                  : 'Nenhum resultado encontrado. Tente buscar por código (ex: A00) ou descrição (ex: gastroenterite)'}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
