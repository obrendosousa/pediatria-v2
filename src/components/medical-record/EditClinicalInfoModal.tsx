// src/components/medical-record/EditClinicalInfoModal.tsx

import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Save, Plus, Trash2, Search, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ClinicalSummary, Allergy, MedicationInUse } from '@/types/medical';

// Configuração das Seções (Mapeamento de Títulos e Campos)
const SECTIONS = {
  clinical: { title: 'Antecedentes Clínicos', type: 'text', field: 'antecedents_clinical' },
  surgical: { title: 'Antecedentes Cirúrgicos', type: 'text', field: 'antecedents_surgical' },
  family: { title: 'Antecedentes Familiares', type: 'text', field: 'antecedents_family' },
  habits: { title: 'Hábitos de Vida', type: 'text', field: 'habits' },
  allergies: { title: 'Alergias', type: 'list_allergies', field: 'allergies' },
  medications: { title: 'Medicamentos em Uso', type: 'list_meds', field: 'medications_in_use' },
};

export type SectionKey = keyof typeof SECTIONS;

interface EditClinicalInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSection: SectionKey;
  patientId: number;
  summaryData: ClinicalSummary | null;
  onRefresh: () => void; // Recarrega dados após salvar
}

export function EditClinicalInfoModal({ 
  isOpen, onClose, initialSection, patientId, summaryData, onRefresh 
}: EditClinicalInfoModalProps) {
  
  const [currentSection, setCurrentSection] = useState<SectionKey>(initialSection);
  const [textValue, setTextValue] = useState('');
  const [listValue, setListValue] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Atualiza estado local ao abrir ou trocar seção
  useEffect(() => {
    if (isOpen) {
      setCurrentSection(initialSection);
    }
  }, [isOpen, initialSection]);

  useEffect(() => {
    if (!summaryData) return;
    const field = SECTIONS[currentSection].field as keyof ClinicalSummary;
    const value = summaryData[field];

    if (SECTIONS[currentSection].type === 'text') {
      setTextValue((value as string) || '');
    } else {
      setListValue((value as any[]) || []);
    }
    setSearchTerm('');
    setSearchResults([]);
  }, [currentSection, summaryData]);

  // Lógica de Autocomplete (Medicamentos)
  useEffect(() => {
    const searchMedications = async () => {
      if (searchTerm.length < 3) {
        setSearchResults([]);
        return;
      }
      
      const { data } = await supabase
        .from('medications_catalog')
        .select('*')
        .textSearch('search_vector', `${searchTerm}:*`) // Busca Full-Text
        .limit(5);

      if (data) setSearchResults(data);
    };

    const timeout = setTimeout(searchMedications, 300);
    return () => clearTimeout(timeout);
  }, [searchTerm]);

  if (!isOpen) return null;

  const config = SECTIONS[currentSection];
  const sectionKeys = Object.keys(SECTIONS) as SectionKey[];
  const currentIndex = sectionKeys.indexOf(currentSection);

  // --- AÇÕES ---

  const handleNavigate = async (direction: 'next' | 'prev') => {
    // Salva automaticamente antes de trocar, MAS sem refresh para não piscar
    await handleSave(false);
    const newIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
    if (newIndex >= 0 && newIndex < sectionKeys.length) {
      setCurrentSection(sectionKeys[newIndex]);
    }
  };

  const handleClose = async () => {
    // Fecha o modal primeiro (sem piscar)
    onClose();
    // Salva em background sem refresh imediato
    await handleSave(false);
    // Atualiza os dados após um pequeno delay para não piscar
    setTimeout(() => {
      onRefresh();
    }, 300);
  };

  const handleSave = async (shouldRefresh: boolean = true) => {
    setIsSaving(true);
    const field = config.field;
    const value = config.type === 'text' ? textValue : listValue;

    // Upsert (Criar ou Atualizar)
    const payload: any = { patient_id: patientId, [field]: value };
    
    // Se já existe ID, mantemos para update, senão cria novo
    if (summaryData?.id) payload.id = summaryData.id;

    const { error } = await supabase.from('clinical_summaries').upsert(payload);
    
    if (!error && shouldRefresh) {
      onRefresh(); // Atualiza os cards automaticamente
    }
    setIsSaving(false);
  };

  const addListItem = (item: any) => {
    setListValue([...listValue, item]);
    setSearchTerm('');
    setSearchResults([]);
  };

  const removeListItem = (index: number) => {
    const newList = [...listValue];
    newList.splice(index, 1);
    setListValue(newList);
  };

  // --- RENDERIZADORES DE CONTEÚDO ---

  const renderTextEditor = () => (
    <textarea
      className="w-full h-64 p-4 bg-slate-50 dark:bg-[#2a2d36] border border-slate-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none resize-none text-slate-700 dark:text-gray-200"
      placeholder="Digite as informações aqui..."
      value={textValue}
      onChange={(e) => setTextValue(e.target.value)}
      onBlur={() => handleSave(false)} // Auto-save ao sair, sem refresh
    />
  );

  const renderListEditor = () => (
    <div className="h-64 flex flex-col">
      {/* Input de Busca */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
        <input 
          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-[#2a2d36] border border-slate-200 dark:border-gray-700 rounded-xl outline-none focus:border-rose-500 transition-colors"
          placeholder={config.type === 'list_allergies' ? "Buscar substância (ex: Dipirona)..." : "Buscar medicamento..."}
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
        
        {/* Dropdown de Resultados */}
        {searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[#1e2028] border border-slate-200 dark:border-gray-700 rounded-xl shadow-xl z-20 overflow-hidden">
            {searchResults.map(result => (
              <button
                key={result.id}
                onClick={() => addListItem(config.type === 'list_allergies' 
                  ? { substance: result.name, criticality: 'high' } 
                  : { name: result.name, dosage: result.dosage || '' }
                )}
                className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-[#2a2d36] border-b border-slate-100 dark:border-gray-800 last:border-0"
              >
                <p className="font-bold text-sm text-slate-800 dark:text-gray-200">{result.name}</p>
                <p className="text-xs text-slate-500">{result.active_ingredient} • {result.dosage}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lista de Itens Adicionados */}
      <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-2">
        {listValue.length === 0 && (
           <div className="text-center py-10 text-slate-400 text-sm">Nenhum item adicionado.</div>
        )}
        {listValue.map((item, idx) => (
          <div key={idx} className="flex items-center justify-between p-3 bg-white dark:bg-[#2a2d36] border border-slate-100 dark:border-gray-700 rounded-lg shadow-sm">
            <div>
               <p className="font-bold text-slate-700 dark:text-gray-200">
                 {item.substance || item.name}
               </p>
               {config.type === 'list_meds' && (
                 <input 
                   placeholder="Posologia (ex: 1 cp 8/8h)"
                   className="text-xs mt-1 bg-transparent border-b border-slate-200 dark:border-gray-600 outline-none w-full text-slate-500"
                   value={item.dosage}
                   onChange={(e) => {
                     const newList = [...listValue];
                     newList[idx].dosage = e.target.value;
                     setListValue(newList);
                   }}
                   onBlur={() => handleSave(false)} // Auto-save sem refresh
                 />
               )}
            </div>
            <button onClick={() => removeListItem(idx)} className="text-slate-400 hover:text-red-500 transition-colors">
              <Trash2 className="w-4 h-4"/>
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  // --- RENDER FINAL ---

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#1e2028] w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-gray-800 bg-slate-50/50 dark:bg-[#2a2d36]/50">
          <h3 className="text-lg font-bold text-slate-800 dark:text-gray-100 flex items-center gap-2">
            {config.type === 'list_allergies' && <AlertTriangle className="text-rose-500"/>}
            {config.title}
          </h3>
          <button onClick={handleClose} className="p-2 hover:bg-slate-200 dark:hover:bg-white/10 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {config.type === 'text' ? renderTextEditor() : renderListEditor()}
        </div>

        {/* Footer Navigation */}
        <div className="p-4 bg-slate-50 dark:bg-[#2a2d36] border-t border-slate-100 dark:border-gray-800 flex justify-between items-center">
          
          <button 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleNavigate('prev');
            }}
            type="button"
            disabled={currentIndex === 0}
            className="flex items-center gap-1 text-sm font-bold text-slate-500 disabled:opacity-30 hover:text-rose-600 transition-colors px-3 py-2"
          >
            <ChevronLeft className="w-4 h-4" /> 
            {currentIndex > 0 && SECTIONS[sectionKeys[currentIndex - 1]].title}
          </button>

          <div className="flex gap-1">
             {sectionKeys.map((key, idx) => (
                <div 
                  key={key} 
                  className={`w-2 h-2 rounded-full transition-colors ${
                    idx === currentIndex 
                      ? 'bg-rose-500 w-6' 
                      : 'bg-slate-200 dark:bg-gray-600'
                  }`} 
                />
             ))}
          </div>

          <button 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (currentIndex === sectionKeys.length - 1) {
                // Último item: salva com refresh e fecha
                handleSave(true);
                onClose();
              } else {
                handleNavigate('next');
              }
            }}
            type="button"
            className="flex items-center gap-1 text-sm font-bold text-rose-600 hover:text-rose-700 transition-colors px-3 py-2"
          >
            {currentIndex === sectionKeys.length - 1 ? (
              <>Salvar e Fechar</>
            ) : (
              <>
                {SECTIONS[sectionKeys[currentIndex + 1]].title}
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>

        </div>
      </div>
    </div>
  );
}