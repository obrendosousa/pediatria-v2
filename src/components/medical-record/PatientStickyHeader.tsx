// src/components/medical-record/PatientStickyHeader.tsx
/* eslint-disable react-hooks/set-state-in-effect */

import React, { useState, useEffect } from 'react';
import {
  Play, Square, AlertTriangle,
  ChevronDown, Phone, ShieldCheck, User, ArrowLeft, MessageSquare, Edit2, Users
} from 'lucide-react';
import { calculatePreciseAge } from '@/lib/dateUtils';
import { ClinicalSummary } from '@/types/medical';

interface FamilyMember {
  name: string;
  relationship: string;
  phone?: string;
}

interface PatientStickyHeaderProps {
  patient: {
    id: number;
    name: string;
    birth_date?: string;
    phone?: string;
    gender?: string; // 'M' | 'F'
    family_members?: FamilyMember[];
    [key: string]: unknown;
  };
  summary?: ClinicalSummary | null;
  onStartConsultation: () => void;
  onFinishConsultation: () => void;
  isConsultationActive: boolean;
  startedAt?: string | null;
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
  onOpenPhonesManager,
  startedAt
}: PatientStickyHeaderProps) {

  // Timer baseado em timestamp real (funciona mesmo com aba em background)
  const [timer, setTimer] = useState(0);

  useEffect(() => {
    if (!isConsultationActive || !startedAt) {
      setTimer(0);
      return;
    }
    const startMs = new Date(startedAt).getTime();
    const calc = () => Math.max(0, Math.floor((Date.now() - startMs) / 1000));
    setTimer(calc());
    const interval = setInterval(() => setTimer(calc()), 1000);
    return () => clearInterval(interval);
  }, [isConsultationActive, startedAt]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Verifica Alergias Críticas
  const hasAllergies = summary?.allergies && summary.allergies.length > 0;

  return (
    <div className="sticky top-0 z-10 bg-white/80 dark:bg-[#08080b]/90 backdrop-blur-md border-b border-slate-200 dark:border-[#2d2d36] shadow-sm transition-all">
      <div className="px-4 sm:px-6 lg:px-8 py-3 sm:py-4 lg:py-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          
          {/* --- ESQUERDA: IDENTIFICAÇÃO --- */}
          <div className="flex items-center gap-3 sm:gap-4 lg:gap-5 min-w-0 flex-1">
            {/* Botão Voltar (se onBack fornecido) */}
            {onBack && (
              <button
                onClick={onBack}
                className="flex-shrink-0 p-2 hover:bg-slate-100 dark:hover:bg-[#2a2d36] rounded-lg transition-colors text-slate-600 dark:text-[#a1a1aa] hover:text-slate-800 dark:hover:text-gray-200"
                title="Voltar para lista"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            
            {/* Avatar com Gradiente */}
            <div className="relative flex-shrink-0">
               <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 rounded-full bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/40 dark:to-blue-800/20 border-2 border-white dark:border-[#3d3d48] shadow-md flex items-center justify-center text-base sm:text-lg lg:text-xl font-black text-blue-600 dark:text-blue-400">
                  {(patient.name || '??').substring(0,2).toUpperCase()}
               </div>
               {/* Indicador Online (Opcional) */}
               <div className="absolute bottom-0 right-0 w-3 h-3 sm:w-4 sm:h-4 bg-emerald-400 border-2 border-white dark:border-[#1e2028] rounded-full"></div>
            </div>

            <div className="min-w-0 flex-1">
               <h1 className="text-base sm:text-lg lg:text-xl font-black text-slate-800 dark:text-[#fafafa] flex items-center gap-2 sm:gap-3 min-w-0">
                  <span className="truncate">{patient.name}</span>
                  {hasAllergies && (
                    <span className="flex-shrink-0 flex items-center gap-1 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-[10px] px-2 py-0.5 rounded-full border border-red-100 dark:border-red-900/30 uppercase tracking-wide animate-pulse">
                      <AlertTriangle className="w-3 h-3" /> Alérgico
                    </span>
                  )}
               </h1>

               {/* Responsáveis / Núcleo Familiar */}
               {Array.isArray(patient.family_members) && patient.family_members.length > 0 && (
                 <div className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-500 dark:text-[#a1a1aa]">
                   <Users className="w-3 h-3 text-slate-400 flex-shrink-0" />
                   <span className="truncate">
                     {patient.family_members.map((m, i) => (
                       <span key={i}>
                         {i > 0 && <span className="mx-1 text-slate-300 dark:text-[#3d3d48]">·</span>}
                         <span className="font-medium text-slate-600 dark:text-[#d4d4d8]">{m.name}</span>
                         <span className="text-slate-400 dark:text-[#71717a]"> ({m.relationship})</span>
                       </span>
                     ))}
                   </span>
                 </div>
               )}

               <div className="flex flex-wrap items-center gap-2 sm:gap-3 lg:gap-4 mt-1 sm:mt-1.5 text-xs font-medium text-slate-500 dark:text-[#a1a1aa]">
                 {/* Idade Precisa */}
                 <span className="flex items-center gap-1.5 bg-slate-100 dark:bg-[#1c1c21] px-2 py-1 rounded-md flex-shrink-0">
                   <User className="w-3 h-3 text-slate-400 flex-shrink-0"/>
                   <span className="whitespace-nowrap">{calculatePreciseAge(patient.birth_date)}</span>
                 </span>
                 
                 {/* Telefone com botão de chat */}
                 {(primaryPhone || patient.phone) && onOpenChat && (
                   <button
                     onClick={() => onOpenChat(primaryPhone || patient.phone || '')}
                     className="flex items-center gap-1.5 hover:text-blue-500 cursor-pointer transition-colors group flex-shrink-0 min-w-0"
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
                className="group relative overflow-hidden bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white px-4 sm:px-5 lg:px-7 py-2.5 sm:py-3 rounded-xl font-semibold shadow-md shadow-blue-200/50 dark:shadow-blue-900/30 transition-all duration-200 active:scale-[0.97] flex items-center gap-2 sm:gap-2.5 text-sm sm:text-[15px] tracking-wide"
              >
                <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                  <Play className="w-3.5 h-3.5 fill-current" />
                </div>
                <span className="hidden sm:inline">Iniciar Atendimento</span>
                <span className="sm:hidden">Iniciar</span>
              </button>
            ) : (
              <button 
                onClick={onFinishConsultation}
                className="bg-slate-100 hover:bg-slate-200 dark:bg-[#1c1c21] dark:hover:bg-[#353842] text-slate-700 dark:text-gray-200 px-3 sm:px-4 lg:px-6 py-2 sm:py-2.5 lg:py-3 rounded-lg sm:rounded-xl font-bold border border-slate-200 dark:border-[#3d3d48] transition-all active:scale-95 flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base"
              >
                <Square className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current text-red-500 flex-shrink-0" />
                <span className="hidden sm:inline">Finalizar</span>
                <span className="sm:hidden">Fim</span>
              </button>
            )}

            {/* Botão Editar Cadastro */}
            {onEditPatient && (
              <button
                onClick={onEditPatient}
                className="p-2 sm:p-2.5 lg:p-3 rounded-lg sm:rounded-xl hover:bg-slate-50 dark:hover:bg-[#2a2d36] text-slate-500 dark:text-[#a1a1aa] hover:text-blue-500 dark:hover:text-blue-400 border border-transparent hover:border-slate-200 dark:hover:border-gray-700 transition-all flex-shrink-0"
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
        <div className="h-0.5 w-full bg-slate-100 dark:bg-[#1c1c21] overflow-hidden">
           <div className="h-full bg-blue-500 animate-pulse w-full origin-left transform scale-x-100"></div>
        </div>
      )}
    </div>
  );
}