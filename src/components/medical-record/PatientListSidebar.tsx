// src/components/medical-record/PatientListSidebar.tsx

import React from 'react';
import { Search, Plus, User, ChevronRight } from 'lucide-react';

interface PatientBasicInfo {
  id: number;
  name: string;
  phone?: string;
}

interface PatientListSidebarProps {
  patients: PatientBasicInfo[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onNewPatient: () => void;
  loading?: boolean;
}

export function PatientListSidebar({
  patients,
  selectedId,
  onSelect,
  searchTerm,
  onSearchChange,
  onNewPatient,
  loading = false
}: PatientListSidebarProps) {
  
  // Filtro local (caso a busca não seja feita no backend a cada letra)
  const filtered = patients.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (p.phone && p.phone.includes(searchTerm))
  );

  return (
    <div className="w-80 h-full flex flex-col bg-white dark:bg-[#1e2028] border-r border-slate-200 dark:border-gray-800 transition-colors z-20">
      
      {/* --- HEADER DA SIDEBAR --- */}
      <div className="p-5 border-b border-slate-100 dark:border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-800 dark:text-gray-100 flex items-center gap-2">
            <User className="w-5 h-5 text-rose-500" /> Pacientes
          </h2>
          <span className="text-xs font-bold text-slate-400 dark:text-gray-500 bg-slate-100 dark:bg-[#2a2d36] px-2 py-1 rounded-md">
            {filtered.length}
          </span>
        </div>

        <div className="relative group">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 group-focus-within:text-rose-500 transition-colors" />
          <input
            placeholder="Buscar nome ou telefone..."
            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-[#2a2d36] border border-slate-200 dark:border-gray-700 rounded-xl text-sm text-slate-700 dark:text-gray-200 focus:outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100 dark:focus:ring-rose-900/20 transition-all placeholder:text-slate-400"
            value={searchTerm}
            onChange={e => onSearchChange(e.target.value)}
          />
        </div>
      </div>

      {/* --- LISTA --- */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-40 text-slate-400 text-sm gap-2">
            <div className="w-6 h-6 border-2 border-rose-200 border-t-rose-500 rounded-full animate-spin"/>
            Carregando...
          </div>
        ) : filtered.length === 0 ? (
           <div className="p-8 text-center text-slate-400 dark:text-gray-500 text-sm italic">
             Nenhum paciente encontrado.
           </div>
        ) : (
          filtered.map((patient) => {
            const isSelected = selectedId === patient.id;
            
            return (
              <button
                key={patient.id}
                onClick={() => onSelect(patient.id)}
                className={`w-full text-left p-3 rounded-xl transition-all flex items-center gap-3 group relative overflow-hidden ${
                  isSelected 
                    ? 'bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/50 shadow-sm' 
                    : 'hover:bg-slate-50 dark:hover:bg-[#2a2d36] border border-transparent'
                }`}
              >
                {/* Indicador de Seleção Ativa */}
                {isSelected && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-rose-500 rounded-r-full" />
                )}

                {/* Avatar / Iniciais */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-sm transition-colors shrink-0 ${
                  isSelected 
                    ? 'bg-rose-500 text-white' 
                    : 'bg-slate-100 dark:bg-[#2a2d36] text-slate-500 dark:text-gray-400 group-hover:bg-white dark:group-hover:bg-[#1e2028] group-hover:text-rose-500'
                }`}>
                  {patient.name.substring(0, 2).toUpperCase()}
                </div>

                {/* Dados */}
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-bold truncate ${
                    isSelected ? 'text-rose-900 dark:text-rose-300' : 'text-slate-700 dark:text-gray-300'
                  }`}>
                    {patient.name}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-gray-500 truncate flex items-center gap-1">
                    {patient.phone || 'Sem telefone'}
                  </p>
                </div>

                {/* Seta Hover */}
                {isSelected && <ChevronRight className="w-4 h-4 text-rose-400 ml-auto animate-in slide-in-from-left-1" />}
              </button>
            );
          })
        )}
      </div>

      {/* --- FOOTER (AÇÃO) --- */}
      <div className="p-4 border-t border-slate-100 dark:border-gray-800 bg-slate-50 dark:bg-[#2a2d36]">
        <button 
          onClick={onNewPatient}
          className="w-full bg-rose-600 hover:bg-rose-700 active:scale-95 text-white py-3 rounded-xl font-bold text-sm shadow-md shadow-rose-200 dark:shadow-none transition-all flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" /> Novo Paciente
        </button>
      </div>
    </div>
  );
}