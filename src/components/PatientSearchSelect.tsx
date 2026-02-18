'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Search, X, User } from 'lucide-react';

const supabase = createClient();

export interface PatientSearchOption {
  id: number;
  name: string;
  phone: string | null;
  biological_sex: 'M' | 'F' | null;
  parent_name: string | null;
}

interface PatientSearchSelectProps {
  onSelect: (patient: PatientSearchOption | null) => void;
  selectedPatient: PatientSearchOption | null;
  placeholder?: string;
  className?: string;
}

function extractParentName(familyMembers: unknown): string | null {
  if (!familyMembers || !Array.isArray(familyMembers)) return null;
  const responsible = familyMembers.find(
    (m: any) => m?.relationship === 'Responsável'
  );
  if (responsible?.name) return String(responsible.name).trim();
  const first = familyMembers[0];
  return first?.name ? String(first.name).trim() : null;
}

export default function PatientSearchSelect({
  onSelect,
  selectedPatient,
  placeholder = 'Buscar paciente por nome ou telefone...',
  className = ''
}: PatientSearchSelectProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<PatientSearchOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const searchPatients = useCallback(async (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('id, name, phone, biological_sex, family_members')
        .or(`name.ilike.%${trimmed}%,phone.ilike.%${trimmed}%`)
        .limit(20)
        .order('name');

      if (error) {
        console.error('PatientSearchSelect search error:', error);
        setResults([]);
        return;
      }

      const options: PatientSearchOption[] = (data || []).map((p: any) => ({
        id: p.id,
        name: p.name || '',
        phone: p.phone || null,
        biological_sex: p.biological_sex || null,
        parent_name: extractParentName(p.family_members)
      }));
      setResults(options);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }
    const t = setTimeout(() => {
      setOpen(true);
      searchPatients(searchTerm);
    }, 300);
    return () => clearTimeout(t);
  }, [searchTerm, searchPatients]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (p: PatientSearchOption) => {
    onSelect(p);
    setSearchTerm('');
    setResults([]);
    setOpen(false);
  };

  const handleClear = () => {
    onSelect(null);
    setSearchTerm('');
    setResults([]);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={selectedPatient ? selectedPatient.name : searchTerm}
          onChange={(e) => {
            if (selectedPatient) return;
            setSearchTerm(e.target.value);
          }}
          onFocus={() => searchTerm.trim() && setOpen(true)}
          placeholder={placeholder}
          className="w-full pl-9 pr-9 py-2.5 border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-[#2a2d36] text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all placeholder:text-slate-400"
        />
        {selectedPatient && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-600"
            aria-label="Limpar seleção"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {selectedPatient && (
        <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 dark:text-gray-400">
          <span>Paciente selecionado: {selectedPatient.name}</span>
          <button
            type="button"
            onClick={handleClear}
            className="text-pink-600 dark:text-pink-400 hover:underline font-medium"
          >
            Cadastrar novo
          </button>
        </div>
      )}

      {open && (searchTerm.trim() || results.length > 0) && !selectedPatient && (
        <div className="absolute z-50 mt-1 w-full max-h-56 overflow-y-auto bg-white dark:bg-[#1e2028] border border-slate-200 dark:border-gray-700 rounded-lg shadow-lg custom-scrollbar">
          {loading ? (
            <div className="p-4 text-center text-sm text-slate-500 dark:text-gray-400">
              Buscando...
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center text-sm text-slate-500 dark:text-gray-400">
              Nenhum paciente encontrado. Digite para buscar ou cadastre novo.
            </div>
          ) : (
            results.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelect(p)}
                className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors border-b border-slate-100 dark:border-gray-800 last:border-0 flex items-center gap-3"
              >
                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-[#2a2d36] flex items-center justify-center text-slate-500 dark:text-gray-400 shrink-0">
                  <User className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm text-slate-800 dark:text-gray-200 truncate">
                    {p.name}
                  </p>
                  {(p.phone || p.parent_name) && (
                    <p className="text-xs text-slate-500 dark:text-gray-400 truncate">
                      {[p.phone, p.parent_name].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
