// src/components/medical-record/ClinicalSummaryGrid.tsx

import React, { useState } from 'react';
import { 
  Activity, Scissors, Users, Coffee, 
  AlertTriangle, Pill, Plus, Edit3 
} from 'lucide-react';
import { ClinicalSummary, Allergy, MedicationInUse } from '@/types/medical';
import { EditClinicalInfoModal, SectionKey } from './EditClinicalInfoModal';

interface ClinicalSummaryGridProps {
  patientId: number;
  summaryData: ClinicalSummary | null;
  onRefresh: () => void;
}

export function ClinicalSummaryGrid({ patientId, summaryData, onRefresh }: ClinicalSummaryGridProps) {
  
  const [activeSection, setActiveSection] = useState<SectionKey | null>(null);

  // Helper para renderizar conteúdo de texto ou lista
  const renderContent = (type: 'text' | 'list', field: keyof ClinicalSummary) => {
    const data = summaryData?.[field];

    if (!data || (Array.isArray(data) && data.length === 0)) {
      return (
        <div className="h-full flex flex-col items-center justify-center text-slate-300 dark:text-gray-600 group-hover:text-rose-400 transition-colors">
          <Plus className="w-6 h-6 mb-1 opacity-50" />
          <span className="text-xs font-medium">Adicionar</span>
        </div>
      );
    }

    if (type === 'list') {
      const list = data as any[];
      return (
        <div className="flex flex-wrap gap-2 mt-1">
          {list.slice(0, 3).map((item, idx) => (
            <span 
              key={idx}
              className={`text-[10px] px-2 py-0.5 rounded-full border font-bold truncate max-w-full ${
                field === 'allergies' 
                  ? 'bg-red-50 text-red-600 border-red-100 dark:bg-red-900/20 dark:border-red-900/30' 
                  : 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/20 dark:border-blue-900/30'
              }`}
            >
              {item.substance || item.name}
            </span>
          ))}
          {list.length > 3 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-bold">
              +{list.length - 3}
            </span>
          )}
        </div>
      );
    }

    return (
      <p className="text-xs text-slate-600 dark:text-gray-400 line-clamp-3 leading-relaxed">
        {data as string}
      </p>
    );
  };

  // Definição dos Cards
  const cards: Array<{
    key: SectionKey;
    title: string;
    icon: React.ElementType;
    field: keyof ClinicalSummary;
    type: 'text' | 'list';
    colorClass: string;
  }> = [
    { key: 'clinical', title: 'Antec. Clínicos', icon: Activity, field: 'antecedents_clinical', type: 'text', colorClass: 'text-blue-500' },
    { key: 'surgical', title: 'Antec. Cirúrgicos', icon: Scissors, field: 'antecedents_surgical', type: 'text', colorClass: 'text-emerald-500' },
    { key: 'family', title: 'Antec. Familiares', icon: Users, field: 'antecedents_family', type: 'text', colorClass: 'text-purple-500' },
    { key: 'habits', title: 'Hábitos', icon: Coffee, field: 'habits', type: 'text', colorClass: 'text-amber-500' },
    { key: 'allergies', title: 'Alergias', icon: AlertTriangle, field: 'allergies', type: 'list', colorClass: 'text-red-500' },
    { key: 'medications', title: 'Medicamentos', icon: Pill, field: 'medications_in_use', type: 'list', colorClass: 'text-indigo-500' },
  ];

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {cards.map((card) => {
           const hasData = summaryData?.[card.field] && (Array.isArray(summaryData[card.field]) ? (summaryData[card.field] as any[]).length > 0 : !!summaryData[card.field]);
           
           return (
            <div 
              key={card.key}
              onClick={() => setActiveSection(card.key)}
              className={`
                relative bg-white dark:bg-[#1e2028] p-4 rounded-2xl border border-slate-100 dark:border-gray-800 
                shadow-sm hover:shadow-md hover:border-rose-200 dark:hover:border-rose-900/30 transition-all cursor-pointer group min-h-[140px] flex flex-col
                ${hasData && card.key === 'allergies' ? 'border-l-4 border-l-red-500' : ''}
              `}
            >
              {/* Header do Card */}
              <div className="flex items-center gap-2 mb-2">
                <card.icon className={`w-4 h-4 ${card.colorClass}`} />
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-gray-500">
                  {card.title}
                </h3>
              </div>

              {/* Corpo */}
              <div className="flex-1 flex flex-col justify-start">
                {renderContent(card.type, card.field)}
              </div>

              {/* Hover Edit Icon */}
              <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <Edit3 className="w-3.5 h-3.5 text-slate-400" />
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL INTEGRADO */}
      <EditClinicalInfoModal 
        isOpen={!!activeSection}
        onClose={() => setActiveSection(null)}
        initialSection={activeSection || 'clinical'}
        patientId={patientId}
        summaryData={summaryData}
        onRefresh={onRefresh}
      />
    </>
  );
}