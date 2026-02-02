// src/components/medical-record/PatientStickyHeader.tsx

import React, { useState, useEffect } from 'react';
import { 
  Play, Square, Clock, AlertTriangle, 
  ChevronDown, Phone, ShieldCheck, User, ArrowLeft, MessageSquare, Edit2
} from 'lucide-react';
import { calculatePreciseAge } from '@/lib/dateUtils';
import { ClinicalSummary } from '@/types/medical';

interface PatientStickyHeaderProps {
  patient: {
    id: number;
    name: string;
    birth_date?: string;
    phone?: string;
    gender?: string; // 'M' | 'F'
    [key: string]: any; // Permite campos adicionais do paciente
  };
  summary?: ClinicalSummary | null;
  onStartConsultation: () => void;
  onFinishConsultation: () => void;
  isConsultationActive: boolean;
  onBack?: () => void;
  onOpenChat?: (phone: string) => void;
  primaryPhone?: string;
  onEditPatient?: () => void;
  onOpenPhonesManager?: () => void;
}

export function PatientStickyHeader({ 
  patient, 
  summary,
  onStartConsultation,
  onFinishConsultation,
  isConsultationActive,
  onBack,
  onOpenChat,
  primaryPhone,
  onEditPatient,
  onOpenPhonesManager
}: PatientStickyHeaderProps) {
  
  // Lógica do Timer
  const [timer, setTimer] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isConsultationActive) {
      interval = setInterval(() => {
        setTimer((prev) => prev + 1);
      }, 1000);
    } else {
      setTimer(0);
    }
    return () => clearInterval(interval);
  }, [isConsultationActive]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Verifica Alergias Críticas
  const hasAllergies = summary?.allergies && summary.allergies.length > 0;

  return (
    <div className="sticky top-0 z-10 bg-white/80 dark:bg-[#1e2028]/90 backdrop-blur-md border-b border-slate-200 dark:border-gray-800 shadow-sm transition-all">
      <div className="px-4 sm:px-6 lg:px-8 py-3 sm:py-4 lg:py-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          
          {/* --- ESQUERDA: IDENTIFICAÇÃO --- */}
          <div className="flex items-center gap-3 sm:gap-4 lg:gap-5 min-w-0 flex-1">
            {/* Botão Voltar (se onBack fornecido) */}
            {onBack && (
              <button
                onClick={onBack}
                className="flex-shrink-0 p-2 hover:bg-slate-100 dark:hover:bg-[#2a2d36] rounded-lg transition-colors text-slate-600 dark:text-gray-400 hover:text-slate-800 dark:hover:text-gray-200"
                title="Voltar para lista"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            
            {/* Avatar com Gradiente */}
            <div className="relative flex-shrink-0">
               <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 rounded-full bg-gradient-to-br from-rose-100 to-rose-50 dark:from-rose-900/40 dark:to-rose-800/20 border-2 border-white dark:border-gray-700 shadow-md flex items-center justify-center text-base sm:text-lg lg:text-xl font-black text-rose-500 dark:text-rose-400">
                  {patient.name.substring(0,2).toUpperCase()}
               </div>
               {/* Indicador Online (Opcional) */}
               <div className="absolute bottom-0 right-0 w-3 h-3 sm:w-4 sm:h-4 bg-emerald-400 border-2 border-white dark:border-[#1e2028] rounded-full"></div>
            </div>

            <div className="min-w-0 flex-1">
               <h1 className="text-base sm:text-lg lg:text-xl font-black text-slate-800 dark:text-gray-100 flex items-center gap-2 sm:gap-3 min-w-0">
                  <span className="truncate">{patient.name}</span>
                  {hasAllergies && (
                    <span className="flex-shrink-0 flex items-center gap-1 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-[10px] px-2 py-0.5 rounded-full border border-red-100 dark:border-red-900/30 uppercase tracking-wide animate-pulse">
                      <AlertTriangle className="w-3 h-3" /> Alérgico
                    </span>
                  )}
               </h1>
               
               <div className="flex flex-wrap items-center gap-2 sm:gap-3 lg:gap-4 mt-1 sm:mt-1.5 text-xs font-medium text-slate-500 dark:text-gray-400">
                 {/* Idade Precisa */}
                 <span className="flex items-center gap-1.5 bg-slate-100 dark:bg-[#2a2d36] px-2 py-1 rounded-md flex-shrink-0">
                   <User className="w-3 h-3 text-slate-400 flex-shrink-0"/>
                   <span className="whitespace-nowrap">{calculatePreciseAge(patient.birth_date)}</span>
                 </span>
                 
                 {/* Telefone com botão de chat */}
                 {(primaryPhone || patient.phone) && onOpenChat && (
                   <button
                     onClick={() => onOpenChat(primaryPhone || patient.phone || '')}
                     className="flex items-center gap-1.5 hover:text-rose-500 cursor-pointer transition-colors group flex-shrink-0 min-w-0"
                     title="Abrir chat"
                   >
                     <Phone className="w-3 h-3 flex-shrink-0"/> 
                     <span className="truncate max-w-[120px] sm:max-w-none">{primaryPhone || patient.phone}</span>
                     <MessageSquare className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                   </button>
                 )}
                 {(!primaryPhone && !patient.phone) && (
                   <span className="flex items-center gap-1.5 text-slate-400 flex-shrink-0">
                     <Phone className="w-3 h-3"/> Sem contato
                   </span>
                 )}

                 {/* Convênio (Placeholder) */}
                 <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                   <ShieldCheck className="w-3 h-3"/> Particular
                 </span>
               </div>
            </div>
          </div>

          {/* --- DIREITA: AÇÕES DE ATENDIMENTO --- */}
          <div className="flex items-center gap-2 sm:gap-3 lg:gap-4 flex-shrink-0 w-full sm:w-auto justify-end sm:justify-start">
            
            {isConsultationActive && (
              <div className="flex flex-col items-end mr-1 sm:mr-2 animate-in fade-in slide-in-from-right-4">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden sm:block">Duração</span>
                <div className="text-lg sm:text-xl lg:text-2xl font-black font-mono text-slate-700 dark:text-gray-200">
                  {formatTime(timer)}
                </div>
              </div>
            )}

            {!isConsultationActive ? (
              <button 
                onClick={onStartConsultation}
                className="group relative overflow-hidden bg-rose-600 hover:bg-rose-700 text-white px-3 sm:px-4 lg:px-6 py-2 sm:py-2.5 lg:py-3 rounded-lg sm:rounded-xl font-bold shadow-lg shadow-rose-200 dark:shadow-none transition-all active:scale-95 flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base"
              >
                <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current flex-shrink-0" />
                <span className="hidden sm:inline">Iniciar Atendimento</span>
                <span className="sm:hidden">Iniciar</span>
              </button>
            ) : (
              <button 
                onClick={onFinishConsultation}
                className="bg-slate-100 hover:bg-slate-200 dark:bg-[#2a2d36] dark:hover:bg-[#353842] text-slate-700 dark:text-gray-200 px-3 sm:px-4 lg:px-6 py-2 sm:py-2.5 lg:py-3 rounded-lg sm:rounded-xl font-bold border border-slate-200 dark:border-gray-700 transition-all active:scale-95 flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base"
              >
                <Square className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current text-rose-500 flex-shrink-0" />
                <span className="hidden sm:inline">Finalizar</span>
                <span className="sm:hidden">Fim</span>
              </button>
            )}

            {/* Botão Editar Cadastro */}
            {onEditPatient && (
              <button
                onClick={onEditPatient}
                className="p-2 sm:p-2.5 lg:p-3 rounded-lg sm:rounded-xl hover:bg-slate-50 dark:hover:bg-[#2a2d36] text-slate-500 dark:text-gray-400 hover:text-rose-500 dark:hover:text-rose-400 border border-transparent hover:border-slate-200 dark:hover:border-gray-700 transition-all flex-shrink-0"
                title="Editar cadastro do paciente"
              >
                <Edit2 className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            )}
            
            <button 
              onClick={onOpenPhonesManager}
              className="p-2 sm:p-2.5 lg:p-3 rounded-lg sm:rounded-xl hover:bg-slate-50 dark:hover:bg-[#2a2d36] text-slate-400 hover:text-slate-600 dark:hover:text-gray-300 border border-transparent hover:border-slate-200 dark:hover:border-gray-700 transition-all flex-shrink-0"
              title="Gerenciar contatos"
            >
              <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>

        </div>
      </div>
      
      {/* Barra de Progresso Sutil (Opcional - Estilo YouTube) */}
      {isConsultationActive && (
        <div className="h-0.5 w-full bg-slate-100 dark:bg-gray-800 overflow-hidden">
           <div className="h-full bg-rose-500 animate-pulse w-full origin-left transform scale-x-100"></div>
        </div>
      )}
    </div>
  );
}